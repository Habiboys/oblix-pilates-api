const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking.controller');
const { validateToken, checkRole } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validation.middleware');
const { 

    createUserBookingSchema,
    cancelBookingSchema,
    updateBookingStatusSchema,
    adminCancelBookingSchema
} = require('../validations/booking.validation');



// Admin routes (admin role required)
router.put('/:id/status', 
    validateToken,
    checkRole('admin'),
    validate(updateBookingStatusSchema, 'body'),
    bookingController.updateBookingStatus
);

router.put('/:id/attendance', 
    validateToken,
    checkRole('admin'),
    bookingController.updateAttendance
);

router.put('/schedule/:schedule_id/attendance', 
    validateToken,
    checkRole('admin'),
    bookingController.updateScheduleAttendance
);

router.put('/:id/admin-cancel', 
    validateToken,
    checkRole('admin'),
    validate(adminCancelBookingSchema, 'body'),
    bookingController.adminCancelBooking
);


// User routes (no admin role required)
router.post('/', 
    validateToken,
    validate(createUserBookingSchema, 'body'),
    bookingController.createUserBooking
);

router.put('/:id/cancel', 
    validateToken,
    bookingController.cancelBooking
);

module.exports = router; 