const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });
    }

    async sendResetPasswordEmail(email, resetToken, resetUrl) {
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Reset Password - Oblix Pilates',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
                            <h1 style="color: #333; margin: 0;">Oblix Pilates</h1>
                        </div>
                        
                        <div style="padding: 30px; background-color: white;">
                            <h2 style="color: #333; margin-bottom: 20px;">Reset Password</h2>
                            
                            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                                Anda telah meminta untuk mereset password akun Anda. 
                                Klik tombol di bawah ini untuk melanjutkan:
                            </p>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${resetUrl}?token=${resetToken}" 
                                   style="background-color: #007bff; color: white; padding: 12px 30px; 
                                          text-decoration: none; border-radius: 5px; display: inline-block;">
                                    Reset Password
                                </a>
                            </div>
                            
                            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                                Atau copy link berikut ke browser Anda:
                            </p>
                            
                            <p style="background-color: #f8f9fa; padding: 10px; border-radius: 5px; 
                                      word-break: break-all; color: #333;">
                                ${resetUrl}?token=${resetToken}
                            </p>
                            
                            <p style="color: #666; line-height: 1.6; margin-top: 30px;">
                                <strong>Penting:</strong>
                                <ul style="color: #666; line-height: 1.6;">
                                    <li>Link ini hanya berlaku selama 1 jam</li>
                                    <li>Jangan bagikan link ini kepada siapapun</li>
                                    <li>Jika Anda tidak meminta reset password, abaikan email ini</li>
                                </ul>
                            </p>
                        </div>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
                            <p style="color: #666; margin: 0; font-size: 14px;">
                                © 2024 Oblix Pilates. All rights reserved.
                            </p>
                        </div>
                    </div>
                `
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log('Email sent successfully:', result.messageId);
            return true;
        } catch (error) {
            console.error('Email sending failed:', error);
            return false;
        }
    }

    async sendWelcomeEmail(email, username) {
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Selamat Datang di Oblix Pilates',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
                            <h1 style="color: #333; margin: 0;">Oblix Pilates</h1>
                        </div>
                        
                        <div style="padding: 30px; background-color: white;">
                            <h2 style="color: #333; margin-bottom: 20px;">Selamat Datang!</h2>
                            
                            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                                Halo <strong>${username}</strong>,
                            </p>
                            
                            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                                Selamat datang di Oblix Pilates! Akun Anda telah berhasil dibuat dan siap digunakan.
                            </p>
                            
                            <div style="background-color: #e8f5e8; padding: 20px; border-radius: 5px; margin: 20px 0;">
                                <h3 style="color: #2d5a2d; margin-top: 0;">Apa yang bisa Anda lakukan?</h3>
                                <ul style="color: #2d5a2d; line-height: 1.6;">
                                    <li>Booking sesi pilates</li>
                                    <li>Lihat jadwal kelas</li>
                                    <li>Update profil Anda</li>
                                    <li>Lihat riwayat sesi</li>
                                </ul>
                            </div>
                            
                            <p style="color: #666; line-height: 1.6;">
                                Jika ada pertanyaan, jangan ragu untuk menghubungi tim support kami.
                            </p>
                        </div>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
                            <p style="color: #666; margin: 0; font-size: 14px;">
                                © 2024 Oblix Pilates. All rights reserved.
                            </p>
                        </div>
                    </div>
                `
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log('Welcome email sent successfully:', result.messageId);
            return true;
        } catch (error) {
            console.error('Welcome email sending failed:', error);
            return false;
        }
    }

    async sendLoginInfoEmail(email, fullName, phoneNumber, memberCode) {
        // Convert phone number to +62 format without strip for display
        let displayPassword = phoneNumber;
        
        // Convert phone number to +62 format without strip
        if (displayPassword.startsWith('0')) {
            displayPassword = '+62' + displayPassword.substring(1);
        } else if (displayPassword.startsWith('62')) {
            displayPassword = '+' + displayPassword;
        } else if (!displayPassword.startsWith('+62')) {
            displayPassword = '+62' + displayPassword.replace(/[^0-9]/g, '');
        }
        
        // Remove any remaining non-numeric characters except +
        displayPassword = displayPassword.replace(/[^+0-9]/g, '');
        
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Informasi Login - Oblix Pilates',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
                            <h1 style="color: #333; margin: 0;">Oblix Pilates</h1>
                        </div>
                        
                        <div style="padding: 30px; background-color: white;">
                            <h2 style="color: #333; margin-bottom: 20px;">Informasi Login Akun Anda</h2>
                            
                            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                                Halo <strong>${fullName}</strong>,
                            </p>
                            
                            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                                Akun Anda telah berhasil dibuat di sistem Oblix Pilates. Berikut adalah informasi login Anda:
                            </p>
                            
                            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <h3 style="margin-top: 0; color: #555;">Informasi Login:</h3>
                                <p><strong>Email:</strong> ${email}</p>
                                <p><strong>Password:</strong> ${displayPassword}</p>
                                <p style="color: #666; font-size: 14px; margin-top: 10px;">
                                    <strong>Catatan:</strong> Password menggunakan format nomor telepon dengan +62 tanpa strip (contoh: +6281234567890)
                                </p>
                            </div>
                            
                            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                <h4 style="margin-top: 0; color: #856404;">⚠️ PENTING: Ganti Password Anda</h4>
                                <p style="margin-bottom: 0;">Untuk keamanan akun Anda, <strong>segera ganti password default</strong> setelah login pertama kali.</p>
                            </div>
                            
                            <p style="color: #666; line-height: 1.6;">
                                Silakan login ke aplikasi menggunakan email dan password di atas.
                            </p>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="https://oblixpilates.id/login" 
                                   style="background-color: #007bff; color: white; padding: 12px 30px; 
                                          text-decoration: none; border-radius: 5px; display: inline-block;
                                          font-weight: bold;">
                                    Login ke Oblix Pilates
                                </a>
                            </div>
                            
                            <p style="color: #666; line-height: 1.6;">
                                Jika Anda memiliki pertanyaan, silakan hubungi tim support kami.
                            </p>
                        </div>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
                            <p style="color: #666; margin: 0; font-size: 14px;">
                                © 2024 Oblix Pilates. All rights reserved.
                            </p>
                        </div>
                    </div>
                `
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log('Login info email sent successfully:', result.messageId);
            return true;
        } catch (error) {
            console.error('Login info email sending failed:', error);
            return false;
        }
    }

    async sendBookingReminderEmail(booking) {
        try {
            const member = booking.Member;
            const schedule = booking.Schedule;
            const classInfo = schedule.Class;
            const trainer = schedule.Trainer;

            // Format schedule time
            const scheduleDate = new Date(`${schedule.date_start}T${schedule.time_start}`);
            const formattedDate = scheduleDate.toLocaleDateString('id-ID', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            const formattedTime = scheduleDate.toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit'
            });

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: member.User?.email || member.email,
                subject: 'Reminder Kelas Pilates - Oblix Pilates',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
                            <h1 style="color: #333; margin: 0;">🏋️‍♀️ Oblix Pilates</h1>
                        </div>
                        
                        <div style="padding: 30px; background-color: white;">
                            <h2 style="color: #333; margin-bottom: 20px;">Reminder Kelas Pilates</h2>
                            
                            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                                Halo <strong>${member.full_name}</strong>! 👋
                            </p>
                            
                            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                                Jangan lupa kelas pilates Anda besok:
                            </p>
                            
                            <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <h3 style="margin-top: 0; color: #2d5a2d;">📅 Detail Kelas:</h3>
                                <p><strong>Tanggal:</strong> ${formattedDate}</p>
                                <p><strong>Waktu:</strong> ${formattedTime}</p>
                                <p><strong>Kelas:</strong> ${classInfo.class_name}</p>
                                <p><strong>Trainer:</strong> ${trainer.title}</p>
                                <p><strong>Lokasi:</strong> Oblix Pilates</p>
                                <p><strong>Status:</strong> ${booking.status === 'signup' ? '✅ Terdaftar' : '⏳ Dalam Antrian'}</p>
                            </div>
                            
                            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                <h4 style="margin-top: 0; color: #856404;">💡 Tips:</h4>
                                <ul style="color: #856404; line-height: 1.6;">
                                    <li>Datang 10 menit sebelum kelas dimulai</li>
                                    <li>Bawa handuk dan air minum</li>
                                    <li>Gunakan pakaian yang nyaman</li>
                                </ul>
                            </div>
                            
                            <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                <p style="margin-bottom: 0; color: #721c24;">
                                    <strong>⚠️ Penting:</strong> Jika tidak bisa hadir, silakan cancel booking minimal 2 jam sebelum kelas dimulai.
                                </p>
                            </div>
                            
                            <p style="color: #666; line-height: 1.6;">
                                Terima kasih! 🙏
                            </p>
                        </div>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
                            <p style="color: #666; margin: 0; font-size: 14px;">
                                © 2024 Oblix Pilates. All rights reserved.
                            </p>
                        </div>
                    </div>
                `
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log('Booking reminder email sent successfully:', result.messageId);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error('Booking reminder email sending failed:', error);
            return { success: false, error: error.message };
        }
    }

    async sendLowSessionReminderEmail(reminderData) {
        try {
            const { member_name, email, package_name, package_details, remaining_sessions, end_date, days_remaining } = reminderData;

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Reminder: Sesi Paket Hampir Habis - Oblix Pilates',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
                            <h1 style="color: #333; margin: 0;">⚠️ Oblix Pilates</h1>
                        </div>
                        
                        <div style="padding: 30px; background-color: white;">
                            <h2 style="color: #333; margin-bottom: 20px;">Reminder: Sesi Paket Hampir Habis</h2>
                            
                            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                                Halo <strong>${member_name}</strong>,
                            </p>
                            
                            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                                Paket Anda hampir habis sesinya:
                            </p>
                            
                            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <h3 style="margin-top: 0; color: #856404;">📦 Detail Paket:</h3>
                                <p><strong>Paket:</strong> ${package_name}</p>
                                <p><strong>Detail:</strong> ${package_details}</p>
                                <p><strong>Sesi Tersisa:</strong> ${remaining_sessions} sesi</p>
                                <p><strong>Berakhir:</strong> ${end_date} (${days_remaining} hari lagi)</p>
                            </div>
                            
                            <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <h4 style="margin-top: 0; color: #2d5a2d;">💡 Saran:</h4>
                                <ul style="color: #2d5a2d; line-height: 1.6;">
                                    <li>Segera booking kelas untuk menggunakan sesi yang tersisa</li>
                                    <li>Pertimbangkan untuk membeli paket baru sebelum masa berlaku berakhir</li>
                                </ul>
                            </div>
                            
                            <p style="color: #666; line-height: 1.6;">
                                Untuk informasi lebih lanjut, silakan hubungi admin.
                            </p>
                            
                            <p style="color: #666; line-height: 1.6;">
                                Terima kasih,<br>
                                <strong>Oblix Pilates</strong>
                            </p>
                        </div>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
                            <p style="color: #666; margin: 0; font-size: 14px;">
                                © 2024 Oblix Pilates. All rights reserved.
                            </p>
                        </div>
                    </div>
                `
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log('Low session reminder email sent successfully:', result.messageId);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error('Low session reminder email sending failed:', error);
            return { success: false, error: error.message };
        }
    }

    async sendExpiryReminderEmail(reminderData) {
        try {
            const { member_name, email, package_name, package_details, remaining_sessions, end_date, days_remaining } = reminderData;

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Reminder: Paket Akan Berakhir - Oblix Pilates',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
                            <h1 style="color: #333; margin: 0;">⏰ Oblix Pilates</h1>
                        </div>
                        
                        <div style="padding: 30px; background-color: white;">
                            <h2 style="color: #333; margin-bottom: 20px;">Reminder: Paket Akan Berakhir</h2>
                            
                            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                                Halo <strong>${member_name}</strong>,
                            </p>
                            
                            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                                Paket Anda akan segera berakhir:
                            </p>
                            
                            <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <h3 style="margin-top: 0; color: #721c24;">📦 Detail Paket:</h3>
                                <p><strong>Paket:</strong> ${package_name}</p>
                                <p><strong>Detail:</strong> ${package_details}</p>
                                <p><strong>Sesi Tersisa:</strong> ${remaining_sessions} sesi</p>
                                <p><strong>Berakhir:</strong> ${end_date} (${days_remaining} hari lagi)</p>
                            </div>
                            
                            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <h4 style="margin-top: 0; color: #856404;">🚨 Penting:</h4>
                                <ul style="color: #856404; line-height: 1.6;">
                                    <li>Sesi yang tidak digunakan akan hangus setelah masa berlaku berakhir</li>
                                    <li>Segera gunakan sesi yang tersisa atau beli paket baru</li>
                                </ul>
                            </div>
                            
                            <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <h4 style="margin-top: 0; color: #2d5a2d;">💡 Saran:</h4>
                                <ul style="color: #2d5a2d; line-height: 1.6;">
                                    <li>Booking kelas segera untuk menggunakan sesi yang tersisa</li>
                                    <li>Pertimbangkan untuk membeli paket baru sebelum berakhir</li>
                                </ul>
                            </div>
                            
                            <p style="color: #666; line-height: 1.6;">
                                Untuk informasi lebih lanjut, silakan hubungi admin.
                            </p>
                            
                            <p style="color: #666; line-height: 1.6;">
                                Terima kasih,<br>
                                <strong>Oblix Pilates</strong>
                            </p>
                        </div>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
                            <p style="color: #666; margin: 0; font-size: 14px;">
                                © 2024 Oblix Pilates. All rights reserved.
                            </p>
                        </div>
                    </div>
                `
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log('Expiry reminder email sent successfully:', result.messageId);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error('Expiry reminder email sending failed:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new EmailService(); 