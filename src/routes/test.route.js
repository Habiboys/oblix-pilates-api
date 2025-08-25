const express = require('express');
const router = express.Router();
const { testWhatsApp, testH1Reminder, getWhatsAppStatus, checkWhatsAppTemplates, testMetaWhatsApp, testMetaAPIConnection } = require('../controllers/test.controller');
const { validateToken, checkRole } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validation.middleware');
const { testWhatsAppSchema } = require('../validations/test.validation');

// Endpoint untuk cek status konfigurasi Twilio
router.get('/whatsapp/status', validateToken, checkRole('admin'), getWhatsAppStatus);

// Endpoint untuk test kirim WhatsApp
router.post('/twilio/whatsapp', validateToken, checkRole('admin'), validate(testWhatsAppSchema), testWhatsApp);

// Endpoint untuk test H-1 reminder manual
router.post('/twilio/h1-reminder', validateToken, checkRole('admin'), testH1Reminder);

// Endpoint untuk cek status template WhatsApp Meta
router.get('/whatsapp/templates', validateToken, checkRole('admin'), checkWhatsAppTemplates);

// Endpoint untuk test kirim pesan Meta WhatsApp
router.post('/whatsapp/send', validateToken, checkRole('admin'), testMetaWhatsApp);

// Endpoint untuk test koneksi Meta API
router.get('/whatsapp/api-test', validateToken, checkRole('admin'), testMetaAPIConnection);

module.exports = router; 