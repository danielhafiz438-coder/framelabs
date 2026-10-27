# FRAMELABS

Mobile-first framing editor with a fullscreen image studio, gallery-first template browser, floating controls and bottom-sheet settings. Includes four templates: Soft Frame, On Photo, Rounded Blur, Gallery White. No accounts, backend, analytics or runtime CDNs. Designed for GitHub Pages, including repository subpaths.

## FrameLabs v3: Unified Photo Studio

The workflow is now **template gallery → native multi-file picker → in-app selection review → unified editor → export**. The in-app selection review shows numbered imported thumbnails, an ordered tray, move-left/right controls, photo removal, image preview, selected count and original file sizes. The browser cannot browse iOS Recents without the system picker; only explicitly chosen local files appear in the review.

Both one-photo and multi-photo editing use the same preview and bottom toolbar. The top counter shows current/total, and horizontal swipe or arrow keys navigate photos. Use **✓ Batch** to manage the selected list. Choose **Semua foto** to apply edits globally or **Foto ini** to create a resettable photo-specific override (including text, EXIF and crop zoom/position). All images use the existing render engine, EXIF logic and local decoder.

**Export gambar** saves the active item from its full decoded source; **Export semua foto (ZIP)** processes all selected original inputs sequentially, applies the individual overrides, and produces a numbered ZIP with a report. RAW editing still relies on embedded JPEG previews, not full RAW demosaicing. Edits and batch photos remain local to this tab; the browser does not receive unattended access to the Photos library. Batch selections are not persisted across reload.

**Release:** development in `feat/unified-photo-studio-v3` via Pull Request #3; verify browser/mobile tests before merging to `main`.

## Run

Node.js 20+; npm install is required once to bundle the on-device HEIC/HEIF decoder.

```sh
npm install
npm run dev
npm run check
npm run build
node scripts/serve.mjs --dist
```

Open http://127.0.0.1:4173. `dist/` contains the deployable static site. `.github/workflows/pages.yml` validates, builds and deploys pushes to `main` after Pages is enabled with GitHub Actions as its source.

## Use

Choose a style from the gallery, select a photo, and use the five bottom tools: **Jenama**, **Teks & EXIF**, **Bingkai**, **Nisbah**, **Batch**. **Eksport** at the top right opens format/resolution options; **Download gambar** saves the result. Settings panels remain above the toolbar so tools can be switched without closing first. Preview stays above the panel, with visible progress and errors. On desktop the same studio provides wide-screen previews. Template settings are remembered separately. Camera information and captions follow the current photo across all four templates. Apple, DJI and Fujifilm logos are bundled locally; other brands use text. Upload a raster logo to use your own mark. No assets were extracted from the reference app.

The flow uses the user's screenshots and official FrameCam App Store screenshots as references. It is not verified against an installed iOS app; exact picker transitions, gestures and export-result screens remain unobserved. See DESIGN.md for the evidence boundary.

EXIF camera make/model, focal length, aperture, shutter and ISO are read locally when present. Missing metadata is left blank, never inferred from image pixels. Demo specifications are explicitly illustrative. The sample photograph is by [Sebastien Gabriel on Unsplash](https://unsplash.com/photos/landscape-photography-of-seashore-Hn-vG1gwbUk), used under the [Unsplash License](https://unsplash.com/license). It is bundled locally; opening the app does not contact Unsplash.

## Batch processing

Use **Banyak foto? Buka batch processing** below the preview, or **Pilih banyak foto** in the inspector. Select up to 30 files (300 MB combined, 40 MB for standard photos or 150 MB for RAW preview sources). Dropping multiple files also adds them to the batch. The queue can be edited before processing.

The current template, frame settings, caption, custom logo, format and resolution are captured when processing starts. **Auto EXIF setiap foto** reads each file independently and leaves missing camera values blank. **Guna maklumat editor untuk semua** explicitly applies the editor's camera values to every output. A batch never overwrites the editor's current photo or camera fields.

### Preview semua foto batch

Bila memilih banyak foto, FrameLabs menjana galeri thumbnail untuk **setiap fail** (sehingga had 30 foto), satu demi satu supaya telefon tidak perlu menyimpan semua decoder besar serentak. Thumbnail menggunakan frame, metadata mode, logo, nisbah dan tetapan suntingan semasa, bukan sekadar imej mentah. Tekan mana-mana thumbnail untuk lihat versi besar dalam editor, kemudian guna **sebelum / seterusnya** untuk semak satu demi satu. **Selesai** kembali ke foto biasa. Semua perubahan pada style dikongsi untuk batch; preview tidak mengubah fail asal atau menambah foto batch kepada simpanan kekal. Preview RAW menggunakan JPEG embedded yang tersedia; fail tidak boleh dinyahkod akan ditanda gagal pada kad.

Files are decoded and rendered sequentially. A corrupt or unsupported file is reported and skipped. Cancel stops after the current operation; completed outputs remain available in a partial ZIP. The ZIP contains individually named images and `batch-report.txt`; same-name input files cannot overwrite each other. Output total is capped at 150 MB; reduce resolution or batch size when reached. ZIP STORE avoids recompressing already-compressed PNG/JPEG data.

Batch files and result ZIP live only in memory for the current page session. They are not uploaded or saved to localStorage; only the selected metadata mode and existing editor settings persist. Reloading removes the batch queue and ZIP, keeping browser storage bounded.

## Storage and privacy

- All editing and export happen in the browser. The hosting server only serves static app files. User photos and logos are never transmitted by the app.
- The only application persistence is localStorage key `framelabs.project.v1`: four template settings, current template, raster logo, camera fields and a compact current-photo copy. No IndexedDB, cookies, remote database or user accounts.
- Saved photo copies are at most 2048 px and may be reduced further to fit storage. The original loaded photo stays in memory for export until the page closes. Reloaded projects use the saved copy. Originals on disk are never overwritten.
- Failed/quota-limited storage does not prevent editing or download; the UI reports unavailable persistence.
- GPS is not requested by the EXIF parser or written into exports. Text drawn onto the image is distinct from file EXIF: Canvas exports do not preserve the source EXIF.
- Storage belongs to this browser and origin, not a cloud account. Clearing browser data removes saved work. Preview and live deployment have separate storage.
- Clear local data via **Simpanan & privasi → Padam simpanan peranti**. Only the FRAMELABS key is removed.

## Limits

Import JPG, PNG, WebP and AVIF through native browser decoding. HEIC, HEIF and HIF open through native decoding when available and otherwise fall back to a bundled on-device heic-to decoder. RAW formats ARW, CR2, CR3, NEF, NRW, DNG, RAF, RW2, ORF, PEF, SRW, 3FR, IIQ, ERF and RAW are supported **only when a JPEG preview is embedded**; FrameLabs does not demosaic RAW sensor data, preserve full RAW editing latitude or guarantee support for every camera model. Standard input 40 MB; RAW input 150 MB; 96 MP decoded image limit. PNG/WebP preserve transparent outer corners where supported; JPEG fills them black. Exports cap the longest side at 4096 px to bound mobile canvas memory. Original aspect is the default; choosing another ratio center-crops the photo. HDR/RAW fidelity is not promised: Canvas export produces a newly rendered standard image. No RAW or HEIF export is offered.

## Verification

`npm run check` syntax-checks application modules and tests input validation, storage schema, EXIF formatting, crop/layout geometry and export limits. Browser QA covers real import/edit/export/restore, corrupt inputs and storage failures, desktop/mobile layouts and network locality. See `artifacts/verification.md` in the working checkout for the current run (not published).

## Third-party code

The exact `heic-to@1.6.6` decoder (LGPL-3.0-or-later) is installed during build and copied under `dist/vendor/heic-to/` for on-device HEIF decoding. The licence is copied into the distributable. The hosted application does not fetch decoders from third-party CDNs or upload photos.

`vendor/exifr-7.1.3.js` is the pinned unmodified exifr 7.1.3 UMD distribution, MIT licensed. License: `vendor/exifr-LICENSE.txt`. It is served locally; no runtime dependency fetch is required.

`assets/brands/` contains the Apple, DJI and Fujifilm vector icons from Simple Icons 15.21.0, distributed under CC0; license in that directory. Brand marks identify the selected camera; FRAMELABS is independent of those manufacturers. Bundled vectors are trusted static assets; user logo imports accept only raster images.
