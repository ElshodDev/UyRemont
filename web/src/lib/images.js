// =============================================
// Rasmni yuklashdan oldin telefonda kichraytirish: mobil internetda tezroq va arzonroq.
// Qayta chizish EXIF (GPS) ni ham olib tashlaydi; server baribir yana tekshiradi va tozalaydi.
// =============================================

const MAX_SIDE = 1600;
const QUALITY = 0.85;

const loadBitmap = async (file) => {
  if (window.createImageBitmap) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // eski brauzerlar parametrni qo'llamaydi
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
};

/**
 * @param {File} file
 * @returns {Promise<Blob|File>} JPEG (kichraytirilgan) yoki ishlamasa asl fayl
 */
export async function downscaleImage(file) {
  try {
    const image = await loadBitmap(file);
    const width = image.width;
    const height = image.height;
    const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    image.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}
