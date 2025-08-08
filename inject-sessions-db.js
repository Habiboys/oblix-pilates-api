// inject-sessions-db.js
// Script untuk inject sesi langsung ke database tanpa validasi API

const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const fs = require('fs');

// Load .env file from root directory
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  console.log('✅ .env file loaded successfully');
} else {
  console.log('⚠️  .env file not found at root directory, using system environment variables');
}

// Debug: Print key environment variables
console.log('🔧 Environment Variables:');
console.log(`   DB_HOST: ${process.env.DB_HOST || 'NOT SET'}`);
console.log(`   DB_NAME: ${process.env.DB_NAME || 'NOT SET'}`);
console.log(`   DB_USER: ${process.env.DB_USER || 'NOT SET'}`);
console.log(`   DB_PORT: ${process.env.DB_PORT || 'NOT SET'}`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log('');

// Database configuration - menggunakan config yang sama dengan aplikasi
const config = require('./src/config/config');
const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

// Debug: Print database configuration
console.log('🔧 Database Configuration:');
console.log(`   Environment: ${env}`);
console.log(`   Host: ${dbConfig.host}`);
console.log(`   Database: ${dbConfig.database}`);
console.log(`   Port: ${dbConfig.port}`);
console.log(`   Username: ${dbConfig.username}`);
console.log('');

// Perbaikan untuk server production - gunakan host yang benar
const dbHost = dbConfig.host === 'localhost' ? '127.0.0.1' : dbConfig.host;
console.log(`🔧 Using host: ${dbHost} (original: ${dbConfig.host})`);

const sequelize = new Sequelize({
  dialect: dbConfig.dialect,
  host: dbHost,
  username: dbConfig.username,
  password: dbConfig.password,
  port: dbConfig.port,
  database: dbConfig.database,
  timezone: dbConfig.timezone,
  logging: false
});

// Initialize models dengan sequelize instance yang sama
const { Package, PackageMembership, MemberPackage, Member, User } = require('./src/models');

// Override sequelize instance di models untuk menggunakan koneksi yang benar
const models = require('./src/models');
Object.keys(models).forEach(modelName => {
  if (models[modelName].sequelize) {
    models[modelName].sequelize = sequelize;
  }
});

// Helper function untuk menghitung end_date berdasarkan start_date dan durasi
const calculateEndDate = (startDate, durationValue, durationUnit) => {
  const start = new Date(startDate);
  let end = new Date(start);
  
  switch (durationUnit) {
    case 'day':
      end.setDate(end.getDate() + durationValue);
      break;
    case 'week':
      end.setDate(end.getDate() + (durationValue * 7));
      break;
    case 'month':
      end.setMonth(end.getMonth() + durationValue);
      break;
    case 'year':
      end.setFullYear(end.getFullYear() + durationValue);
      break;
    default:
      end.setDate(end.getDate() + (durationValue * 7)); // default to week
  }
  
  return end.toISOString().split('T')[0]; // Return YYYY-MM-DD format
};

// Daftar member dan sesi yang akan di-inject
const MEMBER_SESSIONS = [
  // {
  //   email: 'habiboyz18@gmail.com',
  //   startDate: '2025-08-15', // Format: YYYY-MM-DD
  //   groupSessions: 5,
  //   semiPrivateSessions: 3,
  //   privateSessions: 2,
  //   usedGroupSessions: 0,
  //   usedSemiPrivateSessions: 0,
  //   usedPrivateSessions: 0,
  //   validPeriod: 12 // 12 minggu
  // },
  {
    email: 'juliana627@yahooo.com',
    startDate: '2025-02-24', // Format: YYYY-MM-DD
    groupSessions: 0, // Ms Yunnie memiliki Group Class (0 sisa) + Private 1:1 (7 sisa), tapi Private dihitung terpisah
    semiPrivateSessions: 0,
    privateSessions: 5, // Private 1:1 20sesi, sisa 7
    usedGroupSessions: 10, // 20 sesi total - 7 sisa = 13 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 15, // 20 sesi total - 7 sisa = 13 used
    validPeriod: 12 // 12 minggu
  },
  {
    email: 'eviespp@gmail.com',
    startDate: '2024-07-11', // Format: YYYY-MM-DD
    groupSessions: 19, // Group Class, sisa 19 (Promo 20sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 1, // 20 sesi total - 19 sisa = 1 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 12 // 12 minggu
  },
  {
    email: 'nellyathien@gmail.com',
    startDate: '2025-06-14', 
    groupSessions: 26, // Group Class, sisa 11 (Renewal package 12 sessi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 6, // 12 sesi total - 11 sisa = 1 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 12
  },
  {
    email: 'alepang447@gmail.com',
    startDate: '2025-06-03', 
    groupSessions: 17, // Group Class, sisa 6 (Renewal package 12 sessi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 17, // 12 sesi total - 6 sisa = 6 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 12
  },
  {
    email: 'juliewid@yahoo.com',
    startDate: '2025-06-14', 
    groupSessions: 11, // Group Class, sisa 11 (Promo 20sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 1, // 20 sesi total - 11 sisa = 9 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 6
  },
  {
    email: 'cnc_sweet@yahoo.com',
    startDate: '2025-07-07', 
    groupSessions: 12, // Group Class, sisa 13 (Promo 10 + 2)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 8, // 12 sesi total - 13 sisa = 0 used (mungkin ada bonus)
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 12
  },
  {
    email: 'chellainte@yahoo.com',
    startDate: '2025-03-28', 
    groupSessions: 10, // Group Class, sisa 12 (Promo 10 + 2)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 2, // 12 sesi total - 12 sisa = 0 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod:6
  },
  {
    email: 'Ijuwita66@yahoo.com',
    startDate: '2025-07-03', 
    groupSessions: 4, // Group Class, sisa 5 (Promo Ramadhan 12sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 8, // 12 sesi total - 5 sisa = 7 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 6
  },
  {
    email: 'goh_weiching@yahoo.com',
    startDate: '2025-07-18', 
    groupSessions: 5, // Group Class, sisa 4 (Promo 10 + 2)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 7, // 12 sesi total - 4 sisa = 8 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 6
  },
  {
    email: 'federicofidelsalim2@gmail.com',
    startDate: '2025-07-31', 
    groupSessions: 7, // Group Class, sisa 12 (Promo 12sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 5, // 12 sesi total - 12 sisa = 0 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 6
  },
  {
    email: 'nzzzel@yahoo.com',
    startDate: '2025-07-16', 
    groupSessions: 10, // Group Class, sisa 10 (Promo 10 + 2)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 2, // 12 sesi total - 10 sisa = 2 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 6
  },
  {
    email: 'cvabigail@gmail.com',
    startDate: '2025-08-02', 
    groupSessions: 12, // Group Class, sisa 13 (Promo 10 + 2)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 0, // 12 sesi total - 13 sisa = 0 used (mungkin ada bonus)
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 6
  },
  {
    email: 'veniliong@gmail.com',
    startDate: '2025-07-19', 
    groupSessions: 6, // Group Class, sisa 8 (Promo 10 + 2)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 6, // 12 sesi total - 8 sisa = 4 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 6
  },
  {
    email: 'sumicst8@gmail.com',
    startDate: '2025-06-06', 
    groupSessions: 18, // Group Class, sisa 18 (Paket Promo 20sesi, sisa 6 + Renewal package 12 sessi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 8, // 32 sesi total - 18 sisa = 14 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 12
  },
  {
    email: 'edeline.rudy@gmail.com',
    startDate: '2025-06-24', 
    groupSessions: 4, // Group Class, sisa 4 (Promo 5 + 1)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 2, // 6 sesi total - 4 sisa = 2 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 6
  },
  {
    email: 'ching1905@yahoo.com.sg',
    startDate: '2025-06-03', 
    groupSessions: 40, // Ms Ching Ching memiliki Group Class (40 sisa) + Private 1:1 (18 sisa)
    semiPrivateSessions: 0,
    privateSessions: 17, // Private 1:1, sisa 18
    usedGroupSessions: 0, // 40 sesi total - 40 sisa = 0 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 3, // 20 sesi total - 18 sisa = 2 used
    validPeriod: 24
  },
  {
    email: 'yuri.lian@yahoo.com',
    startDate: '2025-05-30', 
    groupSessions: 13, // Group Class, sisa 14 (Promo 20sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 7, // 20 sesi total - 14 sisa = 6 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 12
  },
  {
    email: 'chingsiehsiu@gmail.com',
    startDate: '2025-07-06', 
    groupSessions: 20, // Group Class, sisa 8 (Renewal package 12 sessi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 12, // 12 sesi total - 8 sisa = 4 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 12
  },
  {
    email: 'cuanwie@gmail.com',
    startDate: '2025-07-04', 
    groupSessions: 7, // Group Class, sisa 8 (Promo 10 + 2)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 5, // 12 sesi total - 8 sisa = 4 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 6
  },
  {
    email: 'taniahagy@gmail.com',
    startDate: '2025-07-21', 
    groupSessions: 7, // Group Class, sisa 10 (Promo 10+2)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 5, // 12 sesi total - 10 sisa = 2 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 6
  },
  {
    email: 'jusitze83@gmail.com',
    startDate: '2025-03-25', 
    groupSessions: 55, // Group Class, sisa 25 (Promo unlimited 1 Tahun)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 0, // Unlimited, tidak ada used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 52 // 1 tahun untuk unlimited
  },
  {
    email: 'ch1nkch1nk789@gmail.com',
    startDate: '2025-07-17', 
    groupSessions: 8, // Group Class, sisa 9 (Promo 10+2)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 4, // 12 sesi total - 9 sisa = 3 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 6
  },
  {
    email: 'wcy1244167247@gmail.com',
    startDate: '2025-08-01', 
    groupSessions: 5, // Group Class, sisa 6 (Promo 5 + 1)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 1, // 6 sesi total - 6 sisa = 0 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 6
  },
  {
    email: 'monicabenedick2@gmail.com',
    startDate: '2025-06-08', 
    groupSessions: 1, // Group Class, sisa 3 (Promo 6 + 6)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 11, // 12 sesi total - 3 sisa = 9 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 6
  },
  {
    email: 'hannytaufik@gmail.com',
    startDate: '2025-07-19', 
    groupSessions: 32, // Group Class, sisa 38 (Promo 40sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 8, // 40 sesi total - 38 sisa = 2 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 24
  },
  {
    email: 'clarestasia@gmail.com',
    startDate: '', 
    groupSessions: 99, // Unlimited 3 bulan (menggunakan -1 untuk unlimited)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 0, // Unlimited, tidak ada used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 12
  },
  {
    email: 'halimahamin62@gmail.com',
    startDate: '2025-07-21', 
    groupSessions: 6, // Group Class, sisa 8 (Promo 10 + 2)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 6, // 12 sesi total - 8 sisa = 4 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 6
  },
  {
    email: 'lynakez79@gmail.com',
    startDate: '2025-07-04', 
    groupSessions: 7, // Group Class, sisa 8 (Promo 20sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 13, // 20 sesi total - 8 sisa = 12 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 12
  },
  {
    email: 'meilanytan10@gmail.com',
    startDate: '2025-07-16', 
    groupSessions: 10, // Group Class, sisa 13 (Promo 20sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 10, // 20 sesi total - 13 sisa = 7 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 12
  },
  {
    email: 'csoegandha@yahoo.com',
    startDate: '2025-04-08', 
    groupSessions: 16, // Package kosong, sisa 18 (Masih ada sisa 4 sesi paket promo 12sesi, Renewal promo 6 + 6)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 8, // 24 sesi total - 18 sisa = 6 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 12
  },
  {
    email: 'mond81700@gmail.com',
    startDate: '2025-03-17', 
    groupSessions: 6, // Group Class, sisa 12 (Promo 20sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 14, // 20 sesi total - 12 sisa = 8 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 12
  },
  {
    email: 'henny.mul@gmail.com',
    startDate: '', 
    groupSessions: 99, // Unlimited 3 Bulan (menggunakan -1 untuk unlimited)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 0, // Unlimited, tidak ada used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 12
  },
  {
    email: 'laksmi_anna@hotmail.com',
    startDate: '2025-08-03', 
    groupSessions: 11, // Group Class, sisa 12 (Promo 10 + 2)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 1, // 12 sesi total - 12 sisa = 0 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 6
  },
  {
    email: 'bennydwipurwanta@gmail.com',
    startDate: '2025-06-03', 
    groupSessions: 0,
    semiPrivateSessions: 0,
    privateSessions: 1, // Private 1:1, sisa 2 (Private 5 sesi)
    usedGroupSessions: 0,
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 4, // 5 sesi total - 2 sisa = 3 used
    validPeriod: 5
  },
  {
    email: 'sisca.afung@gmail.com',
    startDate: '2025-05-04', 
    groupSessions: 10, // Group Class, sisa 10 (Promo 20sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 10, // 20 sesi total - 10 sisa = 10 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 12
  },
  {
    email: 'sharines89@gmail.com',
    startDate: '2025-04-30', 
    groupSessions: 0,
    semiPrivateSessions: 0,
    privateSessions: 4, // Private 1:1, sisa 4 (Private 1:1 10sesi)
    usedGroupSessions: 0,
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 6, // 10 sesi total - 4 sisa = 6 used
    validPeriod: 10
  },
  {
    email: 'Vivianncen@gmail.com',
    startDate: '2025-05-28', 
    groupSessions: 5, // Group Class, sisa 5 (Promo 10 + 4)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 9, // 14 sesi total - 5 sisa = 9 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 8
  },
  {
    email: 'Natasyaaaa19@gmail.com',
    startDate: '2025-05-28', 
    groupSessions: 5, // Group Class, sisa 5 (Promo 10 + 4)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 9, // 14 sesi total - 5 sisa = 9 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 8
  },
  {
    email: 'henny3672@gmail.com',
    startDate: '', 
    groupSessions: 55, // Group Class + Semi Private 22sesi, sisa 22
    semiPrivateSessions: 30, // Semi Private sessions
    privateSessions: 0,
    usedGroupSessions: 3, // 22 sesi total - 22 sisa = 0 used
    usedSemiPrivateSessions: 0, // 22 sesi total - 22 sisa = 0 used
    usedPrivateSessions: 0,
    validPeriod: 12

  },
  {
    email: 'adriel.lusia@gmail.com',
    startDate: '2025-07-05', 
    groupSessions: 17, // Group Class, sisa 17 (Promo 20sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 3, // 20 sesi total - 17 sisa = 3 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 12
  },
  {
    email: 'veraapandi@gmail.com',
    startDate: '2025-07-07', 
    groupSessions: 17, // Group Class, sisa 17 (Promo 20sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 3, // 20 sesi total - 17 sisa = 3 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 12
  },
  {
    email: 'lee_potter178@yahoo.com',
    startDate: '2025-07-05', 
    groupSessions: 5, // Ms Lily H memiliki Group Class (6 sisa) + Private 1:1 (5 sisa)
    semiPrivateSessions: 0,
    privateSessions: 4, // Private 1:1, sisa 5 (Private 5sesi)
    usedGroupSessions: 1, // 6 sesi total - 6 sisa = 0 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 1, // 5 sesi total - 5 sisa = 0 used
    validPeriod: 5
  },
  {
    email: 'cynthiaprayitno@icloud.com',
    startDate: '2025-06-02', 
    groupSessions: 0,
    semiPrivateSessions: 0,
    privateSessions: 3, // Private 1:1, sisa 4 (Promo Private 10sesi)
    usedGroupSessions: 0,
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 7, // 10 sesi total - 4 sisa = 6 used
    validPeriod: 10
  },
  {
    email: 'qtin9999@gmail.com',
    startDate: '2025-07-22', 
    groupSessions: 33, // Group Class, sisa 33 (Promo unlimited 3 bulan)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 5, // Unlimited, tidak ada used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 12
  },
  {
    email: 'yuli_porianto@yahoo.com',
    startDate: '', 
    groupSessions: 20, // Ms Yulianti ada 2 entry: sisa 1 + sisa 20 = 21 total
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 0, // 21 sesi total - 21 sisa = 0 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 12
  },
  {
    email: 'rizkipurnadi@gmail.com',
    startDate: '2025-06-06', 
    groupSessions: 24, // Group Class, sisa 26 (Promo 40sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 16, // 40 sesi total - 26 sisa = 14 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 24
  },
  {
    email: 'jazzonovas@gmail.com',
    startDate: '2025-06-06', 
    groupSessions: 30, // Group Class, sisa 32 (Promo 40sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 10, // 40 sesi total - 32 sisa = 8 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 24
  },
  {
    email: 'steffirahardjo17@gmail.com',
    startDate: '2025-06-06', 
    groupSessions: 34, // Group Class, sisa 34 (Promo 40sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 6, // 40 sesi total - 34 sisa = 6 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 24
  },
  {
    email: 'h_jachja@hotmail.com',
    startDate: '2025-06-10', 
    groupSessions: 0,
    semiPrivateSessions: 0,
    privateSessions: 11, // Private 1:1, sisa 7 (Private 10 + 2)
    usedGroupSessions: 0,
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 9, // 12 sesi total - 7 sisa = 5 used
    validPeriod: 12
  },
  {
    email: 'lindakris931966@gmail.com',
    startDate: '2025-05-07', 
    groupSessions: 11, // Group Class, sisa 11 (Promo 20sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 9, // 20 sesi total - 11 sisa = 9 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 12
  },
  {
    email: 'connyandriani@gmail.com',
    startDate: '2025-07-21', 
    groupSessions: 10, // Group Class, sisa 10 (Promo 10 + 2)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 2, // 12 sesi total - 10 sisa = 2 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 6
  },
  {
    email: 'jennismemories@gmail.com',
    startDate: '', 
    groupSessions: 1, // Group Class, sisa 4 (Promo 20sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 19, // 20 sesi total - 4 sisa = 16 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 12
  },
  {
    email: 'jennkezia@gmail.com',
    startDate: '', 
    groupSessions: 1, // Group Class, sisa 3 (Promo 20sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 19, // 20 sesi total - 3 sisa = 17 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 12
  },
  {
    email: 'roslinamgm@yahoo.com',
    startDate: '', 
    groupSessions: 40, // Group Class, sisa 40 (Promo 40sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 0, // 40 sesi total - 40 sisa = 0 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 24
  },
  {
    email: 'diana@rst-indonesia.com',
    startDate: '', 
    groupSessions: 12, // Group Class, sisa 12 (Promo Ramadhan 12sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 0, // 12 sesi total - 12 sisa = 0 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 12
  }
  // Tambahkan member lain di sini sesuai kebutuhan
];

// Helper function untuk mendapatkan member ID
const getMemberId = async (email) => {
  try {
    const user = await User.findOne({
      where: { email: email },
      include: [{
        model: Member,
        required: true
      }]
    });
    
    if (user && user.Member) {
      return user.Member.id;
    } else {
      throw new Error(`Member with email ${email} not found`);
    }
  } catch (error) {
    console.error('❌ Get member error:', error.message);
    throw error;
  }
};

// Helper function untuk membuat package
const createPackage = async (packageData) => {
  try {
    const package = await Package.create(packageData);
    return package;
  } catch (error) {
    console.error('❌ Create package error:', error.message);
    throw error;
  }
};

// Helper function untuk membuat package membership
const createPackageMembership = async (packageMembershipData) => {
  try {
    const packageMembership = await PackageMembership.create(packageMembershipData);
    return packageMembership;
  } catch (error) {
    console.error('❌ Create package membership error:', error.message);
    throw error;
  }
};

// Helper function untuk membuat member package
const createMemberPackage = async (memberPackageData) => {
  try {
    const memberPackage = await MemberPackage.create(memberPackageData);
    return memberPackage;
  } catch (error) {
    console.error('❌ Create member package error:', error.message);
    throw error;
  }
};

// Helper function untuk mengecek apakah paket memiliki sesi
const hasSessions = (remainingSessions, usedSessions) => {
  return (remainingSessions > 0 || usedSessions > 0);
};

// Main function
const injectSessionsDB = async () => {
  try {
    console.log('🚀 Starting database session injection script...\n');
    console.log(`📋 Total members to process: ${MEMBER_SESSIONS.length}\n`);
    
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection successful\n');
    
    // Create 3 start packages (hanya sekali)
    console.log('📦 Creating start packages...');
    
    // Category IDs berdasarkan data yang diberikan
    const GROUP_CATEGORY_ID = '550e8400-e29b-41d4-a716-446655440001'; // Group Class
    const SEMI_PRIVATE_CATEGORY_ID = '550e8400-e29b-41d4-a716-446655440002'; // Semi-Private Class
    const PRIVATE_CATEGORY_ID = '6ce66b01-712e-4211-b385-cf2256ef9bd5'; // Private Class
    
    // 1. Start Package Group
    const groupPackage = await createPackage({
      name: 'Start Package Group',
      price: 0,
      duration_value: 1,
      duration_unit: 'month',
      reminder_day: 7,
      reminder_session: 2,
      type: 'membership',
      is_deleted: false
    });
    console.log(`✅ Created: ${groupPackage.name} (ID: ${groupPackage.id})`);
    
    // Create package membership untuk Group
    await createPackageMembership({
      package_id: groupPackage.id,
      session: 0, // Session 0 karena kita inject langsung ke member package
      category_id: GROUP_CATEGORY_ID
    });
    console.log(`   📋 Created package membership for Group Class`);
    
    // 2. Start Package Semi-Private
    const semiPrivatePackage = await createPackage({
      name: 'Start Package Semi-Private',
      price: 0,
      duration_value: 1,
      duration_unit: 'month',
      reminder_day: 7,
      reminder_session: 2,
      type: 'membership',
      is_deleted: false
    });
    console.log(`✅ Created: ${semiPrivatePackage.name} (ID: ${semiPrivatePackage.id})`);
    
    // Create package membership untuk Semi-Private
    await createPackageMembership({
      package_id: semiPrivatePackage.id,
      session: 0, // Session 0 karena kita inject langsung ke member package
      category_id: SEMI_PRIVATE_CATEGORY_ID
    });
    console.log(`   📋 Created package membership for Semi-Private Class`);
    
    // 3. Start Package Private
    const privatePackage = await createPackage({
      name: 'Start Package Private',
      price: 0,
      duration_value: 1,
      duration_unit: 'month',
      reminder_day: 7,
      reminder_session: 2,
      type: 'membership',
      is_deleted: false
    });
    console.log(`✅ Created: ${privatePackage.name} (ID: ${privatePackage.id})`);
    
    // Create package membership untuk Private
    await createPackageMembership({
      package_id: privatePackage.id,
      session: 0, // Session 0 karena kita inject langsung ke member package
      category_id: PRIVATE_CATEGORY_ID
    });
    console.log(`   📋 Created package membership for Private Class`);
    console.log('');
    
    // Process each member
    console.log('👤 Processing members...\n');
    
    let successCount = 0;
    let errorCount = 0;
    let totalPackagesCreated = 0;
    
    for (let i = 0; i < MEMBER_SESSIONS.length; i++) {
      const member = MEMBER_SESSIONS[i];
      console.log(`📧 Processing member ${i + 1}/${MEMBER_SESSIONS.length}: ${member.email}`);
      
      try {
        // Get member ID
        const memberId = await getMemberId(member.email);
        console.log(`   ✅ Found member ID: ${memberId}`);
        
        // Use start date from member data - jika kosong, biarkan null
        const startDate = member.startDate || null; // Tidak set default jika kosong
        const endDate = startDate ? calculateEndDate(startDate, member.validPeriod, 'week') : null;
        
        console.log(`   📅 Period: ${startDate || 'Not set'} to ${endDate || 'Not set'} (${member.validPeriod} weeks)`);
        console.log(`   📊 Sessions: Group=${member.groupSessions} (used: ${member.usedGroupSessions}), Semi-Private=${member.semiPrivateSessions} (used: ${member.usedSemiPrivateSessions}), Private=${member.privateSessions} (used: ${member.usedPrivateSessions})`);
        
        let packagesCreated = 0;
        
        // 1. Member Package Group - hanya jika ada sesi
        if (hasSessions(member.groupSessions, member.usedGroupSessions)) {
          await createMemberPackage({
            member_id: memberId,
            package_id: groupPackage.id,
            start_date: startDate,
            end_date: endDate,
            used_group_session: member.usedGroupSessions,
            used_private_session: 0,
            used_semi_private_session: 0,
            remaining_group_session: member.groupSessions,
            remaining_private_session: 0,
            remaining_semi_private_session: 0,
            active_period: member.validPeriod, // Set active_period dari validPeriod
            is_active: true
          });
          console.log(`   ✅ Created group package with ${member.groupSessions} sessions (used: ${member.usedGroupSessions})`);
          packagesCreated++;
        } else {
          console.log(`   ⏭️  Skipped group package (no sessions)`);
        }
        
        // 2. Member Package Semi-Private - hanya jika ada sesi
        if (hasSessions(member.semiPrivateSessions, member.usedSemiPrivateSessions)) {
          await createMemberPackage({
            member_id: memberId,
            package_id: semiPrivatePackage.id,
            start_date: startDate,
            end_date: endDate,
            used_group_session: 0,
            used_private_session: 0,
            used_semi_private_session: member.usedSemiPrivateSessions,
            remaining_group_session: 0,
            remaining_private_session: 0,
            remaining_semi_private_session: member.semiPrivateSessions,
            active_period: member.validPeriod, // Set active_period dari validPeriod
            is_active: true
          });
          console.log(`   ✅ Created semi-private package with ${member.semiPrivateSessions} sessions (used: ${member.usedSemiPrivateSessions})`);
          packagesCreated++;
        } else {
          console.log(`   ⏭️  Skipped semi-private package (no sessions)`);
        }
        
        // 3. Member Package Private - hanya jika ada sesi
        if (hasSessions(member.privateSessions, member.usedPrivateSessions)) {
          await createMemberPackage({
            member_id: memberId,
            package_id: privatePackage.id,
            start_date: startDate,
            end_date: endDate,
            used_group_session: 0,
            used_private_session: member.usedPrivateSessions,
            used_semi_private_session: 0,
            remaining_group_session: 0,
            remaining_private_session: member.privateSessions,
            remaining_semi_private_session: 0,
            active_period: member.validPeriod, // Set active_period dari validPeriod
            is_active: true
          });
          console.log(`   ✅ Created private package with ${member.privateSessions} sessions (used: ${member.usedPrivateSessions})`);
          packagesCreated++;
        } else {
          console.log(`   ⏭️  Skipped private package (no sessions)`);
        }
        
        successCount++;
        totalPackagesCreated += packagesCreated;
        console.log(`   🎉 Member ${member.email} completed successfully! (${packagesCreated} packages created)\n`);
        
      } catch (error) {
        errorCount++;
        console.log(`   ❌ Error processing ${member.email}: ${error.message}\n`);
      }
    }
    
    console.log('🎉 Database session injection completed!');
    console.log('\n📋 Summary:');
    console.log(`   Total members: ${MEMBER_SESSIONS.length}`);
    console.log(`   Success: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Base packages created: 3 (shared by all members)`);
    console.log(`   Package memberships created: 3 (one for each package type)`);
    console.log(`   Member packages created: ${totalPackagesCreated} (only for members with sessions)`);
    console.log(`   Active period: Set from validPeriod field (in weeks)`);
    console.log(`   Start date: Individual per member (from startDate field, null if empty)`);
    console.log(`   End date: Calculated when start_date is set (start_date + active_period weeks)`);
    console.log(`   Used sessions: Set according to member data`);
    console.log(`   Empty packages: Skipped (no remaining or used sessions)`);
    console.log(`   Package membership sessions: Set to 0 (sessions injected directly to member packages)`);
    
  } catch (error) {
    console.error('\n❌ Error during database session injection:', error.message);
  } finally {
    await sequelize.close();
  }
};

// Run the script
injectSessionsDB(); 