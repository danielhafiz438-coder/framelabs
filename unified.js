import { attachSwipe } from './gesture.js';
import { selectionBytes } from './selection.js';

const api=globalThis.FrameLabsV3, $=id=>document.getElementById(id);
const root=document.createElement('section');
root.id='v3-selection';root.className='v3-selection';root.hidden=true;root.tabIndex=-1;
root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Semak pilihan foto');
root.innerHTML=`
  <div class="v3-picker-top"><button type="button" id="v3-back" aria-label="Kembali">‹</button>
    <strong id="v3-heading">Recents</strong><button type="button" id="v3-cancel">Cancel</button></div>
  <p class="v3-picker-note">Foto yang kau pilih dari Photos atau Files. Tekan nombor, susun, dan semak sebelum edit.</p>
  <div id="v3-selection-grid" class="v3-selection-grid" role="group" aria-label="Foto terpilih"></div>
  <div id="v3-selection-tray" class="v3-selection-tray" aria-label="Susunan foto"></div>
  <div class="v3-picker-footer"><button type="button" id="v3-peek">Preview</button>
    <span id="v3-size">Original</span><button type="button" id="v3-finish">Finish</button></div>
  <div id="v3-peek-screen" class="v3-peek-screen" hidden><button type="button" id="v3-peek-back">‹ Kembali</button>
    <canvas id="v3-peek-canvas" aria-label="Pratonton imej terpilih"></canvas><p id="v3-peek-name"></p></div>`;
document.body.append(root);
const gallery=document.querySelector('.template-panel');
const pill=document.createElement('button');pill.type='button';pill.id='v3-manage';pill.className='v3-manage';
pill.textContent='Batch';pill.hidden=true;pill.setAttribute('aria-label','Urus foto terpilih');
document.querySelector('.preview-panel').append(pill);
const counter=document.querySelector('.studio-counter');
const focusBar=$('batch-focus-bar');
const scopeRow=document.createElement('div');scopeRow.className='v3-scope';
scopeRow.innerHTML='<div role="group" aria-label="Skop suntingan"><button type="button" id="v3-global" class="active">Semua foto</button><button type="button" id="v3-individual">Foto ini</button></div><button type="button" id="v3-clear-override">Reset foto ini</button>';
document.querySelector('.inspector-title').after(scopeRow);
const exportAll=document.createElement('button');exportAll.type='button';exportAll.id='v3-export-all';exportAll.className='button primary full-width';exportAll.textContent='Export semua foto (ZIP)';
document.querySelector('.export-section').append(exportAll);
const exportReport=document.createElement('div');exportReport.className='v3-export-progress';exportReport.innerHTML='<p id="v3-export-report"></p>';
document.querySelector('.export-section').append(exportReport);
const exportControls=document.createElement('div');exportControls.className='v3-export-controls';exportControls.append($('batch-progress'),$('batch-cancel'),$('batch-result'));
document.querySelector('.export-section').append(exportControls);
let open=false,lastCommitted=[],lastSelection=0,selectedId=null,navigating=false,peek=false,returnFocus=null;

const available=()=>api.items;
function show(){
 if(api.busy)return;
 open=true;peek=false;root.hidden=false;$('v3-peek-screen').hidden=true;
 document.body.classList.add('v3-picking');returnFocus=document.activeElement;
 document.querySelector('.studio-toolbar').inert=true;
 document.querySelector('.topbar').inert=true;
 document.querySelector('.preview-panel').inert=true;
 gallery.inert=true;document.querySelector('.inspector').inert=true;
 render();root.focus();
}
function hide(){
 open=false;peek=false;root.hidden=true;document.body.classList.remove('v3-picking');
 document.querySelector('.studio-toolbar').inert=document.body.classList.contains('gallery-open');
 document.querySelector('.topbar').inert=document.body.classList.contains('gallery-open');
 document.querySelector('.preview-panel').inert=document.body.classList.contains('gallery-open');
 gallery.inert=!document.body.classList.contains('gallery-open');
 document.querySelector('.inspector').inert=!document.body.classList.contains('sheet-open');
 if(returnFocus?.isConnected&&!returnFocus.disabled)returnFocus.focus();
}
function drawThumb(target,item){
 target.replaceChildren();
 if(item.previewImage){
  const c=document.createElement('canvas');c.width=140;c.height=100;
  const img=item.previewImage,ctx=c.getContext('2d');
  const scale=Math.min(c.width/img.width,c.height/img.height);
  ctx.drawImage(img,(c.width-img.width*scale)/2,(c.height-img.height*scale)/2,img.width*scale,img.height*scale);
  target.append(c);
 }else{
  const pending=document.createElement('span');pending.textContent=item.previewError?'Tidak disokong':'Memuatkan…';
  target.append(pending);
 }
}
function render(){
 const items=available();if(!items.some(x=>x.id===selectedId))selectedId=items[0]?.id||null;
 $('v3-size').textContent=`Original · ${(selectionBytes(items)/1048576).toFixed(1)} MB · ${items.length}/30`;
 $('v3-finish').disabled=!items.length||api.busy;
 $('v3-peek').disabled=!items.length;
 const grid=$('v3-selection-grid'),tray=$('v3-selection-tray');grid.replaceChildren();tray.replaceChildren();
 items.forEach((item,index)=>{
  const card=document.createElement('article');card.className='v3-selection-item';card.dataset.photoId=item.id;
  const b=document.createElement('button');b.type='button';b.className='v3-pick-image';
  b.setAttribute('aria-label',`Pilih foto ${index+1}: ${item.file.name}`);
  b.setAttribute('aria-pressed',String(item.id===selectedId));
  drawThumb(b,item);
  const number=document.createElement('span');number.className='v3-order';number.textContent=String(index+1);b.append(number);
  b.onclick=()=>{selectedId=item.id;render();};
  const tools=document.createElement('div');tools.className='v3-order-tools';
  for(const [label,dir] of [['←',-1],['→',1]]){
   const action=document.createElement('button');action.type='button';action.textContent=label;
   action.setAttribute('aria-label',dir<0?'Alih ke awal':'Alih ke akhir');
   action.disabled=index+dir<0||index+dir>=items.length;
   action.onclick=()=>api.reorder(item.id,dir);tools.append(action);
  }
  const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Buang '+item.file.name);
  remove.onclick=()=>api.remove(item.id);tools.append(remove);
  const filename=document.createElement('p');filename.textContent=item.file.name;filename.title=item.file.name;
  card.append(b,filename,tools);grid.append(card);
  const small=document.createElement('button');small.className='v3-tray-item';small.type='button';
  small.setAttribute('aria-label','Lihat pilihan '+(index+1));
  small.classList.toggle('selected',selectedId===item.id);drawThumb(small,item);
  const badge=document.createElement('b');badge.textContent=String(index+1);small.append(badge);
  small.onclick=()=>{selectedId=item.id;render();};tray.append(small);
 });
 pill.hidden=items.length<2;
 pill.textContent=`✓ Batch ${items.length}`;
 if(!document.body.classList.contains('gallery-open')&&items.length)counter.textContent=`${Math.max(1,api.activeIndex+1)}/${items.length}`;
 $('v3-export-all').hidden=items.length<2;
}
async function previewSelected(){
 const item=available().find(i=>i.id===selectedId);if(!item)return;
 peek=true;$('v3-peek-screen').hidden=false;$('v3-peek-name').textContent='Memuatkan '+item.file.name;
 try{
  await api.ensure(item.id);
  if(!peek||!open)return;
  const source=item.previewImage;if(!source)throw Error(item.previewError||'Preview tidak tersedia');
  const c=$('v3-peek-canvas');c.width=source.width;c.height=source.height;
  c.getContext('2d').drawImage(source,0,0);
  $('v3-peek-name').textContent=item.file.name;
 }catch(e){$('v3-peek-name').textContent=String(e.message||e);}
}
async function finish(){
 const items=available();if(!items.length||api.busy)return;
 const index=Math.max(0,items.findIndex(x=>x.id===selectedId));
 $('v3-finish').disabled=true;
 await api.focus(items[index].id);
 if(api.activeId!==items[index].id){$('v3-finish').disabled=false;return;}
 lastCommitted=items.map(x=>x.id);
 hide();
 if(document.body.classList.contains('gallery-open'))document.querySelector('[data-action=editor]')?.click();
 render();
}
function cancel(){
 if(!open)return;
 for(const item of available())if(!lastCommitted.includes(item.id))api.remove(item.id);
 hide();render();
}
$('v3-peek').onclick=previewSelected;
$('v3-peek-back').onclick=()=>{peek=false;$('v3-peek-screen').hidden=true;};
$('v3-back').onclick=cancel;$('v3-cancel').onclick=cancel;$('v3-finish').onclick=finish;
pill.onclick=show;
$('v3-global').onclick=()=>api.setScope('global');
$('v3-individual').onclick=()=>api.setScope('individual');
$('v3-clear-override').onclick=()=>api.resetCurrent();
exportAll.onclick=()=>{api.exportAll();};
function refreshScope(){
 const scoped=api.scope==='individual';
 $('v3-global').classList.toggle('active',!scoped);
 $('v3-individual').classList.toggle('active',scoped);
 $('v3-clear-override').hidden=!scoped;
}
function syncExport(){
 const txt=$('batch-status').textContent;
 $('v3-export-report').textContent=txt;
 const progress=$('batch-progress');progress.hidden=progress.max<=0;
}
document.addEventListener('framelabs:selection',()=>{render();if(!open)show();});
document.addEventListener('framelabs:preview-ready',()=>{if(open)render();});
document.addEventListener('framelabs:focus',()=>{render();refreshScope();});
document.addEventListener('framelabs:scope',refreshScope);
document.addEventListener('framelabs:busy',syncExport);
document.addEventListener('framelabs:export-complete',syncExport);
new MutationObserver(syncExport).observe($('batch-status'),{childList:true,subtree:true});
const selectedInput=$('photo-input');selectedInput.multiple=true;
$('batch-input').multiple=true;
document.querySelectorAll('[data-template]').forEach(el=>{
 el.addEventListener('click',()=>{
  if(!available().length)selectedInput.click();
 });
});
document.addEventListener('keydown',e=>{
 if(open){
  if(e.key==='Escape'){e.preventDefault();peek?$('v3-peek-back').click():cancel();}
  return;
 }
 if(document.body.classList.contains('sheet-open')||document.body.classList.contains('gallery-open'))return;
 if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
 if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();navigate(e.key==='ArrowRight'?1:-1);}
});
async function navigate(dir){
 if(navigating||api.busy||available().length<2||open||document.body.classList.contains('gallery-open')||document.body.classList.contains('sheet-open'))return;
 const next=api.activeIndex+dir;if(next<0||next>=available().length)return;
 navigating=true;
 try{
  await api.step(dir);
  const wrap=document.querySelector('.canvas-wrap');
  wrap.classList.remove('v3-enter-forward','v3-enter-back');
  void wrap.offsetWidth;
  wrap.classList.add(dir>0?'v3-enter-forward':'v3-enter-back');
  render();
 }finally{navigating=false;}
}
attachSwipe($('drop-zone'),navigate);
window.addEventListener('beforeunload',e=>{
 if(!available().length)return;
 e.preventDefault();e.returnValue='';
});
refreshScope();render();syncExport();
