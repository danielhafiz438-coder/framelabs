# FRAMELABS

Photo framing workspace built from the user's reference outputs. Keep the photograph dominant. No marketing landing page, login, ticket templates or video tools.

Dial: ENERGY 1 / RHYTHM 1 / MOTION 2.

## Surface and colour

Dark charcoal workspace reduces surrounding light while judging photographs. Warm amber marks the selected item and the primary action. White frame is an output style, separate from the interface theme. Local system sans-serif for controls, local monospace for photographic specifications. No remote fonts or image requests.

Palette: charcoal `#111110`, surface `#1a1a18`, raised `#232320`, amber `#e7bb79`, text `#f2f2ee`, muted `#a5a59c`. Hairlines are white at 9 percent. Three surfaces, one accent, nothing else.

## Structure

Mobile first. One photograph, one settings sheet, one floating dock.

- **The dock** (`nav.dock`) is the only navigation: **Foto**, **Asal**, **Eksport** (raised disc), **Tetapan**, **Batch**. It floats over the bottom safe area as a single glass capsule, so every action is one thumb away instead of a top-right cluster. It is the one glass surface besides the top bar (two materials, both chrome over content).
- **Eksport** is the centre disc, solid amber, lifted so its centre sits on the bar's top edge: the primary action is the nearest target to a thumb and the only solid accent on screen. On a pointer viewport (≥1000 px) the dock goes level and the disc shrinks to a 40 px glyph, because reach is no longer the constraint.
- **Asal** (compare with the unframed photo) sits in the dock rather than next to the frame chips: it is a view state, and it reports `aria-pressed` like any other toggle. It used to read "Sebelum", which looked like a fourth frame preset.
- **Tetapan** opens the sheet and carries `aria-expanded`; the dock item shows the same translucent bubble when the sheet is open.
- **Batch** borrows the review grid when two or more photos are queued and opens the file picker otherwise. Its badge shows the real queue count, never a placeholder.
- **Frame chips** stay under the top bar in one segmented capsule, one tap to switch, because the frame is the most changed setting in the app.
- **Tetapan** lands on three essentials: Nisbah, Ketebalan and frame colour. **Lanjutan** collapses everything else (corners, blur, identity, camera, export options, batch, storage), so the sheet opens at roughly 480 px instead of a 2300 px scroll.
- The sheet **parks above the dock** instead of sliding under it: `bottom: calc(var(--dock-h) + 16px + env(safe-area-inset-bottom))`. The two surfaces never occlude each other, and the preview above the sheet stays visible.
- The sheet can be **swiped down from the grabber**. The drag writes one custom property (`--sheet-drag`), so release continues into the same 0.38s curve the open transition uses and nothing jumps.
- Below 1000 px that panel is a bottom sheet; from 1000 px up it docks as a right-hand column (`grid-template-columns: minmax(0,1fr) var(--panel-w)`), loses the grabber, the close button and the dock's Tetapan slot, and no longer takes the pointer away from the preview. Same DOM, same engine state.

The photo stepper (`1 / 7`, arrows, Tutup) only appears for two or more photos and sits above the dock. A single photo keeps the plain editor. No favourites list, no tool strip. No second path to the same setting: the dock disc is the only export action, and the export section only holds format, size and quality.

## Reference

The floating capsule dock, the raised centre action and the translucent bubble behind an active item come from a Dribbble bottom-navigation shot the owner supplied. Borrowed: the geometry and the material logic. Not borrowed: its casino palette, its five-item contents and its glow, because this app is a quiet photo tool, not a product page.


## Crop

Crop is direct manipulation on the canvas: drag to move the photograph, pinch to zoom, reset from the settings sheet. No axis sliders. The gesture writes the same `cropX`, `cropY`, `cropZoom` values the renderer reads, so preview and export cannot disagree.

## Apple-derived rules

These are adopted because this is a touch-first tool for photographs, not as decoration:

- Translucent top bar (`backdrop-filter`), so the photograph reads as the surface beneath the interface.
- Sheets rise above the dock with a grabber, a close control and a 0.38s curve (`cubic-bezier(.32,.72,0,1)`); content is visible from the first frame, not after the animation. The grabber drives the same curve on the way down, so a swipe never snaps.
- 44px minimum touch targets, 16px text inputs to avoid iOS focus zoom, visible focus rings, inert inactive surfaces, focus returned to the dock control when a sheet closes.
- Depth comes from one hairline and one shadow, not from stacked borders. The photo card gets one ring plus one shadow; nothing else in the editor lifts.
- Reduced motion and reduced transparency are honoured; both fall back to opacity and solid surfaces.

## Storage

Settings, logo and one compact photo copy (max 2048 px) live in localStorage. The photo copy is deleted ten minutes after it is saved, and on any load where that deadline has passed; settings survive. The copy is what a reload can restore, and the reason the deadline exists.

## Preview and export performance

At most a 1600px main-preview source and 512px cached batch sources. Decode batch thumbnails sequentially, share metadata promises, yield between thumbnail paints and cancel obsolete paint passes. The frame chips render nothing: the single preview is the preview. Focused batch navigation reuses the cached preview; exporting reopens the original source. Never export the small preview as the original-resolution output.

## Frames

Soft Frame (blurred photograph as the mat), On Photo (text over the photograph, no mat), Gallery White (white mat with specifications and camera name). Rounded Blur was removed: it was Soft Frame with a different inner radius, reachable from the same controls.

Export uses the same renderer as preview and thumbnail.
