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
                                <a href="${resetUrl}/reset-password?token=${resetToken}" 
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
                                ${resetUrl}/reset-password?token=${resetToken}
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

    async sendLoginInfoEmail(email, fullName, phoneNumber) {
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

    async sendBookingConfirmationEmail(booking) {
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

            // Check if email is available
            const memberEmail = member.User?.email || member.email;
            if (!memberEmail) {
                console.log('No email available for member:', member.full_name);
                return { success: false, error: 'No email available for member' };
            }

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: memberEmail,
                subject: 'Booking Berhasil - Oblix Pilates',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
                            <h1 style="color: #333; margin: 0;">Oblix Pilates</h1>
                        </div>
                        
                        <div style="padding: 30px; background-color: white;">
                            <h2 style="color: #333; margin-bottom: 20px;">Booking Berhasil</h2>
                            
                            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                                Halo <strong>${member.full_name}</strong>,
                            </p>
                            
                            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                                Booking kelas pilates Anda berhasil dibuat:
                            </p>
                            
                            <div style="background-color: #e8f5e8; padding: 20px; border-radius: 5px; margin: 20px 0;">
                                <h3 style="color: #2d5a2d; margin-top: 0;">Detail Booking:</h3>
                                <p><strong>Tanggal:</strong> ${formattedDate}</p>
                                <p><strong>Waktu:</strong> ${formattedTime}</p>
                                <p><strong>Kelas:</strong> ${classInfo.class_name}</p>
                                <p><strong>Trainer:</strong> ${trainer.title}</p>
                                <p><strong>Status:</strong> ${booking.status === 'signup' ? 'Terdaftar' : 'Dalam Antrian'}</p>
                            </div>
                            
                            ${booking.status === 'waiting_list' ? `
                            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                <p style="color: #856404; line-height: 1.6; margin: 0;">
                                    <strong>Catatan:</strong> Anda masuk dalam antrian. Kami akan memberitahu jika ada slot kosong.
                                </p>
                            </div>
                            ` : ''}
                            
                            <p style="color: #666; line-height: 1.6;">
                                Kami akan mengirimkan reminder H-1 sebelum kelas dimulai. Jangan lupa datang 10 menit sebelum kelas dimulai.
                            </p>
                            
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
            console.log('Booking confirmation email sent successfully:', result.messageId);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error('Booking confirmation email sending failed:', error);
            return { success: false, error: error.message };
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

            // Check if email is available
            const memberEmail = member.User?.email || member.email;
            if (!memberEmail) {
                console.log('No email available for member:', member.full_name);
                return { success: false, error: 'No email available for member' };
            }

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: memberEmail,
                subject: 'Reminder Kelas Pilates - Oblix Pilates',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
                            <h1 style="color: #333; margin: 0;">Oblix Pilates</h1>
                        </div>
                        
                        <div style="padding: 30px; background-color: white;">
                            <h2 style="color: #333; margin-bottom: 20px;">Reminder Kelas Pilates</h2>
                            
                            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                                Halo <strong>${member.full_name}</strong>,
                            </p>
                            
                            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                                Jangan lupa kelas pilates Anda besok:
                            </p>
                            
                            <div style="background-color: #e8f5e8; padding: 20px; border-radius: 5px; margin: 20px 0;">
                                <h3 style="color: #2d5a2d; margin-top: 0;">Detail Kelas:</h3>
                                <p><strong>Tanggal:</strong> ${formattedDate}</p>
                                <p><strong>Waktu:</strong> ${formattedTime}</p>
                                <p><strong>Kelas:</strong> ${classInfo.class_name}</p>
                                <p><strong>Trainer:</strong> ${trainer.title}</p>
                                <p><strong>Status:</strong> ${booking.status === 'signup' ? 'Terdaftar' : 'Dalam Antrian'}</p>
                            </div>
                            
                            <p style="color: #666; line-height: 1.6;">
                                Jangan lupa datang 10 menit sebelum kelas dimulai. Bawa handuk dan air minum, serta gunakan pakaian yang nyaman.
                            </p>
                            
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

            // Check if email is available
            if (!email) {
                console.log('No email available for member:', member_name);
                return { success: false, error: 'No email available for member' };
            }

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Reminder: Sesi Paket Hampir Habis - Oblix Pilates',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
                            <h1 style="color: #333; margin: 0;">Oblix Pilates</h1>
                        </div>
                        
                        <div style="padding: 30px; background-color: white;">
                            <h2 style="color: #333; margin-bottom: 20px;">Reminder: Sesi Paket Hampir Habis</h2>
                            
                            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                                Halo <strong>${member_name}</strong>,
                            </p>
                            
                            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                                Paket Anda hampir habis sesinya:
                            </p>
                            
                            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                                <h3 style="color: #555; margin-top: 0;">Detail Paket:</h3>
                                <p><strong>Paket:</strong> ${package_name}</p>
                                <p><strong>Detail:</strong> ${package_details}</p>
                                <p><strong>Sesi Tersisa:</strong> ${remaining_sessions} sesi</p>
                                <p><strong>Berakhir:</strong> ${end_date} (${days_remaining} hari lagi)</p>
                            </div>
                            
                            <p style="color: #666; line-height: 1.6;">
                                Segera booking kelas untuk menggunakan sesi yang tersisa. Pertimbangkan untuk membeli paket baru sebelum masa berlaku berakhir.
                            </p>
                            
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
            console.log('Low session reminder email sent successfully:', result.messageId);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error('Low session reminder email sending failed:', error);
            return { success: false, error: error.message };
        }
    }

    async sendWaitlistPromotionEmail(booking) {
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

            // Check if email is available
            const memberEmail = member.User?.email || member.email;
            if (!memberEmail) {
                console.log('No email available for member:', member.full_name);
                return { success: false, error: 'No email available for member' };
            }

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: memberEmail,
                subject: 'Selamat! Anda Masuk Kelas - Oblix Pilates',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
                            <h1 style="color: #333; margin: 0;">Oblix Pilates</h1>
                        </div>
                        
                        <div style="padding: 30px; background-color: white;">
                            <h2 style="color: #333; margin-bottom: 20px;">Selamat! Anda Masuk Kelas</h2>
                            
                            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                                Halo <strong>${member.full_name}</strong>,
                            </p>
                            
                            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                                Selamat! Booking Anda telah dipromosikan dari antrian ke kelas:
                            </p>
                            
                            <div style="background-color: #e8f5e8; padding: 20px; border-radius: 5px; margin: 20px 0;">
                                <h3 style="color: #2d5a2d; margin-top: 0;">Detail Kelas:</h3>
                                <p><strong>Tanggal:</strong> ${formattedDate}</p>
                                <p><strong>Waktu:</strong> ${formattedTime}</p>
                                <p><strong>Kelas:</strong> ${classInfo.class_name}</p>
                                <p><strong>Trainer:</strong> ${trainer.title}</p>
                                <p><strong>Status:</strong> Terdaftar</p>
                            </div>
                            
                            <p style="color: #666; line-height: 1.6;">
                                Anda sekarang terdaftar untuk kelas ini. Jangan lupa datang tepat waktu dan kami akan mengirimkan reminder H-1 sebelum kelas dimulai.
                            </p>
                            
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
            console.log('Waitlist promotion email sent successfully:', result.messageId);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error('Waitlist promotion email sending failed:', error);
            return { success: false, error: error.message };
        }
    }

    async sendAdminCancellationEmail(memberName, email, className, date, time, reason) {
        try {
            // Check if email is available
            if (!email) {
                console.log('No email available for member:', memberName);
                return { success: false, error: 'No email available for member' };
            }

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Kelas Dibatalkan oleh Admin - Oblix Pilates',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
                            <h1 style="color: #333; margin: 0;">Oblix Pilates</h1>
                        </div>
                        
                        <div style="padding: 30px; background-color: white;">
                            <h2 style="color: #333; margin-bottom: 20px;">Kelas Dibatalkan</h2>
                            
                            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                                Halo <strong>${memberName}</strong>,
                            </p>
                            
                            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                                Kelas Anda telah dibatalkan oleh admin:
                            </p>
                            
                            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                                <h3 style="color: #555; margin-top: 0;">Detail Kelas:</h3>
                                <p><strong>Kelas:</strong> ${className}</p>
                                <p><strong>Tanggal:</strong> ${date}</p>
                                <p><strong>Waktu:</strong> ${time}</p>
                                <p><strong>Alasan:</strong> ${reason}</p>
                            </div>
                            
                            <p style="color: #666; line-height: 1.6;">
                                Session Anda telah dikembalikan ke paket. Anda dapat booking ulang kelas lain yang tersedia.
                            </p>
                            
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
            console.log('Admin cancellation email sent successfully:', result.messageId);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error('Admin cancellation email sending failed:', error);
            return { success: false, error: error.message };
        }
    }

    async sendBookingCancellationEmail(booking, reason = 'Booking dibatalkan') {
        try {
            const member = booking.Member;
            const schedule = booking.Schedule;
            const classInfo = schedule.Class;

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

            // Check if email is available
            const memberEmail = member.User?.email || member.email;
            if (!memberEmail) {
                console.log('No email available for member:', member.full_name);
                return { success: false, error: 'No email available for member' };
            }

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: memberEmail,
                subject: 'Booking Dibatalkan - Oblix Pilates',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
                            <h1 style="color: #333; margin: 0;">Oblix Pilates</h1>
                        </div>
                        
                        <div style="padding: 30px; background-color: white;">
                            <h2 style="color: #333; margin-bottom: 20px;">Booking Dibatalkan</h2>
                            
                            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                                Halo <strong>${member.full_name}</strong>,
                            </p>
                            
                            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                                Booking kelas pilates Anda telah dibatalkan:
                            </p>
                            
                            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                                <h3 style="color: #555; margin-top: 0;">Detail Booking:</h3>
                                <p><strong>Tanggal:</strong> ${formattedDate}</p>
                                <p><strong>Waktu:</strong> ${formattedTime}</p>
                                <p><strong>Kelas:</strong> ${classInfo.class_name}</p>
                                <p><strong>Alasan:</strong> ${reason}</p>
                            </div>
                            
                            <p style="color: #666; line-height: 1.6;">
                                Session Anda telah dikembalikan ke paket. Anda dapat booking ulang kelas lain yang tersedia.
                            </p>
                            
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
            console.log('Booking cancellation email sent successfully:', result.messageId);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error('Booking cancellation email sending failed:', error);
            return { success: false, error: error.message };
        }
    }

    async sendExpiryReminderEmail(reminderData) {
        try {
            const { member_name, email, package_name, package_details, remaining_sessions, end_date, days_remaining } = reminderData;

            // Check if email is available
            if (!email) {
                console.log('No email available for member:', member_name);
                return { success: false, error: 'No email available for member' };
            }

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Reminder: Paket Akan Berakhir - Oblix Pilates',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
                            <h1 style="color: #333; margin: 0;">Oblix Pilates</h1>
                        </div>
                        
                        <div style="padding: 30px; background-color: white;">
                            <h2 style="color: #333; margin-bottom: 20px;">Reminder: Paket Akan Berakhir</h2>
                            
                            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                                Halo <strong>${member_name}</strong>,
                            </p>
                            
                            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                                Paket Anda akan segera berakhir:
                            </p>
                            
                            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                                <h3 style="color: #555; margin-top: 0;">Detail Paket:</h3>
                                <p><strong>Paket:</strong> ${package_name}</p>
                                <p><strong>Detail:</strong> ${package_details}</p>
                                <p><strong>Sesi Tersisa:</strong> ${remaining_sessions} sesi</p>
                                <p><strong>Berakhir:</strong> ${end_date} (${days_remaining} hari lagi)</p>
                            </div>
                            
                            <p style="color: #666; line-height: 1.6;">
                                Sesi yang tidak digunakan akan hangus setelah masa berlaku berakhir. Segera booking kelas untuk menggunakan sesi yang tersisa atau pertimbangkan untuk membeli paket baru sebelum berakhir.
                            </p>
                            
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
            console.log('Expiry reminder email sent successfully:', result.messageId);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error('Expiry reminder email sending failed:', error);
            return { success: false, error: error.message };
        }
    }

    async sendClassCancellationEmail(bookings, schedule) {
        try {
            console.log('📧 sendClassCancellationEmail called with:', {
                bookingsCount: bookings.length,
                scheduleId: schedule.id,
                scheduleDate: schedule.date_start,
                scheduleTime: schedule.time_start,
                hasClass: !!schedule.Class,
                className: schedule.Class?.class_name
            });
            
            const classInfo = schedule.Class;
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

            const results = [];

            for (const booking of bookings) {
                const member = booking.Member;
                
                console.log('📧 Processing member:', {
                    memberId: member.id,
                    memberName: member.full_name,
                    hasUser: !!member.User,
                    userEmail: member.User?.email,
                    memberEmail: member.email
                });
                
                // Check if email is available
                const memberEmail = member.User?.email || member.email;
                if (!memberEmail) {
                    console.log('No email available for member:', member.full_name);
                    results.push({
                        member_id: member.id,
                        member_name: member.full_name,
                        success: false,
                        error: 'No email available for member'
                    });
                    continue;
                }

                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: memberEmail,
                    subject: 'Kelas Dibatalkan - Oblix Pilates',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
                                <h1 style="color: #333; margin: 0;">Oblix Pilates</h1>
                            </div>
                            
                            <div style="padding: 30px; background-color: white;">
                                <h2 style="color: #333; margin-bottom: 20px;">Kelas Dibatalkan</h2>
                                
                                <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                                    Halo <strong>${member.full_name}</strong>,
                                </p>
                                
                                <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                                    Kelas pilates berikut telah dibatalkan karena tidak memenuhi minimum peserta:
                                </p>
                                
                                <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                                    <h3 style="color: #555; margin-top: 0;">Detail Kelas:</h3>
                                    <p><strong>Tanggal:</strong> ${formattedDate}</p>
                                    <p><strong>Waktu:</strong> ${formattedTime}</p>
                                    <p><strong>Kelas:</strong> ${classInfo.class_name}</p>
                                    <p><strong>Alasan:</strong> Tidak memenuhi minimum peserta</p>
                                </div>
                                
                                <p style="color: #666; line-height: 1.6;">
                                    Booking Anda telah dibatalkan secara otomatis. Session Anda telah dikembalikan ke paket.
                                </p>
                                
                                <p style="color: #666; line-height: 1.6;">
                                    Silakan booking kelas lain yang tersedia. Jika ada pertanyaan, jangan ragu untuk menghubungi tim support kami.
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

                try {
                    const result = await this.transporter.sendMail(mailOptions);
                    results.push({
                        member_id: member.id,
                        member_name: member.full_name,
                        success: true,
                        messageId: result.messageId
                    });
                } catch (error) {
                    console.error(`Failed to send class cancellation email to ${member.full_name}:`, error);
                    results.push({
                        member_id: member.id,
                        member_name: member.full_name,
                        success: false,
                        error: error.message
                    });
                }
            }

            return results;
        } catch (error) {
            console.error('Error sending class cancellation emails:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send updated login info email when phone number is corrected
     */
    async sendUpdatedLoginInfoEmail(email, fullName, phoneNumber) {
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
                subject: 'Perbaruan Informasi Login - Oblix Pilates',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
                            <h1 style="color: #333; margin: 0;">Oblix Pilates</h1>
                        </div>
                        
                        <div style="padding: 30px; background-color: white;">
                            <h2 style="color: #333; margin-bottom: 20px;">Perbaruan Informasi Login Akun Anda</h2>
                            
                            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                                Halo <strong>${fullName}</strong>,
                            </p>
                            
                            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                                Kami telah memperbarui informasi nomor HP Anda di sistem. Akibatnya, password login Anda juga telah diperbarui sesuai dengan nomor HP yang baru. Berikut adalah informasi login terbaru Anda:
                            </p>
                            
                            <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
                                <h3 style="margin-top: 0; color: #155724;">📱 Informasi Login Terbaru:</h3>
                                <p><strong>Email:</strong> ${email}</p>
                                <p><strong>Password Baru:</strong> ${displayPassword}</p>
                            
                                <p style="color: #155724; font-size: 14px; margin-top: 15px; background-color: #d4edda; padding: 10px; border-radius: 4px;">
                                    <strong>📝 Catatan:</strong> Password baru menggunakan format nomor HP yang telah diperbarui dengan +62 tanpa strip (contoh: +6281234567890)
                                </p>
                            </div>
                            
                            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                <h4 style="margin-top: 0; color: #856404;">🔐 Perubahan Keamanan</h4>
                                <p style="margin-bottom: 0;">Password Anda telah diperbarui secara otomatis sesuai dengan nomor HP yang baru. <strong>Segera login dan ganti password</strong> sesuai keinginan Anda untuk keamanan yang lebih baik.</p>
                            </div>
                            
                            <p style="color: #666; line-height: 1.6;">
                                Silakan gunakan email dan password baru di atas untuk login ke aplikasi Oblix Pilates.
                            </p>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="https://oblixpilates.id/login" 
                                   style="background-color: #007bff; color: white; padding: 12px 30px; 
                                          text-decoration: none; border-radius: 5px; display: inline-block;
                                          font-weight: bold;">
                                    Login ke Oblix Pilates
                                </a>
                            </div>
                            
                            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                <h4 style="margin-top: 0; color: #495057;">📞 Bantuan</h4>
                                <p style="margin-bottom: 0; color: #6c757d;">
                                    Jika Anda mengalami kesulitan saat login atau memiliki pertanyaan lainnya, jangan ragu untuk menghubungi tim support kami.
                                </p>
                            </div>
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
            console.log('Updated login info email sent successfully:', result.messageId);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error('Updated login info email sending failed:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new EmailService(); 