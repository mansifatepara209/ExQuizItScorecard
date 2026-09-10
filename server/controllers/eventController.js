import pool from '../database/connection.js';

export const getEventState = async (req, res) => {
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
             WHERE e.id = ?
             GROUP BY e.id`,
            [req.params.eventId]
        );
        res.json(rows[0] || null);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const updateEventState = async (req, res) => {
    const { currentRoundId, currentQuestionIndex, isStarted } = req.body;
    try {
        await pool.query(
            `UPDATE events SET 
             current_round_id = COALESCE(?, current_round_id),
             current_question_index = COALESCE(?, current_question_index),
             is_started = COALESCE(?, is_started)
             WHERE id = ?`,
            [currentRoundId, currentQuestionIndex, isStarted, req.params.eventId]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const startEvent = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        // Check if event exists
        const [event] = await connection.query(
            'SELECT * FROM events WHERE id = ?',
            [req.params.eventId]
        );
        
        if (event.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }
        
        // Check if there are teams
        const [teams] = await connection.query(
            'SELECT COUNT(*) as count FROM teams WHERE event_id = ?',
            [req.params.eventId]
        );
        
        if (teams[0].count === 0) {
            return res.status(400).json({ error: 'No teams added to event' });
        }
        
        // Check if there are rounds
        const [rounds] = await connection.query(
            'SELECT COUNT(*) as count FROM rounds WHERE event_id = ?',
            [req.params.eventId]
        );
        
        if (rounds[0].count === 0) {
            return res.status(400).json({ error: 'No rounds added to event' });
        }
        
        // Get first round
        const [firstRound] = await connection.query(
            'SELECT id FROM rounds WHERE event_id = ? ORDER BY round_order LIMIT 1',
            [req.params.eventId]
        );
        
        // Update event
        await connection.query(
            `UPDATE events SET 
             is_started = TRUE,
             current_round_id = ?,
             current_question_index = 0,
             regular_round_sequence_index = 0
             WHERE id = ?`,
            [firstRound[0].id, req.params.eventId]
        );
        
        // Log event start
        await connection.query(
            `INSERT INTO audit_log (event_id, action, details) 
             VALUES (?, ?, ?)`,
            [req.params.eventId, 'event_started', JSON.stringify({ timestamp: new Date().toISOString() })]
        );
        
        await connection.commit();
        res.json({ success: true, message: 'Event started successfully' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
};

export const resetEvent = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        // Delete all scores
        await connection.query(
            'DELETE FROM scores WHERE event_id = ?',
            [req.params.eventId]
        );
        
        // Reset event state
        await connection.query(
            `UPDATE events SET 
             is_started = FALSE,
             current_round_id = NULL,
             current_question_index = 0,
             regular_round_sequence_index = 0
             WHERE id = ?`,
            [req.params.eventId]
        );
        
        await connection.commit();
        res.json({ success: true, message: 'Event reset successfully' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
};

export const getScoringConfig = async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM scoring_config WHERE event_id = ?',
            [req.params.eventId]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const updateScoringConfig = async (req, res) => {
    const { config } = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        for (const [action, points] of Object.entries(config)) {
            await connection.query(
                'UPDATE scoring_config SET points = ? WHERE event_id = ? AND action = ?',
                [points, req.params.eventId, action]
            );
        }
        
        await connection.commit();
        res.json({ success: true });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
};