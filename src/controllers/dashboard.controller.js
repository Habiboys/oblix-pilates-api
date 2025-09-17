const { Member, Schedule, Order, Booking, Class, Trainer } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');

// Get dashboard data
const getDashboardData = async (req, res) => {
    try {
        const today = new Date();
        const todayDate = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD

        // Get total members
        const totalMembers = await Member.count();

        // Get total classes (schedules)
        const totalClasses = await Schedule.count();

        // Get total revenue (sum of all paid orders)
        const totalRevenue = await Order.sum('total_amount', {
            where: {
                payment_status: 'paid'
            }
        });

        // Get today's classes with booking details
        const todayClasses = await Schedule.findAll({
            where: {
                date_start: todayDate
            },
            include: [
                {
                    model: Class,
                    attributes: ['id', 'class_name']
                },
                {
                    model: Trainer,
                    attributes: ['id', 'title']
                },
                {
                    model: Booking,
                    where: {
                        status: 'signup'
                    },
                    required: false,
                    attributes: ['id']
                }
            ],
            order: [['time_start', 'ASC']]
        });

        // Format today classes data
        const formattedTodayClasses = todayClasses.map((schedule, index) => {
            const signupCount = schedule.Bookings ? schedule.Bookings.length : 0;
            const maxCapacity = schedule.pax || 20;

            return {
                no: index + 1,
                id: schedule.id,
                class_date: new Date(schedule.date_start).toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                }),
                time: `${schedule.time_start} - ${schedule.time_end}`,
                course: schedule.Class?.class_name || 'Unknown Class',
                coach: schedule.Trainer?.title || 'Unknown Coach',
                pax: `${signupCount}/${maxCapacity}`,
                schedule_type: schedule.type,
                min_signup: schedule.min_signup || 1,
                status: signupCount >= (schedule.min_signup || 1) ? 'active' : 'minimum_not_met'
            };
        });

        // Get additional metrics
        const pendingOrders = await Order.count({
            where: {
                payment_status: 'pending'
            }
        });

        const activeBookings = await Booking.count({
            where: {
                status: 'signup'
            },
            include: [
                {
                    model: Schedule,
                    where: {
                        date_start: {
                            [Op.gte]: todayDate
                        }
                    }
                }
            ]
        });

        const todayBookings = await Booking.count({
            where: {
                status: 'signup'
            },
            include: [
                {
                    model: Schedule,
                    where: {
                        date_start: todayDate
                    }
                }
            ]
        });

        res.json({
            success: true,
            message: 'Dashboard data retrieved successfully',
            data: {
                metrics: {
                    total_members: totalMembers,
                    total_classes: totalClasses,
                    total_revenue: totalRevenue || 0,
                    pending_orders: pendingOrders,
                    active_bookings: activeBookings,
                    today_bookings: todayBookings
                },
                today_classes: formattedTodayClasses,
                summary: {
                    total_today_classes: todayClasses.length,
                    active_today_classes: formattedTodayClasses.filter(c => c.status === 'active').length,
                    minimum_not_met_classes: formattedTodayClasses.filter(c => c.status === 'minimum_not_met').length
                }
            }
        });
    } catch (error) {
        logger.error('Error getting dashboard data:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get dashboard metrics only
const getDashboardMetrics = async (req, res) => {
    try {
        const today = new Date();
        const todayDate = today.toISOString().split('T')[0];

        // Get total members
        const totalMembers = await Member.count();

        // Get total classes (schedules)
        const totalClasses = await Schedule.count();

        // Get total revenue (sum of all paid orders)
        const totalRevenue = await Order.sum('total_amount', {
            where: {
                payment_status: 'paid'
            }
        });

        // Get additional metrics
        const pendingOrders = await Order.count({
            where: {
                payment_status: 'pending'
            }
        });

        const activeBookings = await Booking.count({
            where: {
                status: 'signup'
            },
            include: [
                {
                    model: Schedule,
                    where: {
                        date_start: {
                            [Op.gte]: todayDate
                        }
                    }
                }
            ]
        });

        const todayBookings = await Booking.count({
            where: {
                status: 'signup'
            },
            include: [
                {
                    model: Schedule,
                    where: {
                        date_start: todayDate
                    }
                }
            ]
        });

        res.json({
            success: true,
            message: 'Dashboard metrics retrieved successfully',
            data: {
                total_members: totalMembers,
                total_classes: totalClasses,
                total_revenue: totalRevenue || 0,
                pending_orders: pendingOrders,
                active_bookings: activeBookings,
                today_bookings: todayBookings
            }
        });
    } catch (error) {
        logger.error('Error getting dashboard metrics:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get today classes only
const getTodayClasses = async (req, res) => {
    try {
        const today = new Date();
        const todayDate = today.toISOString().split('T')[0];

        // Get today's classes with booking details
        const todayClasses = await Schedule.findAll({
            where: {
                date_start: todayDate
            },
            include: [
                {
                    model: Class,
                    attributes: ['id', 'class_name']
                },
                {
                    model: Trainer,
                    attributes: ['id', 'title']
                },
                {
                    model: Booking,
                    where: {
                        status: 'signup'
                    },
                    required: false,
                    attributes: ['id']
                }
            ],
            order: [['time_start', 'ASC']]
        });

        // Format today classes data
        const formattedTodayClasses = todayClasses.map((schedule, index) => {
            const signupCount = schedule.Bookings ? schedule.Bookings.length : 0;
            const maxCapacity = schedule.pax || 20;

            return {
                no: index + 1,
                id: schedule.id,
                class_date: new Date(schedule.date_start).toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                }),
                time: `${schedule.time_start} - ${schedule.time_end}`,
                course: schedule.Class?.class_name || 'Unknown Class',
                coach: schedule.Trainer?.title || 'Unknown Coach',
                pax: `${signupCount}/${maxCapacity}`,
                schedule_type: schedule.type,
                min_signup: schedule.min_signup || 1,
                status: signupCount >= (schedule.min_signup || 1) ? 'active' : 'minimum_not_met'
            };
        });

        res.json({
            success: true,
            message: 'Today classes retrieved successfully',
            data: {
                classes: formattedTodayClasses,
                summary: {
                    total_classes: todayClasses.length,
                    active_classes: formattedTodayClasses.filter(c => c.status === 'active').length,
                    minimum_not_met_classes: formattedTodayClasses.filter(c => c.status === 'minimum_not_met').length
                }
            }
        });
    } catch (error) {
        logger.error('Error getting today classes:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    getDashboardData,
    getDashboardMetrics,
    getTodayClasses
}; 