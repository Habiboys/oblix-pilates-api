const express = require('express');
const router = express.Router();
const {
    getAllGroupSchedules,
    getGroupScheduleById,
    createGroupSchedule,
    updateGroupSchedule,
    deleteGroupSchedule,
    getAllSemiPrivateSchedules,
    getSemiPrivateScheduleById,
    createSemiPrivateSchedule,
    updateSemiPrivateSchedule,
    deleteSemiPrivateSchedule,
    getAllPrivateSchedules,
    getPrivateScheduleById,
    createPrivateSchedule,
    updatePrivateSchedule,
    deletePrivateSchedule
} = require('../controllers/schedule.controller');
const { validateToken, checkRole } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validation.middleware');
const { uploadFile, handleUploadError } = require('../middlewares/upload.middleware');
const {
    createGroupScheduleSchema,
    updateGroupScheduleSchema,
    getGroupScheduleSchema,
    createSemiPrivateScheduleSchema,
    updateSemiPrivateScheduleSchema,
    getSemiPrivateScheduleSchema,
    createPrivateScheduleSchema,
    updatePrivateScheduleSchema,
    getPrivateScheduleSchema
} = require('../validations/schedule.validation');

// Public routes - semua user bisa akses
router.get('/group', getAllGroupSchedules);
router.get('/group/:id', validate(getGroupScheduleSchema, 'params'), getGroupScheduleById);

// Admin only routes - hanya admin yang bisa create, update, delete
router.post('/group', 
    validateToken, 
    checkRole('admin'), 
    uploadFile('schedules', false), // optional untuk schedule
    handleUploadError,
    validate(createGroupScheduleSchema), 
    createGroupSchedule
);

router.put('/group/:id', 
    validateToken, 
    checkRole('admin'), 
    uploadFile('schedules', false), // optional untuk update
    handleUploadError,
    validate(getGroupScheduleSchema, 'params'),
    validate(updateGroupScheduleSchema), 
    updateGroupSchedule
);

router.delete('/group/:id', 
    validateToken, 
    checkRole('admin'), 
    validate(getGroupScheduleSchema, 'params'),
    deleteGroupSchedule
);

// Semi-private schedule routes
// Public routes - semua user bisa akses
router.get('/semi-private', getAllSemiPrivateSchedules);
router.get('/semi-private/:id', validate(getSemiPrivateScheduleSchema, 'params'), getSemiPrivateScheduleById);

// Admin only routes - hanya admin yang bisa create, update, delete
router.post('/semi-private', 
    validateToken, 
    checkRole('admin'), 
    uploadFile('schedules', false), // optional untuk schedule
    handleUploadError,
    validate(createSemiPrivateScheduleSchema), 
    createSemiPrivateSchedule
);

router.put('/semi-private/:id', 
    validateToken, 
    checkRole('admin'), 
    uploadFile('schedules', false), // optional untuk update
    handleUploadError,
    validate(getSemiPrivateScheduleSchema, 'params'),
    validate(updateSemiPrivateScheduleSchema), 
    updateSemiPrivateSchedule
);

router.delete('/semi-private/:id', 
    validateToken, 
    checkRole('admin'), 
    validate(getSemiPrivateScheduleSchema, 'params'),
    deleteSemiPrivateSchedule
);

// Private schedule routes
// Public routes - semua user bisa akses
router.get('/private', getAllPrivateSchedules);
router.get('/private/:id', validate(getPrivateScheduleSchema, 'params'), getPrivateScheduleById);

// Admin only routes - hanya admin yang bisa create, update, delete
router.post('/private', 
    validateToken, 
    checkRole('admin'), 
    uploadFile('schedules', false), // optional untuk schedule
    handleUploadError,
    validate(createPrivateScheduleSchema), 
    createPrivateSchedule
);

router.put('/private/:id', 
    validateToken, 
    checkRole('admin'), 
    uploadFile('schedules', false), // optional untuk update
    handleUploadError,
    validate(getPrivateScheduleSchema, 'params'),
    validate(updatePrivateScheduleSchema), 
    updatePrivateSchedule
);

router.delete('/private/:id', 
    validateToken, 
    checkRole('admin'), 
    validate(getPrivateScheduleSchema, 'params'),
    deletePrivateSchedule
);

module.exports = router; 