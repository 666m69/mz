const SITE_TITLE = 'MZcode | مواقع وتطبيقات وحلول تقنية';
const SITE_DESCRIPTION = 'MZcode — خدمات تطوير المواقع والتطبيقات وحلول الأتمتة والذكاء الاصطناعي. استكشف مشاريعنا واطلب مشروعك عبر mzcodehub.com';
const CANONICAL_URL = 'https://mzcodehub.com/';
const OG_IMAGE_URL = 'https://mzcodehub.com/og-image.png';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function updateMeta(html, key, content, attribute = 'property') {
  const identity = new RegExp(`\\b${attribute}\\s*=\\s*(["'])${escapeRegExp(key)}\\1`, 'i');
  let found = false;
  const output = html.replace(/<meta\b[^>]*>/gi, (tag) => {
    if (!identity.test(tag)) return tag;
    found = true;
    const value = escapeAttribute(content);
    if (/\bcontent\s*=\s*(["']).*?\1/i.test(tag)) {
      return tag.replace(/(\bcontent\s*=\s*)(["']).*?\2/i, (_match, prefix, quote) => `${prefix}${quote}${value}${quote}`);
    }
    return tag.replace(/\s*\/?>(\s*)$/, (_match, tail) => ` content="${value}">${tail}`);
  });
  if (found) return output;
  const tag = `<meta ${attribute}="${escapeAttribute(key)}" content="${escapeAttribute(content)}">`;
  return output.replace(/<\/head\s*>/i, `${tag}\n</head>`);
}

function updateCanonical(html, href) {
  const identity = /\brel\s*=\s*(["'])canonical\1/i;
  let found = false;
  const output = html.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!identity.test(tag)) return tag;
    found = true;
    if (/\bhref\s*=\s*(["']).*?\1/i.test(tag)) {
      return tag.replace(/(\bhref\s*=\s*)(["']).*?\2/i, (_match, prefix, quote) => `${prefix}${quote}${escapeAttribute(href)}${quote}`);
    }
    return tag.replace(/\s*\/?>(\s*)$/, (_match, tail) => ` href="${escapeAttribute(href)}">${tail}`);
  });
  if (found) return output;
  return output.replace(/<\/head\s*>/i, `<link rel="canonical" href="${escapeAttribute(href)}">\n</head>`);
}

function projectCta() {
  return `<section id="mzcode-project-cta" lang="ar" dir="rtl" aria-labelledby="mzcode-project-cta-title" style="box-sizing:border-box;max-width:1000px;margin:36px auto 28px;padding:28px 24px;border:1px solid #c89a53;border-radius:14px;background:linear-gradient(135deg,#111 0%,#19150f 100%);color:#f5f1e9;text-align:right">
  <p style="margin:0 0 8px;color:#dfb86e;font-size:15px;font-weight:700">MZcode · حلول تقنية</p>
  <h2 id="mzcode-project-cta-title" style="margin:0 0 10px;color:#fff;font-size:clamp(23px,4vw,32px);line-height:1.5">لديك فكرة أو مشروع رقمي؟</h2>
  <p style="margin:0 0 20px;color:#e1ddd5;font-size:17px;line-height:1.9">نطوّر مواقع وتطبيقات، ونبني حلول أتمتة وبرمجيات أعمال تناسب احتياجك.</p>
  <a href="mailto:info@mzcodehub.com?subject=طلب%20تنفيذ%20مشروع" style="display:inline-flex;min-height:48px;align-items:center;justify-content:center;padding:11px 22px;border-radius:8px;background:#d5aa63;color:#17120a;font-weight:700;text-decoration:none">اطلب مشروعك عبر البريد</a>
</section>`;
}

function rewriteHomepage(html) {
  let output = html;
  const titleTag = `<title>${SITE_TITLE}</title>`;
  if (/<title\b[^>]*>[\s\S]*?<\/title>/i.test(output)) {
    output = output.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, titleTag);
  } else {
    output = output.replace(/<\/head\s*>/i, `${titleTag}\n</head>`);
  }

  output = updateMeta(output, 'description', SITE_DESCRIPTION, 'name');
  output = updateMeta(output, 'og:title', SITE_TITLE);
  output = updateMeta(output, 'og:description', SITE_DESCRIPTION);
  output = updateMeta(output, 'og:url', CANONICAL_URL);
  output = updateMeta(output, 'og:site_name', 'MZcode');
  output = updateMeta(output, 'og:type', 'website');
  output = updateMeta(output, 'og:image', OG_IMAGE_URL);
  output = updateMeta(output, 'twitter:card', 'summary_large_image', 'name');
  output = updateMeta(output, 'twitter:title', SITE_TITLE, 'name');
  output = updateMeta(output, 'twitter:description', SITE_DESCRIPTION, 'name');
  output = updateMeta(output, 'twitter:image', OG_IMAGE_URL, 'name');
  output = updateCanonical(output, CANONICAL_URL);

  if (!/id=["']mzcode-project-cta["']/i.test(output)) {
    const cta = projectCta();
    if (/<\/main\s*>/i.test(output)) {
      output = output.replace(/<\/main\s*>/i, `${cta}\n</main>`);
    } else if (/<\/body\s*>/i.test(output)) {
      output = output.replace(/<\/body\s*>/i, `${cta}\n</body>`);
    }
  }
  return output;
}


const canonical = 'https://mzcodehub.com';
const origin = 'https://mz702.pages.dev';
const allowedHosts = new Set(['mzcodehub.com', 'www.mzcodehub.com']);
const encoder = new TextEncoder();
const MAX_HTML_BYTES = 256 * 1024;

async function readTextLimited(response, maxBytes) {
  const clone = response.clone();
  const reader = clone.body?.getReader();
  if (!reader) return '';
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      // A tee'd clone may wait for the other branch to be consumed before cancel resolves.
      reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8').decode(bytes);
}

async function signVisitor(request, headers, privateKey) {
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip || !privateKey) return false;
  const stamp = String(Date.now());
  const message = [stamp, request.method, new URL(request.url).pathname, ip].join('\n');
  const bytes = Uint8Array.from(atob(privateKey), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', bytes, {name:'ECDSA', namedCurve:'P-256'}, false, ['sign']);
  const signature = await crypto.subtle.sign({name:'ECDSA', hash:'SHA-256'}, key, encoder.encode(message));
  headers.set('X-MZ-Visitor', ip);
  headers.set('X-MZ-Time', stamp);
  headers.set('X-MZ-Proof', btoa(String.fromCharCode(...new Uint8Array(signature))));
  return true;
}

async function serveOgImage(request, env) {
  if (!env.MZ_OG_IMAGE_URL) return new Response('Image unavailable', {status:503});
  try {
    const upstream = await fetch(env.MZ_OG_IMAGE_URL, {method:request.method === 'HEAD' ? 'HEAD' : 'GET'});
    if (!upstream.ok) return new Response('Image unavailable', {status:502});
    const headers = new Headers(upstream.headers);
    headers.set('Content-Type', 'image/png');
    headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(request.method === 'HEAD' ? null : upstream.body, {status:200, headers});
  } catch {
    return new Response('Image unavailable', {status:502});
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!allowedHosts.has(url.hostname)) return new Response('Not found', {status:404});
    if (url.origin !== canonical) return Response.redirect(canonical + url.pathname + url.search, 308);
    if (!['GET','HEAD','POST','PUT'].includes(request.method)) return new Response('Method not allowed', {status:405});
    if (url.pathname === '/og-image.png' && ['GET','HEAD'].includes(request.method)) return serveOgImage(request, env);
    const headers = new Headers();
    for (const name of ['accept','content-type','authorization']) {
      if (request.headers.has(name)) headers.set(name, request.headers.get(name));
    }
    if (request.method === 'POST' || request.method === 'PUT') {
      if (request.headers.get('Origin') !== canonical) return new Response('Forbidden', {status:403});
      if (!/^\/api\/(contact|menus(?:\/[a-f0-9]{32})?)$/.test(url.pathname)) return new Response('Not found', {status:404});
      headers.set('Origin', origin);
      if (!await signVisitor(request, headers, env.MZ_EDGE_SIGNING_KEY)) return new Response('Service unavailable', {status:503});
    }
    const target = new URL(origin);
    target.pathname = url.pathname;
    target.search = url.search;
    const upstream = await fetch(target, {method:request.method, headers, body:request.body, redirect:'manual'});
    let result;
    if (url.pathname === '/' && request.method === 'GET' && upstream.ok && (upstream.headers.get('content-type') || '').toLowerCase().includes('text/html')) {
      const contentLength = Number(upstream.headers.get('content-length') || 0);
      if (!contentLength || contentLength <= MAX_HTML_BYTES) {
        const html = await readTextLimited(upstream, MAX_HTML_BYTES);
        if (html !== null) {
          const responseHeaders = new Headers(upstream.headers);
          for (const name of ['content-length','content-encoding','etag','content-md5']) responseHeaders.delete(name);
          responseHeaders.set('Content-Type', responseHeaders.get('Content-Type').includes('charset=') ? responseHeaders.get('Content-Type') : 'text/html; charset=utf-8');
          responseHeaders.set('Cache-Control', 'public, max-age=300');
          result = new Response(rewriteHomepage(html), {status:upstream.status, statusText:upstream.statusText, headers:responseHeaders});
        }
      }
    }
    if (!result) result = new Response(upstream.body, upstream);
    if (result.headers.has('Location')) {
      const location = new URL(result.headers.get('Location'), target);
      if (location.origin === origin) result.headers.set('Location', canonical + location.pathname + location.search + location.hash);
    }
    if (result.ok && !url.pathname.startsWith('/api/')) result.headers.delete('X-Robots-Tag');
    return result;
  }
};
