/* FrameLabs interface: one settings sheet above a floating dock, frame chips in the
   toolbar. app.js owns the engine and exposes it as FrameLabsV3; this file only builds
   and wires UI. */
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

/* One inspector, two presentations: a bottom sheet below 1000px, a docked column above it. */
const desktop = window.matchMedia('(min-width: 1000px)');

function openSheet() {
  body.classList.add('sheet-open');
  $('settings-toggle').setAttribute('aria-expanded', 'true');
  inspector.scrollTop = 0;
  syncSurfaces();
  if (!desktop.matches) $('sheet-close').focus();
}

function closeSheet() {
  if (!body.classList.contains('sheet-open')) return;
  const hadFocus = inspector.contains(document.activeElement);
  body.classList.remove('sheet-open');
  $('settings-toggle').setAttribute('aria-expanded', 'false');
  syncSurfaces();
  // The sheet goes inert when it closes, so focus returns to the dock control that opened it.
  if (hadFocus && !desktop.matches) $('settings-toggle').focus();
}

function toggleSheet() {
  if (body.classList.contains('sheet-open')) closeSheet();
  else openSheet();
}

function syncSurfaces() {
  const sheetOpen = body.classList.contains('sheet-open');
  const picking = body.classList.contains('v3-picking');
  const docked = desktop.matches;
  inspector.inert = picking || (!docked && !sheetOpen);
  document.querySelector('.preview-panel').inert = picking || (!docked && sheetOpen);
  document.querySelector('.topbar').inert = picking;
  document.querySelector('.dock').inert = picking;
  document.dispatchEvent(new Event('studio:view'));
}

// Crossing the breakpoint changes which surface is live, without a reload.
desktop.addEventListener('change', syncSurfaces);
globalThis.syncStudioSurfaces = syncSurfaces;

$('settings-toggle').addEventListener('click', toggleSheet);
$('sheet-close').addEventListener('click', closeSheet);
$('reset-crop').addEventListener('click', () => api()?.resetCrop());

/* Dock batch slot: with two or more photos it opens the review grid that unified.js owns,
   otherwise it opens the batch file picker. The badge is the count, and only when it is real. */
const dockBatch = $('dock-batch');
const dockBadge = dockBatch.querySelector('.dock-badge');
function syncDockBatch() {
  const count = api()?.items?.length || 0;
  const queued = count > 1;
  dockBadge.hidden = !queued;
  if (queued) dockBadge.textContent = String(count);
  dockBatch.setAttribute('aria-label', queued ? `Batch, ${count} foto` : 'Batch');
}
dockBatch.addEventListener('click', () => {
  const manage = $('v3-manage');
  if (manage && !manage.hidden) {
    manage.click();
    return;
  }
  $('batch-input').click();
});
document.addEventListener('framelabs:selection', syncDockBatch);

/* Swipe the grabber down to dismiss. The sheet follows the finger 1:1 and the release
   continues into the same 0.38s curve, so nothing jumps when the gesture ends. */
const grabber = inspector.querySelector('.sheet-grabber');
let dragPointer = null, dragFrom = 0, dragOffset = 0;
function endDrag(close) {
  if (dragPointer === null) return;
  dragPointer = null;
  inspector.classList.remove('sheet-dragging');
  if (close) {
    closeSheet();
    setTimeout(() => inspector.style.removeProperty('--sheet-drag'), 420);
  } else {
    inspector.style.setProperty('--sheet-drag', '0px');
  }
  dragOffset = 0;
}
grabber?.addEventListener('pointerdown', event => {
  if (desktop.matches || !body.classList.contains('sheet-open')) return;
  dragPointer = event.pointerId;
  dragFrom = event.clientY;
  dragOffset = 0;
  inspector.classList.add('sheet-dragging');
  inspector.style.setProperty('--sheet-drag', '0px');
  try { grabber.setPointerCapture(event.pointerId); } catch { /* Synthetic pointers cannot be captured. */ }
});
grabber?.addEventListener('pointermove', event => {
  if (event.pointerId !== dragPointer) return;
  dragOffset = Math.max(0, event.clientY - dragFrom);
  inspector.style.setProperty('--sheet-drag', `${dragOffset}px`);
});
grabber?.addEventListener('pointerup', event => {
  if (event.pointerId !== dragPointer) return;
  endDrag(dragOffset > Math.min(110, inspector.offsetHeight * 0.28));
});
grabber?.addEventListener('pointercancel', () => endDrag(false));

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

// On Photo has no mat by design, so the empty-looking section says why.
const overlayHint = document.createElement('p');
overlayHint.id = 'overlay-hint';
overlayHint.className = 'helper';
overlayHint.textContent = 'On Photo tiada bingkai luar, jadi ketebalan dan warna bingkai tidak digunakan.';
frameSection.append(overlayHint);

function refreshPalette() {
  const saved = form.elements.frameVariant?.value || 'original';
  framePalette.hidden = template() === 'overlay';
  overlayHint.hidden = template() !== 'overlay';
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
syncDockBatch();
syncSurfaces();
