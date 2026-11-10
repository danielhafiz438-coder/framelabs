/* FrameLabs interface: one settings sheet with two layers (Bingkai, Lanjutan) and the
   frame chips in the toolbar. app.js owns the engine and exposes it as FrameLabsV3;
   this file only builds and wires UI. */
const $ = id => document.getElementById(id);
const body = document.body;
const inspector = document.querySelector('.inspector');
const form = $('settings');
const api = () => globalThis.FrameLabsV3;
const template = () => api()?.template || 'soft';

let toastTimer = 0;
function message(text) {
  const status = $('status');
  status.textContent = text;
  status.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { status.hidden = true; }, 2600);
}

/* One sheet, one state: open or closed. */
function openSheet() {
  body.classList.add('sheet-open');
  $('settings-toggle').setAttribute('aria-expanded', 'true');
  inspector.scrollTop = 0;
  syncSurfaces();
  $('sheet-close').focus();
}

function closeSheet() {
  if (!body.classList.contains('sheet-open')) return;
  body.classList.remove('sheet-open');
  $('settings-toggle').setAttribute('aria-expanded', 'false');
  syncSurfaces();
}

function toggleSheet() {
  if (body.classList.contains('sheet-open')) closeSheet();
  else openSheet();
}

function syncSurfaces() {
  const sheetOpen = body.classList.contains('sheet-open');
  const picking = body.classList.contains('v3-picking');
  inspector.inert = !sheetOpen || picking;
  document.querySelector('.preview-panel').inert = sheetOpen || picking;
  document.querySelector('.topbar').inert = picking;
  document.dispatchEvent(new Event('studio:view'));
}

$('settings-toggle').addEventListener('click', toggleSheet);
$('sheet-close').addEventListener('click', closeSheet);
$('reset-crop').addEventListener('click', () => api()?.resetCrop());

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || body.classList.contains('v3-picking')) return;
  if (body.classList.contains('sheet-open')) closeSheet();
});

// Frame swatches replace a plain colour field for the frame templates.
const frameSection = form.querySelector('[data-section="bingkai"]');
const framePalette = document.createElement('div');
framePalette.id = 'frame-palette';
framePalette.className = 'frame-palette';
framePalette.innerHTML = '<p class="palette-label">Warna bingkai</p><div class="palette-list" role="group" aria-label="Warna bingkai"></div>';
frameSection.insertBefore(framePalette, frameSection.querySelector('.crop-hint').nextSibling);

const frameVariant = document.createElement('select');
frameVariant.id = 'frameVariant';
frameVariant.name = 'frameVariant';
frameVariant.hidden = true;
frameVariant.setAttribute('aria-label', 'Varian bingkai');
for (const [value, label] of [['original', 'Auto'], ['white', 'Putih'], ['black', 'Hitam'], ['pastel', 'Pastel'], ['vibrant', 'Vibrant']]) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  frameVariant.append(option);
}
frameSection.append(frameVariant);

const paletteList = framePalette.querySelector('.palette-list');
for (const [value, label] of [['original', 'Auto'], ['white', 'Putih'], ['black', 'Hitam'], ['pastel', 'Pastel'], ['vibrant', 'Vibrant']]) {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = `palette-choice ${value}`;
  item.dataset.palette = value;
  item.setAttribute('aria-label', label);
  item.title = label;
  item.addEventListener('click', () => {
    if (template() === 'overlay') {
      message('On Photo tiada bingkai luar.');
      return;
    }
    frameVariant.value = value;
    frameVariant.dispatchEvent(new Event('input', { bubbles: true }));
    refreshPalette();
  });
  paletteList.append(item);
}

function refreshPalette() {
  const saved = form.elements.frameVariant?.value || 'original';
  framePalette.hidden = template() === 'overlay';
  paletteList.querySelectorAll('.palette-choice').forEach(button => {
    const on = button.dataset.palette === saved;
    button.classList.toggle('selected', on);
    button.setAttribute('aria-pressed', String(on));
  });
}

// Brand picker: three groups, each a row of logo buttons.
const brandField = form.querySelector('[data-section="identiti"]');
const brandSelect = $('brand');
const brandTabs = document.createElement('div');
brandTabs.className = 'brand-tabs';
brandTabs.setAttribute('role', 'tablist');
brandTabs.setAttribute('aria-label', 'Kategori jenama');
const brandGrid = document.createElement('div');
brandGrid.className = 'brand-grid';
const brandAnchor = brandField.querySelector('select');
brandField.insertBefore(brandTabs, brandAnchor.nextSibling);
brandField.insertBefore(brandGrid, brandTabs.nextSibling);

const brandGroups = [
  ['Phone', ['IPHONE', 'XIAOMI']],
  ['Camera', ['SONY', 'CANON', 'NIKON', 'FUJIFILM', 'LUMIX', 'LEICA', 'HASSELBLAD']],
  ['Action', ['DJI', 'GOPRO', 'INSTA360']],
];

function renderBrandGroup(group) {
  brandTabs.querySelectorAll('.brand-tab').forEach(tab => {
    const selected = tab.dataset.group === group;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', String(selected));
  });
  brandGrid.replaceChildren();
  const codes = ['HIDE', ...(brandGroups.find(([name]) => name === group)?.[1] || [])];
  for (const code of codes) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'brand-choice';
    if (code === 'HIDE') {
      button.classList.add('hide-logo');
      button.textContent = 'Tiada';
      button.setAttribute('aria-label', 'Sembunyikan jenama');
    } else {
      button.textContent = code === 'IPHONE' ? 'Apple' : code;
      button.setAttribute('aria-label', `Pilih ${code}`);
    }
    const chosen = code === 'HIDE' ? !$('showBrand').checked : brandSelect.value === code && $('showBrand').checked;
    button.classList.toggle('selected', chosen);
    button.setAttribute('aria-pressed', String(chosen));
    button.disabled = brandSelect.disabled;
    button.addEventListener('click', () => {
      if (code !== 'HIDE') {
        brandSelect.value = code;
        brandSelect.dispatchEvent(new Event('input', { bubbles: true }));
      }
      $('showBrand').checked = code !== 'HIDE';
      $('showBrand').dispatchEvent(new Event('input', { bubbles: true }));
    });
    brandGrid.append(button);
  }
}

for (const [group] of brandGroups) {
  const tab = document.createElement('button');
  tab.type = 'button';
  tab.className = 'brand-tab';
  tab.dataset.group = group;
  tab.textContent = group;
  tab.setAttribute('role', 'tab');
  tab.addEventListener('click', () => renderBrandGroup(group));
  brandTabs.append(tab);
}
renderBrandGroup('Phone');

function refreshBrand() {
  const active = brandTabs.querySelector('.brand-tab.active')?.dataset.group || 'Phone';
  renderBrandGroup(active);
}

let brandPending = false;
form.addEventListener('input', event => {
  if (!['brand', 'showBrand'].includes(event.target.id) || brandPending) return;
  brandPending = true;
  queueMicrotask(() => { brandPending = false; refreshBrand(); });
});

document.addEventListener('editor:settings', () => { refreshPalette(); refreshBrand(); });
document.addEventListener('editor:busy', event => {
  for (const button of inspector.querySelectorAll('.brand-choice,.brand-tab,.palette-choice')) {
    button.disabled = event.detail || (button.classList.contains('brand-choice') && brandSelect.disabled);
  }
});
document.addEventListener('framelabs:edited', refreshPalette);
for (const chip of document.querySelectorAll('[data-frame]')) chip.addEventListener('click', refreshPalette);

new ResizeObserver(() => {
  document.documentElement.style.setProperty('--sheet-height', `${inspector.offsetHeight}px`);
}).observe(inspector);

refreshPalette();
syncSurfaces();
