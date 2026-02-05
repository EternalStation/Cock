import express from 'express';
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { authenticateToken } from '../middleware/auth.js';

dotenv.config();
const router = express.Router();
const sql = neon(process.env.DATABASE_URL);

// Submit a new game run (authenticated)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const playerId = req.user.id;
        const {
            score,
            survivalTime,
            kills,
            bossKills,
            classUsed,
            patchVersion,
            damageDealt,
            damageTaken,
            damageBlocked,
            damageBlockedArmor,
            damageBlockedCollision,
            damageBlockedProjectile,
            damageBlockedShield,
            radarCounts,
            meteoritesCollected,
            portalsUsed,
            arenaTimes,
            legendaryHexes,
            hexLevelupOrder,
            snitchesCaught
        } = req.body;

        // Validation
        if (score === undefined || !survivalTime || kills === undefined || !classUsed || !patchVersion) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Insert run
        const result = await sql`
            INSERT INTO game_runs (
                player_id,
                score,
                survival_time,
                kills,
                boss_kills,
                class_used,
                patch_version,
                damage_dealt,
                damage_taken,
                damage_blocked,
                damage_blocked_armor,
                damage_blocked_collision,
                damage_blocked_projectile,
                damage_blocked_shield,
                radar_counts,
                meteorites_collected,
                portals_used,
                arena_times,
                legendary_hexes,
                hex_levelup_order,
                snitches_caught
            ) VALUES (
                ${playerId},
                ${score},
                ${survivalTime},
                ${kills},
                ${bossKills || 0},
                ${classUsed},
                ${patchVersion},
                ${damageDealt || 0},
                ${damageTaken || 0},
                ${damageBlocked || 0},
                ${damageBlockedArmor || 0},
                ${damageBlockedCollision || 0},
                ${damageBlockedProjectile || 0},
                ${damageBlockedShield || 0},
                ${JSON.stringify(radarCounts || {})},
                ${meteoritesCollected || 0},
                ${portalsUsed || 0},
                ${JSON.stringify(arenaTimes || { 0: 0, 1: 0, 2: 0 })},
                ${JSON.stringify(legendaryHexes || [])},
                ${JSON.stringify(hexLevelupOrder || [])},
                ${snitchesCaught || 0}
            )
            RETURNING id, score, completed_at, survival_time
        `;

        const run = result[0];

        // Calculate rank
        const rankResult = await sql`
            SELECT COUNT(*) + 1 as rank
            FROM game_runs
            WHERE survival_time > ${run.survival_time}
        `;

        res.status(201).json({
            message: 'Run submitted successfully',
            run: {
                id: run.id,
                score: run.score,
                completedAt: run.completed_at,
                rank: rankResult[0].rank
            }
        });
    } catch (error) {
        console.error('Submit run error:', error);
        res.status(500).json({ error: 'Failed to submit run' });
    }
});

// Get player's personal run history
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const playerId = req.user.id;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        const results = await sql`
            SELECT 
                id,
                score,
                survival_time,
                kills,
                boss_kills,
                class_used,
                patch_version,
                damage_dealt,
                damage_taken,
                meteorites_collected,
                portals_used,
                arena_times,
                legendary_hexes,
                hex_levelup_order,
                snitches_caught,
                completed_at
            FROM game_runs
            WHERE player_id = ${playerId}
            ORDER BY survival_time DESC
            LIMIT ${limit}
            OFFSET ${offset}
        `;

        res.json({
            runs: results,
            count: results.length
        });
    } catch (error) {
        console.error('Get runs error:', error);
        res.status(500).json({ error: 'Failed to fetch runs' });
    }
});

// Get player's best run
router.get('/me/best', authenticateToken, async (req, res) => {
    try {
        const playerId = req.user.id;

        const result = await sql`
            SELECT 
                id,
                score,
                survival_time,
                kills,
                boss_kills,
                class_used,
                patch_version,
                damage_dealt,
                damage_taken,
                meteorites_collected,
                portals_used,
                arena_times,
                legendary_hexes,
                hex_levelup_order,
                completed_at
            FROM game_runs
            WHERE player_id = ${playerId}
            ORDER BY survival_time DESC
            LIMIT 1
        `;

        if (result.length === 0) {
            return res.status(404).json({ error: 'No runs found' });
        }

        res.json({ bestRun: result[0] });
    } catch (error) {
        console.error('Get best run error:', error);
        res.status(500).json({ error: 'Failed to fetch best run' });
    }
});

// Get player statistics
router.get('/me/stats', authenticateToken, async (req, res) => {
    try {
        const playerId = req.user.id;

        const stats = await sql`
            SELECT 
                COUNT(*) as total_runs,
                MAX(score) as best_score,
                AVG(score)::INTEGER as avg_score,
                MAX(survival_time) as longest_survival,
                SUM(snitches_caught) as total_snitches,
                SUM(kills) as total_kills,
                SUM(boss_kills) as total_boss_kills,
                SUM(damage_dealt) as total_damage_dealt
            FROM game_runs
            WHERE player_id = ${playerId}
        `;

        const classCounts = await sql`
            SELECT class_used, COUNT(*) as count
            FROM game_runs
            WHERE player_id = ${playerId}
            GROUP BY class_used
            ORDER BY count DESC
        `;

        res.json({
            stats: stats[0],
            favoriteClasses: classCounts
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Get detailed run by ID
router.get('/:runId', async (req, res) => {
    try {
        const { runId } = req.params;

        const result = await sql`
            SELECT 
                gr.*,
                p.username
            FROM game_runs gr
            JOIN players p ON gr.player_id = p.id
            WHERE gr.id = ${runId}
        `;

        if (result.length === 0) {
            return res.status(404).json({ error: 'Run not found' });
        }

        res.json({ run: result[0] });
    } catch (error) {
        console.error('Get run error:', error);
        res.status(500).json({ error: 'Failed to fetch run' });
    }
});

// Delete a specific run (authenticated, must own the run)
router.delete('/:runId', authenticateToken, async (req, res) => {
    try {
        const { runId } = req.params;
        const playerId = req.user.id;

        const result = await sql`
            DELETE FROM game_runs
            WHERE id = ${runId} AND player_id = ${playerId}
            RETURNING id
        `;

        if (result.length === 0) {
            return res.status(404).json({ error: 'Run not found or unauthorized' });
        }

        res.json({ message: 'Run deleted successfully', runId: result[0].id });
    } catch (error) {
        console.error('Delete run error:', error);
        res.status(500).json({ error: 'Failed to delete run' });
    }
});

// Delete all runs for the current player (authenticated)
router.delete('/me/all', authenticateToken, async (req, res) => {
    try {
        const playerId = req.user.id;

        const result = await sql`
            DELETE FROM game_runs
            WHERE player_id = ${playerId}
            RETURNING id
        `;

        res.json({ message: 'All player runs deleted successfully', count: result.length });
    } catch (error) {
        console.error('Clear personal runs error:', error);
        res.status(500).json({ error: 'Failed to clear runs' });
    }
});

export default router;
