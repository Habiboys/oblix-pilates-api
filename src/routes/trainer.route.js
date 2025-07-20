const express = require('express');
const router = express.Router();
const { 
    getAllTrainers, 
    getTrainerById, 
    createTrainer, 
    updateTrainer, 
    deleteTrainer,
    deleteTrainerPicture 
} = require('../controllers/trainer.controller');
const { validateToken, checkRole } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validation.middleware');
const { uploadFile, handleUploadError } = require('../middlewares/upload.middleware');
const { 
    createTrainerSchema, 
    updateTrainerSchema, 
    getTrainerSchema 
} = require('../validations/trainer.validation');

// Public routes - semua user bisa akses
router.get('/', getAllTrainers);
router.get('/:id', validate(getTrainerSchema, 'params'), getTrainerById);

// Admin only routes - hanya admin yang bisa create, update, delete
router.post('/', 
    validateToken, 
    checkRole('admin'), 
    uploadFile('trainers', true), // required untuk create
    handleUploadError,
    validate(createTrainerSchema), 
    createTrainer
);

router.put('/:id', 
    validateToken, 
    checkRole('admin'), 
    uploadFile('trainers', false), // optional untuk update
    handleUploadError,
    validate(getTrainerSchema, 'params'),
    validate(updateTrainerSchema), 
    updateTrainer
);

router.delete('/:id', 
    validateToken, 
    checkRole('admin'), 
    validate(getTrainerSchema, 'params'),
    deleteTrainer
);

// Delete trainer picture
router.delete('/:id/picture', 
    validateToken, 
    checkRole('admin'), 
    validate(getTrainerSchema, 'params'),
    deleteTrainerPicture
);

module.exports = router; 