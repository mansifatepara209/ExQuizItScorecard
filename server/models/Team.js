const { pool } = require('../config/database');

class Team {
    static async create(teamData) {
        const { eventId, teamOrder, name, shortName, institution, members } = teamData;
        const [result] = await pool.query(
            `INSERT INTO teams (event_id, team_order, name, short_name, institution, members) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [eventId, teamOrder, name, shortName, institution, members || '']
        );
        return result.insertId;
    }

    static async findById(id) {
        const [rows] = await pool.query('SELECT * FROM teams WHERE id = ?', [id]);
        return rows[0];
    }

    static async findByEvent(eventId) {
        const [rows] = await pool.query(
            'SELECT * FROM teams WHERE event_id = ? ORDER BY team_order',
            [eventId]
        );
        return rows;
    }

    static async update(id, data) {
        const updates = [];
        const values = [];
        
        if (data.teamOrder !== undefined) {
            updates.push('team_order = ?');
            values.push(data.teamOrder);
        }
        if (data.name !== undefined) {
            updates.push('name = ?');
            values.push(data.name);
        }
        if (data.shortName !== undefined) {
            updates.push('short_name = ?');
            values.push(data.shortName);
        }
        if (data.institution !== undefined) {
            updates.push('institution = ?');
            values.push(data.institution);
        }
        if (data.members !== undefined) {
            updates.push('members = ?');
            values.push(data.members);
        }

        if (updates.length === 0) return;

        values.push(id);
        const query = `UPDATE teams SET ${updates.join(', ')} WHERE id = ?`;
        await pool.query(query, values);
    }

    static async delete(id) {
        await pool.query('DELETE FROM teams WHERE id = ?', [id]);
    }

    static async deleteByEvent(eventId) {
        await pool.query('DELETE FROM teams WHERE event_id = ?', [eventId]);
    }

    static async reorderTeams(eventId, teamOrders) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            
            for (const team of teamOrders) {
                await connection.query(
                    'UPDATE teams SET team_order = ? WHERE id = ? AND event_id = ?',
                    [team.order, team.id, eventId]
                );
            }
            
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async getTotalTeams(eventId) {
        const [rows] = await pool.query(
            'SELECT COUNT(*) as count FROM teams WHERE event_id = ?',
            [eventId]
        );
        return rows[0].count;
    }
}

module.exports = Team;