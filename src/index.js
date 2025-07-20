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
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const swaggerDocument = YAML.load(path.join(__dirname,'../documentation.yaml'));
const { logger, errorLogger } = require('./middlewares/logger.middleware');

// Middleware untuk logging semua request
app.use(logger);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  swaggerOptions: {
    cacheControl: false,
    persistAuthorization: false
  }
}));

app.use(express.json());
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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

app.get('/', (req, res) => {
  res.send('Hello World');
});

// Error handling middleware (harus di akhir)
app.use(errorLogger);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API Documentation: http://localhost:${PORT}/api-docs`);
  console.log(`Logs will be saved to: logs/api-${new Date().toISOString().split('T')[0]}.log`);
});