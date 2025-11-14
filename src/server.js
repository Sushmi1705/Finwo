import express from 'express';
import categoryRoutes from './routes/categoryRoutes.js';
import shopRoutes from './routes/shopRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { authenticate } from './middleware/authenticate.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

// Apply authenticate middleware to all routes below
app.use(authenticate);

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/shops', shopRoutes);

app.get('/', (req, res) => {
  res.send('Server is running successfully!');
});

app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});