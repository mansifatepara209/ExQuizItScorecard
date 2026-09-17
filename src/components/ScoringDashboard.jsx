import React, { useState, useEffect, useCallback } from 'react';
import {
    ScoreService, RankingService, TeamService,
    ScoringControlService, EventService, RoundService
} from '../services/api';
import {
    Check, X, Minus, AlertCircle, RotateCcw,
    Award, ArrowRight, Flag, Users, Ban, Trophy,
    Pause, Play, Lock, PartyPopper, ChevronRight, XCircle
} from 'lucide-react';

function ScoringDashboard({ eventId = 1, eventState, onUpdate }) {
    const [currentTeam, setCurrentTeam] = useState(null);
    const [currentRound, setCurrentRound] = useState(null);
    const [questionIndex, setQuestionIndex] = useState(0);
    const [teams, setTeams] = useState([]);
    const [rankings, setRankings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [hasScoredThisQuestion, setHasScoredThisQuestion] = useState(false);
    const [isPaused, setIsPaused] = useState(false);

    // Round completion state
    const [roundCompleted, setRoundCompleted] = useState(false);
    const [hasNextRound, setHasNextRound] = useState(false);
    const [showNextRoundModal, setShowNextRoundModal] = useState(false);
    const [completedRoundInfo, setCompletedRoundInfo] = useState(null);

    // Penalty dialog
    const [penaltyModal, setPenaltyModal] = useState(false);
    const [penaltyTeam, setPenaltyTeam] = useState(null);
    const [penaltyPoints, setPenaltyPoints] = useState(-10);
    const [penaltyReason, setPenaltyReason] = useState('');

    // Buzzer team modal
    const [buzzerTeamModal, setBuzzerTeamModal] = useState(false);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [teamsRes, rankingsRes, controlRes, splashRes, roundsRes] = await Promise.all([
                TeamService.getAll(eventId),
                RankingService.getRankings(eventId),
                ScoringControlService.getCurrentTeam(eventId),
                ScoringControlService.getSplash(eventId),
                RoundService.getAll(eventId)
            ]);

            setTeams(teamsRes.data);
            setRankings(rankingsRes.data);

            const control = controlRes.data;
            setCurrentTeam(control.team);
            setCurrentRound(control.round);
            setQuestionIndex(control.questionIndex);
            setHasScoredThisQuestion(control.hasScoredThisQuestion || false);
            setIsPaused(control.isPaused || false);

            // Restore roundCompleted state from DB splash
            const splashState = splashRes.data?.show_splash;
            if (splashState === 'round_completed' || splashState === 'event_completed') {
                setRoundCompleted(true);
                const currentOrder = control.round?.round_order;
                const hasNext = roundsRes.data.some(r => r.round_order > currentOrder);
                setHasNextRound(hasNext);
                setCompletedRoundInfo({
                    roundId: control.round?.id,
                    roundName: control.round?.name,
                    roundOrder: control.round?.round_order
                });
            } else {
                setRoundCompleted(false);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            showMessage('Error loading data', 'error');
        } finally {
            setLoading(false);
        }
    }, [eventId]);

    useEffect(() => { loadData(); }, [loadData]);

    const showMessage = (text, type = 'info') => {
        setMessage({ text, type });
        setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    };

    // Is this the last question of the round?
    const isLastQuestion = currentRound && questionIndex === (currentRound.question_count - 1);

    // ============ SCORE ACTION ============
    const handleScoreAction = async (action) => {
        if (isPaused) { showMessage('Event is paused', 'error'); return; }
        if (!currentRound?.id) { showMessage('No active round', 'error'); return; }
        if (!currentTeam && currentRound?.type !== 'buzzer') { showMessage('No active team', 'error'); return; }
        if (currentRound.type === 'buzzer' && !currentTeam?.id) { setBuzzerTeamModal(true); return; }

        if (hasScoredThisQuestion) {
            showMessage('This question is already scored.', 'error');
            return;
        }

        try {
            setLoading(true);
            await ScoreService.apply({
                eventId,
                teamId: currentTeam.id,
                roundId: currentRound.id,
                questionIndex,
                action
            });

            showMessage(`✓ ${action.replace('_', ' ')} applied to ${currentTeam.name}`, 'success');
            setHasScoredThisQuestion(true);
            await loadData();
            if (onUpdate) onUpdate();
        } catch (error) {
            showMessage('Error: ' + (error.response?.data?.error || error.message), 'error');
        } finally { setLoading(false); }
    };

    // ============ NEXT QUESTION ============
    const handleNextQuestion = async () => {
        if (isPaused) { showMessage('Event is paused', 'error'); return; }
        if (!hasScoredThisQuestion) {
            showMessage('⚠️ Assign a score first', 'error');
            return;
        }

        try {
            setLoading(true);
            const res = await ScoringControlService.nextQuestion(eventId);

            if (res.data.roundCompleted) {
                setRoundCompleted(true);
                setHasNextRound(res.data.hasNextRound);
                setCompletedRoundInfo({
                    roundId: res.data.currentRoundId,
                    roundName: res.data.currentRoundName,
                    roundOrder: res.data.currentRoundOrder
                });

                // ⭐ NEW: Trigger "Next Round" splash in audience immediately
                try {
                    if (res.data.hasNextRound) {
                        // Show upcoming round splash
                        await ScoringControlService.showNextRound(eventId);
                    } else {
                        // Final round — show event complete splash
                        await ScoringControlService.showEventCompleted(eventId);
                    }
                } catch (err) {
                    console.warn('Could not show splash', err);
                }

                setHasScoredThisQuestion(false);
                await loadData();
                if (onUpdate) onUpdate();

                if (res.data.hasNextRound) {
                    showMessage('🎉 Round completed!', 'success');
                } else {
                    showMessage('🎉 Final round completed!', 'success');
                }
            } else {
                showMessage('→ Next question loaded', 'success');
                setHasScoredThisQuestion(false);
                await loadData();
                if (onUpdate) onUpdate();
            }
        } catch (error) {
            showMessage('Error: ' + (error.response?.data?.error || error.message), 'error');
        } finally { setLoading(false); }
    };

    // Click "Round Completed" → open next round popup OR show event complete splash
    const handleRoundCompleted = async () => {
        if (!hasNextRound) {
            // ⭐ FINAL round — event complete splash already shown by nextQuestion
            showMessage('🏆 Event fully completed!', 'success');
            return;
        }
        setShowNextRoundModal(true);
    };

    // Confirm next round
    const handleNextRoundConfirm = async () => {
        try {
            setLoading(true);
            await ScoringControlService.nextRound(eventId);
            // ⭐ Clear the "next round" splash so audience shows normal scoreboard
            try {
                await ScoringControlService.clearSplash(eventId);
            } catch (err) { /* ignore */ }
            setShowNextRoundModal(false);
            setRoundCompleted(false);
            setHasScoredThisQuestion(false);
            await loadData();
            if (onUpdate) onUpdate();
            showMessage('🚀 New round started!', 'success');
        } catch (error) {
            showMessage('Error: ' + (error.response?.data?.error || error.message), 'error');
        } finally { setLoading(false); }
    };

    // Cancel next round popup → clear splash
    const handleNextRoundCancel = async () => {
        setShowNextRoundModal(false);
        try {
            await ScoringControlService.clearSplash(eventId);
        } catch (err) { /* ignore */ }
        showMessage('Cancelled — stay on current round', 'info');
    };

    // ============ UNDO ============
    const handleUndo = async () => {
        if (!currentTeam || !currentRound) { showMessage('Nothing to undo', 'error'); return; }
        if (isPaused) { showMessage('Event is paused', 'error'); return; }

        try {
            setLoading(true);
            await ScoreService.undo(currentTeam.id, currentRound.id);
            showMessage('↺ Last score undone', 'success');
            setHasScoredThisQuestion(false);
            setRoundCompleted(false);
            await loadData();
            if (onUpdate) onUpdate();
        } catch (error) {
            showMessage('Error: ' + (error.response?.data?.error || error.message), 'error');
        } finally { setLoading(false); }
    };

    const handlePause = async () => {
        if (!window.confirm('Pause the event?')) return;
        try {
            await EventService.pause(eventId);
            showMessage('⏸️ Event paused', 'success');
            await loadData();
            if (onUpdate) onUpdate();
        } catch (error) {
            showMessage('Error: ' + (error.response?.data?.error || error.message), 'error');
        }
    };

    const handleResume = async () => {
        try {
            await EventService.resume(eventId);
            showMessage('▶️ Event resumed', 'success');
            await loadData();
            if (onUpdate) onUpdate();
        } catch (error) {
            showMessage('Error: ' + (error.response?.data?.error || error.message), 'error');
        }
    };

    const openPenaltyModal = (team) => {
        setPenaltyTeam(team);
        setPenaltyPoints(-10);
        setPenaltyReason('');
        setPenaltyModal(true);
    };

    const handlePenaltySubmit = async (e) => {
        e.preventDefault();
        if (!penaltyTeam || !currentRound) return;
        try {
            setLoading(true);
            await ScoreService.penalty({
                eventId, teamId: penaltyTeam.id, roundId: currentRound.id,
                questionIndex, points: penaltyPoints, reason: penaltyReason
            });
            showMessage(`⚖️ ${penaltyPoints} to ${penaltyTeam.name}`, 'success');
            setPenaltyModal(false);
            await loadData();
            if (onUpdate) onUpdate();
        } catch (error) {
            showMessage('Error: ' + (error.response?.data?.error || error.message), 'error');
        } finally { setLoading(false); }
    };

    const handleBuzzerTeamSelect = async (team) => {
        try {
            setLoading(true);
            await ScoringControlService.setBuzzerTeam(eventId, team.id);
            setCurrentTeam(team);
            setBuzzerTeamModal(false);
            showMessage(`🔔 ${team.name} buzzed in`, 'success');
            if (onUpdate) onUpdate();
        } catch (error) {
            showMessage('Error: ' + (error.response?.data?.error || error.message), 'error');
        } finally { setLoading(false); }
    };

    const getRank = (id) => rankings.find(r => r.id === id)?.rank || '-';
    const getScore = (id) => rankings.find(r => r.id === id)?.total_score || 0;
    const getCounts = (id) => {
        const r = rankings.find(x => x.id === id);
        return {
            correct: r?.correct_count || 0,
            wrong: r?.wrong_count || 0,
            pass: r?.pass_count || 0,
            penalty: r?.penalty_count || 0,
            total: r?.total_answers || 0
        };
    };

    const canScore = currentTeam && currentRound && !loading && !isPaused && !hasScoredThisQuestion && !roundCompleted;

    if (loading && teams.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-quiz-gold"></div>
            </div>
        );
    }

    if (!eventState?.is_started) {
        return (
            <div className="text-center py-16 md:py-20 bg-quiz-secondary rounded-lg border border-quiz-border px-4">
                <Flag size={48} className="text-quiz-muted mx-auto mb-3" />
                <h2 className="text-xl md:text-2xl font-bold text-quiz-text mb-2">Event Not Started</h2>
                <p className="text-sm text-quiz-muted">Click "Start Event" in the sidebar</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 md:space-y-6 relative">
            {isPaused && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
                    <div className="bg-quiz-secondary p-6 md:p-8 rounded-2xl border-4 border-yellow-500 text-center max-w-md w-full">
                        <div className="w-20 h-20 mx-auto rounded-full bg-yellow-500/20 border-4 border-yellow-500 flex items-center justify-center mb-4">
                            <Pause size={40} className="text-yellow-500" />
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black text-yellow-400 mb-2">EVENT PAUSED</h2>
                        <p className="text-sm text-quiz-muted mb-6">Scoring is disabled until you resume</p>
                        <button onClick={handleResume}
                            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 text-lg transition">
                            <Play size={22} /> RESUME EVENT
                        </button>
                    </div>
                </div>
            )}

            {/* NEXT ROUND POPUP */}
            {showNextRoundModal && completedRoundInfo && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-quiz-secondary rounded-2xl border-2 border-quiz-gold max-w-lg w-full overflow-hidden shadow-2xl">
                        <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-5 text-center">
                            <PartyPopper size={48} className="text-white mx-auto mb-2" />
                            <h2 className="text-2xl md:text-3xl font-black text-white">ROUND COMPLETED</h2>
                            <p className="text-sm text-green-100 mt-1">
                                R{completedRoundInfo.roundOrder} — {completedRoundInfo.roundName}
                            </p>
                        </div>
                        <div className="p-6 text-center space-y-4">
                            <p className="text-lg text-quiz-text">Ready to start the next round?</p>
                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                <button onClick={handleNextRoundCancel} disabled={loading}
                                    className="flex-1 px-6 py-3 bg-quiz-accent hover:bg-quiz-primary text-quiz-text border border-quiz-border rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition">
                                    <XCircle size={20} /> Cancel
                                </button>
                                <button onClick={handleNextRoundConfirm} disabled={loading}
                                    className="flex-1 px-6 py-3 bg-gradient-to-r from-quiz-gold to-red-500 hover:opacity-90 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition">
                                    <ChevronRight size={20} /> Next Round
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Status Bar */}
            <div className="bg-quiz-secondary rounded-lg border border-quiz-border overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-quiz-border">
                    <StatusCell label="Round" value={currentRound ? `R${currentRound.round_order} — ${currentRound.name}` : 'N/A'} highlight="text-quiz-gold" />
                    <StatusCell label="Question" value={currentRound ? `${Math.min(questionIndex + 1, currentRound.question_count)} / ${currentRound.question_count}` : 'N/A'} />
                    <StatusCell label="Type" value={currentRound?.type?.toUpperCase() || 'N/A'}
                        badge={currentRound?.type === 'buzzer' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'} />
                </div>
            </div>

            {message.text && (
                <div className={`p-3 md:p-4 rounded-lg border text-sm md:text-base ${message.type === 'success' ? 'bg-green-500/10 border-green-500/40 text-green-400' :
                    message.type === 'error' ? 'bg-red-500/10 border-red-500/40 text-red-400' :
                        'bg-blue-500/10 border-blue-500/40 text-blue-400'
                    }`}>{message.text}</div>
            )}

            {currentTeam ? (
                <div className={`bg-gradient-to-r from-quiz-gold/20 to-quiz-gold/5 border-2 rounded-xl p-4 md:p-6 ${hasScoredThisQuestion ? 'border-green-500' : 'border-quiz-gold'
                    }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-3 md:gap-4">
                            <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl bg-quiz-gold flex items-center justify-center flex-shrink-0">
                                <span className="text-xl md:text-2xl font-black text-white">{currentTeam.team_order}</span>
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] md:text-xs text-quiz-muted uppercase tracking-widest font-semibold mb-0.5">
                                    {currentRound?.type === 'buzzer' ? '🔔 Buzzing Team' : 'Now Answering'}
                                </p>
                                <h2 className="text-xl md:text-3xl font-black text-quiz-text truncate">{currentTeam.name}</h2>
                                <p className="text-xs md:text-sm text-quiz-muted truncate">
                                    {currentTeam.short_name}{currentTeam.institution && ` • ${currentTeam.institution}`}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4 md:gap-6 justify-around sm:justify-end">
                            <div className="text-center">
                                <p className="text-[10px] text-quiz-muted uppercase font-semibold">Score</p>
                                <p className="text-3xl md:text-4xl font-black text-quiz-gold">{getScore(currentTeam.id)}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[10px] text-quiz-muted uppercase font-semibold">Rank</p>
                                <p className="text-3xl md:text-4xl font-black text-quiz-text">#{getRank(currentTeam.id)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-5 gap-2 mt-4">
                        <MiniStat label="Total" value={getCounts(currentTeam.id).total} color="text-quiz-gold" />
                        <MiniStat label="Correct" value={getCounts(currentTeam.id).correct} color="text-green-500" />
                        <MiniStat label="Wrong" value={getCounts(currentTeam.id).wrong} color="text-red-500" />
                        <MiniStat label="Pass" value={getCounts(currentTeam.id).pass} color="text-quiz-muted" />
                        <MiniStat label="Penalty" value={getCounts(currentTeam.id).penalty} color="text-red-600" />
                    </div>

                    {hasScoredThisQuestion && !roundCompleted && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-green-400 bg-green-500/10 border border-green-500/40 rounded-lg px-3 py-2">
                            <Lock size={14} />
                            <span>
                                Score assigned. Click <strong>{isLastQuestion ? 'Round Completed' : 'Next Question'}</strong> to continue.
                            </span>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-quiz-secondary border-2 border-dashed border-quiz-border rounded-xl p-6 md:p-8 text-center">
                    <Users size={40} className="text-quiz-muted mx-auto mb-3" />
                    <h3 className="text-base md:text-xl font-bold text-quiz-text mb-2">
                        {currentRound?.type === 'buzzer' ? '🔔 Waiting for buzz' : 'No team assigned'}
                    </h3>
                    {currentRound?.type === 'buzzer' && (
                        <button onClick={() => setBuzzerTeamModal(true)}
                            className="mt-3 px-4 md:px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold text-sm">
                            Select Team
                        </button>
                    )}
                </div>
            )}

            <div>
                <p className="text-[10px] md:text-xs text-quiz-muted uppercase tracking-widest font-bold mb-2 md:mb-3">
                    Score This Question
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                    <ScoreButton label="Correct" points={currentRound?.correct_points} icon={<Check size={20} />} color="green" onClick={() => handleScoreAction('correct')} disabled={!canScore} />
                    <ScoreButton label="Half" points={currentRound?.half_points} icon={<Minus size={20} />} color="blue" onClick={() => handleScoreAction('half_correct')} disabled={!canScore} />
                    <ScoreButton label="Wrong" points={currentRound?.wrong_points} icon={<X size={20} />} color="red" onClick={() => handleScoreAction('wrong')} disabled={!canScore} />
                    <ScoreButton label="Pass" points={currentRound?.pass_points} icon={<AlertCircle size={20} />} color="gray" onClick={() => handleScoreAction('pass')} disabled={!canScore} />
                </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex flex-wrap gap-2 md:gap-3">
                {roundCompleted ? (
                    <button onClick={handleRoundCompleted} disabled={loading}
                        className={`flex-1 min-w-full sm:min-w-[200px] px-4 md:px-6 py-3 md:py-4 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 text-sm md:text-base shadow-lg transition ${hasNextRound
                            ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800'
                            : 'bg-gradient-to-r from-yellow-500 to-quiz-gold hover:opacity-90'
                            }`}>
                        <PartyPopper size={20} />
                        {hasNextRound ? 'Round Completed → Next Round' : 'Event Completed'}
                    </button>
                ) : (
                    <button onClick={handleNextQuestion}
                        disabled={loading || !currentRound || isPaused || !hasScoredThisQuestion}
                        className={`flex-1 min-w-full sm:min-w-[200px] px-4 md:px-6 py-3 md:py-4 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 text-sm md:text-base shadow-lg transition ${!hasScoredThisQuestion ? 'bg-gray-600 cursor-not-allowed' :
                            isLastQuestion ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:opacity-90' :
                                'bg-quiz-gold hover:opacity-90'
                            }`}>
                        {!hasScoredThisQuestion ? (
                            <><Lock size={20} /> Score Required</>
                        ) : isLastQuestion ? (
                            <><PartyPopper size={20} /> Round Completed</>
                        ) : (
                            <><ArrowRight size={20} /> Next Question</>
                        )}
                    </button>
                )}

                <button onClick={handlePause} disabled={loading || isPaused}
                    className="flex-1 sm:flex-none px-4 md:px-6 py-3 md:py-4 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 text-sm md:text-base transition">
                    <Pause size={20} /> Pause
                </button>

                <button onClick={() => openPenaltyModal(currentTeam)} disabled={loading || isPaused}
                    className="flex-1 sm:flex-none px-4 md:px-6 py-3 md:py-4 bg-red-900 hover:bg-red-800 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 text-sm md:text-base transition">
                    <Ban size={20} /> Penalty
                </button>

                <button onClick={handleUndo} disabled={loading || !currentTeam || isPaused}
                    className="flex-1 sm:flex-none px-4 md:px-6 py-3 md:py-4 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 text-sm md:text-base transition">
                    <RotateCcw size={20} /> Undo
                </button>

                {currentRound?.type === 'buzzer' && !roundCompleted && (
                    <button onClick={() => setBuzzerTeamModal(true)} disabled={loading || isPaused}
                        className="w-full sm:w-auto px-4 md:px-6 py-3 md:py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 text-sm md:text-base transition">
                        🔔 Change Team
                    </button>
                )}
            </div>

            {/* Rankings */}
            <div className="bg-quiz-secondary rounded-lg border border-quiz-border overflow-hidden">
                <div className="px-3 md:px-6 py-3 md:py-4 border-b border-quiz-border flex justify-between items-center">
                    <h2 className="text-base md:text-xl font-bold text-quiz-gold flex items-center gap-2">
                        <Award size={18} /> Live Rankings
                    </h2>
                    <span className="text-xs text-quiz-muted">{rankings.length} teams</span>
                </div>
                <div className="divide-y divide-quiz-border max-h-96 overflow-y-auto">
                    {rankings.map((team) => {
                        const isCurrent = currentTeam?.id === team.id;
                        return (
                            <div key={team.id} className={`px-3 md:px-6 py-2.5 md:py-3 flex items-center justify-between gap-3 transition ${isCurrent ? 'bg-quiz-gold/10 border-l-4 border-l-quiz-gold' : 'hover:bg-quiz-primary/50'
                                }`}>
                                <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                                    <div className={`flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center font-black text-sm md:text-lg ${team.rank === 1 ? 'bg-yellow-500 text-yellow-950' :
                                        team.rank === 2 ? 'bg-gray-300 text-gray-900' :
                                            team.rank === 3 ? 'bg-orange-500 text-orange-950' :
                                                'bg-quiz-accent text-quiz-muted'
                                        }`}>{team.rank}</div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-quiz-text truncate text-sm md:text-base">{team.name}</p>
                                            {team.rank <= 3 && <Trophy size={12} className="text-yellow-400 flex-shrink-0" />}
                                            {isCurrent && (
                                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-quiz-gold text-white font-bold uppercase">Now</span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-2 md:gap-3 text-[10px] md:text-xs text-quiz-muted mt-0.5">
                                            <span>Tot <span className="text-quiz-text font-semibold">{team.total_answers || 0}</span></span>
                                            <span>✓ <span className="text-green-500 font-semibold">{team.correct_count || 0}</span></span>
                                            <span>✗ <span className="text-red-500 font-semibold">{team.wrong_count || 0}</span></span>
                                            <span>P <span className="text-quiz-text font-semibold">{team.pass_count || 0}</span></span>
                                            <span>⚖ <span className="text-red-400 font-semibold">{team.penalty_count || 0}</span></span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="text-xl md:text-2xl font-black text-quiz-gold">{team.total_score}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Penalty Modal */}
            {penaltyModal && (
                <Modal title="⚖️ Apply Penalty" onClose={() => setPenaltyModal(false)}>
                    <form onSubmit={handlePenaltySubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold mb-2 text-quiz-text">Team</label>
                            <select value={penaltyTeam?.id || ''}
                                onChange={e => setPenaltyTeam(teams.find(t => t.id === Number(e.target.value)))}
                                required
                                className="w-full px-3 py-2 bg-quiz-primary border border-quiz-border rounded-lg text-quiz-text focus:outline-none focus:border-quiz-gold">
                                <option value="">-- Choose --</option>
                                {teams.map(t => <option key={t.id} value={t.id}>{t.team_order}. {t.name} ({t.short_name})</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-2 text-quiz-text">Points</label>
                            <div className="flex gap-2 mb-2 flex-wrap">
                                {[-5, -10, -15, -20].map(p => (
                                    <button key={p} type="button" onClick={() => setPenaltyPoints(p)}
                                        className={`px-3 md:px-4 py-2 rounded-lg font-bold text-sm transition ${penaltyPoints === p ? 'bg-red-600 text-white' : 'bg-quiz-primary text-quiz-text border border-quiz-border hover:border-red-500'
                                            }`}>{p}</button>
                                ))}
                            </div>
                            <input type="number" value={penaltyPoints}
                                onChange={e => setPenaltyPoints(parseInt(e.target.value) || 0)}
                                className="w-full px-3 py-2 bg-quiz-primary border border-quiz-border rounded-lg text-quiz-text focus:outline-none focus:border-red-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-2 text-quiz-text">Reason (optional)</label>
                            <input type="text" value={penaltyReason}
                                onChange={e => setPenaltyReason(e.target.value)}
                                placeholder="Rule violation..."
                                className="w-full px-3 py-2 bg-quiz-primary border border-quiz-border rounded-lg text-quiz-text focus:outline-none focus:border-quiz-gold" />
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-2">
                            <button type="button" onClick={() => setPenaltyModal(false)}
                                className="w-full sm:w-auto px-5 py-2.5 bg-quiz-accent text-quiz-text rounded-lg font-semibold">Cancel</button>
                            <button type="submit" disabled={loading || !penaltyTeam}
                                className="w-full sm:flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold disabled:opacity-50 transition">
                                Apply {penaltyPoints}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Buzzer Team Modal */}
            {buzzerTeamModal && (
                <Modal title="🔔 Select Buzzing Team" onClose={() => setBuzzerTeamModal(false)}>
                    <p className="text-sm text-quiz-muted mb-4">Click the team that buzzed in first:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-96 overflow-y-auto">
                        {teams.map(team => (
                            <button key={team.id}
                                onClick={() => handleBuzzerTeamSelect(team)}
                                className={`p-3 md:p-4 rounded-lg border-2 text-left transition ${currentTeam?.id === team.id ? 'bg-purple-600 border-purple-400 text-white'
                                    : 'bg-quiz-primary border-quiz-border hover:border-purple-500 text-quiz-text'
                                    }`}>
                                <p className="text-xs font-bold opacity-70">#{team.team_order}</p>
                                <p className="font-bold truncate text-sm md:text-base">{team.name}</p>
                                <p className="text-xs opacity-70">Score: {getScore(team.id)}</p>
                            </button>
                        ))}
                    </div>
                </Modal>
            )}
        </div>
    );
}

function StatusCell({ label, value, highlight, badge }) {
    return (
        <div className="p-3 md:p-4">
            <p className="text-[10px] md:text-xs text-quiz-muted uppercase tracking-wider font-semibold mb-1">{label}</p>
            {badge ? (
                <span className={`inline-block text-[10px] md:text-xs font-bold px-2 md:px-3 py-1 rounded ${badge}`}>{value}</span>
            ) : (
                <p className={`text-sm md:text-lg font-bold truncate ${highlight || 'text-quiz-text'}`}>{value}</p>
            )}
        </div>
    );
}

function MiniStat({ label, value, color }) {
    return (
        <div className="bg-quiz-primary/50 border border-quiz-border rounded-lg p-2 text-center">
            <p className="text-[9px] md:text-[10px] text-quiz-muted uppercase tracking-wider font-semibold">{label}</p>
            <p className={`text-base md:text-xl font-black ${color}`}>{value}</p>
        </div>
    );
}

function ScoreButton({ label, points, icon, color, onClick, disabled }) {
    const colors = {
        green: 'bg-green-600 hover:bg-green-700',
        blue: 'bg-blue-600 hover:bg-blue-700',
        red: 'bg-red-600 hover:bg-red-700',
        gray: 'bg-gray-600 hover:bg-gray-700'
    };
    return (
        <button onClick={onClick} disabled={disabled}
            className={`p-3 md:p-5 ${colors[color]} text-white rounded-xl font-bold transition flex flex-col items-center justify-center gap-1 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed`}>
            {icon}
            <span className="text-xs md:text-base">{label}</span>
            {points !== undefined && points !== null && (
                <span className="text-base md:text-2xl font-black">{points > 0 ? `+${points}` : points}</span>
            )}
        </button>
    );
}

function Modal({ title, onClose, children }) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-3 md:p-4">
            <div className="bg-quiz-secondary rounded-xl border border-quiz-border w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center p-4 md:p-5 border-b border-quiz-border sticky top-0 bg-quiz-secondary z-10">
                    <h3 className="text-lg md:text-xl font-bold text-quiz-text">{title}</h3>
                    <button onClick={onClose} className="p-1 text-quiz-muted hover:text-quiz-text transition">
                        <X size={22} />
                    </button>
                </div>
                <div className="p-4 md:p-5">{children}</div>
            </div>
        </div>
    );
}

export default ScoringDashboard;