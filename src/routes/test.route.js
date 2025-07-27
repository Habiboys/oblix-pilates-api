const express = require('express');
const router = express.Router();
const { testWhatsApp, testH1Reminder, getTwilioStatus } = require('../controllers/test.controller');
const { validateToken, checkRole } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validation.middleware');
const { testWhatsAppSchema } = require('../validations/test.validation');

// Endpoint untuk cek status konfigurasi Twilio
router.get('/twilio/status', validateToken, checkRole('admin'), getTwilioStatus);

// Endpoint untuk test kirim WhatsApp
router.post('/twilio/whatsapp', validateToken, checkRole('admin'), validate(testWhatsAppSchema), testWhatsApp);

// Endpoint untuk test H-1 reminder manual
router.post('/twilio/h1-reminder', validateToken, checkRole('admin'), testH1Reminder);

module.exports = router; 