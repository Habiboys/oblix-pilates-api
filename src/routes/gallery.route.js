const express = require('express');
const router = express.Router();
const { 
    getAllGalleries, 
    getGalleryById, 
    createGallery, 
    updateGallery, 
    deleteGallery 
} = require('../controllers/gallery.controller');
const { validateToken, checkRole } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validation.middleware');
const { uploadPicture, handleUploadError } = require('../middlewares/upload.middleware');
const { 
    createGallerySchema, 
    updateGallerySchema, 
    getGallerySchema 
} = require('../validations/gallery.validation');

// Public routes - semua user bisa akses
router.get('/', getAllGalleries);
router.get('/:id', validate(getGallerySchema, 'params'), getGalleryById);

// Admin only routes - hanya admin yang bisa create, update, delete
router.post('/', 
    validateToken, 
    checkRole('admin'), 
    uploadPicture('galleries', 'gallery', 'picture'),
    handleUploadError,
    validate(createGallerySchema), 
    createGallery
);

router.put('/:id', 
    validateToken, 
    checkRole('admin'), 
    uploadPicture('galleries', 'gallery', 'picture'),
    handleUploadError,
    validate(getGallerySchema, 'params'),
    validate(updateGallerySchema), 
    updateGallery
);

router.delete('/:id', 
    validateToken, 
    checkRole('admin'), 
    validate(getGallerySchema, 'params'),
    deleteGallery
);

module.exports = router; 