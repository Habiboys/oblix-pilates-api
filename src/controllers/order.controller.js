const { Order, Package, Member, User, MemberPackage, Booking, Payment, PackageMembership, Category, PackagePromo, PackageFirstTrial, PackageBonus } = require('../models');  
const { Op } = require('sequelize');
const MidtransService = require('../services/midtrans.service');
const { sequelize } = require('../models');
const { updateSessionUsage } = require('../utils/sessionTrackingUtils');
const { updateOrderStatus } = require('../utils/orderUtils');
const logger = require('../config/logger');
const config = require('../config/config');
// Create new order
const createOrder = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Ambil hanya package_id dari req.body
    const { package_id } = req.body;
    const quantity = 1;
    const notes = null;
    const member_id = req.user.member_id; // From JWT token

    // Check if user is a member
    if (!member_id) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Only members can create orders'
      });
    }

    // Validate package exists and is not deleted
    const package = await Package.findByPk(package_id);
    if (!package || package.is_deleted) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }

    // Validate package is active/available for purchase
    if (!package.price || package.price <= 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Package tidak tersedia untuk dibeli'
      });
    }

    // Check if promo package is still valid (if applicable)
    if (package.type === 'promo') {
  const packagePromo = await PackagePromo.findOne({
    where: { package_id: package.id }
  });

  if (packagePromo) {
    const currentTime = new Date();
    const startTime = new Date(packagePromo.start_time);
    const endTime = new Date(packagePromo.end_time);

    if (currentTime < startTime) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Paket promo belum tersedia untuk dibeli'
      });
    }

    if (currentTime > endTime) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Paket promo sudah berakhir'
      });
    }
  } else {
    await transaction.rollback();
    return res.status(400).json({
      success: false,
      message: 'Data promo tidak valid'
    });
  }
}

    // Prevent purchase of bonus packages (they should be given automatically)
    if (package.type === 'bonus') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Paket bonus tidak dapat dibeli. Paket bonus diberikan otomatis oleh sistem.'
      });
    }

    // Check if member already has this package (for trial packages)
    if (package.type === 'first_trial') {
      const existingTrialOrder = await Order.findOne({
        where: {
          member_id,
          package_id,
          status: { [Op.in]: ['paid', 'completed'] }
        }
      });

      if (existingTrialOrder) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Paket trial hanya bisa dibeli sekali'
        });
      }
    }

    // Check if member has pending order for this package
    const pendingOrder = await Order.findOne({
      where: {
        member_id,
        package_id,
        status: { [Op.in]: ['pending', 'processing'] }
      }
    });

    if (pendingOrder) {
      await transaction.rollback();
      return res.status(200).json({
        success: true,
        message: 'Anda masih memiliki order yang sedang diproses untuk paket ini',
        data: {
          order_id: pendingOrder.id,
          order_number: pendingOrder.order_number,
          total_amount: pendingOrder.total_amount,
          payment_url: pendingOrder.midtrans_redirect_url || pendingOrder.payment_url || null,
          token: pendingOrder.midtrans_token || null
        }
      });
    }

    // Check if member has expired order for this package
    const expiredOrder = await Order.findOne({
      where: {
        member_id,
        package_id,
        status: { [Op.in]: ['pending', 'processing'] },
        expired_at: { [Op.lt]: new Date() } // Order yang sudah expired
      }
    });

    if (expiredOrder) {
      // Update expired order status to 'expired' dan lanjutkan dengan order baru
      await expiredOrder.update({ status: 'expired' }, { transaction });
      logger.info(`Order ${expiredOrder.order_number} marked as expired, creating new order`);
    }

    

    // Get member details
    const member = await Member.findByPk(member_id, {
      include: [{ model: User }]
    });

    if (!member) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Validate member has complete profile data
    if (!member.phone_number || !member.full_name) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Lengkapi data profil Anda terlebih dahulu (nama lengkap dan nomor telepon)'
      });
    }


    // Validate quantity
    if (quantity <= 0 || quantity > 10) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Quantity harus antara 1-10'
      });
    }

    // // Check if member already has active package of the same type
    // if (package.type === 'membership') {
    //   // Untuk membership, cek berdasarkan kategori yang sama
    //   const activeMembership = await MemberPackage.findOne({
    //     where: {
    //       member_id,
    //       '$Package.type$': 'membership',
    //       end_date: { [Op.gte]: new Date() } // Hanya yang masih aktif
    //     },
    //     include: [
    //       {
    //         model: Package,
    //         where: { type: 'membership' },
    //         include: [
    //           {
    //             model: PackageMembership,
    //             include: [
    //               {
    //                 model: Category
    //               }
    //             ]
    //           }
    //         ]
    //       }
    //     ]
    //   });

    //   if (activeMembership) {
    //     // Cek apakah kategori membership yang akan dibeli sama dengan yang aktif
    //     const packageToBuy = await Package.findByPk(package_id, {
    //       include: [
    //         {
    //           model: PackageMembership,
    //           include: [
    //             {
    //               model: Category
    //             }
    //           ]
    //         }
    //       ]
    //     });

    //     if (packageToBuy && packageToBuy.PackageMembership && activeMembership.Package.PackageMembership) {
    //       const activeCategoryId = activeMembership.Package.PackageMembership.category_id;
    //       const newCategoryId = packageToBuy.PackageMembership.category_id;

    //       if (activeCategoryId === newCategoryId) {
    //         await transaction.rollback();
    //         return res.status(400).json({
    //           success: false,
    //           message: `Anda masih memiliki membership aktif untuk kategori ${activeMembership.Package.PackageMembership.Category.category_name}. Silakan gunakan membership yang ada terlebih dahulu.`
    //         });
    //       }
    //     }
    //   }
    // }

    // Check if member already has this specific package (for all package types)
    // const existingPackage = await MemberPackage.findOne({
    //   where: {
    //     member_id,
    //     package_id
    //   }
    // });

    // if (existingPackage) {
    //   await transaction.rollback();
    //   return res.status(400).json({
    //     success: false,
    //     message: 'Anda sudah memiliki paket ini. Silakan gunakan paket yang ada terlebih dahulu.'
    //   });
    // }

    // Check if member has unused packages of the same type
    // const unusedPackages = await MemberPackage.findAll({
    //   where: {
    //     member_id,
    //     '$Package.type$': package.type,
    //     end_date: { [Op.gte]: new Date() } // Hanya yang masih aktif
    //   },
    //   include: [
    //     {
    //       model: Package,
    //       where: { type: package.type }
    //     }
    //   ]
    // });

    // Check if any package still has unused sessions
    // for (const memberPackage of unusedPackages) {
    //   const usedSessions = await Booking.count({
    //     where: {
    //       member_id,
    //       package_id: memberPackage.package_id
    //     }
    //   });

    //   if (usedSessions < memberPackage.total_session) {
    //     // Untuk membership, cek apakah kategori sama
    //     if (package.type === 'membership') {
    //       const currentPackage = await Package.findByPk(memberPackage.package_id, {
    //         include: [
    //           {
    //             model: PackageMembership
    //           }
    //         ]
    //       });

    //       const packageToBuy = await Package.findByPk(package_id, {
    //         include: [
    //           {
    //             model: PackageMembership
    //           }
    //         ]
    //       });

    //       // Jika kategori sama, tolak pembelian
    //       if (currentPackage && packageToBuy && 
    //           currentPackage.PackageMembership && packageToBuy.PackageMembership &&
    //           currentPackage.PackageMembership.category_id === packageToBuy.PackageMembership.category_id) {
    //         await transaction.rollback();
    //         return res.status(400).json({
    //           success: false,
    //           message: `Anda masih memiliki paket ${package.type} yang belum digunakan sepenuhnya untuk kategori yang sama. Silakan gunakan paket yang ada terlebih dahulu.`
    //         });
    //       }
    //     } else {
    //       // Untuk paket non-membership, tetap tolak jika ada yang belum digunakan
    //       await transaction.rollback();
    //       return res.status(400).json({
    //         success: false,
    //         message: `Anda masih memiliki paket ${package.type} yang belum digunakan sepenuhnya. Silakan gunakan paket yang ada terlebih dahulu.`
    //       });
    //     }
    //   }
    // }

    // Calculate total amount
    const total_amount = package.price * quantity;

    // Generate order number
    const order_number = MidtransService.generateOrderNumber();

    // Create order with package details
    const order = await Order.create({
      order_number,
      member_id,
      package_id: package.id,
      package_name: package.name,
      package_type: package.type,
      quantity,
      unit_price: package.price,
      total_amount,
      session_count: package.session_count,
      duration_value: package.duration_value,
      duration_unit: package.duration_unit,
      payment_status: 'pending',
      status: 'pending',
      notes,
      expired_at: new Date(Date.now() + config.midtrans.expiredTime * 60 * 1000), // Use MIDTRANS_EXPIRED_TIME from config
      is_phantom_order: true, // Mark as phantom until confirmed in Midtrans
      midtrans_check_count: 0
    }, { transaction });

    // Prepare data for Midtrans
    const orderData = {
      order_number: order.order_number,
      total_amount: order.total_amount,
      member: {
        full_name: member.full_name,
        email: member.User ? member.User.email : '',
        phone_number: member.phone_number
      },
      items: [{
        package_id: package.id,
        unit_price: package.price,
        quantity,
        package_name: package.name,
        package_type: package.type
      }]
    };

    console.log('Order data prepared for Midtrans:', JSON.stringify(orderData, null, 2));

    // Create Midtrans transaction
    let midtransResponse;
    try {
      midtransResponse = await MidtransService.createTransaction(orderData);
    } catch (error) {
      console.error('Error creating Midtrans transaction:', error);
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        message: 'Gagal membuat transaksi pembayaran. Silakan coba lagi.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    if (!midtransResponse || !midtransResponse.token || !midtransResponse.redirect_url) {
      console.error('Invalid Midtrans response:', midtransResponse);
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        message: 'Gagal membuat transaksi pembayaran. Silakan coba lagi.'
      });
    }

    // Update order with Midtrans data
    await order.update({
      midtrans_order_id: order.order_number, // Use our order number as Midtrans order ID
      midtrans_token: midtransResponse.token,
      midtrans_redirect_url: midtransResponse.redirect_url,
      midtrans_created_at: midtransResponse.midtrans_created_at,
      is_phantom_order: false, // Order confirmed in Midtrans
      last_midtrans_check: new Date(),
      midtrans_check_count: 1
    }, { transaction });

    await transaction.commit();

    const responseData = {
      success: true,
      message: 'Order created successfully',
      data: {
        order_id: order.id,
        order_number: order.order_number,
        total_amount: order.total_amount,
        payment_url: midtransResponse.redirect_url,
        token: midtransResponse.token
      }
    };

    console.log('Sending response to client:', JSON.stringify(responseData, null, 2));

    res.status(201).json(responseData);

  } catch (error) {
    await transaction.rollback();
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get user orders
const getUserOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;
    const member_id = req.user.member_id;

    // Check if user is a member
    if (!member_id) {
      return res.status(403).json({
        success: false,
        message: 'Only members can view orders'
      });
    }

    const whereClause = { member_id };
    if (status) {
      whereClause.payment_status = status;
    }

    const { count, rows: orders } = await Order.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Package,
          attributes: ['id', 'name', 'type', 'price', 'description']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    const totalPages = Math.ceil(count / limit);

    res.json({
      success: true,
      message: 'Orders retrieved successfully',
      data: {
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: count,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error getting user orders:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get order by ID
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const member_id = req.user.member_id;

    // Check if user is a member
    if (!member_id) {
      return res.status(403).json({
        success: false,
        message: 'Only members can view orders'
      });
    }

    const order = await Order.findOne({
      where: { id, member_id },
      include: [
        {
          model: Package,
          attributes: ['id', 'name', 'type', 'price', 'description']
        },
        {
          model: Member,
          attributes: ['full_name', 'email', 'phone_number']
        },
        {
          model: MemberPackage,
          attributes: ['id', 'start_date', 'end_date', 'total_session', 'used_session']
        }
      ]
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      message: 'Order retrieved successfully',
      data: order
    });

  } catch (error) {
    console.error('Error getting order:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Cancel order
const cancelOrder = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { order_id } = req.params;
    const member_id = req.user.member_id;

    // Check if user is a member
    if (!member_id) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Only members can cancel orders'
      });
    }

    const order = await Order.findOne({
      where: { id: order_id, member_id }
    });

    if (!order) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.payment_status !== 'pending') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled'
      });
    }

    // Cancel in Midtrans
    if (order.midtrans_order_id) {
      await MidtransService.cancelTransaction(order.midtrans_order_id);
    }

    // Update order status
    await order.update({
      payment_status: 'cancelled',
      status: 'cancelled'
    }, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: 'Order cancelled successfully'
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get my orders (for authenticated user)
const getMyOrders = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10, status = '', payment_status = '' } = req.query;
        const offset = (page - 1) * limit;

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

        // Build where clause
        const whereClause = { member_id: memberId };
        
        if (status) {
            whereClause.status = status;
        }
        
        if (payment_status) {
            whereClause.payment_status = payment_status;
        }

        // Get orders with related data
        const orders = await Order.findAndCountAll({
            where: whereClause,
            include: [
                { model: Package, attributes: ['id', 'name', 'type', 'price'] },
                { model: Payment, attributes: ['id', 'payment_type', 'payment_status', 'transaction_time', 'settlement_time', 'createdAt'] },
                { model: MemberPackage, attributes: ['id', 'start_date', 'end_date', 'remaining_group_session', 'remaining_semi_private_session', 'remaining_private_session'] }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']]
        });

        const totalPages = Math.ceil(orders.count / limit);

        // Format response data
        const formattedOrders = orders.rows.map(order => {
            const orderData = {
                id: order.id,
                order_number: order.order_number,
                package_name: order.package_name,
                package_type: order.package_type,
                quantity: order.quantity,
                unit_price: parseFloat(order.unit_price),
                total_amount: parseFloat(order.total_amount),
                session_count: order.session_count,
                duration_value: order.duration_value,
                duration_unit: order.duration_unit,
                payment_method: order.midtrans_payment_type,
                payment_status: order.payment_status,
                status: order.status,
                created_at: order.createdAt,
                updated_at: order.updatedAt,
                
                // Payment details
                payment: order.Payment ? {
                    id: order.Payment.id,
                    payment_type: order.Payment.payment_type,
                    payment_status: order.Payment.payment_status,
                    transaction_time: order.Payment.transaction_time,
                    settlement_time: order.Payment.settlement_time,
                    created_at: order.Payment.createdAt
                } : null,
                
                // Member package details (if exists)
                member_package: order.MemberPackage ? {
                    id: order.MemberPackage.id,
                    start_date: order.MemberPackage.start_date,
                    end_date: order.MemberPackage.end_date,
                    remaining_sessions: {
                        group: order.MemberPackage.remaining_group_session || 0,
                        semi_private: order.MemberPackage.remaining_semi_private_session || 0,
                        private: order.MemberPackage.remaining_private_session || 0
                    }
                } : null,
                
                // Midtrans details
                midtrans: {
                    order_id: order.midtrans_order_id,
                    payment_type: order.midtrans_payment_type,
                    transaction_id: order.midtrans_transaction_id,
                    transaction_status: order.midtrans_transaction_status,
                    fraud_status: order.midtrans_fraud_status,
                    va_numbers: order.midtrans_va_numbers,
                    payment_code: order.midtrans_payment_code,
                    pdf_url: order.midtrans_pdf_url,
                    redirect_url: order.midtrans_redirect_url
                },
                
                // Timestamps
                paid_at: order.paid_at,
                expired_at: order.expired_at,
                cancelled_at: order.cancelled_at,
                cancelled_by: order.cancelled_by,
                cancel_reason: order.cancel_reason,
                notes: order.notes
            };

            return orderData;
        });

        res.json({
            success: true,
            message: 'My orders retrieved successfully',
            data: {
                orders: formattedOrders,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: totalPages,
                    totalItems: orders.count,
                    itemsPerPage: parseInt(limit)
                }
            }
        });
    } catch (error) {
        logger.error('Error getting my orders:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get my order detail by ID (for authenticated user)
const getMyOrderById = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

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

        // Get order with related data
        const order = await Order.findOne({
            where: { 
                id: id,
                member_id: memberId // Ensure user can only access their own orders
            },
            include: [
                {
                    model: Package,
                    attributes: ['id', 'name', 'type', 'price']
                },
                {
                    model: Payment,
                    attributes: ['id', 'payment_type', 'payment_status', 'transaction_time', 'settlement_time', 'createdAt']
                },
                {
                    model: MemberPackage,
                    attributes: ['id', 'start_date', 'end_date', 'remaining_group_session', 'remaining_semi_private_session', 'remaining_private_session', 'used_group_session', 'used_semi_private_session', 'used_private_session']
                }
            ]
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found or you do not have access to this order'
            });
        }

        // Format response data
        const orderData = {
            id: order.id,
            order_number: order.order_number,
            package_name: order.package_name,
            package_type: order.package_type,
            quantity: order.quantity,
            unit_price: parseFloat(order.unit_price),
            total_amount: parseFloat(order.total_amount),
            session_count: order.session_count,
            duration_value: order.duration_value,
            duration_unit: order.duration_unit,
            payment_method: order.midtrans_payment_type,
            payment_status: order.payment_status,
            status: order.status,
            created_at: order.createdAt,
            updated_at: order.updatedAt,
            
            // Package details
            package: order.Package ? {
                id: order.Package.id,
                name: order.Package.name,
                type: order.Package.type,
                price: parseFloat(order.Package.price)
            } : null,
            
            // Payment details
            payment: order.Payment ? {
                id: order.Payment.id,
                payment_type: order.Payment.payment_type,
                payment_status: order.Payment.payment_status,
                transaction_time: order.Payment.transaction_time,
                settlement_time: order.Payment.settlement_time,
                created_at: order.Payment.createdAt
            } : null,
            
            // Member package details (if exists)
            member_package: order.MemberPackage ? {
                id: order.MemberPackage.id,
                start_date: order.MemberPackage.start_date,
                end_date: order.MemberPackage.end_date,
                session_usage: {
                    used: {
                        group: order.MemberPackage.used_group_session || 0,
                        semi_private: order.MemberPackage.used_semi_private_session || 0,
                        private: order.MemberPackage.used_private_session || 0
                    },
                    remaining: {
                        group: order.MemberPackage.remaining_group_session || 0,
                        semi_private: order.MemberPackage.remaining_semi_private_session || 0,
                        private: order.MemberPackage.remaining_private_session || 0
                    }
                }
            } : null,
            
            // Midtrans details
            midtrans: {
                order_id: order.midtrans_order_id,
                payment_type: order.midtrans_payment_type,
                transaction_id: order.midtrans_transaction_id,
                transaction_status: order.midtrans_transaction_status,
                fraud_status: order.midtrans_fraud_status,
                va_numbers: order.midtrans_va_numbers,
                payment_code: order.midtrans_payment_code,
                pdf_url: order.midtrans_pdf_url,
                redirect_url: order.midtrans_redirect_url,
                token: order.midtrans_token
            },
            
            // Timestamps
            paid_at: order.paid_at,
            expired_at: order.expired_at,
            cancelled_at: order.cancelled_at,
            cancelled_by: order.cancelled_by,
            cancel_reason: order.cancel_reason,
            notes: order.notes
        };

        res.json({
            success: true,
            message: 'Order detail retrieved successfully',
            data: orderData
        });
    } catch (error) {
        logger.error('Error getting my order detail:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Payment notification handler (webhook)
const paymentNotification = async (req, res) => {
  try {
    const notification = req.body;
    
    // ✅ Tambah logging untuk raw notification
    console.log('🔔 Raw Midtrans notification received:', JSON.stringify(notification, null, 2));
    logger.info('Raw Midtrans notification received:', { notification });
    
    // Verify notification from Midtrans
    let status;
    try {
      status = await MidtransService.handleNotification(notification);
    } catch (error) {
      const safeErrorDetails = {
        httpStatusCode: error.httpStatusCode,
        apiResponse: error.ApiResponse,
        message: error.message,
        has404: error.httpStatusCode === '404' || 
                (error.ApiResponse && error.ApiResponse.status_code === '404') ||
                (error.message && error.message.includes("Transaction doesn't exist"))
      };
      console.log('Error details:', safeErrorDetails);
      
      // Handle specific Midtrans errors - check multiple possible error structures
      const is404Error = 
        error.httpStatusCode === '404' || 
        (error.ApiResponse && error.ApiResponse.status_code === '404') ||
        (error.message && error.message.includes("Transaction doesn't exist")) ||
        (error.rawHttpClientData && error.rawHttpClientData.data && error.rawHttpClientData.data.status_code === '404') ||
        (error.rawHttpClientData && error.rawHttpClientData.data && error.rawHttpClientData.data.status_message && error.rawHttpClientData.data.status_message.includes("Transaction doesn't exist"));
      
      if (is404Error) {
        console.log(`Midtrans notification for non-existent transaction: ${notification.order_id || 'unknown'}`);
        
        // Return 200 to Midtrans to stop retry, but log the issue
        return res.status(200).json({
          success: false,
          message: 'Transaction not found in Midtrans - notification ignored'
        });
      }
      
      // For other Midtrans errors, log and return 500
      const safeErrorData = {
        message: error.message,
        httpStatusCode: error.httpStatusCode,
        apiResponse: error.ApiResponse,
        has404: is404Error
      };
      console.error('Midtrans API error:', safeErrorData);
      return res.status(500).json({
        success: false,
        message: 'Midtrans API error'
      });
    }
    
    // Find order by Midtrans order ID
    console.log('🔍 Looking for order with midtrans_order_id:', status.order_id);
    logger.info('Looking for order with midtrans_order_id:', { midtrans_order_id: status.order_id });
    
    let order = await Order.findOne({
      where: { midtrans_order_id: status.order_id }
    });

    // Jika tidak ditemukan dengan midtrans_order_id, coba dengan order_number
    if (!order) {
      console.log(`🔍 Order not found with midtrans_order_id, trying order_number: ${status.order_id}`);
      logger.info('Order not found with midtrans_order_id, trying order_number:', { order_number: status.order_id });
      
      order = await Order.findOne({
        where: { order_number: status.order_id }
      });
    }

    if (!order) {
      console.log(`❌ Order not found for Midtrans order ID/order_number: ${status.order_id}`);
      logger.warn('Order not found for Midtrans order ID/order_number:', { order_id: status.order_id });
      return res.status(200).json({
        success: false,
        message: 'Order not found in database - notification ignored'
      });
    }
    
    console.log('✅ Order found:', {
      order_id: order.id,
      order_number: order.order_number,
      current_status: order.status,
      current_payment_status: order.payment_status,
      expired_at: order.expired_at
    });
    logger.info('Order found for notification:', {
      order_id: order.id,
      order_number: order.order_number,
      current_status: order.status,
      current_payment_status: order.payment_status,
      expired_at: order.expired_at
    });

    // Check if order is expired - HANYA jika ini bukan notification expired dari Midtrans
    // Tapi untuk notification 'expire', kita HARUS process meskipun order sudah expired
    if (order.expired_at && new Date() > order.expired_at && status.transaction_status !== 'expire') {
      console.log(`Order expired: ${order.order_number} - notification ignored (not expire notification)`);
      return res.status(200).json({
        success: false,
        message: 'Order expired - notification ignored'
      });
    }
    
    // Log untuk debugging
    console.log(`🔄 Processing notification for order ${order.order_number}:`, {
      order_expired_at: order.expired_at,
      current_time: new Date(),
      is_expired: order.expired_at && new Date() > order.expired_at,
      transaction_status: status.transaction_status,
      will_process: status.transaction_status === 'expire' || !(order.expired_at && new Date() > order.expired_at)
    });
    logger.info('Processing notification for order:', {
      order_number: order.order_number,
      order_expired_at: order.expired_at,
      current_time: new Date(),
      is_expired: order.expired_at && new Date() > order.expired_at,
      transaction_status: status.transaction_status,
      will_process: status.transaction_status === 'expire' || !(order.expired_at && new Date() > order.expired_at)
    });

    // Use utility function to update order status
    const updateResult = await updateOrderStatus(order.id, status, notification);
    
    if (!updateResult.success) {
      console.error(`❌ Failed to update order status:`, updateResult.error);
      logger.error('Failed to update order status:', updateResult.error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update order status'
      });
    }
    
    console.log(`✅ Order ${order.order_number} updated successfully:`, {
      old_status: updateResult.old_status,
      new_status: updateResult.new_status,
      order_status: updateResult.order_status
    });
    logger.info('Order updated successfully:', {
      order_number: order.order_number,
      old_status: updateResult.old_status,
      new_status: updateResult.new_status,
      order_status: updateResult.order_status
    });

    // Special logging for expired notifications
    if (status.transaction_status === 'expire') {
      console.log(`🔴 EXPIRED NOTIFICATION DETECTED for order ${order.order_number}:`, {
        transaction_status: status.transaction_status,
        mapped_status: updateResult.new_status,
        order_status: updateResult.order_status,
        order_id: order.id,
        order_number: order.order_number
      });
      logger.warn('EXPIRED NOTIFICATION DETECTED:', {
        order_number: order.order_number,
        transaction_status: status.transaction_status,
        mapped_status: updateResult.new_status,
        order_status: updateResult.order_status,
        order_id: order.id
      });
    }
    
    // Payment and member package creation is now handled in updateOrderStatus utility

    console.log(`Payment notification processed successfully for order: ${order.order_number}, status: ${updateResult.new_status}`);
    
    res.json({
      success: true,
      message: 'Payment notification processed successfully'
    });

  } catch (error) {
    console.error('Unexpected error processing payment notification:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Payment callback handlers (for user redirects)
const paymentFinish = async (req, res) => {
  try {
    const { order_id, transaction_status, transaction_id, status_code, status_message } = req.query;
    
    console.log('✅ Payment finish callback:', { order_id });
    
    // Cari order berdasarkan order_number (karena Midtrans mengirim order_number, bukan id)
    const order = await Order.findOne({
      where: { order_number: order_id }
    });
    
    if (!order) {
      console.log(`❌ Order not found for order_number: ${order_id}`);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const redirectUrl = `${frontendUrl}/my-orders`;
      return res.redirect(redirectUrl);
    }
    
    // Check if order has expired based on expired_at timestamp
    const isOrderExpired = order.expired_at && new Date() > order.expired_at;
    
    if (isOrderExpired && (order.status === 'pending' || order.status === 'processing')) {
      console.log(`🔴 Order expired: ${order.order_number} - updating status`);
      
      await order.update({
        status: 'cancelled',
        payment_status: 'expired',
        cancelled_at: new Date(),
        cancelled_by: null,
        cancel_reason: 'Payment expired via time check'
      });
      console.log(`✅ Order ${order.order_number} marked as expired`);
    }
    
    // Redirect to frontend with success status
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const redirectUrl = `${frontendUrl}/my-orders/${order.id}`;
    console.log('🔄 Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('❌ Payment finish callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const redirectUrl = `${frontendUrl}/my-orders`;
    res.redirect(redirectUrl);
  }
};

const paymentError = async (req, res) => {
  try {
      const { order_id, transaction_status, transaction_id, status_code, status_message } = req.query;
    
    console.log('🔴 Payment error callback:', { order_id });

    // Cari order berdasarkan order_number (karena Midtrans mengirim order_number, bukan id)
    const order = await Order.findOne({
      where: { order_number: order_id }
    });
    
    if (!order) {
      console.log(`❌ Order not found for order_number: ${order_id}`);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const redirectUrl = `${frontendUrl}/my-orders`;
      return res.redirect(redirectUrl);
    }
    
    // Check if order has expired based on expired_at timestamp
    const isOrderExpired = order.expired_at && new Date() > order.expired_at;
    
    if (isOrderExpired && (order.status === 'pending' || order.status === 'processing')) {
      console.log(`🔴 Order expired: ${order.order_number} - updating status`);
      
      await order.update({
        status: 'cancelled',
        payment_status: 'expired',
        cancelled_at: new Date(),
        cancelled_by: null,
        cancel_reason: 'Payment expired via time check'
      });
      console.log(`✅ Order ${order.order_number} marked as expired`);
    }
    
    // Redirect to frontend with error status
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const redirectUrl = `${frontendUrl}/my-orders/${order.id}`;
    console.log('🔄 Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('❌ Payment error callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const redirectUrl = `${frontendUrl}/my-orders`;
    res.redirect(redirectUrl);
  }
};

const paymentPending = async (req, res) => {
  try {
    const { order_id, transaction_status, transaction_id, status_code, status_message } = req.query;

    console.log('⏳ Payment pending callback:', { order_id });

    // Cari order berdasarkan order_number (karena Midtrans mengirim order_number, bukan id)
    const order = await Order.findOne({
      where: { order_number: order_id }
    });
    
    if (!order) {
      console.log(`❌ Order not found for order_number: ${order_id}`);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const redirectUrl = `${frontendUrl}/my-orders`;
      return res.redirect(redirectUrl);
    }
    
    // Check if order has expired based on expired_at timestamp
    const isOrderExpired = order.expired_at && new Date() > order.expired_at;
    
    if (isOrderExpired && (order.status === 'pending' || order.status === 'processing')) {
      console.log(`🔴 Order expired: ${order.order_number} - updating status`);
      
      await order.update({
        status: 'cancelled',
        payment_status: 'expired',
        cancelled_at: new Date(),
        cancelled_by: null,
        cancel_reason: 'Payment expired via time check'
      });
      console.log(`✅ Order ${order.order_number} marked as expired`);
    }
    
    // Redirect to frontend with pending status
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const redirectUrl = `${frontendUrl}/my-orders/${order.id}`;
    console.log('🔄 Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('❌ Payment pending callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const redirectUrl = `${frontendUrl}/my-orders`;
    res.redirect(redirectUrl);
  }
};

// Get pending order details for payment redirect
const getPendingOrderDetails = async (req, res) => {
  try {
    const { order_id } = req.params;
    const user_id = req.user.id;

    console.log('Getting pending order details for:', { order_id, user_id });

    // Get member ID from user
    const member = await Member.findOne({
      where: { user_id }
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    const member_id = member.id;
    console.log('Member ID:', member_id);

    const order = await Order.findOne({
      where: {
        id: order_id,
        member_id,
        status: { [Op.in]: ['pending', 'processing'] }
      },
      include: [
        {
          model: Package,
          attributes: ['id', 'name', 'type', 'price']
        }
      ]
    });

    console.log('Query result:', order ? 'Found' : 'Not found');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order pending tidak ditemukan'
      });
    }

    console.log('Order found:', order.id, order.order_number);

    res.json({
      success: true,
      message: 'Detail order pending berhasil diambil',
      data: {
        order: {
          id: order.id,
          order_number: order.order_number,
          total_amount: order.total_amount,
          status: order.status,
          payment_url: order.midtrans_redirect_url || order.payment_url,
          midtrans_token: order.midtrans_token,
          created_at: order.createdAt,
          package: {
            name: order.Package.name,
            type: order.Package.type,
            price: order.Package.price
          }
        }
      }
    });

  } catch (error) {
    console.error('Error getting pending order details:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  getOrderById,
  cancelOrder,
  paymentNotification,
  paymentFinish,
  paymentError,
  paymentPending,
  getMyOrders,
  getMyOrderById,
  getPendingOrderDetails
}; 