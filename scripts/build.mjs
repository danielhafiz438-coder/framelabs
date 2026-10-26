import { mkdir, cp, access, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)), dist=new URL('../dist/',import.meta.url);
const files=['index.html','style.css','studio.css','app.js','studio.js','image-io.js','core.js','renderer.js','batch.js','.nojekyll','assets','vendor'];
await mkdir(dist,{recursive:true});
for(const name of files){await access(new URL(`../${name}`,import.meta.url));await cp(new URL(`../${name}`,import.meta.url),new URL(name,dist),{recursive:true});}
await cp(new URL('../node_modules/heic-to/dist/csp/',import.meta.url),new URL('../dist/vendor/heic-to/csp/',import.meta.url),{recursive:true});
const html=await readFile(new URL('index.html',dist),'utf8');
if(/(?:src|href)="\//.test(html))throw new Error('Absolute asset paths break project GitHub Pages.');
await writeFile(new URL('build.json',dist),JSON.stringify({name:'FRAMELABS',version:'1.0.0',builtAt:new Date().toISOString()}));
console.log(`Built ${files.length} entries to ${root}dist. HEIF decoder bundled locally.`);
