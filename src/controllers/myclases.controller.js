const { Booking, Schedule, Class, Trainer, Member, User } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');


const getMyClasses = async (req, res) => {
    try {
        const userId = req.user.id;
        const { type = 'upcoming' } = req.query;

        logger.info(`Getting my classes for user ${userId}, type: ${type}`);

        // Get member ID from user ID
        const member = await Member.findOne({
            where: { user_id: userId }
        });

        if (!member) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        const memberId = member.id;
        const currentDate = new Date();

        // Build where clause based on type
        let whereClause = {
            member_id: memberId
        };

        let orderClause = [['createdAt', 'DESC']];

        switch (type) {
            case 'upcoming':
                whereClause.status = 'signup';
                orderClause = [['createdAt', 'ASC'], ['id', 'ASC']];
                break;

            case 'waitlist':
                whereClause.status = 'waiting_list';
                orderClause = [['createdAt', 'ASC'], ['id', 'ASC']];
                break;

            case 'post':
                whereClause.status = {
                    [Op.in]: ['signup', 'waiting_list']
                };
                orderClause = [['createdAt', 'DESC']];
                break;

            case 'cancelled':
                whereClause.status = 'cancelled';
                orderClause = [['updatedAt', 'DESC']];
                break;

            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid type parameter. Use: upcoming, waitlist, post, or cancelled'
                });
        }

        logger.info(`Where clause: ${JSON.stringify(whereClause)}`);

        // Get bookings with schedule, class, and trainer information
        const bookings = await Booking.findAll({
            where: whereClause,
            attributes: ['id', 'schedule_id', 'member_id', 'package_id', 'status', 'attendance', 'notes', 'createdAt', 'updatedAt'],
            include: [
                {
                    model: Schedule,
                    required: true, // Use INNER JOIN to ensure schedule exists
                    include: [
                        {
                            model: Class,
                            attributes: ['id', 'class_name', 'color_sign']
                        },
                        {
                            model: Trainer,
                            attributes: ['id', 'title', 'picture']
                        },
                        {
                            model: Booking,
                            attributes: ['id', 'status'],
                            where: { status: 'signup' },
                            required: false
                        }
                    ]
                }
            ],
            order: orderClause
        });

        logger.info(`Found ${bookings.length} bookings before filtering`);
        if (type === 'waitlist') {
            logger.info(`Waitlist bookings found: ${bookings.filter(b => b.status === 'waiting_list').length}`);
            bookings.forEach(b => {
                if (b.status === 'waiting_list') {
                    logger.info(`Waitlist booking: ${b.id}, Schedule: ${b.Schedule?.date_start}, Status: ${b.status}`);
                }
            });
        }

        // Filter by date after getting the data
        const filteredBookings = bookings.filter(booking => {
            if (!booking.Schedule) {
                logger.warn(`Booking ${booking.id} has no schedule`);
                return false;
            }
            
            const scheduleDate = booking.Schedule.date_start;
            if (!scheduleDate) {
                logger.warn(`Schedule ${booking.Schedule.id} has no date_start`);
                return false;
            }

            switch (type) {
                case 'upcoming':
                    return scheduleDate >= currentDate.toISOString().split('T')[0];
                case 'waitlist':
                    // For waitlist, show all waitlist bookings regardless of date
                    return true;
                case 'post':
                    return scheduleDate < currentDate.toISOString().split('T')[0];
                case 'cancelled':
                    return true; // Show all cancelled regardless of date
                default:
                    return true;
            }
        });

        logger.info(`Found ${filteredBookings.length} bookings after filtering`);
        logger.info(`Waitlist bookings: ${filteredBookings.filter(b => b.status === 'waiting_list').length}`);

        // Calculate waitlist positions for all waitlist bookings
        const waitlistPositions = new Map();
        const waitlistBookings = filteredBookings.filter(b => b.status === 'waiting_list');
        
        // Group waitlist bookings by schedule
        const scheduleGroups = new Map();
        for (const booking of waitlistBookings) {
            const scheduleId = booking.Schedule.id;
            if (!scheduleGroups.has(scheduleId)) {
                scheduleGroups.set(scheduleId, []);
            }
            scheduleGroups.get(scheduleId).push(booking);
        }
        
        // Calculate position for each booking in each schedule
        for (const [scheduleId, bookings] of scheduleGroups) {
            // PERBAIKAN: Ambil SEMUA booking untuk schedule ini (termasuk yang cancelled)
            // untuk menghitung posisi waitlist yang akurat
            const allScheduleBookings = await require('../models').Booking.findAll({
                where: { schedule_id: scheduleId },
                order: [['createdAt', 'ASC'], ['id', 'ASC']]
            });
            
            // Filter hanya booking yang pernah masuk waitlist (termasuk yang sekarang cancelled)
            const waitlistHistory = allScheduleBookings.filter(b => 
                b.status === 'waiting_list' || 
                (b.status === 'cancelled' && b.notes && b.notes.includes('waitlist'))
            );
            
            // Sort berdasarkan waitlist_joined_at untuk mendapatkan urutan waitlist yang fair
            const sortedWaitlistHistory = waitlistHistory.sort((a, b) => {
                // Gunakan waitlist_joined_at jika ada, fallback ke createdAt
                const aTime = a.waitlist_joined_at ? a.waitlist_joined_at.getTime() : a.createdAt.getTime();
                const bTime = b.waitlist_joined_at ? b.waitlist_joined_at.getTime() : b.createdAt.getTime();
                
                if (aTime !== bTime) {
                    return aTime - bTime;
                }
                return a.id.localeCompare(b.id);
            });
            
            // Assign positions berdasarkan urutan asli
            sortedWaitlistHistory.forEach((booking, index) => {
                waitlistPositions.set(booking.id, index + 1);
            });
            
            logger.info(`📊 Waitlist history for schedule ${scheduleId}: ${sortedWaitlistHistory.length} bookings`);
            sortedWaitlistHistory.forEach((booking, index) => {
                logger.info(`   ${index + 1}. ${booking.id} - Status: ${booking.status} - Created: ${booking.createdAt}`);
            });
        }

        // Format response data
        const formattedBookings = filteredBookings.map((booking, index) => {
            try {
                const schedule = booking.Schedule;
                const classData = schedule?.Class;
                const trainerData = schedule?.Trainer;

                // Calculate spot information with default fallback
                const scheduleType = schedule?.type || 'group';
                const totalSpots = schedule.pax || 20;
                
                // Get booked count from the schedule's booking count (this is a simplified approach)
                // In a real implementation, you might want to add a virtual field or use a more efficient query
                const bookedCount = schedule.Bookings ? schedule.Bookings.filter(b => b.status === 'signup').length : 0;

                // For waitlist, show waitlist position instead of spot
                let spotInfo = `${bookedCount}/${totalSpots}`;
                if (booking.status === 'waiting_list') {
                    const waitlistPosition = waitlistPositions.get(booking.id) || 1;
                    spotInfo = `Waitlist #${waitlistPosition}`;
                }

                return {
                    no: index + 1,
                    booking_id: booking.id,
                    class_date: schedule?.date_start || 'Unknown',
                    time: schedule ? `${schedule.time_start} - ${schedule.time_end}` : 'Unknown',
                    course: classData?.class_name || 'Unknown Class',
                    coach: trainerData?.title || 'Unknown Coach',
                    spot: spotInfo,
                    status: booking.status,
                    schedule_id: schedule?.id,
                    level: schedule?.level,
                    class_id: classData?.id,
                    trainer_id: trainerData?.id,
                    notes: booking.notes,
                    created_at: booking.createdAt,
                    updated_at: booking.updatedAt
                };
            } catch (error) {
                logger.error(`Error formatting booking ${booking.id}:`, error);
                return {
                    no: index + 1,
                    booking_id: booking.id,
                    class_date: 'Error',
                    time: 'Error',
                    course: 'Error',
                    coach: 'Error',
                    spot: '0/0',
                    status: booking.status,
                    schedule_id: null,
                    class_id: null,
                    level: schedule?.level,
                    trainer_id: null,
                    notes: booking.notes,
                    created_at: booking.createdAt,
                    updated_at: booking.updatedAt
                };
            }
        });

        // Get additional info based on type
        let additionalInfo = null;
        
        if (type === 'waitlist') {
            additionalInfo = {
                message: "If you're waitlisted, you'll be automatically added up to 120 mins before class if there's space—we'll notify you either way."
            };
        }

        res.json({
            success: true,
            message: `My ${type} classes retrieved successfully`,
            data: {
                type: type,
                total_classes: formattedBookings.length,
                classes: formattedBookings,
                additional_info: additionalInfo
            }
        });

    } catch (error) {
        logger.error('Error getting my classes:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};
module.exports = {
    getMyClasses
}