import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();
const sql = neon(process.env.DATABASE_URL);

// Register new player
router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validation
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        if (username.length < 3 || username.length > 50) {
            return res.status(400).json({ error: 'Username must be 3-50 characters' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Check if username exists
        const existing = await sql`
            SELECT id FROM players WHERE username = ${username}
        `;

        if (existing.length > 0) {
            return res.status(409).json({ error: 'Username already taken' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create player
        const result = await sql`
            INSERT INTO players (username, password_hash)
            VALUES (${username}, ${passwordHash})
            RETURNING id, username, created_at
        `;

        const player = result[0];

        // Generate JWT
        const token = jwt.sign(
            { id: player.id, username: player.username },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.status(201).json({
            message: 'Player registered successfully',
            token,
            player: {
                id: player.id,
                username: player.username,
                createdAt: player.created_at
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        // Find player
        const result = await sql`
            SELECT id, username, password_hash, created_at
            FROM players
            WHERE username = ${username}
        `;

        if (result.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const player = result[0];

        // Verify password
        const validPassword = await bcrypt.compare(password, player.password_hash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        await sql`
            UPDATE players
            SET last_login = NOW()
            WHERE id = ${player.id}
        `;

        // Generate JWT
        const token = jwt.sign(
            { id: player.id, username: player.username },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            message: 'Login successful',
            token,
            player: {
                id: player.id,
                username: player.username,
                createdAt: player.created_at
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Verify token (check if still valid)
router.get('/verify', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ valid: false });
        }

        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (err) {
                return res.status(403).json({ valid: false });
            }
            res.json({ valid: true, user });
        });
    } catch (error) {
        res.status(500).json({ valid: false });
    }
});

export default router;
