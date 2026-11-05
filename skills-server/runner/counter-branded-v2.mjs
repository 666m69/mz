// Separate branded release: original counter-v1 remains immutable and rollback-ready.
import {build as buildV1,fixture} from './counter-v1.mjs';
import {brandStandaloneApp} from './brand-v2.mjs';
export {fixture};
export async function build(input,out){return brandStandaloneApp(await buildV1(input,out));}
