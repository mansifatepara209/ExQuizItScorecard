import pool from '../database/connection.js';

export const getRankings = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT 
                t.*,
                COALESCE(SUM(s.points), 0) as total_score,
                COUNT(s.id) as questions_answered,
                RANK() OVER (ORDER BY COALESCE(SUM(s.points), 0) DESC, t.name ASC) as rank
             FROM teams t
             LEFT JOIN scores s ON t.id = s.team_id
             WHERE t.event_id = ?
             GROUP BY t.id
             ORDER BY total_score DESC, t.name ASC`,
            [req.params.eventId]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getTeamRank = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `WITH ranked_teams AS (
                SELECT 
                    t.id,
                    COALESCE(SUM(s.points), 0) as total_score,
                    RANK() OVER (ORDER BY COALESCE(SUM(s.points), 0) DESC) as rank
                FROM teams t
                LEFT JOIN scores s ON t.id = s.team_id
                WHERE t.event_id = (SELECT event_id FROM teams WHERE id = ?)
                GROUP BY t.id
            )
            SELECT * FROM ranked_teams WHERE id = ?`,
            [req.params.teamId, req.params.teamId]
        );
        res.json(rows[0] || null);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};