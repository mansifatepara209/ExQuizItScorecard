import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import multer from 'multer';
import xlsx from 'xlsx';

dotenv.config();

// ⭐ DEBUG — see what dotenv loaded
console.log('🔍 DEBUG DB_HOST:', process.env.DB_HOST);
console.log('🔍 DEBUG DB_USER:', process.env.DB_USER);
console.log('🔍 DEBUG DB_PASSWORD:', process.env.DB_PASSWORD ? `SET (length: ${process.env.DB_PASSWORD.length})` : '❌ NOT SET');
console.log('🔍 DEBUG DB_NAME:', process.env.DB_NAME);

const app = express();
const PORT = process.env.PORT || 5000;

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ex_quiz_it',
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

pool.getConnection()
    .then(conn => { console.log('✅ MySQL connected'); conn.release(); })
    .catch(err => console.error('❌ MySQL failed:', err.message));

app.use(cors({
    origin: [
        'http://localhost:5173',
        /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,     // ⭐ Allow 10.x.x.x (your network)
        /^http:\/\/192\.168\.\d+\.\d+:\d+$/,    // Allow 192.168.x.x (in case network changes)
    ],
    credentials: true
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ============ HELPERS ============
const parseNum = (val, fallback) => {
    if (val === undefined || val === null || val === '') return fallback;
    const n = parseInt(val);
    return isNaN(n) ? fallback : n;
};

// ==================== RANKING ====================
async function recalcRanks(eventId) {
    const [eventRow] = await pool.query('SELECT tie_break_rule FROM events WHERE id = ?', [eventId]);
    const tieBreakRule = (eventRow[0]?.tie_break_rule || 'SCORE,CORRECT_COUNT,FEWER_WRONG,FEWER_PENALTIES,ALPHABETICAL')
        .split(',').map(s => s.trim().toUpperCase());

    const [rows] = await pool.query(
        `SELECT t.id, t.team_order, t.name, t.short_name, t.institution,
            COALESCE(SUM(s.points), 0) as total_score,
            SUM(CASE WHEN s.action = 'correct' THEN 1 ELSE 0 END) as correct_count,
            SUM(CASE WHEN s.action = 'wrong' THEN 1 ELSE 0 END) as wrong_count,
            SUM(CASE WHEN s.action = 'half_correct' THEN 1 ELSE 0 END) as half_count,
            SUM(CASE WHEN s.action = 'pass' THEN 1 ELSE 0 END) as pass_count,
            SUM(CASE WHEN s.action = 'penalty' THEN 1 ELSE 0 END) as penalty_count,
            COUNT(s.id) as total_answers
         FROM teams t
         LEFT JOIN scores s ON t.id = s.team_id
         WHERE t.event_id = ?
         GROUP BY t.id`,
        [eventId]
    );

    const normalized = rows.map(r => ({
        ...r,
        total_score: Number(r.total_score),
        correct_count: Number(r.correct_count),
        wrong_count: Number(r.wrong_count),
        half_count: Number(r.half_count),
        pass_count: Number(r.pass_count),
        penalty_count: Number(r.penalty_count),
        total_answers: Number(r.total_answers)
    }));

    normalized.sort((a, b) => {
        for (const rule of tieBreakRule) {
            let diff = 0;
            switch (rule) {
                case 'SCORE': diff = b.total_score - a.total_score; break;
                case 'CORRECT_COUNT': diff = b.correct_count - a.correct_count; break;
                case 'FEWER_WRONG': diff = a.wrong_count - b.wrong_count; break;
                case 'FEWER_PENALTIES': diff = a.penalty_count - b.penalty_count; break;
                case 'FEWER_PASS': diff = a.pass_count - b.pass_count; break;
                case 'ALPHABETICAL': diff = a.name.localeCompare(b.name); break;
                case 'TEAM_ORDER': diff = a.team_order - b.team_order; break;
            }
            if (diff !== 0) return diff;
        }
        return 0;
    });

    return normalized.map((r, i) => ({ ...r, rank: i + 1 }));
}

// ==================== HEALTH ====================
app.get('/api/health', (req, res) => res.json({ status: 'OK' }));

// ==================== EVENT ====================
app.get('/api/event/state/:eventId', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT e.*, 
                COALESCE(r.name, 'No Round') as current_round_name,
                COALESCE(r.type, 'N/A') as current_round_type,
                COALESCE(r.question_count, 0) as total_questions,
                COUNT(DISTINCT t.id) as total_teams
             FROM events e
             LEFT JOIN rounds r ON e.current_round_id = r.id
             LEFT JOIN teams t ON e.id = t.event_id
             WHERE e.id = ? GROUP BY e.id`,
            [req.params.eventId]
        );
        res.json(rows[0] || null);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/event/:eventId', async (req, res) => {
    const { name, description } = req.body;
    try {
        await pool.query('UPDATE events SET name = ?, description = ? WHERE id = ?',
            [name, description || '', req.params.eventId]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/event/start/:eventId', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [teams] = await conn.query('SELECT COUNT(*) as c FROM teams WHERE event_id = ?', [req.params.eventId]);
        if (teams[0].c === 0) { await conn.rollback(); return res.status(400).json({ error: 'No teams found' }); }

        const [rounds] = await conn.query('SELECT id FROM rounds WHERE event_id = ? ORDER BY round_order LIMIT 1', [req.params.eventId]);
        if (rounds.length === 0) { await conn.rollback(); return res.status(400).json({ error: 'No rounds found' }); }

        await conn.query(
            `UPDATE events SET is_started = TRUE, is_paused = FALSE, current_round_id = ?, current_question_index = 0, regular_round_sequence_index = 0, current_buzzer_team_id = NULL
             WHERE id = ?`,
            [rounds[0].id, req.params.eventId]
        );
        await conn.commit();
        res.json({ success: true, currentRoundId: rounds[0].id });
    } catch (e) { await conn.rollback(); res.status(500).json({ error: e.message }); }
    finally { conn.release(); }
});

app.post('/api/event/stop/:eventId', async (req, res) => {
    try {
        await pool.query(
            `UPDATE events SET is_started = FALSE, is_paused = FALSE, show_splash = NULL WHERE id = ?`,
            [req.params.eventId]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/event/pause/:eventId', async (req, res) => {
    try {
        await pool.query('UPDATE events SET is_paused = TRUE WHERE id = ?', [req.params.eventId]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/event/resume/:eventId', async (req, res) => {
    try {
        await pool.query('UPDATE events SET is_paused = FALSE WHERE id = ?', [req.params.eventId]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/event/reset/:eventId', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query('DELETE FROM scores WHERE event_id = ?', [req.params.eventId]);
        await conn.query('DELETE FROM rank_history WHERE event_id = ?', [req.params.eventId]);
        await conn.query(
            `UPDATE events SET is_started = FALSE, is_paused = FALSE, current_round_id = NULL, current_question_index = 0, regular_round_sequence_index = 0, current_buzzer_team_id = NULL
             WHERE id = ?`,
            [req.params.eventId]
        );
        await conn.commit();
        res.json({ success: true });
    } catch (e) { await conn.rollback(); res.status(500).json({ error: e.message }); }
    finally { conn.release(); }
});

app.post('/api/event/reset-all/:eventId', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query('DELETE FROM rank_history WHERE event_id = ?', [req.params.eventId]);
        await conn.query('DELETE FROM scores WHERE event_id = ?', [req.params.eventId]);
        await conn.query('DELETE FROM team_members WHERE team_id IN (SELECT id FROM teams WHERE event_id = ?)', [req.params.eventId]);
        await conn.query('DELETE FROM teams WHERE event_id = ?', [req.params.eventId]);
        await conn.query('DELETE FROM rounds WHERE event_id = ?', [req.params.eventId]);
        await conn.query('DELETE FROM audit_log WHERE event_id = ?', [req.params.eventId]);
        await conn.query(
            `UPDATE events SET is_started = FALSE, is_paused = FALSE, current_round_id = NULL, current_question_index = 0, regular_round_sequence_index = 0, current_buzzer_team_id = NULL
             WHERE id = ?`,
            [req.params.eventId]
        );
        await conn.commit();
        res.json({ success: true });
    } catch (e) { await conn.rollback(); res.status(500).json({ error: e.message }); }
    finally { conn.release(); }
});

app.get('/api/event/config/:eventId', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM scoring_config WHERE event_id = ?', [req.params.eventId]);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/event/settings/:eventId', async (req, res) => {
    const { tieBreakRule, penaltyPoints } = req.body;
    try {
        if (tieBreakRule !== undefined) {
            await pool.query('UPDATE events SET tie_break_rule = ? WHERE id = ?',
                [tieBreakRule, req.params.eventId]);
        }
        if (penaltyPoints !== undefined) {
            await pool.query('UPDATE events SET penalty_points = ? WHERE id = ?',
                [penaltyPoints, req.params.eventId]);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== TEAMS ====================
app.get('/api/teams/:eventId', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM teams WHERE event_id = ? ORDER BY team_order', [req.params.eventId]);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/teams/with-members/:eventId', async (req, res) => {
    try {
        const [teams] = await pool.query('SELECT * FROM teams WHERE event_id = ? ORDER BY team_order', [req.params.eventId]);
        const result = [];
        for (const team of teams) {
            const [members] = await pool.query('SELECT * FROM team_members WHERE team_id = ? ORDER BY member_order', [team.id]);
            result.push({ ...team, member_details: members });
        }
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/teams', async (req, res) => {
    const { eventId, name, shortName, institution, members } = req.body;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [maxOrder] = await conn.query('SELECT COALESCE(MAX(team_order), 0) + 1 as n FROM teams WHERE event_id = ?', [eventId]);
        const memberList = members ? members.split(/[;,]/).map(m => m.trim()).filter(m => m) : [];
        const [result] = await conn.query(
            `INSERT INTO teams (event_id, team_order, name, short_name, institution, members, member_count)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [eventId, maxOrder[0].n, name, shortName, institution || '', memberList.join(', '), memberList.length]);
        for (let i = 0; i < memberList.length; i++) {
            await conn.query(
                `INSERT INTO team_members (team_id, member_name, member_order, member_role) VALUES (?, ?, ?, ?)`,
                [result.insertId, memberList[i], i + 1, `Member ${i + 1}`]);
        }
        await conn.commit();
        const [newTeam] = await conn.query('SELECT * FROM teams WHERE id = ?', [result.insertId]);
        res.status(201).json(newTeam[0]);
    } catch (e) { await conn.rollback(); res.status(500).json({ error: e.message }); }
    finally { conn.release(); }
});

app.put('/api/teams/:id', async (req, res) => {
    const { name, shortName, institution, members } = req.body;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const memberList = members ? members.split(/[;,]/).map(m => m.trim()).filter(m => m) : [];
        await conn.query(
            `UPDATE teams SET name = ?, short_name = ?, institution = ?, members = ?, member_count = ? WHERE id = ?`,
            [name, shortName, institution || '', memberList.join(', '), memberList.length, req.params.id]);
        await conn.query('DELETE FROM team_members WHERE team_id = ?', [req.params.id]);
        for (let i = 0; i < memberList.length; i++) {
            await conn.query(
                `INSERT INTO team_members (team_id, member_name, member_order, member_role) VALUES (?, ?, ?, ?)`,
                [req.params.id, memberList[i], i + 1, `Member ${i + 1}`]);
        }
        await conn.commit();
        const [updated] = await conn.query('SELECT * FROM teams WHERE id = ?', [req.params.id]);
        res.json(updated[0]);
    } catch (e) { await conn.rollback(); res.status(500).json({ error: e.message }); }
    finally { conn.release(); }
});

app.delete('/api/teams/:id', async (req, res) => {
    try { await pool.query('DELETE FROM teams WHERE id = ?', [req.params.id]); res.status(204).send(); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/teams/reorder', async (req, res) => {
    const { teams } = req.body;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        for (let i = 0; i < teams.length; i++) {
            await conn.query('UPDATE teams SET team_order = ? WHERE id = ?', [1000000 + i, teams[i].id]);
        }
        for (let i = 0; i < teams.length; i++) {
            await conn.query('UPDATE teams SET team_order = ? WHERE id = ?', [i + 1, teams[i].id]);
        }
        await conn.commit();
        res.json({ success: true });
    } catch (e) { await conn.rollback(); res.status(500).json({ error: e.message }); }
    finally { conn.release(); }
});

// ==================== ROUNDS ====================
app.get('/api/rounds/:eventId', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM rounds WHERE event_id = ? ORDER BY round_order', [req.params.eventId]);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/rounds', async (req, res) => {
    const { eventId, name, questionCount, type, difficulty, correctPoints, wrongPoints, halfPoints, passPoints, questionType } = req.body;
    try {
        const [maxOrder] = await pool.query('SELECT COALESCE(MAX(round_order), 0) + 1 as n FROM rounds WHERE event_id = ?', [eventId]);
        const [result] = await pool.query(
            `INSERT INTO rounds (event_id, round_order, name, question_count, type, difficulty, 
                correct_points, wrong_points, half_points, pass_points, question_type)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [eventId, maxOrder[0].n, name, questionCount || 9, type, difficulty,
             correctPoints ?? 0, wrongPoints ?? 0, halfPoints ?? 0, passPoints ?? 0, questionType || null]);
        const [newRound] = await pool.query('SELECT * FROM rounds WHERE id = ?', [result.insertId]);
        res.status(201).json(newRound[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/rounds/:id', async (req, res) => {
    const { name, questionCount, type, difficulty, correctPoints, wrongPoints, halfPoints, passPoints, questionType } = req.body;
    try {
        await pool.query(
            `UPDATE rounds SET name = ?, question_count = ?, type = ?, difficulty = ?,
                correct_points = ?, wrong_points = ?, half_points = ?, pass_points = ?, question_type = ?
             WHERE id = ?`,
            [name, questionCount, type, difficulty,
             correctPoints ?? 0, wrongPoints ?? 0, halfPoints ?? 0, passPoints ?? 0, questionType || null, req.params.id]);
        const [updated] = await pool.query('SELECT * FROM rounds WHERE id = ?', [req.params.id]);
        res.json(updated[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/rounds/:id', async (req, res) => {
    try { await pool.query('DELETE FROM rounds WHERE id = ?', [req.params.id]); res.status(204).send(); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== SCORES ====================
app.post('/api/scores', async (req, res) => {
    const { eventId, teamId, roundId, questionIndex, action } = req.body;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [eventRow] = await conn.query('SELECT is_paused, penalty_points FROM events WHERE id = ?', [eventId]);
        if (eventRow[0]?.is_paused) {
            await conn.rollback();
            return res.status(400).json({ error: 'Event is paused. Resume to score.' });
        }

        const [roundRow] = await conn.query('SELECT * FROM rounds WHERE id = ?', [roundId]);
        if (roundRow.length === 0) { await conn.rollback(); return res.status(400).json({ error: 'Round not found' }); }
        const round = roundRow[0];

        let points = 0;
        if (action === 'correct') points = Number(round.correct_points ?? 0);
        else if (action === 'wrong') points = Number(round.wrong_points ?? 0);
        else if (action === 'half_correct') points = Number(round.half_points ?? 0);
        else if (action === 'pass') points = Number(round.pass_points ?? 0);
        else if (action === 'penalty') points = Number(eventRow[0]?.penalty_points ?? -10);

        const [scoreResult] = await conn.query(
            'SELECT COALESCE(SUM(points), 0) as total FROM scores WHERE team_id = ?', [teamId]);
        const beforeScore = Number(scoreResult[0].total) || 0;
        const afterScore = beforeScore + points;

        const [insert] = await conn.query(
            `INSERT INTO scores (event_id, team_id, round_id, question_index, action, points, before_score, after_score)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [eventId, teamId, roundId, questionIndex, action, points, beforeScore, afterScore]);

        await conn.query(
            `INSERT INTO audit_log (event_id, action, details) VALUES (?, ?, ?)`,
            [eventId, 'score', JSON.stringify({ teamId, roundId, questionIndex, action, points })]);

        await conn.commit();
        res.status(201).json({ success: true, id: insert.insertId, beforeScore, afterScore, points });
    } catch (e) { await conn.rollback(); res.status(500).json({ error: e.message }); }
    finally { conn.release(); }
});

app.post('/api/scores/penalty', async (req, res) => {
    const { eventId, teamId, roundId, questionIndex, points, reason } = req.body;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [scoreResult] = await conn.query(
            'SELECT COALESCE(SUM(points), 0) as total FROM scores WHERE team_id = ?', [teamId]);
        const beforeScore = Number(scoreResult[0].total) || 0;
        const afterScore = beforeScore + Number(points);

        const [insert] = await conn.query(
            `INSERT INTO scores (event_id, team_id, round_id, question_index, action, points, before_score, after_score)
             VALUES (?, ?, ?, ?, 'penalty', ?, ?, ?)`,
            [eventId, teamId, roundId, questionIndex || 0, points, beforeScore, afterScore]);

        await conn.query(
            `INSERT INTO audit_log (event_id, action, details) VALUES (?, 'penalty', ?)`,
            [eventId, JSON.stringify({ teamId, points, reason })]);

        await conn.commit();
        res.status(201).json({ success: true, id: insert.insertId, beforeScore, afterScore, points });
    } catch (e) { await conn.rollback(); res.status(500).json({ error: e.message }); }
    finally { conn.release(); }
});

app.delete('/api/scores/undo/:teamId/:roundId', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [last] = await conn.query(
            `SELECT * FROM scores WHERE team_id = ? AND round_id = ? ORDER BY id DESC LIMIT 1`,
            [req.params.teamId, req.params.roundId]);
        if (last.length === 0) {
            await conn.rollback();
            return res.status(404).json({ error: 'No score to undo' });
        }
        await conn.query('DELETE FROM scores WHERE id = ?', [last[0].id]);
        await conn.query(
            `INSERT INTO audit_log (event_id, action, details) VALUES (?, 'undo', ?)`,
            [last[0].event_id, JSON.stringify({ restoredScore: last[0].before_score, teamId: req.params.teamId })]);
        await conn.commit();
        res.json({ success: true, restoredScore: last[0].before_score });
    } catch (e) { await conn.rollback(); res.status(500).json({ error: e.message }); }
    finally { conn.release(); }
});

app.get('/api/scores/history/:eventId', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT s.*, t.name as team_name, r.name as round_name
             FROM scores s JOIN teams t ON s.team_id = t.id JOIN rounds r ON s.round_id = r.id
             WHERE s.event_id = ? ORDER BY s.timestamp DESC LIMIT 200`,
            [req.params.eventId]);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== RANKINGS ====================
app.get('/api/rankings/:eventId', async (req, res) => {
    try {
        const ranked = await recalcRanks(req.params.eventId);
        res.json(ranked);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== SCORING CONTROL ====================
app.get('/api/scoring/current-team/:eventId', async (req, res) => {
    try {
        const [event] = await pool.query('SELECT * FROM events WHERE id = ?', [req.params.eventId]);
        if (event.length === 0) return res.status(404).json({ error: 'Event not found' });
        const e = event[0];

        const [teams] = await pool.query('SELECT * FROM teams WHERE event_id = ? ORDER BY team_order', [req.params.eventId]);
        if (!e.current_round_id || teams.length === 0) {
            return res.json({ team: null, round: null, questionIndex: 0, regularRoundIndex: 0, teamsTotal: 0, isPaused: e.is_paused || false });
        }

        const [roundRow] = await pool.query('SELECT * FROM rounds WHERE id = ?', [e.current_round_id]);
        const round = roundRow[0];

        let currentTeam = null;
        if (round.type === 'regular') {
            const teamIndex = e.regular_round_sequence_index % teams.length;
            currentTeam = teams[teamIndex] || null;
        } else if (round.type === 'buzzer') {
            if (e.current_buzzer_team_id) {
                currentTeam = teams.find(t => t.id === e.current_buzzer_team_id) || null;
            }
        }

        const [existingScore] = await pool.query(
            `SELECT id FROM scores WHERE team_id = ? AND round_id = ? AND question_index = ? LIMIT 1`,
            [currentTeam?.id || 0, e.current_round_id, e.current_question_index]);

        res.json({
            team: currentTeam,
            round,
            questionIndex: e.current_question_index,
            regularRoundIndex: e.regular_round_sequence_index,
            teamsTotal: teams.length,
            isPaused: e.is_paused || false,
            hasScoredThisQuestion: existingScore.length > 0
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/scoring/set-buzzer-team/:eventId', async (req, res) => {
    const { teamId } = req.body;
    try {
        await pool.query(
            `UPDATE events SET current_buzzer_team_id = ? WHERE id = ?`,
            [teamId, req.params.eventId]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ SPLASH CONTROL ============
// Show "Round Completed" splash in audience
app.post('/api/scoring/show-round-completed/:eventId', async (req, res) => {
    try {
        const [eventRow] = await pool.query('SELECT current_round_id FROM events WHERE id = ?', [req.params.eventId]);
        await pool.query(
            `UPDATE events SET show_splash = 'round_completed', splash_round_id = ? WHERE id = ?`,
            [eventRow[0]?.current_round_id, req.params.eventId]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ NEW: Show "Next Round" splash in audience immediately when round completes
app.post('/api/scoring/show-next-round/:eventId', async (req, res) => {
    try {
        const [eventRow] = await pool.query('SELECT current_round_id FROM events WHERE id = ?', [req.params.eventId]);
        const currentRoundId = eventRow[0]?.current_round_id;

        if (!currentRoundId) {
            return res.status(400).json({ error: 'No current round' });
        }

        const [currentRoundRow] = await pool.query('SELECT round_order FROM rounds WHERE id = ?', [currentRoundId]);
        const currentOrder = currentRoundRow[0]?.round_order;

        const [nextRounds] = await pool.query(
            'SELECT id, name, round_order FROM rounds WHERE event_id = ? AND round_order > ? ORDER BY round_order ASC LIMIT 1',
            [req.params.eventId, currentOrder]
        );

        if (nextRounds.length === 0) {
            return res.status(404).json({ error: 'No next round exists' });
        }

        const nr = nextRounds[0];

        await pool.query(
            `UPDATE events SET show_splash = 'next_round', splash_round_id = ? WHERE id = ?`,
            [nr.id, req.params.eventId]
        );

        res.json({ success: true, nextRound: nr });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get splash state (used by audience)
app.get('/api/event/splash/:eventId', async (req, res) => {
    try {
        const [event] = await pool.query(
            `SELECT e.show_splash, e.splash_round_id, e.is_started, e.is_paused,
                r.name as splash_round_name, r.round_order as splash_round_order
             FROM events e
             LEFT JOIN rounds r ON e.splash_round_id = r.id
             WHERE e.id = ?`,
            [req.params.eventId]
        );

        const row = event[0];

        // ⭐ If event isn't started, don't return any splash
        if (!row || !row.is_started) {
            return res.json({ show_splash: null, splash_round_id: null });
        }

        res.json(row);
    } catch (e) { res.status(500).json({ error: e.message }); }
});
// Show "Event Complete" splash
app.post('/api/scoring/show-event-completed/:eventId', async (req, res) => {
    try {
        await pool.query(
            `UPDATE events SET show_splash = 'event_completed', splash_round_id = NULL WHERE id = ?`,
            [req.params.eventId]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Clear splash (called by audience after auto-hide, or by operator)
app.post('/api/scoring/clear-splash/:eventId', async (req, res) => {
    try {
        await pool.query(
            `UPDATE events SET show_splash = NULL WHERE id = ?`,
            [req.params.eventId]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Move to next round (called from popup)
app.post('/api/scoring/next-round/:eventId', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [eventRow] = await conn.query('SELECT * FROM events WHERE id = ?', [req.params.eventId]);
        const e = eventRow[0];

        const [currentRoundRow] = await conn.query('SELECT * FROM rounds WHERE id = ?', [e.current_round_id]);
        const currentRound = currentRoundRow[0];

        const [nextRounds] = await conn.query(
            'SELECT * FROM rounds WHERE event_id = ? AND round_order > ? ORDER BY round_order LIMIT 1',
            [req.params.eventId, currentRound.round_order]
        );

        if (nextRounds.length === 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'No more rounds' });
        }

        const nextRound = nextRounds[0];

        // Advance regular round sequence if current round was regular
        let newRegular = e.regular_round_sequence_index;
        if (currentRound.type === 'regular') {
            newRegular = e.regular_round_sequence_index + 1;
        }

                await conn.query(
            `UPDATE events SET 
                current_round_id = ?, 
                current_question_index = 0, 
                regular_round_sequence_index = ?, 
                current_buzzer_team_id = NULL,
                show_splash = NULL,
                splash_round_id = NULL
             WHERE id = ?`,
            [nextRound.id, newRegular, req.params.eventId]
        );

        await conn.commit();
        res.json({ success: true, nextRoundId: nextRound.id, nextRoundName: nextRound.name, nextRoundOrder: nextRound.round_order });
    } catch (e) { await conn.rollback(); res.status(500).json({ error: e.message }); }
    finally { conn.release(); }
});

// ============ NEXT QUESTION — Enforces score gate for ALL rounds ============
// ============ NEXT QUESTION — Enforces score gate + signals round completion ============
app.post('/api/scoring/next-question/:eventId', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [eventRow] = await conn.query('SELECT * FROM events WHERE id = ?', [req.params.eventId]);
        const e = eventRow[0];

        const [roundRow] = await conn.query('SELECT * FROM rounds WHERE id = ?', [e.current_round_id]);
        const round = roundRow[0];

        const [teams] = await conn.query('SELECT * FROM teams WHERE event_id = ? ORDER BY team_order', [req.params.eventId]);
        let currentTeamId = null;

        if (round.type === 'regular') {
            currentTeamId = teams[e.regular_round_sequence_index % teams.length]?.id;
        } else if (round.type === 'buzzer') {
            currentTeamId = e.current_buzzer_team_id;
        }

        // ⭐ SCORING GATE: Applies to ALL rounds (regular + buzzer)
        const [existingScore] = await conn.query(
            `SELECT id FROM scores WHERE team_id = ? AND round_id = ? AND question_index = ? LIMIT 1`,
            [currentTeamId, e.current_round_id, e.current_question_index]);

        if (existingScore.length === 0) {
            await conn.rollback();
            return res.status(400).json({
                error: 'Assign a score first before moving to next question',
                needsScore: true
            });
        }

        let newQ = e.current_question_index + 1;

        // ⭐ If last question of this round → DON'T auto-advance. Signal round completion.
        if (newQ >= round.question_count) {
            const [nextRounds] = await conn.query(
                'SELECT * FROM rounds WHERE event_id = ? AND round_order > ? ORDER BY round_order LIMIT 1',
                [req.params.eventId, round.round_order]);

            // Just increment question index (so UI knows it's now past last)
            await conn.query(
                `UPDATE events SET current_question_index = ? WHERE id = ?`,
                [newQ, req.params.eventId]
            );
            await conn.commit();

            if (nextRounds.length === 0) {
                return res.json({
                    success: true,
                    finished: true,
                    roundCompleted: true,
                    currentQuestionIndex: newQ,
                    hasNextRound: false,
                    currentRoundId: round.id,
                    currentRoundName: round.name,
                    currentRoundOrder: round.round_order
                });
            }

            return res.json({
                success: true,
                roundCompleted: true,
                currentQuestionIndex: newQ,
                hasNextRound: true,
                currentRoundId: round.id,
                currentRoundName: round.name,
                currentRoundOrder: round.round_order
            });
        }

        // Normal next question (not last)
        let newRegular = e.regular_round_sequence_index;
        if (round.type === 'regular') {
            newRegular = e.regular_round_sequence_index + 1;
        }

        await conn.query(
            `UPDATE events SET current_question_index = ?, regular_round_sequence_index = ?, current_buzzer_team_id = NULL WHERE id = ?`,
            [newQ, newRegular, req.params.eventId]);

        await conn.commit();
        res.json({
            success: true,
            currentQuestionIndex: newQ,
            regularRoundIndex: newRegular,
            currentRoundId: e.current_round_id,
            isNewRound: false
        });
    } catch (e) { await conn.rollback(); res.status(500).json({ error: e.message }); }
    finally { conn.release(); }
});

app.post('/api/scoring/set-round/:eventId/:roundId', async (req, res) => {
    try {
        await pool.query(
            `UPDATE events SET current_round_id = ?, current_question_index = 0, current_buzzer_team_id = NULL WHERE id = ?`,
            [req.params.roundId, req.params.eventId]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== IMPORT ====================
app.get('/api/import/template', (req, res) => {
    const wb = xlsx.utils.book_new();

    const teamsData = [
        ['Team Order', 'Team Name', 'Short Name', 'Institution', 'Members'],
        [1, 'A', '1', 'A1 University', 'A1;A2;A3']
    ];
    xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(teamsData), 'Teams');

    const roundsData = [
        ['Type', 'Round No.', 'Round Name', 'Type', 'Level', 'Positive', 'Negative', 'Half', 'Pass'],
        ['R', 1, 'One Line. One Brand.', 'DIRECT', 'EASY', 10, 0, 5, 0]
    ];
    xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(roundsData), 'Rounds');

    const settingsData = [
        ['Penalty Points', 'Tie Break Rule', 'Event Name'],
        [-10, 'SCORE,CORRECT_COUNT,FEWER_WRONG,FEWER_PENALTIES,ALPHABETICAL', 'Ex-Quiz-It 2026']
    ];
    xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(settingsData), 'Settings');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=ex-quiz-it-template.xlsx');
    res.send(buffer);
});

app.post('/api/import/preview/:eventId', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
        const preview = { teams: [], rounds: [], settings: {}, sheetsFound: wb.SheetNames };

        if (wb.Sheets['Teams']) {
            const data = xlsx.utils.sheet_to_json(wb.Sheets['Teams']);
            preview.teams = data.map(row => ({
                teamOrder: row['Team Order'] || '',
                teamName: row['Team Name'] || row['TeamName'] || '',
                shortName: row['Short Name'] || row['ShortName'] || '',
                institution: row.Institution || '',
                members: (row.Members || '').toString().split(/[;,]/).map(m => m.trim()).filter(m => m)
            })).filter(t => t.teamName && t.shortName);
        }

        if (wb.Sheets['Rounds']) {
            const data = xlsx.utils.sheet_to_json(wb.Sheets['Rounds']);

            if (data.length > 0) {
                console.log('📋 Rounds columns found:', Object.keys(data[0]));
            }

            preview.rounds = data.map(row => {
                const isNewFormat =
                    row['Positive'] !== undefined ||
                    row['Negative'] !== undefined ||
                    row['Level'] !== undefined ||
                    row['Round No.'] !== undefined;

                if (isNewFormat) {
                    const roundTypeRaw = (row['Type'] || '').toString().toUpperCase();
                    const secondType = row['Type_1'] || row['_1'] || row['Format'] || null;

                    return {
                        roundOrder: parseNum(row['Round No.'], 0),
                        roundName: row['Round Name'] || '',
                        type: roundTypeRaw === 'BUZZER' ? 'buzzer' : 'regular',
                        questionType: secondType,
                        difficulty: (row['Level'] || 'easy').toString().toLowerCase(),
                        questions: 9,
                        correctPoints: parseNum(row['Positive'], 0),
                        wrongPoints: parseNum(row['Negative'], 0),
                        halfPoints: parseNum(row['Half'], 0),
                        passPoints: parseNum(row['Pass'], 0)
                    };
                } else {
                    return {
                        roundOrder: parseNum(row['Round Order'], 0),
                        roundName: row['Round Name'] || row['RoundName'] || '',
                        type: (row.Type || 'REGULAR').toString().toUpperCase() === 'BUZZER' ? 'buzzer' : 'regular',
                        questionType: null,
                        difficulty: (row.Difficulty || 'easy').toString().toLowerCase(),
                        questions: parseNum(row.Questions, 9),
                        correctPoints: parseNum(row['Correct Points'], 0),
                        wrongPoints: parseNum(row['Wrong Points'], 0),
                        halfPoints: parseNum(row['Half Points'], 0),
                        passPoints: parseNum(row['Pass Points'], 0)
                    };
                }
            }).filter(r => r.roundName);
        }

        if (wb.Sheets['Settings']) {
            const data = xlsx.utils.sheet_to_json(wb.Sheets['Settings']);
            if (data[0]) {
                preview.settings = {
                    penaltyPoints: parseNum(data[0]['Penalty Points'], -10),
                    eventName: data[0]['Event Name'] || '',
                    tieBreakRule: data[0]['Tie Break Rule'] || ''
                };
            }
        }

        res.json({ success: true, preview });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/import/full/:eventId', upload.single('file'), async (req, res) => {
    console.log('\n========== IMPORT (REPLACE MODE) ==========');
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
        const conn = await pool.getConnection();
        const results = { teams: [], rounds: [], settings: {}, errors: [] };

        try {
            await conn.beginTransaction();

            console.log('🗑️ Clearing existing data...');
            await conn.query('DELETE FROM rank_history WHERE event_id = ?', [req.params.eventId]);
            await conn.query('DELETE FROM scores WHERE event_id = ?', [req.params.eventId]);
            await conn.query('DELETE FROM team_members WHERE team_id IN (SELECT id FROM teams WHERE event_id = ?)', [req.params.eventId]);
            await conn.query('DELETE FROM teams WHERE event_id = ?', [req.params.eventId]);
            await conn.query('DELETE FROM rounds WHERE event_id = ?', [req.params.eventId]);
            await conn.query(
                'UPDATE events SET current_round_id = NULL, current_question_index = 0, regular_round_sequence_index = 0, is_started = FALSE, is_paused = FALSE, current_buzzer_team_id = NULL WHERE id = ?',
                [req.params.eventId]);

            await conn.query('ALTER TABLE teams AUTO_INCREMENT = 1');
            await conn.query('ALTER TABLE rounds AUTO_INCREMENT = 1');

            if (wb.Sheets['Teams']) {
                const teamsData = xlsx.utils.sheet_to_json(wb.Sheets['Teams']);
                let order = 0;
                for (const row of teamsData) {
                    const teamName = (row['Team Name'] || row['TeamName'] || '').toString().trim();
                    const shortName = (row['Short Name'] || row['ShortName'] || '').toString().trim();
                    if (!teamName || !shortName) continue;

                    const memberList = row.Members
                        ? row.Members.toString().split(/[;,]/).map(m => m.trim()).filter(m => m)
                        : [];

                    order++;
                    const [r] = await conn.query(
                        `INSERT INTO teams (event_id, team_order, name, short_name, institution, members, member_count)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [req.params.eventId, order, teamName, shortName,
                         (row.Institution || '').toString().trim(), memberList.join(', '), memberList.length]);

                    for (let i = 0; i < memberList.length; i++) {
                        await conn.query(
                            `INSERT INTO team_members (team_id, member_name, member_order, member_role) VALUES (?, ?, ?, ?)`,
                            [r.insertId, memberList[i], i + 1, `Member ${i + 1}`]);
                    }
                    results.teams.push({ teamName, shortName, members: memberList });
                }
            }

            if (wb.Sheets['Rounds']) {
                const roundsData = xlsx.utils.sheet_to_json(wb.Sheets['Rounds']);
                let order = 0;

                if (roundsData.length > 0) {
                    console.log('📋 Rounds columns found:', Object.keys(roundsData[0]));
                }

                for (const row of roundsData) {
                    const roundName = (row['Round Name'] || row['RoundName'] || '').toString().trim();
                    if (!roundName) continue;

                    const isNewFormat =
                        row['Positive'] !== undefined ||
                        row['Negative'] !== undefined ||
                        row['Level'] !== undefined ||
                        row['Round No.'] !== undefined;

                    let roundType, difficulty, questions, correctPoints, wrongPoints, halfPoints, passPoints, questionType, roundOrder;

                    if (isNewFormat) {
                        const typeRaw = (row['Type'] || '').toString().toUpperCase();
                        roundType = typeRaw === 'BUZZER' ? 'buzzer' : 'regular';
                        questionType = row['Type_1'] || row['_1'] || row['Format'] || null;

                        const levelRaw = (row['Level'] || 'easy').toString().toLowerCase();
                        difficulty = ['easy', 'moderate', 'hard'].includes(levelRaw) ? levelRaw : 'easy';

                        questions = 9;
                        correctPoints = parseNum(row['Positive'], 0);
                        wrongPoints = parseNum(row['Negative'], 0);
                        halfPoints = parseNum(row['Half'], 0);
                        passPoints = parseNum(row['Pass'], 0);
                        roundOrder = parseNum(row['Round No.'], order + 1);
                    } else {
                        roundType = (row.Type || 'REGULAR').toString().toUpperCase() === 'BUZZER' ? 'buzzer' : 'regular';
                        questionType = null;
                        const diffRaw = (row.Difficulty || 'easy').toString().toLowerCase();
                        difficulty = ['easy', 'moderate', 'hard'].includes(diffRaw) ? diffRaw : 'easy';
                        questions = parseNum(row.Questions, 9);
                        correctPoints = parseNum(row['Correct Points'], 0);
                        wrongPoints = parseNum(row['Wrong Points'], 0);
                        halfPoints = parseNum(row['Half Points'], 0);
                        passPoints = parseNum(row['Pass Points'], 0);
                        roundOrder = parseNum(row['Round Order'], order + 1);
                    }

                    order++;

                    await conn.query(
                        `INSERT INTO rounds (event_id, round_order, name, question_count, type, difficulty,
                            correct_points, wrong_points, half_points, pass_points, question_type)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            req.params.eventId,
                            roundOrder || order,
                            roundName,
                            questions,
                            roundType,
                            difficulty,
                            correctPoints,
                            wrongPoints,
                            halfPoints,
                            passPoints,
                            questionType
                        ]);

                    results.rounds.push({ roundName, type: roundType, difficulty });
                }
            }

            if (wb.Sheets['Settings']) {
                const settingsData = xlsx.utils.sheet_to_json(wb.Sheets['Settings']);
                for (const row of settingsData) {
                    if (row['Penalty Points'] !== undefined) {
                        await conn.query('UPDATE events SET penalty_points = ? WHERE id = ?',
                            [parseNum(row['Penalty Points'], -10), req.params.eventId]);
                        results.settings.penalty = parseNum(row['Penalty Points'], -10);
                    }
                    if (row['Event Name']) {
                        await conn.query('UPDATE events SET name = ? WHERE id = ?',
                            [row['Event Name'], req.params.eventId]);
                        results.settings.eventName = row['Event Name'];
                    }
                    if (row['Tie Break Rule']) {
                        await conn.query('UPDATE events SET tie_break_rule = ? WHERE id = ?',
                            [row['Tie Break Rule'], req.params.eventId]);
                        results.settings.tieBreakRule = row['Tie Break Rule'];
                    }
                }
            }

            await conn.commit();
            console.log('✅ IMPORT SUCCESSFUL');
            res.json({
                success: true,
                results,
                summary: {
                    teamsImported: results.teams.length,
                    roundsImported: results.rounds.length,
                    settingsUpdated: Object.keys(results.settings).length,
                    errorsCount: results.errors.length
                }
            });
        } catch (e) { await conn.rollback(); throw e; }
        finally { conn.release(); }
    } catch (e) {
        console.error('❌ Import error:', e);
        res.status(500).json({ error: e.message, sqlMessage: e.sqlMessage });
    }
});

app.get('/api/import/export-results/:eventId', async (req, res) => {
    try {
        const wb = xlsx.utils.book_new();

        const ranked = await recalcRanks(req.params.eventId);
        const rankingData = [
            ['Rank', 'Team', 'Short Name', 'Institution', 'Score', 'Correct', 'Wrong', 'Half', 'Pass', 'Penalty', 'Total']
        ];
        ranked.forEach(r => {
            rankingData.push([
                r.rank, r.name, r.short_name, r.institution || '',
                r.total_score, r.correct_count, r.wrong_count,
                r.half_count, r.pass_count, r.penalty_count, r.total_answers
            ]);
        });
        xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(rankingData), 'Final Rankings');

        const [history] = await pool.query(
            `SELECT s.timestamp, t.name as team_name, r.name as round_name,
                s.question_index, s.action, s.points, s.before_score, s.after_score
             FROM scores s JOIN teams t ON s.team_id = t.id JOIN rounds r ON s.round_id = r.id
             WHERE s.event_id = ? ORDER BY s.timestamp ASC`,
            [req.params.eventId]);
        const historyData = [['Time', 'Team', 'Round', 'Q#', 'Action', 'Points', 'Before', 'After']];
        history.forEach(h => {
            historyData.push([
                new Date(h.timestamp).toLocaleString(), h.team_name, h.round_name,
                h.question_index + 1, h.action, h.points, h.before_score, h.after_score
            ]);
        });
        xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(historyData), 'Score History');

        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=ex-quiz-it-results.xlsx');
        res.send(buffer);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== START ====================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server (local):   http://localhost:${PORT}`);
    console.log(`🚀 Server (network): http://10.10.17.95:${PORT}`);
    console.log(`📊 DB: ${process.env.DB_NAME || 'ex_quiz_it'}`);
    console.log(`✅ All routes loaded!`);
});