const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjYzYzdkZGM4LTI4OTAtNDQ3MC1hZjc1LTUyNWJiOWI0Y2EyNCIsImlhdCI6MTc1MzcyNTUxOCwiZXhwIjoxNzUzODExOTE4fQ.79_7mESncsUWGGRuNAnuF02rskf8DjJr4Rqeqvdjgts';

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json'
};

async function debugSemiPrivate() {
  console.log('🔍 Debugging Semi-Private Session Issue...\n');

  try {
    // 1. Test my-packages endpoint
    console.log('1️⃣ Testing my-packages endpoint...');
    const myPackagesResponse = await axios.get(`${BASE_URL}/member-package/my-packages`, { headers });
    
    if (myPackagesResponse.data.success) {
      console.log('✅ my-packages endpoint working');
      
      const currentPackage = myPackagesResponse.data.data.current_active_package;
      if (currentPackage) {
        console.log('📦 Current active package details:');
        console.log(`   - Package name: ${currentPackage.package_name}`);
        console.log(`   - Package type: ${currentPackage.package_type}`);
        console.log(`   - Group sessions: ${currentPackage.session_group_classes.remaining}/${currentPackage.session_group_classes.total}`);
        console.log(`   - Semi-private sessions: ${currentPackage.session_semi_private_classes.remaining}/${currentPackage.session_semi_private_classes.total}`);
        console.log(`   - Private sessions: ${currentPackage.session_private_classes.remaining}/${currentPackage.session_private_classes.total}`);
        
        // Check if package has semi_private sessions
        if (currentPackage.session_semi_private_classes.total > 0) {
          console.log('✅ Package has semi_private sessions!');
        } else {
          console.log('❌ Package has NO semi_private sessions - this is the problem!');
        }
      } else {
        console.log('⚠️ No active package found');
      }
    } else {
      console.log('❌ my-packages endpoint failed:', myPackagesResponse.data.message);
    }

    // 2. Test check-class endpoint
    console.log('\n2️⃣ Testing check-class endpoint...');
    const checkClassResponse = await axios.get(`${BASE_URL}/check-class?date=2025-07-29`, { headers });
    
    if (checkClassResponse.data.success) {
      console.log('✅ check-class endpoint working');
      
      const packageInfo = checkClassResponse.data.data.package_info;
      console.log('📦 Package info from check-class:');
      console.log(`   - Package name: ${packageInfo.package_name}`);
      console.log(`   - Package type: ${packageInfo.package_type}`);
      console.log(`   - Remaining sessions:`, packageInfo.remaining_sessions);
      
      // Check semi-private schedules
      const schedules = checkClassResponse.data.data.schedules;
      const semiPrivateSchedules = schedules.filter(s => s.schedule_type === 'semi_private');
      
      console.log(`\n📊 Found ${semiPrivateSchedules.length} semi-private schedules`);
      
      semiPrivateSchedules.forEach(schedule => {
        console.log(`   - ${schedule.class.name} at ${schedule.time_start}`);
        console.log(`     * can_book: ${schedule.can_book}`);
        console.log(`     * available_sessions: ${schedule.available_sessions}`);
        console.log(`     * is_booked: ${schedule.is_booked}`);
      });
      
      if (semiPrivateSchedules.length === 0) {
        console.log('⚠️ No semi-private schedules found for this date');
      }
    } else {
      console.log('❌ check-class endpoint failed:', checkClassResponse.data.message);
    }

    console.log('\n🎯 Debug completed!');

  } catch (error) {
    console.error('❌ Debug failed:', error.response?.data || error.message);
  }
}

// Run the debug
debugSemiPrivate(); 