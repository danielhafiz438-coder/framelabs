# FRAMELABS

Photo framing workspace built from the user's reference outputs. Keep the photograph dominant. No marketing landing page, login, ticket templates or video tools.

Dial: ENERGY 1 / RHYTHM 1 / MOTION 2.

## Surface and colour

Dark charcoal workspace reduces surrounding light while judging photographs. Warm amber marks the selected item and the primary action. White frame is an output style, separate from the interface theme. Local system sans-serif for controls, local monospace for photographic specifications. No remote fonts or image requests.

Palette: charcoal `#111110`, surface `#1a1a18`, raised `#232320`, amber `#e7bb79`, text `#f2f2ee`, muted `#a5a59c`. Hairlines are white at 9 percent. Three surfaces, one accent, nothing else.

## Structure

Mobile first. One photograph, one settings sheet, one frame switcher.

- Frame chips sit under the top bar. They are the only way to change the template, so the choice is one tap and the main canvas is its own preview.
- **Tetapan** opens from the top-bar sliders button and lands on three essentials: Nisbah, Ketebalan and frame colour.
- **Lanjutan** collapses everything else (corners, blur, identity, camera, export options, batch, storage). The sheet therefore opens at roughly 480 px instead of a 2300 px scroll.
- Below 1000 px that panel is a bottom sheet; from 1000 px up it docks as a right-hand column (`grid-template-columns: minmax(0,1fr) var(--panel-w)`), loses the grabber, the close button and the top-bar toggle, and no longer takes the pointer away from the preview. Same DOM, same engine state.

The photo stepper (`1 / 3`, arrows, Tutup) only appears for two or more photos; a single photo keeps the plain editor. No bottom navigation, no favourites list, no tool strip. No second path to the same setting: the top-right **Eksport** pill is the only export action, and the export section only holds format, size and quality.

## Crop

Crop is direct manipulation on the canvas: drag to move the photograph, pinch to zoom, reset from the settings sheet. No axis sliders. The gesture writes the same `cropX`, `cropY`, `cropZoom` values the renderer reads, so preview and export cannot disagree.

## Apple-derived rules

These are adopted because this is a touch-first tool for photographs, not as decoration:

- Translucent top bar (`backdrop-filter`), so the photograph reads as the surface beneath the interface.
- Sheets slide from the bottom with a grabber, a close control and a 0.38s curve (`cubic-bezier(.32,.72,0,1)`); content is visible from the first frame, not after the animation.
- 44px minimum touch targets, 16px text inputs to avoid iOS focus zoom, visible focus rings, inert inactive surfaces, focus returned when a sheet closes.
- Depth comes from one hairline and one shadow, not from stacked borders.
- Reduced motion and reduced transparency are honoured; both fall back to opacity and solid surfaces.

## Storage

Settings, logo and one compact photo copy (max 2048 px) live in localStorage. The photo copy is deleted ten minutes after it is saved, and on any load where that deadline has passed; settings survive. The copy is what a reload can restore, and the reason the deadline exists.

## Preview and export performance

At most a 1600px main-preview source and 512px cached batch sources. Decode batch thumbnails sequentially, share metadata promises, yield between thumbnail paints and cancel obsolete paint passes. The frame chips render nothing: the single preview is the preview. Focused batch navigation reuses the cached preview; exporting reopens the original source. Never export the small preview as the original-resolution output.

## Frames

Soft Frame (blurred photograph as the mat), On Photo (text over the photograph, no mat), Gallery White (white mat with specifications and camera name). Rounded Blur was removed: it was Soft Frame with a different inner radius, reachable from the same controls.

Export uses the same renderer as preview and thumbnail.
