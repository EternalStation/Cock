import express from 'express';
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();
const sql = neon(process.env.DATABASE_URL);

// Get global leaderboard (all-time)
router.get('/global', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;

        const results = await sql`
            SELECT 
                gr.id,
                gr.score,
                gr.survival_time,
                gr.kills,
                gr.boss_kills,
                gr.class_used,
                gr.completed_at,
                p.username,
                gr.legendary_hexes,
                gr.arena_times,
                gr.damage_dealt,
                gr.damage_taken,
                gr.damage_blocked,
                gr.damage_blocked_armor,
                gr.damage_blocked_collision,
                gr.damage_blocked_projectile,
                gr.damage_blocked_shield,
                gr.radar_counts,
                gr.portals_used,
                gr.hex_levelup_order,
                gr.snitches_caught,
                gr.death_cause,
                gr.patch_version
            FROM game_runs gr
            JOIN players p ON gr.player_id = p.id
            ORDER BY gr.survival_time DESC
            LIMIT ${limit}
            OFFSET ${offset}
        `;

        res.json({
            leaderboard: results,
            count: results.length,
            offset
        });
    } catch (error) {
        console.error('Global leaderboard error:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// Get daily leaderboard
router.get('/daily', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;

        const results = await sql`
            SELECT 
                gr.id,
                gr.score,
                gr.survival_time,
                gr.kills,
                gr.boss_kills,
                gr.class_used,
                gr.completed_at,
                p.username,
                gr.legendary_hexes,
                gr.arena_times,
                gr.damage_dealt,
                gr.damage_taken,
                gr.damage_blocked,
                gr.damage_blocked_armor,
                gr.damage_blocked_collision,
                gr.damage_blocked_projectile,
                gr.damage_blocked_shield,
                gr.radar_counts,
                gr.portals_used,
                gr.hex_levelup_order,
                gr.snitches_caught,
                gr.death_cause,
                gr.patch_version
            FROM game_runs gr
            JOIN players p ON gr.player_id = p.id
            WHERE DATE(gr.completed_at) = CURRENT_DATE
            ORDER BY gr.survival_time DESC
            LIMIT ${limit}
        `;

        res.json({
            leaderboard: results,
            count: results.length,
            period: 'daily'
        });
    } catch (error) {
        console.error('Daily leaderboard error:', error);
        res.status(500).json({ error: 'Failed to fetch daily leaderboard' });
    }
});

// Get weekly leaderboard
router.get('/weekly', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;

        const results = await sql`
            SELECT 
                gr.id,
                gr.score,
                gr.survival_time,
                gr.kills,
                gr.boss_kills,
                gr.class_used,
                gr.completed_at,
                p.username,
                gr.legendary_hexes,
                gr.arena_times,
                gr.damage_dealt,
                gr.damage_taken,
                gr.damage_blocked,
                gr.damage_blocked_armor,
                gr.damage_blocked_collision,
                gr.damage_blocked_projectile,
                gr.damage_blocked_shield,
                gr.radar_counts,
                gr.portals_used,
                gr.hex_levelup_order,
                gr.snitches_caught,
                gr.death_cause,
                gr.patch_version
            FROM game_runs gr
            JOIN players p ON gr.player_id = p.id
            WHERE gr.completed_at >= DATE_TRUNC('week', CURRENT_DATE)
            ORDER BY gr.survival_time DESC
            LIMIT ${limit}
        `;

        res.json({
            leaderboard: results,
            count: results.length,
            period: 'weekly'
        });
    } catch (error) {
        console.error('Weekly leaderboard error:', error);
        res.status(500).json({ error: 'Failed to fetch weekly leaderboard' });
    }
});

// Get leaderboard by patch version
router.get('/patch/:version', async (req, res) => {
    try {
        const { version } = req.params;
        const limit = parseInt(req.query.limit) || 100;

        const results = await sql`
            SELECT 
                gr.id,
                gr.score,
                gr.survival_time,
                gr.kills,
                gr.boss_kills,
                gr.class_used,
                gr.completed_at,
                gr.patch_version,
                p.username,
                gr.legendary_hexes,
                gr.arena_times,
                gr.damage_dealt,
                gr.damage_taken,
                gr.damage_blocked,
                gr.damage_blocked_armor,
                gr.damage_blocked_collision,
                gr.damage_blocked_projectile,
                gr.damage_blocked_shield,
                gr.radar_counts,
                gr.portals_used,
                gr.hex_levelup_order,
                gr.snitches_caught,
                gr.death_cause,
                gr.patch_version
            FROM game_runs gr
            JOIN players p ON gr.player_id = p.id
            WHERE gr.patch_version = ${version}
            ORDER BY gr.survival_time DESC
            LIMIT ${limit}
        `;

        res.json({
            leaderboard: results,
            count: results.length,
            patch: version
        });
    } catch (error) {
        console.error('Patch leaderboard error:', error);
        res.status(500).json({ error: 'Failed to fetch patch leaderboard' });
    }
});

// Get available patch versions
router.get('/patches', async (req, res) => {
    try {
        const results = await sql`
            SELECT DISTINCT patch_version, COUNT(*) as run_count
            FROM game_runs
            GROUP BY patch_version
            ORDER BY patch_version DESC
        `;

        res.json({ patches: results });
    } catch (error) {
        console.error('Patches error:', error);
        res.status(500).json({ error: 'Failed to fetch patches' });
    }
});

// Get player rank for a specific run
router.get('/rank/:runId', async (req, res) => {
    try {
        const { runId } = req.params;

        // Get the run details
        const runResult = await sql`
            SELECT survival_time, patch_version, completed_at
            FROM game_runs
            WHERE id = ${runId}
        `;

        if (runResult.length === 0) {
            return res.status(404).json({ error: 'Run not found' });
        }

        const run = runResult[0];

        // Calculate global rank
        const globalRank = await sql`
            SELECT COUNT(*) + 1 as rank
            FROM game_runs
            WHERE survival_time > ${run.survival_time}
        `;

        // Calculate patch rank
        const patchRank = await sql`
            SELECT COUNT(*) + 1 as rank
            FROM game_runs
            WHERE survival_time > ${run.survival_time} AND patch_version = ${run.patch_version}
        `;

        // Calculate daily rank
        const dailyRank = await sql`
            SELECT COUNT(*) + 1 as rank
            FROM game_runs
            WHERE survival_time > ${run.survival_time} AND DATE(completed_at) = DATE(${run.completed_at})
        `;

        res.json({
            runId,
            survival_time: run.survival_time,
            ranks: {
                global: globalRank[0].rank,
                patch: patchRank[0].rank,
                daily: dailyRank[0].rank
            }
        });
    } catch (error) {
        console.error('Rank error:', error);
        res.status(500).json({ error: 'Failed to calculate rank' });
    }
});

export default router;
