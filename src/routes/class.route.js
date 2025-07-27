const express = require('express');
const router = express.Router();
const { 
    getAllClasses, 
    getClassById, 
    createClass, 
    updateClass, 
    deleteClass
} = require('../controllers/class.controller');
const { validateToken, checkRole } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validation.middleware');
const { 
    createClassSchema, 
    updateClassSchema, 
    getAllClassesSchema, 
    getClassByIdSchema 
} = require('../validations/class.validation');

// Public routes (tidak perlu auth)

// Protected routes (perlu auth)
router.get('/', validateToken, validate(getAllClassesSchema, 'query'), getAllClasses);
router.get('/:id', validateToken, validate(getClassByIdSchema, 'params'), getClassById);

// Admin only routes
router.post('/', validateToken, checkRole('admin'), validate(createClassSchema), createClass);
router.put('/:id', validateToken, checkRole('admin'), validate(getClassByIdSchema, 'params'), validate(updateClassSchema), updateClass);
router.delete('/:id', validateToken, checkRole('admin'), validate(getClassByIdSchema, 'params'), deleteClass);

module.exports = router; 