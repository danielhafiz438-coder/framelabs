import http from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root=await realpath(process.argv.includes('--dist')?'dist':'.');
const port=Number(process.env.PORT||4173);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.json':'application/json'};
http.createServer(async(req,res)=>{
  try {
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const candidate=resolve(root,`.${path==='/'?'/index.html':path}`);
    if(candidate!==root&&!candidate.startsWith(root+sep))throw new Error('outside root');
    const file=await realpath(candidate);if(!file.startsWith(root+sep)||file.includes(`${sep}.git${sep}`)||file.includes(`${sep}artifacts${sep}`))throw new Error('private path');
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(await readFile(file));
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`FRAMELABS: http://127.0.0.1:${port}`));
