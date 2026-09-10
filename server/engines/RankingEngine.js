class RankingEngine {
    static calculateRankings(teams, scores) {
        // Create array with team scores
        const teamScores = teams.map(team => ({
            ...team,
            totalScore: scores[team.id] || 0
        }));

        // Sort by score (descending) with tie-breaking
        teamScores.sort((a, b) => {
            if (b.totalScore !== a.totalScore) {
                return b.totalScore - a.totalScore;
            }
            // Tie-breaker: by name (alphabetical)
            return a.name.localeCompare(b.name);
        });

        // Assign ranks
        let rank = 1;
        for (let i = 0; i < teamScores.length; i++) {
            if (i > 0 && teamScores[i].totalScore < teamScores[i-1].totalScore) {
                rank = i + 1;
            }
            teamScores[i].rank = rank;
        }

        return teamScores;
    }

    static findTeamById(teamId, rankings) {
        return rankings.find(t => t.id === teamId);
    }

    static getTopTeam(rankings) {
        return rankings.length > 0 ? rankings[0] : null;
    }

    static getBottomTeam(rankings) {
        return rankings.length > 0 ? rankings[rankings.length - 1] : null;
    }

    static getScoreDifference(team1, team2) {
        if (!team1 || !team2) return 0;
        return team1.totalScore - team2.totalScore;
    }
}

module.exports = RankingEngine;s