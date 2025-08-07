// test-banner-upload.js
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000/api';

// Helper untuk membuat file dummy untuk testing
function createDummyImage(filename) {
    // Membuat file dummy 1x1 pixel PNG
    const pngData = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
        0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x37, 0x6E, 0xF9, 0x24, 0x00, 0x00,
        0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);
    
    fs.writeFileSync(filename, pngData);
    return filename;
}

async function testBannerEndpoints() {
    console.log('🔍 Testing Banner Endpoints with 2 Pictures...');
    console.log('==========================================');

    let authToken = '';
    
    try {
        // 1. Login untuk mendapatkan token
        console.log('1. Testing Login');
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'admin@oblix.com',
            password: 'admin123'
        });
        
        if (loginResponse.status === 200) {
            authToken = loginResponse.data.data.accessToken;
            console.log('✅ Login berhasil');
        } else {
            console.log('❌ Login gagal');
            return;
        }

        // Helper untuk authenticated requests
        const makeRequest = (method, url, data = null, config = {}) => {
            return axios({
                method,
                url: `${BASE_URL}${url}`,
                data,
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    ...config.headers
                },
                ...config
            });
        };

        // 2. Test GET /banner
        console.log('\n2. Testing GET /banner');
        const getBannersResponse = await axios.get(`${BASE_URL}/banner`);
        
        if (getBannersResponse.status === 200) {
            console.log('✅ Status:', getBannersResponse.status);
            console.log('✅ Total banners:', getBannersResponse.data.data.banners.length);
        } else {
            console.log('❌ Unexpected status:', getBannersResponse.status);
        }

        // 3. Test CREATE banner dengan 2 gambar
        console.log('\n3. Testing POST /banner (with both pictures)');
        
        // Buat file dummy untuk testing
        const portraitFile = createDummyImage('test_portrait.png');
        const landscapeFile = createDummyImage('test_landscape.png');
        
        const createFormData = new FormData();
        createFormData.append('title', 'Test Banner Dua Gambar');
        createFormData.append('picturePortrait', fs.createReadStream(portraitFile));
        createFormData.append('pictureLandscape', fs.createReadStream(landscapeFile));

        const createResponse = await makeRequest('post', '/banner', createFormData, {
            headers: createFormData.getHeaders()
        });

        let createdBannerId = '';
        if (createResponse.status === 201) {
            createdBannerId = createResponse.data.data.id;
            console.log('✅ Status:', createResponse.status);
            console.log('✅ Banner created with ID:', createdBannerId);
            console.log('✅ Portrait:', createResponse.data.data.picturePortrait);
            console.log('✅ Landscape:', createResponse.data.data.pictureLandscape);
        } else {
            console.log('❌ Create failed. Status:', createResponse.status);
        }

        // 4. Test CREATE banner dengan hanya 1 gambar (portrait)
        console.log('\n4. Testing POST /banner (portrait only)');
        
        const createFormData2 = new FormData();
        createFormData2.append('title', 'Test Banner Portrait Only');
        createFormData2.append('picturePortrait', fs.createReadStream(portraitFile));

        const createResponse2 = await makeRequest('post', '/banner', createFormData2, {
            headers: createFormData2.getHeaders()
        });

        let createdBannerId2 = '';
        if (createResponse2.status === 201) {
            createdBannerId2 = createResponse2.data.data.id;
            console.log('✅ Status:', createResponse2.status);
            console.log('✅ Banner created with ID:', createdBannerId2);
            console.log('✅ Portrait:', createResponse2.data.data.picturePortrait);
            console.log('✅ Landscape:', createResponse2.data.data.pictureLandscape || 'null');
        } else {
            console.log('❌ Create failed. Status:', createResponse2.status);
        }

        // 5. Test CREATE banner dengan hanya 1 gambar (landscape)
        console.log('\n5. Testing POST /banner (landscape only)');
        
        const createFormData3 = new FormData();
        createFormData3.append('title', 'Test Banner Landscape Only');
        createFormData3.append('pictureLandscape', fs.createReadStream(landscapeFile));

        const createResponse3 = await makeRequest('post', '/banner', createFormData3, {
            headers: createFormData3.getHeaders()
        });

        let createdBannerId3 = '';
        if (createResponse3.status === 201) {
            createdBannerId3 = createResponse3.data.data.id;
            console.log('✅ Status:', createResponse3.status);
            console.log('✅ Banner created with ID:', createdBannerId3);
            console.log('✅ Portrait:', createResponse3.data.data.picturePortrait || 'null');
            console.log('✅ Landscape:', createResponse3.data.data.pictureLandscape);
        } else {
            console.log('❌ Create failed. Status:', createResponse3.status);
        }

        // 6. Test CREATE banner tanpa gambar (should fail)
        console.log('\n6. Testing POST /banner (no pictures - should fail)');
        
        const createFormData4 = new FormData();
        createFormData4.append('title', 'Test Banner No Pictures');

        try {
            const createResponse4 = await makeRequest('post', '/banner', createFormData4, {
                headers: createFormData4.getHeaders()
            });
            console.log('❌ Should have failed but got status:', createResponse4.status);
        } catch (error) {
            console.log('✅ Correctly failed with error:', error.response?.data?.message || error.message);
        }

        // 7. Test UPDATE banner
        if (createdBannerId) {
            console.log('\n7. Testing PUT /banner/:id');
            
            const updateFormData = new FormData();
            updateFormData.append('title', 'Updated Banner Title');
            updateFormData.append('picturePortrait', fs.createReadStream(portraitFile));

            const updateResponse = await makeRequest('put', `/banner/${createdBannerId}`, updateFormData, {
                headers: updateFormData.getHeaders()
            });

            if (updateResponse.status === 200) {
                console.log('✅ Status:', updateResponse.status);
                console.log('✅ Banner updated');
                console.log('✅ New title:', updateResponse.data.data.title);
            } else {
                console.log('❌ Update failed. Status:', updateResponse.status);
            }
        }

        // 8. Test DELETE banner
        if (createdBannerId) {
            console.log('\n8. Testing DELETE /banner/:id');
            
            const deleteResponse = await makeRequest('delete', `/banner/${createdBannerId}`);

            if (deleteResponse.status === 200) {
                console.log('✅ Status:', deleteResponse.status);
                console.log('✅ Banner deleted');
            } else {
                console.log('❌ Delete failed. Status:', deleteResponse.status);
            }
        }

        // Cleanup test files
        [portraitFile, landscapeFile].forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });

        console.log('\n✅ Banner testing completed!');

    } catch (error) {
        console.log('❌ Error:', error.response?.data || error.message);
        
        // Cleanup test files in case of error
        ['test_portrait.png', 'test_landscape.png'].forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });
    }
}

testBannerEndpoints(); 