import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const server=spawn(process.execPath,['scripts/serve.mjs','--dist'],{stdio:'ignore'});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,isMobile:true,acceptDownloads:true});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));

const bodyHas=name=>page.locator('body').evaluate((el,cls)=>el.classList.contains(cls),name);
const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('framelabs.project.v1')||'{}'));
const activeZoom=()=>page.evaluate(()=>{
  const t=window.FrameLabsV3.template;
  return Number((JSON.parse(localStorage.getItem('framelabs.project.v1')||'{}').styles?.[t]?.cropZoom)||100);
});

try{
  await mkdir('artifacts',{recursive:true});
  let loaded=false;
  for(let i=0;i<50;i++){
    try{await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded',timeout:1200});loaded=true;break;}
    catch{await new Promise(r=>setTimeout(r,150));}
  }
  assert.ok(loaded,'Server not ready');
  await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');

  // Navigation is three destinations, and the app opens on Home.
  assert.equal(await page.locator('.studio-nav [data-action]').count(),3);
  assert.equal(await page.locator('[data-action="home"]').getAttribute('aria-current'),'page');
  assert.equal(await page.locator('.template').count(),3,'Redundant template removed');
  assert.equal(await page.locator('[data-template="rounded"]').count(),0);
  assert.equal(await bodyHas('gallery-open'),true);

  // Gallery keeps its own close control.
  await page.locator('#gallery-close').click();
  assert.equal(await bodyHas('gallery-open'),false);

  // Favorites persist and drive template selection.
  await page.locator('[data-action="favorites"]').click();
  assert.equal(await bodyHas('sheet-open'),true);
  assert.equal(await page.locator('#favorites').isVisible(),true);
  assert.equal(await page.locator('#favorites .fav-row').count(),3);
  await page.locator('#favorites .fav-star').first().click();
  assert.equal(await page.locator('#favorites .fav-star').first().getAttribute('aria-pressed'),'true');
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('framelabs.favorites.v1'))),['soft']);
  await page.locator('#favorites .fav-use').nth(1).click();
  assert.equal(await bodyHas('sheet-open'),false,'Choosing a favorite closes the sheet');
  assert.equal(await page.locator('#current-template').textContent(),'On Photo');

  // Settings sheet: every section, and no axis sliders left behind.
  await page.locator('[data-action="settings"]').click();
  assert.equal(await page.locator('#settings-sheet').getAttribute('data-sheet'),'settings');
  assert.equal(await page.locator('#settings').isVisible(),true);
  assert.equal(await page.locator('#cropX,#cropY,#cropZoom').count(),0,'Crop is gesture driven');
  assert.equal(await page.locator('.crop-hint p').count(),0,'No instruction paragraph left in the sheet');
  assert.equal(await page.locator('#reset-crop').isVisible(),true);
  assert.equal(await page.locator('.settings-section').count(),4);
  await page.keyboard.press('Escape');
  assert.equal(await bodyHas('sheet-open'),false);

  // Import seven photos, review them, then edit.
  const samples=await page.evaluate(()=>{
    const result=[];for(let i=0;i<7;i++){
      const c=document.createElement('canvas');c.width=i===0?1800:420;c.height=i===0?1200:280;
      const ctx=c.getContext('2d');
      const g=ctx.createLinearGradient(0,0,c.width,c.height);
      g.addColorStop(0,'hsl('+i*45+',70%,55%)');g.addColorStop(1,'#0a0a0a');
      ctx.fillStyle=g;ctx.fillRect(0,0,c.width,c.height);
      // Bands make any crop or zoom change visible to the pixel check below.
      ctx.fillStyle='rgba(255,255,255,.7)';
      for(let k=0;k<8;k++)ctx.fillRect(0,k*c.height/8,c.width,6);
      result.push(c.toDataURL('image/png').split(',')[1]);
    }
    return result;
  });
  const files=samples.map((base64,i)=>({name:'foodfest-'+(i+1)+'.png',mimeType:'image/png',buffer:Buffer.from(base64,'base64')}));
  await page.locator('#gallery-toggle').click();
  const chooserPromise=page.waitForEvent('filechooser');
  await page.locator('#upload-main').click();
  const chooser=await chooserPromise;
  assert.equal(chooser.isMultiple(),true,'Import stays multi-photo');
  await chooser.setFiles(files);
  await page.waitForFunction(()=>!document.querySelector('#v3-selection')?.hidden,undefined,{timeout:8000});
  assert.equal(await page.locator('.v3-selection-item').count(),7);
  assert.match(await page.locator('#v3-size').textContent(),/7\/30/);
  await page.waitForFunction(()=>window.FrameLabsV3.items.every(i=>Boolean(i.previewImage)||Boolean(i.previewError)),undefined,{timeout:15000});
  await page.screenshot({path:'artifacts/v3-selection.png'});
  await page.locator('#v3-finish').click();
  await page.waitForFunction(()=>document.querySelector('#v3-selection').hidden&&window.FrameLabsV3.activeIndex>=0,{timeout:30000});
  assert.equal(await page.locator('.v3-scope').evaluate(el=>el.hidden),false,'A real batch shows the edit scope');

  // The focused photo is copied to storage, and that copy carries a ten minute deadline.
  await page.waitForFunction(()=>/^\d+:\d{2}$/.test(document.querySelector('#save-state').textContent),undefined,{timeout:10000});
  const deadline=Number((await stored()).photoExpiresAt);
  const remaining=deadline-Date.now();
  assert.ok(remaining>9*60*1000&&remaining<=10*60*1000,`deadline should be about ten minutes, got ${remaining}`);
  await page.screenshot({path:'artifacts/v3-editor.png'});

  // A pinch on the canvas zooms the crop without any slider.
  const hash=()=>page.evaluate(()=>{
    const c=document.getElementById('preview'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    let h=0;for(let i=0;i<d.length;i+=4*997)h=(h*31+d[i]+d[i+1]*3+d[i+2]*7)>>>0;return h;
  });
  const before=await hash();
  await page.locator('#drop-zone').evaluate(el=>{
    const r=el.getBoundingClientRect(),cx=Math.round(r.x+r.width/2),cy=Math.round(r.y+r.height/2);
    const ev=(t,id,x,y)=>el.dispatchEvent(new PointerEvent(t,{pointerId:id,clientX:x,clientY:y,bubbles:true,pointerType:'touch'}));
    ev('pointerdown',1,cx-40,cy);ev('pointerdown',2,cx+40,cy);
    ev('pointermove',1,cx-90,cy);ev('pointermove',2,cx+90,cy);
    ev('pointerup',1,cx-90,cy);ev('pointerup',2,cx+90,cy);
  });
  await page.waitForFunction(()=>{
    const t=window.FrameLabsV3.template;
    return Number((JSON.parse(localStorage.getItem('framelabs.project.v1')||'{}').styles?.[t]?.cropZoom)||100)>150;
  },undefined,{timeout:8000});
  await page.waitForFunction(h=>{
    const c=document.getElementById('preview'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    let r=0;for(let i=0;i<d.length;i+=4*997)r=(r*31+d[i]+d[i+1]*3+d[i+2]*7)>>>0;return r!==h;
  },before,{timeout:6000});
  assert.ok(await activeZoom()>150);

  // Per-photo overrides stay isolated, and Cancel discards them.
  await page.locator('[data-action="settings"]').click();
  await page.locator('#v3-individual').click();
  await page.locator('#caption').fill('Special food shot');
  await page.waitForFunction(()=>window.FrameLabsV3.items[window.FrameLabsV3.activeIndex].overrides.caption==='Special food shot');
  assert.equal(await page.locator('#reset-crop').isVisible(),true);
  await page.locator('#reset-crop').click();
  await page.waitForFunction(()=>{
    const t=window.FrameLabsV3.template;
    return Number(JSON.parse(localStorage.getItem('framelabs.project.v1')||'{}').styles?.[t]?.cropZoom)===100;
  },undefined,{timeout:6000});
  assert.equal(await activeZoom(),100,'Reset crop restores the frame');
  await page.locator('#v3-global').click();
  await page.locator('#sheet-close').click();

  // Export one PNG, then the ZIP.
  await page.locator('[data-action="settings"]').click();
  await page.locator('#format').selectOption('png');
  const singleDownload=page.waitForEvent('download',{timeout:30000});
  await page.locator('#download').click();
  const single=await singleDownload;
  assert.ok(single.suggestedFilename().endsWith('.png'));
  await page.locator('#v3-export-all').waitFor({state:'visible'});
  const zipPromise=page.waitForEvent('download',{timeout:120000});
  await page.locator('#v3-export-all').click();
  const zip=await zipPromise;
  assert.ok(zip.suggestedFilename().endsWith('.zip'));
  await page.screenshot({path:'artifacts/v3-export.png'});
  await page.locator('#sheet-close').click();

  // RAW preview still comes from the embedded JPEG, on a worker.
  const rawWorker=await page.evaluate(async()=>{
    const c=document.createElement('canvas');c.width=512;c.height=512;
    const ctx=c.getContext('2d');
    for(let y=0;y<512;y++){ctx.fillStyle='hsl('+y+',70%,'+(30+y%45)+'%)';ctx.fillRect(0,y,512,1);}
    const data=c.toDataURL('image/jpeg',.97).split(',')[1];
    const binary=atob(data);const bytes=new Uint8Array(binary.length);
    for(let i=0;i<bytes.length;i++)bytes[i]=binary.charCodeAt(i);
    const file=new File([new Uint8Array(10),bytes,new Uint8Array(40)],'synthetic.ARW');
    const {scanEmbeddedJpeg,openPhoto}=await import('./image-io.js');
    const embedded=await scanEmbeddedJpeg(file),decoded=await openPhoto(file);
    const result={embedded,source:decoded.source,width:decoded.img.naturalWidth};
    URL.revokeObjectURL(decoded.url);decoded.img.removeAttribute('src');
    return result;
  });
  assert.ok(rawWorker.embedded?.length>4096);
  assert.equal(rawWorker.source,'RAW preview');
  assert.equal(rawWorker.width,512);

  // An expired photo copy is deleted on the next load, settings stay.
  await page.evaluate(()=>{
    const rec=JSON.parse(localStorage.getItem('framelabs.project.v1'));
    rec.photoExpiresAt=Date.now()-1000;
    localStorage.setItem('framelabs.project.v1',JSON.stringify(rec));
    localStorage.setItem('framelabs.project.v1.photo','data:image/jpeg;base64,AAAA');
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
  assert.equal(await page.evaluate(()=>localStorage.getItem('framelabs.project.v1.photo')),null,'Expired copy is purged');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('framelabs.project.v1')).photoExpiresAt),null);

  assert.deepEqual(errors,[]);
  console.log('PASS v3.5 three tabs, gesture crop, favorites and ten minute photo copies');
}finally{
  await page.close();await browser.close();server.kill('SIGTERM');
}
