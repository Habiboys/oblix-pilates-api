const { User } = require('../models');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config('../../.env');

const register = async (req, res) => {
try {
    const { email, password, confirmPassword, role } = req.body;
    //required email, password, confirmPassword, role
    if (!email || !password || !confirmPassword) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
    }
    if (password !== confirmPassword) {
        return res.status(400).json({ message: 'Password and confirm password do not match' });
    }
 
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ 
        email, 
        password: hashedPassword, 
        role: "user",
        isActive: true 
    });

    res.status(201).json({
        message: 'User created successfully',
        user: {
            id: user.id,
            email: user.email,
            role: user.role
        }
    });
} catch (error) {
    res.status(500).json({ message: error.message });
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

module.exports = {
    register,
    login,
    refreshToken,
};