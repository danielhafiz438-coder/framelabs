# FRAMELABS

Photo framing editor with four output templates: Soft Frame, On Photo, Rounded Blur, Gallery White. No accounts, backend, analytics or runtime CDNs. Designed for GitHub Pages, including repository subpaths.

## Run

Node.js 20+; no dependency installation required.

```sh
npm run dev
npm run check
npm run build
node scripts/serve.mjs --dist
```

Open http://127.0.0.1:4173. `dist/` contains the deployable static site. `.github/workflows/pages.yml` validates, builds and deploys pushes to `main` after Pages is enabled with GitHub Actions as its source.

## Use

Choose a photo (or drop it into the window), select a template, edit the frame/brand/camera details and download PNG or JPEG. Template settings are remembered separately. Camera information and captions follow the current photo across all four templates. Apple, DJI and Fujifilm logos are bundled locally; other brands use text. Upload a raster logo to use your own mark. No assets were extracted from the reference app.

EXIF camera make/model, focal length, aperture, shutter and ISO are read locally when present. Missing metadata is left blank, never inferred from image pixels. Demo specifications are explicitly illustrative. The sample photograph is by [Sebastien Gabriel on Unsplash](https://unsplash.com/photos/landscape-photography-of-seashore-Hn-vG1gwbUk), used under the [Unsplash License](https://unsplash.com/license). It is bundled locally; opening the app does not contact Unsplash.

## Batch processing

Use **Banyak foto? Buka batch processing** below the preview, or **Pilih banyak foto** in the inspector. Select up to 30 files (300 MB combined, 40 MB per file). Dropping multiple files also adds them to the batch. The queue can be edited before processing.

The current template, frame settings, caption, custom logo, format and resolution are captured when processing starts. **Auto EXIF setiap foto** reads each file independently and leaves missing camera values blank. **Guna maklumat editor untuk semua** explicitly applies the editor's camera values to every output. A batch never overwrites the editor's current photo or camera fields.

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

JPEG, PNG and WebP; HEIC only where the browser's native image decoder supports it. A failed HEIC load prompts conversion to JPEG; there is no hidden remote converter. 40 MB / 96 MP import limit. PNG preserves transparent outer corners; JPEG fills them black. Exports cap the longest side at 4096 px to bound mobile canvas memory. Original aspect is the default; choosing another ratio center-crops the photo. HDR/RAW fidelity is not promised: Canvas export produces a newly rendered standard image.

## Verification

`npm run check` syntax-checks application modules and tests input validation, storage schema, EXIF formatting, crop/layout geometry and export limits. Browser QA covers real import/edit/export/restore, corrupt inputs and storage failures, desktop/mobile layouts and network locality. See `artifacts/verification.md` in the working checkout for the current run (not published).

## Third-party code

`vendor/exifr-7.1.3.js` is the pinned unmodified exifr 7.1.3 UMD distribution, MIT licensed. License: `vendor/exifr-LICENSE.txt`. It is served locally; no runtime dependency fetch is required.

`assets/brands/` contains the Apple, DJI and Fujifilm vector icons from Simple Icons 15.21.0, distributed under CC0; license in that directory. Brand marks identify the selected camera; FRAMELABS is independent of those manufacturers. Bundled vectors are trusted static assets; user logo imports accept only raster images.
