export const BATCH_LIMIT = 1000;
export const BATCH_INPUT_LIMIT = 100 * 1024 * 1024 * 1024;
export const BATCH_OUTPUT_LIMIT = 100 * 1024 * 1024 * 1024;

export function validatePhotoFile(file) {
  if (!/\.(jpe?g|png|webp|avif|heic|heif|hif|arw|cr2|cr3|nef|nrw|dng|raf|rw2|orf|pef|srw|3fr|iiq|erf|raw)$/i.test(file.name)) throw new Error('Format tidak disokong. Cuba JPG, PNG, WebP, AVIF, HEIF atau RAW kamera.');
  if (!file.size || file.size > BATCH_INPUT_LIMIT) throw new Error('Saiz fail mesti antara 1 bait hingga 100 GB.');
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
    if (total > BATCH_OUTPUT_LIMIT + 1024 * 1024) throw new Error('ZIP melebihi had 100 GB.');
    const name = encoder.encode(entry.name);
    if (name.length > 65535) throw new Error('Nama fail terlalu panjang.');
    let crc = 0xffffffff;
    for (let at = 0; at < entry.blob.size; at += 16 * 1024 * 1024) {
      const chunk = new Uint8Array(await entry.blob.slice(at, at + 16 * 1024 * 1024).arrayBuffer());
      for (const byte of chunk) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const size = entry.blob.size, header = new Uint8Array(50 + name.length), h = new DataView(header.buffer);
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 45, true); h.setUint16(6, 0x0800, true);
    h.setUint16(12, 33, true); h.setUint32(14, crc, true); h.setUint32(18, 0xffffffff, true); h.setUint32(22, 0xffffffff, true);
    h.setUint16(26, name.length, true); h.setUint16(28, 20, true); header.set(name, 30);
    h.setUint16(30 + name.length, 0x0001, true); h.setUint16(32 + name.length, 16, true);
    h.setBigUint64(34 + name.length, BigInt(size), true); h.setBigUint64(42 + name.length, BigInt(size), true);
    const record = new Uint8Array(74 + name.length), c = new DataView(record.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 45, true); c.setUint16(6, 45, true); c.setUint16(8, 0x0800, true);
    c.setUint16(14, 33, true); c.setUint32(16, crc, true); c.setUint32(20, 0xffffffff, true); c.setUint32(24, 0xffffffff, true);
    c.setUint16(28, name.length, true); c.setUint16(30, 28, true); c.setBigUint64(50 + name.length, BigInt(size), true);
    c.setBigUint64(58 + name.length, BigInt(size), true); c.setBigUint64(66 + name.length, BigInt(offset), true);
    c.setUint16(46 + name.length, 0x0001, true); c.setUint16(48 + name.length, 24, true); record.set(name, 46);
    parts.push(header, entry.blob); central.push(record); offset += header.length + size; centralSize += record.length;
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  const zip64Offset = offset, zip64 = new Uint8Array(56), z = new DataView(zip64.buffer);
  z.setUint32(0, 0x06064b50, true); z.setBigUint64(4, 44n, true); z.setUint16(12, 45, true); z.setUint16(14, 45, true);
  z.setBigUint64(24, BigInt(entries.length), true); z.setBigUint64(32, BigInt(entries.length), true);
  z.setBigUint64(40, BigInt(centralSize), true); z.setBigUint64(48, BigInt(offset), true);
  const locator = new Uint8Array(20), l = new DataView(locator.buffer);
  l.setUint32(0, 0x07064b50, true); l.setBigUint64(8, BigInt(zip64Offset + centralSize), true); l.setUint32(16, 1, true);
  const end = new Uint8Array(22), e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, 0xffff, true); e.setUint16(10, 0xffff, true);
  e.setUint32(12, 0xffffffff, true); e.setUint32(16, 0xffffffff, true);
  return new Blob([...parts, ...central, zip64, locator, end], { type: 'application/zip' });
}
