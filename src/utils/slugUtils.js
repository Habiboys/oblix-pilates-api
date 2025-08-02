/**
 * Generate slug dari title
 * @param {string} title - Judul blog
 * @returns {string} - Slug yang sudah di-generate
 */
const generateSlug = (title) => {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Hapus karakter khusus kecuali spasi dan dash
    .replace(/[\s_-]+/g, '-') // Ganti spasi dan underscore dengan dash
    .replace(/^-+|-+$/g, ''); // Hapus dash di awal dan akhir
};

/**
 * Generate unique slug dengan menambahkan angka jika slug sudah ada
 * @param {string} title - Judul blog
 * @param {Function} checkSlugExists - Function untuk cek apakah slug sudah ada
 * @returns {Promise<string>} - Slug yang unik
 */
const generateUniqueSlug = async (title, checkSlugExists) => {
  let slug = generateSlug(title);
  let counter = 1;
  let uniqueSlug = slug;

  while (await checkSlugExists(uniqueSlug)) {
    uniqueSlug = `${slug}-${counter}`;
    counter++;
  }

  return uniqueSlug;
};

module.exports = {
  generateSlug,
  generateUniqueSlug
}; 