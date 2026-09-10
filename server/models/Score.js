const { pool } = require('../config/database');

class Score {
    static async create(scoreData) {
        const { eventId, teamId, roundId, questionIndex, action, points, beforeScore, afterScore, undoInfo } = scoreData;
        const [result] = await pool.query(
            `INSERT INTO scores 
             (event_id, team_id, round_id, question_index, action, points, before_score, after_score, undo_info) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [eventId, teamId, roundId, questionIndex, action, points, beforeScore, afterScore, JSON.stringify(undoInfo || {})]
        );
        return result.insertId;
    }

    static async findById(id) {
        const [rows] = await pool.query('SELECT * FROM scores WHERE id = ?', [id]);
        return rows[0];
    }

    static async findByTeam(teamId) {
        const [rows] = await pool.query(
            'SELECT * FROM scores WHERE team_id = ? ORDER BY timestamp DESC',
            [teamId]
        );
        return rows;
    }

    static async findByRound(roundId) {
        const [rows] = await pool.query(
            'SELECT * FROM scores WHERE round_id = ? ORDER BY timestamp',
            [roundId]
        );
        return rows;
    }

    static async findByEvent(eventId) {
        const [rows] = await pool.query(
            'SELECT * FROM scores WHERE event_id = ? ORDER BY timestamp',
            [eventId]
        );
        return rows;
    }

    static async getLastScore(teamId, roundId) {
        const [rows] = await pool.query(
            'SELECT * FROM scores WHERE team_id = ? AND round_id = ? ORDER BY id DESC LIMIT 1',
            [teamId, roundId]
        );
        return rows[0];
    }

    static async getTeamTotalScore(teamId) {
        const [rows] = await pool.query(
            'SELECT COALESCE(SUM(points), 0) as total FROM scores WHERE team_id = ? AND is_undo = FALSE',
            [teamId]
        );
        return rows[0].total;
    }

    static async getTeamScoresByRound(teamId, roundId) {
        const [rows] = await pool.query(
            'SELECT * FROM scores WHERE team_id = ? AND round_id = ? ORDER BY timestamp',
            [teamId, roundId]
        );
        return rows;
    }

    static async delete(id) {
        await pool.query('DELETE FROM scores WHERE id = ?', [id]);
    }

    static async markAsUndo(id) {
        await pool.query('UPDATE scores SET is_undo = TRUE WHERE id = ?', [id]);
    }

    static async getScoreHistory(eventId, limit = 100) {
        const [rows] = await pool.query(
            `SELECT s.*, t.name as team_name, t.short_name, r.name as round_name
             FROM scores s
             JOIN teams t ON s.team_id = t.id
             JOIN rounds r ON s.round_id = r.id
             WHERE s.event_id = ?
             ORDER BY s.timestamp DESC
             LIMIT ?`,
            [eventId, limit]
        );
        return rows;
    }

    static async bulkCreate(scores) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            
            const results = [];
            for (const score of scores) {
                const [result] = await connection.query(
                    `INSERT INTO scores 
                     (event_id, team_id, round_id, question_index, action, points, before_score, after_score) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [score.eventId, score.teamId, score.roundId, score.questionIndex, 
                     score.action, score.points, score.beforeScore, score.afterScore]
                );
                results.push(result.insertId);
            }
            
            await connection.commit();
            return results;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = Score;