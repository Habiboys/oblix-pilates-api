// inject-sessions-direct.js
// Script untuk inject sesi dengan koneksi database langsung

const { Sequelize } = require('sequelize');
require('dotenv').config();

console.log('🔧 Environment Variables:');
console.log(`   DB_HOST: ${process.env.DB_HOST || 'NOT SET'}`);
console.log(`   DB_NAME: ${process.env.DB_NAME || 'NOT SET'}`);
console.log(`   DB_USER: ${process.env.DB_USER || 'NOT SET'}`);
console.log(`   DB_PORT: ${process.env.DB_PORT || 'NOT SET'}`);
console.log('');

// Database configuration langsung
const dbHost = process.env.DB_HOST === 'localhost' ? '127.0.0.1' : process.env.DB_HOST;
console.log(`🔧 Using host: ${dbHost} (original: ${process.env.DB_HOST})`);

const sequelize = new Sequelize({
  dialect: 'mysql',
  host: dbHost,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  timezone: '+07:00',
  logging: false
});

// Category IDs
const GROUP_CATEGORY_ID = '550e8400-e29b-41d4-a716-446655440001';
const SEMI_PRIVATE_CATEGORY_ID = '550e8400-e29b-41d4-a716-446655440002';
const PRIVATE_CATEGORY_ID = '6ce66b01-712e-4211-b385-cf2256ef9bd5';

// Test connection dan inject data
const injectData = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection successful');
    
    // Test query sederhana
    const [results] = await sequelize.query('SELECT COUNT(*) as count FROM packages');
    console.log(`📦 Found ${results[0].count} existing packages`);
    
    // Test query member
    const [memberResults] = await sequelize.query('SELECT COUNT(*) as count FROM members');
    console.log(`👥 Found ${memberResults[0].count} existing members`);
    
    console.log('🎉 Database connection and queries working!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
};

injectData(); 