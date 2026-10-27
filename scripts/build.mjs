import { mkdir, cp, access, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)), dist=new URL('../dist/',import.meta.url);
const files=['index.html','style.css','studio.css','unified.css','app.js','studio.js','unified.js','gesture.js','selection.js','image-io.js','raw-scan.worker.js','zip.worker.js','zip-client.js','project-storage.js','preview.js','core.js','renderer.js','batch.js','.nojekyll','assets','vendor'];
await mkdir(dist,{recursive:true});
for(const name of files){await access(new URL(`../${name}`,import.meta.url));await cp(new URL(`../${name}`,import.meta.url),new URL(name,dist),{recursive:true});}
await cp(new URL('../node_modules/heic-to/dist/csp/',import.meta.url),new URL('../dist/vendor/heic-to/csp/',import.meta.url),{recursive:true});
await cp(new URL('../node_modules/heic-to/LICENSE',import.meta.url),new URL('../dist/vendor/heic-to-LICENSE.txt',import.meta.url));
// Fail the build early when a module import or Worker asset was not copied to dist.
for(const name of files.filter(file=>file.endsWith('.js'))){
  const text=await readFile(new URL(name,dist),'utf8');
  for(const match of text.matchAll(/(?:from\s*|import\s*\(|new\s+URL\s*\()\s*['"`](\.\/[^'"`]+)['"`]/g)){
    const imported=match[1];
    try{await access(new URL(imported,new URL(name,dist)));}
    catch{throw new Error(`Missing build asset: ${name} references ${imported}`);}
  }
}
const html=await readFile(new URL('index.html',dist),'utf8');
if(/(?:src|href)="\//.test(html))throw new Error('Absolute asset paths break project GitHub Pages.');
const manifest=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
await writeFile(new URL('build.json',dist),JSON.stringify({name:'FRAMELABS',version:manifest.version,builtAt:new Date().toISOString()}));
console.log(`Built ${files.length} entries to ${root}dist. HEIF decoder bundled locally.`);
