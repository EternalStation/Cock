# Leaderboard System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                         │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ AuthScreen   │  │ Leaderboard  │  │ DeathScreen  │          │
│  │              │  │              │  │              │          │
│  │ - Login      │  │ - Global     │  │ - Submit Run │          │
│  │ - Register   │  │ - Daily      │  │ - Show Rank  │          │
│  │ - Guest      │  │ - Weekly     │  │              │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                  │                   │
│         └─────────────────┼──────────────────┘                   │
│                           │                                      │
│                  ┌────────▼────────┐                             │
│                  │   API Client    │                             │
│                  │  (client.ts)    │                             │
│                  │                 │                             │
│                  │ - JWT Storage   │                             │
│                  │ - HTTP Requests │                             │
│                  └────────┬────────┘                             │
└───────────────────────────┼──────────────────────────────────────┘
                            │
                            │ HTTP/JSON
                            │ (localhost:3001/api)
                            │
┌───────────────────────────▼──────────────────────────────────────┐
│                      BACKEND (Express.js)                         │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Auth Routes  │  │ Leaderboard  │  │  Run Routes  │          │
│  │              │  │   Routes     │  │              │          │
│  │ /register    │  │ /global      │  │ POST /runs   │          │
│  │ /login       │  │ /daily       │  │ GET /runs/me │          │
│  │ /verify      │  │ /weekly      │  │ GET /stats   │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                  │                   │
│         └─────────────────┼──────────────────┘                   │
│                           │                                      │
│                  ┌────────▼────────┐                             │
│                  │  Middleware     │                             │
│                  │                 │                             │
│                  │ - JWT Verify    │                             │
│                  │ - CORS          │                             │
│                  └────────┬────────┘                             │
└───────────────────────────┼──────────────────────────────────────┘
                            │
                            │ SQL Queries
                            │ (@neondatabase/serverless)
                            │
┌───────────────────────────▼──────────────────────────────────────┐
│                    NEON DATABASE (PostgreSQL)                     │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                      players                              │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ id | username | password_hash | created_at | last_login  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                     game_runs                             │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ id | player_id | score | survival_time | kills           │   │
│  │ boss_kills | class_used | patch_version | damage_dealt   │   │
│  │ damage_taken | meteorites_collected | portals_used       │   │
│  │ arena_times (JSONB) | legendary_hexes (JSONB)            │   │
│  │ hex_levelup_order (JSONB) | completed_at                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  Indexes:                                                         │
│  - score DESC (global leaderboard)                               │
│  - patch_version, score DESC (patch leaderboard)                 │
│  - DATE(completed_at), score DESC (daily leaderboard)            │
│  - player_id, score DESC (personal best)                         │
└───────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Player Registration/Login
```
User Input → AuthScreen → API Client → POST /api/auth/register
                                      → Backend validates
                                      → Hash password (bcrypt)
                                      → Insert into players table
                                      → Generate JWT token
                                      → Return token to client
                                      → Store in localStorage
```

### 2. Viewing Leaderboard
```
Click Leaderboard → Leaderboard Component → API Client → GET /api/leaderboard/global
                                                        → Backend queries database
                                                        → JOIN players + game_runs
                                                        → ORDER BY score DESC
                                                        → Return top 100
                                                        → Display in table
```

### 3. Submitting a Run
```
Game Over → DeathScreen → submitRunToLeaderboard() → Prepare run data:
                                                      - Extract legendary hexes
                                                      - Build levelup order
                                                      - Calculate score
                                                      - Get arena times
                                                    → API Client → POST /api/runs
                                                                 → Verify JWT
                                                                 → Insert run
                                                                 → Calculate rank
                                                                 → Return rank
                                                                 → Show to player
```

## Tracked Data Structure

### Legendary Hexes (JSONB)
```json
[
  {
    "id": "eco_dmg_1",
    "name": "Damage Per Kill",
    "type": "EcoDMG",
    "level": 3,
    "killsAtAcquisition": 50,
    "killsAtLevel": {
      "2": 120,
      "3": 250
    }
  }
]
```

### Hex Levelup Order (JSONB)
```json
[
  { "hexId": "eco_dmg_1", "level": 1, "killCount": 50 },
  { "hexId": "com_crit_1", "level": 1, "killCount": 75 },
  { "hexId": "eco_dmg_1", "level": 2, "killCount": 120 },
  { "hexId": "eco_dmg_1", "level": 3, "killCount": 250 }
]
```

### Arena Times (JSONB)
```json
{
  "0": 180,  // 3 minutes in Economic arena
  "1": 240,  // 4 minutes in Combat arena
  "2": 120   // 2 minutes in Defense arena
}
```

## Security

### JWT Token Flow
```
Login → Server generates JWT with:
        - Payload: { id, username }
        - Secret: from .env
        - Expiry: 30 days

Client stores token → localStorage

Protected requests → Include header:
                     Authorization: Bearer <token>

Server verifies → jwt.verify(token, secret)
               → Extract user info
               → Allow request
```

### Password Security
```
Registration → User password → bcrypt.hash(password, 10)
                             → Store hash in database

Login → User password → bcrypt.compare(password, stored_hash)
                      → If match: generate JWT
                      → If no match: reject
```

## Deployment Architecture

### Development
```
Frontend: localhost:5173 (Vite dev server)
Backend:  localhost:3001 (Node.js)
Database: Neon cloud (always remote)
```

### Production
```
Frontend: Netlify/Vercel (static hosting)
Backend:  Railway/Render (Node.js hosting)
Database: Neon cloud (same instance)

Frontend .env: VITE_API_URL=https://your-backend.railway.app/api
Backend .env:  DATABASE_URL=postgresql://...neon.tech/...
```
