// inject-sessions-simple.js
// Script sederhana untuk inject sesi dengan nilai hardcoded untuk testing

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000/api';
const ADMIN_EMAIL = 'admin@oblix.com';
const ADMIN_PASSWORD = 'admin123';

// Test configuration - bisa diubah sesuai kebutuhan
const TEST_CONFIG = {
  memberEmail: 'member@test.com', // Ganti dengan email member yang ada
  groupSessions: 5,
  semiPrivateSessions: 3,
  privateSessions: 2
};

// Helper function untuk login admin
const loginAdmin = async () => {
  try {
    console.log('🔐 Logging in as admin...');
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    
    if (response.data.message === 'Login successful') {
      return response.data.data.accessToken;
    } else {
      throw new Error('Login failed');
    }
  } catch (error) {
    console.error('❌ Login error:', error.response?.data?.message || error.message);
    throw error;
  }
};

// Helper function untuk membuat package
const createPackage = async (token, packageData) => {
  try {
    const response = await axios.post(`${BASE_URL}/package`, packageData, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.data.success) {
      return response.data.data;
    } else {
      throw new Error(response.data.message);
    }
  } catch (error) {
    console.error('❌ Create package error:', error.response?.data?.message || error.message);
    throw error;
  }
};

// Helper function untuk membuat member package
const createMemberPackage = async (token, memberPackageData) => {
  try {
    const response = await axios.post(`${BASE_URL}/member-package`, memberPackageData, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.data.success) {
      return response.data.data;
    } else {
      throw new Error(response.data.message);
    }
  } catch (error) {
    console.error('❌ Create member package error:', error.response?.data?.message || error.message);
    throw error;
  }
};

// Helper function untuk mendapatkan member ID
const getMemberId = async (token, memberEmail) => {
  try {
    const response = await axios.get(`${BASE_URL}/member?search=${memberEmail}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.data.success && response.data.data.members.length > 0) {
      return response.data.data.members[0].id;
    } else {
      throw new Error('Member not found');
    }
  } catch (error) {
    console.error('❌ Get member error:', error.response?.data?.message || error.message);
    throw error;
  }
};

// Main function
const injectSessionsSimple = async () => {
  try {
    console.log('🚀 Starting simple session injection script...\n');
    console.log('📋 Test Configuration:');
    console.log(`   Member Email: ${TEST_CONFIG.memberEmail}`);
    console.log(`   Group Sessions: ${TEST_CONFIG.groupSessions}`);
    console.log(`   Semi-Private Sessions: ${TEST_CONFIG.semiPrivateSessions}`);
    console.log(`   Private Sessions: ${TEST_CONFIG.privateSessions}\n`);
    
    // Login admin
    const token = await loginAdmin();
    console.log('✅ Admin login successful\n');
    
    // Get member ID
    const memberId = await getMemberId(token, TEST_CONFIG.memberEmail);
    console.log(`✅ Found member: ${TEST_CONFIG.memberEmail} (ID: ${memberId})\n`);
    
    // Create 3 start packages
    console.log('📦 Creating start packages...');
    
    // 1. Start Package Group
    const groupPackage = await createPackage(token, {
      name: 'Start Package Group',
      price: 0,
      duration_value: 1,
      duration_unit: 'month',
      reminder_day: 7,
      reminder_session: 2,
      type: 'membership'
    });
    console.log(`✅ Created: ${groupPackage.name} (ID: ${groupPackage.id})`);
    
    // 2. Start Package Semi-Private
    const semiPrivatePackage = await createPackage(token, {
      name: 'Start Package Semi-Private',
      price: 0,
      duration_value: 1,
      duration_unit: 'month',
      reminder_day: 7,
      reminder_session: 2,
      type: 'membership'
    });
    console.log(`✅ Created: ${semiPrivatePackage.name} (ID: ${semiPrivatePackage.id})`);
    
    // 3. Start Package Private
    const privatePackage = await createPackage(token, {
      name: 'Start Package Private',
      price: 0,
      duration_value: 1,
      duration_unit: 'month',
      reminder_day: 7,
      reminder_session: 2,
      type: 'membership'
    });
    console.log(`✅ Created: ${privatePackage.name} (ID: ${privatePackage.id})`);
    console.log('');
    
    // Create member packages with custom session counts
    console.log('👤 Creating member packages with custom sessions...');
    
    // 1. Member Package Group
    const groupMemberPackage = await createMemberPackage(token, {
      member_id: memberId,
      package_id: groupPackage.id,
      remaining_group_session: TEST_CONFIG.groupSessions,
      remaining_private_session: 0,
      remaining_semi_private_session: 0
    });
    console.log(`✅ Created member package: ${groupPackage.name} with ${TEST_CONFIG.groupSessions} group sessions`);
    
    // 2. Member Package Semi-Private
    const semiPrivateMemberPackage = await createMemberPackage(token, {
      member_id: memberId,
      package_id: semiPrivatePackage.id,
      remaining_group_session: 0,
      remaining_private_session: 0,
      remaining_semi_private_session: TEST_CONFIG.semiPrivateSessions
    });
    console.log(`✅ Created member package: ${semiPrivatePackage.name} with ${TEST_CONFIG.semiPrivateSessions} semi-private sessions`);
    
    // 3. Member Package Private
    const privateMemberPackage = await createMemberPackage(token, {
      member_id: memberId,
      package_id: privatePackage.id,
      remaining_group_session: 0,
      remaining_private_session: TEST_CONFIG.privateSessions,
      remaining_semi_private_session: 0
    });
    console.log(`✅ Created member package: ${privatePackage.name} with ${TEST_CONFIG.privateSessions} private sessions`);
    
    console.log('\n🎉 Session injection completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   Member: ${TEST_CONFIG.memberEmail}`);
    console.log(`   Group sessions: ${TEST_CONFIG.groupSessions}`);
    console.log(`   Semi-private sessions: ${TEST_CONFIG.semiPrivateSessions}`);
    console.log(`   Private sessions: ${TEST_CONFIG.privateSessions}`);
    console.log(`   Total packages created: 3`);
    console.log(`   Total member packages created: 3`);
    
  } catch (error) {
    console.error('\n❌ Error during session injection:', error.message);
  }
};

// Run the script
injectSessionsSimple(); 