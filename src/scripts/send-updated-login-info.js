// src/scripts/send-updated-login-info.js
// Script untuk mengirim email perbaruan informasi login kepada member yang telah diperbaiki nomor HP-nya
//
// CARA PENGGUNAAN:
// 1. Update array memberEmails di bawah dengan email asli dari database
// 2. Jalankan script: node src/scripts/send-updated-login-info.js
// 
// Script ini akan:
// - Mencari member berdasarkan email dari database
// - Mengambil full name dan username dari database
// - Mengirim email perbaruan informasi login
//
// CATATAN: Pastikan email di array sesuai dengan email yang ada di database

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { User, Member, sequelize } = require('../models');
const emailService = require('../services/email.service');
const logger = require('../config/logger');

// Debug environment variables
console.log('🔍 Environment Check:');
console.log('DB_USER:', process.env.DB_USER || 'NOT SET');
console.log('DB_HOST:', process.env.DB_HOST || 'NOT SET');
console.log('DB_PORT:', process.env.DB_PORT || 'NOT SET');
console.log('DB_NAME:', process.env.DB_NAME || 'NOT SET');
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? 'SET' : 'NOT SET');

/**
 * Test koneksi database
 */
const testDatabaseConnection = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connection has been established successfully.');
        return true;
    } catch (error) {
        console.error('❌ Unable to connect to the database:', error.message);
        return false;
    }
};

// Daftar email member yang perlu dikirim email perbaruan
const memberEmails = [
  'nouvalhabibie18@gmail.com',
   'nellyathien@gmail.com',
 'mond81700@gmail.com',
 'eviespp@gmail.com',
 'sharines89@gmail.com',
 'Natasyaaaa19@gmail.com',
 'cynthiaprayitno@icloud.com',
 'nzzzel@yahoo.com'
 
];
// const memberEmails = [
//  'nellyathien@gmail.com',
//  'mond81700@gmail.com',
//  'eviespp@gmail.com',
//  'sharines89@gmail.com',
//  'Natasyaaaa19@gmail.com',
//  'cynthiaprayitno@icloud.com',
//  'nzzzel@yahoo.com'
// ];

/**
 * Cari member di database berdasarkan email
 */
const findMemberByEmail = async (email) => {
    try {
        let member = null;
        
        // Cari berdasarkan email di User
        const user = await User.findOne({
            where: { email: email },
            include: [{
                model: Member,
                as: 'Member'
            }]
        });
        
        if (user && user.Member) {
            member = user.Member;
            member.User = user; // Attach user data
            logger.info(`✅ Found member by user email: ${user.email}`);
        } else {
            // Jika tidak ditemukan di User, cari langsung di Member
            member = await Member.findOne({
                where: { email: email },
                include: [{
                    model: User,
                    as: 'User'
                }]
            });
            
            if (member) {
                logger.info(`✅ Found member by member email: ${email}`);
            }
        }
        
        return member;
    } catch (error) {
        logger.error(`❌ Error finding member by email ${email}:`, error);
        return null;
    }
};

/**
 * Kirim email perbaruan informasi login berdasarkan email
 */
const sendUpdatedLoginEmail = async (email) => {
    try {
        const member = await findMemberByEmail(email);
        
        if (!member) {
            logger.error(`❌ Member not found with email: ${email}`);
            return { success: false, message: 'Member not found', email: email };
        }
        
        // Ambil username dari User yang terkait
        const username = member.User?.username || member.username || member.member_code;
        if (!username) {
            logger.error(`❌ No username found for member: ${member.full_name}`);
            return { success: false, message: 'No username found', member_name: member.full_name, email: email };
        }
        
        // Ambil phone number
        const phoneNumber = member.phone_number;
        if (!phoneNumber) {
            logger.error(`❌ No phone number found for member: ${member.full_name}`);
            return { success: false, message: 'No phone number found', member_name: member.full_name, email: email };
        }
        
        // Kirim email menggunakan email service
        const result = await emailService.sendUpdatedLoginInfoEmail(email, member.full_name, phoneNumber, member.member_code);
        
        if (result.success) {
            logger.info(`✅ Updated login info email sent to ${member.full_name} (${email})`);
            return { 
                success: true, 
                member_name: member.full_name, 
                email: email,
                username: username,
                messageId: result.messageId 
            };
        } else {
            logger.error(`❌ Failed to send email to ${member.full_name}:`, result.error);
            return { 
                success: false, 
                message: result.error, 
                member_name: member.full_name,
                email: email
            };
        }
        
    } catch (error) {
        logger.error(`❌ Error sending updated login email to ${email}:`, error);
        return { success: false, message: error.message, email: email };
    }
};

/**
 * Main function untuk menjalankan script
 */
const main = async () => {
    try {
        logger.info('🚀 Starting updated login info email sending process...');
        logger.info(`📊 Total emails to process: ${memberEmails.length}`);
        
        const results = [];
        
        for (const email of memberEmails) {
            logger.info(`\n📤 Processing email: ${email}...`);
            
            const result = await sendUpdatedLoginEmail(email);
            results.push(result);
            
            // Delay 1 detik antara email untuk menghindari rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Summary
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        logger.info('\n📊 SUMMARY RESULTS:');
        logger.info(`✅ Successfully sent: ${successful.length}`);
        logger.info(`❌ Failed to send: ${failed.length}`);
        
        if (successful.length > 0) {
            logger.info('\n✅ Successfully sent to:');
            successful.forEach(result => {
                logger.info(`   - ${result.member_name} (${result.email}) - Username: ${result.username}`);
            });
        }
        
        if (failed.length > 0) {
            logger.info('\n❌ Failed to send to:');
            failed.forEach(result => {
                const memberName = result.member_name || 'Unknown';
                logger.info(`   - ${memberName} (${result.email}): ${result.message}`);
            });
        }
        
        logger.info('\n🏁 Updated login info email sending process completed!');
        
    } catch (error) {
        logger.error('❌ Fatal error in main process:', error);
        process.exit(1);
    }
};

// Jalankan script jika dipanggil langsung
if (require.main === module) {
    main()
        .then(() => {
            logger.info('✅ Script execution completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('❌ Script execution failed:', error);
            process.exit(1);
        });
}

module.exports = {
    findMemberByEmail,
    sendUpdatedLoginEmail,
    main
};
