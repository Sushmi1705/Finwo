// src/app.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();

import categoryRoutes from './routes/categoryRoutes.js';
import shopRoutes from './routes/shopRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import amenityRoutes from './routes/amenityRoutes.js';
import menuRoutes from './routes/menuRoutes.js';
import compareRoutes from './routes/compareRoutes.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/categories', categoryRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/amenities', amenityRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/compare', compareRoutes);

// Test route
app.get("/", (req, res) => {
  res.send("✅ Customer App API running successfully!");
});

// Export the app instance correctly
export default app;
