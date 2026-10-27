import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const server=spawn(process.execPath,['scripts/serve.mjs','--dist'],{stdio:'ignore'});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,isMobile:true,acceptDownloads:true});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  await mkdir('artifacts',{recursive:true});
  let loaded=false;
  for(let i=0;i<50;i++){
    try{await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded',timeout:1200});loaded=true;break;}
    catch{await new Promise(r=>setTimeout(r,150));}
  }
  assert.ok(loaded,'Server not ready');
  await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
  assert.equal(await page.locator('.template').count(),4);
  assert.equal(await page.locator('.studio-tool').count(),7);
  assert.equal(await page.locator('[data-action="home"]').getAttribute('aria-current'),'page');
  assert.equal(await page.locator('.v3-scope').evaluate(el=>el.hidden),true,'demo must not offer irrelevant individual controls');
  await page.locator('[data-filter="classic"]').click();
  assert.equal(await page.locator('[data-template="soft"]').isVisible(),false);
  await page.locator('[data-action="home"]').click();
  assert.equal(await page.locator('[data-template="soft"]').isVisible(),true,'Gallery should reset template filters');
  assert.equal(await page.locator('[data-filter="all"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('.dock-feedback').isVisible(),true);
  const samples=await page.evaluate(()=>{
    const result=[];for(let i=0;i<7;i++){
      const c=document.createElement('canvas');c.width=i===0?1800:420;c.height=i===0?1200:280;
      const ctx=c.getContext('2d');ctx.fillStyle='hsl('+i*45+',70%,50%)';ctx.fillRect(0,0,c.width,c.height);
      result.push(c.toDataURL('image/png').split(',')[1]);
    }
    return result;
  });
  const files=samples.map((base64,i)=>({name:'foodfest-'+(i+1)+'.png',mimeType:'image/png',buffer:Buffer.from(base64,'base64')}));
  const fileChooserPromise=page.waitForEvent('filechooser');
  await page.locator('[data-action="editor"]').click();
  const fileChooser=await fileChooserPromise;
  assert.equal(fileChooser.isMultiple(),true,'Editor should open photo import before a photo exists');
  await fileChooser.setFiles(files);
  try {
    await page.waitForFunction(()=>!document.querySelector('#v3-selection')?.hidden,undefined,{timeout:4500});
  } catch(e) {
    console.error('SELECTION DEBUG',JSON.stringify(await page.evaluate(()=>({
      ready:document.documentElement.dataset.ready,
      hasV3:!!window.FrameLabsV3,
      items:window.FrameLabsV3?.items?.length,
      busy:window.FrameLabsV3?.busy,
      selectionExists:!!document.querySelector('#v3-selection'),
      selectionHidden:document.querySelector('#v3-selection')?.hidden,
      choosing:document.body.classList.contains('v3-picking'),
      status:document.querySelector('#batch-status')?.textContent,
      error:document.querySelector('#error')?.textContent
    }))));
    console.error('PAGE ERRORS',JSON.stringify(errors));
    throw e;
  }
  assert.equal(await page.locator('.v3-selection-item').count(),7);
  assert.match(await page.locator('#v3-size').textContent(),/7\/30/);
  try{
    await page.waitForFunction(()=>window.FrameLabsV3.items.every(i=>Boolean(i.previewImage)||Boolean(i.previewError)),undefined,{timeout:12000});
  }catch(e){
    console.error('THUMBNAIL DEBUG',JSON.stringify(await page.evaluate(()=>({
      busy:window.FrameLabsV3.busy,
      items:window.FrameLabsV3.items.map(i=>({id:i.id,loaded:!!i.previewImage,error:i.previewError,loading:i.previewLoading,task:!!i.previewTask,metadata:!!i.metadata})),
      status:document.querySelector('#batch-preview-status').textContent,
      pageErrors:document.querySelector('#error').textContent
    }))));
    throw e;
  }
  await page.screenshot({path:'artifacts/v3-selection.png'});
  await page.locator('.v3-selection-item').nth(6).locator('.v3-order-tools button').first().click();
  assert.deepEqual(await page.evaluate(()=>window.FrameLabsV3.items.map(i=>i.file.name).slice(-2)),['foodfest-7.png','foodfest-6.png']);
  await page.locator('#v3-finish').click();
  await page.waitForFunction(()=>document.querySelector('#v3-selection').hidden&&window.FrameLabsV3.activeIndex>=0,{timeout:30000});
  assert.equal(await page.locator('.studio-counter').textContent(),'1/7');
  assert.equal(await page.locator('.v3-scope').evaluate(el=>el.hidden),false,'real batch shows edit scope');
  await page.locator('.studio-back').click();
  assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('gallery-open')),true);
  await page.locator('[data-action="editor"]').click();
  assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('gallery-open')),false,'Editor restores existing selection');
  assert.equal(await page.locator('.studio-counter').textContent(),'1/7');
  await page.screenshot({path:'artifacts/v3-editor.png'});
  const wrap=page.locator('#drop-zone');
  await wrap.evaluate(el=>{
    const t=(x,y)=>new Touch({identifier:1,target:el,clientX:x,clientY:y});
    el.dispatchEvent(new TouchEvent('touchstart',{touches:[t(310,380)],changedTouches:[t(310,380)],bubbles:true}));
    el.dispatchEvent(new TouchEvent('touchend',{touches:[],changedTouches:[t(120,380)],bubbles:true}));
  });
  await page.waitForFunction(()=>window.FrameLabsV3.activeIndex===1,{timeout:10000});
  assert.equal(await page.locator('.studio-counter').textContent(),'2/7');
  await page.locator('.studio-tool[data-tool="text"]').click();
  await page.locator('#v3-individual').click();
  await page.locator('#caption').fill('Special food shot');
  await page.waitForFunction(()=>window.FrameLabsV3.items[1].overrides.caption==='Special food shot');
  assert.equal(await page.evaluate(()=>window.FrameLabsV3.items[0].overrides.caption),undefined);
  await page.locator('#v3-global').click();
  await page.locator('.sheet-close').click();
  const namesBefore=await page.evaluate(()=>window.FrameLabsV3.items.map(i=>i.file.name));
  await page.locator('#v3-manage').click();
  assert.equal(await page.locator('.v3-selection-item').count(),7);
  await page.screenshot({path:'artifacts/v3-selection-return.png'});
  // Removing and reordering in an unconfirmed review must be reversible.
  await page.locator('.v3-selection-item').nth(0).locator('.v3-order-tools button').last().click();
  await page.locator('.v3-selection-item').nth(1).locator('.v3-order-tools button').first().click();
  assert.equal(await page.locator('.v3-selection-item').count(),6);
  await page.locator('#v3-cancel').click();
  assert.deepEqual(await page.evaluate(()=>window.FrameLabsV3.items.map(i=>i.file.name)),namesBefore);
  // Adding a new image is also staged until Finish, and Cancel discards it.
  await page.locator('#v3-manage').click();
  assert.equal(await page.locator('#v3-add-photos').isVisible(),true);
  await page.locator('#photo-input').setInputFiles([{name:'new-photo.png',mimeType:'image/png',buffer:files[0].buffer}]);
  await page.waitForFunction(()=>window.FrameLabsV3.items.length===8);
  await page.locator('#v3-cancel').click();
  assert.deepEqual(await page.evaluate(()=>window.FrameLabsV3.items.map(i=>i.file.name)),namesBefore);
  await page.locator('#download-top').click();
  await page.locator('#format').selectOption('png');
  const dl=page.waitForEvent('download',{timeout:30000});
  await page.locator('#download').click();
  const single=await dl;
  assert.ok(single.suggestedFilename().endsWith('.png'));
  await page.locator('#v3-export-all').waitFor({state:'visible'});
  const zipPromise=page.waitForEvent('download',{timeout:120000});
  await page.locator('#v3-export-all').click();
  const zip=await zipPromise;
  assert.ok(zip.suggestedFilename().endsWith('.zip'));
  await page.screenshot({path:'artifacts/v3-export.png'});
  assert.deepEqual(errors,[]);
  console.log('PASS v3.1 gallery dock, Editor import, seven-photo selection, swipe, overrides and ZIP');
}finally{
  await page.close();await browser.close();server.kill('SIGTERM');
}
