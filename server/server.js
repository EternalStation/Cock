import app from './app.js';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`🚀 Neon Survivor API running on port ${PORT}`);
    console.log(`📊 Leaderboard: http://localhost:${PORT}/api/leaderboard`);
});
