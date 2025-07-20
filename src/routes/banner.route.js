const express = require('express');
const router = express.Router();
const { 
    getAllBanners, 
    getBannerById, 
    createBanner, 
    updateBanner, 
    deleteBanner 
} = require('../controllers/banner.controller');
const { validateToken, checkRole } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validation.middleware');
const { uploadFile, handleUploadError } = require('../middlewares/upload.middleware');
const { 
    createBannerSchema, 
    updateBannerSchema, 
    getBannerSchema 
} = require('../validations/banner.validation');

// Public routes - semua user bisa akses
router.get('/', getAllBanners);
router.get('/:id', validate(getBannerSchema, 'params'), getBannerById);

// Admin only routes - hanya admin yang bisa create, update, delete
router.post('/', 
    validateToken, 
    checkRole('admin'), 
    uploadFile('banners', true), // required untuk create
    handleUploadError,
    validate(createBannerSchema), 
    createBanner
);

router.put('/:id', 
    validateToken, 
    checkRole('admin'), 
    uploadFile('banners', false), // optional untuk update
    handleUploadError,
    validate(getBannerSchema, 'params'),
    validate(updateBannerSchema), 
    updateBanner
);

router.delete('/:id', 
    validateToken, 
    checkRole('admin'), 
    validate(getBannerSchema, 'params'),
    deleteBanner
);

module.exports = router; 