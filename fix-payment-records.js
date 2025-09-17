const { Order, Payment } = require('./src/models');
const { Op } = require('sequelize');

/**
 * Script to fix missing Payment records for existing orders
 * This will create Payment records for orders that have payment_status = 'paid' but no corresponding Payment record
 */
async function fixPaymentRecords() {
    try {
        console.log('🔍 Checking for orders with missing Payment records...');
        
        // Find orders that are paid but don't have Payment records
        const ordersWithoutPayments = await Order.findAll({
            where: {
                payment_status: 'paid',
                status: 'completed'
            },
            include: [
                {
                    model: Payment,
                    required: false // LEFT JOIN
                }
            ]
        });

        // Filter orders that don't have Payment records
        const ordersToFix = ordersWithoutPayments.filter(order => !order.Payment);
        
        console.log(`📊 Found ${ordersToFix.length} orders without Payment records`);

        if (ordersToFix.length === 0) {
            console.log('✅ All orders already have Payment records!');
            return;
        }

        // Create Payment records for missing orders
        let successCount = 0;
        let errorCount = 0;

        for (const order of ordersToFix) {
            try {
                await Payment.create({
                    order_id: order.id,
                    payment_type: order.midtrans_payment_type || 'unknown',
                    payment_status: 'success',
                    transaction_time: order.paid_at || order.created_at,
                    settlement_time: order.paid_at || order.created_at,
                    midtrans_response: {
                        order_id: order.order_number,
                        transaction_id: order.midtrans_transaction_id,
                        transaction_status: order.midtrans_transaction_status,
                        payment_type: order.midtrans_payment_type,
                        fraud_status: order.midtrans_fraud_status,
                        va_numbers: order.midtrans_va_numbers,
                        pdf_url: order.midtrans_pdf_url
                    }
                });

                console.log(`✅ Created Payment record for order ${order.order_number}`);
                successCount++;
            } catch (error) {
                console.error(`❌ Error creating Payment record for order ${order.order_number}:`, error.message);
                errorCount++;
            }
        }

        console.log('\n📈 Summary:');
        console.log(`✅ Successfully created: ${successCount} Payment records`);
        console.log(`❌ Errors: ${errorCount}`);
        
        if (successCount > 0) {
            console.log('\n🎉 Payment records have been created! Revenue reports should now show correct data.');
        }

    } catch (error) {
        console.error('❌ Error in fix-payment-records script:', error);
    } finally {
        process.exit(0);
    }
}

// Run the script
fixPaymentRecords();
