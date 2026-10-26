import test from 'node:test';
import assert from 'node:assert/strict';
import {selectionEntry,moveEntry,selectionBytes,settingsForPhoto,afterRemove} from '../selection.js';

test('stable IDs and reordering preserve original File references',()=>{
 const f1={name:'one.jpg',size:100},f2={name:'two.jpg',size:200},f3={name:'three.jpg',size:300};
 const items=[selectionEntry(f1,'a'),selectionEntry(f2,'b'),selectionEntry(f3,'c')];
 const reordered=moveEntry(items,2,0);
 assert.deepEqual(reordered.map(x=>x.id),['c','a','b']);
 assert.deepEqual(items.map(x=>x.id),['a','b','c']);
 assert.equal(selectionBytes(reordered),600);
 assert.equal(reordered[0].file,f3);
});
test('metadata and individual override composition keeps global edits',()=>{
 const global={padding:7,camera:'Camera',iso:'100',ratio:'original'};
 const meta={camera:'Sony ZV-E10',iso:'400'};
 const override={iso:'800',cropZoom:140};
 const a=settingsForPhoto(global,meta,'auto',override);
 const b=settingsForPhoto(global,meta,'auto',{});
 assert.deepEqual(a,{padding:7,camera:'Sony ZV-E10',iso:'800',ratio:'original',cropZoom:140});
 assert.equal(b.iso,'400');assert.equal(b.padding,7);
 assert.equal(settingsForPhoto(global,meta,'editor',{}).camera,'Camera');
 assert.equal(afterRemove([{id:'p1'}],'p2'),'p1');
});
