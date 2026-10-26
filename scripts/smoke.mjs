import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const server=spawn(process.execPath,['scripts/serve.mjs','--dist'],{stdio:'ignore'});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
  let loaded=false;
  for(let i=0;i<50;i++){
    try{await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded',timeout:1000});loaded=true;break;}
    catch{await new Promise(resolve=>setTimeout(resolve,150));}
  }
  assert.ok(loaded,'static server did not start');
  await page.waitForFunction(()=>document.documentElement.dataset.ready==='true',{timeout:20000});
  assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('gallery-open')),true,'gallery should open first');
  assert.equal(await page.locator('.template').count(),4);
  await page.screenshot({path:'artifacts/v2-gallery.png',fullPage:true});
  await page.locator('[data-template="soft"]').click();
  assert.equal(await page.locator('.studio-tool').count(),5,'one visible tool per task, without overlapping Height/Margin/Frame panels');
  await page.screenshot({path:'artifacts/v2-editor.png',fullPage:true});
  await page.locator('.studio-tool[data-tool="frame"]').click();
  await page.locator('.palette-choice.pastel').click();
  assert.equal(await page.locator('#frameVariant').inputValue(),'pastel');
  await page.screenshot({path:'artifacts/v2-frame-sheet.png',fullPage:true});
  await page.locator('.sheet-close').click();
  assert.ok(await page.locator('.studio-tool[data-tool="frame"]').evaluate(el=>el===document.activeElement),'closing panel restores tool focus');
  assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('gallery-open')),false);
  await page.locator('.studio-tool[data-tool="brand"]').click();
  assert.equal(await page.locator('.inspector').getAttribute('data-tool'),'brand');
  await page.getByRole('button',{name:'Pilih SONY'}).count().then(x=>assert.equal(x,0));
  await page.getByRole('button',{name:'Camera',exact:true}).click();
  await page.getByRole('button',{name:'Pilih SONY'}).click();
  assert.equal(await page.locator('#brand').inputValue(),'SONY');
  await page.locator('.sheet-close').click();
  await page.locator('.studio-tool[data-tool="crop"]').click();
  await page.locator('#ratio').selectOption('16:9');
  await page.locator('.sheet-close').click();
  await page.locator('#download-top').click();
  await page.locator('#format').selectOption('webp');
  await page.screenshot({path:'artifacts/v2-mobile.png',fullPage:true});
  const dl=page.waitForEvent('download',{timeout:20000});
  await page.locator('#download').click();
  const download=await dl;
  assert.ok(download.suggestedFilename().endsWith('.webp'));
  await page.locator('.sheet-close').click();
  await page.locator('.studio-tool[data-tool="batch"]').click();
  const sample=await page.evaluate(()=>{
    const c=document.createElement('canvas');c.width=1800;c.height=1200;
    c.getContext('2d').fillStyle='#bb3566';c.getContext('2d').fillRect(0,0,1800,1200);
    return c.toDataURL('image/png').split(',')[1];
  });
  const buffer=Buffer.from(sample,'base64');
  await page.locator('#batch-input').setInputFiles([
    {name:'shot-1.png',mimeType:'image/png',buffer},
    {name:'shot-2.png',mimeType:'image/png',buffer},
    {name:'shot-3.png',mimeType:'image/png',buffer}
  ]);
  assert.equal(await page.locator('#batch-preview-gallery .batch-preview-card').count(),3);
  await page.waitForFunction(()=>document.querySelectorAll('#batch-preview-gallery .batch-preview-card canvas:not([hidden])').length===3,undefined,{timeout:25000});
  await page.screenshot({path:'artifacts/v2-batch-gallery.png',fullPage:true});
  await page.locator('.batch-preview-card').nth(1).click();
  await page.waitForFunction(()=>!document.body.classList.contains('sheet-open')&&!document.querySelector('#batch-focus-bar').hidden);
  await page.waitForFunction(()=>document.querySelector('#photo-name').textContent.includes('shot-2.png'));
  assert.equal(await page.locator('#batch-focus-count').textContent(),'2 / 3');
  assert.match(await page.locator('#photo-name').textContent(),/shot-2.png/);
  await page.screenshot({path:'artifacts/v2-batch-focus.png',fullPage:true});
  await page.locator('.studio-tool[data-tool="params"]').click();
  assert.ok(await page.locator('#iso').evaluate(el=>el.readOnly),'auto EXIF is per focused photo, not editable stale editor metadata');
  await page.locator('#download-top').click();
  await page.locator('#format').selectOption('png');
  await page.locator('#resolution').selectOption('original');
  const focusedExport=page.waitForEvent('download');
  await page.locator('#download').click();
  const focusedDownload=await focusedExport;
  const original=await readFile(await focusedDownload.path());
  assert.ok(original.readUInt32BE(16)>1600,'focused export must reopen original, not export the 640px thumbnail');
  await page.locator('.sheet-close').click();
  await page.locator('#batch-next').click();
  await page.waitForFunction(()=>document.querySelector('#batch-focus-count').textContent==='3 / 3');
  await page.locator('#batch-prev').click();
  await page.waitForFunction(()=>document.querySelector('#batch-focus-count').textContent==='2 / 3');
  await page.locator('.studio-tool[data-tool="batch"]').click();
  assert.equal(await page.locator('#batch-preview-gallery .batch-preview-card.selected').count(),1);
  await page.locator('#batch-clear').click();
  assert.equal(await page.locator('#batch-preview-gallery .batch-preview-card').count(),0);
  assert.equal(await page.locator('#batch-focus-bar').isHidden(),true);
  assert.deepEqual(errors,[],'Unexpected browser JS exception(s)');
  console.log('PASS mobile gallery, brand, crop, WebP export and 3-photo batch preview flow');
}finally{
  await page.close();await browser.close();server.kill('SIGTERM');
}
