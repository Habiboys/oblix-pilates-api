const { Schedule, Class, Trainer, Member, Booking, User, Category, Package } = require('../models');
const { validateSessionAvailability, createSessionAllocation, getMemberSessionSummary } = require('../utils/sessionTrackingUtils');
const { autoCancelExpiredBookings, processWaitlistPromotion, getBookingStatistics } = require('../utils/bookingUtils');
const { validateTrainerScheduleConflict, validateMemberScheduleConflict } = require('../utils/scheduleUtils');

const ScheduleService = require('../services/schedule.service');
const whatsappService = require('../services/whatsapp.service');
const logger = require('../config/logger');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const { refreshDynamicCancelScheduling } = require('../cron/bookingCron');

// Fungsi untuk generate dates untuk weekly repeat
const generateWeeklyDates = (startDate, untilDate, repeatDays = []) => {
    const dates = [];
    const currentDate = new Date(startDate);
    const endDate = new Date(untilDate);
    
    // Jika tidak ada repeat_days, gunakan hari yang sama dengan startDate
    if (!repeatDays || repeatDays.length === 0) {
        const dayOfWeek = currentDate.getDay();
        repeatDays = [dayOfWeek];
    }
    
    while (currentDate <= endDate) {
        // Cek apakah hari ini termasuk dalam repeat_days
        const dayOfWeek = currentDate.getDay();
        if (repeatDays.includes(dayOfWeek)) {
            dates.push(new Date(currentDate));
        }
        currentDate.setDate(currentDate.getDate() + 1); // Tambah 1 hari
    }
    
    return dates;
};

// Fungsi untuk create multiple schedules untuk repeat
const createRepeatSchedules = async (scheduleData, repeatType, scheduleUntil, repeatDays = []) => {
    const schedules = [];
    
    if (repeatType === 'weekly' && scheduleUntil) {
        const dates = generateWeeklyDates(scheduleData.date_start, scheduleUntil, repeatDays);
        
        if (dates.length === 0) {
            throw new Error('No valid dates found for the specified repeat days');
        }
        
        // Buat schedule pertama sebagai main schedule
        const mainSchedule = await Schedule.create({
            ...scheduleData,
            date_start: dates[0].toISOString().split('T')[0],
            repeat_days: repeatDays
        });
        schedules.push(mainSchedule);
        
        // Buat schedule untuk tanggal-tanggal berikutnya
        const remainingDates = dates.slice(1);
        
        for (const date of remainingDates) {
            const schedule = await Schedule.create({
                ...scheduleData,
                date_start: date.toISOString().split('T')[0],
                repeat_type: 'none', // Set individual schedule sebagai 'none'
                schedule_until: null, // Set individual schedule sebagai null
                repeat_days: null, // Set individual schedule sebagai null
                parent_schedule_id: mainSchedule.id // Reference ke schedule utama
            });
            schedules.push(schedule);
        }
    } else {
        // Single schedule - gunakan date_start yang diberikan
        const schedule = await Schedule.create({
            ...scheduleData,
            repeat_days: repeatType === 'weekly' ? repeatDays : null
        });
        schedules.push(schedule);
    }
    
    return schedules;
};

// Get all group schedules with pagination and search
const getAllGroupSchedules = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', date, include_status = 'true' } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = ScheduleService.buildWhereClause('group', { search, date });

        const schedules = await Schedule.findAndCountAll({
            where: whereClause,
            include: ScheduleService.getIncludeAssociations('group', true), // Selalu include bookings
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['date_start', 'ASC'], ['time_start', 'ASC']]
        });

        // Format schedules dengan informasi detail
        const formattedSchedules = await Promise.all(schedules.rows.map(schedule => 
            include_status === 'true' 
                ? ScheduleService.formatScheduleDataWithStatus(schedule, true)
                : ScheduleService.formatScheduleData(schedule, true)
        ));

        const totalPages = Math.ceil(schedules.count / limit);

        res.status(200).json({
            success: true,
            message: 'Group schedules retrieved successfully',
            data: {
                schedules: formattedSchedules,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: totalPages,
                    totalItems: schedules.count,
                    itemsPerPage: parseInt(limit)
                },
                filters: {
                    search: search || null,
                    date: date || null
                }
            }
        });
    } catch (error) {
        console.error('Get all group schedules error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Terjadi kesalahan pada server' 
        });
    }
};

// Get single group schedule by ID
const getGroupScheduleById = async (req, res) => {
    try {
        const { id } = req.params;

        const schedule = await Schedule.findOne({
            where: { 
                id,
                type: 'group'
            },
            include: ScheduleService.getIncludeAssociations('group', true) // Selalu include bookings
        });

        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: 'Group schedule not found'
            });
        }

        const scheduleData = await ScheduleService.formatScheduleData(schedule, true);

        res.status(200).json({
            success: true,
            message: 'Group schedule retrieved successfully',
            data: scheduleData
        });
    } catch (error) {
        console.error('Get group schedule by ID error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Terjadi kesalahan pada server' 
        });
    }
};

// Create new group schedule
const createGroupSchedule = async (req, res) => {
    try {
        const {
            class_id,
            trainer_id,
            level,
            pax,
            date_start,
            time_start,
            time_end,
            repeat_type = 'none',
            schedule_until,
            booking_deadline_hour,

            min_signup,
            cancel_buffer_minutes,
            repeat_days // Added repeat_days
        } = req.body;

        // Validate class exists if provided (only required for group schedules)
        if (class_id) {
        const classData = await Class.findByPk(class_id);
        if (!classData) {
            return res.status(400).json({
                status: 'error',
                message: 'Class not found'
            });
            }
        }

        // Validate trainer exists
        const trainer = await Trainer.findByPk(trainer_id);
        if (!trainer) {
            return res.status(400).json({
                status: 'error',
                message: 'Trainer not found'
            });
        }

        // Validate level enum if provided
        if (level && !['Basic', 'Flow'].includes(level)) {
            return res.status(400).json({
                status: 'error',
                message: 'Level must be either Basic or Flow'
            });
        }

        // Validate repeat_type
        if (repeat_type === 'weekly' && !schedule_until) {
            return res.status(400).json({
                status: 'error',
                message: 'Schedule until date is required for weekly repeat'
            });
        }

        // date_start wajib untuk semua jenis schedule
        if (!date_start) {
            return res.status(400).json({
                status: 'error',
                message: 'date_start is required for all schedules'
            });
        }

        // Handle picture upload if exists
        let picture = null;
        if (req.file) {
            picture = req.file.filename;
        }

        // ✅ Business Logic Validation
        // Validate pax >= min_signup
        if (parseInt(pax) < parseInt(min_signup)) {
            return res.status(400).json({
                status: 'error',
                message: 'Pax must be greater than or equal to minimum signup'
            });
        }

        // Validate time_end > time_start
        const startTime = new Date(`2000-01-01T${time_start}`);
        const endTime = new Date(`2000-01-01T${time_end}`);
        if (endTime <= startTime) {
            return res.status(400).json({
                status: 'error',
                message: 'Time end must be after time start'
            });
        }

        // Validate schedule_until > date_start when repeat_type is weekly
        if (repeat_type === 'weekly' && schedule_until) {
            const startDate = new Date(date_start);
            const untilDate = new Date(schedule_until);
            if (untilDate <= startDate) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Schedule until date must be after date start'
                });
            }
        }

        // Validate booking_deadline_hour > cancel_buffer_minutes
        const deadlineHours = parseInt(booking_deadline_hour);
        const bufferMinutes = parseInt(cancel_buffer_minutes);
        const bufferHours = bufferMinutes / 60; // Convert minutes to hours
        
        // Jika cancel_buffer_minutes > 0, maka booking_deadline_hour harus > buffer_hours
        if (bufferMinutes > 0 && deadlineHours <= bufferHours) {
            return res.status(400).json({
                status: 'error',
                message: 'Booking deadline hour must be greater than cancel buffer time'
            });
        }

        // Create schedule data
        const scheduleData = {
            class_id,
            trainer_id,
            level,
            pax: parseInt(pax),
            type: 'group',
            date_start,
            time_start,
            time_end,
            repeat_type,
            schedule_until: repeat_type === 'weekly' ? schedule_until : null,
            booking_deadline_hour: parseInt(booking_deadline_hour),

            min_signup: parseInt(min_signup),
            cancel_buffer_minutes: parseInt(cancel_buffer_minutes),
            picture
        };

        // Create schedule(s) berdasarkan repeat type
        const createdSchedules = await createRepeatSchedules(scheduleData, repeat_type, schedule_until, repeat_days);

        // Cek konflik jadwal trainer untuk semua schedule yang akan dibuat
        for (const schedule of createdSchedules) {
            const trainerConflict = await validateTrainerScheduleConflict(
                trainer_id,
                schedule.date_start, // Gunakan date_start dari schedule yang akan dibuat
                time_start,
                time_end,
                schedule.id // Exclude schedule yang sedang dibuat
            );

            if (trainerConflict.hasConflict) {
                // Hapus schedule yang sudah dibuat jika ada konflik
                for (const createdSchedule of createdSchedules) {
                    await createdSchedule.destroy();
                }
                
                return res.status(400).json({
                    status: 'error',
                    message: `Trainer memiliki jadwal yang bentrok pada ${schedule.date_start}`,
                    data: {
                    conflicts: trainerConflict.conflicts
                    }
                });
            }
        }

        // Fetch created schedule dengan associations (ambil yang pertama untuk response)
        const createdSchedule = await Schedule.findByPk(createdSchedules[0].id, {
            include: [
                {
                    model: Class,
                    attributes: ['id', 'class_name', 'color_sign'],
                    include: [
                        {
                            model: Category,
                            attributes: ['id', 'category_name']
                        }
                    ]
                },
                {
                    model: Trainer,
                    attributes: ['id', 'title', 'picture', 'description']
                }
            ]
        });

        // Refresh dynamic cancel scheduling untuk schedule baru
        try {
            await refreshDynamicCancelScheduling();
            logger.info('✅ Dynamic cancel scheduling refreshed after creating group schedule');
        } catch (error) {
            logger.error('❌ Error refreshing dynamic cancel scheduling:', error);
        }

        res.status(201).json({
            message: `Group schedule created successfully${repeat_type === 'weekly' ? ` (${createdSchedules.length} schedules generated)` : ''}`,
            data: {
                schedule: createdSchedule,
                totalSchedules: createdSchedules.length,
                repeatType: repeat_type
            }
        });
    } catch (error) {
        // Delete uploaded file if error occurs
        if (req.file) {
            const filePath = path.join(__dirname, '../../uploads/schedules/', req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        console.error('Create group schedule error:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'Terjadi kesalahan pada server' 
        });
    }
};

// Update group schedule
const updateGroupSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            class_id,
            trainer_id,
            level,
            pax,
            date_start,
            time_start,
            time_end,
            repeat_type,
            schedule_until,
            booking_deadline_hour,
            
            min_signup,
            cancel_buffer_minutes,
            repeat_days // Added repeat_days
        } = req.body;

        const schedule = await Schedule.findOne({
            where: { 
                id,
                type: 'group'
            }
        });

        if (!schedule) {
            // Delete uploaded file if schedule not found
            if (req.file) {
                const filePath = path.join(__dirname, '../../uploads/schedules/', req.file.filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            return res.status(404).json({
                status: 'error',
                message: 'Group schedule not found'
            });
        }

        // Validate class exists if being updated
        if (class_id) {
            const classData = await Class.findByPk(class_id);
            if (!classData) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Class not found'
                });
            }
        }

        // Validate trainer exists if being updated
        if (trainer_id) {
            const trainer = await Trainer.findByPk(trainer_id);
            if (!trainer) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Trainer not found'
                });
            }
        }

        // Validate level enum if provided


        if (level && !['Basic', 'Flow'].includes(level)) {


            return res.status(400).json({


                status: 'error',


                message: 'Level must be either Basic or Flow'


            });


        }

        // Validate repeat_type
        if (repeat_type === 'weekly' && !schedule_until) {
            return res.status(400).json({
                status: 'error',
                message: 'Schedule until date is required for weekly repeat'
            });
        }

        // date_start wajib untuk semua jenis schedule
        if (!date_start) {
            return res.status(400).json({
                status: 'error',
                message: 'date_start is required for all schedules'
            });
        }

        const updateData = {};
        if (class_id !== undefined) updateData.class_id = class_id;
        if (trainer_id !== undefined) updateData.trainer_id = trainer_id;
        if (level !== undefined) updateData.level = level;
        if (pax !== undefined) updateData.pax = parseInt(pax);
        if (date_start !== undefined) updateData.date_start = date_start;
        if (time_start !== undefined) updateData.time_start = time_start;
        if (time_end !== undefined) updateData.time_end = time_end;
        if (repeat_type !== undefined) updateData.repeat_type = repeat_type;
        if (schedule_until !== undefined) updateData.schedule_until = repeat_type === 'weekly' ? schedule_until : null;
        if (booking_deadline_hour !== undefined) updateData.booking_deadline_hour = parseInt(booking_deadline_hour);
        
        if (min_signup !== undefined) updateData.min_signup = parseInt(min_signup);
        if (cancel_buffer_minutes !== undefined) updateData.cancel_buffer_minutes = parseInt(cancel_buffer_minutes);
        if (repeat_days !== undefined) updateData.repeat_days = repeat_type === 'weekly' ? repeat_days : null; // Update repeat_days

        // ✅ Business Logic Validation
        // Validate pax >= min_signup
        if (updateData.pax !== undefined && updateData.min_signup !== undefined) {
            if (updateData.pax < updateData.min_signup) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Pax must be greater than or equal to minimum signup'
                });
            }
        } else if (updateData.pax !== undefined && schedule.min_signup) {
            if (updateData.pax < schedule.min_signup) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Pax must be greater than or equal to minimum signup'
                });
            }
        } else if (updateData.min_signup !== undefined && schedule.pax) {
            if (schedule.pax < updateData.min_signup) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Pax must be greater than or equal to minimum signup'
                });
            }
        }

        // Validate booking_deadline_hour > cancel_buffer_minutes
        if (updateData.booking_deadline_hour !== undefined && updateData.cancel_buffer_minutes !== undefined) {
            const deadlineHours = updateData.booking_deadline_hour;
            const bufferMinutes = updateData.cancel_buffer_minutes;
            const bufferHours = bufferMinutes / 60; // Convert minutes to hours
            
            // Jika cancel_buffer_minutes > 0, maka booking_deadline_hour harus > buffer_hours
            if (bufferMinutes > 0 && deadlineHours <= bufferHours) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Booking deadline hour must be greater than cancel buffer time'
                });
            }
        } else if (updateData.booking_deadline_hour !== undefined && schedule.cancel_buffer_minutes) {
            const deadlineHours = updateData.booking_deadline_hour;
            const bufferMinutes = schedule.cancel_buffer_minutes;
            const bufferHours = bufferMinutes / 60;
            
            // Jika cancel_buffer_minutes > 0, maka booking_deadline_hour harus > buffer_hours
            if (bufferMinutes > 0 && deadlineHours <= bufferHours) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Booking deadline hour must be greater than cancel buffer time'
                });
            }
        } else if (updateData.cancel_buffer_minutes !== undefined && schedule.booking_deadline_hour) {
            const deadlineHours = schedule.booking_deadline_hour;
            const bufferMinutes = updateData.cancel_buffer_minutes;
            const bufferHours = bufferMinutes / 60;
            
            // Jika cancel_buffer_minutes > 0, maka booking_deadline_hour harus > buffer_hours
            if (bufferMinutes > 0 && deadlineHours <= bufferHours) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Booking deadline hour must be greater than cancel buffer time'
                });
            }
        }

        // Validate time_end > time_start
        if (updateData.time_start !== undefined && updateData.time_end !== undefined) {
            const startTime = new Date(`2000-01-01T${updateData.time_start}`);
            const endTime = new Date(`2000-01-01T${updateData.time_end}`);
            
            if (endTime <= startTime) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Time end must be after time start'
                });
            }
        } else if (updateData.time_start !== undefined && schedule.time_end) {
            const startTime = new Date(`2000-01-01T${updateData.time_start}`);
            const endTime = new Date(`2000-01-01T${schedule.time_end}`);
            
            if (endTime <= startTime) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Time end must be after time start'
                });
            }
        } else if (updateData.time_end !== undefined && schedule.time_start) {
            const startTime = new Date(`2000-01-01T${schedule.time_start}`);
            const endTime = new Date(`2000-01-01T${updateData.time_end}`);
            
            if (endTime <= startTime) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Time end must be after time start'
                });
            }
        }

        // Validate schedule_until > date_start when repeat_type is weekly
        if (updateData.repeat_type === 'weekly' && updateData.date_start !== undefined && updateData.schedule_until) {
            const startDate = new Date(updateData.date_start);
            const untilDate = new Date(updateData.schedule_until);
            
            if (untilDate <= startDate) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Schedule until date must be after date start'
                });
            }
        } else if (updateData.repeat_type === 'weekly' && updateData.schedule_until && schedule.date_start) {
            const startDate = new Date(schedule.date_start);
            const untilDate = new Date(updateData.schedule_until);
            
            if (untilDate <= startDate) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Schedule until date must be after date start'
                });
            }
        } else if (updateData.repeat_type === 'weekly' && updateData.date_start && schedule.schedule_until) {
            const startDate = new Date(updateData.date_start);
            const untilDate = new Date(schedule.schedule_until);
            
            if (untilDate <= startDate) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Schedule until date must be after date start'
                });
            }
        }

        // Handle picture update
        if (req.file) {
            // Delete old picture if exists
            if (schedule.picture) {
                const oldPicturePath = path.join(__dirname, '../../uploads/schedules/', schedule.picture);
                if (fs.existsSync(oldPicturePath)) {
                    fs.unlinkSync(oldPicturePath);
                }
            }
            updateData.picture = req.file.filename;
        }

        await schedule.update(updateData);

        // Refresh dynamic cancel scheduling untuk schedule yang diupdate
        try {
            await refreshDynamicCancelScheduling();
            logger.info('✅ Dynamic cancel scheduling refreshed after updating group schedule');
        } catch (error) {
            logger.error('❌ Error refreshing dynamic cancel scheduling:', error);
        }

        // Fetch updated schedule with associations
        const updatedSchedule = await Schedule.findByPk(schedule.id, {
            include: [
                {
                    model: Class,
                    attributes: ['id', 'class_name', 'color_sign']
                },
                {
                    model: Trainer,
                    attributes: ['id', 'title', 'picture', 'description']
                }
            ]
        });

        res.status(200).json({
            message: 'Group schedule updated successfully',
            data: updatedSchedule
        });
    } catch (error) {
        // Delete uploaded file if error occurs
        if (req.file) {
            const filePath = path.join(__dirname, '../../uploads/schedules/', req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        console.error('Update group schedule error:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'Terjadi kesalahan pada server' 
        });
    }
};

// Delete group schedule
const deleteGroupSchedule = async (req, res) => {
    try {
        const { id } = req.params;

        const schedule = await Schedule.findOne({
            where: { 
                id,
                type: 'group'
            }
        });

        if (!schedule) {
            return res.status(404).json({
                status: 'error',
                message: 'Group schedule not found'
            });
        }

        // Delete picture file if exists
        if (schedule.picture) {
            const picturePath = path.join(__dirname, '../../uploads/schedules/', schedule.picture);
            if (fs.existsSync(picturePath)) {
                fs.unlinkSync(picturePath);
            }
        }

        await schedule.destroy();

        res.status(200).json({
            message: 'Group schedule deleted successfully'
        });
    } catch (error) {
        console.error('Delete group schedule error:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'Terjadi kesalahan pada server' 
        });
    }
};

// Get all semi-private schedules with pagination and search
const getAllSemiPrivateSchedules = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', date, include_status = 'true' } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = ScheduleService.buildWhereClause('semi_private', { search, date });

        const schedules = await Schedule.findAndCountAll({
            where: whereClause,
            include: ScheduleService.getIncludeAssociations('semi_private', true), // Selalu include bookings
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['date_start', 'ASC'], ['time_start', 'ASC']]
        });

        // Format schedules dengan informasi detail
        const formattedSchedules = await Promise.all(schedules.rows.map(schedule => 
            include_status === 'true' 
                ? ScheduleService.formatScheduleDataWithStatus(schedule, true)
                : ScheduleService.formatScheduleData(schedule, true)
        ));

        const totalPages = Math.ceil(schedules.count / limit);

        res.status(200).json({
            success: true,
            message: 'Semi-private schedules retrieved successfully',
            data: {
                schedules: formattedSchedules,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: totalPages,
                    totalItems: schedules.count,
                    itemsPerPage: parseInt(limit)
                },
                filters: {
                    search: search || null,
                    date: date || null
                }
            }
        });
    } catch (error) {
        console.error('Get all semi-private schedules error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Terjadi kesalahan pada server' 
        });
    }
};

// Get single semi-private schedule by ID
const getSemiPrivateScheduleById = async (req, res) => {
    try {
        const { id } = req.params;

        const schedule = await Schedule.findOne({
            where: { 
                id,
                type: 'semi_private'
            },
            include: ScheduleService.getIncludeAssociations('semi_private', true) // Selalu include bookings
        });

        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: 'Semi-private schedule not found'
            });
        }

        const scheduleData = await ScheduleService.formatScheduleData(schedule, true);

        res.status(200).json({
            success: true,
            message: 'Semi-private schedule retrieved successfully',
            data: scheduleData
        });
    } catch (error) {
        console.error('Get semi-private schedule by ID error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Terjadi kesalahan pada server' 
        });
    }
};

// Create new semi-private schedule
const createSemiPrivateSchedule = async (req, res) => {
    try {
        const {
            class_id,
            trainer_id,
            level,
            // pax removed - default to 2 for semi-private
            date_start,
            time_start,
            time_end,
            repeat_type = 'none',
            schedule_until,
            booking_deadline_hour,
            
            min_signup,
            cancel_buffer_minutes,
            repeat_days // Added repeat_days
        } = req.body;

        // Set default pax for semi-private schedule
        const pax = 2;

        // Validate class exists if provided (only required for group schedules)
        if (class_id) {
        const classData = await Class.findByPk(class_id);
        if (!classData) {
            return res.status(400).json({
                status: 'error',
                message: 'Class not found'
            });
            }
        }

        // Validate trainer exists
        const trainer = await Trainer.findByPk(trainer_id);
        if (!trainer) {
            return res.status(400).json({
                status: 'error',
                message: 'Trainer not found'
            });
        }

        // Validate level enum if provided
        if (level && !['Basic', 'Flow'].includes(level)) {
            return res.status(400).json({
                status: 'error',
                message: 'Level must be either Basic or Flow'
            });
        }

        // Validate repeat_type
        if (repeat_type === 'weekly' && !schedule_until) {
            return res.status(400).json({
                status: 'error',
                message: 'Schedule until date is required for weekly repeat'
            });
        }

        // date_start wajib untuk semua jenis schedule
        if (!date_start) {
            return res.status(400).json({
                status: 'error',
                message: 'date_start is required for all schedules'
            });
        }

        // Handle picture upload if exists
        let picture = null;
        if (req.file) {
            picture = req.file.filename;
        }

        // ✅ Business Logic Validation
        // Validate pax >= min_signup
        if (parseInt(pax) < parseInt(min_signup)) {
            return res.status(400).json({
                status: 'error',
                message: 'Pax must be greater than or equal to minimum signup'
            });
        }

        // Validate time_end > time_start
        const startTime = new Date(`2000-01-01T${time_start}`);
        const endTime = new Date(`2000-01-01T${time_end}`);
        if (endTime <= startTime) {
            return res.status(400).json({
                status: 'error',
                message: 'Time end must be after time start'
            });
        }

        // Validate schedule_until > date_start when repeat_type is weekly
        if (repeat_type === 'weekly' && schedule_until) {
            const startDate = new Date(date_start);
            const untilDate = new Date(schedule_until);
            if (untilDate <= startDate) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Schedule until date must be after date start'
                });
            }
        }

        // Validate booking_deadline_hour > cancel_buffer_minutes
        const deadlineHours = parseInt(booking_deadline_hour);
        const bufferMinutes = parseInt(cancel_buffer_minutes);
        const bufferHours = bufferMinutes / 60; // Convert minutes to hours
        
        // Jika cancel_buffer_minutes > 0, maka booking_deadline_hour harus > buffer_hours
        if (bufferMinutes > 0 && deadlineHours <= bufferHours) {
            return res.status(400).json({
                status: 'error',
                message: 'Booking deadline hour must be greater than cancel buffer time'
            });
        }

        // Create schedule data
        const scheduleData = {
            class_id,
            trainer_id,
            level,
            pax: parseInt(pax),
            type: 'semi_private',
            date_start,
            time_start,
            time_end,
            repeat_type,
            schedule_until: repeat_type === 'weekly' ? schedule_until : null,
            booking_deadline_hour: parseInt(booking_deadline_hour),
            
            min_signup: parseInt(min_signup),
            cancel_buffer_minutes: parseInt(cancel_buffer_minutes),
            picture
        };

        // Create schedule(s) berdasarkan repeat type
        const createdSchedules = await createRepeatSchedules(scheduleData, repeat_type, schedule_until, repeat_days);

        // Cek konflik jadwal trainer untuk semua schedule yang akan dibuat
        for (const schedule of createdSchedules) {
            const trainerConflict = await validateTrainerScheduleConflict(
                trainer_id,
                schedule.date_start, // Gunakan date_start dari schedule yang akan dibuat
                time_start,
                time_end,
                schedule.id // Exclude schedule yang sedang dibuat
            );

            if (trainerConflict.hasConflict) {
                // Hapus schedule yang sudah dibuat jika ada konflik
                for (const createdSchedule of createdSchedules) {
                    await createdSchedule.destroy();
                }
                
                return res.status(400).json({
                    status: 'error',
                    message: `Trainer memiliki jadwal yang bentrok pada ${schedule.date_start}`,
                    data: {
                        conflicts: trainerConflict.conflicts
                    }
                });
            }
        }

        // Fetch created schedule dengan associations (ambil yang pertama untuk response)
        const createdSchedule = await Schedule.findByPk(createdSchedules[0].id, {
            include: [
                {
                    model: Class,
                    attributes: ['id', 'class_name', 'color_sign']
                },
                {
                    model: Trainer,
                    attributes: ['id', 'title', 'picture', 'description']
                }
            ]
        });

        // Refresh dynamic cancel scheduling untuk schedule baru
        try {
            await refreshDynamicCancelScheduling();
            logger.info('✅ Dynamic cancel scheduling refreshed after creating semi-private schedule');
        } catch (error) {
            logger.error('❌ Error refreshing dynamic cancel scheduling:', error);
        }

        res.status(201).json({
            message: `Semi-private schedule created successfully${repeat_type === 'weekly' ? ` (${createdSchedules.length} schedules generated)` : ''}`,
            data: {
                schedule: createdSchedule,
                totalSchedules: createdSchedules.length,
                repeatType: repeat_type
            }
        });
    } catch (error) {
        // Delete uploaded file if error occurs
        if (req.file) {
            const filePath = path.join(__dirname, '../../uploads/schedules/', req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        console.error('Create semi-private schedule error:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'Terjadi kesalahan pada server' 
        });
    }
};

// Update semi-private schedule
const updateSemiPrivateSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            class_id,
            trainer_id,
            level,
            // pax removed for semi-private - always use 2
            date_start,
            time_start,
            time_end,
            repeat_type,
            schedule_until,
            booking_deadline_hour,
            
            min_signup,
            cancel_buffer_minutes,
            repeat_days // Added repeat_days
        } = req.body;

        const schedule = await Schedule.findOne({
            where: { 
                id,
                type: 'semi_private'
            }
        });

        if (!schedule) {
            // Delete uploaded file if schedule not found
            if (req.file) {
                const filePath = path.join(__dirname, '../../uploads/schedules/', req.file.filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            return res.status(404).json({
                status: 'error',
                message: 'Semi-private schedule not found'
            });
        }

        // Validate class exists if being updated
        if (class_id) {
            const classData = await Class.findByPk(class_id);
            if (!classData) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Class not found'
                });
            }
        }

        // Validate trainer exists if being updated
        if (trainer_id) {
            const trainer = await Trainer.findByPk(trainer_id);
            if (!trainer) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Trainer not found'
                });
            }
        }

        // Validate level enum if provided


        if (level && !['Basic', 'Flow'].includes(level)) {


            return res.status(400).json({


                status: 'error',


                message: 'Level must be either Basic or Flow'


            });


        }

        // Validate repeat_type
        if (repeat_type === 'weekly' && !schedule_until) {
            return res.status(400).json({
                status: 'error',
                message: 'Schedule until date is required for weekly repeat'
            });
        }

        // date_start wajib untuk semua jenis schedule
        if (!date_start) {
            return res.status(400).json({
                status: 'error',
                message: 'date_start is required for all schedules'
            });
        }

        const updateData = {};
        if (class_id !== undefined) updateData.class_id = class_id;
        if (trainer_id !== undefined) updateData.trainer_id = trainer_id;
        if (level !== undefined) updateData.level = level;
        // pax is fixed at 2 for semi-private schedules, cannot be updated
        if (date_start !== undefined) updateData.date_start = date_start;
        if (time_start !== undefined) updateData.time_start = time_start;
        if (time_end !== undefined) updateData.time_end = time_end;
        if (repeat_type !== undefined) updateData.repeat_type = repeat_type;
        if (schedule_until !== undefined) updateData.schedule_until = repeat_type === 'weekly' ? schedule_until : null;
        if (booking_deadline_hour !== undefined) updateData.booking_deadline_hour = parseInt(booking_deadline_hour);
        
        if (min_signup !== undefined) updateData.min_signup = parseInt(min_signup);
        if (cancel_buffer_minutes !== undefined) updateData.cancel_buffer_minutes = parseInt(cancel_buffer_minutes);
        if (repeat_days !== undefined) updateData.repeat_days = repeat_type === 'weekly' ? repeat_days : null; // Update repeat_days

        // ✅ Business Logic Validation for Semi-Private Schedule Update
        // Validate pax >= min_signup
        if (updateData.pax !== undefined && updateData.min_signup !== undefined) {
            if (updateData.pax < updateData.min_signup) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Pax must be greater than or equal to minimum signup'
                });
            }
        } else if (updateData.pax !== undefined && schedule.min_signup) {
            if (updateData.pax < schedule.min_signup) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Pax must be greater than or equal to minimum signup'
                });
            }
        } else if (updateData.min_signup !== undefined && schedule.pax) {
            if (schedule.pax < updateData.min_signup) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Pax must be greater than or equal to minimum signup'
                });
            }
        }

        // Validate booking_deadline_hour > cancel_buffer_minutes
        if (updateData.booking_deadline_hour !== undefined && updateData.cancel_buffer_minutes !== undefined) {
            const deadlineHours = updateData.booking_deadline_hour;
            const bufferMinutes = updateData.cancel_buffer_minutes;
            const bufferHours = bufferMinutes / 60; // Convert minutes to hours
            
            // Jika cancel_buffer_minutes > 0, maka booking_deadline_hour harus > buffer_hours
            if (bufferMinutes > 0 && deadlineHours <= bufferHours) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Booking deadline hour must be greater than cancel buffer time'
                });
            }
        } else if (updateData.booking_deadline_hour !== undefined && schedule.cancel_buffer_minutes) {
            const deadlineHours = updateData.booking_deadline_hour;
            const bufferMinutes = schedule.cancel_buffer_minutes;
            const bufferHours = bufferMinutes / 60;
            
            // Jika cancel_buffer_minutes > 0, maka booking_deadline_hour harus > buffer_hours
            if (bufferMinutes > 0 && deadlineHours <= bufferHours) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Booking deadline hour must be greater than cancel buffer time'
                });
            }
        } else if (updateData.cancel_buffer_minutes !== undefined && schedule.booking_deadline_hour) {
            const deadlineHours = schedule.booking_deadline_hour;
            const bufferMinutes = updateData.cancel_buffer_minutes;
            const bufferHours = bufferMinutes / 60;
            
            // Jika cancel_buffer_minutes > 0, maka booking_deadline_hour harus > buffer_hours
            if (bufferMinutes > 0 && deadlineHours <= bufferHours) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Booking deadline hour must be greater than cancel buffer time'
                });
            }
        }

        // Validate time_end > time_start
        if (updateData.time_start !== undefined && updateData.time_end !== undefined) {
            const startTime = new Date(`2000-01-01T${updateData.time_start}`);
            const endTime = new Date(`2000-01-01T${updateData.time_end}`);
            
            if (endTime <= startTime) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Time end must be after time start'
                });
            }
        } else if (updateData.time_start !== undefined && schedule.time_end) {
            const startTime = new Date(`2000-01-01T${updateData.time_start}`);
            const endTime = new Date(`2000-01-01T${schedule.time_end}`);
            
            if (endTime <= startTime) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Time end must be after time start'
                });
            }
        } else if (updateData.time_end !== undefined && schedule.time_start) {
            const startTime = new Date(`2000-01-01T${schedule.time_start}`);
            const endTime = new Date(`2000-01-01T${updateData.time_end}`);
            
            if (endTime <= startTime) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Time end must be after time start'
                });
            }
        }

        // Validate schedule_until > date_start when repeat_type is weekly
        if (updateData.repeat_type === 'weekly' && updateData.date_start !== undefined && updateData.schedule_until) {
            const startDate = new Date(updateData.date_start);
            const untilDate = new Date(updateData.schedule_until);
            
            if (untilDate <= startDate) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Schedule until date must be after date start'
                });
            }
        } else if (updateData.repeat_type === 'weekly' && updateData.schedule_until && schedule.date_start) {
            const startDate = new Date(schedule.date_start);
            const untilDate = new Date(updateData.schedule_until);
            
            if (untilDate <= startDate) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Schedule until date must be after date start'
                });
            }
        } else if (updateData.repeat_type === 'weekly' && updateData.date_start && schedule.schedule_until) {
            const startDate = new Date(updateData.date_start);
            const untilDate = new Date(schedule.schedule_until);
            
            if (untilDate <= startDate) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Schedule until date must be after date start'
                });
            }
        }

        // Handle picture update
        if (req.file) {
            // Delete old picture if exists
            if (schedule.picture) {
                const oldPicturePath = path.join(__dirname, '../../uploads/schedules/', schedule.picture);
                if (fs.existsSync(oldPicturePath)) {
                    fs.unlinkSync(oldPicturePath);
                }
            }
            updateData.picture = req.file.filename;
        }

        await schedule.update(updateData);

        // Refresh dynamic cancel scheduling untuk schedule yang diupdate
        try {
            await refreshDynamicCancelScheduling();
            logger.info('✅ Dynamic cancel scheduling refreshed after updating semi-private schedule');
        } catch (error) {
            logger.error('❌ Error refreshing dynamic cancel scheduling:', error);
        }

        // Fetch updated schedule with associations
        const updatedSchedule = await Schedule.findByPk(schedule.id, {
            include: [
                {
                    model: Class,
                    attributes: ['id', 'class_name', 'color_sign']
                },
                {
                    model: Trainer,
                    attributes: ['id', 'title', 'picture', 'description']
                }
            ]
        });

        res.status(200).json({
            message: 'Semi-private schedule updated successfully',
            data: updatedSchedule
        });
    } catch (error) {
        // Delete uploaded file if error occurs
        if (req.file) {
            const filePath = path.join(__dirname, '../../uploads/schedules/', req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        console.error('Update semi-private schedule error:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'Terjadi kesalahan pada server' 
        });
    }
};

// Delete semi-private schedule
const deleteSemiPrivateSchedule = async (req, res) => {
    try {
        const { id } = req.params;

        const schedule = await Schedule.findOne({
            where: { 
                id,
                type: 'semi_private'
            }
        });

        if (!schedule) {
            return res.status(404).json({
                status: 'error',
                message: 'Semi-private schedule not found'
            });
        }

        // Delete picture file if exists
        if (schedule.picture) {
            const picturePath = path.join(__dirname, '../../uploads/schedules/', schedule.picture);
            if (fs.existsSync(picturePath)) {
                fs.unlinkSync(picturePath);
            }
        }

        await schedule.destroy();

        res.status(200).json({
            message: 'Semi-private schedule deleted successfully'
        });
    } catch (error) {
        console.error('Delete semi-private schedule error:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'Terjadi kesalahan pada server' 
        });
    }
};

// Get all private schedules with pagination and search
const getAllPrivateSchedules = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', date, include_status = 'true' } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = ScheduleService.buildWhereClause('private', { search, date });

        const schedules = await Schedule.findAndCountAll({
            where: whereClause,
            include: ScheduleService.getIncludeAssociations('private', true), // Selalu include bookings
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['date_start', 'ASC'], ['time_start', 'ASC']]
        });

        // Format schedules dengan informasi detail
        const formattedSchedules = await Promise.all(schedules.rows.map(schedule => 
            include_status === 'true' 
                ? ScheduleService.formatScheduleDataWithStatus(schedule, true)
                : ScheduleService.formatScheduleData(schedule, true)
        ));

        const totalPages = Math.ceil(schedules.count / limit);

        res.status(200).json({
            success: true,
            message: 'Private schedules retrieved successfully',
            data: {
                schedules: formattedSchedules,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: totalPages,
                    totalItems: schedules.count,
                    itemsPerPage: parseInt(limit)
                },
                filters: {
                    search: search || null,
                    date: date || null
                }
            }
        });
    } catch (error) {
        console.error('Get all private schedules error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Terjadi kesalahan pada server' 
        });
    }
};

// Get single private schedule by ID
const getPrivateScheduleById = async (req, res) => {
    try {
        const { id } = req.params;

        const schedule = await Schedule.findOne({
            where: { 
                id,
                type: 'private'
            },
            include: ScheduleService.getIncludeAssociations('private', true) // Selalu include bookings
        });

        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: 'Private schedule not found'
            });
        }

        const scheduleData = await ScheduleService.formatScheduleData(schedule, true);

        res.status(200).json({
            success: true,
            message: 'Private schedule retrieved successfully',
            data: scheduleData
        });
    } catch (error) {
        console.error('Get private schedule by ID error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Terjadi kesalahan pada server' 
        });
    }
};

// Create new private schedule with auto booking
const createPrivateSchedule = async (req, res) => {
    try {
        logger.info('🚀 Starting createPrivateSchedule with data:', {
            body: req.body,
            user: req.user?.id
        });

        const {
            class_id,
            trainer_id,
            level,
            member_id, // Member yang akan di-assign
            date_start,
            time_start,
            time_end,
            repeat_type = 'none',
            schedule_until,
            booking_deadline_hour,
            
            min_signup,
            cancel_buffer_minutes,
            repeat_days // Added repeat_days
        } = req.body;

        logger.info('📋 Validating input data...');

        // Validate class exists if provided (only required for group schedules)
        if (class_id) {
        const classData = await Class.findByPk(class_id);
        if (!classData) {
            logger.warn('❌ Class not found:', class_id);
            return res.status(400).json({
                status: 'error',
                message: 'Class not found'
            });
        }
        logger.info('✅ Class validated:', classData.class_name);
        }

        // Validate trainer exists
        const trainer = await Trainer.findByPk(trainer_id);
        if (!trainer) {
            logger.warn('❌ Trainer not found:', trainer_id);
            return res.status(400).json({
                status: 'error',
                message: 'Trainer not found'
            });
        }
        logger.info('✅ Trainer validated:', trainer.title);

        // Validate level enum if provided
        if (level && !['Basic', 'Flow'].includes(level)) {
            logger.warn('❌ Invalid level:', level);
            return res.status(400).json({
                status: 'error',
                message: 'Level must be either Basic or Flow'
            });
        }
        if (level) {
            logger.info('✅ Level validated:', level);
        }

        // Validate member exists
        const member = await Member.findByPk(member_id, {
            include: [
                {
                    model: User,
                    attributes: ['id', 'email']
                }
            ]
        });
        if (!member) {
            logger.warn('❌ Member not found:', member_id);
            return res.status(400).json({
                status: 'error',
                message: 'Member not found'
            });
        }
        logger.info('✅ Member validated:', member.full_name);

        // Validasi konflik jadwal akan dilakukan setelah schedule dibuat

        // Validate repeat_type
        if (repeat_type === 'weekly' && !schedule_until) {
            logger.warn('❌ Schedule until date is required for weekly repeat');
            return res.status(400).json({
                status: 'error',
                message: 'Schedule until date is required for weekly repeat'
            });
        }

        // date_start wajib untuk semua jenis schedule
        if (!date_start) {
            logger.warn('❌ date_start is required for all schedules');
            return res.status(400).json({
                status: 'error',
                message: 'date_start is required for all schedules'
            });
        }

        // Handle picture upload if exists
        let picture = null;
        if (req.file) {
            picture = req.file.filename;
            logger.info('📸 Picture uploaded:', picture);
        }

        // ✅ Business Logic Validation for Private Schedule
        // Validate pax >= min_signup (private schedule pax = 1, min_signup = 1 or 2)
        if (parseInt(min_signup) > 1) {
            return res.status(400).json({
                status: 'error',
                message: 'For private schedule, minimum signup cannot exceed 1 (pax is always 1)'
            });
        }

        // Validate time_end > time_start
        const startTime = new Date(`2000-01-01T${time_start}`);
        const endTime = new Date(`2000-01-01T${time_end}`);
        if (endTime <= startTime) {
            return res.status(400).json({
                status: 'error',
                message: 'Time end must be after time start'
            });
        }

        // Validate schedule_until > date_start when repeat_type is weekly
        if (repeat_type === 'weekly' && schedule_until) {
            const startDate = new Date(date_start);
            const untilDate = new Date(schedule_until);
            if (untilDate <= startDate) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Schedule until date must be after date start'
                });
            }
        }

        // Validate booking_deadline_hour > cancel_buffer_minutes
        const deadlineHours = parseInt(booking_deadline_hour);
        const bufferMinutes = parseInt(cancel_buffer_minutes);
        const bufferHours = bufferMinutes / 60; // Convert minutes to hours
        
        // Jika cancel_buffer_minutes > 0, maka booking_deadline_hour harus > buffer_hours
        if (bufferMinutes > 0 && deadlineHours <= bufferHours) {
            return res.status(400).json({
                status: 'error',
                message: 'Booking deadline hour must be greater than cancel buffer time'
            });
        }

        // Create schedule data
        const scheduleData = {
            class_id,
            trainer_id,
            level,
            member_id, // Assign member langsung
            pax: 1, // Private schedule selalu pax = 1
            type: 'private',
            date_start,
            time_start,
            time_end,
            repeat_type,
            schedule_until: repeat_type === 'weekly' ? schedule_until : null,
            booking_deadline_hour: parseInt(booking_deadline_hour),
            
            min_signup: parseInt(min_signup),
            cancel_buffer_minutes: parseInt(cancel_buffer_minutes),
            picture
        };

        logger.info('📅 Creating schedule(s) with data:', scheduleData);

        // Create schedule(s) berdasarkan repeat type
        const createdSchedules = await createRepeatSchedules(scheduleData, repeat_type, schedule_until, repeat_days);
        logger.info(`✅ Created ${createdSchedules.length} schedule(s)`);

        // Cek konflik jadwal trainer dan member untuk semua schedule yang akan dibuat
        for (const schedule of createdSchedules) {
            logger.info(`🔍 Checking conflicts for schedule: ${schedule.id} on ${schedule.date_start}`);
            
            // Cek konflik trainer
            const trainerConflict = await validateTrainerScheduleConflict(
                trainer_id,
                schedule.date_start,
                time_start,
                time_end,
                schedule.id
            );

            if (trainerConflict.hasConflict) {
                logger.warn('❌ Trainer conflict detected:', trainerConflict.conflicts);
                // Hapus schedule yang sudah dibuat jika ada konflik
                for (const createdSchedule of createdSchedules) {
                    await createdSchedule.destroy();
                }
                
                return res.status(400).json({
                    status: 'error',
                    message: `Trainer memiliki jadwal yang bentrok pada ${schedule.date_start}`,
                    data: {
                        conflicts: trainerConflict.conflicts
                    }
                });
            }
            logger.info('✅ No trainer conflicts');

            // Cek konflik member
            const memberConflict = await validateMemberScheduleConflict(
                member_id,
                schedule.date_start,
                time_start,
                time_end
            );

            if (memberConflict.hasConflict) {
                logger.warn('❌ Member conflict detected:', memberConflict.conflicts);
                // Hapus schedule yang sudah dibuat jika ada konflik
                for (const createdSchedule of createdSchedules) {
                    await createdSchedule.destroy();
                }
                
                return res.status(400).json({
                    status: 'error',
                    message: `Member memiliki jadwal yang bentrok pada ${schedule.date_start}`,
                    data: {
                        conflicts: memberConflict.conflicts
                    }
                });
            }
            logger.info('✅ No member conflicts');
        }

        // Cek jatah sesi member sebelum booking
        logger.info(`🔍 Checking session availability for member: ${member_id}, required: ${createdSchedules.length}`);
        const sessionValidation = await validateSessionAvailability(member_id, createdSchedules.length);
        
        if (!sessionValidation.isValid) {
            logger.warn('❌ Insufficient sessions:', sessionValidation);
            return res.status(400).json({
                status: 'error',
                message: 'Member tidak memiliki jatah sesi yang cukup untuk booking',
                data: {
                    member_id: member_id,
                    required_sessions: createdSchedules.length,
                    available_sessions: sessionValidation.totalAvailableSessions,
                    deficit: sessionValidation.deficit,
                    package_details: sessionValidation.packageDetails
                }
            });
        }
        logger.info('✅ Session validation passed');

        // Buat alokasi sesi untuk booking
        logger.info('📦 Creating session allocation...');
        const sessionAllocation = await createSessionAllocation(member_id, createdSchedules.length);
        logger.info(`✅ Session allocation created: ${sessionAllocation.length} allocations`);

        // Auto booking untuk setiap schedule yang dibuat
        logger.info('📝 Creating auto bookings...');
        const bookings = [];
        for (let i = 0; i < createdSchedules.length; i++) {
            const schedule = createdSchedules[i];
            const allocation = sessionAllocation[i];

            const booking = await Booking.create({
                schedule_id: schedule.id,
                member_id: member_id,
                package_id: allocation.package_id,
                status: 'signup',
                booking_date: new Date(),
                notes: `Auto booking for private schedule using ${allocation.package_type} package`
            });
            
            bookings.push(booking);
            logger.info(`✅ Booking created: ${booking.id} for schedule: ${schedule.id}`);
        }

        // Fetch created schedule dengan associations (ambil yang pertama untuk response)
        const createdSchedule = await Schedule.findByPk(createdSchedules[0].id, {
            include: [
                {
                    model: Class,
                    attributes: ['id', 'class_name', 'color_sign']
                },
                {
                    model: Trainer,
                    attributes: ['id', 'title', 'picture', 'description']
                },
                {
                    model: Member,
                    as: 'assignedMember',
                    attributes: ['id', 'full_name', 'phone_number'],
                    include: [
                        {
                            model: User,
                            attributes: ['id', 'email']
                        }
                    ]
                }
            ]
        });

        // Refresh dynamic cancel scheduling untuk schedule baru
        try {
            await refreshDynamicCancelScheduling();
            logger.info('✅ Dynamic cancel scheduling refreshed after creating private schedule');
        } catch (error) {
            logger.error('❌ Error refreshing dynamic cancel scheduling:', error);
        }

        logger.info('🎉 Private schedule creation completed successfully');
        res.status(201).json({
            message: `Private schedule created successfully${repeat_type === 'weekly' ? ` (${createdSchedules.length} schedules generated)` : ''}`,
            data: {
                schedule: createdSchedule,
                totalSchedules: createdSchedules.length,
                totalBookings: bookings.length,
                repeatType: repeat_type,
                assignedMember: {
                    id: member.id,
                    full_name: member.full_name,
                    email: member.User?.email || null
                }
            }
        });
    } catch (error) {
        // Delete uploaded file if error occurs
        if (req.file) {
            const filePath = path.join(__dirname, '../../uploads/schedules/', req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        logger.error('❌ Create private schedule error:', error);
        console.error('Create private schedule error:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'Terjadi kesalahan pada server' 
        });
    }
};

// Update private schedule
const updatePrivateSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            class_id,
            trainer_id,
            level,
            member_id,
            date_start,
            time_start,
            time_end,
            repeat_type,
            schedule_until,
            booking_deadline_hour,
            
            min_signup,
            cancel_buffer_minutes,
            repeat_days // Added repeat_days
        } = req.body;

        const schedule = await Schedule.findOne({
            where: { 
                id,
                type: 'private'
            }
        });

        if (!schedule) {
            // Delete uploaded file if schedule not found
            if (req.file) {
                const filePath = path.join(__dirname, '../../uploads/schedules/', req.file.filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            return res.status(404).json({
                status: 'error',
                message: 'Private schedule not found'
            });
        }

        // Validate class exists if being updated
        if (class_id) {
            const classData = await Class.findByPk(class_id);
            if (!classData) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Class not found'
                });
            }
        }

        // Validate trainer exists if being updated
        if (trainer_id) {
            const trainer = await Trainer.findByPk(trainer_id);
            if (!trainer) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Trainer not found'
                });
            }
        }

        // Validate member exists if being updated
        if (member_id) {
            const member = await Member.findByPk(member_id);
            if (!member) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Member not found'
                });
            }
        }

        // Validate level enum if provided


        if (level && !['Basic', 'Flow'].includes(level)) {


            return res.status(400).json({


                status: 'error',


                message: 'Level must be either Basic or Flow'


            });


        }

        // Validate repeat_type
        if (repeat_type === 'weekly' && !schedule_until) {
            return res.status(400).json({
                status: 'error',
                message: 'Schedule until date is required for weekly repeat'
            });
        }

        // date_start wajib untuk semua jenis schedule
        if (!date_start) {
            return res.status(400).json({
                status: 'error',
                message: 'date_start is required for all schedules'
            });
        }

        const updateData = {};
        if (class_id !== undefined) updateData.class_id = class_id;
        if (trainer_id !== undefined) updateData.trainer_id = trainer_id;
        if (level !== undefined) updateData.level = level;
        if (member_id !== undefined) updateData.member_id = member_id;
        if (date_start !== undefined) updateData.date_start = date_start;
        if (time_start !== undefined) updateData.time_start = time_start;
        if (time_end !== undefined) updateData.time_end = time_end;
        if (repeat_type !== undefined) updateData.repeat_type = repeat_type;
        if (schedule_until !== undefined) updateData.schedule_until = repeat_type === 'weekly' ? schedule_until : null;
        if (booking_deadline_hour !== undefined) updateData.booking_deadline_hour = parseInt(booking_deadline_hour);
        
        if (min_signup !== undefined) updateData.min_signup = parseInt(min_signup);
        if (cancel_buffer_minutes !== undefined) updateData.cancel_buffer_minutes = parseInt(cancel_buffer_minutes);
        if (repeat_days !== undefined) updateData.repeat_days = repeat_type === 'weekly' ? repeat_days : null; // Update repeat_days

        // ✅ Business Logic Validation for Private Schedule Update
        // Validate min_signup cannot exceed 1 for private schedule (pax is always 1)
        if (updateData.min_signup !== undefined && updateData.min_signup > 1) {
            return res.status(400).json({
                status: 'error',
                message: 'For private schedule, minimum signup cannot exceed 1 (pax is always 1)'
            });
        }

        // Validate booking_deadline_hour > cancel_buffer_minutes
        if (updateData.booking_deadline_hour !== undefined && updateData.cancel_buffer_minutes !== undefined) {
            const deadlineHours = updateData.booking_deadline_hour;
            const bufferMinutes = updateData.cancel_buffer_minutes;
            const bufferHours = bufferMinutes / 60; // Convert minutes to hours
            
            // Jika cancel_buffer_minutes > 0, maka booking_deadline_hour harus > buffer_hours
            if (bufferMinutes > 0 && deadlineHours <= bufferHours) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Booking deadline hour must be greater than cancel buffer time'
                });
            }
        } else if (updateData.booking_deadline_hour !== undefined && schedule.cancel_buffer_minutes) {
            const deadlineHours = updateData.booking_deadline_hour;
            const bufferMinutes = schedule.cancel_buffer_minutes;
            const bufferHours = bufferMinutes / 60;
            
            // Jika cancel_buffer_minutes > 0, maka booking_deadline_hour harus > buffer_hours
            if (bufferMinutes > 0 && deadlineHours <= bufferHours) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Booking deadline hour must be greater than cancel buffer time'
                });
            }
        } else if (updateData.cancel_buffer_minutes !== undefined && schedule.booking_deadline_hour) {
            const deadlineHours = schedule.booking_deadline_hour;
            const bufferMinutes = updateData.cancel_buffer_minutes;
            const bufferHours = bufferMinutes / 60;
            
            // Jika cancel_buffer_minutes > 0, maka booking_deadline_hour harus > buffer_hours
            if (bufferMinutes > 0 && deadlineHours <= bufferHours) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Booking deadline hour must be greater than cancel buffer time'
                });
            }
        }

        // Validate time_end > time_start
        if (updateData.time_start !== undefined && updateData.time_end !== undefined) {
            const startTime = new Date(`2000-01-01T${updateData.time_start}`);
            const endTime = new Date(`2000-01-01T${updateData.time_end}`);
            
            if (endTime <= startTime) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Time end must be after time start'
                });
            }
        } else if (updateData.time_start !== undefined && schedule.time_end) {
            const startTime = new Date(`2000-01-01T${updateData.time_start}`);
            const endTime = new Date(`2000-01-01T${schedule.time_end}`);
            
            if (endTime <= startTime) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Time end must be after time start'
                });
            }
        } else if (updateData.time_end !== undefined && schedule.time_start) {
            const startTime = new Date(`2000-01-01T${schedule.time_start}`);
            const endTime = new Date(`2000-01-01T${updateData.time_end}`);
            
            if (endTime <= startTime) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Time end must be after time start'
                });
            }
        }

        // Validate schedule_until > date_start when repeat_type is weekly
        if (updateData.repeat_type === 'weekly' && updateData.date_start !== undefined && updateData.schedule_until) {
            const startDate = new Date(updateData.date_start);
            const untilDate = new Date(updateData.schedule_until);
            
            if (untilDate <= startDate) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Schedule until date must be after date start'
                });
            }
        } else if (updateData.repeat_type === 'weekly' && updateData.schedule_until && schedule.date_start) {
            const startDate = new Date(schedule.date_start);
            const untilDate = new Date(updateData.schedule_until);
            
            if (untilDate <= startDate) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Schedule until date must be after date start'
                });
            }
        } else if (updateData.repeat_type === 'weekly' && updateData.date_start && schedule.schedule_until) {
            const startDate = new Date(updateData.date_start);
            const untilDate = new Date(schedule.schedule_until);
            
            if (untilDate <= startDate) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Schedule until date must be after date start'
                });
            }
        }

        // Handle picture update
        if (req.file) {
            // Delete old picture if exists
            if (schedule.picture) {
                const oldPicturePath = path.join(__dirname, '../../uploads/schedules/', schedule.picture);
                if (fs.existsSync(oldPicturePath)) {
                    fs.unlinkSync(oldPicturePath);
                }
            }
            updateData.picture = req.file.filename;
        }

        await schedule.update(updateData);

        // Refresh dynamic cancel scheduling untuk schedule yang diupdate
        try {
            await refreshDynamicCancelScheduling();
            logger.info('✅ Dynamic cancel scheduling refreshed after updating private schedule');
        } catch (error) {
            logger.error('❌ Error refreshing dynamic cancel scheduling:', error);
        }

        // Update booking jika member berubah
        if (member_id && member_id !== schedule.member_id) {
            await Booking.update(
                { member_id: member_id },
                { where: { schedule_id: schedule.id } }
            );
        }

        // Fetch updated schedule with associations
        const updatedSchedule = await Schedule.findByPk(schedule.id, {
            include: [
                {
                    model: Class,
                    attributes: ['id', 'class_name', 'color_sign']
                },
                {
                    model: Trainer,
                    attributes: ['id', 'title', 'picture', 'description']
                },
                {
                    model: Member,
                    as: 'assignedMember',
                    attributes: ['id', 'full_name', 'phone_number'],
                    include: [
                        {
                            model: User,
                            attributes: ['id', 'email']
                        }
                    ]
                }
            ]
        });

        res.status(200).json({
            message: 'Private schedule updated successfully',
            data: updatedSchedule
        });
    } catch (error) {
        // Delete uploaded file if error occurs
        if (req.file) {
            const filePath = path.join(__dirname, '../../uploads/schedules/', req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        console.error('Update private schedule error:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'Terjadi kesalahan pada server' 
        });
    }
};

// Delete private schedule
const deletePrivateSchedule = async (req, res) => {
    try {
        const { id } = req.params;

        const schedule = await Schedule.findOne({
            where: { 
                id,
                type: 'private'
            }
        });

        if (!schedule) {
            return res.status(404).json({
                status: 'error',
                message: 'Private schedule not found'
            });
        }

        // Delete associated bookings
        await Booking.destroy({
            where: { schedule_id: schedule.id }
        });

        // Delete picture file if exists
        if (schedule.picture) {
            const picturePath = path.join(__dirname, '../../uploads/schedules/', schedule.picture);
            if (fs.existsSync(picturePath)) {
                fs.unlinkSync(picturePath);
            }
        }

        await schedule.destroy();

        res.status(200).json({
            message: 'Private schedule deleted successfully'
        });
    } catch (error) {
        console.error('Delete private schedule error:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'Terjadi kesalahan pada server' 
        });
    }
};

// Get schedule data for calendar view
const getScheduleCalendar = async (req, res) => {
    try {
        const { month, year, type, include_members = 'false', include_status = 'true' } = req.query;
        
        // Default to current month/year if not provided
        const currentDate = new Date();
        const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
        const targetYear = year ? parseInt(year) : currentDate.getFullYear();
        
        // Validate month (1-12)
        if (targetMonth < 1 || targetMonth > 12) {
            return res.status(400).json({
                status: 'error',
                message: 'Bulan harus antara 1-12'
            });
        }
        
        // Build where clause
        const whereClause = {};
        

// Hitung tanggal awal dan akhir bulan
const firstDayOfMonth = new Date(targetYear, targetMonth - 1, 1);
const lastDayOfMonth = new Date(targetYear, targetMonth, 0);

// Tentukan hari dalam seminggu (0 = Minggu, 1 = Senin, ..., 6 = Sabtu)
const firstDayOfWeek = firstDayOfMonth.getDay();
const lastDayOfWeek = lastDayOfMonth.getDay();

// Hitung berapa hari yang perlu ditambahkan dari bulan sebelumnya
// Jika hari pertama bulan adalah Minggu (0), tidak perlu tambahan
// Jika hari pertama bulan adalah Senin (1), tambahkan 1 hari, dst.
const daysFromPrevMonth = firstDayOfWeek;

// Hitung berapa hari yang perlu ditambahkan dari bulan berikutnya
// Jika hari terakhir bulan adalah Sabtu (6), tidak perlu tambahan
// Jika hari terakhir bulan adalah Jumat (5), tambahkan 1 hari, dst.
const daysFromNextMonth = 6 - lastDayOfWeek;

// Buat tanggal awal dan akhir yang disesuaikan
const adjustedStartDate = new Date(firstDayOfMonth);
adjustedStartDate.setDate(firstDayOfMonth.getDate() - daysFromPrevMonth);

const adjustedEndDate = new Date(lastDayOfMonth);
adjustedEndDate.setDate(lastDayOfMonth.getDate() + daysFromNextMonth);

// Konversi ke format YYYY-MM-DD dengan timezone yang benar
const startDateStr = adjustedStartDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const endDateStr = adjustedEndDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

console.log('Date range with auto adjustment:', startDateStr, 'to', endDateStr); // Untuk debugging

whereClause.date_start = {
    [Op.between]: [startDateStr, endDateStr]
};
        
        // Filter by type if provided
        if (type && ['group', 'semi_private', 'private'].includes(type)) {
            whereClause.type = type;
        }
        
        const schedules = await Schedule.findAll({
            where: whereClause,
            include: [
                {
                    model: Class,
                    attributes: ['id', 'class_name', 'color_sign'],
                    include: [
                        {
                            model: Category,
                            attributes: ['id', 'category_name']
                        }
                    ]
                },
                {
                    model: Trainer,
                    attributes: ['id', 'title', 'picture']
                },
                {
                    model: Booking,
                    required: false,
                    attributes: ['id', 'schedule_id', 'member_id', 'package_id', 'status', 'attendance', 'notes', 'createdAt', 'updatedAt', 'cancelled_by', 'waitlist_joined_at'],
                    include: [
                        {
                            model: Member,
                            attributes: ['id', 'full_name', 'phone_number'],
                            include: [
                                {
                                    model: User,
                                    attributes: ['email']
                                }
                            ]
                        },
                        {
                            model: Package,
                            attributes: ['id', 'name', 'type']
                        }
                    ]
                }
            ],
            order: [['date_start', 'ASC'], ['time_start', 'ASC']]
        });
        
        // Format data untuk calendar dengan informasi slot
        const formattedSchedules = await Promise.all(schedules.map(async schedule => {
            if (include_status === 'true') {
                // Gunakan formatScheduleDataWithStatus untuk mendapatkan status detection
                const scheduleData = await ScheduleService.formatScheduleDataWithStatus(schedule, true);
                
                // Tambahkan informasi khusus untuk calendar
                return {
                    ...scheduleData,
                    date: schedule.date_start, // Alias untuk date
                    category_name: schedule.Class?.Category?.category_name || '',
                    level: schedule.level || null,
                    
                    // Member information (jika diminta)
                    signup_members: include_members === 'true' ? (schedule.Bookings || [])
                        .filter(b => b.status === 'signup')
                        .map(booking => ({
                            id: booking.Member?.id || null,
                            name: booking.Member?.full_name || ''
                        })) : [],
                    waitlist_members: include_members === 'true' ? (schedule.Bookings || [])
                        .filter(b => b.status === 'waiting_list')
                        .map(booking => ({
                            id: booking.Member?.id || null,
                            name: booking.Member?.full_name || ''
                        })) : []
                };
            } else {
                // Format sederhana tanpa status detection (untuk backward compatibility)
                const signupBookings = schedule.Bookings ? schedule.Bookings.filter(b => b.status === 'signup') : [];
                const waitlistBookings = schedule.Bookings ? schedule.Bookings.filter(b => b.status === 'waiting_list') : [];
                
                const maxCapacity = schedule.pax || 20;
                const availableSlots = Math.max(0, maxCapacity - signupBookings.length);
                const isFull = availableSlots === 0;
                const hasWaitlist = waitlistBookings.length > 0;
                
                let status = 'available';
                if (isFull && hasWaitlist) {
                    status = 'full_with_waitlist';
                } else if (isFull) {
                    status = 'full';
                } else if (signupBookings.length < (schedule.min_signup || 1)) {
                    status = 'minimum_not_met';
                }
                
                const scheduleDateTime = new Date(`${schedule.date_start}T${schedule.time_start}`);
                const currentDateTime = new Date();
                const cancelBufferMinutes = schedule.cancel_buffer_minutes ?? 120;
                const cancelDeadline = new Date(scheduleDateTime.getTime() - (cancelBufferMinutes * 60 * 1000));
                const isPastCancelDeadline = currentDateTime > cancelDeadline;
                
                const scheduleData = {
                    id: schedule.id,
                    class_name: schedule.Class?.class_name || '',
                    class_color: schedule.Class?.color_sign || '#000000',
                    category_name: schedule.Class?.Category?.category_name || '',
                    trainer_name: schedule.Trainer?.title || '',
                    trainer_picture: schedule.Trainer?.picture || '',
                    type: schedule.type,
                    level: schedule.level || null,
                    date: schedule.date_start,
                    time_start: schedule.time_start,
                    time_end: schedule.time_end,
                    
                    max_capacity: maxCapacity,
                    current_signups: signupBookings.length,
                    waitlist_count: waitlistBookings.length,
                    available_slots: availableSlots,
                    min_signup: schedule.min_signup || 1,
                    
                    status: status,
                    is_full: isFull,
                    has_waitlist: hasWaitlist,
                    is_past_cancel_deadline: isPastCancelDeadline,
                    
                    cancel_buffer_minutes: cancelBufferMinutes,
                    can_book: !isPastCancelDeadline && (availableSlots > 0 || hasWaitlist),
                    can_cancel: !isPastCancelDeadline
                };
                
                if (include_members === 'true') {
                    scheduleData.signup_members = signupBookings.map(b => ({
                        id: b.Member?.id || null,
                        name: b.Member?.full_name || ''
                    }));
                    scheduleData.waitlist_members = waitlistBookings.map(b => ({
                        id: b.Member?.id || null,
                        name: b.Member?.full_name || ''
                    }));
                }
                
                return scheduleData;
            }
        }));
        
        // Group schedules by date for easier calendar rendering
        const schedulesByDate = {};
        formattedSchedules.forEach(schedule => {
            const date = schedule.date;
            if (!schedulesByDate[date]) {
                schedulesByDate[date] = [];
            }
            schedulesByDate[date].push(schedule);
        });
        
        // Hitung statistik
        const totalSchedules = formattedSchedules.length;
        const availableSchedules = formattedSchedules.filter(s => s.can_book).length;
        const fullSchedules = formattedSchedules.filter(s => s.is_full).length;
        const minimumNotMetSchedules = formattedSchedules.filter(s => s.status === 'minimum_not_met').length;
        
        res.status(200).json({
            success: true,
            message: 'Schedule calendar data retrieved successfully',
            data: {
                month: targetMonth,
                year: targetYear,
                filter_type: type || 'all',
                include_members: include_members === 'true',
                include_status: include_status === 'true',
                
                // Statistik
                total_schedules: totalSchedules,
                available_schedules: availableSchedules,
                full_schedules: fullSchedules,
                minimum_not_met_schedules: minimumNotMetSchedules,
                
                // Data calendar
                schedules_by_date: schedulesByDate,
                schedules: formattedSchedules
            }
        });
    } catch (error) {
        console.error('Get schedule calendar error:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'Terjadi kesalahan pada server' 
        });
    }
};

// Get scheduled cancel tasks status
const getScheduledCancelTasksStatus = async (req, res) => {
    try {
        const { getScheduledCancelTasksStatus } = require('../cron/bookingCron');
        const status = getScheduledCancelTasksStatus();
        
        res.status(200).json({
            success: true,
            message: 'Scheduled cancel tasks status retrieved successfully',
            data: status
        });
    } catch (error) {
        logger.error('Error getting scheduled cancel tasks status:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Refresh dynamic cancel scheduling manually
const refreshCancelScheduling = async (req, res) => {
    try {
        const { refreshDynamicCancelScheduling } = require('../cron/bookingCron');
        const result = await refreshDynamicCancelScheduling();
        
        res.status(200).json({
            success: true,
            message: 'Dynamic cancel scheduling refreshed successfully',
            data: result
        });
    } catch (error) {
        logger.error('Error refreshing dynamic cancel scheduling:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    getAllGroupSchedules,
    getGroupScheduleById,
    createGroupSchedule,
    updateGroupSchedule,
    deleteGroupSchedule,
    getAllSemiPrivateSchedules,
    getSemiPrivateScheduleById,
    createSemiPrivateSchedule,
    updateSemiPrivateSchedule,
    deleteSemiPrivateSchedule,
    getAllPrivateSchedules,
    getPrivateScheduleById,
    createPrivateSchedule,
    updatePrivateSchedule,
    deletePrivateSchedule,
    getScheduleCalendar,
    getScheduledCancelTasksStatus,
    refreshCancelScheduling
}; 