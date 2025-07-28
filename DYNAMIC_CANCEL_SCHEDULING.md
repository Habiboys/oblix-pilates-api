# Dynamic Cancel Scheduling System

## Overview

Sistem dynamic cancel scheduling menggantikan cron job yang berjalan setiap 15 menit dengan sistem yang lebih efisien yang menjadwalkan cancel job berdasarkan buffer time dari masing-masing schedule.

## Keuntungan

1. **Efisiensi**: Tidak perlu cek setiap 15 menit, hanya menjalankan cancel job tepat pada waktu yang diperlukan
2. **Presisi**: Cancel job dijalankan tepat pada waktu cancel deadline dari setiap schedule
3. **Fleksibilitas**: Setiap schedule bisa memiliki buffer time yang berbeda
4. **Monitoring**: Bisa melihat status scheduled tasks secara real-time

## Cara Kerja

### 1. Dynamic Scheduling
- Sistem akan mengambil semua schedule yang akan datang (group dan semi-private)
- Untuk setiap schedule, hitung cancel deadline berdasarkan `cancel_buffer_minutes`
- Jadwalkan cancel job tepat pada waktu cancel deadline
- Job akan otomatis dihapus setelah selesai dieksekusi

### 2. Refresh Mechanism
- Refresh otomatis setiap jam untuk menangkap schedule baru
- Refresh manual saat create/update schedule
- Refresh manual melalui API endpoint

### 3. Fallback System
- Legacy cron job masih tersedia sebagai fallback (bisa di-disable)
- Jika dynamic scheduling gagal, legacy cron akan tetap berjalan

## API Endpoints

### Get Scheduled Tasks Status
```http
GET /api/schedules/cancel-tasks/status
Authorization: Bearer <token>
```

Response:
```json
{
  "success": true,
  "message": "Scheduled cancel tasks status retrieved successfully",
  "data": {
    "total_scheduled": 5,
    "scheduled_schedules": [
      "6b8f4d2e-1a3c-4e8b-9d7f-2c5a8e1b4f9d",
      "7c9f5e3f-2b4d-5f9c-0e6b-3d6a9f2c5e0a"
    ]
  }
}
```

### Refresh Dynamic Scheduling
```http
POST /api/schedules/cancel-tasks/refresh
Authorization: Bearer <token>
```

Response:
```json
{
  "success": true,
  "message": "Dynamic cancel scheduling refreshed successfully",
  "data": {
    "success": true,
    "scheduled_count": 8,
    "total_schedules": 12
  }
}
```

## Konfigurasi

### Buffer Time per Schedule Type
- **Group**: 30-480 menit (default: 120 menit)
- **Semi-private**: 30-1440 menit (default: 120 menit)
- **Private**: 30-1440 menit (default: 120 menit)

### Refresh Interval
- Otomatis: Setiap jam (00:00)
- Manual: Setiap create/update schedule
- Manual: Via API endpoint

## Logging

Sistem akan mencatat log untuk:
- Setup dynamic scheduling
- Scheduling cancel job untuk setiap schedule
- Eksekusi cancel job
- Refresh scheduling
- Error handling

## Monitoring

### Log Examples
```
🕐 Setting up dynamic cancel scheduling...
📅 Scheduled auto-cancel for schedule 6b8f4d2e-1a3c-4e8b-9d7f-2c5a8e1b4f9d at 25/12/2024, 14:30:00
✅ Dynamic cancel scheduling completed: 8 schedules scheduled for auto-cancel
🕐 Running auto-cancel for schedule 6b8f4d2e-1a3c-4e8b-9d7f-2c5a8e1b4f9d (2024-12-25 16:00)
✅ Auto-cancel completed for schedule 6b8f4d2e-1a3c-4e8b-9d7f-2c5a8e1b4f9d: 3 bookings cancelled
```

## Migration dari Legacy System

### Langkah 1: Aktifkan Dynamic Scheduling
```javascript
// Di src/cron/bookingCron.js
const startAllCronJobs = () => {
    // Start dynamic scheduling (recommended approach)
    startDynamicCancelScheduling();
    
    // Keep legacy cron as fallback (optional - can be disabled)
    // startAutoCancelCron();
    
    startBookingReminderCron();
};
```

### Langkah 2: Test dan Monitor
1. Monitor log untuk memastikan dynamic scheduling berjalan dengan baik
2. Cek status scheduled tasks via API
3. Verifikasi cancel job berjalan tepat waktu

### Langkah 3: Disable Legacy Cron (Optional)
```javascript
// Comment out legacy cron jika sudah yakin dynamic scheduling berjalan dengan baik
// startAutoCancelCron();
```

## Troubleshooting

### Masalah Umum

1. **Schedule tidak ter-schedule**
   - Cek apakah schedule memiliki `cancel_buffer_minutes`
   - Cek apakah cancel deadline di masa depan
   - Refresh manual via API

2. **Cancel job tidak berjalan**
   - Cek log untuk error
   - Cek timezone setting
   - Cek apakah schedule masih ada

3. **Performance issues**
   - Monitor jumlah scheduled tasks
   - Cek memory usage
   - Restart aplikasi jika diperlukan

### Debug Commands

```javascript
// Cek status scheduled tasks
const { getScheduledCancelTasksStatus } = require('./src/cron/bookingCron');
console.log(getScheduledCancelTasksStatus());

// Refresh manual
const { refreshDynamicCancelScheduling } = require('./src/cron/bookingCron');
refreshDynamicCancelScheduling().then(console.log);
```

## Best Practices

1. **Monitor secara regular**: Cek status scheduled tasks setiap hari
2. **Backup legacy system**: Jangan disable legacy cron sampai yakin 100%
3. **Test dengan schedule dummy**: Buat schedule test untuk verifikasi
4. **Documentation**: Update dokumentasi tim tentang sistem baru
5. **Alert system**: Setup alert jika dynamic scheduling gagal

## Performance Impact

### Sebelum (Legacy)
- Cek setiap 15 menit
- Query database setiap 15 menit
- Process semua schedule setiap kali

### Sesudah (Dynamic)
- Setup sekali saat startup
- Refresh setiap jam
- Process hanya schedule yang perlu cancel
- Memory usage lebih efisien

## Security Considerations

1. **API endpoints**: Hanya admin yang bisa akses
2. **Logging**: Jangan log sensitive data
3. **Error handling**: Jangan expose internal error ke client
4. **Rate limiting**: Implement rate limiting untuk API endpoints 