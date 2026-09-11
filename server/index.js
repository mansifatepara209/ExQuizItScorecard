import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import multer from 'multer';
import xlsx from 'xlsx';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ex_quiz_it',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

pool.getConnection()
    .then(conn => { console.log('✅ MySQL connected'); conn.release(); })
    .catch(err => console.error('❌ MySQL failed:', err.message));

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ==================== HELPERS ====================
async function recalcRanks(eventId) {
    const [rows] = await pool.query(
        `SELECT t.id, t.team_order, t.name, t.short_name, t.institution,
            COALESCE(SUM(s.points), 0) as total_score,
            SUM(CASE WHEN s.action = 'correct' THEN 1 ELSE 0 END) as correct_count,
            SUM(CASE WHEN s.action = 'wrong' THEN 1 ELSE 0 END) as wrong_count,
            SUM(CASE WHEN s.action = 'half_correct' THEN 1 ELSE 0 END) as half_count,
            SUM(CASE WHEN s.action = 'penalty' THEN 1 ELSE 0 END) as penalty_count,
            COUNT(s.id) as total_answers
         FROM teams t
         LEFT JOIN scores s ON t.id = s.team_id
         WHERE t.event_id = ?
         GROUP BY t.id
         ORDER BY total_score DESC, correct_count DESC, wrong_count ASC, t.team_order ASC`,
        [eventId]
    );

    let prevScore = null, prevCorrect = null, prevWrong = null;
    let currentRank = 0;
    return rows.map((r, i) => {
        const score = Number(r.total_score);
        const correct = Number(r.correct_count);
        const wrong = Number(r.wrong_count);
        if (prevScore !== score || prevCorrect !== correct || prevWrong !== wrong) {
            currentRank = i + 1;
            prevScore = score; prevCorrect = correct; prevWrong = wrong;
        }
        return {
            ...r,
            total_score: score,
            correct_count: correct,
            wrong_count: wrong,
            half_count: Number(r.half_count),
            penalty_count: Number(r.penalty_count),
            total_answers: Number(r.total_answers),
            rank: currentRank
        };
    });
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
            `UPDATE events SET is_started = TRUE, current_round_id = ?, current_question_index = 0, regular_round_sequence_index = 0
             WHERE id = ?`,
            [rounds[0].id, req.params.eventId]
        );

        await conn.commit();
        res.json({ success: true, currentRoundId: rounds[0].id });
    } catch (e) {
        await conn.rollback();
        res.status(500).json({ error: e.message });
    } finally { conn.release(); }
});

app.post('/api/event/stop/:eventId', async (req, res) => {
    try {
        await pool.query('UPDATE events SET is_started = FALSE WHERE id = ?', [req.params.eventId]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/event/reset/:eventId', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query('DELETE FROM scores WHERE event_id = ?', [req.params.eventId]);
        await conn.query(
            `UPDATE events SET is_started = FALSE, current_round_id = NULL, current_question_index = 0, regular_round_sequence_index = 0
             WHERE id = ?`,
            [req.params.eventId]
        );
        await conn.commit();
        res.json({ success: true });
    } catch (e) {
        await conn.rollback();
        res.status(500).json({ error: e.message });
    } finally { conn.release(); }
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
            `UPDATE events SET is_started = FALSE, current_round_id = NULL, current_question_index = 0, regular_round_sequence_index = 0
             WHERE id = ?`,
            [req.params.eventId]
        );
        await conn.commit();
        res.json({ success: true });
    } catch (e) {
        await conn.rollback();
        res.status(500).json({ error: e.message });
    } finally { conn.release(); }
});

app.get('/api/event/config/:eventId', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM scoring_config WHERE event_id = ?', [req.params.eventId]);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/event/config/:eventId', async (req, res) => {
    const { config } = req.body;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        for (const [action, points] of Object.entries(config)) {
            await conn.query(
                `INSERT INTO scoring_config (event_id, action, points) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE points = VALUES(points)`,
                [req.params.eventId, action, points]);
        }
        await conn.commit();
        res.json({ success: true });
    } catch (e) {
        await conn.rollback();
        res.status(500).json({ error: e.message });
    } finally { conn.release(); }
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
    const { eventId, name, questionCount, type, difficulty, correctPoints, wrongPoints, halfPoints, passPoints } = req.body;
    try {
        const [maxOrder] = await pool.query('SELECT COALESCE(MAX(round_order), 0) + 1 as n FROM rounds WHERE event_id = ?', [eventId]);
        const [result] = await pool.query(
            `INSERT INTO rounds (event_id, round_order, name, question_count, type, difficulty, 
                correct_points, wrong_points, half_points, pass_points)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [eventId, maxOrder[0].n, name, questionCount || 0, type, difficulty,
             correctPoints ?? 10, wrongPoints ?? -5, halfPoints ?? 5, passPoints ?? 0]);
        const [newRound] = await pool.query('SELECT * FROM rounds WHERE id = ?', [result.insertId]);
        res.status(201).json(newRound[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/rounds/:id', async (req, res) => {
    const { name, questionCount, type, difficulty, correctPoints, wrongPoints, halfPoints, passPoints } = req.body;
    try {
        await pool.query(
            `UPDATE rounds SET name = ?, question_count = ?, type = ?, difficulty = ?,
                correct_points = ?, wrong_points = ?, half_points = ?, pass_points = ?
             WHERE id = ?`,
            [name, questionCount, type, difficulty,
             correctPoints ?? 10, wrongPoints ?? -5, halfPoints ?? 5, passPoints ?? 0, req.params.id]);
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

        const [roundRow] = await conn.query('SELECT * FROM rounds WHERE id = ?', [roundId]);
        if (roundRow.length === 0) { await conn.rollback(); return res.status(400).json({ error: 'Round not found' }); }
        const round = roundRow[0];

        let points = 0;
        if (action === 'correct') points = Number(round.correct_points ?? 10);
        else if (action === 'wrong') points = Number(round.wrong_points ?? -5);
        else if (action === 'half_correct') points = Number(round.half_points ?? 5);
        else if (action === 'pass') points = Number(round.pass_points ?? 0);
        else if (action === 'penalty') points = -10;

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

// Custom penalty with reason
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
        if (last.length === 0) return res.status(404).json({ error: 'No score to undo' });
        await conn.query('DELETE FROM scores WHERE id = ?', [last[0].id]);
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
// Get current team (auto-rotate)
app.get('/api/scoring/current-team/:eventId', async (req, res) => {
    try {
        const [event] = await pool.query('SELECT * FROM events WHERE id = ?', [req.params.eventId]);
        if (event.length === 0) return res.status(404).json({ error: 'Event not found' });
        const e = event[0];

        const [teams] = await pool.query('SELECT * FROM teams WHERE event_id = ? ORDER BY team_order', [req.params.eventId]);
        if (!e.current_round_id || teams.length === 0) {
            return res.json({ team: null, round: null, questionIndex: 0, regularRoundIndex: 0, teamsTotal: 0 });
        }

        const [roundRow] = await pool.query('SELECT * FROM rounds WHERE id = ?', [e.current_round_id]);
        const round = roundRow[0];

        let teamIndex = 0;
        if (round.type === 'regular') {
            teamIndex = e.regular_round_sequence_index % teams.length;
        }

        res.json({
            team: teams[teamIndex] || null,
            round,
            questionIndex: e.current_question_index,
            regularRoundIndex: e.regular_round_sequence_index,
            teamsTotal: teams.length
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Advance to next question (and rotate team if regular)
app.post('/api/scoring/next-question/:eventId', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [eventRow] = await conn.query('SELECT * FROM events WHERE id = ?', [req.params.eventId]);
        const e = eventRow[0];

        const [roundRow] = await conn.query('SELECT * FROM rounds WHERE id = ?', [e.current_round_id]);
        const round = roundRow[0];

        let newQ = e.current_question_index + 1;
        let newRegular = e.regular_round_sequence_index;
        let newRoundId = e.current_round_id;
        let isNewRound = false;

        if (newQ >= round.question_count) {
            const [nextRounds] = await conn.query(
                'SELECT * FROM rounds WHERE event_id = ? AND round_order > ? ORDER BY round_order LIMIT 1',
                [req.params.eventId, round.round_order]);
            if (nextRounds.length > 0) {
                newRoundId = nextRounds[0].id;
                newQ = 0;
                isNewRound = true;
            } else {
                await conn.commit();
                return res.json({ success: true, finished: true, currentQuestionIndex: newQ });
            }
        }

        if (round.type === 'regular') {
            newRegular = e.regular_round_sequence_index + 1;
        }

        await conn.query(
            `UPDATE events SET current_question_index = ?, regular_round_sequence_index = ?, current_round_id = ?
             WHERE id = ?`,
            [newQ, newRegular, newRoundId, req.params.eventId]);

        await conn.commit();
        res.json({
            success: true,
            currentQuestionIndex: newQ,
            regularRoundIndex: newRegular,
            currentRoundId: newRoundId,
            isNewRound
        });
    } catch (e) { await conn.rollback(); res.status(500).json({ error: e.message }); }
    finally { conn.release(); }
});

// Set round manually (for buzzer)
app.post('/api/scoring/set-round/:eventId/:roundId', async (req, res) => {
    try {
        await pool.query(
            `UPDATE events SET current_round_id = ?, current_question_index = 0 WHERE id = ?`,
            [req.params.roundId, req.params.eventId]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== IMPORT ====================
app.get('/api/import/template', (req, res) => {
    const wb = xlsx.utils.book_new();

    const teamsData = [
        ['Team Order', 'Team Name', 'Short Name', 'Institution', 'Members'],
        [1, 'Team Alpha', 'ALP', 'Sample University', 'Alice; Bob; Carol'],
        [2, 'Team Beta', 'BET', 'Sample College', 'Dave; Eve; Carl']
    ];
    xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(teamsData), 'Teams');

    const roundsData = [
        ['Round Order', 'Round Name', 'Type', 'Difficulty', 'Questions', 'Correct Points', 'Wrong Points', 'Half Points', 'Pass Points'],
        [1, 'General Knowledge', 'REGULAR', 'EASY', 10, 10, -5, 5, 0],
        [2, 'Rapid Fire', 'BUZZER', 'MODERATE', 15, 10, -5, 5, 0]
    ];
    xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(roundsData), 'Rounds');

    const settingsData = [
        ['Penalty Points', 'Tie Break Rule', 'Event Name'],
        [-10, 'SCORE,CORRECT_COUNT,ALPHABETICAL', 'Ex-Quiz-It 2026']
    ];
    xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(settingsData), 'Settings');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=ex-quiz-it-template.xlsx');
    res.send(buffer);
});

// Preview import
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
            preview.rounds = data.map(row => ({
                roundOrder: row['Round Order'] || '',
                roundName: row['Round Name'] || row['RoundName'] || '',
                type: (row.Type || 'REGULAR').toString().toUpperCase() === 'BUZZER' ? 'buzzer' : 'regular',
                difficulty: (row.Difficulty || 'easy').toString().toLowerCase(),
                questions: parseInt(row.Questions) || 0,
                correctPoints: parseInt(row['Correct Points']) || 10,
                wrongPoints: parseInt(row['Wrong Points']) ?? -5,
                halfPoints: parseInt(row['Half Points']) || 5,
                passPoints: parseInt(row['Pass Points']) || 0
            })).filter(r => r.roundName);
        }

        if (wb.Sheets['Settings']) {
            const data = xlsx.utils.sheet_to_json(wb.Sheets['Settings']);
            if (data[0]) {
                preview.settings = {
                    penaltyPoints: parseInt(data[0]['Penalty Points']) ?? -10,
                    eventName: data[0]['Event Name'] || '',
                    tieBreakRule: data[0]['Tie Break Rule'] || ''
                };
            }
        }

        res.json({ success: true, preview });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Full import — REPLACES ALL DATA
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
                'UPDATE events SET current_round_id = NULL, current_question_index = 0, regular_round_sequence_index = 0, is_started = FALSE WHERE id = ?',
                [req.params.eventId]);

            await conn.query('ALTER TABLE teams AUTO_INCREMENT = 1');
            await conn.query('ALTER TABLE rounds AUTO_INCREMENT = 1');

            // TEAMS
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

            // ROUNDS
            if (wb.Sheets['Rounds']) {
                const roundsData = xlsx.utils.sheet_to_json(wb.Sheets['Rounds']);
                let order = 0;
                for (const row of roundsData) {
                    const roundName = (row['Round Name'] || row['RoundName'] || '').toString().trim();
                    if (!roundName) continue;

                    const typeRaw = (row.Type || 'REGULAR').toString().toUpperCase();
                    const type = typeRaw === 'BUZZER' ? 'buzzer' : 'regular';
                    const diffRaw = (row.Difficulty || 'easy').toString().toLowerCase();
                    const difficulty = ['easy', 'moderate', 'hard'].includes(diffRaw) ? diffRaw : 'easy';

                    order++;
                    await conn.query(
                        `INSERT INTO rounds (event_id, round_order, name, question_count, type, difficulty,
                            correct_points, wrong_points, half_points, pass_points)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [req.params.eventId, order, roundName, parseInt(row.Questions) || 0, type, difficulty,
                         parseInt(row['Correct Points']) || 10,
                         parseInt(row['Wrong Points']) || -5,
                         parseInt(row['Half Points']) || 5,
                         parseInt(row['Pass Points']) || 0]);

                    results.rounds.push({ roundName, type, difficulty });
                }
            }

            // SETTINGS
            if (wb.Sheets['Settings']) {
                const settingsData = xlsx.utils.sheet_to_json(wb.Sheets['Settings']);
                for (const row of settingsData) {
                    if (row['Penalty Points'] !== undefined) {
                        results.settings.penalty = parseInt(row['Penalty Points']);
                    }
                    if (row['Event Name']) {
                        await conn.query('UPDATE events SET name = ? WHERE id = ?', [row['Event Name'], req.params.eventId]);
                        results.settings.eventName = row['Event Name'];
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

// Export full results
app.get('/api/import/export-results/:eventId', async (req, res) => {
    try {
        const wb = xlsx.utils.book_new();

        // Sheet 1: Final Rankings
        const ranked = await recalcRanks(req.params.eventId);
        const rankingData = [
            ['Rank', 'Team', 'Short Name', 'Institution', 'Score', 'Correct', 'Wrong', 'Half', 'Penalty', 'Total Answers']
        ];
        ranked.forEach(r => {
            rankingData.push([
                r.rank, r.name, r.short_name, r.institution || '',
                r.total_score, r.correct_count, r.wrong_count,
                r.half_count, r.penalty_count, r.total_answers
            ]);
        });
        xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(rankingData), 'Final Rankings');

        // Sheet 2: Score History
        const [history] = await pool.query(
            `SELECT s.timestamp, t.name as team_name, r.name as round_name,
                s.question_index, s.action, s.points, s.before_score, s.after_score
             FROM scores s JOIN teams t ON s.team_id = t.id JOIN rounds r ON s.round_id = r.id
             WHERE s.event_id = ? ORDER BY s.timestamp ASC`,
            [req.params.eventId]);
        const historyData = [
            ['Time', 'Team', 'Round', 'Q#', 'Action', 'Points', 'Before', 'After']
        ];
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
app.listen(PORT, () => {
    console.log(`🚀 Server: http://localhost:${PORT}`);
    console.log(`📊 DB: ${process.env.DB_NAME || 'ex_quiz_it'}`);
    console.log(`✅ All routes loaded!`);
});