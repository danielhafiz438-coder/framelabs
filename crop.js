// Direct-manipulation crop: a finger drags the photo, a pinch sets the zoom.
// Settings store cropX and cropY as a 0-100 percentage of the pan range, the same
// numbers cover() reads, so the gesture and the renderer cannot drift apart.

export const ZOOM_MIN = 100;
export const ZOOM_MAX = 300;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const zoomFactor = zoom => clamp(Number(zoom) || ZOOM_MIN, ZOOM_MIN, ZOOM_MAX) / 100;

// Screen pixels a finger travels to cross the whole photo at this zoom.
export function panRange(viewPx, zoom) {
  const factor = zoomFactor(zoom);
  return Math.max(0, viewPx * (1 - 1 / factor));
}

// A drag to the right moves the photo right, so the visible window moves left.
export function panPercent(percent, deltaPx, viewPx, zoom) {
  const range = panRange(viewPx, zoom);
  if (range < 1) return clamp(Number(percent) || 0, 0, 100);
  return clamp((Number(percent) || 0) - (deltaPx / range) * 100, 0, 100);
}

export function pinchZoom(startZoom, scale) {
  if (!Number.isFinite(scale) || scale <= 0) return clamp(Number(startZoom) || ZOOM_MIN, ZOOM_MIN, ZOOM_MAX);
  return clamp((Number(startZoom) || ZOOM_MIN) * scale, ZOOM_MIN, ZOOM_MAX);
}

export function createCropGesture({ element, measure, read, write, isEnabled = () => true }) {
  if (!element) return { destroy() {} };
  const pointers = new Map();
  let mode = null;
  let last = null;
  let pinchStart = 0;
  let zoomStart = ZOOM_MIN;

  const distance = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onDown = event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (!isEnabled()) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try { element.setPointerCapture?.(event.pointerId); } catch { /* A synthetic pointer has nothing to capture. */ }
    if (pointers.size === 1) {
      mode = 'pan';
      last = { x: event.clientX, y: event.clientY };
    } else if (pointers.size === 2) {
      mode = 'pinch';
      pinchStart = distance();
      zoomStart = read().cropZoom ?? ZOOM_MIN;
    }
  };

  const onMove = event => {
    if (!pointers.has(event.pointerId) || !mode) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (mode === 'pinch' && pointers.size === 2) {
      write({ ...read(), cropZoom: pinchZoom(zoomStart, distance() / Math.max(1, pinchStart)) }, false);
      return;
    }
    if (mode !== 'pan' || !last) return;
    const box = measure?.() || element.getBoundingClientRect();
    const dx = event.clientX - last.x;
    const dy = event.clientY - last.y;
    last = { x: event.clientX, y: event.clientY };
    const state = read();
    const next = {
      ...state,
      cropX: panPercent(state.cropX, dx, box.width, state.cropZoom),
      cropY: panPercent(state.cropY, dy, box.height, state.cropZoom),
    };
    if (next.cropX !== state.cropX || next.cropY !== state.cropY) write(next, false);
  };

  const release = event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (pointers.size === 0) {
      const moved = mode !== null;
      mode = null;
      last = null;
      pinchStart = 0;
      if (moved) write(read(), true);
      return;
    }
    // Lifting one finger after a pinch continues as a pan from the finger that stayed.
    mode = 'pan';
    const [only] = [...pointers.values()];
    last = { x: only.x, y: only.y };
  };

  element.addEventListener('pointerdown', onDown);
  element.addEventListener('pointermove', onMove);
  element.addEventListener('pointerup', release);
  element.addEventListener('pointercancel', release);

  return {
    destroy() {
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerup', release);
      element.removeEventListener('pointercancel', release);
    },
  };
}
