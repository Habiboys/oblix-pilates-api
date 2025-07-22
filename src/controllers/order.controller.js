const { Order, Package, Member, User, MemberPackage } = require('../models');
const { Op } = require('sequelize');
const MidtransService = require('../services/midtrans.service');
const { sequelize } = require('../models');

// Create new order
const createOrder = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { package_id, quantity = 1, notes } = req.body;
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

    // Create Midtrans transaction
    const midtransResponse = await MidtransService.createTransaction(orderData);

    // Update order with Midtrans data
    await order.update({
      midtrans_order_id: midtransResponse.order_id,
      midtrans_redirect_url: midtransResponse.redirect_url
    }, { transaction });

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        order_id: order.id,
        order_number: order.order_number,
        total_amount: order.total_amount,
        payment_url: midtransResponse.redirect_url,
        token: midtransResponse.token
      }
    });

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

// Check payment status
const checkPaymentStatus = async (req, res) => {
  try {
    const { order_id } = req.params;
    const member_id = req.user.member_id;

    // Check if user is a member
    if (!member_id) {
      return res.status(403).json({
        success: false,
        message: 'Only members can check payment status'
      });
    }

    const order = await Order.findOne({
      where: { id: order_id, member_id }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (!order.midtrans_order_id) {
      return res.status(400).json({
        success: false,
        message: 'Order has no payment transaction'
      });
    }

    // Get status from Midtrans
    const midtransStatus = await MidtransService.getTransactionStatus(order.midtrans_order_id);

    // Update order status if changed
    const newStatus = MidtransService.mapPaymentStatus(midtransStatus.transaction_status);
    if (newStatus !== order.payment_status) {
      await order.update({
        payment_status: newStatus,
        midtrans_transaction_status: midtransStatus.transaction_status,
        midtrans_fraud_status: midtransStatus.fraud_status,
        paid_at: newStatus === 'paid' ? new Date() : null
      });

      // If payment is successful, activate member package
      if (newStatus === 'paid') {
        try {
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
          }
        } catch (error) {
          console.error('Error creating MemberPackage:', error);
          // Don't throw error here to avoid breaking the status check
        }
      }
    }

    res.json({
      success: true,
      message: 'Payment status retrieved successfully',
      data: {
        order_id: order.id,
        order_number: order.order_number,
        payment_status: newStatus,
        midtrans_status: midtransStatus.transaction_status,
        fraud_status: midtransStatus.fraud_status,
        amount: midtransStatus.gross_amount,
        payment_type: midtransStatus.payment_type,
        va_numbers: midtransStatus.va_numbers,
        pdf_url: midtransStatus.pdf_url
      }
    });

  } catch (error) {
    console.error('Error checking payment status:', error);
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
      payment_status: 'cancelled'
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
    const status = await MidtransService.handleNotification(notification);
    
    // Find order by Midtrans order ID
    const order = await Order.findOne({
      where: { midtrans_order_id: status.order_id }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Map Midtrans status to our status
    const newStatus = MidtransService.mapPaymentStatus(status.transaction_status);

    // Update order
    await order.update({
      payment_status: newStatus,
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

    res.json({
      success: true,
      message: 'Payment notification processed successfully'
    });

  } catch (error) {
    console.error('Error processing payment notification:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Payment callback handlers
const paymentFinish = async (req, res) => {
  try {
    const { order_id, result_code, transaction_status } = req.query;
    
    // Redirect to frontend with payment result
    const redirectUrl = `${process.env.FRONTEND_URL}/payment/result?order_id=${order_id}&status=${transaction_status}`;
    res.redirect(redirectUrl);

  } catch (error) {
    console.error('Error handling payment finish:', error);
    res.redirect(`${process.env.FRONTEND_URL}/payment/error`);
  }
};

const paymentError = async (req, res) => {
  try {
    const { order_id } = req.query;
    res.redirect(`${process.env.FRONTEND_URL}/payment/error?order_id=${order_id}`);
  } catch (error) {
    console.error('Error handling payment error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/payment/error`);
  }
};

const paymentPending = async (req, res) => {
  try {
    const { order_id } = req.query;
    res.redirect(`${process.env.FRONTEND_URL}/payment/pending?order_id=${order_id}`);
  } catch (error) {
    console.error('Error handling payment pending:', error);
    res.redirect(`${process.env.FRONTEND_URL}/payment/pending`);
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  getOrderById,
  checkPaymentStatus,
  cancelOrder,
  paymentNotification,
  paymentFinish,
  paymentError,
  paymentPending
}; 