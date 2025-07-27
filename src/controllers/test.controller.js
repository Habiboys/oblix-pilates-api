const { sendWhatsAppMessage, sendBookingReminder } = require('../services/twilio.service');
const { Booking, Schedule, Member, Class, Trainer } = require('../models');
const { sendH1Reminders } = require('../utils/bookingUtils');

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
 * Get Twilio configuration status
 */
const getTwilioStatus = async (req, res) => {
    try {
        // Check WhatsApp number configuration
        let whatsappStatus = '❌ Not configured (using sandbox)';
        let whatsappNumber = '+14155238886 (Twilio Sandbox)';
        
        if (process.env.TWILIO_WHATSAPP_NUMBER) {
            whatsappStatus = '✅ Custom number configured';
            const configuredNumber = process.env.TWILIO_WHATSAPP_NUMBER.startsWith('+') 
                ? process.env.TWILIO_WHATSAPP_NUMBER 
                : `+${process.env.TWILIO_WHATSAPP_NUMBER}`;
            whatsappNumber = configuredNumber;
        }

        const config = {
            account_sid: process.env.TWILIO_ACCOUNT_SID ? '✅ Configured' : '❌ Missing',
            auth_token: process.env.TWILIO_AUTH_TOKEN ? '✅ Configured' : '❌ Missing',
            whatsapp_number_status: whatsappStatus,
            whatsapp_number: whatsappNumber,
            environment: process.env.NODE_ENV || 'development',
            using_sandbox: !process.env.TWILIO_WHATSAPP_NUMBER,
            sandbox_setup_required: !process.env.TWILIO_WHATSAPP_NUMBER,
            instructions: {
                sandbox: "Jika menggunakan sandbox, penerima harus kirim 'join <keyword>' ke +1 415 523 8886 dulu",
                business: "Jika menggunakan business number, pastikan TWILIO_WHATSAPP_NUMBER sudah diisi di .env"
            }
        };

        res.status(200).json({
            success: true,
            message: 'Twilio configuration status',
            data: config
        });

    } catch (error) {
        console.error('Get Twilio status error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    testWhatsApp,
    testBookingReminder,
    testBookingReminderManual,
    testUserReminder,
    testH1Reminder,
    getTwilioStatus
}; 