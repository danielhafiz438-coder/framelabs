/* Browser-local image reader. RAW support uses embedded JPEG previews, never a full sensor demosaic. */
export const RAW_EXTENSIONS = /\.(arw|cr2|cr3|nef|nrw|dng|raf|rw2|orf|pef|srw|3fr|iiq|erf|raw)$/i;
const HEIF_EXTENSIONS = /\.(heic|heif|hif)$/i;
const decodeNative = blob => {
  const url=URL.createObjectURL(blob);
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve({img,url});
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Format gambar tidak dapat dibaca oleh browser.'));};
    img.src=url;
  });
};
/* Parse JPEG SOI to EOI segments in RAW byte streams, choosing the largest valid-looking
 * embedded JPEG rather than a tiny thumbnail. Never process beyond input limits. */
export function findEmbeddedJpeg(bytes){
  let best=null,start=-1;
  for(let i=0;i+2<bytes.length;i++){
    if(bytes[i]!==255)continue;
    if(start<0 && bytes[i+1]===216 && bytes[i+2]===255){
      const marker=bytes[i+3];
      if(marker!==undefined && [224,225,226,227,232,219,192,193,194,196,221,254].includes(marker)){
        start=i;i+=2;
      }
    }else if(start>=0 && bytes[i+1]===217){
      const end=i+2,length=end-start;
      if(length>4096 && (!best||length>best.length))best={start,end,length};
      start=-1;i++;
    }
  }
  return best;
}
// Yield between blocks when Workers are unavailable (older/iOS restricted contexts).
export async function scanPreviewCooperatively(bytes,step=1048576){
  let best=null,start=-1;
  for(let i=0;i+2<bytes.length;i++){
    if(i>0 && i%step===0)await new Promise(resolve=>setTimeout(resolve,0));
    if(bytes[i]!==255)continue;
    if(start<0 && bytes[i+1]===216 && bytes[i+2]===255){
      if([224,225,226,227,232,219,192,193,194,196,221,254].includes(bytes[i+3])){
        start=i;i+=2;
      }
    }else if(start>=0 && bytes[i+1]===217){
      const end=i+2,length=end-start;
      if(length>4096 && (!best||length>best.length))best={start,end,length};
      start=-1;i++;
    }
  }
  return best;
}
export async function scanEmbeddedJpeg(file){
  if(typeof Worker!=='undefined'){
    let worker;
    try{
      worker=new Worker(new URL('./raw-scan.worker.js',import.meta.url),{type:'module'});
      const buffer=await file.arrayBuffer();
      const result=await new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>reject(new Error('RAW preview worker timed out')),30000);
        worker.onmessage=({data})=>{clearTimeout(timeout);if(data.error)reject(new Error(data.error));else resolve(data.result);};
        worker.onerror=()=>{clearTimeout(timeout);reject(new Error('RAW worker unavailable'));};
        worker.postMessage({buffer},[buffer]);
      });
      return result;
    }catch{
      // CSP restrictions or Worker failures: retain compatibility without long blocking loops.
    }finally{worker?.terminate();}
  }
  return scanPreviewCooperatively(new Uint8Array(await file.arrayBuffer()));
}
export async function openPhoto(file){
  if(RAW_EXTENSIONS.test(file.name)){
    const jpeg=await scanEmbeddedJpeg(file);
    if(!jpeg)throw new Error('Fail RAW ini tiada preview JPEG yang dapat dibaca. Eksport JPEG daripada kamera dahulu.');
    const blob=file.slice(jpeg.start,jpeg.end,'image/jpeg');
    try{
      const loaded=await decodeNative(blob);
      return {...loaded,source:'RAW preview',warning:'RAW dibuka menggunakan preview JPEG terbina, bukan data sensor penuh.'};
    }catch{
      throw new Error('Preview JPEG dalam fail RAW tidak boleh dibaca. Cuba eksport JPG melalui kamera.');
    }
  }
  try{return {...await decodeNative(file),source:'native',warning:null};}
  catch(nativeError){
    if(!HEIF_EXTENSIONS.test(file.name))throw nativeError;
    let heicTo;
    try{({heicTo}=await import('./vendor/heic-to/csp/heic-to.js'));}
    catch{throw new Error('Decoder HEIF tidak tersedia. Gunakan versi FrameLabs yang sudah dibina atau buka melalui Safari.');}
    try{
      const converted=await heicTo({blob:file,type:'image/jpeg',quality:0.94});
      const blob=Array.isArray(converted)?converted[0]:converted;
      return {...await decodeNative(blob),source:'HEIF decoder',warning:'HEIC/HEIF ditukar ke JPEG dalam peranti untuk disunting.'};
    }catch{throw new Error('HEIC/HEIF ini tidak berjaya dinyahkod. Cuba eksport JPEG daripada aplikasi Photos.');}
  }
}
