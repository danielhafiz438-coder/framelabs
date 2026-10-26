import { STORAGE_KEY, TEMPLATE_NAMES, DEFAULTS, STYLE_DEFAULTS, freshStyles, sanitizeSettings, parseProject, saveProject, layoutFor, exportSize, metadataSettings } from './core.js';
import { render } from './renderer.js';
import { openPhoto } from './image-io.js';
import { selectionEntry, moveEntry, settingsForPhoto } from './selection.js';
import { previewSize, idleTurn, createIdlePainter } from './preview.js';
import { BATCH_LIMIT, BATCH_INPUT_LIMIT, BATCH_OUTPUT_LIMIT, validatePhotoFile, batchSettings, outputName, createZip } from './batch.js';

const $ = id => document.getElementById(id);
const form=$('settings'), preview=$('preview');
let saved=null;
try {saved=parseProject(localStorage.getItem(STORAGE_KEY));} catch { /* Private browsing can deny storage; the editor still works in memory. */ }
let template=saved?.template||'soft', styles=saved?.styles||freshStyles();
let photo=null, logo=null, photoData=saved?.photo||null, logoData=saved?.logo||null;
let photoName=saved?.photoName||'Foto contoh · Sebastien Gabriel', isDemo=!photoData, exifFound=saved?.exifFound||false;
let comparing=false, busy=false, importing=false, saveTimer, frame=0, exportURL=null, restored=Boolean(photoData);
let noticeTimer;
const brandLogos={};
let batchQueue=[], batchURL=null, batchCancelled=false, nextSelectionId=1, editScope='global', globalMetadataOverrides={};
let batchFocus=null, batchFocusRequest=0, thumbWorker=null, thumbPaintTimer=0;
const previewCache=new WeakMap();
let galleryDirty=true, galleryScheduled=false;
let previewDecode=Promise.resolve();
const batchPainter=createIdlePainter(item=>{if(!busy&&batchQueue.includes(item))paintBatchThumbnail(item);});
$('batch-metadata').value=saved?.batchMode||'auto';
const sharedKeys=new Set(['brand','camera','caption','focal','aperture','shutter','iso','showExif','showBrand']);
const style=()=>styles[template];
function message(text) {$('status').textContent=text;$('status').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{$('status').hidden=true;},8000);}
function error(text) {$('error').textContent=text;$('error').hidden=!text;}
function setBusy(value) {
  busy=value;
  if(value)batchFocusRequest++;
  for(const id of ['download','download-top','upload-top','upload-main','upload-logo','use-demo','clear-storage','reset','compare','remove-logo','batch-select','batch-open']) $(id).disabled=value;
  for(const fieldset of form.querySelectorAll('fieldset'))fieldset.disabled=value;
  for(const button of document.querySelectorAll('[data-template]'))button.disabled=value;
  $('batch-metadata').disabled=value;
  $('batch-clear').disabled=value||!batchQueue.length;
  $('batch-run').disabled=value||!batchQueue.length;
  for(const button of $('batch-list').querySelectorAll('button'))button.disabled=value;
  for(const button of $('batch-preview-gallery').querySelectorAll('button'))button.disabled=value;
  document.dispatchEvent(new CustomEvent('framelabs:busy',{detail:value}));
  for(const id of ['batch-prev','batch-next','batch-exit']) $(id).disabled=value;
  if(batchFocus)updateBatchFocusBar();
  $('preview').setAttribute('aria-busy',String(value));
  document.dispatchEvent(new CustomEvent('editor:busy',{detail:value}));
  if(!value)ensureBatchThumbnails();
}
function loadImage(src) {
  return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Foto tidak dapat dibuka. Untuk HEIC, cuba Safari terkini atau tukarkan kepada JPG dahulu.'));img.src=src;});
}
function rasterCopy(img,maxSide=2048,type='image/jpeg',quality=.85) {
  const c=document.createElement('canvas'),k=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));
  c.width=Math.max(1,Math.round(img.naturalWidth*k));c.height=Math.max(1,Math.round(img.naturalHeight*k));
  const ctx=c.getContext('2d');
  if(type==='image/jpeg'){ctx.fillStyle='#000';ctx.fillRect(0,0,c.width,c.height);}
  ctx.drawImage(img,0,0,c.width,c.height);
  return c.toDataURL(type,quality);
}
function compactPhoto(img) {
  for(const [side,quality] of [[2048,.85],[1800,.78],[1400,.72]]){
    const value=rasterCopy(img,side,'image/jpeg',quality);
    if(value.length<=2300000)return value;
  }
  throw new Error('Salinan foto terlalu besar untuk simpanan browser. Eksport masih boleh digunakan dalam sesi ini.');
}
function persist() {
  clearTimeout(saveTimer);saveTimer=null;
  const project={version:1,template,styles,photo:photoData,logo:logoData,photoName,exifFound,batchMode:$('batch-metadata').value};
  let state='unavailable';try{state=saveProject(localStorage,project);}catch{}
  if(state==='full')$('save-state').textContent=isDemo?'Tetapan disimpan pada peranti':photoData?'Tetapan & salinan foto disimpan':'Tetapan sahaja disimpan';
  else if(state==='settings'){$('save-state').textContent='Foto tidak disimpan: storan penuh';message('Tetapan disimpan, tetapi ruang browser tidak cukup untuk foto. Download hasil sebelum menutup halaman.');}
  else {$('save-state').textContent='Storan tidak tersedia · sesi sahaja';message('Browser tidak membenarkan simpanan. Editor dan download masih berfungsi dalam sesi ini.');}
}
function queueSave() {$('save-state').textContent='Menyimpan…';clearTimeout(saveTimer);saveTimer=setTimeout(persist,400);}
function syncForm() {
  const s=batchFocus?effectiveBatchSettings(batchFocus.item):style();
  const automatic=false; // v3 explicit edits override per-file EXIF without disabling controls.
  for(const key of Object.keys(DEFAULTS)) {
    const input=form.elements.namedItem(key);if(!input)continue;
    if(input.type==='checkbox')input.checked=s[key];else input.value=s[key];
    const out=$(`${key}-value`);if(out)out.value=key==='textSize'||key==='darkness'?`${s[key]}%`:key==='blur'?`${s[key]}`:`${s[key]}%`;
  }
  for(const key of ['camera','focal','aperture','shutter','iso'])$(key).readOnly=automatic;
  $('brand').disabled=automatic;
  const overlay=template==='overlay',white=template==='white';
  for(const el of document.querySelectorAll('[data-control]')) {
    const key=el.dataset.control;
    el.hidden=(key==='padding'&&overlay)||(key==='blur'&&(overlay||white))||(key==='darkness'&&white)||(key==='frameColor'&&!white);
  }
  $('remove-logo').hidden=!logo;
  $('upload-logo').textContent=logo?'Tukar logo sendiri':'Tambah logo sendiri';
  for(const button of document.querySelectorAll('[data-template]')) {
    const selected=button.dataset.template===template;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));
  }
  $('current-template').textContent=TEMPLATE_NAMES[template];
  $('exif-status').textContent=automatic?'EXIF foto batch semasa. Pilih “Guna maklumat editor untuk semua” dalam Batch untuk sunting secara manual.':isDemo?'Foto contoh menggunakan maklumat ilustrasi. Semua boleh diedit.':exifFound?'Maklumat EXIF dibaca daripada foto. Semak atau ubah sebelum eksport.':'EXIF tiada / tidak dapat dibaca. Isi maklumat sendiri atau sembunyikannya.';
  document.dispatchEvent(new Event('editor:settings'));
}
function effectiveBatchSettings(item) {
  return sanitizeSettings(settingsForPhoto({...style()},item.metadata?.metadata,$('batch-metadata').value,{...globalMetadataOverrides,...(item.overrides||{})}));
}
function dimensions(img=photo, settings=style()) {
  const l=layoutFor(img.naturalWidth||img.width,img.naturalHeight||img.height,{...settings,hasLogo:Boolean(logo)},template);
  return exportSize(l,img.naturalWidth||img.width,img.naturalHeight||img.height,settings.resolution);
}
function renderPreview() {
  const img=batchFocus?.img||photo;
  if(!img)return;
  const settings=batchFocus?effectiveBatchSettings(batchFocus.item):style();
  const w=img.naturalWidth||img.width,h=img.naturalHeight||img.height;
  if(comparing) {
    const k=Math.min(1,1400/Math.max(w,h));preview.width=Math.max(1,Math.round(w*k));preview.height=Math.max(1,Math.round(h*k));
    preview.getContext('2d').drawImage(img,0,0,preview.width,preview.height);
  } else {
    if(!(img instanceof HTMLCanvasElement)&&!previewCache.has(img))previewCache.set(img,smallCanvas(img,1600));
    render(preview,img instanceof HTMLCanvasElement?img:previewCache.get(img),settings,template,{logo,brandLogo:brandLogos[settings.brand]});
  }
  const label=batchFocus?`Pratonton batch ${batchFocus.index+1} daripada ${batchQueue.length}`:`Pratonton foto dengan bingkai ${TEMPLATE_NAMES[template]}`;
  preview.setAttribute('aria-label',comparing?'Foto asal tanpa bingkai':label);
  const source=batchFocus?{width:batchFocus.item.sourceWidth,height:batchFocus.item.sourceHeight}:img;
  const size=dimensions(source,settings);$('dimensions').textContent=`${size.width} × ${size.height} px`;
  $('photo-name').textContent=batchFocus?`Batch ${batchFocus.index+1}/${batchQueue.length} · ${batchFocus.item.file.name}`:restored?`${photoName} · salinan tersimpan`:photoName;
}
function renderThumbnails() {
  if(!photo||!document.body.classList.contains('gallery-open')){galleryDirty=true;return;}
  galleryDirty=false;
  if(!previewCache.has(photo))previewCache.set(photo,smallCanvas(photo,1600));
  for(const button of document.querySelectorAll('[data-template]')) {
    const target=button.querySelector('canvas'),tmp=document.createElement('canvas'),key=button.dataset.template;
    render(tmp,previewCache.get(photo),styles[key],key,{maxSide:420,logo,brandLogo:brandLogos[styles[key].brand]});
    target.width=280;target.height=170;const ctx=target.getContext('2d');ctx.fillStyle='#151614';ctx.fillRect(0,0,280,170);
    const scale=Math.min(256/tmp.width,146/tmp.height);ctx.drawImage(tmp,(280-tmp.width*scale)/2,(170-tmp.height*scale)/2,tmp.width*scale,tmp.height*scale);
  }
}
function update(thumbnails=false) {
  if(thumbnails)galleryDirty=true;
  cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{renderPreview();scheduleGalleryPaint();});
}
function scheduleGalleryPaint(){
  if(galleryScheduled||!galleryDirty||!document.body.classList.contains('gallery-open'))return;
  galleryScheduled=true;idleTurn(()=>{galleryScheduled=false;if(galleryDirty)renderThumbnails();});
}
document.addEventListener('studio:view',()=>{scheduleGalleryPaint();if(document.body.classList.contains('sheet-open')&&document.querySelector('.inspector').dataset.tool==='batch'){ensureBatchThumbnails();paintBatchThumbnails();}});
function discardExport() {if(exportURL)URL.revokeObjectURL(exportURL);exportURL=null;$('export-link').hidden=true;}
function selectTemplate(key) {
  if(!Object.hasOwn(TEMPLATE_NAMES,key))return;
  template=key;comparing=false;$('compare').setAttribute('aria-pressed','false');$('compare').textContent='Lihat asal';
  syncForm();update();queueSave();discardExport();scheduleBatchThumbPaint();
}
form.addEventListener('submit',e=>e.preventDefault());
form.addEventListener('input',e=>{
  const input=e.target,key=input.name;if(!Object.hasOwn(DEFAULTS,key))return;
  let value=input.type==='checkbox'?input.checked:input.type==='range'?Number(input.value):input.value;
  const individual=Boolean(batchFocus&&editScope==='individual');
  if(individual){
    const overrides=batchFocus.item.overrides||(batchFocus.item.overrides={});
    overrides[key]=value;
    if(key==='brand'){overrides.camera=value==='CUSTOM'?'':value;form.elements.camera.value=overrides.camera;}
    if(key==='frameVariant'){
      overrides.textColor=['white','pastel','vibrant'].includes(value)?'#202020':value==='black'?'#ffffff':STYLE_DEFAULTS[template].textColor;
      form.elements.textColor.value=overrides.textColor;
    }
  }else{
    if(key==='brand'){
      const camera=value==='CUSTOM'?'':value;
      for(const entry of Object.values(styles)){entry.brand=value;entry.camera=camera;}
      form.elements.camera.value=camera;
    }else if(sharedKeys.has(key))for(const entry of Object.values(styles))entry[key]=value;
    else styles[template][key]=value;
    if(key==='frameVariant'){
      styles[template].textColor=['white','pastel','vibrant'].includes(value)?'#202020':value==='black'?'#ffffff':STYLE_DEFAULTS[template].textColor;
      form.elements.textColor.value=styles[template].textColor;
    }
    styles[template]=sanitizeSettings(styles[template]);
    if(batchFocus){
      const fields=['brand','camera','focal','aperture','shutter','iso','showBrand','showExif'];
      if(fields.includes(key))globalMetadataOverrides[key]=value;
      if(key==='brand')globalMetadataOverrides.camera=value==='CUSTOM'?'':value;
    }
  }
  const out=$(`${key}-value`);if(out)out.value=key==='textSize'||key==='darkness'?`${value}%`:key==='blur'?String(value):`${value}%`;
  comparing=false;$('compare').setAttribute('aria-pressed','false');$('compare').textContent='Lihat asal';
  update(true);queueSave();discardExport();scheduleBatchThumbPaint();
  document.dispatchEvent(new Event('framelabs:edited'));
});
for(const button of document.querySelectorAll('[data-template]'))button.addEventListener('click',()=>selectTemplate(button.dataset.template));
for(const id of ['upload-top','upload-main'])$(id).addEventListener('click',()=>$('photo-input').click());
$('upload-logo').addEventListener('click',()=>$('logo-input').click());
async function importPhoto(file) {
  if(!file||importing||busy)return;
  importing=true;error('');setBusy(true);message('Membuka foto pada peranti…');
  let url;
  try {
    validatePhotoFile(file);
    closeBatchFocus();
    const loaded=await openPhoto(file);url=loaded.url;
    const next=loaded.img;
    if(next.naturalWidth*next.naturalHeight>96000000)throw new Error('Foto melebihi 96 megapiksel. Kecilkan foto dahulu.');
    const {metadata,found}=await readMetadata(file);
    let copy=null;try{copy=compactPhoto(next);}catch{message('Foto dibuka. Salinan tidak dapat disimpan; download sebelum menutup halaman.');}
    photo=next;photoData=copy;photoName=file.name;isDemo=false;restored=false;exifFound=found;
    for(const key of Object.keys(styles))styles[key]=sanitizeSettings({...styles[key],...metadata});
    comparing=false;$('compare').setAttribute('aria-pressed','false');$('compare').textContent='Lihat asal';discardExport();
    syncForm();renderPreview();renderThumbnails();persist();
    message(loaded.warning|| (copy?(found?'Foto sedia. Maklumat kamera dibaca secara automatik.':'Foto sedia. EXIF tiada; isi maklumat kamera sendiri jika perlu.'):'Foto sedia untuk eksport. Salinan foto tidak disimpan dalam browser.'));
  }catch(e){error(e.message||'Foto tidak dapat dibuka. Cuba fail lain.');message('Foto sebelumnya dikekalkan.');}
  finally{if(url)URL.revokeObjectURL(url);setBusy(false);importing=false;$('photo-input').value='';}
}
$('photo-input').addEventListener('change',e=>{if(e.target.files?.length)addBatchFiles(Array.from(e.target.files));e.target.value='';});
$('logo-input').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file||busy)return;
  let url;error('');setBusy(true);
  try {
    if(!/\.(png|jpe?g|webp)$/i.test(file.name)||file.size>8*1024*1024)throw new Error('Pilih logo PNG, JPG atau WebP, maksimum 8 MB.');
    url=URL.createObjectURL(file);const img=await loadImage(url);
    let data=rasterCopy(img,512,'image/png');if(data.length>650000)data=rasterCopy(img,320,'image/png');
    if(data.length>650000)throw new Error('Logo terlalu kompleks. Cuba logo yang lebih kecil.');
    const next=await loadImage(data);logo=next;logoData=data;syncForm();update(true);persist();discardExport();scheduleBatchThumbPaint();message('Logo sendiri ditambah.');
  }catch(e){error(e.message);}finally{if(url)URL.revokeObjectURL(url);e.target.value='';setBusy(false);}
});
$('remove-logo').addEventListener('click',()=>{logo=null;logoData=null;syncForm();update(true);persist();discardExport();scheduleBatchThumbPaint();message('Logo dibuang daripada projek.');});
$('compare').addEventListener('click',()=>{comparing=!comparing;$('compare').setAttribute('aria-pressed',String(comparing));$('compare').textContent=comparing?'Kembali ke bingkai':'Lihat asal';update();});
$('reset').addEventListener('click',()=>{styles[template]={...style(),...STYLE_DEFAULTS[template],textSize:100,ratio:'original'};syncForm();update(true);queueSave();discardExport();scheduleBatchThumbPaint();message('Tetapan bingkai direset. Foto dan tulisan dikekalkan.');});
async function useDemo(save=true,preserveMetadata=false) {
  if(batchFocus)closeBatchFocus();
  const next=await loadImage('./assets/demo-coast.jpg');photo=next;photoData=null;photoName='Foto contoh · Sebastien Gabriel';isDemo=true;restored=false;exifFound=false;
  if(!preserveMetadata)for(const key of Object.keys(styles))for(const field of ['brand','camera','focal','aperture','shutter','iso'])styles[key][field]=DEFAULTS[field];
  comparing=false;$('compare').setAttribute('aria-pressed','false');$('compare').textContent='Lihat asal';
  syncForm();renderPreview();renderThumbnails();discardExport();if(save)persist();
}
$('use-demo').addEventListener('click',async()=>{if(busy)return;setBusy(true);error('');try{await useDemo();message('Foto contoh digunakan. Pilih foto sendiri pada bila-bila masa.');}catch{error('Foto contoh gagal dimuatkan. Pilih foto sendiri untuk teruskan.');}finally{setBusy(false);}});
async function download() {
  if(!photo||busy)return;
  error('');setBusy(true);message('Menyediakan gambar…');
  try {
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const s=batchFocus?effectiveBatchSettings(batchFocus.item):{...style()}, chosen=template;
    let loaded,result;
    try{
      if(batchFocus)loaded=await openPhoto(batchFocus.item.file);
      result=await encodePhoto(loaded?.img||photo,s,chosen,logo);
    }finally{if(loaded){URL.revokeObjectURL(loaded.url);loaded.img.removeAttribute('src');}}
    const {blob,size}=result;
    discardExport();exportURL=URL.createObjectURL(blob);
    const a=$('export-link');a.href=exportURL;a.download=`framelabs-${chosen}-${batchFocus?'batch-'+(batchFocus.index+1)+'-':''}${Date.now()}.${s.format==='jpeg'?'jpg':s.format==='webp'?'webp':'png'}`;a.hidden=false;a.click();
    message(`Gambar ${s.format.toUpperCase()} sedia (${size.width} × ${size.height} px). Jika download tidak bermula, tekan pautan di bawah butang Download.`);
  }catch(e){error(e.message||'Eksport gagal. Cuba saiz 2048 px.');message('Eksport belum berjaya.');}finally{setBusy(false);}
}
for(const id of ['download','download-top'])$(id).addEventListener('click',download);
async function readMetadata(file) {
  let tags={};
  try{tags=await globalThis.exifr.parse(file,['Make','Model','FocalLength','FocalLengthIn35mmFormat','FNumber','ExposureTime','ISO'])||{};}catch{}
  return {metadata:metadataSettings(tags),found:Object.values(tags).some(v=>v!=null)};
}
async function encodePhoto(img,s,key,mark) {
  const layout=layoutFor(img.naturalWidth,img.naturalHeight,{...s,hasLogo:Boolean(mark)},key);
  const size=exportSize(layout,img.naturalWidth,img.naturalHeight,s.resolution),canvas=document.createElement('canvas');
  try{
    render(canvas,img,s,key,{...size,logo:mark,brandLogo:brandLogos[s.brand],jpeg:s.format==='jpeg'});
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Eksport gagal. Cuba saiz 2048 px.')),`image/${s.format}`,Math.max(.5,Math.min(1,(s.quality||95)/100))));
    if(!blob.size)throw new Error('Hasil kosong. Cuba saiz 2048 px.');
    if(s.format==='webp'&&blob.type!=='image/webp')throw new Error('Browser ini tidak menyokong eksport WebP. Pilih PNG atau JPEG.');
    return {blob,size};
  }finally{canvas.width=1;canvas.height=1;}
}
function discardBatchResult() {
  if(batchURL)URL.revokeObjectURL(batchURL);batchURL=null;$('batch-result').hidden=true;
}

function updateBatchFocusBar(){
  const bar=$('batch-focus-bar');
  const index=batchFocus?batchQueue.indexOf(batchFocus.item):-1;
  if(index<0){bar.hidden=true;return;}
  batchFocus.index=index;bar.hidden=false;
  const topCount=document.querySelector('.studio-counter');if(topCount)topCount.textContent=`${index+1}/${batchQueue.length}`;
  $('batch-focus-count').textContent=`${index+1} / ${batchQueue.length}`;
  $('batch-focus-name').textContent=batchFocus.item.file.name;
  $('batch-prev').disabled=busy||index===0;
  $('batch-next').disabled=busy||index===batchQueue.length-1;
  $('batch-exit').disabled=busy;
}
function closeBatchFocus(){
  batchFocusRequest++;
  batchFocus=null;
  document.dispatchEvent(new Event('framelabs:focus'));
  syncForm();
  const topCount=document.querySelector('.studio-counter');if(topCount)topCount.textContent='1/1';
  $('batch-focus-bar').hidden=true;
  update();discardExport();
  for(const item of batchQueue)item.card?.classList.remove('selected');
}
async function getBatchMetadata(item){
  if(!item.metadataTask)item.metadataTask=readMetadata(item.file).then(data=>{item.metadata=data;return data;});
  return item.metadataTask;
}
function smallCanvas(img,maxSide=560){
  const w=img.naturalWidth||img.width,h=img.naturalHeight||img.height;
  if(w*h>96000000)throw new Error('Foto melebihi 96 megapiksel.');
  const canvas=document.createElement('canvas');
  const size=previewSize(w,h,maxSide);canvas.width=size.width;canvas.height=size.height;
  canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  return canvas;
}
function updateBatchThumbStatus(){
  const done=batchQueue.filter(x=>x.previewImage).length;
  const failed=batchQueue.filter(x=>x.previewError).length;
  $('batch-preview-status').textContent=batchQueue.length
    ?`${done} / ${batchQueue.length} preview tersedia${failed?' · '+failed+' tidak dapat dibuka':''}. Tekan gambar untuk lihat besar.`
    :'Pilih banyak foto untuk preview semua dalam galeri.';
}
function paintBatchThumbnail(item){
  if(!item.card)return;
  const image=item.card.querySelector('canvas'),placeholder=item.card.querySelector('.batch-thumb-placeholder');
  item.card.classList.toggle('selected',batchFocus?.item===item);
  if(item.previewError){
    image.hidden=true;placeholder.hidden=false;
    placeholder.textContent='Preview gagal · '+item.previewError;
    return;
  }
  if(!item.previewImage){
    image.hidden=true;placeholder.hidden=false;placeholder.textContent='Memuat preview…';
    return;
  }
  try{
    const settings=effectiveBatchSettings(item);
    render(image,item.previewImage,settings,template,{maxSide:360,logo,brandLogo:brandLogos[settings.brand]});
    image.hidden=false;placeholder.hidden=true;
  }catch{
    image.hidden=true;placeholder.hidden=false;placeholder.textContent='Tidak dapat render preview';
  }
}
function paintBatchThumbnails(){
  batchPainter.enqueue(batchQueue);
  updateBatchThumbStatus();
}
function scheduleBatchThumbPaint(){
  clearTimeout(thumbPaintTimer);
  thumbPaintTimer=setTimeout(()=>{
    paintBatchThumbnails();
  },180);
}
function drawBatchGallery(){
  const gallery=$('batch-preview-gallery');
  gallery.replaceChildren();
  batchQueue.forEach((item,index)=>{
    const card=document.createElement('button');card.type='button';card.className='batch-preview-card';
    card.disabled=busy;
    card.setAttribute('aria-label',`Preview ${index+1} daripada ${batchQueue.length}: ${item.file.name}`);
    const media=document.createElement('span');media.className='batch-preview-media';
    const canvas=document.createElement('canvas');canvas.hidden=true;canvas.setAttribute('aria-hidden','true');
    const placeholder=document.createElement('span');placeholder.className='batch-thumb-placeholder';
    media.append(canvas,placeholder);
    const caption=document.createElement('span');caption.className='batch-preview-name';caption.textContent=item.file.name;
    const no=document.createElement('span');no.className='batch-preview-index';no.textContent=`Gambar ${index+1}`;
    card.append(media,caption,no);item.card=card;
    card.addEventListener('click',()=>focusBatchPhoto(item));
    gallery.append(card);paintBatchThumbnail(item);
  });
  updateBatchThumbStatus();
}
function ensureBatchThumbnails(){
  if(thumbWorker||busy)return;
  thumbWorker=(async()=>{
    while(true){
      if(busy)break;
      const item=batchQueue.find(i=>!i.previewImage&&!i.previewError&&!i.previewLoading);
      if(!item)break;
      item.previewLoading=true;
      try{
        await getBatchPreview(item);
        if(batchQueue.includes(item)){
          paintBatchThumbnail(item);updateBatchThumbStatus();
        }
      }catch(err){
        if(batchQueue.includes(item)){
          item.previewError=String(err.message||'Format tidak disokong');
          paintBatchThumbnail(item);updateBatchThumbStatus();
        }
      }finally{
        item.previewLoading=false;
      }
      await new Promise(resolve=>idleTurn(resolve));
    }
  })().finally(()=>{
    thumbWorker=null;
    if(!busy&&batchQueue.some(i=>!i.previewImage&&!i.previewError&&!i.previewLoading))ensureBatchThumbnails();
  });
}
async function getBatchPreview(item){
  if(!item.previewTask){item.previewTask=previewDecode.then(async()=>{
    if(!batchQueue.includes(item))throw new Error('Foto telah dikeluarkan daripada batch.');
    const loaded=await openPhoto(item.file);
    try{
      const small=smallCanvas(loaded.img,640);
      await getBatchMetadata(item);
      item.sourceWidth=loaded.img.naturalWidth;item.sourceHeight=loaded.img.naturalHeight;
      item.previewImage=small;
      document.dispatchEvent(new CustomEvent('framelabs:preview-ready',{detail:{id:item.id}}));
      return small;
    }finally{URL.revokeObjectURL(loaded.url);loaded.img.removeAttribute('src');}
  });previewDecode=item.previewTask.catch(()=>{});}
  return item.previewTask;
}
async function focusBatchPhoto(item){
  if(busy||!batchQueue.includes(item))return;
  const request=++batchFocusRequest;
  $('batch-preview-status').textContent='Membuka preview besar…';
  try{
    const img=await getBatchPreview(item);
    if(request!==batchFocusRequest||!batchQueue.includes(item))return;
    batchFocus={item,img,index:batchQueue.indexOf(item)};
    document.dispatchEvent(new CustomEvent('framelabs:focus',{detail:{id:item.id,index:batchFocus.index}}));
    syncForm();
    comparing=false;$('compare').setAttribute('aria-pressed','false');$('compare').textContent='Lihat asal';
    updateBatchFocusBar();update();discardExport();paintBatchThumbnails();
    if(document.body.classList.contains('sheet-open'))document.querySelector('.sheet-close')?.click();
    message('Preview batch: tetapan editor terpakai pada semua foto apabila dieksport.');
  }catch(e){
    $('batch-preview-status').textContent='Preview besar gagal: '+String(e.message||'Fail tidak disokong');
  }finally{
    updateBatchThumbStatus();
  }
}
$('batch-prev').addEventListener('click',()=>{if(batchFocus&&batchFocus.index>0)focusBatchPhoto(batchQueue[batchFocus.index-1]);});
$('batch-next').addEventListener('click',()=>{if(batchFocus&&batchFocus.index<batchQueue.length-1)focusBatchPhoto(batchQueue[batchFocus.index+1]);});
$('batch-exit').addEventListener('click',closeBatchFocus);

function drawBatchQueue() {
  $('batch-list').replaceChildren();
  batchQueue.forEach((item,index)=>{
    const row=document.createElement('li'),info=document.createElement('div'),name=document.createElement('span'),state=document.createElement('span'),remove=document.createElement('button');
    name.className='batch-filename';name.textContent=`${index+1}. ${item.file.name}`;
    state.className='batch-file-state';state.textContent=item.status||'Menunggu';item.state=state;
    remove.type='button';remove.className='batch-remove';remove.textContent='×';remove.setAttribute('aria-label',`Buang ${item.file.name} daripada batch`);remove.disabled=busy;
    remove.addEventListener('click',()=>{if(busy)return;if(batchFocus?.item===item)closeBatchFocus();batchQueue.splice(index,1);discardBatchResult();drawBatchQueue();updateBatchFocusBar();update();});
    info.append(name,state);row.append(info,remove);$('batch-list').append(row);
  });
  const mb=batchQueue.reduce((sum,item)=>sum+item.file.size,0)/1024/1024;
  $('batch-count').textContent=batchQueue.length?`${batchQueue.length} / ${BATCH_LIMIT} foto · ${mb.toFixed(1)} MB`:'Belum ada foto dipilih.';
  $('batch-clear').disabled=busy||!batchQueue.length;$('batch-run').disabled=busy||!batchQueue.length;
  drawBatchGallery();ensureBatchThumbnails();
}
function addBatchFiles(files) {
  if(busy)return;
  const rejected=[];let total=batchQueue.reduce((sum,item)=>sum+item.file.size,0);
  for(const file of files){
    try{
      validatePhotoFile(file);
      if(batchQueue.some(item=>item.file.name===file.name&&item.file.size===file.size&&item.file.lastModified===file.lastModified))continue;
      if(batchQueue.length>=BATCH_LIMIT||total+file.size>BATCH_INPUT_LIMIT)throw new Error('Had 30 foto / 300 MB dicapai.');
      batchQueue.push(selectionEntry(file,'photo-'+(nextSelectionId++)));total+=file.size;
    }catch(e){rejected.push(`${file.name}: ${e.message}`);}
  }
  discardBatchResult();drawBatchQueue();$('batch-progress').hidden=true;
  document.dispatchEvent(new CustomEvent('framelabs:selection',{detail:{rejected}}));
  $('batch-status').textContent=rejected.length?`${rejected.length} fail tidak ditambah. ${rejected.slice(0,2).join(' ')}`:'Foto dipilih. Laras gaya di editor, kemudian tekan Proses & download ZIP.';
}
function openBatch() {
  if(busy)return;
  $('batch-input').click();
}
for(const id of ['batch-open','batch-select'])$(id).addEventListener('click',openBatch);
$('batch-input').addEventListener('change',e=>{addBatchFiles(Array.from(e.target.files));e.target.value='';});
$('batch-clear').addEventListener('click',()=>{if(busy)return;closeBatchFocus();batchQueue=[];discardBatchResult();drawBatchQueue();$('batch-progress').hidden=true;$('batch-status').textContent='Senarai dikosongkan. Fail asal tidak terjejas.';});
function syncBatchHelp(){ $('batch-mode-help').textContent=$('batch-metadata').value==='auto'?'Jika EXIF tiada, maklumat kamera dibiarkan kosong. Kapsyen dan logo sendiri ikut editor.':'Jenama, nama kamera dan tetapan kamera dalam editor digunakan untuk semua foto.'; }
syncBatchHelp();
$('batch-metadata').addEventListener('change',()=>{syncBatchHelp();queueSave();scheduleBatchThumbPaint();if(batchFocus){syncForm();update();}});
$('batch-cancel').addEventListener('click',()=>{batchCancelled=true;$('batch-cancel').disabled=true;$('batch-status').textContent='Menghentikan selepas fail semasa…';});
$('batch-run').addEventListener('click',async()=>{
  if(busy||!batchQueue.length)return;
  const settings={...style()},chosen=template,mark=logo,mode=$('batch-metadata').value,entries=[];
  let completed=0,failed=0,bytes=0,limited=false;
  batchCancelled=false;setBusy(true);discardBatchResult();error('');
  const progress=$('batch-progress');progress.hidden=false;progress.max=batchQueue.length;progress.value=0;
  $('batch-cancel').hidden=false;$('batch-cancel').disabled=false;
  for(const item of batchQueue){item.status='Menunggu';item.state.textContent=item.status;item.state.classList.remove('failed');}
  try{
    if(thumbWorker)await thumbWorker;
    await previewDecode;
    for(let index=0;index<batchQueue.length;index++){
      if(batchCancelled)break;
      const item=batchQueue[index];let url,img,decoded;
      item.state.textContent='Memproses…';$('batch-status').textContent=`${index+1} / ${batchQueue.length}: ${item.file.name}`;
      await new Promise(resolve=>setTimeout(resolve,0));
      try{
        decoded=await openPhoto(item.file);url=decoded.url;img=decoded.img;
        if(img.naturalWidth*img.naturalHeight>96000000)throw new Error('Foto melebihi 96 megapiksel.');
        if(batchCancelled){item.status='Belum diproses';break;}
        const data=mode==='auto'?await getBatchMetadata(item):null;
        const s=sanitizeSettings(settingsForPhoto(settings,data?.metadata,mode,{...globalMetadataOverrides,...(item.overrides||{})}));
        const {blob,size}=await encodePhoto(img,s,chosen,mark);
        if(bytes+blob.size>BATCH_OUTPUT_LIMIT){limited=true;throw new Error('Had hasil 150 MB dicapai. Kurangkan batch atau resolusi.');}
        entries.push({name:outputName(item.file.name,index,chosen,s.format),blob});bytes+=blob.size;completed++;
        item.status=`Siap · ${size.width} × ${size.height}${decoded.source==='RAW preview'?' · RAW preview':''}${mode==='auto'&&!data.found?' · tiada EXIF':''}`;
      }catch(e){failed++;item.status=`Gagal: ${e.message}`;item.state.classList.add('failed');}
      finally{if(url)URL.revokeObjectURL(url);if(img)img.removeAttribute('src');item.state.textContent=item.status;progress.value=index+1;}
      if(limited)break;
    }
    $('batch-cancel').hidden=true;
    const pending=batchQueue.length-completed-failed;
    const summary=`${completed} siap, ${failed} gagal, ${pending} belum diproses.`;
    if(!entries.length){$('batch-status').textContent=`${batchCancelled?'Batch dihentikan. ':''}${summary} Tiada ZIP dihasilkan.`;return;}
    $('batch-status').textContent=`${summary} Menyediakan ZIP…`;
    const report=[`FRAMELABS · ${TEMPLATE_NAMES[chosen]}`,`Metadata: ${mode}`,summary,...batchQueue.map(item=>`${item.file.name.replace(/[\r\n]/g,' ')}: ${item.status}`)].join('\n');
    entries.push({name:'batch-report.txt',blob:new Blob([report],{type:'text/plain;charset=utf-8'})});
    const archive=await createZip(entries);batchURL=URL.createObjectURL(archive);
    const link=$('batch-result');link.href=batchURL;link.download=`framelabs-${chosen}-batch-${Date.now()}.zip`;link.textContent=`Download ZIP · ${completed} foto (${(archive.size/1024/1024).toFixed(1)} MB)`;link.hidden=false;
    $('batch-status').textContent=`${batchCancelled?'Batch dihentikan. ':''}${summary} ZIP mengandungi hasil yang berjaya dan laporan. Jika download tidak bermula, tekan pautan di bawah.`;
    if(!batchCancelled)link.click();
  }catch(e){$('batch-status').textContent=`ZIP tidak dapat disediakan: ${e.message} Cuba resolusi 2048 px atau batch lebih kecil.`;}
  finally{setBusy(false);$('batch-cancel').hidden=true;}
});
let dragDepth=0;
document.addEventListener('dragenter',e=>{if(!e.dataTransfer?.types.includes('Files'))return;e.preventDefault();dragDepth++;$('drop-zone').classList.add('dragging');});
document.addEventListener('dragover',e=>{if(e.dataTransfer?.types.includes('Files'))e.preventDefault();});
document.addEventListener('dragleave',()=>{if(--dragDepth<=0){dragDepth=0;$('drop-zone').classList.remove('dragging');}});
document.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;$('drop-zone').classList.remove('dragging');const files=Array.from(e.dataTransfer?.files||[]);if(files.length)addBatchFiles(files);});
$('clear-storage').addEventListener('click',()=>$('clear-dialog').showModal());
$('cancel-clear').addEventListener('click',()=>$('clear-dialog').close());
$('confirm-clear').addEventListener('click',async()=>{
  clearTimeout(saveTimer);saveTimer=null;error('');
  try{localStorage.removeItem(STORAGE_KEY);}catch{error('Browser tidak membenarkan simpanan dipadam.');return;}
  $('clear-dialog').close();setBusy(true);styles=freshStyles();template='soft';logo=null;logoData=null;
  try{await useDemo(false);$('save-state').textContent='Simpanan peranti dipadam';message('Simpanan FRAMELABS dipadam. Fail asal dalam peranti tidak terjejas.');}catch{error('Foto contoh tidak dapat dimuatkan. Muat semula halaman.');}finally{setBusy(false);}
});
window.addEventListener('pagehide',()=>{if(saveTimer)persist();});
async function init() {
  setBusy(true);syncForm();
  try {
    await Promise.all(Object.entries({IPHONE:'apple',DJI:'dji',FUJIFILM:'fujifilm'}).map(async([key,file])=>{try{brandLogos[key]=await loadImage(`./assets/brands/${file}.svg`);}catch{ /* The camera name remains usable if a bundled logo cannot load. */ }}));
    if(logoData)try{logo=await loadImage(logoData);}catch{logoData=null;}
    if(photoData) {
      try{photo=await loadImage(photoData);message('Projek dibuka semula daripada peranti. Eksport menggunakan salinan foto tersimpan.');}
      catch{photoData=null;restored=false;await useDemo(false);message('Salinan tersimpan tidak dapat dibuka. Pilih foto asal semula.');}
    }else await useDemo(false,Boolean(saved));
    syncForm();renderPreview();renderThumbnails();
  }catch{error('Foto contoh gagal dimuatkan. Tekan Pilih foto untuk mula.');}
  finally{setBusy(false);document.documentElement.dataset.ready='true';}
}
globalThis.FrameLabsV3={
  get items(){return [...batchQueue];},
  get activeId(){return batchFocus?.item?.id||null;},
  get activeIndex(){return batchFocus?.index??-1;},
  get busy(){return busy;},
  get scope(){return editScope;},
  get template(){return template;},
  setScope(value){editScope=value==='individual'?'individual':'global';syncForm();update();document.dispatchEvent(new Event('framelabs:scope'));},
  async focus(id){const item=batchQueue.find(entry=>entry.id===id);if(item)await focusBatchPhoto(item);},
  async step(dir){const next=(batchFocus?.index??0)+dir;if(next>=0&&next<batchQueue.length)await focusBatchPhoto(batchQueue[next]);},
  reorder(id,dir){
    const from=batchQueue.findIndex(x=>x.id===id),to=from+dir;
    if(from<0||to<0||to>=batchQueue.length||busy)return;
    batchQueue=moveEntry(batchQueue,from,to);
    drawBatchQueue();updateBatchFocusBar();document.dispatchEvent(new Event('framelabs:selection'));
  },
  remove(id){
    if(busy)return;const index=batchQueue.findIndex(x=>x.id===id);if(index<0)return;
    if(batchFocus?.item.id===id)closeBatchFocus();
    batchQueue.splice(index,1);discardBatchResult();drawBatchQueue();updateBatchFocusBar();
    document.dispatchEvent(new Event('framelabs:selection'));
  },
  clear(){if(busy)return;closeBatchFocus();batchQueue=[];discardBatchResult();drawBatchQueue();document.dispatchEvent(new Event('framelabs:selection'));},
  restore(items){
    if(busy)return;
    if(batchFocus&&!items.some(item=>item.id===batchFocus.item.id))closeBatchFocus();
    batchQueue=[...items];discardBatchResult();drawBatchQueue();updateBatchFocusBar();
    document.dispatchEvent(new Event('framelabs:selection'));
  },
  add(files){addBatchFiles(files);},
  async ensure(id){const item=batchQueue.find(x=>x.id===id);if(item)await getBatchPreview(item);},
  exportAll(){if(batchQueue.length&&!busy)$('batch-run').click();},
  cancelExport(){if(busy)$('batch-cancel').click();},
  resetCurrent(){if(!batchFocus||busy)return;batchFocus.item.overrides={};syncForm();update();scheduleBatchThumbPaint();document.dispatchEvent(new Event('framelabs:edited'));},
  refresh(){syncForm();update();scheduleBatchThumbPaint();}
};

init();
