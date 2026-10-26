export function previewSize(width, height, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
export function idleTurn(callback) {
  return typeof requestIdleCallback === 'function' ? requestIdleCallback(callback, { timeout: 300 }) : setTimeout(callback, 16);
}
export function createIdlePainter(paint, schedule = idleTurn) {
  let generation = 0;
  return {
    enqueue(items) {
      const current = ++generation, queue = [...items];
      const next = () => {
        if (current !== generation || !queue.length) return;
        paint(queue.shift());
        if (queue.length) schedule(next);
      };
      if (queue.length) schedule(next);
    },
    cancel() { generation++; }
  };
}
