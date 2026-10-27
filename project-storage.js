import { STORAGE_KEY, parseProject } from './core.js';
// Keep the large base64 image strings out of the frequently saved settings record.
// Existing v1 records are migrated lazily on their first save.
export function createProjectStore(storage){
  const photoKey=STORAGE_KEY+'.photo',logoKey=STORAGE_KEY+'.logo';
  let lastPhoto=null,lastLogo=null;
  return {
    restore(){
      const saved=parseProject(storage.getItem(STORAGE_KEY));
      if(!saved)return null;
      lastPhoto=storage.getItem(photoKey);lastLogo=storage.getItem(logoKey);
      if(lastPhoto!==null)saved.photo=lastPhoto;
      if(lastLogo!==null)saved.logo=lastLogo;
      return saved;
    },
    save(project){
      try{storage.setItem(STORAGE_KEY,JSON.stringify({...project,photo:null,logo:null}));}
      catch{return 'unavailable';}
      let assetsSaved=true;
      for(const [key,value,old,remember] of [
        [photoKey,project.photo,lastPhoto,v=>{lastPhoto=v;}],
        [logoKey,project.logo,lastLogo,v=>{lastLogo=v;}]
      ]){
        if(value===old)continue;
        try{
          if(value==null)storage.removeItem(key);else storage.setItem(key,value);
          remember(value);
        }catch{assetsSaved=false;}
      }
      return assetsSaved?'full':'settings';
    },
    clear(){
      for(const key of [STORAGE_KEY,photoKey,logoKey])storage.removeItem(key);
      lastPhoto=null;lastLogo=null;
    }
  };
}
