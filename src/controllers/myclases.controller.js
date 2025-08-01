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
                whereClause.status = {
                    [Op.in]: ['signup', 'waiting_list']
                };
                orderClause = [['createdAt', 'ASC']];
                break;

            case 'waitlist':
                whereClause.status = 'waiting_list';
                orderClause = [['createdAt', 'ASC']];
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
                    // Get waitlist position (this is simplified, you might want to calculate actual position)
                    spotInfo = `Waitlist #${index + 1}`;
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