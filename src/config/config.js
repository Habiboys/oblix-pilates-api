require('dotenv').config("../../.env");

module.exports = {
    development: {
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        host: process.env.DB_HOST,
        dialect: process.env.DB_DIALECT,
        port: process.env.DB_PORT,
        //timezone
        timezone: '+07:00'
    },
    test: {
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        host: process.env.DB_HOST,
        dialect: process.env.DB_DIALECT,
        port: process.env.DB_PORT,
    },
    production: {
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        host: process.env.DB_HOST,
        dialect: process.env.DB_DIALECT,
        port: process.env.DB_PORT,
    },
    // Midtrans configuration
    midtrans: {
        isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
        merchantId: process.env.MIDTRANS_MERCHANT_ID,
        serverKey: process.env.MIDTRANS_SERVER_KEY,
        clientKey: process.env.MIDTRANS_CLIENT_KEY
    },
    // App configuration
    app: {
        baseUrl: process.env.APP_BASE_URL || 'http://localhost:5173',
        port: process.env.PORT || 3000
    }
}