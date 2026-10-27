import { createZip } from './batch.js';
// CRC32 and ZIP assembly run entirely inside a dedicated worker.
self.onmessage = async ({data}) => {
  try {
    const blob = await createZip(data.entries,(completed,total)=>
      self.postMessage({type:'progress',completed,total}));
    self.postMessage({type:'done',blob});
  } catch(error) {
    self.postMessage({type:'error',error:String(error?.message||error)});
  }
};
