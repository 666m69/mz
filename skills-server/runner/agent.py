"""Pull exactly one authenticated job and execute only a reviewed, digest-pinned Linux adapter."""
import argparse
import ctypes
import errno
import hashlib
import http.client
import json
import os
from pathlib import Path
import resource
import shutil
import signal
import subprocess
import sys
import tempfile
import urllib.parse

ROOT = Path(__file__).resolve().parents[2]
CATALOG = Path(__file__).resolve().parents[1] / "reviewed.json"
MIB = 1024 * 1024
WALL = 6
MAX_RESULT = 96 * 1024

def source_bytes(adapter):
    files = {}
    if any(adapter[k] not in adapter["sources"] for k in ("entry", "module")):
        raise ValueError("unlisted entrypoint")
    h = hashlib.sha256(b"mz-adapter-v1\0" + adapter["entry"].encode() + b"\0" + adapter["module"].encode() + b"\0")
    contract = json.dumps([adapter["input_schema"], adapter["daily_builds"]], ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    h.update(contract.encode() + b"\0")
    for name in sorted(adapter["sources"]):
        path = (ROOT / name).resolve()
        if not path.is_relative_to(ROOT) or Path(name).is_absolute():
            raise ValueError("bad catalog path")
        data = path.read_bytes()
        files[name] = data
        h.update(name.encode() + b"\0" + hashlib.sha256(data).digest())
    return files, h.hexdigest()

def apply_limits():
    for kind, value in ((resource.RLIMIT_CPU, 2), (resource.RLIMIT_AS, 768 * MIB),
                        (resource.RLIMIT_FSIZE, 128 * 1024), (resource.RLIMIT_NOFILE, 64),
                        (resource.RLIMIT_CORE, 0)):
        resource.setrlimit(kind, (value, value))
        if resource.getrlimit(kind) != (value, value):
            raise RuntimeError("limits")

def syscall_filter():
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.prctl(38, 1, 0, 0, 0) != 0:  # PR_SET_NO_NEW_PRIVS
        raise OSError("no_new_privs")
    lib = ctypes.CDLL("libseccomp.so.2")
    lib.seccomp_init.argtypes = [ctypes.c_uint32]
    lib.seccomp_init.restype = ctypes.c_void_p
    lib.seccomp_syscall_resolve_name.argtypes = [ctypes.c_char_p]
    lib.seccomp_rule_add.argtypes = [ctypes.c_void_p, ctypes.c_uint32, ctypes.c_int, ctypes.c_uint]
    lib.seccomp_load.argtypes = [ctypes.c_void_p]
    lib.seccomp_release.argtypes = [ctypes.c_void_p]
    ctx = lib.seccomp_init(0x7fff0000)  # SCMP_ACT_ALLOW
    if not ctx:
        raise OSError("seccomp_init")
    try:
        blocked = ("socket socketpair connect bind listen accept accept4 sendto sendmsg sendmmsg "
                   "ptrace process_vm_readv process_vm_writev pidfd_getfd io_uring_setup io_uring_enter "
                   "io_uring_register mount umount2 setns unshare bpf open_by_handle_at")
        for name in blocked.split():
            nr = lib.seccomp_syscall_resolve_name(name.encode())
            if nr < 0 or lib.seccomp_rule_add(ctx, 0x00050000 | errno.EPERM, nr, 0) != 0:
                raise OSError("seccomp_rule")
        if lib.seccomp_load(ctx) != 0:
            raise OSError("seccomp_load")
    finally:
        lib.seccomp_release(ctx)

def before_exec():
    apply_limits()
    syscall_filter()

def isolated(files, entry, args, payload, probe=False):
    node = shutil.which("node")
    if not node or not sys.platform.startswith("linux"):
        return {"ok": False, "error": "sandbox_unavailable"}
    with tempfile.TemporaryDirectory(prefix="mz-skills-") as base:
        src, out = Path(base) / "src", Path(base) / "output"
        src.mkdir(mode=0o700)
        out.mkdir(mode=0o700)
        for name, data in files.items():
            dest = src / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
        script = src / entry
        if probe:
            (src / "limits").write_text("verified")
            child_args = [str(src / "limits")]
        else:
            child_args = [str(src / args[0]), str(out), args[1]]
        cmd = [node, "--permission", "--jitless", "--v8-pool-size=1", "--disable-wasm-trap-handler", "--no-addons",
               "--disable-proto=throw", "--max-old-space-size=32", "--allow-fs-read=" + str(src),
               "--allow-fs-read=" + str(out), "--allow-fs-write=" + str(out), str(script), *child_args]
        with tempfile.TemporaryFile() as stdout, tempfile.TemporaryFile() as stderr:
            try:
                proc = subprocess.Popen(cmd, cwd=out, env={"LANG": "C.UTF-8", "TZ": "UTC", "UV_THREADPOOL_SIZE": "1", "MALLOC_ARENA_MAX": "1"},
                                        stdin=subprocess.PIPE, stdout=stdout, stderr=stderr, close_fds=True,
                                        start_new_session=True, preexec_fn=before_exec)
            except (OSError, subprocess.SubprocessError):
                return {"ok": False, "error": "sandbox_unavailable"}
            try:
                proc.communicate(json.dumps(payload).encode(), timeout=WALL)
            except subprocess.TimeoutExpired:
                os.killpg(proc.pid, signal.SIGKILL)
                proc.wait()
                return {"ok": False, "error": "timeout"}
            if proc.returncode != 0:
                return {"ok": False, "error": "resource_limit" if proc.returncode < 0 else "sandbox_unavailable"}
            stdout.seek(0)
            data = stdout.read(MAX_RESULT + 1)
            if len(data) > MAX_RESULT:
                return {"ok": False, "error": "resource_limit"}
            try:
                return json.loads(data)
            except (ValueError, UnicodeError):
                return {"ok": False, "error": "contract_failed"}

def execute(job):
    catalog = json.loads(CATALOG.read_text())
    options = catalog.get(job["skill_id"], {}).get("adapters", {})
    adapter = next((v for v in options.values() if v["digest"] == job["digest"]), None)
    if adapter is None or job["kind"] not in ("test", "build"):
        return {"ok": False, "error": "digest_mismatch"}
    files, digest = source_bytes(adapter)
    if digest != job["digest"]:
        return {"ok": False, "error": "digest_mismatch"}
    return isolated(files, adapter["entry"], [adapter["module"], job["skill_id"]],
                    {"kind": job["kind"], "input": job.get("input")})

def post(path, data, idem=None):
    # No redirects, inherited proxy, or bearer forwarding to a second host.
    target = urllib.parse.urlsplit(os.environ["SKILLS_URL"])
    if target.username or target.password or target.query or target.fragment or target.path not in ("", "/"):
        raise ValueError("invalid control origin")
    if target.scheme == "https":
        conn = http.client.HTTPSConnection(target.hostname, target.port, timeout=10)
    elif target.scheme == "http" and target.hostname in ("127.0.0.1", "::1", "localhost"):
        conn = http.client.HTTPConnection(target.hostname, target.port, timeout=10)
    else:
        raise ValueError("TLS required")
    headers = {"Authorization": "Bearer " + os.environ["SKILLS_RUNNER_TOKEN"], "Content-Type": "application/json"}
    if idem:
        headers["Idempotency-Key"] = idem
    try:
        conn.request("POST", "/api/runner/" + path, json.dumps(data, ensure_ascii=False).encode(), headers)
        response = conn.getresponse()
        body = response.read(MAX_RESULT + 1)
        if response.status != 200 or len(body) > MAX_RESULT:
            raise RuntimeError("control HTTP " + str(response.status))
        return json.loads(body)
    finally:
        conn.close()

def once():
    job = post("claim", {})["job"]
    if not job:
        return "idle"
    try:
        result = execute(job)
    except (ValueError, OSError, KeyError):
        result = {"ok": False, "error": "sandbox_unavailable"}
    payload = {**result, "lease": job["lease"]}
    for attempt in range(2):
        try:
            post("jobs/" + job["id"] + "/complete", payload, job["lease"])
            break
        except (OSError, http.client.HTTPException):
            if attempt:
                raise
    return "succeeded" if result.get("ok") else result["error"]

def main():
    parser = argparse.ArgumentParser()
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument("--once", action="store_true")
    modes.add_argument("--probe", action="store_true")
    modes.add_argument("--fingerprints", action="store_true")
    opts = parser.parse_args()
    if opts.probe:
        file = "skills-server/runner/probe.mjs"
        result = isolated({file: (ROOT / file).read_bytes()}, file, [], {}, probe=True)
        print(json.dumps(result))
        return int("network" not in result)
    if opts.fingerprints:
        for skill, item in json.loads(CATALOG.read_text()).items():
            for ref, adapter in item["adapters"].items():
                print(skill, ref, source_bytes(adapter)[1])
        return 0
    try:
        print(once())
    except (OSError, ValueError, KeyError, RuntimeError, http.client.HTTPException):
        print("control_unavailable", file=sys.stderr)
        return 1
    return 0

if __name__ == "__main__":
    sys.exit(main())
