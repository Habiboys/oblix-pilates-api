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
const { uploadFile, handleUploadError } = require('../middlewares/upload.middleware');
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
    uploadFile('galleries', true), // required untuk create
    handleUploadError,
    validate(createGallerySchema), 
    createGallery
);

router.put('/:id', 
    validateToken, 
    checkRole('admin'), 
    uploadFile('galleries', false), // optional untuk update
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