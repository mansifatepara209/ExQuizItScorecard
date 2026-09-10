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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ============ HEALTH ============
app.get('/api/health', (req, res) => res.json({ status: 'OK' }));

// ============ EVENT ============
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

        const [teams] = await conn.query(
            'SELECT COUNT(*) as count FROM teams WHERE event_id = ?', [req.params.eventId]);
        if (teams[0].count === 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'No teams found. Add teams first.' });
        }

        const [rounds] = await conn.query(
            'SELECT COUNT(*) as count FROM rounds WHERE event_id = ?', [req.params.eventId]);
        if (rounds[0].count === 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'No rounds found. Add rounds first.' });
        }

        const [firstRound] = await conn.query(
            'SELECT id FROM rounds WHERE event_id = ? ORDER BY round_order LIMIT 1',
            [req.params.eventId]);

        await conn.query(
            `UPDATE events SET 
                is_started = TRUE, 
                current_round_id = ?, 
                current_question_index = 0,
                regular_round_sequence_index = 0
             WHERE id = ?`,
            [firstRound[0].id, req.params.eventId]);

        await conn.commit();
        console.log('✅ Event started');
        res.json({ 
            success: true, 
            message: 'Event started successfully!',
            currentRoundId: firstRound[0].id
        });
    } catch (e) {
        await conn.rollback();
        res.status(500).json({ error: e.message });
    } finally { conn.release(); }
});

app.post('/api/event/reset/:eventId', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query('DELETE FROM scores WHERE event_id = ?', [req.params.eventId]);
        await conn.query(
            `UPDATE events SET 
                is_started = FALSE, 
                current_round_id = NULL, 
                current_question_index = 0,
                regular_round_sequence_index = 0
             WHERE id = ?`,
            [req.params.eventId]);
        await conn.commit();
        res.json({ success: true, message: 'Event reset' });
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

// ============ TEAMS ============
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
        const [maxOrder] = await conn.query(
            'SELECT COALESCE(MAX(team_order), 0) + 1 as next_order FROM teams WHERE event_id = ?', [eventId]);
        const memberList = members ? members.split(/[;,]/).map(m => m.trim()).filter(m => m) : [];
        const [result] = await conn.query(
            `INSERT INTO teams (event_id, team_order, name, short_name, institution, members, member_count)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [eventId, maxOrder[0].next_order, name, shortName, institution || '', memberList.join(', '), memberList.length]);
        for (let i = 0; i < memberList.length; i++) {
            await conn.query(
                `INSERT INTO team_members (team_id, member_name, member_order, member_role) VALUES (?, ?, ?, ?)`,
                [result.insertId, memberList[i], i + 1, `Member ${i + 1}`]);
        }
        await conn.commit();
        const [newTeam] = await conn.query('SELECT * FROM teams WHERE id = ?', [result.insertId]);
        res.status(201).json(newTeam[0]);
    } catch (e) {
        await conn.rollback();
        res.status(500).json({ error: e.message });
    } finally { conn.release(); }
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
    } catch (e) {
        await conn.rollback();
        res.status(500).json({ error: e.message });
    } finally { conn.release(); }
});

app.delete('/api/teams/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM teams WHERE id = ?', [req.params.id]);
        res.status(204).send();
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ REORDER TEAMS (WITH SCORE PRESERVATION) ============
app.post('/api/teams/reorder', async (req, res) => {
    const { teams } = req.body;
    console.log('🔄 Reordering teams:', teams.length, 'teams');

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // Use a temporary large offset to avoid unique key conflicts
        for (let i = 0; i < teams.length; i++) {
            await conn.query(
                'UPDATE teams SET team_order = ? WHERE id = ?',
                [1000000 + i, teams[i].id]
            );
        }

        // Now set the correct order
        for (let i = 0; i < teams.length; i++) {
            await conn.query(
                'UPDATE teams SET team_order = ? WHERE id = ?',
                [i + 1, teams[i].id]
            );
        }

        await conn.commit();
        console.log('✅ Teams reordered');
        res.json({ success: true, count: teams.length });
    } catch (e) {
        await conn.rollback();
        console.error('❌ Reorder error:', e.message);
        res.status(500).json({ error: e.message });
    } finally { conn.release(); }
});

// ============ ROUNDS ============
app.get('/api/rounds/:eventId', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM rounds WHERE event_id = ? ORDER BY round_order', [req.params.eventId]);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/rounds', async (req, res) => {
    const { eventId, name, questionCount, type, difficulty } = req.body;
    try {
        const [maxOrder] = await pool.query(
            'SELECT COALESCE(MAX(round_order), 0) + 1 as next_order FROM rounds WHERE event_id = ?', [eventId]);
        const [result] = await pool.query(
            `INSERT INTO rounds (event_id, round_order, name, question_count, type, difficulty) VALUES (?, ?, ?, ?, ?, ?)`,
            [eventId, maxOrder[0].next_order, name, questionCount || 0, type, difficulty]);
        const [newRound] = await pool.query('SELECT * FROM rounds WHERE id = ?', [result.insertId]);
        res.status(201).json(newRound[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/rounds/:id', async (req, res) => {
    const { name, questionCount, type, difficulty } = req.body;
    try {
        await pool.query('UPDATE rounds SET name = ?, question_count = ?, type = ?, difficulty = ? WHERE id = ?',
            [name, questionCount, type, difficulty, req.params.id]);
        const [updated] = await pool.query('SELECT * FROM rounds WHERE id = ?', [req.params.id]);
        res.json(updated[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/rounds/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM rounds WHERE id = ?', [req.params.id]);
        res.status(204).send();
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ SCORES ============
// ============ SCORES ============
app.post('/api/scores', async (req, res) => {
    const { eventId, teamId, roundId, questionIndex, action } = req.body;
    console.log('📥 Score request:', { eventId, teamId, roundId, questionIndex, action });

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // Get points from config
        const [config] = await conn.query(
            'SELECT points FROM scoring_config WHERE event_id = ? AND action = ?',
            [eventId, action]
        );
        const points = Number(config[0]?.points ?? 0);

        // Get current score — CRITICAL: cast to Number
        const [scoreResult] = await conn.query(
            'SELECT COALESCE(SUM(points), 0) as total FROM scores WHERE team_id = ?',
            [teamId]
        );
        const beforeScore = Number(scoreResult[0].total) || 0;
        const afterScore = beforeScore + points;

        console.log('💯 Values:', { points, beforeScore, afterScore });

        // Insert with explicit Number casts
        const [insertResult] = await conn.query(
            `INSERT INTO scores (event_id, team_id, round_id, question_index, action, points, before_score, after_score)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                Number(eventId),
                Number(teamId),
                Number(roundId),
                Number(questionIndex),
                String(action),
                Number(points),
                Number(beforeScore),
                Number(afterScore)
            ]
        );

        // Log audit
        await conn.query(
            `INSERT INTO audit_log (event_id, action, details) VALUES (?, ?, ?)`,
            [Number(eventId), 'score_applied',
             JSON.stringify({ teamId, action, points, beforeScore, afterScore })]
        );

        await conn.commit();
        console.log('✅ Score saved:', insertResult.insertId);

        res.status(201).json({
            success: true,
            scoreId: insertResult.insertId,
            beforeScore,
            afterScore,
            points,
            action
        });
    } catch (e) {
        await conn.rollback();
        console.error('❌ Score error:', e.message);
        res.status(500).json({ error: e.message, sqlMessage: e.sqlMessage });
    } finally { conn.release(); }
});

app.get('/api/scores/history/:eventId', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT s.*, t.name as team_name, r.name as round_name
             FROM scores s JOIN teams t ON s.team_id = t.id JOIN rounds r ON s.round_id = r.id
             WHERE s.event_id = ? ORDER BY s.timestamp DESC LIMIT 100`,
            [req.params.eventId]);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/scores/undo/:teamId/:roundId', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [lastScore] = await conn.query(
            `SELECT * FROM scores WHERE team_id = ? AND round_id = ? ORDER BY id DESC LIMIT 1`,
            [req.params.teamId, req.params.roundId]);
        if (lastScore.length === 0) return res.status(404).json({ error: 'No score to undo' });
        await conn.query('DELETE FROM scores WHERE id = ?', [lastScore[0].id]);
        await conn.commit();
        res.json({ success: true, restoredScore: lastScore[0].before_score });
    } catch (e) {
        await conn.rollback();
        res.status(500).json({ error: e.message });
    } finally { conn.release(); }
});

app.get('/api/scores/history/:eventId', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT s.*, t.name as team_name, r.name as round_name
             FROM scores s JOIN teams t ON s.team_id = t.id JOIN rounds r ON s.round_id = r.id
             WHERE s.event_id = ? ORDER BY s.timestamp DESC LIMIT 100`,
            [req.params.eventId]);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/scores/undo/:teamId/:roundId', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [lastScore] = await conn.query(
            `SELECT * FROM scores WHERE team_id = ? AND round_id = ? ORDER BY id DESC LIMIT 1`,
            [req.params.teamId, req.params.roundId]);
        if (lastScore.length === 0) return res.status(404).json({ error: 'No score to undo' });
        await conn.query('DELETE FROM scores WHERE id = ?', [lastScore[0].id]);
        await conn.commit();
        res.json({ success: true, restoredScore: lastScore[0].before_score });
    } catch (e) {
        await conn.rollback();
        res.status(500).json({ error: e.message });
    } finally { conn.release(); }
});

// ============ RANKINGS (WITH TEAM ORDER TIEBREAKER) ============
app.get('/api/rankings/:eventId', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT t.*, 
                COALESCE(SUM(s.points), 0) as total_score,
                COUNT(s.id) as questions_answered
             FROM teams t
             LEFT JOIN scores s ON t.id = s.team_id
             WHERE t.event_id = ?
             GROUP BY t.id
             ORDER BY total_score DESC, t.team_order ASC`,
            [req.params.eventId]);
        
        // Calculate rank in JavaScript (works on any MySQL version)
        let currentRank = 1;
        let previousScore = null;
        let sameRankCount = 0;
        
        const ranked = rows.map((row, index) => {
            if (previousScore !== null && row.total_score === previousScore) {
                // Same score as previous team — use same rank
                sameRankCount++;
            } else {
                // Different score — increment rank
                currentRank = index + 1;
                sameRankCount = 0;
            }
            previousScore = row.total_score;
            
            return {
                ...row,
                rank: currentRank
            };
        });
        
        res.json(ranked);
    } catch (e) { 
        console.error('Rankings error:', e);
        res.status(500).json({ error: e.message }); 
    }
});

// ============ EXCEL TEMPLATE ============
app.get('/api/import/template', (req, res) => {
    const wb = xlsx.utils.book_new();

    const teamsData = [
        ['Team Order', 'Team Name', 'Short Name', 'Institution', 'Members'],
        [1, 'Team Alpha', 'ALP', 'Sample University', 'Alice; Bob; Carol'],
        [2, 'Team Beta', 'BET', 'Sample College', 'Dave; Eve; Carl']
    ];
    const teamsSheet = xlsx.utils.aoa_to_sheet(teamsData);
    teamsSheet['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 25 }, { wch: 30 }];
    xlsx.utils.book_append_sheet(wb, teamsSheet, 'Teams');

    const roundsData = [
        ['Round Order', 'Round Name', 'Type', 'Difficulty', 'Questions', 'Correct Points', 'Wrong Points', 'Half Points', 'Pass Points'],
        [1, 'General Knowledge', 'REGULAR', 'EASY', 10, 10, -5, 5, 0],
        [2, 'Rapid Fire', 'BUZZER', 'MODERATE', 15, 10, -5, 5, 0]
    ];
    const roundsSheet = xlsx.utils.aoa_to_sheet(roundsData);
    xlsx.utils.book_append_sheet(wb, roundsSheet, 'Rounds');

    const settingsData = [
        ['Penalty Points', 'Tie Break Rule', 'Event Name'],
        [-10, 'SCORE,CORRECT_COUNT,ALPHABETICAL', 'Ex-Quiz-It 2026']
    ];
    const settingsSheet = xlsx.utils.aoa_to_sheet(settingsData);
    xlsx.utils.book_append_sheet(wb, settingsSheet, 'Settings');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=ex-quiz-it-template.xlsx');
    res.send(buffer);
});

// ============ EXCEL IMPORT ============
app.post('/api/import/full/:eventId', upload.single('file'), async (req, res) => {
    console.log('\n========== IMPORT REQUEST ==========');
    console.log('📥 Event ID:', req.params.eventId);

    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log('📄 File:', req.file.originalname);
        console.log('📦 Size:', req.file.size, 'bytes');

        const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
        console.log('📊 Sheets found:', wb.SheetNames);

        const conn = await pool.getConnection();
        const results = { teams: [], rounds: [], settings: {}, errors: [] };

        try {
            await conn.beginTransaction();

            // TEAMS
            const teamsSheet = wb.Sheets['Teams'];
            if (teamsSheet) {
                console.log('\n👥 Processing Teams...');
                const teamsData = xlsx.utils.sheet_to_json(teamsSheet);
                console.log('   Rows:', teamsData.length);

                const [maxOrder] = await conn.query(
                    'SELECT COALESCE(MAX(team_order), 0) as max_order FROM teams WHERE event_id = ?',
                    [req.params.eventId]);
                let currentOrder = maxOrder[0].max_order;

                for (const row of teamsData) {
                    try {
                        const teamName = (row['Team Name'] || row['TeamName'] || '').toString().trim();
                        const shortName = (row['Short Name'] || row['ShortName'] || '').toString().trim();

                        if (!teamName || !shortName) {
                            results.errors.push({ sheet: 'Teams', error: 'Missing Team/Short Name', row });
                            continue;
                        }

                        const memberList = row.Members
                            ? row.Members.toString().split(/[;,]/).map(m => m.trim()).filter(m => m)
                            : [];

                        currentOrder++;

                        const [teamResult] = await conn.query(
                            `INSERT INTO teams (event_id, team_order, name, short_name, institution, members, member_count)
                             VALUES (?, ?, ?, ?, ?, ?, ?)`,
                            [req.params.eventId, currentOrder, teamName, shortName,
                             (row.Institution || '').toString().trim(), memberList.join(', '), memberList.length]);

                        for (let i = 0; i < memberList.length; i++) {
                            await conn.query(
                                `INSERT INTO team_members (team_id, member_name, member_order, member_role)
                                 VALUES (?, ?, ?, ?)`,
                                [teamResult.insertId, memberList[i], i + 1, `Member ${i + 1}`]);
                        }

                        results.teams.push({
                            teamName, shortName,
                            institution: row.Institution || '',
                            members: memberList,
                            memberCount: memberList.length
                        });
                        console.log(`   ✅ ${teamName}`);
                    } catch (err) {
                        results.errors.push({ sheet: 'Teams', error: err.message, row });
                    }
                }
            }

            // ROUNDS
            const roundsSheet = wb.Sheets['Rounds'];
            if (roundsSheet) {
                console.log('\n🔁 Processing Rounds...');
                const roundsData = xlsx.utils.sheet_to_json(roundsSheet);
                console.log('   Rows:', roundsData.length);

                const [maxRoundOrder] = await conn.query(
                    'SELECT COALESCE(MAX(round_order), 0) as max_order FROM rounds WHERE event_id = ?',
                    [req.params.eventId]);
                let currentRoundOrder = maxRoundOrder[0].max_order;

                for (const row of roundsData) {
                    try {
                        const roundName = (row['Round Name'] || row['RoundName'] || '').toString().trim();
                        if (!roundName) continue;

                        const typeRaw = (row.Type || 'REGULAR').toString().toUpperCase();
                        const type = typeRaw === 'BUZZER' ? 'buzzer' : 'regular';
                        const difficultyRaw = (row.Difficulty || 'easy').toString().toLowerCase();
                        const difficulty = ['easy', 'moderate', 'hard'].includes(difficultyRaw) ? difficultyRaw : 'easy';

                        currentRoundOrder++;

                        await conn.query(
                            `INSERT INTO rounds (event_id, round_order, name, question_count, type, difficulty)
                             VALUES (?, ?, ?, ?, ?, ?)`,
                            [req.params.eventId, currentRoundOrder, roundName,
                             parseInt(row.Questions) || 0, type, difficulty]);

                        const updates = [
                            ['correct', row['Correct Points']],
                            ['wrong', row['Wrong Points']],
                            ['half_correct', row['Half Points']],
                            ['pass', row['Pass Points']]
                        ];

                        for (const [action, value] of updates) {
                            if (value !== undefined && value !== null && value !== '') {
                                await conn.query(
                                    `INSERT INTO scoring_config (event_id, action, points) VALUES (?, ?, ?)
                                     ON DUPLICATE KEY UPDATE points = VALUES(points)`,
                                    [req.params.eventId, action, parseInt(value) || 0]);
                            }
                        }

                        results.rounds.push({
                            roundName, type, difficulty,
                            questions: parseInt(row.Questions) || 0
                        });
                        console.log(`   ✅ ${roundName}`);
                    } catch (err) {
                        results.errors.push({ sheet: 'Rounds', error: err.message, row });
                    }
                }
            }

            // SETTINGS
            const settingsSheet = wb.Sheets['Settings'];
            if (settingsSheet) {
                console.log('\n⚙️ Processing Settings...');
                const settingsData = xlsx.utils.sheet_to_json(settingsSheet);

                for (const row of settingsData) {
                    if (row['Penalty Points'] !== undefined && row['Penalty Points'] !== null) {
                        await conn.query(
                            `INSERT INTO scoring_config (event_id, action, points) VALUES (?, 'penalty', ?)
                             ON DUPLICATE KEY UPDATE points = VALUES(points)`,
                            [req.params.eventId, parseInt(row['Penalty Points']) || -10]);
                        results.settings.penalty = parseInt(row['Penalty Points']);
                    }

                    if (row['Event Name']) {
                        await conn.query('UPDATE events SET name = ? WHERE id = ?',
                            [row['Event Name'].toString().trim(), req.params.eventId]);
                        results.settings.eventName = row['Event Name'];
                    }

                    if (row['Tie Break Rule']) {
                        results.settings.tieBreakRule = row['Tie Break Rule'];
                    }
                }
            }

            await conn.commit();
            console.log('\n✅ IMPORT SUCCESSFUL');
            console.log(`   Teams: ${results.teams.length} | Rounds: ${results.rounds.length} | Errors: ${results.errors.length}`);
            console.log('=====================================\n');

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

        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    } catch (e) {
        console.error('\n❌ IMPORT FAILED:', e.message);
        res.status(500).json({ error: e.message, sqlMessage: e.sqlMessage });
    }
});

// ============ START ============
app.listen(PORT, () => {
    console.log(`🚀 Server: http://localhost:${PORT}`);
    console.log(`📊 DB: ${process.env.DB_NAME || 'ex_quiz_it'}`);
    console.log(`✅ All routes loaded!`);
});