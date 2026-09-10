import pool from '../database/connection.js';

export const getRounds = async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM rounds WHERE event_id = ? ORDER BY round_order',
            [req.params.eventId]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const createRound = async (req, res) => {
    const { eventId, roundOrder, name, questionCount, type, difficulty } = req.body;
    try {
        const [result] = await pool.query(
            `INSERT INTO rounds (event_id, round_order, name, question_count, type, difficulty) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [eventId, roundOrder, name, questionCount || 0, type, difficulty]
        );
        const [newRound] = await pool.query(
            'SELECT * FROM rounds WHERE id = ?',
            [result.insertId]
        );
        res.status(201).json(newRound[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const updateRound = async (req, res) => {
    const { id } = req.params;
    const { roundOrder, name, questionCount, type, difficulty } = req.body;
    try {
        await pool.query(
            `UPDATE rounds SET round_order = ?, name = ?, question_count = ?, 
             type = ?, difficulty = ? WHERE id = ?`,
            [roundOrder, name, questionCount, type, difficulty, id]
        );
        const [updatedRound] = await pool.query(
            'SELECT * FROM rounds WHERE id = ?',
            [id]
        );
        res.json(updatedRound[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const deleteRound = async (req, res) => {
    try {
        await pool.query('DELETE FROM rounds WHERE id = ?', [req.params.id]);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const reorderRounds = async (req, res) => {
    const { rounds } = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        for (const round of rounds) {
            await connection.query(
                'UPDATE rounds SET round_order = ? WHERE id = ?',
                [round.order, round.id]
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