import test from 'node:test';
import assert from 'node:assert/strict';
import {createProjectStore} from '../project-storage.js';
import {STORAGE_KEY,freshStyles} from '../core.js';
import {scanPreviewCooperatively,findEmbeddedJpeg} from '../image-io.js';
import {createZipResponsive} from '../zip-client.js';

function fakeStorage(){
 const map=new Map(),writes=[];
 return {map,writes,getItem:k=>map.get(k)??null,setItem(k,v){map.set(k,v);writes.push([k,v.length]);},removeItem:k=>map.delete(k)};
}
test('autosave writes compact settings without reserializing photo strings',()=>{
 const db=fakeStorage(),store=createProjectStore(db);
 const photo='data:image/jpeg;base64,'+'A'.repeat(300000);
 const first={version:1,template:'soft',styles:freshStyles(),photo,logo:null,photoName:'photo.jpg'};
 assert.equal(store.save(first),'full');
 const count=db.writes.length;
 assert.ok(db.map.get(STORAGE_KEY).length<3000,'settings record must not embed 300 KB photo');
 assert.equal(store.save({...first,template:'white'}),'full');
 const later=db.writes.slice(count);
 assert.deepEqual(later.map(([name])=>name),[STORAGE_KEY]);
 assert.equal(store.restore().photo,photo);
 store.clear();
 assert.equal(db.map.size,0);
});
test('older v1 project with embedded photo is migrated on first save',()=>{
 const db=fakeStorage();
 const photo='data:image/jpeg;base64,AAAA';
 const old={version:1,template:'soft',styles:freshStyles(),photo,logo:null};
 db.setItem(STORAGE_KEY,JSON.stringify(old));
 const store=createProjectStore(db);
 assert.equal(store.restore().photo,photo);
 assert.equal(store.save(old),'full');
 assert.equal(db.getItem(STORAGE_KEY+'.photo'),photo);
 assert.equal(JSON.parse(db.getItem(STORAGE_KEY)).photo,null);
});
test('bad image storage entries are rejected when restoring',()=>{
 const db=fakeStorage();db.setItem(STORAGE_KEY,JSON.stringify({version:1,template:'soft'}));
 db.setItem(STORAGE_KEY+'.photo','https://remote/unsafe.jpg');
 const store=createProjectStore(db);
 assert.equal(store.restore().photo,null);
});
test('cooperative RAW scanner matches synchronous scanner across yield boundaries',async()=>{
 const bytes=new Uint8Array(24000);bytes.set([255,216,255,224],800);bytes.set([255,217],7000);
 bytes.set([255,216,255,225],7900);bytes.set([255,217],22700);
 const expected=findEmbeddedJpeg(bytes);
 assert.deepEqual(await scanPreviewCooperatively(bytes,1024),expected);
});
test('ZIP fallback retains progress and produces an archive',async()=>{
 const progress=[];
 const blob=await createZipResponsive([{name:'one.txt',blob:new Blob(['abc'])},{name:'two.txt',blob:new Blob(['def'])}],{onProgress:(done,total)=>progress.push([done,total])});
 assert.equal(blob.type,'application/zip');
 assert.deepEqual(progress,[[1,2],[2,2]]);
 const bytes=new Uint8Array(await blob.arrayBuffer());
 assert.equal(new DataView(bytes.buffer).getUint32(0,true),0x04034b50);
});
