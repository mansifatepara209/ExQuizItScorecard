const { pool } = require('../config/database');

class Audit {
    static async create(auditData) {
        const { eventId, action, details } = auditData;
        const [result] = await pool.query(
            'INSERT INTO audit_log (event_id, action, details) VALUES (?, ?, ?)',
            [eventId, action, JSON.stringify(details || {})]
        );
        return result.insertId;
    }

    static async findByEvent(eventId, limit = 100) {
        const [rows] = await pool.query(
            'SELECT * FROM audit_log WHERE event_id = ? ORDER BY timestamp DESC LIMIT ?',
            [eventId, limit]
        );
        return rows;
    }

    static async findByAction(eventId, action) {
        const [rows] = await pool.query(
            'SELECT * FROM audit_log WHERE event_id = ? AND action = ? ORDER BY timestamp DESC',
            [eventId, action]
        );
        return rows;
    }

    static async getRecentActions(eventId, hours = 24) {
        const [rows] = await pool.query(
            'SELECT * FROM audit_log WHERE event_id = ? AND timestamp >= NOW() - INTERVAL ? HOUR ORDER BY timestamp DESC',
            [eventId, hours]
        );
        return rows;
    }

    static async cleanup(eventId, days = 30) {
        await pool.query(
            'DELETE FROM audit_log WHERE event_id = ? AND timestamp < NOW() - INTERVAL ? DAY',
            [eventId, days]
        );
    }

    static async getStatistics(eventId) {
        const [rows] = await pool.query(
            `SELECT 
                action,
                COUNT(*) as count,
                MIN(timestamp) as first_occurrence,
                MAX(timestamp) as last_occurrence
             FROM audit_log
             WHERE event_id = ?
             GROUP BY action
             ORDER BY count DESC`,
            [eventId]
        );
        return rows;
    }
}

module.exports = Audit;