# Leaderboard System Setup Guide

This guide will walk you through setting up the complete leaderboard system for Neon Survivor.

## Overview

The leaderboard system consists of:
- **Backend Server** (Node.js + Express) - Handles authentication and data storage
- **Neon Database** (PostgreSQL) - Stores player accounts and game runs
- **Frontend Integration** - Login screen, leaderboard display, and run submission

## Step 1: Set Up Neon Database

### 1.1 Create Neon Account
1. Go to [https://console.neon.tech](https://console.neon.tech)
2. Sign up for a free account (no credit card required)
3. Create a new project (name it "neon-survivor" or whatever you like)

### 1.2 Get Connection String
1. In your Neon dashboard, click on your project
2. Go to the "Connection Details" section
3. Copy the connection string - it looks like:
   ```
   postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```

## Step 2: Configure Backend Server

### 2.1 Navigate to Server Directory
```bash
cd server
```

### 2.2 Install Dependencies
```bash
npm install
```

### 2.3 Create Environment File
```bash
cp .env.example .env
```

### 2.4 Edit .env File
Open `server/.env` and add your configuration:

```env
DATABASE_URL=your-neon-connection-string-here
JWT_SECRET=your-generated-secret-here
PORT=3001
CURRENT_PATCH=1.0.0
```

**To generate a secure JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2.5 Initialize Database
This creates all necessary tables:
```bash
npm run init-db
```

You should see:
```
✅ Players table created
✅ Game runs table created
✅ Indexes created
🎉 Database initialization complete!
```

### 2.6 Start Backend Server
```bash
npm run dev
```

The server will run on `http://localhost:3001`

Keep this terminal open!

## Step 3: Configure Frontend

### 3.1 Navigate Back to Game Directory
Open a new terminal:
```bash
cd ..
```

### 3.2 Create Environment File
```bash
cp .env.example .env
```

### 3.3 Edit .env File
Open `.env` and verify:
```env
VITE_API_URL=http://localhost:3001/api
```

## Step 4: Test the System

### 4.1 Start the Game
In the game directory:
```bash
npm run dev
```

### 4.2 Test Authentication
1. The game should show a login screen on startup
2. Click "Register" and create an account
3. Try logging in with your credentials

### 4.3 Play a Game
1. Select a class and play
2. When you die, the run should automatically submit to the leaderboard
3. Check the leaderboard to see your run

## Integration Points

### Where to Add Components

#### 1. App.tsx - Add Auth Flow
You need to integrate the `AuthScreen` component before the game starts. Example:

```typescript
import AuthScreen from './components/AuthScreen';
import Leaderboard from './components/Leaderboard';
import { submitRunToLeaderboard } from './utils/leaderboard';

// Add state for authentication
const [isAuthenticated, setIsAuthenticated] = useState(false);
const [username, setUsername] = useState('');
const [showLeaderboard, setShowLeaderboard] = useState(false);

// Show auth screen if not authenticated
if (!isAuthenticated) {
  return (
    <AuthScreen
      onAuthSuccess={(username) => {
        setUsername(username);
        setIsAuthenticated(true);
      }}
      onSkip={() => setIsAuthenticated(true)}
    />
  );
}
```

#### 2. DeathScreen.tsx - Submit Run on Death
When the game ends, automatically submit the run:

```typescript
import { submitRunToLeaderboard } from '../utils/leaderboard';

useEffect(() => {
  // Submit run when component mounts (game over)
  submitRunToLeaderboard(gameState).then(result => {
    if (result.success) {
      console.log(`Run submitted! Rank: #${result.rank}`);
    }
  });
}, []);
```

#### 3. Add Leaderboard Button
Add a button to view the leaderboard (in main menu or death screen):

```typescript
<button onClick={() => setShowLeaderboard(true)}>
  View Leaderboard
</button>

{showLeaderboard && (
  <Leaderboard onClose={() => setShowLeaderboard(false)} />
)}
```

## Updating Patch Version

When you release a new version:

1. Update `src/utils/leaderboard.ts`:
   ```typescript
   export const CURRENT_PATCH_VERSION = '1.1.0';
   ```

2. Update `server/.env`:
   ```env
   CURRENT_PATCH=1.1.0
   ```

This allows players to compete on patch-specific leaderboards!

## Deployment

### Backend Deployment (Recommended: Railway.app or Render.com)

1. **Railway.app** (Easiest):
   - Connect your GitHub repo
   - Set root directory to `server`
   - Add environment variables from `.env`
   - Deploy!

2. **Render.com**:
   - Create a new Web Service
   - Connect your repo
   - Set build command: `cd server && npm install`
   - Set start command: `cd server && npm start`
   - Add environment variables

### Frontend Deployment (Netlify/Vercel)

1. Update `.env` with production API URL:
   ```env
   VITE_API_URL=https://your-backend.railway.app/api
   ```

2. Deploy as usual with `npm run build`

## Troubleshooting

### "Failed to connect to database"
- Check your `DATABASE_URL` in `server/.env`
- Make sure your Neon database is running
- Verify your IP is allowed (Neon allows all IPs by default)

### "Authentication required"
- Make sure the backend server is running
- Check that `VITE_API_URL` points to the correct backend
- Verify JWT_SECRET is set in backend `.env`

### "Run submission failed"
- Check browser console for errors
- Verify you're logged in
- Make sure backend server is running

## API Testing

You can test the API directly with curl:

### Register a user:
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123"}'
```

### Get leaderboard:
```bash
curl http://localhost:3001/api/leaderboard/global
```

## Database Management

### View all players:
```sql
SELECT * FROM players;
```

### View all runs:
```sql
SELECT * FROM game_runs ORDER BY score DESC LIMIT 10;
```

### Delete a player (and all their runs):
```sql
DELETE FROM players WHERE username = 'testuser';
```

You can run these queries in the Neon dashboard's SQL editor.

## Next Steps

1. **Customize scoring formula** in `src/utils/leaderboard.ts`
2. **Add more leaderboard categories** (by class, by arena, etc.)
3. **Add player profiles** showing detailed stats
4. **Add achievements system** based on run data
5. **Add social features** (friends, challenges, etc.)

## Support

If you encounter issues:
1. Check both terminal outputs (frontend and backend)
2. Check browser console for errors
3. Verify all environment variables are set correctly
4. Make sure both servers are running

Good luck! 🚀
