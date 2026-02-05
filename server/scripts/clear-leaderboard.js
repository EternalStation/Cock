import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config({ path: './server/.env' });

const sql = neon(process.env.DATABASE_URL);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function clearLeaderboard() {
    rl.question('⚠️ WARNING: This will delete ALL leaderboard records for ALL players. Type "CLEAREVERYTHING" to confirm: ', async (answer) => {
        if (answer === 'CLEAREVERYTHING') {
            try {
                console.log('🧹 Clearing all game runs...');
                const result = await sql`DELETE FROM game_runs`;
                console.log(`✅ Success! Deleted ${result.length || 'all'} records.`);
            } catch (err) {
                console.error('❌ Failed to clear leaderboard:', err);
            }
        } else {
            console.log('❌ Wipe cancelled. Confirmation string did not match.');
        }
        rl.close();
        process.exit(0);
    });
}

clearLeaderboard();
