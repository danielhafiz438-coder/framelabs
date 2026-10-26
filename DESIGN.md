# FRAMELABS

Photo framing workspace, based on the user's four reference outputs. Keep the photograph dominant. No marketing landing page, login, ticket templates or video tools.

Dark charcoal workspace reduces surrounding light while judging photographs. Warm amber marks the selected template and download action. White frame is an output style, separate from the interface theme. Use local system sans-serif for controls and a local monospace font for photographic specifications; no remote fonts or image requests.

Mobile first: categorized gallery with a three-action dock, then a large photo editor. Five distinct bottom tools (Jenama, Teks & EXIF, Bingkai, Nisbah, Batch). Export options open from the top-right action; the actual export occurs in its panel. Settings open above the persistent toolbar so one tap switches tools. Preview resizes into the available space above the panel. No duplicate Theme/Height/Margin paths to the same settings. Touch targets are at least 44px, text inputs are 16px to avoid iOS focus zoom, focus returns when panels close, and inactive surfaces are inert.

Reference evidence: the user's supplied modern gallery/output screenshots and the four official [FrameCam App Store screenshots](https://apps.apple.com/us/app/framecam-retro-frames/id6480026789), reviewed 26 October 2026. Official screenshots establish categorized templates, a large editor photograph, a lower brand grid and top-right export. They show an older editor appearance than the user's gallery. Exact photo-picker transitions, gestures, export-result screens and current iOS behavior were not observed; do not claim a verified one-to-one clone.

Preview performance: use at most 1600px main-preview source and 640px cached batch sources. Decode batch thumbnails sequentially, share metadata promises, yield between thumbnail paints and cancel obsolete paint passes. Render template-gallery thumbnails when the gallery is shown. Focused batch navigation reuses the cached preview; exporting reopens the original source. Never export the small preview as the original-resolution output.

Output templates: Soft Frame (blur + square inner photo), On Photo (watermark), Rounded Blur (blur + rounded inner photo + dark lower area), Gallery White (white mat + specifications + camera name). Export uses the same renderer as preview and thumbnail.
