export const STORAGE_KEY = 'framelabs.project.v1';
export const TEMPLATE_NAMES = { soft: 'Soft Frame', overlay: 'On Photo', rounded: 'Rounded Blur', white: 'Gallery White' };
export const DEFAULTS = Object.freeze({
  ratio: 'original', padding: 6.5, radius: 3, innerRadius: 0, blur: 20, darkness: 78,
  frameColor: '#ffffff', textColor: '#ffffff', brand: 'IPHONE', camera: 'IPHONE',
  caption: '', focal: '75mm', aperture: 'f/2.0', shutter: '1/320s', iso: '200',
  showExif: true, showBrand: true, textSize: 100, format: 'png', resolution: 'original'
});
export const STYLE_DEFAULTS = {
  soft: { padding: 6.5, radius: 3, innerRadius: 0, blur: 20, darkness: 78, textColor: '#ffffff' },
  overlay: { padding: 6.5, radius: 3, innerRadius: 0, blur: 20, darkness: 65, textColor: '#ffffff' },
  rounded: { padding: 6, radius: 3, innerRadius: 6, blur: 24, darkness: 88, textColor: '#ffffff' },
  white: { padding: 4, radius: 3, innerRadius: 0, blur: 20, darkness: 78, textColor: '#202020', frameColor: '#ffffff' }
};
const numericRanges = { padding: [2,14], radius: [0,8], innerRadius: [0,10], blur: [0,32], darkness: [35,95], textSize: [70,160] };
const enums = { ratio: ['original','3:2','4:3','1:1','4:5','9:16'], brand: ['IPHONE','FUJIFILM','DJI','SONY','CANON','NIKON','LUMIX','LEICA','HASSELBLAD','CUSTOM'], format: ['png','jpeg'], resolution: ['original','2048','4096'] };
export function sanitizeSettings(input) {
  const out = { ...DEFAULTS };
  if (!input || typeof input !== 'object') return out;
  for (const key of Object.keys(out)) {
    const value = input[key];
    if (key in numericRanges) {
      if (typeof value === 'number' && Number.isFinite(value)) out[key] = Math.max(numericRanges[key][0], Math.min(numericRanges[key][1], value));
    } else if (key in enums) {
      if (enums[key].includes(value)) out[key] = value;
    } else if (typeof out[key] === 'boolean') {
      if (typeof value === 'boolean') out[key] = value;
    } else if (key.endsWith('Color')) {
      if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) out[key] = value;
    } else if (typeof value === 'string') {
      out[key] = value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, key === 'caption' ? 90 : key === 'camera' ? 64 : 20);
    }
  }
  return out;
}
export function freshStyles() {
  return Object.fromEntries(Object.keys(TEMPLATE_NAMES).map(key => [key, sanitizeSettings({ ...DEFAULTS, ...STYLE_DEFAULTS[key] })]));
}
export function parseProject(raw) {
  try {
    const p = JSON.parse(raw);
    if (!p || p.version !== 1) return null;
    const styles = freshStyles();
    for (const key of Object.keys(styles)) if (p.styles?.[key]) styles[key] = sanitizeSettings(p.styles[key]);
    const validImage = (s, max) => typeof s === 'string' && s.length <= max && /^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(s) ? s : null;
    return { template: Object.hasOwn(TEMPLATE_NAMES, p.template) ? p.template : 'soft', styles,
      photo: validImage(p.photo, 2300000), logo: validImage(p.logo, 650000),
      photoName: typeof p.photoName === 'string' ? p.photoName.slice(0,180) : 'Foto tersimpan',
      exifFound: p.exifFound === true, batchMode: p.batchMode === 'editor' ? 'editor' : 'auto' };
  } catch { return null; }
}
export function saveProject(storage, project) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(project)); return 'full'; }
  catch {
    try { storage.setItem(STORAGE_KEY, JSON.stringify({ ...project, photo: null })); return 'settings'; }
    catch { return 'unavailable'; }
  }
}
export function layoutFor(imageWidth, imageHeight, settings, template) {
  let ratio = Math.max(.1, Math.min(10, imageWidth / imageHeight));
  if (settings.ratio !== 'original') { const [a,b] = settings.ratio.split(':').map(Number); ratio = a/b; }
  const photoW = 1000, photoH = photoW / ratio;
  const pad = template === 'overlay' ? 0 : settings.padding * 10;
  const hasDetails = settings.showExif && [settings.focal,settings.aperture,settings.shutter,settings.iso].some(Boolean);
  const hasBrand = Boolean(settings.showBrand && (settings.camera || settings.brand !== 'CUSTOM' || settings.hasLogo));
  const lines = Number(hasDetails) + Number(hasBrand) + Number(Boolean(settings.caption));
  const footer = template === 'overlay' || !lines ? 0 : Math.max(72, lines * 37 * settings.textSize / 100 + 28);
  return { width: photoW + pad * 2, height: photoH + pad * 2 + footer, photoW, photoH, pad, footer, hasDetails, hasBrand };
}
export function cropRect(iw, ih, targetRatio) {
  const ratio = iw/ih;
  if (ratio > targetRatio) { const w = ih*targetRatio; return { x:(iw-w)/2, y:0, width:w, height:ih }; }
  const h = iw/targetRatio; return { x:0, y:(ih-h)/2, width:iw, height:h };
}
export function exportSize(layout, iw, ih, choice) {
  const crop = cropRect(iw, ih, layout.photoW/layout.photoH);
  const naturalScale = crop.width/layout.photoW;
  const long = choice === 'original' ? Math.max(layout.width, layout.height)*naturalScale : Number(choice);
  const scale = Math.min(4096, Math.max(1, long))/Math.max(layout.width,layout.height);
  return { width:Math.max(1,Math.round(layout.width*scale)), height:Math.max(1,Math.round(layout.height*scale)) };
}
export function metadataSettings(tags = {}) {
  const make = String(tags.Make || '').toUpperCase();
  const model = String(tags.Model || '').trim();
  const brand = /APPLE|IPHONE/.test(make+' '+model.toUpperCase()) ? 'IPHONE' : enums.brand.find(b => b !== 'CUSTOM' && make.includes(b)) || 'CUSTOM';
  const focal = tags.FocalLengthIn35mmFormat || tags.FocalLength;
  const shutter = Number(tags.ExposureTime);
  return { brand, camera: model || make, focal: Number.isFinite(Number(focal)) && Number(focal)>0 ? `${Math.round(Number(focal)*10)/10}mm` : '',
    aperture: Number(tags.FNumber)>0 ? `f/${Number(tags.FNumber).toFixed(1)}` : '',
    shutter: shutter>0 ? shutter<1 ? `1/${Math.round(1/shutter)}s` : `${Math.round(shutter*10)/10}s` : '',
    iso: tags.ISO != null ? String(tags.ISO).slice(0,20) : '' };
}
