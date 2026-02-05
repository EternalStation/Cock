import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Configure dotenv to look for .env in server directory (parent of scripts)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const sql = neon(process.env.DATABASE_URL);

async function addDeathCauseColumn() {
    try {
        console.log('🔧 Adding death_cause column to game_runs table...');

        await sql`
            ALTER TABLE game_runs 
            ADD COLUMN IF NOT EXISTS death_cause VARCHAR(255) DEFAULT 'Unknown'
        `;

        console.log('✅ death_cause column added successfully');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

addDeathCauseColumn()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
