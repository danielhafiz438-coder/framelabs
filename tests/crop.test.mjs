import test from 'node:test';
import assert from 'node:assert/strict';
import { ZOOM_MIN, ZOOM_MAX, panRange, panPercent, pinchZoom } from '../crop.js';

test('a photo at 100 percent zoom has no pan range', () => {
  assert.equal(panRange(400, 100), 0);
  assert.equal(panPercent(50, 160, 400, 100), 50);
  assert.equal(panPercent(50, -160, 400, 100), 50);
});

test('a drag across the pan range reaches both edges and the centre holds', () => {
  const view = 400, zoom = 200;
  assert.equal(panRange(view, zoom), 200);
  assert.equal(panPercent(50, 100, view, zoom), 0);
  assert.equal(panPercent(50, -100, view, zoom), 100);
  assert.equal(panPercent(50, 0, view, zoom), 50);
});

test('offset stays inside the photo however far the finger goes', () => {
  assert.equal(panPercent(50, 9999, 400, 300), 0);
  assert.equal(panPercent(50, -9999, 400, 300), 100);
  const quarter = panRange(400, 300) * 0.25;
  assert.ok(Math.abs(panPercent(40, -quarter, 400, 300) - 65) < 1e-9);
});

test('a wider zoom gives a longer pan range for the same view', () => {
  assert.ok(panRange(400, 300) > panRange(400, 200));
  assert.equal(Math.round(panRange(300, 300)), 200);
});

test('pinch clamps inside the zoom limits and ignores a broken scale', () => {
  assert.equal(pinchZoom(100, 2), 200);
  assert.equal(pinchZoom(100, 9), ZOOM_MAX);
  assert.equal(pinchZoom(200, 0.1), ZOOM_MIN);
  assert.equal(pinchZoom(150, Number.NaN), 150);
  assert.equal(pinchZoom(150, 0), 150);
  assert.equal(pinchZoom(undefined, 1), ZOOM_MIN);
});
