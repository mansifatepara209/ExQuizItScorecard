import xlsx from 'xlsx';
import pool from '../database/connection.js';

export class ExcelImportService {
    
    // Main import function
    static async importFullQuizData(eventId, fileBuffer) {
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();

            // Import Teams
            const teamResults = await this.importTeams(workbook, eventId, connection);
            
            // Import Rounds
            const roundResults = await this.importRounds(workbook, eventId, connection);
            
            // Import Settings
            const settingsResults = await this.importSettings(workbook, eventId, connection);

            await connection.commit();
            
            return {
                success: true,
                teams: teamResults,
                rounds: roundResults,
                settings: settingsResults,
                summary: {
                    teamsImported: teamResults.length,
                    roundsImported: roundResults.length,
                    settingsUpdated: settingsResults.updated
                }
            };
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // Import Teams from Excel
    static async importTeams(workbook, eventId, connection) {
        const sheet = workbook.Sheets['Teams'];
        if (!sheet) {
            throw new Error('Teams sheet not found in Excel file');
        }

        const data = xlsx.utils.sheet_to_json(sheet);
        const results = [];

        // Get current max order
        const [maxOrder] = await connection.query(
            'SELECT COALESCE(MAX(team_order), 0) as max_order FROM teams WHERE event_id = ?',
            [eventId]
        );
        let currentOrder = maxOrder[0].max_order;

        for (const row of data) {
            // Parse team members from semicolon-separated string
            const membersList = row.Members ? row.Members.split(';').map(m => m.trim()).filter(m => m) : [];
            
            currentOrder++;
            
            // Insert team
            const [teamResult] = await connection.query(
                `INSERT INTO teams (
                    event_id, team_order, name, short_name, institution, 
                    members, member_count
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    eventId,
                    currentOrder,
                    row['Team Name'] || row['TeamName'] || '',
                    row['Short Name'] || row['ShortName'] || '',
                    row['Institution'] || '',
                    membersList.join(', '),
                    membersList.length
                ]
            );

            const teamId = teamResult.insertId;

            // Insert individual team members
            for (let i = 0; i < membersList.length; i++) {
                await connection.query(
                    `INSERT INTO team_members (team_id, member_name, member_order, member_role)
                     VALUES (?, ?, ?, ?)`,
                    [teamId, membersList[i], i + 1, `Member ${i + 1}`]
                );
            }

            results.push({
                teamName: row['Team Name'] || row['TeamName'],
                members: membersList.length,
                teamId: teamId
            });
        }

        return results;
    }

    // Import Rounds from Excel
    static async importRounds(workbook, eventId, connection) {
        const sheet = workbook.Sheets['Rounds'];
        if (!sheet) {
            throw new Error('Rounds sheet not found in Excel file');
        }

        const data = xlsx.utils.sheet_to_json(sheet);
        const results = [];

        // Get current max order
        const [maxOrder] = await connection.query(
            'SELECT COALESCE(MAX(round_order), 0) as max_order FROM rounds WHERE event_id = ?',
            [eventId]
        );
        let currentOrder = maxOrder[0].max_order;

        for (const row of data) {
            currentOrder++;
            
            // Map type and difficulty to database values
            const type = (row.Type || '').toUpperCase() === 'BUZZER' ? 'buzzer' : 'regular';
            const difficulty = (row.Difficulty || '').toLowerCase();
            
            // Insert round
            const [roundResult] = await connection.query(
                `INSERT INTO rounds (
                    event_id, round_order, name, question_count, type, difficulty
                ) VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    eventId,
                    currentOrder,
                    row['Round Name'] || row['RoundName'] || '',
                    parseInt(row.Questions) || 0,
                    type,
                    difficulty
                ]
            );

            // Update scoring configuration for this round if specified
            if (row['Correct Points'] !== undefined) {
                await this.updateScoringConfig(eventId, 'correct', parseInt(row['Correct Points']) || 10, connection);
            }
            if (row['Wrong Points'] !== undefined) {
                await this.updateScoringConfig(eventId, 'wrong', parseInt(row['Wrong Points']) || 0, connection);
            }
            if (row['Half Points'] !== undefined) {
                await this.updateScoringConfig(eventId, 'half_correct', parseInt(row['Half Points']) || 5, connection);
            }
            if (row['Pass Points'] !== undefined) {
                await this.updateScoringConfig(eventId, 'pass', parseInt(row['Pass Points']) || 0, connection);
            }

            results.push({
                roundName: row['Round Name'] || row['RoundName'],
                type: type,
                difficulty: difficulty,
                roundId: roundResult.insertId
            });
        }

        return results;
    }

    // Import Settings from Excel
    static async importSettings(workbook, eventId, connection) {
        const sheet = workbook.Sheets['Settings'];
        if (!sheet) {
            return { updated: false, message: 'Settings sheet not found' };
        }

        const data = xlsx.utils.sheet_to_json(sheet);
        const results = { updated: false };

        for (const row of data) {
            // Update penalty points
            if (row['Penalty Points'] !== undefined && row['Penalty Points'] !== null) {
                await this.updateScoringConfig(eventId, 'penalty', parseInt(row['Penalty Points']) || -10, connection);
                results.updated = true;
            }

            // Update event name
            if (row['Event Name'] && row['Event Name'].trim()) {
                await connection.query(
                    'UPDATE events SET name = ? WHERE id = ?',
                    [row['Event Name'].trim(), eventId]
                );
                results.updated = true;
                results.eventName = row['Event Name'].trim();
            }

            // Store tie-break rule (can be stored in a settings table or as metadata)
            if (row['Tie Break Rule']) {
                await connection.query(
                    `INSERT INTO audit_log (event_id, action, details) 
                     VALUES (?, ?, ?)`,
                    [eventId, 'tie_break_rule_set', JSON.stringify({ rule: row['Tie Break Rule'] })]
                );
                results.updated = true;
                results.tieBreakRule = row['Tie Break Rule'];
            }
        }

        return results;
    }

    // Helper: Update scoring configuration
    static async updateScoringConfig(eventId, action, points, connection) {
        await connection.query(
            `UPDATE scoring_config SET points = ? WHERE event_id = ? AND action = ?`,
            [points, eventId, action]
        );
    }

    // Validate Excel file structure
    static validateExcelStructure(fileBuffer) {
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const sheets = workbook.SheetNames;
        
        const requiredSheets = ['Teams', 'Rounds', 'Settings'];
        const missingSheets = requiredSheets.filter(s => !sheets.includes(s));
        
        if (missingSheets.length > 0) {
            throw new Error(`Missing required sheets: ${missingSheets.join(', ')}`);
        }

        // Validate Teams sheet structure
        const teamsSheet = workbook.Sheets['Teams'];
        const teamsData = xlsx.utils.sheet_to_json(teamsSheet);
        if (teamsData.length === 0) {
            throw new Error('Teams sheet is empty');
        }

        // Check required columns
        const firstRow = teamsData[0];
        const requiredColumns = ['Team Name', 'Short Name'];
        const missingColumns = requiredColumns.filter(col => !firstRow[col]);
        
        // Also check alternative column names
        const altColumns = ['TeamName', 'ShortName'];
        const hasAltColumns = altColumns.every(col => firstRow[col]);
        
        if (missingColumns.length > 0 && !hasAltColumns) {
            throw new Error(`Teams sheet missing required columns: ${missingColumns.join(', ')}`);
        }

        return {
            valid: true,
            sheets: sheets,
            teamCount: teamsData.length,
            roundCount: xlsx.utils.sheet_to_json(workbook.Sheets['Rounds']).length
        };
    }

    // Generate import report
    static generateImportReport(results) {
        let report = '📊 EX-QUIZ-IT IMPORT REPORT\n';
        report += '='.repeat(40) + '\n\n';
        
        report += `✅ Teams Imported: ${results.teams.length}\n`;
        results.teams.forEach(t => {
            report += `   - ${t.teamName} (${t.members} members)\n`;
        });
        
        report += `\n✅ Rounds Imported: ${results.rounds.length}\n`;
        results.rounds.forEach(r => {
            report += `   - ${r.roundName} (${r.type}, ${r.difficulty})\n`;
        });
        
        if (results.settings.updated) {
            report += `\n✅ Settings Updated:\n`;
            if (results.settings.eventName) {
                report += `   - Event Name: ${results.settings.eventName}\n`;
            }
            if (results.settings.tieBreakRule) {
                report += `   - Tie Break Rule: ${results.settings.tieBreakRule}\n`;
            }
        }
        
        report += `\n${'='.repeat(40)}\n`;
        report += `🎉 Import completed successfully!`;
        
        return report;
    }
}

export default ExcelImportService;