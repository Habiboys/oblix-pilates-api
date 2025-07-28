const express = require('express');
const router = express.Router();
const { 
    getProfile, 
    updateProfile, 
    changePassword, 
    deleteProfilePhoto 
} = require('../controllers/profile.controller');
const { validateToken } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validation.middleware');
const { uploadFile, handleUploadError } = require('../middlewares/upload.middleware');
const { 
    updateProfileSchema, 
    changePasswordSchema 
} = require('../validations/profile.validation');

router.get('/', validateToken, getProfile);
router.put('/', 
    validateToken, 
    uploadFile('profiles', false), // optional untuk update profile
    handleUploadError,
    validate(updateProfileSchema), 
    updateProfile
);
router.put('/change-password', validateToken, validate(changePasswordSchema), changePassword);
router.delete('/photo', validateToken, deleteProfilePhoto);

module.exports = router; 