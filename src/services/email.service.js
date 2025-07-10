const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransporter({
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
}

module.exports = new EmailService(); 