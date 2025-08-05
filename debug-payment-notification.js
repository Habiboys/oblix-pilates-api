// Debug script untuk payment notification
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function debugPaymentNotification() {
  try {
    console.log('🔍 Debugging payment notification...');
    
    // Simulate Midtrans notification untuk order yang masih pending
    // Format sederhana yang digunakan di controller
    const mockNotification = {
      order_id: 'ORD-1754368415687-833',
      transaction_status: 'expire',
      transaction_id: 'debug-expired-transaction-123',
      fraud_status: 'accept',
      payment_type: 'bank_transfer',
      va_numbers: [
        {
          bank: 'bca',
          va_number: '72561183108124200563623'
        }
      ]
    };
    
    console.log('📤 Sending mock notification:', mockNotification);
    
    // Bypass Midtrans service dan langsung test ke controller
    const response = await axios.post(`${BASE_URL}/api/order/payment/notification`, mockNotification, {
      headers: {
        'Content-Type': 'application/json',
        'X-Midtrans-Signature': 'test-signature' // Bypass signature verification
      }
    });
    
    console.log('✅ Response:', response.data);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

debugPaymentNotification(); 