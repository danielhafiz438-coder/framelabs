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
theme:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 15 15 3M5 21 21 5"/>',
params:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="#161617"/><circle cx="15" cy="17" r="3" fill="#161617"/>',
height:'<path d="M8 3v18M16 3v18m-11-4 7 4 7-4M5 7l7-4 7 4"/>',
margin:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h6v6H9z"/>',
frame:'<rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="7" width="10" height="10" rx="1"/>',
crop:'<path d="M5 3v14a2 2 0 0 0 2 2h14M3 5h14a2 2 0 0 1 2 2v14"/>',
export:'<path d="M12 3v14m-5-5 5 5 5-5M4 17v4h16v-4"/>',
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
['brand','Brand'],['theme','Theme'],['params','Params'],['height','Height'],
['margin','Margin'],['frame','Frame'],['crop','Crop'],['export','Export'],['batch','Batch']
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
theme:['blur','darkness','frameColor','textColor'],
height:['padding','radius'],
margin:['padding','radius','innerRadius'],
frame:['radius','innerRadius','blur','darkness','frameColor','textColor'],
crop:['ratio']
};
const sheetNames={brand:'Pilih Brand',theme:'Tema & Warna',params:'Maklumat Kamera',height:'Ketinggian',margin:'Margin & Bucu',frame:'Bingkai',crop:'Crop & Nisbah',export:'Eksport Foto',batch:'Batch Processing'};
function includesControl(node,id){
 return node.id===id || node.htmlFor===id || Boolean(node.querySelector?.('#'+id));
}
function setFields(tool){
 const sectionIndex=tool==='brand'?1:tool==='params'?2:tool==='export'?3:tool==='batch'?-1:0;
 sections.forEach((field,i)=>{
  field.hidden=i!==sectionIndex;
  if(i===0){
   const ids=fieldSets[tool]||[];
   for(const child of field.children){
    if(child.tagName==='LEGEND')continue;
    child.hidden=!ids.some(id=>includesControl(child,id));
   }
  }
 });
 inspector.dataset.tool=tool;
 sheetTitle.textContent=sheetNames[tool]||'Sesuaikan';
 inspector.querySelector('#reset').hidden=tool==='batch'||tool==='brand'||tool==='params'||tool==='export';
}
function openTool(tool){
 if(body.classList.contains('gallery-open'))body.classList.remove('gallery-open');
 if(body.classList.contains('sheet-open')&&inspector.dataset.tool===tool){closeSheet();return;}
 setFields(tool);body.classList.add('sheet-open');
 toolbar.querySelectorAll('.studio-tool').forEach(b=>{
  const active=b.dataset.tool===tool;b.classList.toggle('active',active);b.setAttribute('aria-expanded',String(active));
 });
 inspector.scrollTop=0;
}
function closeSheet(){
 body.classList.remove('sheet-open');
 toolbar.querySelectorAll('.studio-tool').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-expanded','false');});
}
function openGallery(){closeSheet();body.classList.add('gallery-open');catalog.scrollTop=0;}
function closeGallery(){body.classList.remove('gallery-open');}
document.addEventListener('keydown',e=>{
 if(e.key!=='Escape')return;
 if(body.classList.contains('sheet-open'))closeSheet();
 else if(body.classList.contains('gallery-open'))closeGallery();
});
$('photo-input').addEventListener('change',e=>{if(e.target.files?.length)closeGallery();});
catalog.querySelectorAll('[data-template]').forEach(button=>button.addEventListener('click',closeGallery));

const gallery=document.createElement('div');gallery.className='gallery-heading';
gallery.innerHTML='<div class="gallery-top"><div class="wordmark">FRAME<span class="wordmark-light">LABS</span></div><button type="button" class="gallery-start" id="gallery-open-photo">+ Pilih foto</button></div><p class="gallery-kicker">YOUR PHOTO. YOUR FRAME.</p><h2 class="gallery-title">Explore frames.</h2><p class="gallery-sub">Pilih gaya, laras setiap detail, dan simpan terus ke peranti.</p><div class="gallery-filters" aria-label="Kategori template"><button type="button" class="gallery-filter active" data-filter="all">Semua</button><button type="button" class="gallery-filter" data-filter="classic">Classic</button><button type="button" class="gallery-filter" data-filter="blur">Blur</button><button type="button" class="gallery-filter" data-filter="minimal">Minimal</button></div>';
catalog.prepend(gallery);
$('gallery-open-photo').addEventListener('click',()=>$('photo-input').click());
const categories={soft:['blur'],rounded:['blur'],overlay:['minimal'],white:['classic','minimal']};
catalog.querySelectorAll('[data-template]').forEach(b=>{b.dataset.categories=(categories[b.dataset.template]||[]).join(' ');});
gallery.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{
 const selected=b.dataset.filter;
 gallery.querySelectorAll('[data-filter]').forEach(btn=>btn.classList.toggle('active',btn===b));
 catalog.querySelectorAll('[data-template]').forEach(item=>item.hidden=selected!=='all'&&!item.dataset.categories.split(' ').includes(selected));
}));
const galleryNote=document.createElement('p');galleryNote.className='gallery-note';
galleryNote.textContent='Foto diproses pada peranti. JPG, PNG, WebP, AVIF, HEIC/HEIF dan preview RAW kamera (jika tersedia). Tiada akaun atau upload foto.';
catalog.append(galleryNote);
const dock=document.createElement('div');dock.className='gallery-dock';
dock.innerHTML='<button type="button" data-action="home">⌂ <span>Home</span></button><button type="button" class="dock-primary" data-action="camera">▣ <span>Foto</span></button><button type="button" data-action="editor">▢ <span>Editor</span></button>';
catalog.append(dock);
dock.querySelector('[data-action="home"]').addEventListener('click',()=>catalog.scrollTo({top:0,behavior:'smooth'}));
dock.querySelector('[data-action="camera"]').addEventListener('click',()=>$('photo-input').click());
dock.querySelector('[data-action="editor"]').addEventListener('click',closeGallery);

// Brand picker: text treatments deliberately avoid copying proprietary app logos.
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
  b.addEventListener('click',()=>{
   if(code!=='HIDE'){brandSelect.value=code;brandSelect.dispatchEvent(new Event('input',{bubbles:true}));}
   $('showBrand').checked=code!=='HIDE';
   $('showBrand').dispatchEvent(new Event('input',{bubbles:true}));
   renderBrandGroup(group);
  });
  brandGrid.append(b);
 }
}
for(const [group] of brandGroups){
 const b=document.createElement('button');b.type='button';b.className='brand-tab';b.dataset.group=group;b.textContent=group;
 b.addEventListener('click',()=>renderBrandGroup(group));brandTabs.append(b);
}
renderBrandGroup('Phone');
brandSelect.addEventListener('input',()=>{
 const active=brandTabs.querySelector('.brand-tab.active')?.dataset.group||'Phone';
 renderBrandGroup(active);
});
$('showBrand').addEventListener('input',()=>{
 const active=brandTabs.querySelector('.brand-tab.active')?.dataset.group||'Phone';
 renderBrandGroup(active);
});
const exportHelper=document.createElement('p');exportHelper.className='helper';
exportHelper.textContent='Input RAW menggunakan preview JPEG yang tertanam (bukan sensor RAW penuh). HEIC/HEIF ditukar secara lokal apabila browser tidak dapat buka terus. Fail asal tidak diubah.';
sections[3].append(exportHelper);
setFields('brand');
