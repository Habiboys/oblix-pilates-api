const multer = require('multer');
const path = require('path');
const sharp = require('sharp');
const fs = require('fs');

// Konfigurasi storage universal dengan memory storage untuk processing
const createStorage = (folder) => {
    return multer.memoryStorage();
};

// Fungsi untuk compress dan convert ke WebP
const compressAndConvertToWebP = async (buffer, folder) => {
    try {
        const fileSizeInMB = buffer.length / (1024 * 1024);
        const isLargeFile = fileSizeInMB > 1; // Compress jika > 1MB

        let processedBuffer;

        if (isLargeFile) {
            // Compress dan resize untuk file besar (> 1MB)
            processedBuffer = await sharp(buffer)
                .resize(1200, 1200, { // Max width/height 1200px
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .webp({ 
                    quality: 80, // Quality 80%
                    effort: 6 // Compression effort
                })
                .toBuffer();
        } else {
            // Hanya convert ke WebP tanpa compress untuk file kecil (< 1MB)
            processedBuffer = await sharp(buffer)
                .webp({ 
                    quality: 100, // Quality 100% untuk file kecil
                    effort: 6
                })
                .toBuffer();
        }

        // Generate nama file unik
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = `${folder}-${uniqueSuffix}.webp`;
        
        // Pastikan folder exists
        const uploadDir = `uploads/${folder}`;
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Simpan file
        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, processedBuffer);

        return filename;
    } catch (error) {
        throw new Error('Failed to process image: ' + error.message);
    }
};

// Filter file yang diizinkan
const fileFilter = (req, file, cb) => {
    // Izinkan hanya gambar
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

// Middleware upload universal - hanya menggunakan field 'picture'
const uploadFile = (folder, required = false) => {
    const storage = createStorage(folder);
    const upload = multer({
        storage: storage,
        fileFilter: fileFilter,
        limits: {
            fileSize: 5 * 1024 * 1024 // 5MB limit
        }
    });

    return (req, res, next) => {
        upload.single('picture')(req, res, async (err) => {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({
                        message: 'File size too large. Maximum size is 5MB'
                    });
                }
                return res.status(400).json({
                    message: 'Upload error: ' + err.message
                });
            } else if (err) {
                return res.status(400).json({
                    message: err.message
                });
            }
            
            // Jika required dan tidak ada file, return error
            if (required && !req.file) {
                return res.status(400).json({
                    message: 'Picture is required'
                });
            }

            // Jika ada file, compress dan convert ke WebP
            if (req.file) {
                try {
                    const filename = await compressAndConvertToWebP(req.file.buffer, folder);
                    req.file.filename = filename;
                    req.file.path = `uploads/${folder}/${filename}`;
                } catch (error) {
                    return res.status(400).json({
                        message: error.message
                    });
                }
            }
            
            next();
        });
    };
};

// Middleware untuk handle error upload
const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                message: 'File size too large. Maximum size is 5MB'
            });
        }
        return res.status(400).json({
            message: 'Upload error: ' + err.message
        });
    } else if (err) {
        return res.status(400).json({
            message: err.message
        });
    }
    next();
};

module.exports = {
    uploadFile,
    handleUploadError
}; 