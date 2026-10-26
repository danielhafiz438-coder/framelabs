export const BATCH_LIMIT = 30;
export const BATCH_INPUT_LIMIT = 300 * 1024 * 1024;
export const BATCH_OUTPUT_LIMIT = 150 * 1024 * 1024;

export function validatePhotoFile(file) {
  if (!/\.(jpe?g|png|webp|avif|heic|heif|hif|arw|cr2|cr3|nef|nrw|dng|raf|rw2|orf|pef|srw|3fr|iiq|erf|raw)$/i.test(file.name)) throw new Error('Format tidak disokong. Cuba JPG, PNG, WebP, AVIF, HEIF atau RAW kamera.');
  const limit = /\.(arw|cr2|cr3|nef|nrw|dng|raf|rw2|orf|pef|srw|3fr|iiq|erf|raw)$/i.test(file.name) ? 150 : 40;
  if (!file.size || file.size > limit * 1024 * 1024) throw new Error('Saiz fail mesti antara 1 bait hingga '+limit+' MB.');
}

export function batchSettings(base, metadata, mode) {
  return mode === 'editor' ? { ...base } : { ...base, ...metadata };
}

export function outputName(name, index, template, format) {
  const stem = Array.from(name.replace(/\.[^.]*$/, '').replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '-').replace(/^\.+/, '').trim()).slice(0, 70).join('') || 'foto';
  return `${String(index + 1).padStart(3, '0')}-${stem}-${template}.${format === 'jpeg' ? 'jpg' : format === 'webp' ? 'webp' : 'png'}`;
}

const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// PNG/JPEG are already compressed; ZIP STORE avoids a second compression pass on mobile.
export async function createZip(entries) {
  if (!entries.length || entries.length > BATCH_LIMIT + 1) throw new Error('Bilangan fail ZIP tidak sah.');
  const parts = [], central = [], names = new Set(), encoder = new TextEncoder();
  let offset = 0, centralSize = 0, total = 0;
  for (const entry of entries) {
    if (!entry.name || /[/\\\u0000-\u001f]/.test(entry.name) || names.has(entry.name)) throw new Error('Nama fail ZIP tidak sah atau berulang.');
    names.add(entry.name);
    total += entry.blob.size;
    if (total > BATCH_OUTPUT_LIMIT + 1024 * 1024) throw new Error('ZIP terlalu besar. Kurangkan bilangan foto atau resolusi.');
    const name = encoder.encode(entry.name), data = new Uint8Array(await entry.blob.arrayBuffer());
    if (name.length > 65535) throw new Error('Nama fail terlalu panjang.');
    const crc = crc32(data), header = new Uint8Array(30 + name.length), h = new DataView(header.buffer);
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);
    h.setUint16(12, 33, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
    h.setUint16(26, name.length, true); header.set(name, 30);
    const record = new Uint8Array(46 + name.length), c = new DataView(record.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint16(14, 33, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true); c.setUint32(42, offset, true); record.set(name, 46);
    parts.push(header, entry.blob); central.push(record); offset += header.length + data.length; centralSize += record.length;
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  const end = new Uint8Array(22), e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, entries.length, true); e.setUint16(10, entries.length, true);
  e.setUint32(12, centralSize, true); e.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}
