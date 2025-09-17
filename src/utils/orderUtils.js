const { Order, Payment, MemberPackage, Package } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const MidtransService = require('../services/midtrans.service');

/**
 * Update order status based on Midtrans notification
 * Best practice: Always verify with Midtrans API before updating
 */
const updateOrderStatus = async (orderId, midtransData, notificationData) => {
    try {
        const order = await Order.findByPk(orderId);
        if (!order) {
            logger.error(`Order ${orderId} not found for status update`);
            return { success: false, error: 'Order not found' };
        }

        const currentTime = new Date();
        const updateData = {
            last_midtrans_check: currentTime,
            midtrans_check_count: order.midtrans_check_count + 1
        };

        // Update Midtrans fields
        if (midtransData.transaction_id) {
            updateData.midtrans_transaction_id = midtransData.transaction_id;
        }
        if (midtransData.transaction_status) {
            updateData.midtrans_transaction_status = midtransData.transaction_status;
        }
        if (midtransData.fraud_status) {
            updateData.midtrans_fraud_status = midtransData.fraud_status;
        }
        if (midtransData.payment_type) {
            updateData.midtrans_payment_type = midtransData.payment_type;
        }
        if (midtransData.va_numbers) {
            updateData.midtrans_va_numbers = midtransData.va_numbers;
        }
        if (midtransData.pdf_url) {
            updateData.midtrans_pdf_url = midtransData.pdf_url;
        }

        // Map payment status
        const newPaymentStatus = MidtransService.mapPaymentStatus(midtransData.transaction_status);
        const newOrderStatus = mapOrderStatus(newPaymentStatus, midtransData.transaction_status);

        updateData.payment_status = newPaymentStatus;
        updateData.status = newOrderStatus;

        // Set timestamps based on status
        if (newPaymentStatus === 'paid') {
            updateData.paid_at = currentTime;
        } else if (newPaymentStatus === 'expired') {
            updateData.expired_at = currentTime;
        } else if (newPaymentStatus === 'cancelled') {
            updateData.cancelled_at = currentTime;
            updateData.cancelled_by = 'system';
            updateData.cancel_reason = 'Cancelled via Midtrans notification';
        }

        // Update order
        await order.update(updateData);

        // Create or update Payment record
        await createOrUpdatePayment(order, midtransData, newPaymentStatus);

        // If payment successful, create member package
        if (newPaymentStatus === 'paid' && newOrderStatus === 'completed') {
            await createMemberPackage(order);
        }

        logger.info(`✅ Order ${order.order_number} status updated to ${newPaymentStatus}/${newOrderStatus}`);

        return {
            success: true,
            order_id: order.id,
            old_status: order.payment_status,
            new_status: newPaymentStatus,
            order_status: newOrderStatus
        };

    } catch (error) {
        logger.error(`❌ Error updating order status for ${orderId}:`, error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Map payment status to order status
 */
const mapOrderStatus = (paymentStatus, midtransStatus) => {
    switch (paymentStatus) {
        case 'paid':
            return 'completed';
        case 'pending':
            return 'processing';
        case 'failed':
        case 'expired':
        case 'cancelled':
            return 'cancelled';
        default:
            return 'pending';
    }
};

/**
 * Create member package when payment is successful
 */
const createMemberPackage = async (order) => {
    try {
        // Check if member package already exists
        const existingPackage = await MemberPackage.findOne({
            where: {
                member_id: order.member_id,
                package_id: order.package_id
            }
        });

        if (existingPackage) {
            logger.warn(`Member package already exists for order ${order.order_number}`);
            return;
        }

        // Get package details
        const package = await Package.findByPk(order.package_id);
        if (!package) {
            logger.error(`Package ${order.package_id} not found for member package creation`);
            return;
        }

        // Calculate start and end dates
        const startDate = new Date();
        let endDate = new Date();

        switch (package.duration_unit) {
            case 'days':
                endDate.setDate(endDate.getDate() + package.duration_value);
                break;
            case 'weeks':
                endDate.setDate(endDate.getDate() + (package.duration_value * 7));
                break;
            case 'months':
                endDate.setMonth(endDate.getMonth() + package.duration_value);
                break;
            case 'years':
                endDate.setFullYear(endDate.getFullYear() + package.duration_value);
                break;
            default:
                endDate.setDate(endDate.getDate() + 30); // Default 30 days
        }

        // Create member package
        const memberPackage = await MemberPackage.create({
            member_id: order.member_id,
            package_id: order.package_id,
            start_date: startDate,
            end_date: endDate,
            total_group_session: package.type === 'group' ? package.session_count : 0,
            total_semi_private_session: package.type === 'semi_private' ? package.session_count : 0,
            total_private_session: package.type === 'private' ? package.session_count : 0,
            remaining_group_session: package.type === 'group' ? package.session_count : 0,
            remaining_semi_private_session: package.type === 'semi_private' ? package.session_count : 0,
            remaining_private_session: package.type === 'private' ? package.session_count : 0,
            used_group_session: 0,
            used_semi_private_session: 0,
            used_private_session: 0,
            status: 'active'
        });

        logger.info(`✅ Member package created for order ${order.order_number}: ${memberPackage.id}`);

    } catch (error) {
        logger.error(`❌ Error creating member package for order ${order.order_number}:`, error);
    }
};

/**
 * Check if order is phantom (never created in Midtrans)
 */
const isPhantomOrder = (order) => {
    return order.is_phantom_order || 
           (!order.midtrans_transaction_id && 
            !order.midtrans_created_at && 
            order.payment_status === 'pending');
};

/**
 * Get orders that need status verification
 */
const getOrdersForVerification = async (limit = 50) => {
    try {
        const orders = await Order.findAll({
            where: {
                status: { [Op.in]: ['pending', 'processing'] },
                payment_status: 'pending',
                last_midtrans_check: {
                    [Op.or]: [
                        null,
                        { [Op.lt]: new Date(Date.now() - (15 * 60 * 1000)) } // 15 minutes ago
                    ]
                }
            },
            order: [['last_midtrans_check', 'ASC']],
            limit
        });

        return {
            success: true,
            orders,
            count: orders.length
        };

    } catch (error) {
        logger.error('❌ Error getting orders for verification:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Verify order status with Midtrans
 */
const verifyOrderWithMidtrans = async (order) => {
    try {
        if (!order.midtrans_order_id) {
            logger.warn(`Order ${order.order_number} has no Midtrans order ID`);
            return { success: false, error: 'No Midtrans order ID' };
        }

        const midtransStatus = await MidtransService.getTransactionStatus(order.midtrans_order_id);
        
        // Update tracking fields
        await order.update({
            last_midtrans_check: new Date(),
            midtrans_check_count: order.midtrans_check_count + 1
        });

        return {
            success: true,
            order_id: order.id,
            midtrans_status: midtransStatus
        };

    } catch (error) {
        // Handle 404 error (order not found in Midtrans)
        if (error.httpStatusCode === '404' || 
            (error.ApiResponse && error.ApiResponse.status_code === '404') ||
            (error.message && error.message.includes("Transaction doesn't exist"))) {
            
            // Mark as phantom order
            await order.update({
                is_phantom_order: true,
                last_midtrans_check: new Date(),
                midtrans_check_count: order.midtrans_check_count + 1
            });

            return {
                success: false,
                error: 'Order not found in Midtrans',
                is_phantom: true
            };
        }

        logger.error(`❌ Error verifying order ${order.order_number} with Midtrans:`, error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Create or update Payment record
 */
const createOrUpdatePayment = async (order, midtransData, paymentStatus) => {
    try {
        // Check if payment record already exists
        let payment = await Payment.findOne({
            where: { order_id: order.id }
        });

        const paymentData = {
            order_id: order.id,
            payment_type: midtransData.payment_type || order.midtrans_payment_type || 'unknown',
            payment_status: paymentStatus === 'paid' ? 'success' : 
                          paymentStatus === 'failed' ? 'failed' : 'pending',
            transaction_time: midtransData.transaction_time || new Date(),
            settlement_time: paymentStatus === 'paid' ? new Date() : null,
            midtrans_response: midtransData
        };

        if (payment) {
            // Update existing payment record
            await payment.update(paymentData);
            logger.info(`✅ Payment record updated for order ${order.order_number}`);
        } else {
            // Create new payment record
            payment = await Payment.create(paymentData);
            logger.info(`✅ Payment record created for order ${order.order_number}`);
        }

        return payment;

    } catch (error) {
        logger.error(`❌ Error creating/updating payment record for order ${order.order_number}:`, error);
        throw error;
    }
};

module.exports = {
    updateOrderStatus,
    mapOrderStatus,
    createMemberPackage,
    createOrUpdatePayment,
    isPhantomOrder,
    getOrdersForVerification,
    verifyOrderWithMidtrans
};
