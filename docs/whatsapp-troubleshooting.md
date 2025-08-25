# WhatsApp Business API Troubleshooting

## Masalah yang Ditemukan

Berdasarkan test yang dilakukan, ditemukan masalah berikut:

### 1. Template Tidak Ditemukan
```
"total_templates": 0,
"templates": [],
"booking_confirmation": {
  "exists": false,
  "status": "NOT_FOUND",
  "message": "Template 'booking_confirmation' tidak ditemukan"
}
```

### 2. Konfigurasi API Sudah Benar
```
"access_token": "✅ Configured",
"phone_number_id": "✅ Configured",
"environment": "development",
"api_version": "v20.0"
```

## Solusi Step by Step

### Langkah 1: Setup Meta Business Manager

1. **Buka Meta Business Manager**
   - Kunjungi: https://business.facebook.com/
   - Login dengan akun Facebook kamu

2. **Verifikasi Bisnis**
   - Pilih bisnis kamu atau buat baru
   - Lengkapi verifikasi bisnis
   - Upload dokumen yang diperlukan

3. **Setup WhatsApp Business**
   - Pilih "WhatsApp" di menu
   - Klik "Get Started"
   - Ikuti proses setup

### Langkah 2: Tambahkan Metode Pembayaran

1. **Buka Business Settings**
   - Klik "Business Settings" di menu
   - Pilih "Billing"

2. **Tambahkan Payment Method**
   - Klik "Add Payment Method"
   - Masukkan kartu kredit/debit
   - Verifikasi pembayaran

### Langkah 3: Buat Template Messages

1. **Buka WhatsApp Manager**
   - Di Meta Business Manager
   - Pilih "WhatsApp" → "Message Templates"

2. **Buat Template Baru**
   ```
   Template Name: booking_confirmation
   Category: Marketing
   Language: Indonesian (id)
   
   Message Template:
   Halo {{1}}, 
   
   Konfirmasi booking kelas {{2}} pada {{3}} pukul {{4}}.
   Status: {{5}}
   
   Terima kasih telah memilih Oblix Pilates!
   ```

3. **Submit untuk Approval**
   - Klik "Submit for Review"
   - Tunggu approval (1-7 hari)

### Langkah 4: Template yang Diperlukan

Buat template berikut di Meta Business Manager:

#### 1. booking_confirmation
```
Halo {{1}}, 

Konfirmasi booking kelas {{2}} pada {{3}} pukul {{4}}.
Status: {{5}}

Terima kasih telah memilih Oblix Pilates!
```

#### 2. booking_reminder
```
Halo {{1}}, 

Reminder: Kelas {{2}} besok {{3}} pukul {{4}}.
Trainer: {{5}}

Jangan lupa datang tepat waktu!
```

#### 3. booking_cancellation
```
Halo {{1}}, 

Booking kelas {{2}} pada {{3}} pukul {{4}} telah dibatalkan.
Alasan: {{5}}

Terima kasih.
```

#### 4. generic_booking_notification
```
Halo {{1}}, 

Notifikasi booking kelas {{2}} pada {{3}} pukul {{4}}.

Terima kasih.
```

### Langkah 5: Test Template

Setelah template diapprove, test dengan endpoint:

```bash
# Cek status template
GET /api/test/whatsapp/templates

# Test kirim pesan
POST /api/test/twilio/whatsapp
{
  "phone_number": "6281234567890",
  "template_name": "booking_confirmation",
  "parameters": ["John Doe", "Pilates Basic", "Senin, 25 Januari 2025", "10:00", "Terdaftar"]
}
```

## Masalah Umum

### 1. "Metode pembayaran yang valid tidak ada"
- **Solusi**: Tambahkan kartu kredit/debit di Business Settings → Billing

### 2. "Percakapan tingkat gratis hanya bisa diinisiasi oleh pelanggan"
- **Solusi**: Upgrade ke akun berbayar atau pastikan pelanggan chat duluan

### 3. "Template name does not exist"
- **Solusi**: Buat template di Meta Business Manager dan tunggu approval

### 4. "Access token invalid"
- **Solusi**: Generate ulang access token di Meta Business Manager

## Environment Variables

Pastikan file `.env` berisi:

```env
META_ACCESS_TOKEN=your-meta-access-token
META_PHONE_NUMBER_ID=your-phone-number-id
META_BUSINESS_ACCOUNT_ID=your-business-account-id
META_APP_ID=your-app-id
```

## Monitoring

Gunakan endpoint berikut untuk monitoring:

- `GET /api/test/whatsapp/status` - Cek konfigurasi API
- `GET /api/test/whatsapp/templates` - Cek status template
- `POST /api/test/twilio/whatsapp` - Test kirim pesan

## Catatan Penting

1. **Free Tier**: Tidak bisa kirim pesan pertama, pelanggan harus chat duluan
2. **Template Approval**: Bisa 1-7 hari untuk approval
3. **Rate Limits**: Ada batasan jumlah pesan per hari
4. **Business Hours**: Template marketing hanya bisa dikirim dalam jam bisnis
