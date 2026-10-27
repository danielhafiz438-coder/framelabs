import { createZip } from './batch.js';
// Worker threads keep CRC32 and archive creation from blocking touch/scroll.
export async function createZipResponsive(entries,{onProgress=()=>{},signal}={}){
  if(signal?.aborted)throw new Error('Eksport dibatalkan.');
  if(typeof Worker==='undefined')return createZip(entries,onProgress);
  let worker;
  try{worker=new Worker(new URL('./zip.worker.js',import.meta.url),{type:'module'});}
  catch{return createZip(entries,onProgress);}
  return new Promise((resolve,reject)=>{
    let settled=false;
    const finish=(error,blob)=>{
      if(settled)return;
      settled=true;signal?.removeEventListener('abort',abort);worker.terminate();
      if(error)reject(error);else resolve(blob);
    };
    const abort=()=>finish(new Error('Eksport dibatalkan.'));
    signal?.addEventListener('abort',abort,{once:true});
    worker.onmessage=({data})=>{
      if(data.type==='progress')onProgress(data.completed,data.total);
      else if(data.type==='error')finish(new Error(data.error));
      else if(data.type==='done')finish(null,data.blob);
    };
    worker.onerror=()=>{
      // Safari/CSP may reject module Workers after construction; fall back safely.
      if(signal?.aborted){finish(new Error('Eksport dibatalkan.'));return;}
      worker.terminate();
      createZip(entries,onProgress).then(blob=>finish(null,blob),error=>finish(error));
    };
    try{worker.postMessage({entries});}catch(e){finish(e);}
  });
}
