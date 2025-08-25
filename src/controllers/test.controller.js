const { sendWhatsAppMessage, sendBookingReminder, getAvailableTemplates } = require('../services/whatsapp.service');
const { Booking, Schedule, Member, Class, Trainer } = require('../models');
const { sendH1Reminders } = require('../utils/bookingUtils');
const whatsappService = require('../services/whatsapp.service');
const logger = require('../config/logger');
const axios = require('axios');

/**
 * Test endpoint untuk mengirim pesan WhatsApp
 */
const testWhatsApp = async (req, res) => {
    try {
        const { phone_number, message } = req.body;

        if (!phone_number || !message) {
            return res.status(400).json({
                success: false,
                message: 'Phone number dan message harus diisi'
            });
        }

        // Kirim pesan WhatsApp
        const result = await sendWhatsAppMessage(phone_number, message);

        if (result.success) {
            res.status(200).json({
                success: true,
                message: 'Pesan WhatsApp berhasil dikirim',
                data: {
                    message_id: result.messageId,
                    status: result.status,
                    to: result.to,
                    from: result.from,
                    using_sandbox: !process.env.TWILIO_WHATSAPP_NUMBER
                }
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Gagal mengirim pesan WhatsApp',
                error: result.error,
                error_code: result.errorCode,
                to: result.to
            });
        }

    } catch (error) {
        console.error('Test WhatsApp error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Test endpoint untuk mengirim reminder booking
 */
const testBookingReminder = async (req, res) => {
    try {
        const { booking_id } = req.params;

        // TODO: Implementasi setelah ada data booking yang valid
        res.status(200).json({
            success: true,
            message: 'Test booking reminder endpoint',
            note: 'Implementasi lengkap setelah ada data booking'
        });

    } catch (error) {
        console.error('Test booking reminder error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * Test endpoint untuk mengirim reminder booking manual
 */
const testBookingReminderManual = async (req, res) => {
    try {
        const { booking_id } = req.params;

        // Ambil booking dengan data lengkap
        const booking = await Booking.findByPk(booking_id, {
            include: [
                {
                    model: Member,
                    attributes: ['id', 'full_name', 'phone_number']
                },
                {
                    model: Schedule,
                    include: [
                        {
                            model: Class,
                            attributes: ['id', 'class_name']
                        },
                        {
                            model: Trainer,
                            attributes: ['id', 'title']
                        }
                    ]
                }
            ]
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking tidak ditemukan'
            });
        }

        // Kirim reminder
        const result = await sendBookingReminder(booking);

        if (result.success) {
            res.status(200).json({
                success: true,
                message: 'Reminder booking berhasil dikirim',
                data: {
                    booking_id: booking.id,
                    member_name: booking.Member.full_name,
                    member_phone: booking.Member.phone_number,
                    class_name: booking.Schedule.Class.class_name,
                    schedule_date: booking.Schedule.date_start,
                    schedule_time: booking.Schedule.time_start,
                    message_id: result.messageId,
                    status: result.status
                }
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Gagal mengirim reminder booking',
                error: result.error,
                booking_id: booking.id
            });
        }

    } catch (error) {
        console.error('Test booking reminder manual error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Test endpoint untuk trigger reminder untuk user test specific
 */
const testUserReminder = async (req, res) => {
    try {
        // Cari booking untuk user test
        const bookings = await Booking.findAll({
            where: {
                member_id: 'test-member-085142247464-uuid'
            },
            attributes: ['id', 'schedule_id', 'member_id', 'package_id', 'status', 'attendance', 'notes', 'createdAt', 'updatedAt'],
            include: [
                {
                    model: Member,
                    attributes: ['id', 'full_name', 'phone_number']
                },
                {
                    model: Schedule,
                    include: [
                        {
                            model: Class,
                            attributes: ['id', 'class_name']
                        },
                        {
                            model: Trainer,
                            attributes: ['id', 'title']
                        }
                    ]
                }
            ]
        });

        if (bookings.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Tidak ada booking untuk user test. Jalankan seeder dulu.'
            });
        }

        const results = [];
        
        // Kirim reminder untuk semua booking user test
        for (const booking of bookings) {
            const result = await sendBookingReminder(booking);
            results.push({
                booking_id: booking.id,
                schedule_date: booking.Schedule.date_start,
                schedule_time: booking.Schedule.time_start,
                class_name: booking.Schedule.Class.class_name,
                success: result.success,
                message_id: result.messageId || null,
                error: result.error || null
            });
        }

        res.status(200).json({
            success: true,
            message: `Reminder test completed untuk ${bookings.length} booking`,
            data: {
                member_phone: '+6285142247464',
                total_bookings: bookings.length,
                results: results
            }
        });

    } catch (error) {
        console.error('Test user reminder error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Test endpoint untuk trigger manual H-1 reminders
 */
const testH1Reminder = async (req, res) => {
    try {
        console.log('🧪 Manual trigger H-1 reminder test...');
        
        const result = await sendH1Reminders();
        
        res.status(200).json({
            success: true,
            message: 'H-1 reminder test completed',
            data: result
        });

    } catch (error) {
        console.error('Test H-1 reminder error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Get Meta WhatsApp API configuration status
 */
const getWhatsAppStatus = async (req, res) => {
    try {
        // Check WhatsApp API configuration
        const accessTokenStatus = process.env.META_ACCESS_TOKEN ? '✅ Configured' : '❌ Missing';
        const phoneNumberIdStatus = process.env.META_PHONE_NUMBER_ID ? '✅ Configured' : '❌ Missing';
        
        // Get available templates
        const templates = await getAvailableTemplates();
        
        const config = {
            access_token: accessTokenStatus,
            phone_number_id: phoneNumberIdStatus,
            environment: process.env.NODE_ENV || 'development',
            api_version: 'v20.0',
            base_url: 'https://graph.facebook.com',
            available_templates: templates.map(t => ({
                name: t.name,
                status: t.status,
                language: t.language
            })),
            instructions: {
                setup: "Pastikan META_ACCESS_TOKEN dan META_PHONE_NUMBER_ID sudah diisi di .env",
                templates: "Template messages harus sudah diapprove di Meta Business Manager",
                testing: "Gunakan endpoint /test/whatsapp untuk test pengiriman pesan"
            }
        };

        res.status(200).json({
            success: true,
            message: 'Meta WhatsApp API configuration status',
            data: config
        });

    } catch (error) {
        console.error('Get WhatsApp status error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const checkWhatsAppTemplates = async (req, res) => {
    try {
        const templates = await whatsappService.getAvailableTemplates();
        
        // Check specific templates
        const bookingConfirmation = await whatsappService.getTemplateStatus('booking_confirmation');
        const bookingReminder = await whatsappService.getTemplateStatus('booking_reminder');
        const tes = await whatsappService.getTemplateStatus('tes');
        const genericNotification = await whatsappService.getTemplateStatus('generic_booking_notification');
        
        res.json({
            success: true,
            data: {
                total_templates: templates.length,
                all_templates: templates.map(t => ({
                    name: t.name,
                    status: t.status,
                    category: t.category,
                    language: t.language,
                    components: t.components
                })),
                specific_templates: {
                    booking_confirmation: bookingConfirmation,
                    booking_reminder: bookingReminder,
                    tes: tes,
                    generic_booking_notification: genericNotification
                },
                environment: {
                    business_account_id: process.env.META_BUSINESS_ACCOUNT_ID,
                    phone_number_id: process.env.META_PHONE_NUMBER_ID,
                    access_token_length: process.env.META_ACCESS_TOKEN ? process.env.META_ACCESS_TOKEN.length : 0
                }
            }
        });
    } catch (error) {
        logger.error('Error checking WhatsApp templates:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

const testMetaWhatsApp = async (req, res) => {
    try {
        const { phone_number, template_name, parameters } = req.body;
        
        const result = await whatsappService.sendTemplateMessage(
            phone_number,
            template_name,
            parameters || []
        );
        
        res.json({
            success: result.success,
            message: result.success ? 'Pesan berhasil dikirim' : 'Gagal mengirim pesan',
            data: result
        });
        
    } catch (error) {
        logger.error('Error testing Meta WhatsApp:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

const testMetaAPIConnection = async (req, res) => {
    try {
        const accessToken = process.env.META_ACCESS_TOKEN;
        const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
        const businessAccountId = process.env.META_BUSINESS_ACCOUNT_ID;
        
        // Test 1: Get phone number info
        const phoneInfoResponse = await axios.get(`https://graph.facebook.com/v20.0/${phoneNumberId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        // Test 2: Get templates from business account
        const templatesResponse = await axios.get(`https://graph.facebook.com/v20.0/${businessAccountId}/message_templates`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        // Test 3: Get business account info
        const businessResponse = await axios.get(`https://graph.facebook.com/v20.0/${businessAccountId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        

        
        res.json({
            success: true,
            data: {
                phone_number_info: phoneInfoResponse.data,
                templates: templatesResponse.data,
                business_account_info: businessResponse.data,

                environment: {
                    access_token_length: accessToken ? accessToken.length : 0,
                    phone_number_id: phoneNumberId,
                    business_account_id: businessAccountId
                }
            }
        });
        
    } catch (error) {
        logger.error('Error testing Meta API connection:', error);
        res.status(500).json({
            success: false,
            error: error.response?.data || error.message
        });
    }
};

module.exports = {
    testWhatsApp,
    testBookingReminder,
    testBookingReminderManual,
    testUserReminder,
    testH1Reminder,
    getWhatsAppStatus,
    checkWhatsAppTemplates,
    testMetaWhatsApp,
    testMetaAPIConnection
}; 