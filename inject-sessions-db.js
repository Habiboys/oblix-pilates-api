// inject-sessions-db.js
// Script untuk inject sesi langsung ke database tanpa validasi API

const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Database configuration
const sequelize = new Sequelize({
  dialect: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  port: process.env.DB_PORT || 8889,
  database: process.env.DB_NAME || 'oblix',
  logging: false
});

// Initialize models
const { Package, MemberPackage, Member, User } = require('./src/models');

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
      end.setMonth(end.getMonth() + durationValue); // default to month
  }
  
  return end.toISOString().split('T')[0]; // Return YYYY-MM-DD format
};

// Daftar member dan sesi yang akan di-inject
const MEMBER_SESSIONS = [
  {
    email: 'habiboyz18@gmail.com',
    groupSessions: 5,
    semiPrivateSessions: 3,
    privateSessions: 2,
    usedGroupSessions: 0,
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3 // 3 bulan
  },
  {
    email: 'juliana627@yahooo.com',
    groupSessions: 7, // Ms Yunnie memiliki Group Class (0 sisa) + Private 1:1 (7 sisa), tapi Private dihitung terpisah
    semiPrivateSessions: 0,
    privateSessions: 7, // Private 1:1 20sesi, sisa 7
    usedGroupSessions: 13, // 20 sesi total - 7 sisa = 13 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 13, // 20 sesi total - 7 sisa = 13 used
    validPeriod: 3
  },
  {
    email: 'eviespp@gmail.com',
    groupSessions: 19, // Group Class, sisa 19 (Promo 20sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 1, // 20 sesi total - 19 sisa = 1 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'nellyathien@gmail.com',
    groupSessions: 11, // Group Class, sisa 11 (Renewal package 12 sessi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 1, // 12 sesi total - 11 sisa = 1 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'alepang447@gmail.com',
    groupSessions: 6, // Group Class, sisa 6 (Renewal package 12 sessi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 6, // 12 sesi total - 6 sisa = 6 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'juliewid@yahoo.com',
    groupSessions: 11, // Group Class, sisa 11 (Promo 20sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 9, // 20 sesi total - 11 sisa = 9 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'cnc_sweet@yahoo.com',
    groupSessions: 13, // Group Class, sisa 13 (Promo 10 + 2)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 0, // 12 sesi total - 13 sisa = 0 used (mungkin ada bonus)
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'chellainte@yahoo.com',
    groupSessions: 12, // Group Class, sisa 12 (Promo 10 + 2)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 0, // 12 sesi total - 12 sisa = 0 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'Ijuwita66@yahoo.com',
    groupSessions: 5, // Group Class, sisa 5 (Promo Ramadhan 12sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 7, // 12 sesi total - 5 sisa = 7 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'goh_weiching@yahoo.com',
    groupSessions: 4, // Group Class, sisa 4 (Promo 10 + 2)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 8, // 12 sesi total - 4 sisa = 8 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'federicofidelsalim2@gmail.com',
    groupSessions: 12, // Group Class, sisa 12 (Promo 12sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 0, // 12 sesi total - 12 sisa = 0 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'nzzzel@yahoo.com',
    groupSessions: 10, // Group Class, sisa 10 (Promo 10 + 2)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 2, // 12 sesi total - 10 sisa = 2 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'cvabigail@gmail.com',
    groupSessions: 13, // Group Class, sisa 13 (Promo 10 + 2)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 0, // 12 sesi total - 13 sisa = 0 used (mungkin ada bonus)
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'veniliong@gmail.com',
    groupSessions: 8, // Group Class, sisa 8 (Promo 10 + 2)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 4, // 12 sesi total - 8 sisa = 4 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'sumicst8@gmail.com',
    groupSessions: 18, // Group Class, sisa 18 (Paket Promo 20sesi, sisa 6 + Renewal package 12 sessi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 14, // 32 sesi total - 18 sisa = 14 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'edeline.rudy@gmail.com',
    groupSessions: 4, // Group Class, sisa 4 (Promo 5 + 1)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 2, // 6 sesi total - 4 sisa = 2 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'ching1905@yahoo.com.sg',
    groupSessions: 40, // Ms Ching Ching memiliki Group Class (40 sisa) + Private 1:1 (18 sisa)
    semiPrivateSessions: 0,
    privateSessions: 18, // Private 1:1, sisa 18
    usedGroupSessions: 0, // 40 sesi total - 40 sisa = 0 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 2, // 20 sesi total - 18 sisa = 2 used
    validPeriod: 3
  },
  {
    email: 'yuri.lian@yahoo.com',
    groupSessions: 14, // Group Class, sisa 14 (Promo 20sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 6, // 20 sesi total - 14 sisa = 6 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'chingsiehsiu@gmail.com',
    groupSessions: 8, // Group Class, sisa 8 (Renewal package 12 sessi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 4, // 12 sesi total - 8 sisa = 4 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'cuanwie@gmail.com',
    groupSessions: 8, // Group Class, sisa 8 (Promo 10 + 2)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 4, // 12 sesi total - 8 sisa = 4 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'taniahagy@gmail.com',
    groupSessions: 10, // Group Class, sisa 10 (Promo 10+2)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 2, // 12 sesi total - 10 sisa = 2 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'jusitze83@gmail.com',
    groupSessions: 25, // Group Class, sisa 25 (Promo unlimited 1 Tahun)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 0, // Unlimited, tidak ada used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 12 // 1 tahun untuk unlimited
  },
  {
    email: 'ch1nkch1nk789@gmail.com',
    groupSessions: 9, // Group Class, sisa 9 (Promo 10+2)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 3, // 12 sesi total - 9 sisa = 3 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'wcy1244167247@gmail.com',
    groupSessions: 6, // Group Class, sisa 6 (Promo 5 + 1)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 0, // 6 sesi total - 6 sisa = 0 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'monicabenedick2@gmail.com',
    groupSessions: 3, // Group Class, sisa 3 (Promo 6 + 6)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 9, // 12 sesi total - 3 sisa = 9 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'hannytaufik@gmail.com',
    groupSessions: 38, // Group Class, sisa 38 (Promo 40sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 2, // 40 sesi total - 38 sisa = 2 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'clarestasia@gmail.com',
    groupSessions: -1, // Unlimited 3 bulan (menggunakan -1 untuk unlimited)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 0, // Unlimited, tidak ada used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'halimahamin62@gmail.com',
    groupSessions: 8, // Group Class, sisa 8 (Promo 10 + 2)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 4, // 12 sesi total - 8 sisa = 4 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'lynakez79@gmail.com',
    groupSessions: 8, // Group Class, sisa 8 (Promo 20sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 12, // 20 sesi total - 8 sisa = 12 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'meilanytan10@gmail.com',
    groupSessions: 13, // Group Class, sisa 13 (Promo 20sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 7, // 20 sesi total - 13 sisa = 7 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'csoegandha@yahoo.com',
    groupSessions: 18, // Package kosong, sisa 18 (Masih ada sisa 4 sesi paket promo 12sesi, Renewal promo 6 + 6)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 6, // 24 sesi total - 18 sisa = 6 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'mond81700@gmail.com',
    groupSessions: 12, // Group Class, sisa 12 (Promo 20sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 8, // 20 sesi total - 12 sisa = 8 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'henny.mul@gmail.com',
    groupSessions: -1, // Unlimited 3 Bulan (menggunakan -1 untuk unlimited)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 0, // Unlimited, tidak ada used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'laksmi_anna@hotmail.com',
    groupSessions: 12, // Group Class, sisa 12 (Promo 10 + 2)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 0, // 12 sesi total - 12 sisa = 0 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'bennydwipurwanta@gmail.com',
    groupSessions: 0,
    semiPrivateSessions: 0,
    privateSessions: 2, // Private 1:1, sisa 2 (Private 5 sesi)
    usedGroupSessions: 0,
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 3, // 5 sesi total - 2 sisa = 3 used
    validPeriod: 3
  },
  {
    email: 'sisca.afung@gmail.com',
    groupSessions: 10, // Group Class, sisa 10 (Promo 20sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 10, // 20 sesi total - 10 sisa = 10 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'sharines89@gmail.com',
    groupSessions: 0,
    semiPrivateSessions: 0,
    privateSessions: 4, // Private 1:1, sisa 4 (Private 1:1 10sesi)
    usedGroupSessions: 0,
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 6, // 10 sesi total - 4 sisa = 6 used
    validPeriod: 3
  },
  {
    email: 'Vivianncen@gmail.com',
    groupSessions: 5, // Group Class, sisa 5 (Promo 10 + 4)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 9, // 14 sesi total - 5 sisa = 9 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'Natasyaaaa19@gmail.com',
    groupSessions: 5, // Group Class, sisa 5 (Promo 10 + 4)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 9, // 14 sesi total - 5 sisa = 9 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'henny3672@gmail.com',
    groupSessions: 22, // Group Class + Semi Private 22sesi, sisa 22
    semiPrivateSessions: 22, // Semi Private sessions
    privateSessions: 0,
    usedGroupSessions: 0, // 22 sesi total - 22 sisa = 0 used
    usedSemiPrivateSessions: 0, // 22 sesi total - 22 sisa = 0 used
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'adriel.lusia@gmail.com',
    groupSessions: 17, // Group Class, sisa 17 (Promo 20sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 3, // 20 sesi total - 17 sisa = 3 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'veraapandi@gmail.com',
    groupSessions: 17, // Group Class, sisa 17 (Promo 20sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 3, // 20 sesi total - 17 sisa = 3 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'lee_potter178@yahoo.com',
    groupSessions: 6, // Ms Lily H memiliki Group Class (6 sisa) + Private 1:1 (5 sisa)
    semiPrivateSessions: 0,
    privateSessions: 5, // Private 1:1, sisa 5 (Private 5sesi)
    usedGroupSessions: 0, // 6 sesi total - 6 sisa = 0 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0, // 5 sesi total - 5 sisa = 0 used
    validPeriod: 3
  },
  {
    email: 'cynthiaprayitno@icloud.com',
    groupSessions: 0,
    semiPrivateSessions: 0,
    privateSessions: 4, // Private 1:1, sisa 4 (Promo Private 10sesi)
    usedGroupSessions: 0,
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 6, // 10 sesi total - 4 sisa = 6 used
    validPeriod: 3
  },
  {
    email: 'qtin9999@gmail.com',
    groupSessions: 33, // Group Class, sisa 33 (Promo unlimited 3 bulan)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 0, // Unlimited, tidak ada used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'yuli_porianto@yahoo.com',
    groupSessions: 21, // Ms Yulianti ada 2 entry: sisa 1 + sisa 20 = 21 total
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 0, // 21 sesi total - 21 sisa = 0 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'rizkipurnadi@gmail.com',
    groupSessions: 26, // Group Class, sisa 26 (Promo 40sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 14, // 40 sesi total - 26 sisa = 14 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'jazzonovas@gmail.com',
    groupSessions: 32, // Group Class, sisa 32 (Promo 40sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 8, // 40 sesi total - 32 sisa = 8 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'steffirahardjo17@gmail.com',
    groupSessions: 34, // Group Class, sisa 34 (Promo 40sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 6, // 40 sesi total - 34 sisa = 6 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'h_jachja@hotmail.com',
    groupSessions: 0,
    semiPrivateSessions: 0,
    privateSessions: 7, // Private 1:1, sisa 7 (Private 10 + 2)
    usedGroupSessions: 0,
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 5, // 12 sesi total - 7 sisa = 5 used
    validPeriod: 3
  },
  {
    email: 'lindakris931966@gmail.com',
    groupSessions: 11, // Group Class, sisa 11 (Promo 20sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 9, // 20 sesi total - 11 sisa = 9 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'connyandriani@gmail.com',
    groupSessions: 10, // Group Class, sisa 10 (Promo 10 + 2)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 2, // 12 sesi total - 10 sisa = 2 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'jennismemories@gmail.com',
    groupSessions: 4, // Group Class, sisa 4 (Promo 20sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 16, // 20 sesi total - 4 sisa = 16 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'jennkezia@gmail.com',
    groupSessions: 3, // Group Class, sisa 3 (Promo 20sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 17, // 20 sesi total - 3 sisa = 17 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'roslinamgm@yahoo.com',
    groupSessions: 40, // Group Class, sisa 40 (Promo 40sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 0, // 40 sesi total - 40 sisa = 0 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
  },
  {
    email: 'diana@rst-indonesia.com',
    groupSessions: 12, // Group Class, sisa 12 (Promo Ramadhan 12sesi)
    semiPrivateSessions: 0,
    privateSessions: 0,
    usedGroupSessions: 0, // 12 sesi total - 12 sisa = 0 used
    usedSemiPrivateSessions: 0,
    usedPrivateSessions: 0,
    validPeriod: 3
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
        const memberId = await getMemberId(member.email);
        console.log(`   ✅ Found member ID: ${memberId}`);
        
        // Set start date to today
        const startDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        const endDate = calculateEndDate(startDate, member.validPeriod, 'month');
        
        console.log(`   📅 Period: ${startDate} to ${endDate} (${member.validPeriod} months)`);
        console.log(`   📊 Sessions: Group=${member.groupSessions} (used: ${member.usedGroupSessions}), Semi-Private=${member.semiPrivateSessions} (used: ${member.usedSemiPrivateSessions}), Private=${member.privateSessions} (used: ${member.usedPrivateSessions})`);
        
        // 1. Member Package Group
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
          is_active: true
        });
        console.log(`   ✅ Created group package with ${member.groupSessions} sessions (used: ${member.usedGroupSessions})`);
        
        // 2. Member Package Semi-Private
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
          is_active: true
        });
        console.log(`   ✅ Created semi-private package with ${member.semiPrivateSessions} sessions (used: ${member.usedSemiPrivateSessions})`);
        
        // 3. Member Package Private
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
          is_active: true
        });
        console.log(`   ✅ Created private package with ${member.privateSessions} sessions (used: ${member.usedPrivateSessions})`);
        
        successCount++;
        console.log(`   🎉 Member ${member.email} completed successfully!\n`);
        
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
    console.log(`   Packages created: 3 (shared by all members)`);
    console.log(`   Member packages created: ${successCount * 3}`);
    console.log(`   Default valid period: 3 months (except unlimited packages)`);
    console.log(`   Start date: Today`);
    console.log(`   Used sessions: All set to 0 (default)`);
    
  } catch (error) {
    console.error('\n❌ Error during database session injection:', error.message);
  } finally {
    await sequelize.close();
  }
};

// Run the script
injectSessionsDB(); 