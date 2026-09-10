const { pool } = require('../config/database');

class Event {
    static async create(eventData) {
        const { name, isActive = true } = eventData;
        const [result] = await pool.query(
            'INSERT INTO events (name, is_active) VALUES (?, ?)',
            [name, isActive]
        );
        return result.insertId;
    }

    static async findById(id) {
        const [rows] = await pool.query(
            `SELECT e.*, 
             COALESCE(r.name, 'No Round') as current_round_name,
             COALESCE(r.type, 'N/A') as current_round_type,
             COALESCE(r.question_count, 0) as total_questions
             FROM events e
             LEFT JOIN rounds r ON e.current_round_id = r.id
             WHERE e.id = ?`,
            [id]
        );
        return rows[0];
    }

    static async findAll() {
        const [rows] = await pool.query(
            'SELECT * FROM events ORDER BY created_at DESC'
        );
        return rows;
    }

    static async update(id, data) {
        const updates = [];
        const values = [];
        
        if (data.name !== undefined) {
            updates.push('name = ?');
            values.push(data.name);
        }
        if (data.isActive !== undefined) {
            updates.push('is_active = ?');
            values.push(data.isActive);
        }
        if (data.isStarted !== undefined) {
            updates.push('is_started = ?');
            values.push(data.isStarted);
        }
        if (data.currentRoundId !== undefined) {
            updates.push('current_round_id = ?');
            values.push(data.currentRoundId);
        }
        if (data.currentQuestionIndex !== undefined) {
            updates.push('current_question_index = ?');
            values.push(data.currentQuestionIndex);
        }
        if (data.regularRoundSequenceIndex !== undefined) {
            updates.push('regular_round_sequence_index = ?');
            values.push(data.regularRoundSequenceIndex);
        }
        if (data.isLocked !== undefined) {
            updates.push('is_locked = ?');
            values.push(data.isLocked);
        }

        if (updates.length === 0) return;

        values.push(id);
        const query = `UPDATE events SET ${updates.join(', ')} WHERE id = ?`;
        await pool.query(query, values);
    }

    static async delete(id) {
        await pool.query('DELETE FROM events WHERE id = ?', [id]);
    }

    static async getEventState(id) {
        const [rows] = await pool.query(
            `SELECT e.*, 
             COUNT(DISTINCT t.id) as team_count,
             COUNT(DISTINCT r.id) as round_count,
             COALESCE(SUM(s.points), 0) as total_scores
             FROM events e
             LEFT JOIN teams t ON e.id = t.event_id
             LEFT JOIN rounds r ON e.id = r.event_id
             LEFT JOIN scores s ON e.id = s.event_id
             WHERE e.id = ?
             GROUP BY e.id`,
            [id]
        );
        return rows[0];
    }

    static async lockEvent(id) {
        await pool.query(
            'UPDATE events SET is_locked = TRUE WHERE id = ?',
            [id]
        );
    }

    static async unlockEvent(id) {
        await pool.query(
            'UPDATE events SET is_locked = FALSE WHERE id = ?',
            [id]
        );
    }
}

module.exports = Event;