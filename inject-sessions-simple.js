// inject-sessions-simple.js
// Script sederhana untuk inject sesi dengan environment variables langsung

const { Sequelize } = require('sequelize');
require('dotenv').config();

console.log('🔧 Environment Variables:');
console.log(`   DB_HOST: ${process.env.DB_HOST || 'NOT SET'}`);
console.log(`   DB_NAME: ${process.env.DB_NAME || 'NOT SET'}`);
console.log(`   DB_USER: ${process.env.DB_USER || 'NOT SET'}`);
console.log(`   DB_PORT: ${process.env.DB_PORT || 'NOT SET'}`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log('');

// Database configuration langsung dari environment variables
const sequelize = new Sequelize({
  dialect: 'mysql',
  host: process.env.DB_HOST,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  timezone: '+07:00',
  logging: false
});

// Test connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection successful');
    console.log(`   Connected to: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  } finally {
    await sequelize.close();
  }
};

testConnection(); 