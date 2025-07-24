const { Member, User } = require('../models');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const getProfile = async (req, res) => {
    try{
        const userId = req.user.id; // id ini adalah id user
        
        // Cari user berdasarkan id user
        const user = await User.findOne({ 
            where: { id: userId },
            include: [{
                model: Member,
    
            }]
        });
        console.log(user);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!user.Member) {
            return res.status(404).json({ message: 'Member profile not found' });
        }
        
        // Format response sesuai yang diminta
        const MemberData = {
            id: user.Member.id,
            member_code: user.Member.member_code,
            username: user.Member.username,
            full_name: user.Member.full_name,
            email: user.email, // Tambahkan email dari user
            phone_number: user.Member.phone_number,
            dob: user.Member.dob,
            address: user.Member.address,
            date_of_join: user.Member.date_of_join,
            picture: user.Member.picture,
            status: user.Member.status
        };

        res.status(200).json({
            success: true,
            message: 'Operation successful',
            data: MemberData
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            email,
            full_name,
            username,
            phone_number,
            dob,
            address
        } = req.body;

        // Cari user berdasarkan id user
        const user = await User.findOne({
            where: { id: userId },
            include: [{
                model: Member,
            }],
        });

        if (!user || !user.Member) {
            return res.status(404).json({ message: 'User or Member profile not found' });
        }

        // Update user jika ada email
        if (email) await user.update({ email });

        // Siapkan data untuk update Member
        const updateData = {};
        if (full_name) updateData.full_name = full_name;
        if (username) updateData.username = username;
        if (phone_number) updateData.phone_number = phone_number;
        if (dob) updateData.dob = dob;
        if (address) updateData.address = address;

        // Update picture jika ada file upload
        if (req.file) {
            // Hapus foto lama jika ada
            if (user.Member.picture) {
                const oldPhotoPath = path.join(__dirname, '../../uploads/profiles/', user.Member.picture);
                if (fs.existsSync(oldPhotoPath)) {
                    fs.unlinkSync(oldPhotoPath);
                }
            }
            updateData.picture = req.file.filename;
        }

        // Update Member
        await user.Member.update(updateData);
        const data = {
            ...updateData
        }

        res.status(200).json({ 
            message: 'Profile updated successfully',
            data: data
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ message: error.message });
    }
};

const changePassword = async (req, res) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        // Validasi input
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                message: 'Current password and new password are required'
            });
        }

        // Cari user
        const user = await User.findOne({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Verifikasi password lama
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({
                message: 'Current password is incorrect'
            });
        }

        // Hash password baru
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await user.update({ password: hashedNewPassword });

        res.status(200).json({
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ message: error.message });
    }
};

const deleteProfilePhoto = async (req, res) => {
    try {
        const userId = req.user.id;

        // Cari user dengan Member
        const user = await User.findOne({
            where: { id: userId },
            include: [{
                model: Member,
                
            }]
        });

        if (!user || !user.Member) {
            return res.status(404).json({ message: 'User or Member profile not found' });
        }

        // Hapus file foto jika ada
        if (user.Member.picture) {
            const photoPath = path.join(__dirname, '../../uploads/profiles/', user.Member.picture);
            if (fs.existsSync(photoPath)) {
                fs.unlinkSync(photoPath);
            }
        }

        // Update Member untuk hapus picture
        await user.Member.update({ picture: null });

        res.status(200).json({
            message: 'Profile photo deleted successfully'
        });

    } catch (error) {
        console.error('Delete profile photo error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getProfile,
    updateProfile,
    changePassword,
    deleteProfilePhoto
};

