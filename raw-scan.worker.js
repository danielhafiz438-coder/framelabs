import { findEmbeddedJpeg } from './image-io.js';
// Run JPEG preview marker detection off the browser main thread.
self.onmessage = ({data}) => {
  try {
    const result = findEmbeddedJpeg(new Uint8Array(data.buffer));
    self.postMessage({id:data.id,result});
  } catch(error) {
    self.postMessage({id:data.id,error:String(error?.message||error)});
  }
};
