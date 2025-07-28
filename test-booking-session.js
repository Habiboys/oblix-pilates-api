const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';
const TEST_USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjYzYzdkZGM4LTI4OTAtNDQ3MC1hZjc1LTUyNWJiOWI0Y2EyNCIsImlhdCI6MTc1MzcyNTUxOCwiZXhwIjoxNzUzODExOTE4fQ.79_7mESncsUWGGRuNAnuF02rskf8DjJr4Rqeqvdjgts';

async function testBookingSession() {
    try {
        console.log('🚀 Testing Booking Session Reduction...\n');

        // 1. Cek sesi sebelum booking
        console.log('📊 1. Cek sesi sebelum booking...');
        const beforeBooking = await axios.get(`${BASE_URL}/check-class?date=2025-01-29`, {
            headers: { Authorization: `Bearer ${TEST_USER_TOKEN}` }
        });
        
        console.log('Response check-class sebelum booking:', JSON.stringify(beforeBooking.data.data, null, 2));
        
        const beforeSessions = beforeBooking.data.data.package_info?.remaining_sessions?.group || 0;
        console.log('Sesi tersedia sebelum booking:', beforeSessions);

        // 2. Cek my-packages sebelum booking
        console.log('\n📦 2. Cek my-packages sebelum booking...');
        const beforePackages = await axios.get(`${BASE_URL}/member-package/my-packages`, {
            headers: { Authorization: `Bearer ${TEST_USER_TOKEN}` }
        });
        
        console.log('My packages sebelum booking:', beforePackages.data.data);

        // 3. Cari schedule yang tersedia untuk booking
        console.log('\n🔍 3. Cari schedule yang tersedia...');
        
        // Gunakan schedule ID yang berbeda untuk menghindari konflik
        const testScheduleId = '181a042f-baee-4714-90dd-64eed5c89047'; // group class 2025-08-18
        console.log('Schedule yang akan dibooking:', testScheduleId);

        // 4. Lakukan booking
        console.log('\n🎯 4. Melakukan booking...');
        const bookingResponse = await axios.post(`${BASE_URL}/booking`, {
            schedule_id: testScheduleId
        }, {
            headers: { Authorization: `Bearer ${TEST_USER_TOKEN}` }
        });
        
        console.log('Booking response:', bookingResponse.data);

        // Tunggu sebentar untuk memastikan update selesai
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 5. Cek sesi setelah booking
        console.log('\n📊 5. Cek sesi setelah booking...');
        const afterBooking = await axios.get(`${BASE_URL}/check-class?date=2025-01-29`, {
            headers: { Authorization: `Bearer ${TEST_USER_TOKEN}` }
        });
        
        console.log('Response check-class setelah booking:', JSON.stringify(afterBooking.data.data, null, 2));
        
        const afterSessions = afterBooking.data.data.package_info?.remaining_sessions?.group || 0;
        console.log('Sesi tersedia setelah booking:', afterSessions);

        // 6. Cek my-packages setelah booking
        console.log('\n📦 6. Cek my-packages setelah booking...');
        const afterPackages = await axios.get(`${BASE_URL}/member-package/my-packages`, {
            headers: { Authorization: `Bearer ${TEST_USER_TOKEN}` }
        });
        
        console.log('My packages setelah booking:', afterPackages.data.data);

        // 7. Analisis hasil
        console.log('\n📈 7. Analisis hasil...');
        
        if (beforeSessions > afterSessions) {
            console.log('✅ SUCCESS: Sesi berkurang dengan benar!');
            console.log(`Sesi sebelum: ${beforeSessions}, Sesi setelah: ${afterSessions}`);
            console.log(`Pengurangan: ${beforeSessions - afterSessions} sesi`);
        } else {
            console.log('❌ FAILED: Sesi tidak berkurang!');
            console.log(`Sesi sebelum: ${beforeSessions}, Sesi setelah: ${afterSessions}`);
        }

        // 8. Cek my-classes untuk melihat booking
        console.log('\n📋 8. Cek my-classes...');
        const myClasses = await axios.get(`${BASE_URL}/member/my-classes?type=upcoming`, {
            headers: { Authorization: `Bearer ${TEST_USER_TOKEN}` }
        });
        
        console.log('My classes:', myClasses.data);

    } catch (error) {
        console.error('❌ Error during test:', error.response?.data || error.message);
    }
}

// Jalankan test
testBookingSession(); 