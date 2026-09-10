import pool from '../database/connection.js';

export const getTeams = async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM teams WHERE event_id = ? ORDER BY team_order',
            [req.params.eventId]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const createTeam = async (req, res) => {
    const { eventId, teamOrder, name, shortName, institution, members } = req.body;
    try {
        const [result] = await pool.query(
            `INSERT INTO teams (event_id, team_order, name, short_name, institution, members) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [eventId, teamOrder, name, shortName, institution, members || '']
        );
        const [newTeam] = await pool.query(
            'SELECT * FROM teams WHERE id = ?',
            [result.insertId]
        );
        res.status(201).json(newTeam[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const updateTeam = async (req, res) => {
    const { id } = req.params;
    const { teamOrder, name, shortName, institution, members } = req.body;
    try {
        await pool.query(
            `UPDATE teams SET team_order = ?, name = ?, short_name = ?, 
             institution = ?, members = ? WHERE id = ?`,
            [teamOrder, name, shortName, institution, members, id]
        );
        const [updatedTeam] = await pool.query(
            'SELECT * FROM teams WHERE id = ?',
            [id]
        );
        res.json(updatedTeam[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const deleteTeam = async (req, res) => {
    try {
        await pool.query('DELETE FROM teams WHERE id = ?', [req.params.id]);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const reorderTeams = async (req, res) => {
    const { teams } = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        for (const team of teams) {
            await connection.query(
                'UPDATE teams SET team_order = ? WHERE id = ?',
                [team.order, team.id]
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