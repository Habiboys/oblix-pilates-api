const { Member, Order, Payment, Schedule, Booking, Trainer, Class } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const { getTrainerRateByClassType } = require('../utils/trainerUtils');

// Get revenue report
const getRevenueReport = async (req, res) => {
    try {
        const { start_date, end_date, page = 1, limit = 10, search } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;
        
        // Set default date range if not provided (current month)
        const today = new Date();
        const startDate = start_date || new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        const endDate = end_date || new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

        // Get total members
        const totalMembers = await Member.count();

        // Get total payments from Order table (consistent with dashboard)
        const totalPayments = await Order.count({
            where: {
                payment_status: 'paid',
                createdAt: {
                    [Op.between]: [startDate + ' 00:00:00', endDate + ' 23:59:59']
                }
            }
        });

        // Get total revenue from Order table (consistent with dashboard)
        const totalRevenue = await Order.sum('total_amount', {
            where: {
                payment_status: 'paid',
                createdAt: {
                    [Op.between]: [startDate + ' 00:00:00', endDate + ' 23:59:59']
                }
            }
        });

        // Build search conditions for Order table
        const searchConditions = {
            payment_status: 'paid',
            createdAt: {
                [Op.between]: [startDate + ' 00:00:00', endDate + ' 23:59:59']
            }
        };

        // Add search conditions if search parameter is provided
        let includeConditions = [
            {
                model: Member,
                attributes: ['id', 'full_name']
            }
        ];

        if (search && search.trim()) {
            const searchTerm = `%${search.trim()}%`;
            searchConditions[Op.or] = [
                {
                    package_name: {
                        [Op.like]: searchTerm
                    }
                },
                {
                    '$Member.full_name$': {
                        [Op.like]: searchTerm
                    }
                }
            ];
        }

        // Get total count for pagination with search
        const totalPaymentsCount = await Order.count({
            where: searchConditions,
            include: includeConditions
        });

        // Get order details with Member information (with pagination and search)
        const orders = await Order.findAll({
            where: searchConditions,
            include: includeConditions,
            order: [['created_at', 'DESC']],
            limit: limitNum,
            offset: offset
        });

        // Calculate pagination info
        const totalPages = Math.ceil(totalPaymentsCount / limitNum);

        // Format order data
        const formattedPayments = orders.map((order, index) => ({
            no: offset + index + 1,
            payment_date: new Date(order.createdAt).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            }),
            payment_time: new Date(order.createdAt).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }),
            package_name: order.package_name || 'Unknown Package',
            member_name: order.Member?.full_name || 'Unknown Member',
            payment_method: order.midtrans_payment_type || 'Unknown',
            price: parseFloat(order.total_amount) || 0
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
                },
                pagination: {
                    current_page: pageNum,
                    total_pages: totalPages,
                    total_items: totalPaymentsCount,
                    items_per_page: limitNum,
                    has_next_page: pageNum < totalPages,
                    has_prev_page: pageNum > 1
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

        // Get total pay by calculating from each trainer's rate per class type
        const trainers = await Trainer.findAll({
            attributes: ['id', 'title', 'rate_per_class', 'rate_group_class', 'rate_semi_private_class', 'rate_private_class'],
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

        // Calculate total pay from all trainers with rate per class type
        let totalPay = 0;
        const formattedPayroll = await Promise.all(trainers.map(async (trainer, index) => {
            const classes = trainer.Schedules || [];
            const totalClassCount = classes.length;
            const totalMemberCount = classes.reduce((sum, schedule) => {
                return sum + (schedule.Bookings ? schedule.Bookings.length : 0);
            }, 0);
            
            // Calculate salary based on class type
            let totalSalary = 0;
            const classBreakdown = {
                group: 0,
                semi_private: 0,
                private: 0
            };
            
            for (const schedule of classes) {
                const classType = schedule.type;
                const rate = await getTrainerRateByClassType(trainer.id, classType);
                totalSalary += rate;
                
                // Count classes by type
                if (classType === 'group') {
                    classBreakdown.group++;
                } else if (classType === 'semi_private') {
                    classBreakdown.semi_private++;
                } else if (classType === 'private') {
                    classBreakdown.private++;
                }
            }
            
            // Add to total pay
            totalPay += totalSalary;

            return {
                no: index + 1,
                instructor_id: trainer.id,
                instructor_name: trainer.title,
                total_class: totalClassCount,
                total_member: totalMemberCount,
                class_breakdown: classBreakdown,
                rates: {
                    group_class: trainer.rate_group_class || trainer.rate_per_class || 250000,
                    semi_private_class: trainer.rate_semi_private_class || trainer.rate_per_class || 250000,
                    private_class: trainer.rate_private_class || trainer.rate_per_class || 275000
                },
                payroll_date: new Date(startDate).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                }),
                total_salary: totalSalary
            };
        }));
        
        // Filter out trainers with no classes
        const filteredPayroll = formattedPayroll.filter(payroll => payroll.total_class > 0);

        res.json({
            success: true,
            message: 'Payroll report retrieved successfully',
            data: {
                metrics: {
                    total_instructors: totalInstructors,
                    total_classes: totalClasses,
                    total_pay: totalPay
                },
                payroll: filteredPayroll,
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

        // Calculate totals with rate per class type
        const totalClassCount = schedules.length;
        const totalMemberCount = schedules.reduce((sum, schedule) => {
            return sum + (schedule.Bookings ? schedule.Bookings.length : 0);
        }, 0);
        
        // Calculate salary based on class type
        let totalSalary = 0;
        const classBreakdown = {
            group: 0,
            semi_private: 0,
            private: 0
        };
        
        for (const schedule of schedules) {
            const classType = schedule.type;
            const rate = await getTrainerRateByClassType(trainer.id, classType);
            totalSalary += rate;
            
            // Count classes by type
            if (classType === 'group') {
                classBreakdown.group++;
            } else if (classType === 'semi_private') {
                classBreakdown.semi_private++;
            } else if (classType === 'private') {
                classBreakdown.private++;
            }
        }

        // Format class details with rate per class
        const classDetails = await Promise.all(schedules.map(async (schedule, index) => {
            const signupCount = schedule.Bookings ? schedule.Bookings.length : 0;
                            const maxCapacity = schedule.pax || 20; 
                               schedule.type === 'private' ? 1 : 20;
            const classType = schedule.type;
            const rate = await getTrainerRateByClassType(trainer.id, classType);

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
                schedule_type: classType,
                rate_per_class: rate
            };
        }));

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
                    class_breakdown: classBreakdown,
                    rates: {
                        group_class: trainer.rate_group_class || trainer.rate_per_class || 250000,
                        semi_private_class: trainer.rate_semi_private_class || trainer.rate_per_class || 250000,
                        private_class: trainer.rate_private_class || trainer.rate_per_class || 275000
                    },
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