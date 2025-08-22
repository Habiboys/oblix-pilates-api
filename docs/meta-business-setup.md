# Meta Business Suite & Developer Meta Setup

## 🔍 Diagnosis Hasil

Berdasarkan test yang sudah dijalankan:

### ✅ Yang Sudah Benar:
- **Access Token**: Valid dan berfungsi
- **Phone Number**: Terdaftar dan aktif (Quality Rating: GREEN)
- **User/App**: "Nau Fa L" (ID: 24241308512198392)

### ❌ Yang Bermasalah:
- **Business Account ID**: Tidak terdeteksi
- **Templates**: Tidak ada yang tersedia
- **Business Suite Connection**: Belum terhubung dengan Developer Meta

## 🔧 Langkah-langkah Perbaikan

### 1. **Setup Meta Business Manager**

#### A. Buat Business Account
1. Buka [Meta Business Manager](https://business.facebook.com/)
2. Klik **Create Account** atau **Add Account**
3. Pilih **Business** (bukan Personal)
4. Isi informasi bisnis:
   - **Business Name**: Oblix Pilates
   - **Business Email**: email@oblixpilates.id
   - **Business Address**: Alamat lengkap
   - **Business Phone**: Nomor telepon bisnis

#### B. Verifikasi Business Account
1. Upload dokumen verifikasi (SIUP, NPWP, dll)
2. Tunggu approval Meta (1-3 hari kerja)
3. Setelah verified, catat **Business Account ID**

### 2. **Setup WhatsApp Business API**

#### A. Tambahkan WhatsApp ke Business Account
1. Di Business Manager, pilih **All Tools** > **WhatsApp**
2. Klik **Get Started**
3. Pilih **API** (bukan Business App)
4. Ikuti setup wizard

#### B. Verifikasi Phone Number
1. Masukkan nomor telepon yang sudah terdaftar
2. Upload dokumen verifikasi nomor
3. Tunggu approval (24-48 jam)
4. Setelah approved, catat **Phone Number ID**

### 3. **Setup Meta Developer Account**

#### A. Buat App di Developer Console
1. Buka [Meta for Developers](https://developers.facebook.com/)
2. Klik **Create App**
3. Pilih **Business** > **WhatsApp**
4. Isi informasi app:
   - **App Name**: Oblix Pilates API
   - **App Contact Email**: email@oblixpilates.id

#### B. Konfigurasi WhatsApp Product
1. Di dashboard app, pilih **WhatsApp** > **Getting Started**
2. Klik **Add Phone Number**
3. Pilih phone number yang sudah diverifikasi di Business Manager
4. Copy **Phone Number ID** dan **Access Token**

### 4. **Hubungkan Business Manager dengan Developer App**

#### A. Tambahkan Business Account ke App
1. Di Developer Console, pilih **App Settings** > **Basic**
2. Scroll ke **Business Account**
3. Klik **Add Business Account**
4. Pilih Business Account yang sudah dibuat
5. Set permission sesuai kebutuhan

#### B. Set Permissions
1. Di **App Settings** > **Advanced**
2. Tambahkan permission:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
   - `business_management`

### 5. **Update Environment Variables**

Setelah semua setup selesai, update file `.env`:

```env
# Meta WhatsApp API Configuration
META_ACCESS_TOKEN=your-new-access-token
META_PHONE_NUMBER_ID=your-phone-number-id
META_BUSINESS_ACCOUNT_ID=your-business-account-id
META_APP_ID=your-app-id
```

### 6. **Buat Message Templates**

#### A. Di Business Manager
1. Pilih **WhatsApp** > **Message Templates**
2. Klik **Create Template**
3. Buat template sederhana dulu:
   - **Name**: `hello_world`
   - **Category**: Utility
   - **Language**: Indonesian
   - **Message**: "Hello {{1}}! Welcome to Oblix Pilates."

#### B. Template yang Dibutuhkan
Buat template berikut secara bertahap:
- `booking_confirmation`
- `booking_reminder`
- `booking_cancellation`
- `waitlist_promotion`
- `class_cancellation`
- `attendance_notification`
- `low_session_reminder`
- `expiry_reminder`

### 7. **Test Koneksi**

Setelah semua setup selesai, jalankan test:

```bash
node diagnose-meta-connection.js
```

## 🚨 Troubleshooting

### Error Code 100: "Tried accessing nonexisting field"
- **Penyebab**: Business Account tidak terhubung dengan App
- **Solusi**: Pastikan Business Account sudah ditambahkan ke Developer App

### Error Code 132001: "Template name does not exist"
- **Penyebab**: Template belum dibuat atau belum diapprove
- **Solusi**: Buat template di Business Manager dan tunggu approval

### Error Code 190: "Invalid access token"
- **Penyebab**: Access token expired atau tidak valid
- **Solusi**: Generate ulang access token di Developer Console

## 📞 Support

Jika masih mengalami masalah:
1. Cek [Meta Business Manager Help](https://www.facebook.com/business/help)
2. Cek [Meta Developer Documentation](https://developers.facebook.com/docs/whatsapp)
3. Hubungi Meta Support melalui Business Manager

## ⏱️ Timeline

- **Business Account Setup**: 1-3 hari kerja
- **Phone Number Verification**: 24-48 jam
- **Template Approval**: 24-48 jam
- **Total Setup Time**: 3-7 hari kerja
