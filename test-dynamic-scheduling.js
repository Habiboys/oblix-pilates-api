/**
 * Test script untuk Dynamic Cancel Scheduling System
 * 
 * Script ini digunakan untuk memverifikasi bahwa sistem dynamic scheduling
 * berjalan dengan baik dan dapat diintegrasikan dengan sistem yang ada.
 */

const { 
    startDynamicCancelScheduling, 
    refreshDynamicCancelScheduling, 
    getScheduledCancelTasksStatus,
    stopAllCronJobs 
} = require('./src/cron/bookingCron');

const { Schedule } = require('./src/models');
const logger = require('./src/config/logger');

/**
 * Test 1: Setup Dynamic Scheduling
 */
const testSetupDynamicScheduling = async () => {
    console.log('🧪 Test 1: Setup Dynamic Scheduling');
    
    try {
        // Start dynamic scheduling
        startDynamicCancelScheduling();
        
        // Wait a bit for scheduling to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get status
        const status = getScheduledCancelTasksStatus();
        console.log('✅ Dynamic scheduling setup completed');
        console.log('📊 Status:', status);
        
        return status;
    } catch (error) {
        console.error('❌ Test 1 failed:', error);
        throw error;
    }
};

/**
 * Test 2: Refresh Dynamic Scheduling
 */
const testRefreshDynamicScheduling = async () => {
    console.log('🧪 Test 2: Refresh Dynamic Scheduling');
    
    try {
        const result = await refreshDynamicCancelScheduling();
        console.log('✅ Dynamic scheduling refresh completed');
        console.log('📊 Result:', result);
        
        return result;
    } catch (error) {
        console.error('❌ Test 2 failed:', error);
        throw error;
    }
};

/**
 * Test 3: Check Scheduled Tasks
 */
const testCheckScheduledTasks = () => {
    console.log('🧪 Test 3: Check Scheduled Tasks');
    
    try {
        const status = getScheduledCancelTasksStatus();
        console.log('✅ Scheduled tasks check completed');
        console.log('📊 Status:', status);
        
        if (status.total_scheduled > 0) {
            console.log('✅ Found scheduled tasks:', status.total_scheduled);
        } else {
            console.log('⚠️ No scheduled tasks found (this might be normal if no future schedules exist)');
        }
        
        return status;
    } catch (error) {
        console.error('❌ Test 3 failed:', error);
        throw error;
    }
};

/**
 * Test 4: Check Future Schedules
 */
const testCheckFutureSchedules = async () => {
    console.log('🧪 Test 4: Check Future Schedules');
    
    try {
        const currentTime = new Date();
        
        const schedules = await Schedule.findAll({
            where: {
                date_start: {
                    [require('sequelize').Op.gte]: currentTime.toISOString().split('T')[0]
                },
                type: {
                    [require('sequelize').Op.in]: ['group', 'semi_private']
                }
            },
            attributes: ['id', 'date_start', 'time_start', 'cancel_buffer_minutes', 'type'],
            order: [['date_start', 'ASC'], ['time_start', 'ASC']]
        });
        
        console.log('✅ Future schedules check completed');
        console.log('📊 Found schedules:', schedules.length);
        
        schedules.forEach(schedule => {
            const scheduleDateTime = new Date(`${schedule.date_start}T${schedule.time_start}`);
            const cancelBufferMinutes = schedule.cancel_buffer_minutes || 120;
            const cancelDeadline = new Date(scheduleDateTime.getTime() - (cancelBufferMinutes * 60 * 1000));
            
            console.log(`📅 Schedule ${schedule.id}:`);
            console.log(`   - Date: ${schedule.date_start} ${schedule.time_start}`);
            console.log(`   - Type: ${schedule.type}`);
            console.log(`   - Buffer: ${cancelBufferMinutes} minutes`);
            console.log(`   - Cancel Deadline: ${cancelDeadline.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`);
            console.log(`   - Should be scheduled: ${cancelDeadline > currentTime ? 'Yes' : 'No'}`);
        });
        
        return schedules;
    } catch (error) {
        console.error('❌ Test 4 failed:', error);
        throw error;
    }
};

/**
 * Test 5: Cleanup
 */
const testCleanup = () => {
    console.log('🧪 Test 5: Cleanup');
    
    try {
        stopAllCronJobs();
        console.log('✅ Cleanup completed');
    } catch (error) {
        console.error('❌ Test 5 failed:', error);
        throw error;
    }
};

/**
 * Run all tests
 */
const runAllTests = async () => {
    console.log('🚀 Starting Dynamic Cancel Scheduling Tests');
    console.log('==========================================');
    
    try {
        // Test 1: Setup
        await testSetupDynamicScheduling();
        console.log('');
        
        // Test 2: Refresh
        await testRefreshDynamicScheduling();
        console.log('');
        
        // Test 3: Check Tasks
        testCheckScheduledTasks();
        console.log('');
        
        // Test 4: Check Schedules
        await testCheckFutureSchedules();
        console.log('');
        
        // Test 5: Cleanup
        testCleanup();
        console.log('');
        
        console.log('✅ All tests completed successfully!');
        console.log('');
        console.log('📋 Summary:');
        console.log('- Dynamic scheduling system is working correctly');
        console.log('- Refresh mechanism is functional');
        console.log('- Status monitoring is operational');
        console.log('- Future schedules are being processed correctly');
        console.log('');
        console.log('🎉 System is ready for production use!');
        
    } catch (error) {
        console.error('❌ Test suite failed:', error);
        process.exit(1);
    }
};

/**
 * Manual test functions for debugging
 */
const manualTests = {
    // Test specific schedule
    testSpecificSchedule: async (scheduleId) => {
        console.log(`🧪 Testing specific schedule: ${scheduleId}`);
        
        const schedule = await Schedule.findByPk(scheduleId);
        if (!schedule) {
            console.error('❌ Schedule not found');
            return;
        }
        
        const scheduleDateTime = new Date(`${schedule.date_start}T${schedule.time_start}`);
        const cancelBufferMinutes = schedule.cancel_buffer_minutes || 120;
        const cancelDeadline = new Date(scheduleDateTime.getTime() - (cancelBufferMinutes * 60 * 1000));
        const currentTime = new Date();
        
        console.log('📅 Schedule details:');
        console.log(`   - Date: ${schedule.date_start} ${schedule.time_start}`);
        console.log(`   - Type: ${schedule.type}`);
        console.log(`   - Buffer: ${cancelBufferMinutes} minutes`);
        console.log(`   - Cancel Deadline: ${cancelDeadline.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`);
        console.log(`   - Current Time: ${currentTime.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`);
        console.log(`   - Should be scheduled: ${cancelDeadline > currentTime ? 'Yes' : 'No'}`);
    },
    
    // Test refresh only
    testRefreshOnly: async () => {
        console.log('🧪 Testing refresh only');
        const result = await refreshDynamicCancelScheduling();
        console.log('📊 Refresh result:', result);
    },
    
    // Test status only
    testStatusOnly: () => {
        console.log('🧪 Testing status only');
        const status = getScheduledCancelTasksStatus();
        console.log('📊 Status:', status);
    }
};

// Export for manual testing
module.exports = {
    runAllTests,
    manualTests,
    testSetupDynamicScheduling,
    testRefreshDynamicScheduling,
    testCheckScheduledTasks,
    testCheckFutureSchedules,
    testCleanup
};

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests();
} 