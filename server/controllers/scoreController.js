import pool from '../database/connection.js';

export const applyScore = async (req, res) => {
    const { eventId, teamId, roundId, questionIndex, action } = req.body;
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        // Get scoring configuration
        const [config] = await connection.query(
            'SELECT points FROM scoring_config WHERE event_id = ? AND action = ?',
            [eventId, action]
        );
        const points = config[0]?.points || 0;

        // Get current team score
        const [scoreResult] = await connection.query(
            'SELECT COALESCE(SUM(points), 0) as total FROM scores WHERE team_id = ?',
            [teamId]
        );
        const beforeScore = scoreResult[0].total;
        const afterScore = beforeScore + points;

        // Insert score
        const [result] = await connection.query(
            `INSERT INTO scores (event_id, team_id, round_id, question_index, action, points, before_score, after_score)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [eventId, teamId, roundId, questionIndex, action, points, beforeScore, afterScore]
        );

        // Log audit
        await connection.query(
            `INSERT INTO audit_log (event_id, action, details) 
             VALUES (?, ?, ?)`,
            [eventId, 'score_applied', JSON.stringify({ teamId, roundId, questionIndex, action, points, beforeScore, afterScore })]
        );

        // Update event state for regular rounds
        const [round] = await connection.query(
            'SELECT type FROM rounds WHERE id = ?',
            [roundId]
        );
        
        if (round[0]?.type === 'regular') {
            await connection.query(
                `UPDATE events SET regular_round_sequence_index = regular_round_sequence_index + 1,
                 current_question_index = current_question_index + 1
                 WHERE id = ?`,
                [eventId]
            );
        } else if (round[0]?.type === 'buzzer') {
            await connection.query(
                `UPDATE events SET current_question_index = current_question_index + 1
                 WHERE id = ?`,
                [eventId]
            );
        }

        await connection.commit();
        
        const [newScore] = await connection.query(
            'SELECT * FROM scores WHERE id = ?',
            [result.insertId]
        );
        
        res.status(201).json({
            ...newScore[0],
            teamTotalScore: afterScore
        });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
};

export const undoScore = async (req, res) => {
    const { teamId, roundId } = req.params;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // Get last score
        const [lastScore] = await connection.query(
            `SELECT * FROM scores WHERE team_id = ? AND round_id = ? 
             ORDER BY id DESC LIMIT 1`,
            [teamId, roundId]
        );

        if (lastScore.length === 0) {
            return res.status(404).json({ error: 'No score to undo' });
        }

        // Delete the score
        await connection.query(
            'DELETE FROM scores WHERE id = ?',
            [lastScore[0].id]
        );

        // Log undo
        await connection.query(
            `INSERT INTO audit_log (event_id, action, details) 
             VALUES (?, ?, ?)`,
            [lastScore[0].event_id, 'undo_score', JSON.stringify({ undoneScoreId: lastScore[0].id })]
        );

        await connection.commit();
        res.json({ 
            success: true, 
            restoredScore: lastScore[0].before_score
        });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
};

export const getTeamScores = async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM scores WHERE team_id = ? ORDER BY timestamp DESC',
            [req.params.teamId]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getRoundScores = async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM scores WHERE round_id = ? ORDER BY timestamp',
            [req.params.roundId]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getScoreHistory = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT s.*, t.name as team_name, r.name as round_name
             FROM scores s
             JOIN teams t ON s.team_id = t.id
             JOIN rounds r ON s.round_id = r.id
             WHERE s.event_id = ?
             ORDER BY s.timestamp DESC
             LIMIT 100`,
            [req.params.eventId]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};