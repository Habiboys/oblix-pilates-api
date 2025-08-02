const express = require('express');
const router = express.Router();
const { 
    uploadContentImage, 
    getAllContentImages, 
    deleteContentImage 
} = require('../controllers/upload.controller');
const { validateToken, checkRole } = require('../middlewares/auth.middleware');
const { uploadFile, handleUploadError } = require('../middlewares/upload.middleware');

// Upload content image (untuk blog content)
router.post('/content-image', 
    validateToken, 
    checkRole('admin'), 
    uploadFile('content-images', true), // required untuk upload
    handleUploadError,
    uploadContentImage
);

// Get all content images (untuk gallery picker)
router.get('/content-images', 
    validateToken, 
    checkRole('admin'), 
    getAllContentImages
);

// Delete content image
router.delete('/content-image/:filename', 
    validateToken, 
    checkRole('admin'), 
    deleteContentImage
);

module.exports = router; 