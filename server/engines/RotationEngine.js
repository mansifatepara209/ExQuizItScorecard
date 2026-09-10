class RotationEngine {
    constructor(teamCount = 0) {
        this.teamCount = teamCount;
        this.regularRoundSequenceIndex = 0;
    }

    getStartingTeamForRound(roundNumber, isBuzzerRound = false) {
        if (isBuzzerRound) {
            return null; // Buzzer rounds don't follow rotation
        }
        
        // Only regular rounds advance the sequence
        const teamIndex = this.regularRoundSequenceIndex % this.teamCount;
        return teamIndex;
    }

    advanceRegularRound() {
        this.regularRoundSequenceIndex++;
        return this.regularRoundSequenceIndex;
    }

    getCurrentRegularIndex() {
        return this.regularRoundSequenceIndex;
    }

    reset() {
        this.regularRoundSequenceIndex = 0;
    }

    setTeamCount(count) {
        this.teamCount = count;
    }

    getNextTeam(currentTeamIndex) {
        if (this.teamCount === 0) return 0;
        return (currentTeamIndex + 1) % this.teamCount;
    }
}

module.exports = RotationEngine;