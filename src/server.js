import express from 'express';
import categoryRoutes from './routes/categoryRoutes.js';
import shopRoutes from './routes/shopRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { authenticate } from './middleware/authenticate.js';
import searchRoutes from './routes/searchRoutes.js';
import suggestionRoutes from './routes/suggestionRoutes.js';
import addressRoutes from './routes/addressRoutes.js';
import compareRoutes from './routes/compareRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import settingRoutes from './routes/settingsRoutes.js';
import trnsactionRoutes from './routes/transactionRoutes.js';
import bannerRoutes from './routes/bannerRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import placesRoutes from './routes/placesRoutes.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

// Public routes (no token required)
app.use('/api/auth', authRoutes);

// For all routes below, run authenticate EXCEPT /api/auth
// app.use((req, res, next) => {
//   if (req.path.startsWith('/api/auth')) {
//     // skip authentication for auth routes
//     return next();
//   }
//   return authenticate(req, res, next);
// });

// Protected routes
app.use('/api/search', searchRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/suggestions', suggestionRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/compare', compareRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/transactions', trnsactionRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/places', placesRoutes);

app.get('/', (req, res) => {
  res.send('Server is running successfully!');
});

app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});