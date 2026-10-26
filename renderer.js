import { layoutFor, cropRect } from './core.js';

const blurCache = new WeakMap();
const tintCache = new WeakMap();
function tintLogo(img,color) {
  if(!tintCache.has(img))tintCache.set(img,new Map());
  const cache=tintCache.get(img);if(cache.has(color))return cache.get(color);
  const raster=document.createElement('canvas');raster.width=480;raster.height=480;
  const rasterCtx=raster.getContext('2d',{willReadFrequently:true});rasterCtx.drawImage(img,0,0,480,480);
  const pixels=rasterCtx.getImageData(0,0,480,480).data;
  let minX=480,minY=480,maxX=0,maxY=0;
  for(let y=0;y<480;y++)for(let x=0;x<480;x++)if(pixels[(y*480+x)*4+3]){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
  const c=document.createElement('canvas');c.width=Math.max(1,maxX-minX+1);c.height=Math.max(1,maxY-minY+1);
  const ctx=c.getContext('2d');ctx.drawImage(raster,minX,minY,c.width,c.height,0,0,c.width,c.height);ctx.globalCompositeOperation='source-in';ctx.fillStyle=color;ctx.fillRect(0,0,c.width,c.height);
  if(cache.size>=8)cache.clear();cache.set(color,c);return c;
}
function roundedPath(ctx,x,y,w,h,r,begin=true) {
  const v = Math.min(Math.max(0,r),w/2,h/2);
  if(begin) ctx.beginPath(); ctx.moveTo(x+v,y); ctx.lineTo(x+w-v,y); ctx.quadraticCurveTo(x+w,y,x+w,y+v);
  ctx.lineTo(x+w,y+h-v); ctx.quadraticCurveTo(x+w,y+h,x+w-v,y+h); ctx.lineTo(x+v,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-v); ctx.lineTo(x,y+v); ctx.quadraticCurveTo(x,y,x+v,y); ctx.closePath();
}
function cover(ctx,img,x,y,w,h) {
  const r = cropRect(img.naturalWidth || img.width, img.naturalHeight || img.height, w/h);
  ctx.drawImage(img,r.x,r.y,r.width,r.height,x,y,w,h);
}
// A small separable blur keeps exported backgrounds consistent on Safari, including versions without Canvas filter.
function boxBlur(data,w,h,radius) {
  if (radius<1) return;
  const temp = new Uint8ClampedArray(data.length), span = radius*2+1;
  for (let pass=0;pass<3;pass++) {
    for (let y=0;y<h;y++) for (let c=0;c<4;c++) {
      let sum=0; for (let x=-radius;x<=radius;x++) sum+=data[(y*w+Math.max(0,Math.min(w-1,x)))*4+c];
      for (let x=0;x<w;x++) { temp[(y*w+x)*4+c]=sum/span; sum+=data[(y*w+Math.min(w-1,x+radius+1))*4+c]-data[(y*w+Math.max(0,x-radius))*4+c]; }
    }
    for (let x=0;x<w;x++) for (let c=0;c<4;c++) {
      let sum=0; for (let y=-radius;y<=radius;y++) sum+=temp[(Math.max(0,Math.min(h-1,y))*w+x)*4+c];
      for (let y=0;y<h;y++) { data[(y*w+x)*4+c]=sum/span; sum+=temp[(Math.min(h-1,y+radius+1)*w+x)*4+c]-temp[(Math.max(0,y-radius)*w+x)*4+c]; }
    }
  }
}
function blurred(img,ratio,amount) {
  if (!blurCache.has(img)) blurCache.set(img,new Map());
  const cache=blurCache.get(img), key=`${ratio.toFixed(4)}:${amount}`;
  if (cache.has(key)) return cache.get(key);
  const c=document.createElement('canvas');
  c.width=ratio>=1 ? 320 : Math.max(32,Math.round(320*ratio));
  c.height=ratio>=1 ? Math.max(32,Math.round(320/ratio)) : 320;
  const ctx=c.getContext('2d',{willReadFrequently:true}); cover(ctx,img,0,0,c.width,c.height);
  const pixels=ctx.getImageData(0,0,c.width,c.height);
  boxBlur(pixels.data,c.width,c.height,Math.round(amount*.32)); ctx.putImageData(pixels,0,0);
  if(cache.size>=3) cache.clear(); cache.set(key,c); return c;
}
function fitText(ctx,text,maxWidth,size,weight='400',family='system-ui, sans-serif') {
  ctx.font=`${weight} ${size}px ${family}`;
  const width=ctx.measureText(text).width;
  if(width>maxWidth) ctx.font=`${weight} ${size*Math.max(.15,maxWidth/width)}px ${family}`;
}
function detailText(s) {
  return [s.focal,s.aperture,s.shutter,s.iso ? `ISO ${s.iso.replace(/^ISO\s*/i,'')}` : ''].filter(Boolean).join('   |   ');
}
function brandLine(ctx,s,customLogo,builtinLogo,x,y,maxWidth,size) {
  const logo=customLogo||(builtinLogo?tintLogo(builtinLogo,s.textColor):null);
  let text = s.camera || (s.brand==='CUSTOM' ? '' : s.brand);
  if(builtinLogo&&!customLogo&&s.brand!=='IPHONE'&&text.toUpperCase()===s.brand)text='';
  const maxLogoWidth=builtinLogo&&!customLogo&&s.brand==='FUJIFILM'?size*5.4:size*4.5;
  const aspect=logo ? (logo.naturalWidth||logo.width)/(logo.naturalHeight||logo.height):1;
  const logoH=logo?Math.min(size*1.35,maxLogoWidth/aspect):0, logoW=logoH*aspect;
  fitText(ctx,text,maxWidth-logoW-(logo&&text?24:0),size,'750');
  const textW=ctx.measureText(text).width, total=textW+logoW+(logo&&text?24:0);
  const left=x-total/2;
  if(logo) ctx.drawImage(logo,left,y-logoH*.7,logoW,logoH);
  ctx.textAlign='left'; ctx.fillText(text,left+logoW+(logo&&text?24:0),y); ctx.textAlign='center';
}
export function render(canvas,img,settings,template,options={}) {
  const s={...settings,hasLogo:Boolean(options.logo)}, iw=img.naturalWidth||img.width, ih=img.naturalHeight||img.height;
  const l=layoutFor(iw,ih,s,template), maxSide=options.maxSide||1400;
  let width=options.width, height=options.height;
  if(!width||!height) { const k=maxSide/Math.max(l.width,l.height);width=Math.round(l.width*k);height=Math.round(l.height*k); }
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,width,height);
  if(options.jpeg) {ctx.fillStyle='#000000';ctx.fillRect(0,0,width,height);}
  ctx.save();ctx.scale(width/l.width,height/l.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  roundedPath(ctx,0,0,l.width,l.height,s.radius*10);ctx.clip();
  if(template!=='overlay'){
    if(s.frameVariant==='white'||s.frameVariant==='black'){
      ctx.fillStyle=s.frameVariant==='white'?'#ffffff':'#000000';ctx.fillRect(0,0,l.width,l.height);
    }else if(s.frameVariant==='pastel'||s.frameVariant==='vibrant'){
      const gradient=ctx.createLinearGradient(0,0,l.width,l.height);
      if(s.frameVariant==='pastel'){
        gradient.addColorStop(0,'#f1a5bf');gradient.addColorStop(.48,'#ffe5a5');gradient.addColorStop(1,'#a6dff5');
      }else{
        gradient.addColorStop(0,'#ed2475');gradient.addColorStop(.5,'#ffa523');gradient.addColorStop(1,'#139be9');
      }
      ctx.fillStyle=gradient;ctx.fillRect(0,0,l.width,l.height);
    }else if(template==='white'){
      ctx.fillStyle=s.frameColor;ctx.fillRect(0,0,l.width,l.height);
    }else ctx.drawImage(blurred(img,l.width/l.height,s.blur),0,0,l.width,l.height);
  }
  ctx.save();roundedPath(ctx,l.pad,l.pad,l.photoW,l.photoH,s.innerRadius*10);ctx.clip();cover(ctx,img,l.pad,l.pad,l.photoW,l.photoH);ctx.restore();
  if(template==='overlay'||(template!=='white'&&(!s.frameVariant||s.frameVariant==='original'))) {
    const start=template==='overlay' ? l.height*.55 : l.pad+l.photoH*.65;
    const gradient=ctx.createLinearGradient(0,start,0,l.height);gradient.addColorStop(0,'rgba(0,0,0,0)');gradient.addColorStop(1,`rgba(0,0,0,${s.darkness/100})`);
    if(template==='overlay') {ctx.fillStyle=gradient;ctx.fillRect(0,start,l.width,l.height-start);}
    else {ctx.save();ctx.beginPath();ctx.rect(0,0,l.width,l.height);roundedPath(ctx,l.pad,l.pad,l.photoW,l.photoH,s.innerRadius*10,false);ctx.clip('evenodd');ctx.fillStyle=gradient;ctx.fillRect(0,0,l.width,l.height);ctx.restore();}
  }
  ctx.fillStyle=s.textColor;ctx.textAlign='center';ctx.textBaseline='middle';
  const size=s.textSize/100, brandSize=26*size, detailSize=16*size, captionSize=19*size;
  const rows=[];
  if(template==='white') {if(l.hasDetails)rows.push('details');if(l.hasBrand)rows.push('brand');}
  else {if(l.hasBrand)rows.push('brand');if(l.hasDetails)rows.push('details');}
  if(s.caption) rows.push('caption');
  const gap=37*size, block=(rows.length-1)*gap;
  const cy=template==='overlay' ? l.height-Math.max(50,50*size)-block/2 : l.pad+l.photoH+(l.footer+l.pad)/2;
  rows.forEach((row,index)=>{
    const y=cy-block/2+index*gap,maxWidth=l.photoW*.9;
    if(row==='brand')brandLine(ctx,s,options.logo,options.brandLogo,l.width/2,y,maxWidth,brandSize);
    else {const text=row==='details'?detailText(s):s.caption;fitText(ctx,text,maxWidth,row==='details'?detailSize:captionSize,'400',row==='details'?'Consolas, monospace':'system-ui, sans-serif');ctx.fillText(text,l.width/2,y);}
  });
  ctx.restore();return {width,height,layout:l};
}
