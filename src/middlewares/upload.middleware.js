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
        const isLargeFile = fileSizeInMB > 3; // Compress jika > 3MB (dinaikkan dari 1MB)
        const isMediumFile = fileSizeInMB > 1; // Medium file 1-3MB

        let processedBuffer;

        if (isLargeFile) {
            // Compress dan resize untuk file besar (> 3MB)
            processedBuffer = await sharp(buffer)
                .resize(1920, 1920, { // Max width/height 1920px (dinaikkan dari 1200px)
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .webp({ 
                    quality: 90, // Quality 90% (dinaikkan dari 80%)
                    effort: 4 // Compression effort dikurangi untuk kualitas lebih baik
                })
                .toBuffer();
        } else if (isMediumFile) {
            // Compress ringan untuk file medium (1-3MB)
            processedBuffer = await sharp(buffer)
                .resize(1600, 1600, { // Max width/height 1600px
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .webp({ 
                    quality: 95, // Quality 95%
                    effort: 3 // Compression effort ringan
                })
                .toBuffer();
        } else {
            // Hanya convert ke WebP tanpa compress untuk file kecil (< 1MB)
            processedBuffer = await sharp(buffer)
                .webp({ 
                    quality: 100, // Quality 100% untuk file kecil
                    effort: 2 // Compression effort minimal
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
            fileSize: 10 * 1024 * 1024 // 10MB limit (dinaikkan dari 5MB)
        }
    });

    return (req, res, next) => {
        upload.single('picture')(req, res, async (err) => {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({
                        message: 'File size too large. Maximum size is 10MB'
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
                message: 'File size too large. Maximum size is 10MB'
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

// Middleware untuk upload multiple files dengan field names tertentu
const uploadMultipleFiles = (folder, fields) => {
    const upload = multer({
        storage: createStorage(folder),
        limits: {
            fileSize: 10 * 1024 * 1024 // 10MB limit
        },
        fileFilter: (req, file, cb) => {
            // Check file type
            const allowedTypes = /jpeg|jpg|png|gif|webp/;
            const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
            const mimeType = allowedTypes.test(file.mimetype);

            if (mimeType && extName) {
                return cb(null, true);
            } else {
                cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
            }
        }
    });

    return (req, res, next) => {
        upload.fields(fields)(req, res, async (err) => {
            if (err) {
                return handleUploadError(err, req, res, next);
            }

            // Process each uploaded file
            if (req.files) {
                try {
                    for (const fieldName in req.files) {
                        if (req.files[fieldName] && req.files[fieldName].length > 0) {
                            const file = req.files[fieldName][0];
                            const filename = await compressAndConvertToWebP(file.buffer, folder);
                            file.filename = filename;
                            file.path = `uploads/${folder}/${filename}`;
                        }
                    }
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

module.exports = {
    uploadFile,
    uploadMultipleFiles,
    handleUploadError
}; 