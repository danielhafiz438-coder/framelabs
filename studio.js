/* FrameLabs interface: gallery sheet, settings sheet, favorites and the bottom bar.
   app.js owns the engine and exposes it as FrameLabsV3; this file only builds and wires UI. */
const $ = id => document.getElementById(id);
const body = document.body;
const inspector = document.querySelector('.inspector');
const catalog = $('gallery');
const form = $('settings');
const FAVORITES_KEY = 'framelabs.favorites.v1';
const templates = [...document.querySelectorAll('[data-template]')];
const api = () => globalThis.FrameLabsV3;

const icons = {
  star: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m12 4 2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8z"/></svg>',
  starOn: '<svg aria-hidden="true" viewBox="0 0 24 24" class="filled"><path d="m12 4 2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8z"/></svg>',
};

let toastTimer = 0;
function message(text) {
  const status = $('status');
  status.textContent = text;
  status.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { status.hidden = true; }, 2600);
}

function readFavorites() {
  try {
    const raw = JSON.parse(localStorage.getItem(FAVORITES_KEY));
    return Array.isArray(raw) ? raw.filter(key => templates.some(button => button.dataset.template === key)) : [];
  } catch { return []; }
}

function writeFavorites(list) {
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(list)); } catch { /* Storage denied; favorites stay for this session. */ }
}

function renderFavorites() {
  const list = readFavorites();
  const panel = $('favorites');
  panel.replaceChildren();
  const note = document.createElement('p');
  note.className = 'helper';
  note.textContent = list.length ? 'Pilih bingkai favorit.' : 'Belum ada favorit. Tandakan bintang.';
  panel.append(note);
  for (const button of templates) {
    const key = button.dataset.template;
    const name = button.querySelector('b').textContent;
    const on = list.includes(key);
    const row = document.createElement('div');
    row.className = 'fav-row';
    const use = document.createElement('button');
    use.type = 'button';
    use.className = 'fav-use';
    use.textContent = name;
    use.addEventListener('click', () => { button.click(); closeSheet(); });
    const star = document.createElement('button');
    star.type = 'button';
    star.className = 'fav-star';
    star.setAttribute('aria-pressed', String(on));
    star.setAttribute('aria-label', `${on ? 'Buang' : 'Tambah'} ${name}`);
    star.innerHTML = on ? icons.starOn : icons.star;
    star.addEventListener('click', () => {
      writeFavorites(on ? list.filter(item => item !== key) : [...list, key]);
      renderFavorites();
    });
    row.append(use, star);
    panel.append(row);
  }
}

function setSheet(name) {
  inspector.dataset.sheet = name;
  $('sheet-title').textContent = name === 'favorites' ? 'Favorit' : 'Tetapan';
  $('reset').hidden = name !== 'settings';
  $('favorites').hidden = name !== 'favorites';
  form.hidden = name === 'favorites';
  inspector.querySelector('.batch-section').hidden = name === 'favorites';
  inspector.querySelector('.storage-details').hidden = name === 'favorites';
  const scope = inspector.querySelector('.v3-scope');
  if (scope && name === 'favorites') scope.hidden = true;
}

function openSheet(name) {
  closeGallery();
  if (name === 'favorites') renderFavorites();
  setSheet(name);
  body.classList.add('sheet-open');
  syncSurfaces();
  inspector.scrollTop = 0;
  inspector.querySelector('.sheet-head .icon-button')?.focus();
}

function closeSheet() {
  if (!body.classList.contains('sheet-open')) return;
  body.classList.remove('sheet-open');
  syncSurfaces();
}

function openGallery() {
  closeSheet();
  body.classList.add('gallery-open');
  catalog.scrollTop = 0;
  syncSurfaces();
  $('gallery-toggle').setAttribute('aria-expanded', 'true');
  catalog.querySelector('.template.selected')?.focus();
}

function closeGallery() {
  if (!body.classList.contains('gallery-open')) return;
  body.classList.remove('gallery-open');
  syncSurfaces();
  $('gallery-toggle').setAttribute('aria-expanded', 'false');
}

function syncSurfaces() {
  const galleryOpen = body.classList.contains('gallery-open');
  const sheetOpen = body.classList.contains('sheet-open');
  const picking = body.classList.contains('v3-picking');
  catalog.inert = !galleryOpen || picking;
  inspector.inert = !sheetOpen || picking;
  document.querySelector('.preview-panel').inert = galleryOpen || sheetOpen || picking;
  document.querySelector('.studio-nav').inert = picking;
  document.querySelector('.topbar').inert = picking;
  document.querySelectorAll('.studio-nav [data-action]').forEach(button => {
    const sheet = sheetOpen ? inspector.dataset.sheet : null;
    const current = (button.dataset.action === 'favorites' && sheet === 'favorites')
      || (button.dataset.action === 'settings' && sheet === 'settings')
      || (button.dataset.action === 'home' && !sheet);
    if (current) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  document.dispatchEvent(new Event('studio:view'));
}

$('gallery-toggle').addEventListener('click', () => {
  if (body.classList.contains('gallery-open')) closeGallery();
  else openGallery();
});
$('gallery-close').addEventListener('click', closeGallery);
$('sheet-close').addEventListener('click', closeSheet);
$('reset-crop').addEventListener('click', () => api()?.resetCrop());

for (const button of document.querySelectorAll('.studio-nav [data-action]')) {
  button.addEventListener('click', () => {
    const action = button.dataset.action;
    if (action === 'home') {
      closeSheet();
      if (api()?.hasPhoto) closeGallery();
      else openGallery();
    } else if (action === 'favorites') openSheet('favorites');
    else openSheet('settings');
  });
}

for (const button of document.querySelectorAll('[data-filter]')) {
  button.addEventListener('click', () => {
    const picked = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(item => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    for (const card of templates) {
      const groups = (card.dataset.categories || '').split(' ');
      card.hidden = picked !== 'all' && !groups.includes(picked);
    }
  });
}

const categories = { soft: 'blur', overlay: 'minimal', white: 'classic minimal' };
templates.forEach(button => { button.dataset.categories = categories[button.dataset.template] || ''; });

$('photo-input').addEventListener('change', event => {
  if (event.target.files?.length && !body.classList.contains('v3-picking')) closeGallery();
});
templates.forEach(button => button.addEventListener('click', () => {
  if (api()?.hasPhoto) closeGallery();
}));

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || body.classList.contains('v3-picking')) return;
  if (body.classList.contains('sheet-open')) closeSheet();
  else if (body.classList.contains('gallery-open')) closeGallery();
});

// Frame swatches replace a plain colour field for the frame templates.
const frameSection = sections()[0];
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
    if (document.querySelector('.template.selected')?.dataset.template === 'overlay') {
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
  framePalette.hidden = document.querySelector('.template.selected')?.dataset.template === 'overlay';
  paletteList.querySelectorAll('.palette-choice').forEach(button => {
    const on = button.dataset.palette === saved;
    button.classList.toggle('selected', on);
    button.setAttribute('aria-pressed', String(on));
  });
}

// Brand picker: three groups, each a row of logo buttons.
const brandField = sections()[1];
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

function sections() { return [...form.querySelectorAll('.settings-section')]; }

document.addEventListener('editor:settings', () => { refreshPalette(); refreshBrand(); });
document.addEventListener('editor:busy', event => {
  for (const button of inspector.querySelectorAll('.brand-choice,.brand-tab,.palette-choice')) {
    button.disabled = event.detail || (button.classList.contains('brand-choice') && brandSelect.disabled);
  }
});
document.addEventListener('framelabs:edited', refreshPalette);
templates.forEach(button => button.addEventListener('click', refreshPalette));

new ResizeObserver(() => {
  document.documentElement.style.setProperty('--sheet-height', `${inspector.offsetHeight}px`);
}).observe(inspector);

renderFavorites();
refreshPalette();
setSheet('settings');
syncSurfaces();
openGallery();
