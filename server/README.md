# Neon Survivor - Backend Server

This is the backend API server for the Neon Survivor leaderboard system.

## Setup Instructions

### 1. Create Neon Database

1. Go to [https://console.neon.tech](https://console.neon.tech)
2. Sign up for a free account
3. Create a new project
4. Copy the connection string (it looks like: `postgresql://username:password@host/database?sslmode=require`)

### 2. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Neon database connection string:
   ```
   DATABASE_URL=your-neon-connection-string-here
   JWT_SECRET=generate-a-random-secret-key
   CURRENT_PATCH=1.0.0
   ```

   **Generate a secure JWT secret:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

### 3. Install Dependencies

```bash
npm install
```

### 4. Initialize Database

This will create all necessary tables and indexes:

```bash
npm run init-db
```

### 5. Start Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will run on `http://localhost:3001`

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new player
  ```json
  {
    "username": "player123",
    "password": "securepassword"
  }
  ```

- `POST /api/auth/login` - Login
  ```json
  {
    "username": "player123",
    "password": "securepassword"
  }
  ```

- `GET /api/auth/verify` - Verify token validity

### Leaderboards

- `GET /api/leaderboard/global?limit=100&offset=0` - Global all-time leaderboard
- `GET /api/leaderboard/daily?limit=100` - Today's leaderboard
- `GET /api/leaderboard/weekly?limit=100` - This week's leaderboard
- `GET /api/leaderboard/patch/:version?limit=100` - Leaderboard for specific patch
- `GET /api/leaderboard/patches` - List all patch versions
- `GET /api/leaderboard/rank/:runId` - Get rank for specific run

### Runs (Authenticated)

All these endpoints require `Authorization: Bearer <token>` header

- `POST /api/runs` - Submit new game run
- `GET /api/runs/me?limit=50&offset=0` - Get your run history
- `GET /api/runs/me/best` - Get your best run
- `GET /api/runs/me/stats` - Get your statistics
- `GET /api/runs/:runId` - Get detailed run info

## Database Schema

### Players Table
- `id` - Auto-incrementing primary key
- `username` - Unique username (3-50 chars)
- `password_hash` - Bcrypt hashed password
- `created_at` - Registration timestamp
- `last_login` - Last login timestamp

### Game Runs Table
- `id` - Auto-incrementing primary key
- `player_id` - Foreign key to players
- `score` - Final score
- `survival_time` - Time survived in seconds
- `kills` - Total kills
- `boss_kills` - Boss kills
- `class_used` - Player class ID
- `patch_version` - Game version
- `damage_dealt` - Total damage dealt
- `damage_taken` - Total damage taken
- `meteorites_collected` - Meteorites picked up
- `portals_used` - Portals used
- `arena_times` - JSON object with time spent in each arena
- `legendary_hexes` - JSON array of legendary hex details
- `hex_levelup_order` - JSON array tracking hex upgrade order
- `completed_at` - Run completion timestamp

## Troubleshooting

**Connection errors:**
- Make sure your Neon database is running
- Check that DATABASE_URL is correct in `.env`
- Verify your IP is allowed in Neon's firewall settings

**JWT errors:**
- Make sure JWT_SECRET is set in `.env`
- Token expires after 30 days - users need to re-login

**Database errors:**
- Run `npm run init-db` again to recreate tables
- Check Neon console for database logs
