import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
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
  await page.locator('[data-template="soft"]').click();
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
  await page.locator('.studio-tool[data-tool="export"]').click();
  await page.locator('#format').selectOption('webp');
  await page.screenshot({path:'artifacts/v2-mobile.png',fullPage:true});
  const dl=page.waitForEvent('download',{timeout:20000});
  await page.locator('#download').click();
  const download=await dl;
  assert.ok(download.suggestedFilename().endsWith('.webp'));
  assert.deepEqual(errors,[],'Unexpected browser JS exception(s)');
  console.log('PASS mobile gallery, brand, crop, sheet and WebP export smoke');
}finally{
  await page.close();await browser.close();server.kill('SIGTERM');
}
