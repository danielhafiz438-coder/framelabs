import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, freshStyles, parseProject, saveProject, sanitizeSettings, cropRect, layoutFor, exportSize, metadataSettings } from '../core.js';

test('persisted input is bounded, typed, and rejects remote/vector image sources',()=>{
  assert.equal(parseProject('broken'),null);assert.equal(parseProject('{"version":9}'),null);
  const s=sanitizeSettings({padding:999,blur:-1,textColor:'url(evil)',camera:'x'.repeat(100),showBrand:'false',format:'svg'});
  assert.equal(s.padding,14);assert.equal(s.blur,0);assert.equal(s.camera.length,64);assert.equal(s.showBrand,true);assert.equal(s.format,'png');assert.equal(s.textColor,'#ffffff');
  const p=parseProject(JSON.stringify({version:1,template:'__proto__',photo:'https://other/image.jpg',logo:'data:image/svg+xml;base64,PHN2Zz4='}));
  assert.equal(p.template,'soft');assert.equal(p.photo,null);assert.equal(p.logo,null);
});
test('each style has independent state; only whitelist settings survive',()=>{
  const p=freshStyles();p.white.padding=10;assert.equal(p.soft.padding,6.5);
  assert.equal(sanitizeSettings({isAdmin:true}).isAdmin,undefined);
});
test('center cropping retains exactly the target ratio',()=>{
  for(const [iw,ih,ratio]of[[6000,4000,1],[3000,4000,1.5],[4000,3000,.5625]]){
    const c=cropRect(iw,ih,ratio);assert.ok(Math.abs(c.width/c.height-ratio)<.0001);assert.ok(c.x>=0&&c.y>=0&&c.width<=iw&&c.height<=ih);
  }
});
test('all templates export bounded, proportional dimensions for landscape and portrait',()=>{
  for(const [key,s]of Object.entries(freshStyles()))for(const [iw,ih]of[[6000,4000],[3000,4000],[800,800]])for(const ratio of ['original','9:16','1:1']){
    const l=layoutFor(iw,ih,{...s,ratio},key),out=exportSize(l,iw,ih,'original');
    assert.ok(Math.max(out.width,out.height)<=4096);assert.ok(Math.abs(out.width/out.height-l.width/l.height)<.005);
    if(key==='overlay')assert.equal(l.pad,0);
  }
});
test('EXIF import formats actual values without inventing absent camera data',()=>{
  const t=metadataSettings({Make:'Apple',Model:'iPhone 16 Pro',FocalLengthIn35mmFormat:24,FNumber:1.8,ExposureTime:1/250,ISO:80});
  assert.deepEqual(t,{brand:'IPHONE',camera:'iPhone 16 Pro',focal:'24mm',aperture:'f/1.8',shutter:'1/250s',iso:'80'});
  assert.equal(metadataSettings({Make:'FUJIFILM',ExposureTime:2}).shutter,'2s');
  const missing=metadataSettings();assert.equal(missing.camera,'');assert.equal(missing.focal,'');assert.equal(missing.iso,'');
});
test('hidden or empty rows do not reserve a metadata footer',()=>{
  const l=layoutFor(3000,2000,{...DEFAULTS,showExif:false,showBrand:false,caption:''},'white');assert.equal(l.footer,0);
});
test('storage quota fallback keeps current settings and never throws when denied',()=>{
  let written;const project={version:1,template:'white',photo:'photo',camera:'mine'};
  const quota={setItem(key,value){if(JSON.parse(value).photo)throw new Error('quota');written=JSON.parse(value);}};
  assert.equal(saveProject(quota,project),'settings');assert.equal(written.photo,null);assert.equal(written.template,'white');
  assert.equal(saveProject({setItem(){throw new Error('denied');}},project),'unavailable');
  assert.equal(saveProject({setItem(key,value){written=JSON.parse(value);}},project),'full');assert.equal(written.photo,'photo');
});
