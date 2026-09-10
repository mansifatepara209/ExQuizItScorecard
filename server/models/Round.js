const { pool } = require('../config/database');

class Round {
    static async create(roundData) {
        const { eventId, roundOrder, name, questionCount, type, difficulty } = roundData;
        const [result] = await pool.query(
            `INSERT INTO rounds (event_id, round_order, name, question_count, type, difficulty) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [eventId, roundOrder, name, questionCount || 0, type, difficulty]
        );
        return result.insertId;
    }

    static async findById(id) {
        const [rows] = await pool.query('SELECT * FROM rounds WHERE id = ?', [id]);
        return rows[0];
    }

    static async findByEvent(eventId) {
        const [rows] = await pool.query(
            'SELECT * FROM rounds WHERE event_id = ? ORDER BY round_order',
            [eventId]
        );
        return rows;
    }

    static async update(id, data) {
        const updates = [];
        const values = [];
        
        if (data.roundOrder !== undefined) {
            updates.push('round_order = ?');
            values.push(data.roundOrder);
        }
        if (data.name !== undefined) {
            updates.push('name = ?');
            values.push(data.name);
        }
        if (data.questionCount !== undefined) {
            updates.push('question_count = ?');
            values.push(data.questionCount);
        }
        if (data.type !== undefined) {
            updates.push('type = ?');
            values.push(data.type);
        }
        if (data.difficulty !== undefined) {
            updates.push('difficulty = ?');
            values.push(data.difficulty);
        }

        if (updates.length === 0) return;

        values.push(id);
        const query = `UPDATE rounds SET ${updates.join(', ')} WHERE id = ?`;
        await pool.query(query, values);
    }

    static async delete(id) {
        await pool.query('DELETE FROM rounds WHERE id = ?', [id]);
    }

    static async deleteByEvent(eventId) {
        await pool.query('DELETE FROM rounds WHERE event_id = ?', [eventId]);
    }

    static async getRoundWithScores(roundId) {
        const [rows] = await pool.query(
            `SELECT r.*, 
             COUNT(s.id) as score_count,
             COALESCE(SUM(s.points), 0) as total_points
             FROM rounds r
             LEFT JOIN scores s ON r.id = s.round_id
             WHERE r.id = ?
             GROUP BY r.id`,
            [roundId]
        );
        return rows[0];
    }
}

module.exports = Round;