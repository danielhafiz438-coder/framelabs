import test from 'node:test';
import assert from 'node:assert/strict';
import { previewSize, createIdlePainter } from '../preview.js';

test('preview caps resolution without upscaling or losing aspect ratio',()=>{
  for(const [w,h,max] of [[6000,4000,1600],[4000,6000,640],[200,100,640]]){
    const size=previewSize(w,h,max);
    assert.ok(size.width<=w&&size.height<=h);
    assert.ok(Math.max(size.width,size.height)<=max);
    assert.ok(Math.abs(size.width/size.height-w/h)<.005);
  }
});
test('thumbnail work yields after each image and superseded edits cannot repaint stale queues',()=>{
  const tasks=[],painted=[];
  const painter=createIdlePainter(item=>painted.push(item),task=>tasks.push(task));
  painter.enqueue(['old-1','old-2','old-3']);
  tasks.shift()();assert.deepEqual(painted,['old-1']);
  painter.enqueue(['new-1','new-2']);
  while(tasks.length)tasks.shift()();
  assert.deepEqual(painted,['old-1','new-1','new-2']);
});
test('cancelling a scheduled thumbnail pass prevents remaining renders',()=>{
  const tasks=[],painted=[];
  const painter=createIdlePainter(x=>painted.push(x),task=>tasks.push(task));
  painter.enqueue([1,2,3]);painter.cancel();
  while(tasks.length)tasks.shift()();
  assert.deepEqual(painted,[]);
});
