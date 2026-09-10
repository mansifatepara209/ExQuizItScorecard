import React, { useState, useEffect } from 'react';
import { ScoreService, RankingService, TeamService } from '../services/api';
import { Check, X, Minus, AlertCircle, RotateCcw, Award } from 'lucide-react';

function ScoringDashboard({ eventId = 1, eventState, onUpdate }) {
    const [teams, setTeams] = useState([]);
    const [currentRound, setCurrentRound] = useState(null);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [rankings, setRankings] = useState([]);
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [regularRoundIndex, setRegularRoundIndex] = useState(0);

    useEffect(() => {
        if (eventState) {
            setCurrentQuestion(eventState.current_question_index || 0);
            setRegularRoundIndex(eventState.regular_round_sequence_index || 0);
            if (eventState.current_round_id) {
                setCurrentRound({
                    id: eventState.current_round_id,
                    name: eventState.current_round_name,
                    type: eventState.current_round_type,
                    question_count: eventState.total_questions
                });
            }
        }
    }, [eventState]);

    useEffect(() => { loadData(); }, [eventId]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [teamsRes, rankingsRes] = await Promise.all([
                TeamService.getAll(eventId),
                RankingService.getRankings(eventId)
            ]);
            setTeams(teamsRes.data);
            setRankings(rankingsRes.data);
        } catch (error) {
            console.error('Error loading data:', error);
            showMessage('Error loading data: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const showMessage = (text, type = 'info') => {
        setMessage({ text, type });
        setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    };

    const handleScoreAction = async (action) => {
        if (!selectedTeam) {
            showMessage('Please select a team', 'error');
            return;
        }
        if (!currentRound || !currentRound.id) {
            showMessage('No active round', 'error');
            return;
        }

        try {
            setLoading(true);
            await ScoreService.apply({
                eventId,
                teamId: selectedTeam,
                roundId: currentRound.id,
                questionIndex: currentQuestion,
                action
            });

            showMessage(`✓ ${action.replace('_', ' ')} applied`, 'success');
            await loadData();
            if (onUpdate) onUpdate();

            // Advance to next question
            setCurrentQuestion(currentQuestion + 1);
        } catch (error) {
            console.error('Error applying score:', error);
            showMessage('Error: ' + (error.response?.data?.error || error.message), 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleUndo = async () => {
        if (!selectedTeam || !currentRound) {
            showMessage('Please select a team', 'error');
            return;
        }
        try {
            setLoading(true);
            await ScoreService.undo(selectedTeam, currentRound.id);
            await loadData();
            if (onUpdate) onUpdate();
            showMessage('↺ Undo successful', 'success');
        } catch (error) {
            showMessage('Error: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const getTeamName = (id) => teams.find(t => t.id === id)?.name || 'Unknown';
    const getTeamRank = (id) => rankings.find(r => r.id === id)?.rank || '-';
    const getTeamScore = (id) => rankings.find(r => r.id === id)?.total_score || 0;

    if (loading && rankings.length === 0) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-quiz-gold mx-auto mb-4"></div>
                    <p className="text-quiz-text text-xl">Loading scoring data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="text-quiz-text">
            {/* Status Bar */}
            <div className="bg-quiz-secondary p-4 rounded-lg mb-6 border border-quiz-border flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-6 flex-wrap">
                    <div>
                        <p className="text-sm text-quiz-muted">Current Round</p>
                        <p className="text-xl font-bold text-quiz-gold">{currentRound?.name || 'Not Started'}</p>
                    </div>
                    <div>
                        <p className="text-sm text-quiz-muted">Question</p>
                        <p className="text-xl font-bold">
                            {currentRound ? `${currentQuestion + 1} / ${currentRound.question_count}` : 'N/A'}
                        </p>
                    </div>
                    <div>
                        <p className="text-sm text-quiz-muted">Type</p>
                        <p className="text-xl font-bold capitalize">{currentRound?.type || 'N/A'}</p>
                    </div>
                </div>
                <div>
                    <p className="text-sm text-quiz-muted">Selected Team</p>
                    <p className="text-xl font-bold text-quiz-gold">
                        {selectedTeam ? getTeamName(selectedTeam) : 'Click a team'}
                    </p>
                </div>
            </div>

            {message.text && (
                <div className={`p-4 rounded-lg mb-6 ${message.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/40' :
                        message.type === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/40' :
                            'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                    }`}>
                    <p>{message.text}</p>
                </div>
            )}

            {/* Team Selection */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
                {teams.map(team => {
                    const isSelected = selectedTeam === team.id;
                    const score = getTeamScore(team.id);
                    const rank = getTeamRank(team.id);
                    return (
                        <button
                            key={team.id}
                            onClick={() => setSelectedTeam(team.id)}
                            disabled={loading}
                            className={`p-4 rounded-lg transition border-2 ${isSelected
                                    ? 'bg-quiz-gold text-white border-quiz-gold'
                                    : 'bg-quiz-secondary text-quiz-text border-quiz-border hover:border-quiz-gold'
                                } disabled:opacity-50`}
                        >
                            <div className="font-bold">{team.short_name}</div>
                            <div className="text-xs opacity-80">{team.institution}</div>
                            <div className="text-3xl font-bold mt-2">{score}</div>
                            <div className="text-xs">Rank #{rank}</div>
                            {isSelected && (
                                <div className="mt-2 text-xs bg-black/30 rounded px-2 py-1">
                                    Selected
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Scoring Controls */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                <button
                    onClick={() => handleScoreAction('correct')}
                    disabled={loading || !selectedTeam}
                    className="p-6 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xl font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Check size={24} /> Correct (+10)
                </button>
                <button
                    onClick={() => handleScoreAction('half_correct')}
                    disabled={loading || !selectedTeam}
                    className="p-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xl font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    <Minus size={24} /> Half (+5)
                </button>
                <button
                    onClick={() => handleScoreAction('wrong')}
                    disabled={loading || !selectedTeam}
                    className="p-6 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xl font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    <X size={24} /> Wrong (0)
                </button>
                <button
                    onClick={() => handleScoreAction('pass')}
                    disabled={loading || !selectedTeam}
                    className="p-6 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-xl font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    <AlertCircle size={24} /> Pass (0)
                </button>
                <button
                    onClick={() => handleScoreAction('penalty')}
                    disabled={loading || !selectedTeam}
                    className="p-6 bg-red-900 hover:bg-red-800 text-white rounded-lg text-xl font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    <AlertCircle size={24} /> Penalty (-10)
                </button>
            </div>

            {/* Utilities */}
            <div className="flex gap-4 mb-8 flex-wrap">
                <button
                    onClick={handleUndo}
                    disabled={loading || !selectedTeam}
                    className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-bold transition flex items-center gap-2 disabled:opacity-50"
                >
                    <RotateCcw size={20} /> Undo Last
                </button>
                <button
                    onClick={() => {
                        setCurrentQuestion(0);
                        showMessage('↺ Reset question counter', 'success');
                    }}
                    disabled={loading}
                    className="px-6 py-3 bg-quiz-accent text-quiz-text border border-quiz-border hover:opacity-80 rounded-lg font-bold transition disabled:opacity-50"
                >
                    Reset Question
                </button>
            </div>

            {/* Rankings */}
            <div className="bg-quiz-secondary p-6 rounded-lg border border-quiz-border">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-quiz-gold">
                    <Award size={24} /> Live Rankings
                </h2>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {rankings.map((team) => (
                        <div
                            key={team.id}
                            className={`flex items-center justify-between p-3 rounded-lg border ${selectedTeam === team.id
                                    ? 'bg-quiz-gold/20 border-quiz-gold'
                                    : 'bg-quiz-primary border-quiz-border'
                                }`}
                        >
                            <div className="flex items-center gap-4">
                                <span className="text-2xl font-bold text-quiz-gold w-12">#{team.rank}</span>
                                <div>
                                    <span className="font-bold text-quiz-text">{team.name}</span>
                                    <span className="text-sm text-quiz-muted ml-2">({team.short_name})</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-sm text-quiz-muted">{team.questions_answered || 0} Q</span>
                                <span className="text-2xl font-bold text-quiz-gold">{team.total_score}</span>
                            </div>
                        </div>
                    ))}
                    {rankings.length === 0 && (
                        <p className="text-quiz-muted text-center py-4">No rankings available</p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ScoringDashboard;