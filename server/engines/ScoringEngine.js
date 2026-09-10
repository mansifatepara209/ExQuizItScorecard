class ScoringEngine {
    constructor(config = {}) {
        this.config = {
            correct: 10,
            half_correct: 5,
            wrong: 0,
            pass: 0,
            penalty: -10,
            ...config
        };
    }

    getPoints(action) {
        return this.config[action] || 0;
    }

    calculateScore(currentScore, action) {
        const points = this.getPoints(action);
        return {
            points,
            beforeScore: currentScore,
            afterScore: currentScore + points
        };
    }

    validateAction(action) {
        const validActions = ['correct', 'half_correct', 'wrong', 'pass', 'penalty'];
        return validActions.includes(action);
    }

    getDefaultConfig() {
        return this.config;
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        return this.config;
    }
}

module.exports = ScoringEngine;