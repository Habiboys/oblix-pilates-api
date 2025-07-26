const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking.controller');
const { validateToken } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validation.middleware');
const { createBookingSchema, updateBookingStatusSchema } = require('../validations/booking.validation');

// Get all bookings
router.get('/', validateToken, bookingController.getAllBookings);

// Get booking by ID
router.get('/:id', validateToken, bookingController.getBookingById);

// Create new booking
router.post('/', validateToken, validate(createBookingSchema), bookingController.createBooking);

// Update booking status
router.patch('/:id/status', validateToken, validate(updateBookingStatusSchema), bookingController.updateBookingStatus);

// Cancel booking
router.post('/:id/cancel', validateToken, bookingController.cancelBooking);

// Delete booking
router.delete('/:id', validateToken, bookingController.deleteBooking);

// Get member session summary
router.get('/member/:member_id/sessions', validateToken, bookingController.getMemberSessions);

// Get bookings by member ID
router.get('/member/:member_id/bookings', validateToken, bookingController.getBookingsByMember);

// Admin endpoints for auto-cancel and statistics
router.post('/admin/auto-cancel', validateToken, bookingController.runAutoCancel);
router.post('/admin/insufficient-cancel', validateToken, bookingController.runInsufficientCancel);
router.get('/admin/statistics', validateToken, bookingController.getBookingStats);

module.exports = router; 