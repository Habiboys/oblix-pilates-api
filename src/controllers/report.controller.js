const { Member, Order, Payment, Schedule, Booking, Trainer, Class } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');

// Get revenue report
const getRevenueReport = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        // Set default date range if not provided (current month)
        const today = new Date();
        const startDate = start_date || new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        const endDate = end_date || new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

        // Get total members
        const totalMembers = await Member.count();

        // Get total payments
        const totalPayments = await Payment.count({
            where: {
                payment_status: 'success',
                createdAt: {
                    [Op.between]: [startDate, endDate + ' 23:59:59']
                }
            }
        });

        // Get total revenue
        const totalRevenue = await Order.sum('total_amount', {
            where: {
                payment_status: 'paid',
                paid_at: {
                    [Op.between]: [startDate, endDate + ' 23:59:59']
                }
            }
        });

        // Get payment details
        const payments = await Order.findAll({
            where: {
                payment_status: 'paid',
                paid_at: {
                    [Op.between]: [startDate, endDate + ' 23:59:59']
                }
            },
            include: [
                {
                    model: Member,
                    attributes: ['id', 'full_name']
                }
            ],
            order: [['paid_at', 'DESC']]
        });

        // Format payment data
        const formattedPayments = payments.map((order, index) => ({
            no: index + 1,
            payment_date: new Date(order.paid_at).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            }),
            payment_time: new Date(order.paid_at).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }),
            package_name: order.package_name,
            member_name: order.Member?.full_name || 'Unknown Member',
            payment_method: order.midtrans_payment_type || 'Unknown',
            price: parseFloat(order.total_amount)
        }));

        res.json({
            success: true,
            message: 'Revenue report retrieved successfully',
            data: {
                metrics: {
                    total_members: totalMembers,
                    total_payments: totalPayments,
                    total_revenue: totalRevenue || 0
                },
                payments: formattedPayments,
                date_range: {
                    start_date: startDate,
                    end_date: endDate
                }
            }
        });
    } catch (error) {
        logger.error('Error getting revenue report:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get payroll report
const getPayrollReport = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        // Set default date range if not provided (current month)
        const today = new Date();
        const startDate = start_date || new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        const endDate = end_date || new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

        // Get total instructors
        const totalInstructors = await Trainer.count();

        // Get total classes that actually happened (have signup bookings) in date range
        const totalClasses = await Schedule.count({
            where: {
                date_start: {
                    [Op.between]: [startDate, endDate]
                }
            },
            include: [
                {
                    model: Booking,
                    where: {
                        status: 'signup'
                    },
                    required: true // Only count schedules that have signup bookings
                }
            ]
        });

        // Get total pay by calculating from each trainer's rate
        const trainers = await Trainer.findAll({
            attributes: ['id', 'title', 'rate_per_class'],
            include: [
                {
                    model: Schedule,
                    where: {
                        date_start: {
                            [Op.between]: [startDate, endDate]
                        }
                    },
                    required: false,
                    include: [
                        {
                            model: Booking,
                            where: {
                                status: 'signup'
                            },
                            required: true // Only include schedules that have signup bookings
                        }
                    ]
                }
            ]
        });

        // Calculate total pay from all trainers
        let totalPay = 0;
        const formattedPayroll = trainers.map((trainer, index) => {
            const classes = trainer.Schedules || [];
            const totalClassCount = classes.length;
            const totalMemberCount = classes.reduce((sum, schedule) => {
                return sum + (schedule.Bookings ? schedule.Bookings.length : 0);
            }, 0);
            
            // Use trainer's rate_per_class, default to 500000 if not set
            const ratePerClass = trainer.rate_per_class || 500000;
            const totalSalary = totalClassCount * ratePerClass;
            
            // Add to total pay
            totalPay += totalSalary;

            return {
                no: index + 1,
                instructor_id: trainer.id,
                instructor_name: trainer.title,
                total_class: totalClassCount,
                total_member: totalMemberCount,
                rate_per_class: ratePerClass,
                payroll_date: new Date(startDate).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                }),
                total_salary: totalSalary
            };
        }).filter(payroll => payroll.total_class > 0); // Only show trainers with actual classes

        res.json({
            success: true,
            message: 'Payroll report retrieved successfully',
            data: {
                metrics: {
                    total_instructors: totalInstructors,
                    total_classes: totalClasses,
                    total_pay: totalPay
                },
                payroll: formattedPayroll,
                date_range: {
                    start_date: startDate,
                    end_date: endDate
                }
            }
        });
    } catch (error) {
        logger.error('Error getting payroll report:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get payroll detail by instructor
const getPayrollDetail = async (req, res) => {
    try {
        const { instructor_id } = req.params;
        const { start_date, end_date } = req.query;
        
        // Set default date range if not provided (current month)
        const today = new Date();
        const startDate = start_date || new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        const endDate = end_date || new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

        // Get trainer details
        const trainer = await Trainer.findByPk(instructor_id);
        if (!trainer) {
            return res.status(404).json({
                success: false,
                message: 'Instructor not found'
            });
        }

        // Get trainer's schedules with booking details - only classes that actually happened
        const schedules = await Schedule.findAll({
            where: {
                trainer_id: instructor_id,
                date_start: {
                    [Op.between]: [startDate, endDate]
                }
            },
            include: [
                {
                    model: Class,
                    attributes: ['id', 'class_name']
                },
                {
                    model: Booking,
                    where: {
                        status: 'signup'
                    },
                    required: true // Only include schedules that have signup bookings
                }
            ],
            order: [['date_start', 'ASC'], ['time_start', 'ASC']]
        });

        // Calculate totals
        const totalClassCount = schedules.length;
        const totalMemberCount = schedules.reduce((sum, schedule) => {
            return sum + (schedule.Bookings ? schedule.Bookings.length : 0);
        }, 0);
        
        // Use trainer's rate_per_class, default to 500000 if not set
        const ratePerClass = trainer.rate_per_class || 500000;
        const totalSalary = totalClassCount * ratePerClass;

        // Format class details
        const classDetails = schedules.map((schedule, index) => {
            const signupCount = schedule.Bookings ? schedule.Bookings.length : 0;
            const maxCapacity = schedule.type === 'semi_private' ? 4 : 
                               schedule.type === 'private' ? 1 : 20;

            return {
                no: index + 1,
                class_date: new Date(schedule.date_start).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                }),
                time: `${schedule.time_start} - ${schedule.time_end}`,
                course: schedule.Class?.class_name || 'Unknown Class',
                spot: `${signupCount}/${maxCapacity}`,
                schedule_type: schedule.type
            };
        });

        res.json({
            success: true,
            message: 'Payroll detail retrieved successfully',
            data: {
                instructor: {
                    id: trainer.id,
                    name: trainer.title
                },
                summary: {
                    total_class: totalClassCount,
                    total_member: totalMemberCount,
                    rate_per_class: ratePerClass,
                    payroll_date: new Date(startDate).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                    }),
                    total_salary: totalSalary
                },
                class_details: classDetails,
                date_range: {
                    start_date: startDate,
                    end_date: endDate
                }
            }
        });
    } catch (error) {
        logger.error('Error getting payroll detail:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    getRevenueReport,
    getPayrollReport,
    getPayrollDetail
}; 