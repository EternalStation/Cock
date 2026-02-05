import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

export async function initializeDatabase() {
    try {
        console.log('🔧 Initializing database schema...');

        // Create players table
        await sql`
            CREATE TABLE IF NOT EXISTS players (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                last_login TIMESTAMP DEFAULT NOW()
            )
        `;
        console.log('✅ Players table created');

        // Create game_runs table with detailed tracking
        await sql`
            CREATE TABLE IF NOT EXISTS game_runs (
                id SERIAL PRIMARY KEY,
                player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
                score INTEGER NOT NULL,
                survival_time INTEGER NOT NULL,
                kills INTEGER NOT NULL,
                boss_kills INTEGER NOT NULL,
                class_used VARCHAR(50),
                patch_version VARCHAR(20) NOT NULL,
                completed_at TIMESTAMP DEFAULT NOW(),
                
                -- Detailed stats
                damage_dealt BIGINT DEFAULT 0,
                damage_taken BIGINT DEFAULT 0,
                damage_blocked BIGINT DEFAULT 0,
                damage_blocked_armor BIGINT DEFAULT 0,
                damage_blocked_collision BIGINT DEFAULT 0,
                damage_blocked_projectile BIGINT DEFAULT 0,
                damage_blocked_shield BIGINT DEFAULT 0,
                meteorites_collected INTEGER DEFAULT 0,
                portals_used INTEGER DEFAULT 0,
                
                -- Arena time tracking (JSON)
                arena_times JSONB DEFAULT '{"0": 0, "1": 0, "2": 0}'::jsonb,
                
                -- Legendary hexes (JSON array of objects)
                legendary_hexes JSONB DEFAULT '[]'::jsonb,
                
                -- Hex level-up order (JSON array)
                hex_levelup_order JSONB DEFAULT '[]'::jsonb,
                
                -- Radar counts (JSON object)
                radar_counts JSONB DEFAULT '{}'::jsonb,
                
                -- Snitch tracking
                snitches_caught INTEGER DEFAULT 0,

                -- Death Cause
                death_cause VARCHAR(255) DEFAULT 'Unknown'
            )
        `;
        console.log('✅ Game runs table created');

        // Create indexes for leaderboard queries
        await sql`CREATE INDEX IF NOT EXISTS idx_runs_score ON game_runs(score DESC)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_runs_time ON game_runs(survival_time DESC)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_runs_patch ON game_runs(patch_version, score DESC)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_runs_daily ON game_runs(DATE(completed_at), score DESC)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_runs_weekly ON game_runs(DATE_TRUNC('week', completed_at), score DESC)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_runs_player ON game_runs(player_id, score DESC)`;
        console.log('✅ Indexes created');

        console.log('🎉 Database initialization complete!');
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        throw error;
    }
}

// Run if called directly
const isMain = import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMain || process.argv[1].endsWith('init-db.js')) {
    initializeDatabase()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
