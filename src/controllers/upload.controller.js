const path = require('path');
const fs = require('fs');
const logger = require('../config/logger');

// Upload content image (untuk blog content)
const uploadContentImage = async (req, res) => {
    try {
        logger.info('📸 Starting content image upload...');

        if (!req.file) {
            logger.warn('❌ No file uploaded');
            return res.status(400).json({
                status: 'error',
                message: 'Tidak ada file yang diupload'
            });
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(req.file.mimetype)) {
            logger.warn('❌ Invalid file type:', req.file.mimetype);
            // Delete uploaded file
            const filePath = path.join(__dirname, '../../uploads/content-images/', req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            return res.status(400).json({
                status: 'error',
                message: 'Tipe file tidak didukung. Gunakan JPEG, PNG, GIF, atau WebP'
            });
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (req.file.size > maxSize) {
            logger.warn('❌ File too large:', req.file.size);
            // Delete uploaded file
            const filePath = path.join(__dirname, '../../uploads/content-images/', req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            return res.status(400).json({
                status: 'error',
                message: 'Ukuran file terlalu besar. Maksimal 5MB'
            });
        }

        // Generate URL untuk akses gambar
        const imageUrl = `/uploads/content-images/${req.file.filename}`;
        
        logger.info('✅ Content image uploaded successfully:', {
            filename: req.file.filename,
            size: req.file.size,
            mimetype: req.file.mimetype,
            url: imageUrl
        });

        res.status(200).json({
            status: 'success',
            message: 'Gambar berhasil diupload',
            data: {
                filename: req.file.filename,
                originalName: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype,
                url: imageUrl,
                fullUrl: `${req.protocol}://${req.get('host')}${imageUrl}`
            }
        });
    } catch (error) {
        logger.error('❌ Upload content image error:', error);
        
        // Delete uploaded file if error occurs
        if (req.file) {
            const filePath = path.join(__dirname, '../../uploads/content-images/', req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        
        res.status(500).json({
            status: 'error',
            message: 'Terjadi kesalahan pada server'
        });
    }
};

// Get all content images (untuk gallery picker)
const getAllContentImages = async (req, res) => {
    try {
        logger.info('🖼️ Getting all content images...');

        const uploadDir = path.join(__dirname, '../../uploads/content-images/');
        
        // Check if directory exists
        if (!fs.existsSync(uploadDir)) {
            logger.info('📁 Content images directory does not exist, creating...');
            fs.mkdirSync(uploadDir, { recursive: true });
            return res.status(200).json({
                status: 'success',
                message: 'Belum ada gambar content',
                data: {
                    images: [],
                    total: 0
                }
            });
        }

        // Read all files in directory
        const files = fs.readdirSync(uploadDir);
        const imageFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
        });

        // Get file stats for each image
        const images = imageFiles.map(filename => {
            const filePath = path.join(uploadDir, filename);
            const stats = fs.statSync(filePath);
            const imageUrl = `/uploads/content-images/${filename}`;
            
            return {
                filename,
                url: imageUrl,
                fullUrl: `${req.protocol}://${req.get('host')}${imageUrl}`,
                size: stats.size,
                createdAt: stats.birthtime,
                modifiedAt: stats.mtime
            };
        });

        // Sort by creation date (newest first)
        images.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        logger.info(`✅ Retrieved ${images.length} content images`);

        res.status(200).json({
            status: 'success',
            message: 'Daftar gambar content berhasil diambil',
            data: {
                images,
                total: images.length
            }
        });
    } catch (error) {
        logger.error('❌ Get content images error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Terjadi kesalahan pada server'
        });
    }
};

// Delete content image
const deleteContentImage = async (req, res) => {
    try {
        const { filename } = req.params;
        
        logger.info('🗑️ Deleting content image:', filename);

        if (!filename) {
            return res.status(400).json({
                status: 'error',
                message: 'Nama file diperlukan'
            });
        }

        const filePath = path.join(__dirname, '../../uploads/content-images/', filename);
        
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            logger.warn('❌ File not found:', filename);
            return res.status(404).json({
                status: 'error',
                message: 'File tidak ditemukan'
            });
        }

        // Delete file
        fs.unlinkSync(filePath);
        
        logger.info('✅ Content image deleted successfully:', filename);

        res.status(200).json({
            status: 'success',
            message: 'Gambar berhasil dihapus'
        });
    } catch (error) {
        logger.error('❌ Delete content image error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Terjadi kesalahan pada server'
        });
    }
};

module.exports = {
    uploadContentImage,
    getAllContentImages,
    deleteContentImage
}; 