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
    deletePrivateSchedule,
    getScheduleCalendar
} = require('../controllers/schedule.controller');
const { validateToken, checkRole } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validation.middleware');
const { uploadFile, handleUploadError } = require('../middlewares/upload.middleware');
const {
    createGroupScheduleSchema,
    updateGroupScheduleSchema,
    getGroupScheduleSchema,
    getGroupScheduleByIdSchema,
    createSemiPrivateScheduleSchema,
    updateSemiPrivateScheduleSchema,
    getSemiPrivateScheduleSchema,
    getSemiPrivateScheduleByIdSchema,
    createPrivateScheduleSchema,
    updatePrivateScheduleSchema,
    getPrivateScheduleSchema,
    getPrivateScheduleByIdSchema,
    getScheduleCalendarSchema
} = require('../validations/schedule.validation');

// Public routes - semua user bisa akses
router.get('/group', validate(getGroupScheduleSchema, 'query'), getAllGroupSchedules);
router.get('/group/:id', validate(getGroupScheduleByIdSchema, 'params'), getGroupScheduleById);

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
    validate(getGroupScheduleByIdSchema, 'params'),
    validate(updateGroupScheduleSchema), 
    updateGroupSchedule
);

router.delete('/group/:id', 
    validateToken, 
    checkRole('admin'), 
    validate(getGroupScheduleByIdSchema, 'params'),
    deleteGroupSchedule
);

// Semi-private schedule routes
// Public routes - semua user bisa akses
router.get('/semi-private', validate(getSemiPrivateScheduleSchema, 'query'), getAllSemiPrivateSchedules);
router.get('/semi-private/:id', validate(getSemiPrivateScheduleByIdSchema, 'params'), getSemiPrivateScheduleById);

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
    validate(getSemiPrivateScheduleByIdSchema, 'params'),
    validate(updateSemiPrivateScheduleSchema), 
    updateSemiPrivateSchedule
);

router.delete('/semi-private/:id', 
    validateToken, 
    checkRole('admin'), 
    validate(getSemiPrivateScheduleByIdSchema, 'params'),
    deleteSemiPrivateSchedule
);

// Private schedule routes
// Public routes - semua user bisa akses
router.get('/private', validate(getPrivateScheduleSchema, 'query'), getAllPrivateSchedules);
router.get('/private/:id', validate(getPrivateScheduleByIdSchema, 'params'), getPrivateScheduleById);

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
    validate(getPrivateScheduleByIdSchema, 'params'),
    validate(updatePrivateScheduleSchema), 
    updatePrivateSchedule
);

router.delete('/private/:id', 
    validateToken, 
    checkRole('admin'), 
    validate(getPrivateScheduleByIdSchema, 'params'),
    deletePrivateSchedule
);

// Calendar endpoint
router.get('/calendar', validateToken, validate(getScheduleCalendarSchema, 'query'), getScheduleCalendar);

module.exports = router; 