const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking.controller');
const { validateToken, checkRole } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validation.middleware');
const { 
    createBookingSchema, 
    updateBookingStatusSchema, 
    cancelBookingSchema,
    createUserBookingSchema,
    cancelUserBookingSchema
} = require('../validations/booking.validation');

// Admin routes (require


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
    validate(cancelBookingSchema, 'body'),
    bookingController.adminCancelBooking
);

// User routes (no admin role required)
router.post('/member', 
    validateToken,
    validate(createUserBookingSchema, 'body'),
    bookingController.createUserBooking
);

router.put('/member/:booking_id/cancel', 
    validateToken,
    validate(cancelUserBookingSchema, 'body'),
    bookingController.cancelUserBooking
);

module.exports = router; 