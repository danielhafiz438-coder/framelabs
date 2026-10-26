import test from 'node:test';
import assert from 'node:assert/strict';
import { RAW_EXTENSIONS, findEmbeddedJpeg } from '../image-io.js';

test('recognizes Sony, Canon, Nikon, Fujifilm and DNG RAW suffixes',()=>{
  for(const name of ['sample.ARW','x.CR3','x.NEF','photo.DNG','x.RAF','x.ORF'])assert.ok(RAW_EXTENSIONS.test(name));
  assert.ok(!RAW_EXTENSIONS.test('picture.jpg'));
});
test('finds largest JPEG preview and skips invalid or tiny segments',()=>{
  const bytes=new Uint8Array(18000);
  bytes.set([255,216,255,224],100);bytes.set([255,217],5100);
  bytes.set([255,216,255,225],5600);bytes.set([255,217],16400);
  const candidate=findEmbeddedJpeg(bytes);
  assert.deepEqual(candidate,{start:5600,end:16402,length:10802});
  assert.equal(findEmbeddedJpeg(new Uint8Array([255,216,255,224,0,255,217])),null);
});
