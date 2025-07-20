const multer = require('multer');
const path = require('path');

// Konfigurasi storage universal
const createStorage = (folder) => {
    return multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, `uploads/${folder}/`);
        },
        filename: function (req, file, cb) {
            // Generate nama file unik dengan timestamp
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, `${folder}-${uniqueSuffix}${path.extname(file.originalname)}`);
        }
    });
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
        upload.single('picture')(req, res, (err) => {
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