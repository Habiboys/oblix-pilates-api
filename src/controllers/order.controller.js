const { Order, Package, Member, User, MemberPackage, Booking, Payment, PackageMembership, Category } = require('../models');  
const { Op } = require('sequelize');
const MidtransService = require('../services/midtrans.service');
const { sequelize } = require('../models');
const logger = require('../config/logger');
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

    // Validate package exists
    const package = await Package.findByPk(package_id);
    if (!package) {
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
    if (package.type === 'promo' && package.expired_at) {
      if (new Date() > package.expired_at) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Paket promo sudah expired'
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
      return res.status(400).json({
        success: false,
        message: 'Anda masih memiliki order yang sedang diproses untuk paket ini'
      });
    }

    // Check if member has any pending orders (limit concurrent orders)
    const totalPendingOrders = await Order.count({
      where: {
        member_id,
        status: { [Op.in]: ['pending', 'processing'] }
      }
    });

    if (totalPendingOrders >= 3) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Anda memiliki terlalu banyak order yang sedang diproses. Silakan selesaikan pembayaran terlebih dahulu.'
      });
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

    // Validate member status
    if (member.status !== 'active') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Akun Anda tidak aktif. Silakan hubungi admin untuk aktivasi.'
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

    // Check if member already has active package of the same type
    if (package.type === 'membership') {
      // Untuk membership, cek berdasarkan kategori yang sama
      const activeMembership = await MemberPackage.findOne({
        where: {
          member_id,
          '$Package.type$': 'membership',
          end_date: { [Op.gte]: new Date() } // Hanya yang masih aktif
        },
        include: [
          {
            model: Package,
            where: { type: 'membership' },
            include: [
              {
                model: PackageMembership,
                include: [
                  {
                    model: Category
                  }
                ]
              }
            ]
          }
        ]
      });

      if (activeMembership) {
        // Cek apakah kategori membership yang akan dibeli sama dengan yang aktif
        const packageToBuy = await Package.findByPk(package_id, {
          include: [
            {
              model: PackageMembership,
              include: [
                {
                  model: Category
                }
              ]
            }
          ]
        });

        if (packageToBuy && packageToBuy.PackageMembership && activeMembership.Package.PackageMembership) {
          const activeCategoryId = activeMembership.Package.PackageMembership.category_id;
          const newCategoryId = packageToBuy.PackageMembership.category_id;

          if (activeCategoryId === newCategoryId) {
            await transaction.rollback();
            return res.status(400).json({
              success: false,
              message: `Anda masih memiliki membership aktif untuk kategori ${activeMembership.Package.PackageMembership.Category.category_name}. Silakan gunakan membership yang ada terlebih dahulu.`
            });
          }
        }
      }
    }

    // Check if member already has this specific package (for all package types)
    const existingPackage = await MemberPackage.findOne({
      where: {
        member_id,
        package_id
      }
    });

    if (existingPackage) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Anda sudah memiliki paket ini. Silakan gunakan paket yang ada terlebih dahulu.'
      });
    }

    // Check if member has unused packages of the same type
    const unusedPackages = await MemberPackage.findAll({
      where: {
        member_id,
        '$Package.type$': package.type,
        end_date: { [Op.gte]: new Date() } // Hanya yang masih aktif
      },
      include: [
        {
          model: Package,
          where: { type: package.type }
        }
      ]
    });

    // Check if any package still has unused sessions
    for (const memberPackage of unusedPackages) {
      const usedSessions = await Booking.count({
        where: {
          member_id,
          package_id: memberPackage.package_id
        }
      });

      if (usedSessions < memberPackage.total_session) {
        // Untuk membership, cek apakah kategori sama
        if (package.type === 'membership') {
          const currentPackage = await Package.findByPk(memberPackage.package_id, {
            include: [
              {
                model: PackageMembership
              }
            ]
          });

          const packageToBuy = await Package.findByPk(package_id, {
            include: [
              {
                model: PackageMembership
              }
            ]
          });

          // Jika kategori sama, tolak pembelian
          if (currentPackage && packageToBuy && 
              currentPackage.PackageMembership && packageToBuy.PackageMembership &&
              currentPackage.PackageMembership.category_id === packageToBuy.PackageMembership.category_id) {
            await transaction.rollback();
            return res.status(400).json({
              success: false,
              message: `Anda masih memiliki paket ${package.type} yang belum digunakan sepenuhnya untuk kategori yang sama. Silakan gunakan paket yang ada terlebih dahulu.`
            });
          }
        } else {
          // Untuk paket non-membership, tetap tolak jika ada yang belum digunakan
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: `Anda masih memiliki paket ${package.type} yang belum digunakan sepenuhnya. Silakan gunakan paket yang ada terlebih dahulu.`
          });
        }
      }
    }

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
      expired_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
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
      midtrans_redirect_url: midtransResponse.redirect_url
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
    logger.info(`Midtrans status: ${status.transaction_status}`);

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

// Payment notification handler (webhook)
const paymentNotification = async (req, res) => {
  try {
    const notification = req.body;
    
    // Verify notification from Midtrans
    let status;
    try {
      status = await MidtransService.handleNotification(notification);
    } catch (error) {
      console.log('Error details:', {
        httpStatusCode: error.httpStatusCode,
        apiResponse: error.ApiResponse,
        message: error.message,
        has404: error.httpStatusCode === '404' || 
                (error.ApiResponse && error.ApiResponse.status_code === '404') ||
                (error.message && error.message.includes("Transaction doesn't exist"))
      });
      
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
      console.error('Midtrans API error:', error);
      return res.status(500).json({
        success: false,
        message: 'Midtrans API error'
      });
    }
    
    // Find order by Midtrans order ID
    const order = await Order.findOne({
      where: { midtrans_order_id: status.order_id }
    });

    if (!order) {
      console.log(`Order not found for Midtrans order ID: ${status.order_id}`);
      return res.status(200).json({
        success: false,
        message: 'Order not found in database - notification ignored'
      });
    }

    // Check if order is expired
    if (order.expired_at && new Date() > order.expired_at) {
      console.log(`Order expired: ${order.order_number}`);
      return res.status(200).json({
        success: false,
        message: 'Order expired - notification ignored'
      });
    }

    // Map Midtrans status to our status
    const newStatus = MidtransService.mapPaymentStatus(status.transaction_status);

    // Update order
    await order.update({
      payment_status: newStatus,
      status: newStatus === 'paid' ? 'completed' : newStatus, // Update status column too
      midtrans_transaction_id: status.transaction_id,
      midtrans_transaction_status: status.transaction_status,
      midtrans_fraud_status: status.fraud_status,
      midtrans_payment_type: status.payment_type,
      midtrans_va_numbers: status.va_numbers,
      midtrans_pdf_url: status.pdf_url,
      paid_at: newStatus === 'paid' ? new Date() : null
    });

    // If payment is successful, activate member package
    if (newStatus === 'paid') {
      try {
        // Simpan data payment ke tabel payments
        await Payment.create({
          order_id: order.id,
          payment_type: status.payment_type,
          payment_status: 'success',
          transaction_time: status.transaction_time ? new Date(status.transaction_time) : new Date(),
          settlement_time: status.settlement_time ? new Date(status.settlement_time) : null,
          midtrans_response: status
        });
        // Check if MemberPackage already exists for this order
        const existingMemberPackage = await MemberPackage.findOne({
          where: { order_id: order.id }
        });

        if (!existingMemberPackage) {
          // Calculate package duration
          const startDate = new Date();
          let endDate = new Date();
          
          // Calculate end date based on duration
          if (order.duration_unit === 'days') {
            endDate.setDate(endDate.getDate() + order.duration_value);
          } else if (order.duration_unit === 'weeks') {
            endDate.setDate(endDate.getDate() + (order.duration_value * 7));
          } else if (order.duration_unit === 'months') {
            endDate.setMonth(endDate.getMonth() + order.duration_value);
          } else if (order.duration_unit === 'years') {
            endDate.setFullYear(endDate.getFullYear() + order.duration_value);
          }

          // Create MemberPackage record
          await MemberPackage.create({
            member_id: order.member_id,
            package_id: order.package_id,
            order_id: order.id,
            start_date: startDate.toISOString().split('T')[0], // Format: YYYY-MM-DD
            end_date: endDate.toISOString().split('T')[0], // Format: YYYY-MM-DD
            total_session: order.session_count || 0,
            used_session: 0
          });

          console.log(`MemberPackage created successfully for order ${order.order_number}`);
        } else {
          console.log(`MemberPackage already exists for order ${order.order_number}`);
        }
      } catch (error) {
        console.error('Error creating MemberPackage:', error);
        // Don't throw error here to avoid breaking the payment notification
      }
    }

    console.log(`Payment notification processed successfully for order: ${order.order_number}, status: ${newStatus}`);
    
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
    const { order_id, transaction_status, transaction_id } = req.query;
    
    console.log('Payment finish callback:', { order_id, transaction_status, transaction_id });
    
    // Redirect to frontend with success status
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const redirectUrl = `${frontendUrl}/payment/success?order_id=${order_id}`;
    console.log('Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Payment finish callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const redirectUrl = `${frontendUrl}/payment/error`;
    res.redirect(redirectUrl);
  }
};

const paymentError = async (req, res) => {
  try {
    const { order_id, transaction_status, transaction_id } = req.query;
    
    console.log('Payment error callback:', { order_id, transaction_status, transaction_id });
    
    // Redirect to frontend with error status
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const redirectUrl = `${frontendUrl}/payment/error?order_id=${order_id}`;
    console.log('Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Payment error callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const redirectUrl = `${frontendUrl}/payment/error`;
    res.redirect(redirectUrl);
  }
};

const paymentPending = async (req, res) => {
  try {
    const { order_id, transaction_status, transaction_id } = req.query;
    
    console.log('Payment pending callback:', { order_id, transaction_status, transaction_id });
    
    // Redirect to frontend with pending status
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const redirectUrl = `${frontendUrl}/payment/pending?order_id=${order_id}`;
    console.log('Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Payment pending callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const redirectUrl = `${frontendUrl}/payment/error`;
    res.redirect(redirectUrl);
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
  paymentPending
}; 