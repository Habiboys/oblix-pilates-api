const express = require('express');
const app = express();
const cors = require('cors');
const PORT = process.env.PORT || 3000;
const authRoutes = require('./routes/auth.route');

app.use(express.json());
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
  res.send('Hello World');
});


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});