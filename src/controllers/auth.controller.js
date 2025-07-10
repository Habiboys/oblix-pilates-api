const { User, Member } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const emailService = require('../services/email.service');
require('dotenv').config('../../.env');

const register = async (req, res) => {
    try {
        const { full_name, username, email, dob, phone_number, password } = req.body;

        // Validasi input
        if (!full_name || !username || !email || !dob || !phone_number || !password) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }

        // Cek apakah email sudah terdaftar
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({
                message: "Email already registered"
            });
        }

        // Cek apakah username sudah digunakan
        const existingMember = await Member.findOne({ where: { username } });
        if (existingMember) {
            return res.status(400).json({
                message: "Username already taken"
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Buat user baru
        const user = await User.create({
            email: email,
            password: hashedPassword,
            role: 'user',
            refresh_token: null
        });

        // Generate member code
        const memberCode = `MBR${Date.now()}`;

        // Buat member baru
        await Member.create({
            user_id: user.id,
            member_code: memberCode,
            username: username,
            full_name: full_name,
            phone_number: phone_number,
            dob: dob,
            address: '',
            date_of_join: new Date(),
            status: 'active'
        });

        // Kirim welcome email
        await emailService.sendWelcomeEmail(email, username);

        res.status(201).json({
            message: "Registration successful",
            data: {
                user_id: user.id,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            message: "Internal server error"
        });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }
        if (!user.isActive) {
            return res.status(400).json({ message: 'User is not active' });
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Invalid password' });
        }
        const accessToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
        await user.update({ refresh_token: refreshToken });
        
        const userData = {
            id: user.id,
            email: user.email,
            role: user.role,
        }

        res.status(200).json({
             message: 'Login successful',
             data: {
                user: userData,
                accessToken: accessToken,
                refreshToken: refreshToken,
             }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: error.message });
    }
};

const refreshToken = async (req, res) => {
try {
    const { refreshToken } = req.body;
    const user = await User.findOne({ where: { refresh_token: refreshToken } });
    if (!user) {
        return res.status(400).json({ message: 'User not found' });
    }
    if (!user.isActive) {
        return res.status(400).json({ message: 'User is not active' });
    }
    const accessToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.status(200).json({
        message: 'Token refreshed successfully',
        data: {
            accessToken: accessToken,
        }
    });
} catch (error) {
    res.status(500).json({ message: error.message });
}
};

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        // Validasi email
        if (!email) {
            return res.status(400).json({
                message: "Email is required"
            });
        }

        // Cari user berdasarkan email
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(404).json({
                message: "Email not found"
            });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 jam

        // Update user dengan reset token
        await user.update({
            reset_token: resetToken,
            reset_token_expiry: resetTokenExpiry
        });

        // Reset URL (sesuaikan dengan frontend URL)
        const resetUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        
        // Kirim email reset password
        const emailSent = await emailService.sendResetPasswordEmail(email, resetToken, resetUrl);
        
        if (!emailSent) {
            return res.status(500).json({
                message: "Failed to send reset email"
            });
        }

        res.status(200).json({
            message: "Password reset link sent to your email"
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            message: "Internal server error"
        });
    }
};


const changePassword = async (req, res) => {
    const { id } = req.params;
    const { old_password, new_password, confirm_password } = req.body;
    try{
        const member = await Member.findOne({ where: { id } });
        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }
        const user = await User.findOne({ where: { id: member.user_id } });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (old_password === new_password) {
            return res.status(400).json({ message: 'New password cannot be the same as old password' });
        }
        if (new_password !== confirm_password) {
            return res.status(400).json({ message: 'New password and confirm password do not match' });
        }
        const isPasswordCorrect = await bcrypt.compare(old_password, user.password);
        if (!isPasswordCorrect) {
            return res.status(400).json({ message: 'Old password is incorrect' });
        }
        user.password = new_password;
        await user.save();
        res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        // Validasi input
        if (!token || !newPassword) {
            return res.status(400).json({
                message: "Token and new password are required"
            });
        }

        // Cari user berdasarkan reset token
        const user = await User.findOne({ 
            where: { 
                reset_token: token,
                reset_token_expiry: {
                    [require('sequelize').Op.gt]: new Date()
                }
            }
        });

        if (!user) {
            return res.status(400).json({
                message: "Invalid or expired reset token"
            });
        }

        // Hash password baru
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password dan hapus reset token
        await user.update({
            password: hashedPassword,
            reset_token: null,
            reset_token_expiry: null
        });

        res.status(200).json({
            message: "Password reset successful"
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            message: "Internal server error"
        });
    }
};

module.exports = {
    register,
    login,
    refreshToken,
    changePassword,
    forgotPassword,
    resetPassword
};