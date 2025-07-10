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
const { uploadProfilePhoto, handleUploadError } = require('../middlewares/upload.middleware');
const { 
    updateProfileSchema, 
    changePasswordSchema 
} = require('../validations/profile.validation');

// Get profile
router.get('/:id', validateToken, getProfile);

// Update profile (dengan upload foto)
router.put('/:id', 
    validateToken, 
    uploadProfilePhoto, 
    handleUploadError,
    validate(updateProfileSchema), 
    updateProfile
);

// Change password
router.put('/:id/change-password', 
    validateToken, 
    validate(changePasswordSchema), 
    changePassword
);

// Delete profile photo
router.delete('/:id/profile-photo', validateToken, deleteProfilePhoto);

module.exports = router; 