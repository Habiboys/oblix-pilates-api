const jwt = require('jsonwebtoken');
const { User, Member } = require('../models');
require('dotenv').config('../../.env');

// Middleware untuk validasi token
const validateToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Token tidak ditemukan'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id, {
      include: [{ model: Member }]
    });

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'User tidak ditemukan'
      });
    }

    // if (!user.isActive) {
    //   return res.status(401).json({
    //     status: 'error',
    //     message: 'User tidak aktif'
    //   });
    // }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      member_id: user.Member ? user.Member.id : null
    };
    console.log(req.user);
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        status: 'error',
        message: 'Token tidak valid'
      });
    }
    return res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan pada server'
    });
  }
};

// Middleware untuk pengecekan role
const checkRole = (roleName) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(403).json({
          status: 'error',
          message: 'Akses ditolak: User tidak terautentikasi'
        });
      }

      // Bandingkan role
      if (req.user.role !== roleName) {
        return res.status(403).json({
          status: 'error',
          message: `Akses ditolak: Role yang dibutuhkan adalah ${roleName}`
        });
      }

      next();
    } catch (error) {
      console.error('Error in checkRole middleware:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Terjadi kesalahan pada server'
      });
    }
  };
};

module.exports = {
  validateToken,
  checkRole
}; 