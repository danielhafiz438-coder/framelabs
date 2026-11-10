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
const sheetHeight=()=>page.evaluate(()=>document.querySelector('.inspector').scrollHeight);
const openAdvanced=()=>page.evaluate(()=>{const d=document.getElementById('advanced');if(!d.open)d.open=true;});

try{
  await mkdir('artifacts',{recursive:true});
  let loaded=false;
  for(let i=0;i<50;i++){
    try{await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded',timeout:1200});loaded=true;break;}
    catch{await new Promise(r=>setTimeout(r,150));}
  }
  assert.ok(loaded,'Server not ready');
  await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');

  // One frame switcher, one settings sheet, no bottom navigation.
  assert.equal(await page.locator('.studio-nav').count(),0,'No bottom navigation');
  assert.equal(await page.locator('#gallery-toggle').count(),0,'No frame gallery button');
  assert.equal(await page.locator('.template').count(),0,'No gallery thumbnails');
  assert.equal(await page.locator('[data-frame]').count(),3,'Three frame chips');
  assert.equal(await bodyHas('gallery-open'),false);
  assert.equal(await bodyHas('sheet-open'),false,'The app opens on the editor');
  assert.equal(await page.locator('#download').isVisible(),true,'The top bar holds the only export action');
  assert.equal(await page.locator('#settings').isHidden(),true);

  // Frames switch from the editor chips alone.
  await page.locator('[data-frame="white"]').click();
  assert.equal(await page.evaluate(()=>window.FrameLabsV3.template),'white');
  await page.locator('[data-frame="soft"]').click();
  assert.equal(await page.evaluate(()=>window.FrameLabsV3.template),'soft');

  // Settings opens from the top bar, shows the essentials, and keeps Lanjutan closed.
  await page.locator('#settings-toggle').click();
  assert.equal(await bodyHas('sheet-open'),true);
  assert.equal(await page.locator('#settings').isVisible(),true);
  assert.equal(await page.locator('.crop-hint p').count(),0,'No instruction paragraph left in the sheet');
  assert.equal(await page.locator('#reset-crop').isVisible(),true);
  assert.equal(await page.locator('#ratio').isVisible(),true,'Aspect ratio stays an essential');
  assert.equal(await page.locator('#padding').isVisible(),true,'Frame thickness stays an essential');
  assert.equal(await page.locator('#frame-palette').isVisible(),true,'Frame colour stays an essential');
  assert.equal(await page.locator('#blur').isVisible(),false,'Blur sits under Lanjutan');
  assert.equal(await page.locator('#advanced').evaluate(el=>el.open),false,'Lanjutan starts collapsed');
  const short=await sheetHeight();
  assert.ok(short<700,`Closed sheet stays short, got ${short}px`);
  await openAdvanced();
  assert.equal(await page.locator('#blur').isVisible(),true,'Lanjutan reveals the rest');
  assert.equal(await page.locator('.settings-section').count(),5);
  assert.ok(await sheetHeight()>short,'Expanded sheet is taller');
  await page.locator('#cropX,#cropY,#cropZoom').count().then(count=>assert.equal(count,0,'Crop is gesture driven'));
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
  const chooserPromise=page.waitForEvent('filechooser');
  await page.locator('#upload-top').click();
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
  assert.equal(await page.locator('#batch-focus-bar').isVisible(),true,'A real batch keeps the stepper bar');

  // The focused photo is copied to storage, and that copy carries a ten minute deadline.
  await page.waitForFunction(()=>/Salinan sementara · \d+:\d{2}$/.test(document.querySelector('#save-state').textContent),undefined,{timeout:10000});
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

  // A mouse zooms the same crop with the wheel, the badge reports it, and a double tap resets.
  assert.equal(await page.locator('#zoom-badge').isVisible(),true,'Zoom badge appears above 100 percent');
  const stage=await page.locator('#drop-zone').boundingBox();
  await page.mouse.move(stage.x+stage.width/2,stage.y+stage.height/2);
  await page.mouse.wheel(0,-260);
  await page.waitForFunction(()=>{
    const t=window.FrameLabsV3.template;
    return Number((JSON.parse(localStorage.getItem('framelabs.project.v1')||'{}').styles?.[t]?.cropZoom)||100)>225;
  },undefined,{timeout:6000});
  await page.locator('#drop-zone').dblclick();
  await page.waitForFunction(()=>{
    const t=window.FrameLabsV3.template;
    return Number(JSON.parse(localStorage.getItem('framelabs.project.v1')||'{}').styles?.[t]?.cropZoom)===100;
  },undefined,{timeout:6000});
  assert.equal(await page.locator('#zoom-badge').isVisible(),false,'Badge hides at 100 percent');

  // Per-photo overrides stay isolated, and Cancel discards them.
  await page.locator('#settings-toggle').click();
  await openAdvanced();
  await page.locator('#v3-individual').click();
  await page.locator('#caption').fill('Special food shot');
  await page.waitForFunction(()=>window.FrameLabsV3.items[window.FrameLabsV3.activeIndex].overrides.caption==='Special food shot');
  await page.locator('#reset-crop').click();
  await page.waitForFunction(()=>{
    const t=window.FrameLabsV3.template;
    return Number(JSON.parse(localStorage.getItem('framelabs.project.v1')||'{}').styles?.[t]?.cropZoom)===100;
  },undefined,{timeout:6000});
  assert.equal(await activeZoom(),100,'Reset crop restores the frame');
  await page.locator('#v3-global').click();

  // Export one PNG from the top bar, then the ZIP from the sheet.
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

  // One photo skips the review picker and lands straight in the editor.
  await page.evaluate(()=>window.FrameLabsV3.clear());
  await page.locator('#photo-input').setInputFiles([{name:'single.png',mimeType:'image/png',buffer:files[0].buffer}]);
  await page.waitForFunction(()=>window.FrameLabsV3.items.length===1&&Boolean(window.FrameLabsV3.activeId),undefined,{timeout:15000});
  assert.equal(await page.locator('#v3-selection').isVisible(),false,'A single photo opens straight in the editor');
  await page.waitForFunction(()=>!document.body.classList.contains('v3-picking'));
  assert.equal(await page.locator('#batch-focus-bar').isHidden(),true,'A single photo gets no 1/1 stepper bar');
  assert.equal(await page.evaluate(()=>document.querySelector('#photo-name').textContent.includes('/')),false,'No 1/1 prefix on the caption');

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


  // The same markup adapts: inspector docked on desktop, sheet on tablet and phone.
  const desktopPage=await browser.newPage({viewport:{width:1440,height:900}});
  desktopPage.on('pageerror',e=>errors.push('desktop: '+e.message));
  await desktopPage.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
  await desktopPage.waitForFunction(()=>document.documentElement.dataset.ready==='true');
  assert.equal(await desktopPage.locator('#settings').isVisible(),true,'Desktop docks the inspector without opening a sheet');
  assert.equal(await desktopPage.locator('#settings-toggle').isVisible(),false,'No sheet toggle when the panel is docked');
  assert.equal(await desktopPage.locator('#sheet-close').isVisible(),false,'No close control on a docked panel');
  assert.equal(await desktopPage.locator('.preview-panel').evaluate(el=>el.inert),false,'The photo stays live beside the panel');
  const desktopPreview=await desktopPage.evaluate(()=>document.querySelector('#preview').getBoundingClientRect().width);
  assert.ok(desktopPreview>500,`Preview keeps a usable width on desktop, got ${desktopPreview}`);
  assert.equal(await desktopPage.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0,'No horizontal overflow on desktop');
  await desktopPage.screenshot({path:'artifacts/v3-desktop.png'});

  const tabletPage=await browser.newPage({viewport:{width:820,height:1180},hasTouch:true,isMobile:true});
  tabletPage.on('pageerror',e=>errors.push('tablet: '+e.message));
  await tabletPage.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
  await tabletPage.waitForFunction(()=>document.documentElement.dataset.ready==='true');
  assert.equal(await tabletPage.locator('#settings').isVisible(),false,'Tablet keeps the sheet closed');
  await tabletPage.locator('#settings-toggle').click();
  await tabletPage.waitForFunction(()=>document.body.classList.contains('sheet-open'));
  assert.equal(await tabletPage.locator('#settings').isVisible(),true,'Tablet opens the sheet');
  assert.equal(await tabletPage.locator('.preview-panel').evaluate(el=>el.inert),true,'An open sheet takes the pointer');
  assert.equal(await tabletPage.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0,'No horizontal overflow on tablet');
  await tabletPage.screenshot({path:'artifacts/v3-tablet.png'});
  await desktopPage.close();await tabletPage.close();

  assert.deepEqual(errors,[]);
  console.log('PASS v3.7 one frame switcher, one export action, short settings sheet, docked desktop inspector and ten minute photo copies');
}finally{
  await page.close();await browser.close();server.kill('SIGTERM');
}
