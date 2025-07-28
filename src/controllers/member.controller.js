const { Booking, Schedule, Class, Trainer, Member, User } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const bcrypt = require('bcryptjs');
const { generateMemberCode } = require('../utils/memberUtils');

/**
 * Get member's classes based on type (upcoming, waitlist, post, cancelled)
 */
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
                        }
                    ]
                }
            ],
            order: orderClause
        });

        // Filter by date after getting the data
        const filteredBookings = bookings.filter(booking => {
            if (!booking.Schedule) return false;
            
            const scheduleDate = booking.Schedule.date_start;
            if (!scheduleDate) return false;

            switch (type) {
                case 'upcoming':
                case 'waitlist':
                    return scheduleDate >= currentDate.toISOString().split('T')[0];
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
                const totalSpots = scheduleType === 'semi_private' ? 4 : 
                                  scheduleType === 'private' ? 1 : 20;
                
                // Get booked count for this schedule
                const bookedCount = booking.status === 'signup' ? 1 : 0; // Simplified for now

                return {
                    no: index + 1,
                    booking_id: booking.id,
                    class_date: schedule?.date_start || 'Unknown',
                    time: schedule ? `${schedule.time_start} - ${schedule.time_end}` : 'Unknown',
                    course: classData?.class_name || 'Unknown Class',
                    coach: trainerData?.title || 'Unknown Coach',
                    spot: `${bookedCount}/${totalSpots}`,
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

/**
 * Cancel a booking
 */
const cancelBooking = async (req, res) => {
    try {
        const userId = req.user.id;
        const { booking_id } = req.params;

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

        // Find booking
        const booking = await Booking.findOne({
            where: {
                id: booking_id,
                member_id: member.id
            },
            include: [
                {
                    model: Schedule,
                    include: [
                        {
                            model: Class,
                            attributes: ['class_name']
                        },
                        {
                            model: Trainer,
                            attributes: ['title']
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

        // Check if booking can be cancelled
        if (booking.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Booking is already cancelled'
            });
        }

        // Check cancel buffer time
        const scheduleDateTime = new Date(`${booking.Schedule.date_start}T${booking.Schedule.time_start}`);
        const currentDateTime = new Date();
        const cancelBufferMinutes = booking.Schedule.cancel_buffer_minutes || 120; // Default 2 jam
        const cancelDeadline = new Date(scheduleDateTime.getTime() - (cancelBufferMinutes * 60 * 1000));

        if (currentDateTime > cancelDeadline) {
            return res.status(400).json({
                success: false,
                message: `Cannot cancel booking. Cancellation deadline was ${cancelBufferMinutes} minutes before class.`,
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
            notes: booking.notes ? `${booking.notes} - Cancelled by member` : 'Cancelled by member'
        });

        // Process waitlist promotion if this was a signup booking
        if (booking.status === 'signup') {
            // Import and call waitlist promotion function
            const { processWaitlistPromotion } = require('../utils/bookingUtils');
            await processWaitlistPromotion(booking.schedule_id);
        }

        res.json({
            success: true,
            message: 'Booking cancelled successfully',
            data: {
                booking_id: booking.id,
                status: booking.status,
                cancelled_at: booking.updatedAt
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

/**
 * Get booking details
 */
const getBookingDetails = async (req, res) => {
    try {
        const userId = req.user.id;
        const { booking_id } = req.params;

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

        // Find booking with full details
        const booking = await Booking.findOne({
            where: {
                id: booking_id,
                member_id: member.id
            },
            include: [
                {
                    model: Schedule,
                    include: [
                        {
                            model: Class,
                            attributes: ['id', 'class_name', 'color_sign', 'description']
                        },
                        {
                            model: Trainer,
                            attributes: ['id', 'title', 'picture', 'description']
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

        // Format detailed response
        const schedule = booking.Schedule;
        const classData = schedule.Class;
        const trainerData = schedule.Trainer;

        const bookingDetails = {
            booking_id: booking.id,
            status: booking.status,
            class_date: schedule.date_start,
            time: `${schedule.time_start} - ${schedule.time_end}`,
            course: {
                id: classData?.id,
                name: classData?.class_name,
                description: classData?.description,
                color: classData?.color_sign
            },
            coach: {
                id: trainerData?.id,
                name: trainerData?.title,
                picture: trainerData?.picture,
                description: trainerData?.description
            },
            schedule_type: schedule.type,
            notes: booking.notes,
            created_at: booking.createdAt,
            updated_at: booking.updatedAt
        };

        res.json({
            success: true,
            message: 'Booking details retrieved successfully',
            data: bookingDetails
        });

    } catch (error) {
        logger.error('Error getting booking details:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getAllMembers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = '' } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    
    if (search) {
      whereClause[Op.or] = [
        { full_name: { [Op.iLike]: `%${search}%` } },
        { username: { [Op.iLike]: `%${search}%` } },
        { member_code: { [Op.iLike]: `%${search}%` } },
        { phone_number: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (status) {
      whereClause.status = status;
    }

    const { count, rows: members } = await Member.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          attributes: ['id', 'email', 'role']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    const totalPages = Math.ceil(count / limit);

    res.json({
      success: true,
      message: 'Members retrieved successfully',
      data: {
        members,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: count,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting members:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get member by ID
const getMemberById = async (req, res) => {
  try {
    const { id } = req.params;

    const member = await Member.findByPk(id, {
      include: [
        {
          model: User,
          attributes: ['id', 'email', 'role']
        }
      ]
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    res.json({
      success: true,
      message: 'Member retrieved successfully',
      data: member
    });
  } catch (error) {
    console.error('Error getting member:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create new member
const createMember = async (req, res) => {
  try {
    const {
      full_name,
      username,
      phone_number,
      dob,
      address,
      email,
      password,
      picture
    } = req.body;

    // Check if username already exists
    const existingMember = await Member.findOne({
      where: { username }
    });

    if (existingMember) {
      return res.status(400).json({
        success: false,
        message: 'Username sudah digunakan'
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email sudah digunakan'
      });
    }

    // Generate member code
    const memberCode = await generateMemberCode();

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user first
    const user = await User.create({
      email,
      password: hashedPassword,
      role: 'user'
    });

    // Create member
    const member = await Member.create({
      member_code: memberCode,
      username,
      full_name,
      phone_number,
      dob: new Date(dob),
      address,
      date_of_join: new Date(),
      picture,
      status: 'active',
      user_id: user.id
    });

    // Fetch member with user data
    const createdMember = await Member.findByPk(member.id, {
      include: [
        {
          model: User,
          attributes: ['id', 'email', 'role']
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Member created successfully',
      data: createdMember
    });
  } catch (error) {
    console.error('Error creating member:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update member
const updateMember = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      full_name,
      username,
      phone_number,
      dob,
      address,
      email,
      password,
      picture,
      status
    } = req.body;

    const member = await Member.findByPk(id, {
      include: [
        {
          model: User
        }
      ]
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Check if username already exists (excluding current member)
    if (username && username !== member.username) {
      const existingMember = await Member.findOne({
        where: { 
          username,
          id: { [Op.ne]: id }
        }
      });

      if (existingMember) {
        return res.status(400).json({
          success: false,
          message: 'Username sudah digunakan'
        });
      }
    }

    // Check if email already exists (excluding current user)
    if (email && email !== member.User.email) {
      const existingUser = await User.findOne({
        where: { 
          email,
          id: { [Op.ne]: member.user_id }
        }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email sudah digunakan'
        });
      }
    }

    // Update member data
    const updateData = {};
    if (full_name) updateData.full_name = full_name;
    if (username) updateData.username = username;
    if (phone_number) updateData.phone_number = phone_number;
    if (dob) updateData.dob = new Date(dob);
    if (address !== undefined) updateData.address = address;
    if (picture !== undefined) updateData.picture = picture;
    if (status) updateData.status = status;

    await member.update(updateData);

    // Update user data
    const userUpdateData = {};
    if (email) userUpdateData.email = email;
    if (password) {
      userUpdateData.password = await bcrypt.hash(password, 10);
    }

    if (Object.keys(userUpdateData).length > 0) {
      await member.User.update(userUpdateData);
    }

    // Fetch updated member
    const updatedMember = await Member.findByPk(id, {
      include: [
        {
          model: User,
          attributes: ['id', 'email', 'role']
        }
      ]
    });

    res.json({
      success: true,
      message: 'Member updated successfully',
      data: updatedMember
    });
  } catch (error) {
    console.error('Error updating member:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete member
const deleteMember = async (req, res) => {
  try {
    const { id } = req.params;

    const member = await Member.findByPk(id, {
      include: [
        {
          model: User
        }
      ]
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Delete member first (due to foreign key constraint)
    await member.destroy();

    // Delete associated user
    await member.User.destroy();

    res.json({
      success: true,
      message: 'Member deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting member:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get member statistics
const getMemberStats = async (req, res) => {
  try {
    const totalMembers = await Member.count();
    const activeMembers = await Member.count({
      where: { status: 'active' }
    });
    const inactiveMembers = await Member.count({
      where: { status: 'inactive' }
    });

    // Get members joined this month
    const currentDate = new Date();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    const newMembersThisMonth = await Member.count({
      where: {
        date_of_join: {
          [Op.between]: [firstDayOfMonth, lastDayOfMonth]
        }
      }
    });

    res.json({
      success: true,
      message: 'Member statistics retrieved successfully',
      data: {
        totalMembers,
        activeMembers,
        inactiveMembers,
        newMembersThisMonth
      }
    });
  } catch (error) {
    console.error('Error getting member stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
    getMyClasses,
    cancelBooking,
    getBookingDetails,
    getAllMembers,
    getMemberById,
    createMember,
    updateMember,
    deleteMember,
    getMemberStats
}; 