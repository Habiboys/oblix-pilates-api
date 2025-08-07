// inject-sessions-bulk.js
// Script untuk inject sesi dengan daftar member yang sudah ditulis di dalam file

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000/api';
const ADMIN_EMAIL = 'admin@oblix.com';
const ADMIN_PASSWORD = 'admin123';

// Daftar member dan sesi yang akan di-inject
const MEMBER_SESSIONS = [
  {
    email: 'habiboyz18@gmail.com',
    groupSessions: 5,
    semiPrivateSessions: 3,
    privateSessions: 2
  },
  
  // Tambahkan member lain di sini sesuai kebutuhan
];

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

// Helper function untuk membuat membership package
const createMembershipPackage = async (token, packageData) => {
  try {
    const response = await axios.post(`${BASE_URL}/membership-package`, packageData, {
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
    console.error('❌ Create membership package error:', error.response?.data?.message || error.message);
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
const injectSessionsBulk = async () => {
  try {
    console.log('🚀 Starting bulk session injection script...\n');
    console.log(`📋 Total members to process: ${MEMBER_SESSIONS.length}\n`);
    
    // Login admin
    const token = await loginAdmin();
    console.log('✅ Admin login successful\n');
    
    // Create 3 start packages (hanya sekali)
    console.log('📦 Creating start packages...');
    
    // 1. Start Package Group
    const groupPackage = await createMembershipPackage(token, {
      name: 'Start Package Group',
      price: 1,
      duration_value: 1,
      duration_unit: 'month',
      reminder_day: 7,
      reminder_session: 2,
      group_session: 0,
      private_session: 0
    });
    console.log(`✅ Created: ${groupPackage.name} (ID: ${groupPackage.id})`);
    
    // 2. Start Package Semi-Private
    const semiPrivatePackage = await createMembershipPackage(token, {
      name: 'Start Package Semi-Private',
      price: 1,
      duration_value: 1,
      duration_unit: 'month',
      reminder_day: 7,
      reminder_session: 2,
      group_session: 0,
      private_session: 0
    });
    console.log(`✅ Created: ${semiPrivatePackage.name} (ID: ${semiPrivatePackage.id})`);
    
    // 3. Start Package Private
    const privatePackage = await createMembershipPackage(token, {
      name: 'Start Package Private',
      price: 1,
      duration_value: 1,
      duration_unit: 'month',
      reminder_day: 7,
      reminder_session: 2,
      group_session: 0,
      private_session: 0
    });
    console.log(`✅ Created: ${privatePackage.name} (ID: ${privatePackage.id})`);
    console.log('');
    
    // Process each member
    console.log('👤 Processing members...\n');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < MEMBER_SESSIONS.length; i++) {
      const member = MEMBER_SESSIONS[i];
      console.log(`📧 Processing member ${i + 1}/${MEMBER_SESSIONS.length}: ${member.email}`);
      
      try {
        // Get member ID
        const memberId = await getMemberId(token, member.email);
        console.log(`   ✅ Found member ID: ${memberId}`);
        
        // Create member packages with custom session counts
        console.log(`   📊 Sessions: Group=${member.groupSessions}, Semi-Private=${member.semiPrivateSessions}, Private=${member.privateSessions}`);
        
        // 1. Member Package Group
        await createMemberPackage(token, {
          member_id: memberId,
          package_id: groupPackage.id,
          remaining_group_session: member.groupSessions,
          remaining_private_session: 0,
          remaining_semi_private_session: 0
        });
        console.log(`   ✅ Created group package with ${member.groupSessions} sessions`);
        
        // 2. Member Package Semi-Private
        await createMemberPackage(token, {
          member_id: memberId,
          package_id: semiPrivatePackage.id,
          remaining_group_session: 0,
          remaining_private_session: 0,
          remaining_semi_private_session: member.semiPrivateSessions
        });
        console.log(`   ✅ Created semi-private package with ${member.semiPrivateSessions} sessions`);
        
        // 3. Member Package Private
        await createMemberPackage(token, {
          member_id: memberId,
          package_id: privatePackage.id,
          remaining_group_session: 0,
          remaining_private_session: member.privateSessions,
          remaining_semi_private_session: 0
        });
        console.log(`   ✅ Created private package with ${member.privateSessions} sessions`);
        
        successCount++;
        console.log(`   🎉 Member ${member.email} completed successfully!\n`);
        
      } catch (error) {
        errorCount++;
        console.log(`   ❌ Error processing ${member.email}: ${error.message}\n`);
      }
    }
    
    console.log('🎉 Bulk session injection completed!');
    console.log('\n📋 Summary:');
    console.log(`   Total members: ${MEMBER_SESSIONS.length}`);
    console.log(`   Success: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Packages created: 3 (shared by all members)`);
    console.log(`   Member packages created: ${successCount * 3}`);
    
  } catch (error) {
    console.error('\n❌ Error during bulk session injection:', error.message);
  }
};

// Run the script
injectSessionsBulk(); 