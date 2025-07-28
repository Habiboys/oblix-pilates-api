const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking.controller');
const { validateToken, checkRole } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validation.middleware');
const { 

    createUserBookingSchema,
    cancelBookingSchema
} = require('../validations/booking.validation');



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