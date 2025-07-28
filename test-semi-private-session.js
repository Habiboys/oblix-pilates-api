const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjYzYzdkZGM4LTI4OTAtNDQ3MC1hZjc1LTUyNWJiOWI0Y2EyNCIsImlhdCI6MTc1MzcyNTUxOCwiZXhwIjoxNzUzODExOTE4fQ.79_7mESncsUWGGRuNAnuF02rskf8DjJr4Rqeqvdjgts';

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json'
};

async function testSemiPrivateSession() {
  console.log('🧪 Testing Semi-Private Session Implementation...\n');

  try {
    // 1. Test check-class endpoint
    console.log('1️⃣ Testing check-class endpoint...');
    const checkClassResponse = await axios.get(`${BASE_URL}/check-class?date=2025-01-29`, { headers });
    
    if (checkClassResponse.data.success) {
      console.log('✅ check-class endpoint working');
      
      // Check if semi_private sessions are displayed
      const schedules = checkClassResponse.data.data.schedules;
      const semiPrivateSchedules = schedules.filter(s => s.schedule_type === 'semi_private');
      
      console.log(`📊 Found ${semiPrivateSchedules.length} semi-private schedules`);
      
      semiPrivateSchedules.forEach(schedule => {
        console.log(`   - ${schedule.class.name} at ${schedule.time_start} (available_sessions: ${schedule.available_sessions})`);
      });
    } else {
      console.log('❌ check-class endpoint failed:', checkClassResponse.data.message);
    }

    // 2. Test my-packages endpoint
    console.log('\n2️⃣ Testing my-packages endpoint...');
    const myPackagesResponse = await axios.get(`${BASE_URL}/member-package/my-packages`, { headers });
    
    if (myPackagesResponse.data.success) {
      console.log('✅ my-packages endpoint working');
      
      const currentPackage = myPackagesResponse.data.data.current_active_package;
      if (currentPackage) {
        console.log('📦 Current active package:');
        console.log(`   - Package: ${currentPackage.package_name}`);
        console.log(`   - Package type: ${currentPackage.package_type}`);
        console.log(`   - Group sessions: ${currentPackage.session_group_classes.remaining}/${currentPackage.session_group_classes.total}`);
        console.log(`   - Semi-private sessions: ${currentPackage.session_semi_private_classes.remaining}/${currentPackage.session_semi_private_classes.total}`);
        console.log(`   - Private sessions: ${currentPackage.session_private_classes.remaining}/${currentPackage.session_private_classes.total}`);
        
        // Check if package has semi_private sessions (should only be membership)
        if (currentPackage.session_semi_private_classes.total > 0) {
          console.log('✅ Package has semi_private sessions!');
          if (currentPackage.package_type === 'membership') {
            console.log('✅ Correct: Semi_private sessions only in membership package');
            console.log('   - Expected category: Semi-Private Class');
          } else {
            console.log('❌ Error: Semi_private sessions found in non-membership package');
          }
        } else {
          console.log('⚠️ Package has no semi_private sessions');
          if (currentPackage.package_type === 'membership') {
            console.log('⚠️ Membership package has no semi_private sessions (might be Group Class/Private Class category)');
          } else {
            console.log('✅ Correct: Non-membership package has no semi_private sessions');
          }
        }
      } else {
        console.log('⚠️ No active package found');
      }
    } else {
      console.log('❌ my-packages endpoint failed:', myPackagesResponse.data.message);
    }

    // 3. Test booking semi-private schedule (if available)
    console.log('\n3️⃣ Testing booking semi-private schedule...');
    const semiPrivateSchedule = checkClassResponse.data.data.schedules.find(s => 
      s.schedule_type === 'semi_private' && s.can_book && !s.is_booked
    );
    
    if (semiPrivateSchedule) {
      console.log(`🎯 Found bookable semi-private schedule: ${semiPrivateSchedule.class.name}`);
      console.log(`   - Available sessions: ${semiPrivateSchedule.available_sessions}`);
      
      // Try to book
      const bookingResponse = await axios.post(`${BASE_URL}/booking`, {
        schedule_id: semiPrivateSchedule.id
      }, { headers });
      
      if (bookingResponse.data.success) {
        console.log('✅ Successfully booked semi-private schedule');
        console.log(`   - Booking ID: ${bookingResponse.data.data.id}`);
        console.log(`   - Status: ${bookingResponse.data.data.status}`);
      } else {
        console.log('❌ Failed to book semi-private schedule:', bookingResponse.data.message);
        if (bookingResponse.data.data) {
          console.log(`   - Schedule type: ${bookingResponse.data.data.schedule_type}`);
          console.log(`   - Available sessions: ${bookingResponse.data.data.available_sessions}`);
        }
      }
    } else {
      console.log('⚠️ No bookable semi-private schedule found');
      
      // Check why no bookable schedule
      const allSemiPrivateSchedules = checkClassResponse.data.data.schedules.filter(s => s.schedule_type === 'semi_private');
      console.log(`   - Total semi-private schedules: ${allSemiPrivateSchedules.length}`);
      allSemiPrivateSchedules.forEach(schedule => {
        console.log(`     * ${schedule.class.name}: can_book=${schedule.can_book}, is_booked=${schedule.is_booked}, available_sessions=${schedule.available_sessions}`);
      });
    }

    console.log('\n🎉 Test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testSemiPrivateSession(); 