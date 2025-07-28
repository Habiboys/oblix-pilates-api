const axios = require('axios');
const BASE_URL = 'http://localhost:3000/api';
const TEST_USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjYzYzdkZGM4LTI4OTAtNDQ3MC1hZjc1LTUyNWJiOWI0Y2EyNCIsImlhdCI6MTc1MzcyNTUxOCwiZXhwIjoxNzUzODExOTE4fQ.79_7mESncsUWGGRuNAnuF02rskf8DjJr4Rqeqvdjgts';

async function testSessionReduction() {
    try {
        console.log('🚀 Testing Session Reduction...\n');
        
        // 1. Cek sesi sebelum booking
        console.log('📊 1. Cek sesi sebelum booking...');
        const beforeBooking = await axios.get(`${BASE_URL}/check-class?date=2025-01-29`, {
            headers: { Authorization: `Bearer ${TEST_USER_TOKEN}` }
        });
        
        const beforeSessions = beforeBooking.data.data.package_info?.remaining_sessions?.group || 0;
        console.log('Sesi tersedia sebelum booking:', beforeSessions);
        console.log('Package info sebelum booking:', JSON.stringify(beforeBooking.data.data.package_info, null, 2));

        // 2. Cek my-packages sebelum booking
        console.log('\n📦 2. Cek my-packages sebelum booking...');
        const beforePackages = await axios.get(`${BASE_URL}/member-package/my-packages`, {
            headers: { Authorization: `Bearer ${TEST_USER_TOKEN}` }
        });
        console.log('My packages sebelum booking:', JSON.stringify(beforePackages.data.data, null, 2));

        // 3. Cari schedule yang tersedia untuk booking
        console.log('\n🔍 3. Cari schedule yang tersedia...');
        const schedules = beforeBooking.data.data.schedules;
        const availableSchedule = schedules.find(s => s.can_book && !s.is_booked);
        
        if (!availableSchedule) {
            console.log('❌ Tidak ada schedule yang tersedia untuk booking');
            return;
        }
        
        console.log('Schedule yang akan dibooking:', availableSchedule.id);

        // 4. Lakukan booking
        console.log('\n🎯 4. Melakukan booking...');
        const bookingResponse = await axios.post(`${BASE_URL}/booking`, {
            schedule_id: availableSchedule.id
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
        
        const afterSessions = afterBooking.data.data.package_info?.remaining_sessions?.group || 0;
        console.log('Sesi tersedia setelah booking:', afterSessions);
        console.log('Package info setelah booking:', JSON.stringify(afterBooking.data.data.package_info, null, 2));

        // 6. Cek my-packages setelah booking
        console.log('\n📦 6. Cek my-packages setelah booking...');
        const afterPackages = await axios.get(`${BASE_URL}/member-package/my-packages`, {
            headers: { Authorization: `Bearer ${TEST_USER_TOKEN}` }
        });
        console.log('My packages setelah booking:', JSON.stringify(afterPackages.data.data, null, 2));

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

testSessionReduction(); 