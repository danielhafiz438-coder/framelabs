import { mkdir, cp, access, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)), dist=new URL('../dist/',import.meta.url);
const files=['index.html','style.css','studio.css','unified.css','app.js','studio.js','unified.js','gesture.js','selection.js','image-io.js','raw-scan.worker.js','zip.worker.js','zip-client.js','project-storage.js','preview.js','core.js','renderer.js','batch.js','.nojekyll','assets','vendor'];
await mkdir(dist,{recursive:true});
for(const name of files){await access(new URL(`../${name}`,import.meta.url));await cp(new URL(`../${name}`,import.meta.url),new URL(name,dist),{recursive:true});}
await cp(new URL('../node_modules/heic-to/dist/csp/',import.meta.url),new URL('../dist/vendor/heic-to/csp/',import.meta.url),{recursive:true});
await cp(new URL('../node_modules/heic-to/LICENSE',import.meta.url),new URL('../dist/vendor/heic-to-LICENSE.txt',import.meta.url));
const html=await readFile(new URL('index.html',dist),'utf8');
if(/(?:src|href)="\//.test(html))throw new Error('Absolute asset paths break project GitHub Pages.');
const manifest=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
await writeFile(new URL('build.json',dist),JSON.stringify({name:'FRAMELABS',version:manifest.version,builtAt:new Date().toISOString()}));
console.log(`Built ${files.length} entries to ${root}dist. HEIF decoder bundled locally.`);
