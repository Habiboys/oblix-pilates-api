require('dotenv').config();

module.exports = {
    development: {
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        host: process.env.DB_HOST,
        dialect: process.env.DB_DIALECT || 'mysql',
        port: process.env.DB_PORT,
        //timezone
        timezone: '+07:00'
    },
    test: {
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        host: process.env.DB_HOST,
        dialect: process.env.DB_DIALECT || 'mysql',
        port: process.env.DB_PORT,
        timezone: '+07:00'
    },
    production: {
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        host: process.env.DB_HOST,
        dialect: process.env.DB_DIALECT || 'mysql',
        port: process.env.DB_PORT,
        timezone: '+07:00'
    },
    // Midtrans configuration
    midtrans: {
        isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
        merchantId: process.env.MIDTRANS_MERCHANT_ID,
        serverKey: process.env.MIDTRANS_SERVER_KEY,
        clientKey: process.env.MIDTRANS_CLIENT_KEY,
        // Payment expired time in minutes (default: 24 hours = 1440 minutes)
        expiredTime: parseInt(process.env.MIDTRANS_EXPIRED_TIME) || 1440
    },
    // App configuration
    app: {
        baseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
        port: process.env.PORT || 3000
    }
}