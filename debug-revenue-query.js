require('dotenv').config();
const { Member, Order, Payment, Schedule, Booking, Trainer, Class } = require('./src/models');
const { Op } = require('sequelize');

async function debugRevenueQuery() {
    try {
        console.log('Testing revenue query...');
        
        const startDate = '2025-08-31';
        const endDate = '2025-09-17';
        
        console.log('Date range:', startDate, 'to', endDate);
        
        // Test 1: Simple count query
        console.log('\n1. Testing simple count query...');
        const totalMembers = await Member.count();
        console.log('Total members:', totalMembers);
        
        // Test 2: Order count with date filter
        console.log('\n2. Testing Order count with date filter...');
        const totalPayments = await Order.count({
            where: {
                payment_status: 'paid',
                createdAt: {
                    [Op.between]: [startDate + ' 00:00:00', endDate + ' 23:59:59']
                }
            }
        });
        console.log('Total payments:', totalPayments);
        
        // Test 3: Order sum with date filter
        console.log('\n3. Testing Order sum with date filter...');
        const totalRevenue = await Order.sum('total_amount', {
            where: {
                payment_status: 'paid',
                createdAt: {
                    [Op.between]: [startDate + ' 00:00:00', endDate + ' 23:59:59']
                }
            }
        });
        console.log('Total revenue:', totalRevenue);
        
        // Test 4: Order findAll with include
        console.log('\n4. Testing Order findAll with include...');
        const orders = await Order.findAll({
            where: {
                payment_status: 'paid',
                createdAt: {
                    [Op.between]: [startDate + ' 00:00:00', endDate + ' 23:59:59']
                }
            },
            include: [
                {
                    model: Member,
                    attributes: ['id', 'full_name']
                }
            ],
            limit: 5
        });
        console.log('Orders found:', orders.length);
        
        console.log('\nAll tests passed!');
        
    } catch (error) {
        console.error('Error during testing:', error);
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
    } finally {
        process.exit(0);
    }
}

debugRevenueQuery();
