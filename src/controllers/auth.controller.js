const { User, Member, MemberPackage, Package } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const emailService = require('../services/email.service');
require('dotenv').config();

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
            status: 'Registered'
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
        const user = await User.findOne({ 
            where: { email },
            include: [
                {
                    model: Member,
                    include: [
                        {
                            model: MemberPackage,
                            include: [
                                {
                                    model: Package
                                }
                            ]
                        }
                    ]
                }
            ]
        });
        
        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }
        
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Invalid password' });
        }
        
        // Use environment variable for JWT expiry, default to 24h for development
        const jwtExpiry = process.env.JWT_EXPIRY || '24h';
        const refreshExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
        
        const accessToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: jwtExpiry });
        const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: refreshExpiry });
        await user.update({ refresh_token: refreshToken });
        
        // Cek status pembelian paket member
        let hasPurchasedPackage = false;
        
        if (user.Member && user.Member.MemberPackages) {
            hasPurchasedPackage = user.Member.MemberPackages.length > 0;
        }
        
        const userData = {
            id: user.id,
            email: user.email,
            role: user.role,
            has_purchased_package: hasPurchasedPackage
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
    // if (!user.isActive) {
    //     return res.status(400).json({ message: 'User is not active' });
    // }
    
    // Use environment variable for JWT expiry, default to 24h for development
    const jwtExpiry = process.env.JWT_EXPIRY || '24h';
    const accessToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: jwtExpiry });
    
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
        const resetUrl = process.env.FRONTEND_URL;
        
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

const checkPurchaseStatus = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findByPk(userId, {
            include: [
                {
                    model: Member,
                    include: [
                        {
                            model: MemberPackage,
                            include: [
                                {
                                    model: Package
                                }
                            ]
                        }
                    ]
                }
            ]
        });

        if (!user) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        let hasPurchasedPackage = false;
        if (user.Member && user.Member.MemberPackages) {
            hasPurchasedPackage = user.Member.MemberPackages.length > 0;
        }

        res.status(200).json({
            message: 'Purchase status retrieved successfully',
            data: {
                has_purchased_package: hasPurchasedPackage
            }
        });
    } catch (error) {
        console.error('Check purchase status error:', error);
        res.status(500).json({
            message: 'Internal server error'
        });
    }
};

// Check token status
const checkTokenStatus = async (req, res) => {
    try {
        // If middleware reaches here, token is valid
        const user = req.user;
        
        res.status(200).json({
            message: 'Token is valid',
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    member_id: user.member_id
                },
                token_status: 'valid'
            }
        });
    } catch (error) {
        console.error('Check token status error:', error);
        res.status(500).json({
            message: 'Internal server error'
        });
    }
};

module.exports = {
    register,
    login,
    refreshToken,
    forgotPassword,
    changePassword,
    resetPassword,
    checkPurchaseStatus,
    checkTokenStatus
};