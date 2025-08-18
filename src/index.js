const express = require('express');
const app = express();
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const PORT = process.env.PORT;
const authRoutes = require('./routes/auth.route');
const profileRoutes = require('./routes/profile.route');
const faqRoutes = require('./routes/faq.route');
const testimonialRoutes = require('./routes/testimonial.route');
const trainerRoutes = require('./routes/trainer.route');
const bannerRoutes = require('./routes/banner.route');
const galleryRoutes = require('./routes/gallery.route');
const blogRoutes = require('./routes/blog.route');
const membershipPackageRoutes = require('./routes/membershipPackage.route');
const trialPackageRoutes = require('./routes/trialPackage.route');
const promoPackageRoutes = require('./routes/promoPackage.route');
const bonusPackageRoutes = require('./routes/bonusPackage.route');
const categoryRoutes = require('./routes/category.route');
const classRoutes = require('./routes/class.route');
const staffRoutes = require('./routes/staff.route');
const orderRoutes = require('./routes/order.route');
const scheduleRoutes = require('./routes/schedule.route');
const bookingRoutes = require('./routes/booking.route');
const memberPackageRoutes = require('./routes/memberPackage.route');
const memberRoutes = require('./routes/member.route');
const checkClassRoutes = require('./routes/checkClass.route');
const testRoutes = require('./routes/test.route');
const reminderRoutes = require('./routes/reminder.route');
const myClassesRoutes = require('./routes/myclasses.route');
const dashboardRoutes = require('./routes/dashboard.route');
const reportRoutes = require('./routes/report.route');
const uploadRoutes = require('./routes/upload.route');
// Level routes removed - level is now enum field in schedule
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const swaggerDocument = YAML.load(path.join(__dirname,'../documentation.yaml'));
const { logger, errorLogger } = require('./middlewares/logger.middleware');
const { startAllCronJobs } = require('./cron/bookingCron');
const { startReminderCronJobs } = require('./cron/reminderCron');
const { startOrderExpiryCron } = require('./cron/orderCron');

// Middleware untuk logging semua request
app.use(logger);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  swaggerOptions: {
    cacheControl: false,
    persistAuthorization: false
  }
}));

app.use(express.json());
// app.use(cors({
//     origin: '*',
//     credentials: true,
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//     allowedHeaders: ['Content-Type', 'Authorization'],
// }));
app.use(cors({
  origin: [
    'https://oblix-pilates.vercel.app',
    'http://localhost:5173', // untuk development
    'https://oblixpilates.id',
    'https://www.oblixpilates.id'
  ],
  credentials: true
}));
// Serve static files dari folder uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/faq', faqRoutes);
app.use('/api/testimonial', testimonialRoutes);
app.use('/api/trainer', trainerRoutes);
app.use('/api/banner', bannerRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/membership-package', membershipPackageRoutes);
app.use('/api/trial-package', trialPackageRoutes);
app.use('/api/promo-package', promoPackageRoutes);
app.use('/api/bonus-package', bonusPackageRoutes);
app.use('/api/category', categoryRoutes);
app.use('/api/class', classRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/booking', bookingRoutes);
app.use('/api/member-package', memberPackageRoutes);
app.use('/api/member', memberRoutes);
app.use('/api/check-class', checkClassRoutes);
app.use('/api/test', testRoutes);
app.use('/api/reminder', reminderRoutes);
app.use('/api/my-classes', myClassesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/upload', uploadRoutes);
// app.use('/api/level', levelRoutes); // Removed - level is now enum field
app.get('/', (req, res) => {
  res.send('Hello World');
});

// Health check endpoint for Docker
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Error handling middleware
app.use(errorLogger);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API Documentation: http://localhost:${PORT}/api-docs`);
  console.log(`Logs will be saved to: logs/api-${new Date().toISOString().split('T')[0]}.log`);
  
  // Start cron jobs
  startAllCronJobs();
  startReminderCronJobs();
  startOrderExpiryCron();
});