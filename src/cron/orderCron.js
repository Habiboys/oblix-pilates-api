const cron = require('node-cron');
const { Order } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const MidtransService = require('../services/midtrans.service');

/**
 * Cron job untuk handle expired orders yang tidak tercatat di Midtrans
 * Berjalan setiap 10 menit untuk presisi yang lebih baik
 */
const startOrderExpiryCron = () => {
    // Schedule: setiap 10 menit
    cron.schedule('*/10 * * * *', async () => {
        logger.info('🕐 Running order expiry cron job...');
        
        try {
            const result = await handleExpiredOrders();
            
            if (result.success) {
                logger.info(`✅ Order expiry cron completed: ${result.expired_count} orders expired, ${result.cancelled_count} cancelled`);
                
                // Log details of expired orders
                if (result.expired_orders.length > 0) {
                    result.expired_orders.forEach(order => {
                        logger.info(`📋 Expired order ${order.order_number} for member ${order.member_id}`);
                    });
                }
                
                // Log details of cancelled orders
                if (result.cancelled_orders.length > 0) {
                    result.cancelled_orders.forEach(order => {
                        logger.info(`📋 Cancelled phantom order ${order.order_number} for member ${order.member_id}`);
                    });
                }
            } else {
                logger.error('❌ Order expiry cron failed:', result.error);
            }
        } catch (error) {
            logger.error('❌ Error in order expiry cron job:', error);
            // Don't let the cron job crash the application
            // Just log the error and continue
        }
    }, {
        scheduled: true,
        timezone: "Asia/Jakarta"
    });

    logger.info('🕐 Order expiry cron job scheduled (every 10 minutes)');
};

/**
 * Handle expired orders dengan beberapa skenario:
 * 1. Order yang sudah expired berdasarkan expired_at
 * 2. Order pending yang tidak ada transaction_id dari Midtrans (phantom orders)
 * 3. Order pending yang sudah lama tidak ada update
 */
const handleExpiredOrders = async () => {
    try {
        logger.info('🔄 Starting expired order handling process...');
        
        const currentTime = new Date();
        let expiredCount = 0;
        let cancelledCount = 0;
        const expiredOrders = [];
        const cancelledOrders = [];
        
                // 1. Handle orders yang sudah expired berdasarkan expired_at
        const expiredOrdersByTime = await Order.findAll({
          where: {
            status: { [Op.in]: ['pending', 'processing'] },
            payment_status: 'pending',
            expired_at: {
              [Op.lt]: currentTime
            }
          },
          attributes: ['id', 'order_number', 'member_id', 'status', 'payment_status', 'expired_at'],
          limit: 100 // Process in batches
        });
        
        for (const order of expiredOrdersByTime) {
            try {
                // Update status menjadi expired
                await order.update({
                    status: 'cancelled',
                    payment_status: 'expired',
                    cancelled_at: currentTime,
                    cancelled_by: 'system',
                    cancel_reason: 'Payment expired via time check'
                });
                
                expiredCount++;
                expiredOrders.push({
                    order_number: order.order_number,
                    member_id: order.member_id
                });
                
                logger.info(`✅ Order ${order.order_number} marked as expired (time-based)`);
            } catch (error) {
                logger.error(`❌ Error updating expired order ${order.order_number}:`, error);
            }
        }
        
                // 2. Handle phantom orders (pending tanpa transaction_id dari Midtrans)
        // Order yang sudah lebih dari 20 menit tapi tidak ada transaction_id
        const phantomOrdersTimeout = new Date(currentTime.getTime() - (20 * 60 * 1000)); // 20 menit
        
        const phantomOrders = await Order.findAll({
          where: {
            status: { [Op.in]: ['pending', 'processing'] },
            payment_status: 'pending',
            midtrans_transaction_id: null, // Tidak ada transaction_id dari Midtrans
            createdAt: {
              [Op.lt]: phantomOrdersTimeout
            }
          },
          attributes: ['id', 'order_number', 'member_id', 'status', 'payment_status', 'midtrans_order_id', 'createdAt'],
          limit: 100 // Process in batches
        });
        
        for (const order of phantomOrders) {
            try {
                // Verifikasi dengan Midtrans API apakah order ini benar-benar ada
                let shouldCancel = true;
                
                if (order.midtrans_order_id) {
                    try {
                        // Coba cek status di Midtrans
                        const midtransStatus = await MidtransService.getTransactionStatus(order.midtrans_order_id);
                        if (midtransStatus && midtransStatus.transaction_status) {
                            // Order ada di Midtrans, jangan cancel
                            shouldCancel = false;
                            logger.info(`ℹ️ Order ${order.order_number} exists in Midtrans with status: ${midtransStatus.transaction_status}`);
                        }
                    } catch (error) {
                        // Jika 404 atau error lain, berarti order tidak ada di Midtrans
                        if (error.httpStatusCode === '404' || 
                            (error.ApiResponse && error.ApiResponse.status_code === '404') ||
                            (error.message && error.message.includes("Transaction doesn't exist"))) {
                            shouldCancel = true;
                            logger.info(`ℹ️ Order ${order.order_number} not found in Midtrans (phantom order)`);
                        } else {
                            // Error lain, skip untuk sementara
                            shouldCancel = false;
                            logger.warn(`⚠️ Error checking Midtrans status for order ${order.order_number}:`, error.message);
                        }
                    }
                }
                
                if (shouldCancel) {
                    // Update status menjadi cancelled
                    await order.update({
                        status: 'cancelled',
                        payment_status: 'cancelled',
                        cancelled_at: currentTime,
                        cancelled_by: 'system',
                        cancel_reason: 'Phantom order - not found in Midtrans'
                    });
                    
                    cancelledCount++;
                    cancelledOrders.push({
                        order_number: order.order_number,
                        member_id: order.member_id
                    });
                    
                    logger.info(`✅ Phantom order ${order.order_number} cancelled (not found in Midtrans)`);
                }
            } catch (error) {
                logger.error(`❌ Error handling phantom order ${order.order_number}:`, error);
            }
        }
        
                // 3. Handle orders yang sudah lama pending (lebih dari 30 menit)
        // Ini sebagai fallback untuk order yang mungkin terlewat
        const longPendingTimeout = new Date(currentTime.getTime() - (30 * 60 * 1000)); // 30 menit
        
        const longPendingOrders = await Order.findAll({
          where: {
            status: { [Op.in]: ['pending', 'processing'] },
            payment_status: 'pending',
            createdAt: {
              [Op.lt]: longPendingTimeout
            }
          },
          attributes: ['id', 'order_number', 'member_id', 'status', 'payment_status', 'createdAt'],
          limit: 100 // Process in batches
        });
        
        for (const order of longPendingOrders) {
            try {
                // Skip jika sudah dihandle di atas
                if (order.status === 'cancelled') continue;
                
                // Update status menjadi expired
                await order.update({
                    status: 'cancelled',
                    payment_status: 'expired',
                    cancelled_at: currentTime,
                    cancelled_by: 'system',
                    cancel_reason: 'Long pending order - auto expired'
                });
                
                expiredCount++;
                expiredOrders.push({
                    order_number: order.order_number,
                    member_id: order.member_id
                });
                
                logger.info(`✅ Long pending order ${order.order_number} marked as expired`);
            } catch (error) {
                logger.error(`❌ Error updating long pending order ${order.order_number}:`, error);
            }
        }
        
        logger.info(`✅ Expired order handling completed: ${expiredCount} expired, ${cancelledCount} cancelled`);
        
        return {
            success: true,
            expired_count: expiredCount,
            cancelled_count: cancelledCount,
            expired_orders: expiredOrders,
            cancelled_orders: cancelledOrders
        };
        
    } catch (error) {
        logger.error('❌ Error in handleExpiredOrders:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Manual trigger untuk testing
 */
const triggerOrderExpiry = async () => {
    logger.info('🔄 Manually triggering order expiry process...');
    return await handleExpiredOrders();
};

module.exports = {
    startOrderExpiryCron,
    handleExpiredOrders,
    triggerOrderExpiry
};
