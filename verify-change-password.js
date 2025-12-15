const axios = require('axios');

const BASE_URL = 'http://localhost:8080/api';
const ADMIN_EMAIL = 'admin@oblix.com';
const ADMIN_PASSWORD = 'admin123';
const TARGET_USER_ID = '770e8400-e29b-41d4-a716-446655440002'; // user@oblix.com
const NEW_PASSWORD = 'newPassword123';
const ORIGINAL_PASSWORD = 'user123';

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function login(email, password) {
    try {
        const response = await axios.post(`${BASE_URL}/auth/login`, {
            email,
            password
        });
        return response.data.data.accessToken;
    } catch (error) {
        if (error.response) {
            console.error(`Login failed for ${email}:`, error.response.status, error.response.data);
        } else {
            console.error(`Login failed for ${email}:`, error.message);
        }
        throw error;
    }
}

async function changePassword(adminToken, userId, newPassword, confirmPassword) {
    try {
        const response = await axios.put(
            `${BASE_URL}/staff/${userId}/change-password`,
            {
                password: newPassword,
                confirmPassword: confirmPassword
            },
            {
                headers: {
                    Authorization: `Bearer ${adminToken}`
                }
            }
        );
        console.log('Change password response:', response.data);
        return response.data;
    } catch (error) {
        if (error.response) {
            console.error('Change password failed:', error.response.status, error.response.data);
        } else {
            console.error('Change password failed:', error.message);
        }
        throw error;
    }
}

async function verify() {
    console.log('Starting verification...');

    // Wait for server to be ready
    let retries = 10;
    while (retries > 0) {
        try {
            await axios.get('http://localhost:8080/health');
            console.log('Server is ready.');
            break;
        } catch (e) {
            console.log('Waiting for server...');
            await delay(2000);
            retries--;
        }
    }

    if (retries === 0) {
        console.error('Server did not start in time. Aborting.');
        process.exit(1);
    }

    try {
        // 1. Login as Admin
        console.log('1. Logging in as Admin...');
        const adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
        console.log('Admin logged in.');

        // 2. Change User Password
        console.log(`2. Changing password for user ${TARGET_USER_ID}...`);
        await changePassword(adminToken, TARGET_USER_ID, NEW_PASSWORD, NEW_PASSWORD);
        console.log('Password changed.');

        // 3. Verify Login with New Password
        console.log('3. Verifying login with new password...');
        await login('user@oblix.com', NEW_PASSWORD);
        console.log('Login with new password successful.');

        // 4. Revert Password
        console.log('4. Reverting password...');
        await changePassword(adminToken, TARGET_USER_ID, ORIGINAL_PASSWORD, ORIGINAL_PASSWORD);
        console.log('Password reverted.');

        console.log('Verification SUCCESS!');
    } catch (error) {
        console.error('Verification FAILED.');
        process.exit(1);
    }
}

verify();
