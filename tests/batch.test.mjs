import test from 'node:test';
import assert from 'node:assert/strict';
import { batchSettings, outputName, validatePhotoFile, createZip, crc32 } from '../batch.js';
import { DEFAULTS, metadataSettings } from '../core.js';

test('auto metadata replaces stale camera values per file; editor mode is explicit',()=>{
  const base={...DEFAULTS,caption:'Keep my caption',iso:'999'};
  const first=batchSettings(base,metadataSettings({Make:'FUJIFILM',Model:'X-T5',ISO:400}),'auto');
  const second=batchSettings(base,metadataSettings({}),'auto');
  assert.equal(first.iso,'400');assert.equal(second.iso,'');assert.equal(second.camera,'');assert.equal(second.brand,'CUSTOM');
  assert.equal(second.caption,base.caption);assert.equal(base.iso,'999');
  assert.equal(batchSettings(base,metadataSettings({ISO:400}),'editor').iso,'999');
});
test('file validation rejects non-photos, empty and oversize files',()=>{
  assert.doesNotThrow(()=>validatePhotoFile({name:'photo.HEIC',size:1000}));
  for(const file of [{name:'script.svg',size:100},{name:'empty.png',size:0},{name:'huge.jpg',size:41*1024*1024}])assert.throws(()=>validatePhotoFile(file));
});
test('ZIP output names retain Unicode and cannot escape an archive directory',()=>{
  const name=outputName('../../senja 📷.jpg',0,'soft','png');
  assert.ok(!/[\\/]/.test(name));assert.ok(name.startsWith('001-'));assert.ok(name.endsWith('-soft.png'));assert.ok(name.includes('📷'));
  assert.notEqual(outputName('same.jpg',0,'soft','jpeg'),outputName('same.jpg',1,'soft','jpeg'));
});
test('CRC-32 matches standard check vector and empty file',()=>{
  assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926);
  assert.equal(crc32(new Uint8Array()),0);
});
test('ZIP STORE encodes valid directory, byte counts and UTF-8 names',async()=>{
  const blob=await createZip([{name:'senja 📷.txt',blob:new Blob(['123456789'])},{name:'empty.txt',blob:new Blob([])}]);
  const bytes=new Uint8Array(await blob.arrayBuffer()),v=new DataView(bytes.buffer);
  assert.equal(v.getUint32(0,true),0x04034b50);assert.equal(v.getUint16(6,true),0x0800);assert.equal(v.getUint16(8,true),0);
  assert.equal(v.getUint32(14,true),0xcbf43926);assert.equal(v.getUint32(18,true),9);
  const end=bytes.length-22;assert.equal(v.getUint32(end,true),0x06054b50);assert.equal(v.getUint16(end+10,true),2);
  const directory=v.getUint32(end+16,true);assert.equal(v.getUint32(directory,true),0x02014b50);
  assert.equal(directory+v.getUint32(end+12,true),end);
  const nameLength=v.getUint16(26,true);assert.equal(new TextDecoder().decode(bytes.slice(30,30+nameLength)),'senja 📷.txt');
});
test('ZIP rejects empty archives, unsafe names, duplicate names and oversized output',async()=>{
  await assert.rejects(createZip([]));
  await assert.rejects(createZip([{name:'../oops',blob:new Blob(['x'])}]));
  await assert.rejects(createZip([{name:'x',blob:new Blob(['x'])},{name:'x',blob:new Blob(['y'])}]));
  await assert.rejects(createZip([{name:'huge',blob:{size:152*1024*1024}}]));
});
