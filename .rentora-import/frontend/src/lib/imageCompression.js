import imageCompression from 'browser-image-compression';

/**
 * Compresses an image in the browser before it ever reaches Supabase Storage.
 * Supabase image transformations (?width=&quality=) are a paid-plan feature, so
 * we keep stored files small at the source instead of relying on them.
 */
export async function compressImage(file, options = {}) {
  if (!file || !file.type || !file.type.startsWith('image/')) return file;
  // Nothing to gain on tiny files or formats the compressor can't re-encode well.
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  if (file.size <= 150 * 1024) return file;

  const settings = {
    maxSizeMB: 0.6,
    maxWidthOrHeight: 1600,
    initialQuality: 0.75,
    useWebWorker: true,
    fileType: 'image/webp',
    ...options,
  };

  try {
    const compressed = await imageCompression(file, settings);
    if (compressed.size >= file.size) return file;
    const ext = (settings.fileType || file.type).split('/')[1] || 'jpg';
    const baseName = (file.name || 'image').replace(/\.[^.]+$/, '');
    return new File([compressed], `${baseName}.${ext}`, {
      type: compressed.type,
      lastModified: Date.now(),
    });
  } catch (e) {
    console.warn('Image compression failed, uploading original:', e?.message);
    return file;
  }
}
