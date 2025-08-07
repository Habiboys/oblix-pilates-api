278// inject-sessions.js
// Script untuk inject sesi dengan membuat 3 paket start dan member package yang bisa dikustomisasi

const axios = require('axios');
const readline = require('readline');

// Configuration
const BASE_URL = 'http://localhost:3000/api';
const ADMIN_EMAIL = 'admin@oblix.com';
const ADMIN_PASSWORD = 'admin123';

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function untuk input
const askQuestion = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
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
const injectSessions = async () => {
  try {
    console.log('🚀 Starting session injection script...\n');
    
    // Login admin
    const token = await loginAdmin();
    console.log('✅ Admin login successful\n');
    
    // Input member email
    const memberEmail = await askQuestion('📧 Enter member email: ');
    console.log('');
    
    // Get member ID
    const memberId = await getMemberId(token, memberEmail);
    console.log(`✅ Found member: ${memberEmail} (ID: ${memberId})\n`);
    
    // Input session counts
    console.log('📊 Enter session counts for each package:');
    const groupSessions = parseInt(await askQuestion('   Group sessions: '));
    const semiPrivateSessions = parseInt(await askQuestion('   Semi-private sessions: '));
    const privateSessions = parseInt(await askQuestion('   Private sessions: '));
    console.log('');
    
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
      remaining_group_session: groupSessions,
      remaining_private_session: 0,
      remaining_semi_private_session: 0
    });
    console.log(`✅ Created member package: ${groupPackage.name} with ${groupSessions} group sessions`);
    
    // 2. Member Package Semi-Private
    const semiPrivateMemberPackage = await createMemberPackage(token, {
      member_id: memberId,
      package_id: semiPrivatePackage.id,
      remaining_group_session: 0,
      remaining_private_session: 0,
      remaining_semi_private_session: semiPrivateSessions
    });
    console.log(`✅ Created member package: ${semiPrivatePackage.name} with ${semiPrivateSessions} semi-private sessions`);
    
    // 3. Member Package Private
    const privateMemberPackage = await createMemberPackage(token, {
      member_id: memberId,
      package_id: privatePackage.id,
      remaining_group_session: 0,
      remaining_private_session: privateSessions,
      remaining_semi_private_session: 0
    });
    console.log(`✅ Created member package: ${privatePackage.name} with ${privateSessions} private sessions`);
    
    console.log('\n🎉 Session injection completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   Member: ${memberEmail}`);
    console.log(`   Group sessions: ${groupSessions}`);
    console.log(`   Semi-private sessions: ${semiPrivateSessions}`);
    console.log(`   Private sessions: ${privateSessions}`);
    console.log(`   Total packages created: 3`);
    console.log(`   Total member packages created: 3`);
    
  } catch (error) {
    console.error('\n❌ Error during session injection:', error.message);
  } finally {
    rl.close();
  }
};

// Run the script
injectSessions();