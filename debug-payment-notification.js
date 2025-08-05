// Debug script untuk payment notification
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function debugPaymentNotification() {
  try {
    console.log('🔍 Debugging payment notification...');
    
    // Simulate Midtrans notification untuk order yang masih pending
    const mockNotification = {
      order_id: 'ORD-1754366285832-305',
      transaction_status: 'expire',
      transaction_id: 'debug-transaction-123',
      fraud_status: 'accept',
      payment_type: 'bank_transfer',
      va_numbers: null,
      pdf_url: null
    };
    
    console.log('📤 Sending mock notification:', mockNotification);
    
    const response = await axios.post(`${BASE_URL}/api/order/payment/notification`, mockNotification, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Response:', response.data);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

debugPaymentNotification(); 