import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
    console.log('🚀 Starting migration: Adding missing columns to game_runs...');
    try {
        // Add radar_counts if it doesn't exist
        await sql`ALTER TABLE game_runs ADD COLUMN IF NOT EXISTS radar_counts JSONB DEFAULT '{}'::jsonb`;
        console.log('✅ Added radar_counts column');

        // Add snitches_caught if it doesn't exist
        await sql`ALTER TABLE game_runs ADD COLUMN IF NOT EXISTS snitches_caught INTEGER DEFAULT 0`;
        console.log('✅ Added snitches_caught column');

        console.log('🎉 Migration successful!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
