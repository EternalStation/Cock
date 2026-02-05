import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
    console.log('🚀 Starting migration...');
    try {
        await sql`ALTER TABLE game_runs ADD COLUMN IF NOT EXISTS damage_blocked BIGINT DEFAULT 0`;
        await sql`ALTER TABLE game_runs ADD COLUMN IF NOT EXISTS damage_blocked_armor BIGINT DEFAULT 0`;
        await sql`ALTER TABLE game_runs ADD COLUMN IF NOT EXISTS damage_blocked_collision BIGINT DEFAULT 0`;
        await sql`ALTER TABLE game_runs ADD COLUMN IF NOT EXISTS damage_blocked_projectile BIGINT DEFAULT 0`;
        await sql`ALTER TABLE game_runs ADD COLUMN IF NOT EXISTS damage_blocked_shield BIGINT DEFAULT 0`;
        console.log('✅ Migration complete!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    }
}

migrate();
