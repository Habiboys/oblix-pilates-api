const { Booking, Schedule, Member, Package } = require('../models');
const { validateSessionAvailability, createSessionAllocation, getMemberSessionSummary } = require('../utils/sessionUtils');
const { autoCancelExpiredBookings, processWaitlistPromotion, getBookingStatistics } = require('../utils/bookingUtils');
const twilioService = require('../services/twilio.service');
const logger = require('../config/logger');

// Helper function to check if booking should go to waitlist
const shouldGoToWaitlist = async (scheduleId) => {
    try {
        const schedule = await Schedule.findByPk(scheduleId);
        if (!schedule) return false;

        const currentSignups = await Booking.count({
            where: {
                schedule_id: scheduleId,
                status: 'signup'
            }
        });

        const maxCapacity = schedule.type === 'semi_private' ? 4 : 20;
        return currentSignups >= maxCapacity;
    } catch (error) {
        logger.error('Error checking waitlist status:', error);
        return false;
    }
};

// Get all bookings with pagination and filters
const getAllBookings = async (req, res) => {
    try {
        const { page = 1, limit = 10, member_id, schedule_id, status } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = {};
        
        if (member_id) whereClause.member_id = member_id;
        if (schedule_id) whereClause.schedule_id = schedule_id;
        if (status) whereClause.status = status;

        const bookings = await Booking.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: Member,
                    attributes: ['id', 'full_name', 'username', 'member_code']
                },
                {
                    model: Schedule,
                    include: [
                        {
                            model: require('../models').Class,
                            attributes: ['id', 'class_name', 'color_sign']
                        },
                        {
                            model: require('../models').Trainer,
                            attributes: ['id', 'title', 'picture']
                        }
                    ]
                },
                {
                    model: Package,
                    attributes: ['id', 'name', 'type']
                }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']]
        });

        const totalPages = Math.ceil(bookings.count / limit);

        res.json({
            success: true,
            message: 'Bookings retrieved successfully',
            data: {
                bookings: bookings.rows,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalItems: bookings.count,
                    itemsPerPage: parseInt(limit)
                }
            }
        });
    } catch (error) {
        logger.error('Error getting bookings:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get booking by ID
const getBookingById = async (req, res) => {
    try {
        const { id } = req.params;

        const booking = await Booking.findByPk(id, {
            include: [
                {
                    model: Member,
                    attributes: ['id', 'full_name', 'username', 'member_code']
                },
                {
                    model: Schedule,
                    include: [
                        {
                            model: require('../models').Class,
                            attributes: ['id', 'class_name', 'color_sign']
                        },
                        {
                            model: require('../models').Trainer,
                            attributes: ['id', 'title', 'picture']
                        }
                    ]
                },
                {
                    model: Package,
                    attributes: ['id', 'name', 'type']
                }
            ]
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        res.json({
            success: true,
            message: 'Booking retrieved successfully',
            data: booking
        });
    } catch (error) {
        logger.error('Error getting booking:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Create new booking
const createBooking = async (req, res) => {
    try {
        const { schedule_id, member_id, package_id, notes } = req.body;

        // Validasi input
        if (!schedule_id || !member_id) {
            return res.status(400).json({
                success: false,
                message: 'schedule_id dan member_id harus diisi'
            });
        }

        // Cek apakah schedule exists dan valid untuk booking
        const schedule = await Schedule.findByPk(schedule_id);
        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: 'Schedule tidak ditemukan'
            });
        }

        // Validasi bahwa schedule adalah group atau semi-private
        if (schedule.type === 'private') {
            return res.status(400).json({
                success: false,
                message: 'Booking hanya tersedia untuk schedule group dan semi-private. Schedule private menggunakan auto-booking.'
            });
        }

        // Cek apakah schedule sudah lewat waktu
        const scheduleDateTime = new Date(`${schedule.date_start}T${schedule.time_start}`);
        const currentDateTime = new Date();
        
        if (scheduleDateTime <= currentDateTime) {
            return res.status(400).json({
                success: false,
                message: 'Tidak dapat booking untuk schedule yang sudah lewat waktu'
            });
        }

        // Cek kapasitas schedule dan tentukan status booking
        const currentSignups = await Booking.count({
            where: {
                schedule_id: schedule_id,
                status: 'signup'
            }
        });

        const maxCapacity = schedule.type === 'semi_private' ? 4 : 20; // Default capacity
        const minSignup = schedule.min_signup || 1;
        
        // Tentukan status booking
        let bookingStatus = 'signup';
        let bookingNotes = notes || 'Manual booking';

        if (currentSignups >= maxCapacity) {
            bookingStatus = 'waiting_list';
            bookingNotes = notes || 'Booking masuk waitlist karena kelas penuh';
        }

        // Cek apakah member exists
        const member = await Member.findByPk(member_id);
        if (!member) {
            return res.status(404).json({
                success: false,
                message: 'Member tidak ditemukan'
            });
        }

        // Cek apakah sudah ada booking untuk member ini di schedule ini
        const existingBooking = await Booking.findOne({
            where: {
                schedule_id,
                member_id
            }
        });

        if (existingBooking) {
            return res.status(400).json({
                success: false,
                message: 'Member sudah melakukan booking untuk schedule ini'
            });
        }

        // Jika package_id tidak disediakan, gunakan utility untuk memilih paket
        let selectedPackageId = package_id;
        let sessionLeft = null;

        if (!selectedPackageId) {
            // Cek ketersediaan sesi
            const sessionValidation = await validateSessionAvailability(member_id, 1);
            
            if (!sessionValidation.isValid) {
                return res.status(400).json({
                    success: false,
                    message: 'Member tidak memiliki jatah sesi yang cukup',
                    data: {
                        required_sessions: 1,
                        available_sessions: sessionValidation.totalAvailableSessions,
                        deficit: sessionValidation.deficit
                    }
                });
            }

            // Buat alokasi untuk 1 sesi
            const allocation = await createSessionAllocation(member_id, 1);
            selectedPackageId = allocation[0].package_id;
            sessionLeft = allocation[0].session_left;
        } else {
            // Jika package_id disediakan, validasi apakah member memiliki paket ini
            const memberPackage = await require('../models').MemberPackage.findOne({
                where: {
                    member_id,
                    package_id: selectedPackageId
                }
            });

            if (!memberPackage) {
                return res.status(400).json({
                    success: false,
                    message: 'Member tidak memiliki paket yang dipilih'
                });
            }

            // Hitung session_left untuk paket yang dipilih
            const sessionInfo = await getMemberSessionSummary(member_id);
            const selectedPackage = sessionInfo.packages.find(pkg => pkg.package_id === selectedPackageId);
            
            if (!selectedPackage || selectedPackage.available_sessions <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Paket yang dipilih tidak memiliki sesi yang tersedia'
                });
            }

            sessionLeft = selectedPackage.available_sessions - 1;
        }

        // Buat booking
        const booking = await Booking.create({
            schedule_id,
            member_id,
            package_id: selectedPackageId,
            session_left: sessionLeft,
            status: bookingStatus,
            booking_date: new Date(),
            notes: bookingNotes
        });

        // Fetch booking dengan associations
        const createdBooking = await Booking.findByPk(booking.id, {
            include: [
                {
                    model: Member,
                    attributes: ['id', 'full_name', 'username', 'member_code', 'phone_number']
                },
                {
                    model: Schedule,
                    include: [
                        {
                            model: require('../models').Class,
                            attributes: ['id', 'class_name', 'color_sign']
                        },
                        {
                            model: require('../models').Trainer,
                            attributes: ['id', 'title', 'picture']
                        }
                    ]
                },
                {
                    model: Package,
                    attributes: ['id', 'name', 'type']
                }
            ]
        });

        // Send WhatsApp confirmation (async, don't wait for response)
        try {
            twilioService.sendBookingConfirmation(createdBooking)
                .then(result => {
                    if (result.success) {
                        logger.info(`✅ WhatsApp confirmation sent to ${createdBooking.Member.full_name}`);
                    } else {
                        logger.error(`❌ Failed to send WhatsApp confirmation to ${createdBooking.Member.full_name}: ${result.error}`);
                    }
                })
                .catch(error => {
                    logger.error(`❌ Error sending WhatsApp confirmation to ${createdBooking.Member.full_name}:`, error);
                });
        } catch (error) {
            logger.error('Error initiating WhatsApp confirmation:', error);
        }

        res.status(201).json({
            success: true,
            message: 'Booking created successfully',
            data: createdBooking
        });
    } catch (error) {
        logger.error('Error creating booking:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Update booking status
const updateBookingStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        const booking = await Booking.findByPk(id, {
            include: [
                {
                    model: Schedule,
                    include: [
                        {
                            model: require('../models').Class
                        }
                    ]
                }
            ]
        });
        
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Validasi status
        const validStatuses = ['signup', 'waiting_list', 'cancelled'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Status tidak valid'
            });
        }

        // Update booking
        await booking.update({
            status: status || booking.status,
            notes: notes || booking.notes
        });

        // Jika booking di-cancel, cek waitlist untuk naik ke signup
        if (status === 'cancelled') {
            await processWaitlistPromotion(booking.schedule_id);
        }

        res.json({
            success: true,
            message: 'Booking status updated successfully',
            data: booking
        });
    } catch (error) {
        logger.error('Error updating booking status:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Cancel booking
const cancelBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const booking = await Booking.findByPk(id, {
            include: [
                {
                    model: Schedule,
                    include: [
                        {
                            model: require('../models').Class
                        }
                    ]
                },
                {
                    model: Member
                }
            ]
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Cek apakah booking sudah di-cancel
        if (booking.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Booking sudah di-cancel sebelumnya'
            });
        }

        // Cek cancel buffer time
        const scheduleDateTime = new Date(`${booking.Schedule.date_start}T${booking.Schedule.time_start}`);
        const currentDateTime = new Date();
        const cancelBufferMinutes = booking.Schedule.cancel_buffer_minutes || 120; // Default 2 jam
        const cancelDeadline = new Date(scheduleDateTime.getTime() - (cancelBufferMinutes * 60 * 1000));

        if (currentDateTime > cancelDeadline) {
            return res.status(400).json({
                success: false,
                message: `Tidak dapat cancel booking. Batas waktu cancel adalah ${cancelBufferMinutes} menit sebelum kelas dimulai.`,
                data: {
                    schedule_time: scheduleDateTime,
                    cancel_deadline: cancelDeadline,
                    current_time: currentDateTime
                }
            });
        }

        // Cancel booking
        await booking.update({
            status: 'cancelled',
            notes: reason || 'Booking dibatalkan oleh member'
        });

        // Send WhatsApp cancellation notification (async)
        try {
            twilioService.sendBookingCancellation(booking, reason)
                .then(result => {
                    if (result.success) {
                        logger.info(`✅ WhatsApp cancellation sent to ${booking.Member.full_name}`);
                    } else {
                        logger.error(`❌ Failed to send WhatsApp cancellation to ${booking.Member.full_name}: ${result.error}`);
                    }
                })
                .catch(error => {
                    logger.error(`❌ Error sending WhatsApp cancellation to ${booking.Member.full_name}:`, error);
                });
        } catch (error) {
            logger.error('Error initiating WhatsApp cancellation:', error);
        }

        // Proses waitlist promotion
        const promotedBooking = await processWaitlistPromotion(booking.schedule_id);

        res.json({
            success: true,
            message: 'Booking cancelled successfully',
            data: {
                cancelled_booking: booking,
                promoted_from_waitlist: promotedBooking
            }
        });
    } catch (error) {
        logger.error('Error cancelling booking:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Delete booking
const deleteBooking = async (req, res) => {
    try {
        const { id } = req.params;

        const booking = await Booking.findByPk(id);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        await booking.destroy();

        res.json({
            success: true,
            message: 'Booking deleted successfully'
        });
    } catch (error) {
        logger.error('Error deleting booking:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get member session summary
const getMemberSessions = async (req, res) => {
    try {
        const { member_id } = req.params;

        const member = await Member.findByPk(member_id);
        if (!member) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        const sessionSummary = await getMemberSessionSummary(member_id);

        res.json({
            success: true,
            message: 'Member session summary retrieved successfully',
            data: sessionSummary
        });
    } catch (error) {
        logger.error('Error getting member sessions:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get bookings by member ID
const getBookingsByMember = async (req, res) => {
    try {
        const { member_id } = req.params;
        const { page = 1, limit = 10, status } = req.query;
        const offset = (page - 1) * limit;

        const member = await Member.findByPk(member_id);
        if (!member) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        const whereClause = { member_id };
        if (status) whereClause.status = status;

        const bookings = await Booking.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: Schedule,
                    include: [
                        {
                            model: require('../models').Class,
                            attributes: ['id', 'class_name', 'color_sign']
                        },
                        {
                            model: require('../models').Trainer,
                            attributes: ['id', 'title', 'picture']
                        }
                    ]
                },
                {
                    model: Package,
                    attributes: ['id', 'name', 'type']
                }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']]
        });

        const totalPages = Math.ceil(bookings.count / limit);

            res.json({
        success: true,
        message: 'Member bookings retrieved successfully',
        data: {
            bookings: bookings.rows,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalItems: bookings.count,
                itemsPerPage: parseInt(limit)
            }
        }
    });
} catch (error) {
    logger.error('Error getting member bookings:', error);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
}
};

// Auto-cancel expired bookings
const runAutoCancel = async (req, res) => {
    try {
        const result = await autoCancelExpiredBookings();
        
        res.json({
            success: true,
            message: 'Auto-cancel process completed',
            data: result
        });
    } catch (error) {
        logger.error('Error running auto-cancel:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Cancel insufficient bookings
const runInsufficientCancel = async (req, res) => {
    try {
        const result = await cancelInsufficientBookings();
        
        res.json({
            success: true,
            message: 'Insufficient bookings cancellation completed',
            data: result
        });
    } catch (error) {
        logger.error('Error running insufficient cancel:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get booking statistics
const getBookingStats = async (req, res) => {
    try {
        const result = await getBookingStatistics();
        
        res.json({
            success: true,
            message: 'Booking statistics retrieved successfully',
            data: result
        });
    } catch (error) {
        logger.error('Error getting booking statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    getAllBookings,
    getBookingById,
    createBooking,
    updateBookingStatus,
    cancelBooking,
    deleteBooking,
    getMemberSessions,
    getBookingsByMember,
    runAutoCancel,
    runInsufficientCancel,
    getBookingStats
}; 