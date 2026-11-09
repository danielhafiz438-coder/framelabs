import { STORAGE_KEY, parseProject } from './core.js';

// A stored photo copy expires so a browser left open on a shared machine
// stops holding someone else's photograph.
export const PHOTO_TTL_MS = 10 * 60 * 1000;
const PHOTO_MAX = 2300000;
const LOGO_MAX = 650000;
const IMAGE_DATA = /^data:image\/(?:jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/;

const isImage = (text, max) => typeof text === 'string' && text.length <= max && IMAGE_DATA.test(text);

export function createProjectStore(storage, now = () => Date.now()) {
  const photoKey = `${STORAGE_KEY}.photo`;
  const logoKey = `${STORAGE_KEY}.logo`;
  let lastPhoto = null;
  let lastLogo = null;
  let expiresAt = null;

  const dropPhoto = () => {
    try { storage.removeItem(photoKey); } catch { /* Nothing stored, nothing to remove. */ }
    lastPhoto = null;
    expiresAt = null;
    try {
      const record = JSON.parse(storage.getItem(STORAGE_KEY));
      if (record && typeof record === 'object') storage.setItem(STORAGE_KEY, JSON.stringify({ ...record, photoExpiresAt: null }));
    } catch { /* A missing or broken settings record needs no repair. */ }
  };

  return {
    get photoExpiresAt() { return lastPhoto ? expiresAt : null; },

    restore() {
      const raw = storage.getItem(STORAGE_KEY);
      const saved = parseProject(raw);
      if (!saved) return null;
      let stamp = 0;
      try { stamp = Number(JSON.parse(raw).photoExpiresAt); } catch { /* Older records carry no deadline. */ }
      expiresAt = Number.isFinite(stamp) && stamp > 0 ? stamp : null;
      lastPhoto = storage.getItem(photoKey);
      lastLogo = storage.getItem(logoKey);
      if (lastPhoto !== null) {
        const fresh = !expiresAt || now() < expiresAt;
        if (fresh && isImage(lastPhoto, PHOTO_MAX)) saved.photo = lastPhoto;
        else { dropPhoto(); saved.photo = null; }
      }
      if (lastLogo !== null) saved.logo = isImage(lastLogo, LOGO_MAX) ? lastLogo : null;
      return saved;
    },

    save(project) {
      let assetsSaved = true;
      if (project.photo !== lastPhoto) {
        if (project.photo == null) dropPhoto();
        else {
          try {
            storage.setItem(photoKey, project.photo);
            lastPhoto = project.photo;
            expiresAt = now() + PHOTO_TTL_MS;
          } catch { assetsSaved = false; lastPhoto = null; expiresAt = null; }
        }
      }
      if (project.logo !== lastLogo) {
        try {
          if (project.logo == null) storage.removeItem(logoKey);
          else storage.setItem(logoKey, project.logo);
          lastLogo = project.logo;
        } catch { assetsSaved = false; }
      }
      const record = { ...project, photo: null, logo: null, photoExpiresAt: lastPhoto ? expiresAt : null };
      try { storage.setItem(STORAGE_KEY, JSON.stringify(record)); }
      catch { return 'unavailable'; }
      return assetsSaved ? 'full' : 'settings';
    },

    clearPhoto() { dropPhoto(); },

    clear() {
      for (const key of [STORAGE_KEY, photoKey, logoKey]) storage.removeItem(key);
      lastPhoto = null;
      lastLogo = null;
      expiresAt = null;
    },
  };
}
