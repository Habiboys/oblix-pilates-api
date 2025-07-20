const multer = require('multer');
const path = require('path');

// Konfigurasi storage universal
const createStorage = (folder, prefix) => {
    return multer.diskStorage({
    destination: function (req, file, cb) {
            cb(null, `uploads/${folder}/`);
    },
    filename: function (req, file, cb) {
        // Generate nama file unik dengan timestamp
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, `${prefix}-${uniqueSuffix}${path.extname(file.originalname)}`);
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

// Fungsi universal untuk membuat upload middleware
const createUploadMiddleware = (folder, prefix, fieldName) => {
    const storage = createStorage(folder, prefix);
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});
    return upload.single(fieldName);
};

// Middleware universal untuk upload gambar
const uploadPicture = (folder, prefix = 'image', fieldName = 'picture') => {
    return createUploadMiddleware(folder, prefix, fieldName);
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

// Backward compatibility - middleware khusus yang sudah ada
const uploadProfilePhoto = uploadPicture('profiles', 'profile', 'profile_picture');
const uploadTrainerPicture = uploadPicture('trainers', 'trainer', 'picture');

module.exports = {
    uploadPicture,
    uploadProfilePhoto,
    uploadTrainerPicture,
    handleUploadError
}; 