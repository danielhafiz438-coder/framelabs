/* FrameLabs v2 interface controller. Keeps app.js form controls and rendering engine intact. */
const $ = (id) => document.getElementById(id);
const body=document.body, inspector=document.querySelector('.inspector');
const form=$('settings'), sections=[...form.querySelectorAll('.settings-section')];
const catalog=document.querySelector('.template-panel');
body.classList.add('framelabs-v2','gallery-open');

const icons={
back:'<path d="m15 18-6-6 6-6"/>',
upload:'<rect x="4" y="4" width="15" height="15" rx="2"/><path d="M9 9h11v11H9"/>',
brand:'<circle cx="12" cy="12" r="9"/><path d="M9 16V8h4a2 2 0 0 1 0 4H9m4 0 3 4"/>',
params:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="#161617"/><circle cx="15" cy="17" r="3" fill="#161617"/>',
frame:'<rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="7" width="10" height="10" rx="1"/>',
crop:'<path d="M5 3v14a2 2 0 0 0 2 2h14M3 5h14a2 2 0 0 1 2 2v14"/>',
theme:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 15 15 3M5 21 21 5"/>',
text:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M12 8v9"/>',
margin:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h8v8H8z"/>',
batch:'<rect x="3" y="3" width="11" height="11" rx="1"/><rect x="10" y="10" width="11" height="11" rx="1"/>'
};
const svg=(name)=>'<svg aria-hidden="true" viewBox="0 0 24 24">'+icons[name]+'</svg>';
const back=document.createElement('button');back.className='studio-round studio-back';back.type='button';
back.innerHTML=svg('back');back.setAttribute('aria-label','Kembali ke galeri template');
document.querySelector('.topbar').prepend(back);
const count=document.createElement('span');count.className='studio-counter';count.textContent='1/1';
document.querySelector('.topbar').append(count);
back.addEventListener('click',()=>openGallery());

const toolbar=document.createElement('nav');toolbar.className='studio-toolbar';
toolbar.setAttribute('aria-label','Alat suntingan');
const toolLabels=[
['brand','Brand'],['theme','Theme'],['text','Text'],['params','Params'],['margin','Margin'],['frame','Frame'],['crop','Crop']
];
for(const [key,label] of toolLabels){
 const b=document.createElement('button');b.type='button';b.className='studio-tool';b.dataset.tool=key;
 b.innerHTML=svg(key)+'<span>'+label+'</span>';b.setAttribute('aria-label','Buka tetapan '+label);
 b.setAttribute('aria-expanded','false');b.addEventListener('click',()=>openTool(key));
 toolbar.append(b);
}
document.body.append(toolbar);
const shade=document.createElement('div');shade.className='sheet-backdrop';
shade.addEventListener('click',closeSheet);document.body.append(shade);
const sheetTitle=inspector.querySelector('.inspector-title h2');
const close=document.createElement('button');close.type='button';close.className='sheet-close';
close.textContent='×';close.setAttribute('aria-label','Tutup tetapan');
inspector.querySelector('.inspector-title').append(close);close.addEventListener('click',closeSheet);

const fieldSets={
frame:['padding','radius','innerRadius','blur','darkness','frameColor','textColor'],
crop:['ratio']
};
const sheetNames={brand:'Jenama & Logo',theme:'Theme',text:'Text & Caption',params:'Maklumat Kamera',margin:'Margin',frame:'Bingkai',crop:'Crop & Nisbah',export:'Eksport Foto',batch:'Batch Processing'};
let returnFocus=null;
inspector.id='settings-sheet';inspector.setAttribute('role','region');inspector.setAttribute('aria-labelledby','sheet-title');
sheetTitle.id='sheet-title';
for(const button of toolbar.querySelectorAll('button'))button.setAttribute('aria-controls',inspector.id);
function syncSurfaces(){
 const galleryOpen=body.classList.contains('gallery-open'),sheetOpen=body.classList.contains('sheet-open');
 catalog.inert=!galleryOpen;inspector.inert=!sheetOpen;
 document.querySelector('.preview-panel').inert=galleryOpen;
 document.querySelector('.topbar').inert=galleryOpen;
 toolbar.inert=galleryOpen;
 document.dispatchEvent(new Event('studio:view'));
}
function includesControl(node,id){
 return node.id===id || node.htmlFor===id || Boolean(node.querySelector?.('#'+id));
}
function setFields(tool){
 const sectionIndex=tool==='brand'?1:tool==='params'||tool==='text'?2:tool==='export'?3:tool==='batch'?-1:0;
 sections.forEach((field,i)=>{
  field.hidden=i!==sectionIndex;
  if(i===0){
   const ids=fieldSets[tool]||[];
   for(const child of field.children){
    if(child.tagName==='LEGEND')continue;
    // CSS hides unrelated tools; preserve the original renderer's template-specific hidden state.
    child.dataset.studioHidden=String(!(tool==='frame'&&child.id==='frame-palette') && !(tool==='crop'&&child.id==='v3-crop-controls')&&!ids.some(id=>includesControl(child,id)));
   }
  }
 });
 inspector.dataset.tool=tool;
 body.dataset.tool=tool;
 sheetTitle.textContent=sheetNames[tool]||'Sesuaikan';
 inspector.querySelector('#reset').hidden=['batch','brand','params','text','export'].includes(tool);
}
function openTool(tool){
 if(body.classList.contains('gallery-open'))body.classList.remove('gallery-open');
 if(body.classList.contains('sheet-open')&&inspector.dataset.tool===tool){closeSheet();return;}
 returnFocus=document.activeElement;
 setFields(tool);body.classList.add('sheet-open');
 toolbar.querySelectorAll('.studio-tool').forEach(b=>{
  const active=b.dataset.tool===tool;b.classList.toggle('active',active);b.setAttribute('aria-expanded',String(active));
 });
 inspector.scrollTop=0;
 syncSurfaces();close.focus();refreshPalette();
}
function closeSheet(){
 body.classList.remove('sheet-open');
 toolbar.querySelectorAll('.studio-tool').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-expanded','false');});
 syncSurfaces();
 if(returnFocus?.isConnected&&!returnFocus.disabled)returnFocus.focus();
}
function openGallery(){closeSheet();body.classList.add('gallery-open');catalog.scrollTop=0;syncSurfaces();catalog.querySelector('.template.selected')?.focus();}
function closeGallery(){body.classList.remove('gallery-open');syncSurfaces();back.focus();}
new ResizeObserver(()=>{document.documentElement.style.setProperty('--sheet-height',`${inspector.offsetHeight}px`);}).observe(inspector);
$('download-top').setAttribute('aria-label','Pilihan eksport');$('download-top').title='Eksport';
$('download-top').querySelector('span').textContent='Eksport';
$('download-top').addEventListener('click',event=>{event.stopImmediatePropagation();openTool('export');},{capture:true});
document.addEventListener('keydown',e=>{
 if(e.key==='Tab'){
  const surface=body.classList.contains('gallery-open')?catalog:null;
  if(surface){
   const nodes=[...surface.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled):not([type=hidden]),select:not(:disabled),summary')].filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
   const first=nodes[0],last=nodes.at(-1);
   if(first&&((e.shiftKey&&document.activeElement===first)||(!e.shiftKey&&document.activeElement===last)||!surface.contains(document.activeElement))){e.preventDefault();(e.shiftKey?last:first).focus();}
  }
 }
 if(e.key!=='Escape')return;
 if(body.classList.contains('sheet-open'))closeSheet();
 else if(body.classList.contains('gallery-open'))closeGallery();
});
$('photo-input').addEventListener('change',e=>{if(e.target.files?.length)closeGallery();});
catalog.querySelectorAll('[data-template]').forEach(button=>button.addEventListener('click',()=>{if(globalThis.FrameLabsV3?.items.length)closeGallery();}));

const gallery=document.createElement('div');gallery.className='gallery-heading';
gallery.innerHTML='<div class="gallery-top"><div class="wordmark">FRAME<span class="wordmark-light">LABS</span></div></div><p class="gallery-kicker">Pilih bingkai untuk foto kau.</p><div class="gallery-filters" aria-label="Kategori template"><button type="button" class="gallery-filter active" data-filter="all" aria-pressed="true">Semua</button><button type="button" class="gallery-filter" data-filter="classic" aria-pressed="false">Classic</button><button type="button" class="gallery-filter" data-filter="blur" aria-pressed="false">Blur</button><button type="button" class="gallery-filter" data-filter="minimal" aria-pressed="false">Minimal</button></div>';
catalog.prepend(gallery);
const categories={soft:['blur'],rounded:['blur'],overlay:['minimal'],white:['classic','minimal']};
catalog.querySelectorAll('[data-template]').forEach(b=>{b.dataset.categories=(categories[b.dataset.template]||[]).join(' ');});
gallery.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{
 const selected=b.dataset.filter;
 gallery.querySelectorAll('[data-filter]').forEach(btn=>{btn.classList.toggle('active',btn===b);btn.setAttribute('aria-pressed',String(btn===b));});
 catalog.querySelectorAll('[data-template]').forEach(item=>item.hidden=selected!=='all'&&!item.dataset.categories.split(' ').includes(selected));
}));
const galleryNote=document.createElement('p');galleryNote.className='gallery-note';
galleryNote.textContent='Foto diproses pada peranti. JPG, PNG, WebP, AVIF, HEIC/HEIF dan preview RAW kamera (jika tersedia). Tiada akaun atau upload foto.';
catalog.append(galleryNote);
const dock=document.createElement('div');dock.className='gallery-dock';
dock.innerHTML='<button type="button" data-action="home" aria-label="Galeri template">'+svg('frame')+'<span>Galeri</span></button><button type="button" class="dock-primary" data-action="camera">'+svg('upload')+'<span>Pilih foto</span></button><button type="button" data-action="editor">'+svg('params')+'<span>Editor</span></button>';
catalog.append(dock);
dock.querySelector('[data-action="home"]').addEventListener('click',()=>catalog.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));
dock.querySelector('[data-action="camera"]').addEventListener('click',()=>$('photo-input').click());
dock.querySelector('[data-action="editor"]').addEventListener('click',closeGallery);

const cropSection=sections[0], ratioControl=$('ratio');
const cropPanel=document.createElement('div');cropPanel.id='v3-crop-controls';
cropPanel.className='v3-crop-controls';
for(const [key,label,min,max,val] of [
 ['cropZoom','Zoom',100,300,100],['cropX','Horizontal',0,100,50],['cropY','Vertical',0,100,50]
]){
 const field=document.createElement('div');field.className='range-field';
 const caption=document.createElement('label');caption.htmlFor=key;caption.textContent=label+' ';
 const out=document.createElement('output');out.id=key+'-value';out.value=String(val)+'%';caption.append(out);
 const input=document.createElement('input');input.id=key;input.name=key;input.type='range';
 input.min=String(min);input.max=String(max);input.step='1';input.value=String(val);
 field.append(caption,input);cropPanel.append(field);
}
cropSection.append(cropPanel);

const frameSection=sections[0];
const framePalette=document.createElement('div');framePalette.id='frame-palette';framePalette.className='frame-palette';
framePalette.innerHTML='<p class="palette-label">Select Frame</p><div class="palette-list" role="group" aria-label="Gaya warna bingkai"></div>';
frameSection.insertBefore(framePalette,frameSection.children[1]);
const frameVariant=document.createElement('select');frameVariant.id='frameVariant';frameVariant.name='frameVariant';
frameVariant.hidden=true;frameVariant.setAttribute('aria-label','Frame variation');
for(const [value,label] of [['original','Original'],['white','White'],['black','Black'],['pastel','Pastel'],['vibrant','Vibrant']]){
 const opt=document.createElement('option');opt.value=value;opt.textContent=label;frameVariant.append(opt);
}
frameSection.append(frameVariant);
const paletteList=framePalette.querySelector('.palette-list');
for(const [value,label] of [['original','Auto'],['white','White'],['black','Black'],['pastel','Pastel'],['vibrant','Vibrant']]){
 const item=document.createElement('button');item.type='button';item.className='palette-choice '+value;
 item.dataset.palette=value;item.setAttribute('aria-label',label+' frame');item.title=label;
 item.addEventListener('click',()=>{
  if(document.querySelector('.template.selected')?.dataset.template==='overlay'){
    $('status').textContent='On Photo tidak mempunyai bingkai luar. Pilih Soft Frame atau Gallery White dahulu.';
    return;
  }
  frameVariant.value=value;
  frameVariant.dispatchEvent(new Event('input',{bubbles:true}));
  refreshPalette();
 });
 paletteList.append(item);
}
function refreshPalette(){
 const savedValue=form.elements.frameVariant.value||'original';
 framePalette.hidden=document.querySelector('.template.selected')?.dataset.template==='overlay';
 paletteList.querySelectorAll('.palette-choice').forEach(btn=>{btn.classList.toggle('selected',btn.dataset.palette===savedValue);btn.setAttribute('aria-pressed',String(btn.dataset.palette===savedValue));});
}
document.querySelectorAll('[data-template]').forEach(b=>b.addEventListener('click',refreshPalette));
refreshPalette();

const brandField=sections[1],brandSelect=$('brand');
const brandTabs=document.createElement('div');brandTabs.className='brand-tabs';
const brandGrid=document.createElement('div');brandGrid.className='brand-grid';
brandField.insertBefore(brandGrid,brandField.children[1]);
brandField.insertBefore(brandTabs,brandGrid);
const brandGroups=[
 ['Phone',['IPHONE','XIAOMI']],['Camera',['SONY','CANON','NIKON','FUJIFILM','LUMIX','LEICA','HASSELBLAD']],
 ['Action Camera',['DJI','GOPRO','INSTA360']],['Film',['FUJIFILM','LEICA']]
];
function renderBrandGroup(group){
 brandTabs.querySelectorAll('.brand-tab').forEach(tab=>tab.classList.toggle('active',tab.dataset.group===group));
 brandGrid.replaceChildren();
 const items=brandGroups.find(([name])=>name===group)?.[1]||[];
 const buttons=['HIDE',...items].filter(v=>v==='HIDE'||[...brandSelect.options].some(opt=>opt.value===v));
 for(const code of buttons){
  const b=document.createElement('button');b.type='button';b.className='brand-choice';
  if(code==='HIDE'){b.classList.add('hide-logo');b.textContent='◉';b.setAttribute('aria-label','Sembunyikan logo');}
  else {b.textContent=code==='IPHONE'?'Apple':code==='FUJIFILM'?'FUJIFILM':code;b.setAttribute('aria-label','Pilih '+code);}
  const chosen=code==='HIDE'?!$('showBrand').checked:brandSelect.value===code&&$('showBrand').checked;
  b.classList.toggle('selected',chosen);
  b.setAttribute('aria-pressed',String(chosen));b.disabled=brandField.disabled||(code!=='HIDE'&&brandSelect.disabled);
  b.addEventListener('click',()=>{
   if(code!=='HIDE'){brandSelect.value=code;brandSelect.dispatchEvent(new Event('input',{bubbles:true}));}
   $('showBrand').checked=code!=='HIDE';
   $('showBrand').dispatchEvent(new Event('input',{bubbles:true}));
  });
  brandGrid.append(b);
 }
}
for(const [group] of brandGroups){
 const b=document.createElement('button');b.type='button';b.className='brand-tab';b.dataset.group=group;b.textContent=group;
 b.addEventListener('click',()=>renderBrandGroup(group));brandTabs.append(b);
}
renderBrandGroup('Phone');
const brandAdvanced=document.createElement('details');brandAdvanced.className='brand-advanced';
const brandSummary=document.createElement('summary');brandSummary.textContent='Custom brand & logo';brandAdvanced.append(brandSummary);
[...brandField.children].filter(child=>!['LEGEND'].includes(child.tagName)&&child!==brandTabs&&child!==brandGrid).forEach(child=>brandAdvanced.append(child));
brandField.append(brandAdvanced);
function refreshBrand(){
 let active=brandTabs.querySelector('.brand-tab.active')?.dataset.group||'Phone';
 if(!brandGroups.find(([group])=>group===active)?.[1].includes(brandSelect.value))active=brandGroups.find(([,brands])=>brands.includes(brandSelect.value))?.[0]||active;
 renderBrandGroup(active);
}
let brandRefreshPending=false;
form.addEventListener('input',event=>{if(['brand','showBrand'].includes(event.target.id)&&!brandRefreshPending){brandRefreshPending=true;queueMicrotask(()=>{brandRefreshPending=false;refreshBrand();});}});
document.addEventListener('editor:settings',()=>{refreshPalette();refreshBrand();});
document.addEventListener('editor:busy',event=>{for(const button of inspector.querySelectorAll('.brand-choice,.brand-tab,.palette-choice'))button.disabled=event.detail||(button.classList.contains('brand-choice')&&!button.classList.contains('hide-logo')&&brandSelect.disabled);});
for(const node of [$('textSize').closest('.range-field'),document.querySelector('label[for=caption]'),$('caption')])sections[2].append(node);
const demo=$('use-demo');document.querySelector('.storage-details').append(demo);
document.body.append($('status'),$('error'));
const exportHelper=document.createElement('p');exportHelper.className='helper';
exportHelper.textContent='Input RAW menggunakan preview JPEG yang tertanam (bukan sensor RAW penuh). HEIC/HEIF ditukar secara lokal apabila browser tidak dapat buka terus. Fail asal tidak diubah.';
sections[3].append(exportHelper);
setFields('brand');
syncSurfaces();
