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
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const swaggerDocument = YAML.load(path.join(__dirname,'../documentation.yaml'));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

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

app.get('/', (req, res) => {
  res.send('Hello World');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});