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
                as: 'member'
            }]
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!user.member) {
            return res.status(404).json({ message: 'Member profile not found' });
        }
        

        // const userData = user.get({ plain: true });
        // const { member: memberData, ...userFields } = userData;
        
        // // Hapus user_id dari memberData
        // const { user_id: memberUserId, ...memberFields } = memberData;
        
        // const data = {
        //     ...userFields, // Semua field user kecuali Member
        //     member: {
        //         ...memberFields // Semua field dari Member kecuali user_id
        //     }
        // };
      
    
        res.status(200).json({
            message: 'User profile fetched successfully',
            data: user
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
                as: 'member'
            }],
        });

        if (!user || !user.member) {
            return res.status(404).json({ message: 'User or member profile not found' });
        }

        // Update user jika ada email
        if (email) await user.update({ email });

        // Siapkan data untuk update member
        const updateData = {};
        if (full_name) updateData.full_name = full_name;
        if (username) updateData.username = username;
        if (phone_number) updateData.phone_number = phone_number;
        if (dob) updateData.dob = dob;
        if (address) updateData.address = address;

        // Update profile picture jika ada file upload
        if (req.file) {
            // Hapus foto lama jika ada
            if (user.member.profile_picture) {
                const oldPhotoPath = path.join(__dirname, '../../uploads/profiles/', user.member.profile_picture);
                if (fs.existsSync(oldPhotoPath)) {
                    fs.unlinkSync(oldPhotoPath);
                }
            }
            updateData.profile_picture = req.file.filename;
        }

        // Update member
        await user.member.update(updateData);
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

        // Cari user dengan member
        const user = await User.findOne({
            where: { id: userId },
            include: [{
                model: Member,
                as: 'member'
            }]
        });

        if (!user || !user.member) {
            return res.status(404).json({ message: 'User or member profile not found' });
        }

        // Hapus file foto jika ada
        if (user.member.profile_picture) {
            const photoPath = path.join(__dirname, '../../uploads/profiles/', user.member.profile_picture);
            if (fs.existsSync(photoPath)) {
                fs.unlinkSync(photoPath);
            }
        }

        // Update member untuk hapus profile_picture
        await user.member.update({ profile_picture: null });

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

