import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import leaderboardRoutes from './routes/leaderboard.js';
import runsRoutes from './routes/runs.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
// Netlify Functions run on /.netlify/functions/api, but we can rewrite to /api
// We should mount routes to handle both cases or ensure the prefix matches.
// For Netlify, the function handles the request, and the path might include /api
const router = express.Router();

router.use('/auth', authRoutes);
router.use('/leaderboard', leaderboardRoutes);
router.use('/runs', runsRoutes);

app.use('/api', router);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

export default app;
