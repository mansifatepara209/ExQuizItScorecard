import React, { useState, useEffect, useCallback } from 'react';
import {
    ScoreService, RankingService, TeamService,
    ScoringControlService, EventService, RoundService
} from '../services/api';
import {
    Check, X, Minus, AlertCircle, RotateCcw,
    Award, ArrowRight, Flag, Users, Ban, Trophy,
    Pause, Play, Lock, PartyPopper, ChevronRight, XCircle,
    Maximize2, Minimize2
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

    const [roundCompleted, setRoundCompleted] = useState(false);
    const [hasNextRound, setHasNextRound] = useState(false);
    const [showNextRoundModal, setShowNextRoundModal] = useState(false);
    const [completedRoundInfo, setCompletedRoundInfo] = useState(null);

    const [penaltyModal, setPenaltyModal] = useState(false);
    const [penaltyTeam, setPenaltyTeam] = useState(null);
    const [penaltyPoints, setPenaltyPoints] = useState(-10);
    const [penaltyReason, setPenaltyReason] = useState('');

    const [buzzerTeamModal, setBuzzerTeamModal] = useState(false);

    // ⭐ Projector zoom
    const [zoom, setZoom] = useState(() => {
        return Number(localStorage.getItem('scoringZoom')) || 1;
    });

    useEffect(() => {
        localStorage.setItem('scoringZoom', String(zoom));
    }, [zoom]);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [teamsRes, rankingsRes, controlRes, roundsRes] = await Promise.all([
                TeamService.getAll(eventId),
                RankingService.getRankings(eventId),
                ScoringControlService.getCurrentTeam(eventId),
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

            if (control.round && control.questionIndex >= control.round.question_count) {
                setRoundCompleted(true);
                const hasNext = roundsRes.data.some(r => r.round_order > control.round.round_order);
                setHasNextRound(hasNext);
                setCompletedRoundInfo({
                    roundId: control.round.id,
                    roundName: control.round.name,
                    roundOrder: control.round.round_order
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

    const isLastQuestion = currentRound && questionIndex === (currentRound.question_count - 1);

    const handleScoreAction = async (action) => {
        if (isPaused) { showMessage('Event is paused', 'error'); return; }
        if (!currentRound?.id) { showMessage('No active round', 'error'); return; }
        if (!currentTeam && currentRound?.type !== 'buzzer') { showMessage('No active team', 'error'); return; }
        if (currentRound.type === 'buzzer' && !currentTeam?.id) { setBuzzerTeamModal(true); return; }
        if (hasScoredThisQuestion) { showMessage('This question is already scored.', 'error'); return; }

        try {
            setLoading(true);
            await ScoreService.apply({
                eventId, teamId: currentTeam.id, roundId: currentRound.id, questionIndex, action
            });
            showMessage(`✓ ${action.replace('_', ' ')} applied to ${currentTeam.name}`, 'success');
            setHasScoredThisQuestion(true);
            await loadData();
            if (onUpdate) onUpdate();
        } catch (error) {
            showMessage('Error: ' + (error.response?.data?.error || error.message), 'error');
        } finally { setLoading(false); }
    };

    const handleNextQuestion = async () => {
        if (isPaused) { showMessage('Event is paused', 'error'); return; }
        if (!hasScoredThisQuestion) { showMessage('⚠️ Assign a score first', 'error'); return; }

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
                if (res.data.hasNextRound) setShowNextRoundModal(true);
                setHasScoredThisQuestion(false);
                await loadData();
                if (onUpdate) onUpdate();
                showMessage(res.data.hasNextRound ? '🎉 Round completed!' : '🏆 Final round completed!', 'success');
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

    const handleRoundCompleted = () => {
        if (!hasNextRound) { showMessage('🏆 Event fully completed!', 'success'); return; }
        setShowNextRoundModal(true);
    };

    const handleNextRoundConfirm = async () => {
        try {
            setLoading(true);
            await ScoringControlService.nextRound(eventId);
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

    const handleNextRoundCancel = () => {
        setShowNextRoundModal(false);
        showMessage('Cancelled — stay on current round', 'info');
    };

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
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-quiz-gold"></div>
            </div>
        );
    }

    if (!eventState?.is_started) {
        return (
            <div className="text-center py-20 md:py-24 bg-quiz-secondary rounded-lg border border-quiz-border px-4">
                <Flag size={64} className="text-quiz-muted mx-auto mb-4" />
                <h2 className="text-3xl md:text-4xl font-bold text-quiz-text mb-3">Event Not Started</h2>
                <p className="text-lg text-quiz-muted">Click "Start Event" in the sidebar</p>
            </div>
        );
    }

    // ⭐ Dynamic sizes based on zoom
    const S = {
        1: {
            badge: 'text-xs md:text-sm',
            label: 'text-[10px] md:text-xs',
            statusValue: 'text-lg md:text-2xl',
            teamLabel: 'text-xs md:text-sm',
            teamName: 'text-2xl md:text-4xl',
            teamMeta: 'text-sm md:text-base',
            statLabel: 'text-[10px] md:text-xs',
            statValue: 'text-lg md:text-2xl',
            scoreBig: 'text-4xl md:text-5xl',
            scoreLabel: 'text-xs',
            sectionLabel: 'text-xs md:text-sm',
            scoreBtn: 'p-4 md:p-6',
            scoreBtnLabel: 'text-sm md:text-base',
            scoreBtnNum: 'text-xl md:text-3xl',
            actionBtn: 'px-4 md:px-6 py-3 md:py-4 text-sm md:text-base',
            rankNum: 'text-xl md:text-2xl',
            rankName: 'text-base md:text-lg',
            rankMeta: 'text-xs',
            rankScore: 'text-2xl md:text-3xl',
            rankPts: 'text-[9px]',
        },
        2: {
            badge: 'text-base md:text-lg',
            label: 'text-xs md:text-sm',
            statusValue: 'text-2xl md:text-3xl',
            teamLabel: 'text-sm md:text-base',
            teamName: 'text-3xl md:text-5xl',
            teamMeta: 'text-base md:text-lg',
            statLabel: 'text-xs md:text-sm',
            statValue: 'text-2xl md:text-3xl',
            scoreBig: 'text-5xl md:text-6xl',
            scoreLabel: 'text-sm',
            sectionLabel: 'text-base md:text-lg',
            scoreBtn: 'p-5 md:p-8',
            scoreBtnLabel: 'text-base md:text-lg',
            scoreBtnNum: 'text-2xl md:text-4xl',
            actionBtn: 'px-5 md:px-7 py-4 md:py-5 text-base md:text-lg',
            rankNum: 'text-2xl md:text-3xl',
            rankName: 'text-lg md:text-xl',
            rankMeta: 'text-sm',
            rankScore: 'text-3xl md:text-4xl',
            rankPts: 'text-[10px]',
        },
    }[zoom];

    return (
        <div className="space-y-4 md:space-y-6 relative">
            {isPaused && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
                    <div className="bg-quiz-secondary p-8 md:p-10 rounded-2xl border-4 border-yellow-500 text-center max-w-md w-full">
                        <div className="w-24 h-24 mx-auto rounded-full bg-yellow-500/20 border-4 border-yellow-500 flex items-center justify-center mb-5">
                            <Pause size={48} className="text-yellow-500" />
                        </div>
                        <h2 className="text-3xl md:text-4xl font-black text-yellow-400 mb-3">EVENT PAUSED</h2>
                        <p className="text-base text-quiz-muted mb-6">Scoring is disabled until you resume</p>
                        <button onClick={handleResume}
                            className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 text-xl transition">
                            <Play size={24} /> RESUME EVENT
                        </button>
                    </div>
                </div>
            )}

            {/* ⭐ Zoom toggle */}
            <button
                onClick={() => setZoom(z => (z === 1 ? 2 : 1))}
                className="fixed top-4 right-4 z-50 px-4 py-2 rounded-lg bg-[#C2185B] text-white font-bold shadow-xl hover:bg-[#8B1538] transition flex items-center gap-2"
                title={zoom === 1 ? 'Enlarge for projector' : 'Back to normal size'}
            >
                {zoom === 1 ? <Maximize2 size={20} /> : <Minimize2 size={20} />}
                <span className="text-sm md:text-base">{zoom === 1 ? 'ENLARGE' : 'NORMAL'}</span>
            </button>

            {showNextRoundModal && completedRoundInfo && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-quiz-secondary rounded-2xl border-2 border-quiz-gold max-w-lg w-full overflow-hidden shadow-2xl">
                        <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-6 text-center">
                            <PartyPopper size={56} className="text-white mx-auto mb-3" />
                            <h2 className="text-3xl md:text-4xl font-black text-white">ROUND COMPLETED</h2>
                            <p className="text-base text-green-100 mt-2">
                                R{completedRoundInfo.roundOrder} — {completedRoundInfo.roundName}
                            </p>
                        </div>
                        <div className="p-6 text-center space-y-4">
                            <p className="text-xl text-quiz-text font-semibold">Ready to start the next round?</p>
                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                <button onClick={handleNextRoundCancel} disabled={loading}
                                    className="flex-1 px-6 py-4 bg-quiz-accent hover:bg-quiz-primary text-quiz-text border border-quiz-border rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition text-lg">
                                    <XCircle size={22} /> Cancel
                                </button>
                                <button onClick={handleNextRoundConfirm} disabled={loading}
                                    className="flex-1 px-6 py-4 bg-gradient-to-r from-quiz-gold to-red-500 hover:opacity-90 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition text-lg">
                                    <ChevronRight size={22} /> Next Round
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ⭐⭐⭐ TWO-COLUMN LAYOUT ⭐⭐⭐ */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] 2xl:grid-cols-[1fr_460px] gap-4 md:gap-6">

                {/* ════ LEFT — SCORING CONTROLS ════ */}
                <div className="space-y-4 md:space-y-6 min-w-0">

                    {/* Status bar */}
                    <div className="bg-quiz-secondary rounded-lg border border-quiz-border overflow-hidden">
                        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-quiz-border">
                            <StatusCell label="Round" value={currentRound ? `R${currentRound.round_order} — ${currentRound.name}` : 'N/A'} highlight="text-quiz-gold" S={S} />
                            <StatusCell label="Question" value={currentRound ? `${Math.min(questionIndex + 1, currentRound.question_count)} / ${currentRound.question_count}` : 'N/A'} S={S} />
                            <StatusCell label="Type" value={currentRound?.type?.toUpperCase() || 'N/A'}
                                badge={currentRound?.type === 'buzzer' ? 'bg-purple-500/20 text-purple-600' : 'bg-blue-500/20 text-blue-600'} S={S} />
                        </div>
                    </div>

                    {message.text && (
                        <div className={`p-4 md:p-5 rounded-lg border-2 text-base md:text-lg font-semibold ${message.type === 'success' ? 'bg-green-500/10 border-green-500/40 text-green-700' :
                            message.type === 'error' ? 'bg-red-500/10 border-red-500/40 text-red-700' :
                                'bg-blue-500/10 border-blue-500/40 text-blue-700'
                            }`}>{message.text}</div>
                    )}

                    {/* Current team */}
                    {currentTeam ? (
                        <div className={`bg-gradient-to-r from-quiz-gold/20 to-quiz-gold/5 border-4 rounded-xl p-5 md:p-7 ${hasScoredThisQuestion ? 'border-green-500' : 'border-quiz-gold'}`}>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
                                <div className="flex items-center gap-4 md:gap-5">
                                    <div className={`rounded-2xl bg-quiz-gold flex items-center justify-center flex-shrink-0 ${zoom === 1 ? 'w-16 h-16 md:w-20 md:h-20' : 'w-20 h-20 md:w-24 md:h-24'}`}>
                                        <span className={`font-black text-white ${zoom === 1 ? 'text-2xl md:text-3xl' : 'text-3xl md:text-4xl'}`}>{currentTeam.team_order}</span>
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`${S.teamLabel} text-quiz-muted uppercase tracking-widest font-black mb-1`}>
                                            {currentRound?.type === 'buzzer' ? '🔔 Buzzing Team' : '🎤 Now Answering'}
                                        </p>
                                        <h2 className={`${S.teamName} font-black text-quiz-text truncate`}>{currentTeam.name}</h2>
                                        <p className={`${S.teamMeta} text-quiz-muted truncate`}>
                                            {currentTeam.short_name}{currentTeam.institution && ` • ${currentTeam.institution}`}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-6 md:gap-10 justify-around sm:justify-end">
                                    <div className="text-center">
                                        <p className={`${S.scoreLabel} text-quiz-muted uppercase font-black`}>Score</p>
                                        <p className={`${S.scoreBig} font-black text-quiz-gold leading-none`}>{getScore(currentTeam.id)}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className={`${S.scoreLabel} text-quiz-muted uppercase font-black`}>Rank</p>
                                        <p className={`${S.scoreBig} font-black text-quiz-text leading-none`}>#{getRank(currentTeam.id)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-5 gap-3 mt-5">
                                <MiniStat label="Total" value={getCounts(currentTeam.id).total} color="text-quiz-gold" S={S} />
                                <MiniStat label="Correct" value={getCounts(currentTeam.id).correct} color="text-green-600" S={S} />
                                <MiniStat label="Wrong" value={getCounts(currentTeam.id).wrong} color="text-red-600" S={S} />
                                <MiniStat label="Pass" value={getCounts(currentTeam.id).pass} color="text-quiz-muted" S={S} />
                                <MiniStat label="Penalty" value={getCounts(currentTeam.id).penalty} color="text-red-700" S={S} />
                            </div>

                            {hasScoredThisQuestion && !roundCompleted && (
                                <div className="mt-4 flex items-center gap-3 text-base text-green-700 bg-green-500/10 border-2 border-green-500/40 rounded-lg px-4 py-3 font-semibold">
                                    <Lock size={18} />
                                    <span>
                                        Score assigned. Click <strong>{isLastQuestion ? 'Round Completed' : 'Next Question'}</strong> to continue.
                                    </span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-quiz-secondary border-4 border-dashed border-quiz-border rounded-xl p-8 md:p-12 text-center">
                            <Users size={64} className="text-quiz-muted mx-auto mb-4" />
                            <h3 className="text-2xl md:text-3xl font-bold text-quiz-text mb-3">
                                {currentRound?.type === 'buzzer' ? '🔔 Waiting for buzz' : 'No team assigned'}
                            </h3>
                            {currentRound?.type === 'buzzer' && (
                                <button onClick={() => setBuzzerTeamModal(true)}
                                    className="mt-4 px-6 md:px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-lg">
                                    Select Team
                                </button>
                            )}
                        </div>
                    )}

                    {/* Score buttons */}
                    <div>
                        <p className={`${S.sectionLabel} text-quiz-muted uppercase tracking-widest font-black mb-3`}>
                            Score This Question
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                            <ScoreButton label="Correct" points={currentRound?.correct_points} icon={<Check size={zoom === 1 ? 24 : 32} />} color="green" onClick={() => handleScoreAction('correct')} disabled={!canScore} S={S} />
                            <ScoreButton label="Half" points={currentRound?.half_points} icon={<Minus size={zoom === 1 ? 24 : 32} />} color="blue" onClick={() => handleScoreAction('half_correct')} disabled={!canScore} S={S} />
                            <ScoreButton label="Wrong" points={currentRound?.wrong_points} icon={<X size={zoom === 1 ? 24 : 32} />} color="red" onClick={() => handleScoreAction('wrong')} disabled={!canScore} S={S} />
                            <ScoreButton label="Pass" points={currentRound?.pass_points} icon={<AlertCircle size={zoom === 1 ? 24 : 32} />} color="gray" onClick={() => handleScoreAction('pass')} disabled={!canScore} S={S} />
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-3 md:gap-4">
                        {roundCompleted ? (
                            <button onClick={handleRoundCompleted} disabled={loading}
                                className={`flex-1 min-w-full sm:min-w-[220px] text-white rounded-lg font-black flex items-center justify-center gap-3 disabled:opacity-50 shadow-lg transition ${S.actionBtn} ${hasNextRound
                                    ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800'
                                    : 'bg-gradient-to-r from-yellow-500 to-quiz-gold hover:opacity-90'
                                    }`}>
                                <PartyPopper size={zoom === 1 ? 22 : 28} />
                                {hasNextRound ? 'Round Completed → Next Round' : 'Event Completed'}
                            </button>
                        ) : (
                            <button onClick={handleNextQuestion}
                                disabled={loading || !currentRound || isPaused || !hasScoredThisQuestion}
                                className={`flex-1 min-w-full sm:min-w-[220px] text-white rounded-lg font-black flex items-center justify-center gap-3 disabled:opacity-50 shadow-lg transition ${S.actionBtn} ${!hasScoredThisQuestion ? 'bg-gray-500 cursor-not-allowed' :
                                    isLastQuestion ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:opacity-90' :
                                        'bg-quiz-gold hover:opacity-90'
                                    }`}>
                                {!hasScoredThisQuestion ? (
                                    <><Lock size={zoom === 1 ? 22 : 28} /> Score Required</>
                                ) : isLastQuestion ? (
                                    <><PartyPopper size={zoom === 1 ? 22 : 28} /> Round Completed</>
                                ) : (
                                    <><ArrowRight size={zoom === 1 ? 22 : 28} /> Next Question</>
                                )}
                            </button>
                        )}

                        <button onClick={handlePause} disabled={loading || isPaused}
                            className={`flex-1 sm:flex-none bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-black flex items-center justify-center gap-2 disabled:opacity-50 transition ${S.actionBtn}`}>
                            <Pause size={zoom === 1 ? 20 : 24} /> Pause
                        </button>

                        <button onClick={() => openPenaltyModal(currentTeam)} disabled={loading || isPaused}
                            className={`flex-1 sm:flex-none bg-red-900 hover:bg-red-800 text-white rounded-lg font-black flex items-center justify-center gap-2 disabled:opacity-50 transition ${S.actionBtn}`}>
                            <Ban size={zoom === 1 ? 20 : 24} /> Penalty
                        </button>

                        <button onClick={handleUndo} disabled={loading || !currentTeam || isPaused}
                            className={`flex-1 sm:flex-none bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-black flex items-center justify-center gap-2 disabled:opacity-50 transition ${S.actionBtn}`}>
                            <RotateCcw size={zoom === 1 ? 20 : 24} /> Undo
                        </button>

                        {currentRound?.type === 'buzzer' && !roundCompleted && (
                            <button onClick={() => setBuzzerTeamModal(true)} disabled={loading || isPaused}
                                className={`w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-black flex items-center justify-center gap-2 transition ${S.actionBtn}`}>
                                🔔 Change Team
                            </button>
                        )}
                    </div>
                </div>

                {/* ════ RIGHT — LIVE RANKINGS ════ */}
                <div className="xl:sticky xl:top-4 xl:self-start">
                    <div className="bg-quiz-secondary rounded-lg border-2 border-quiz-border overflow-hidden flex flex-col xl:max-h-[calc(100vh-2rem)]">
                        <div className="px-4 md:px-5 py-4 border-b-2 border-quiz-border flex justify-between items-center bg-gradient-to-r from-quiz-gold/10 to-transparent flex-shrink-0">
                            <h2 className={`${S.sectionLabel} font-black text-quiz-gold flex items-center gap-2`}>
                                <Award size={zoom === 1 ? 22 : 28} /> LIVE RANKINGS
                            </h2>
                            <span className="text-sm md:text-base text-quiz-muted font-black">{rankings.length} teams</span>
                        </div>
                        <div className="divide-y divide-quiz-border overflow-y-auto">
                            {rankings.map((team) => {
                                const isCurrent = currentTeam?.id === team.id;
                                return (
                                    <div key={team.id}
                                        className={`px-4 md:px-5 py-3 flex items-center justify-between gap-3 transition ${isCurrent ? 'bg-quiz-gold/10 border-l-4 border-l-quiz-gold' : 'hover:bg-quiz-primary/50'}`}>
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className={`flex-shrink-0 rounded-lg flex items-center justify-center font-black ${S.rankNum} ${zoom === 1 ? 'w-10 h-10 md:w-12 md:h-12' : 'w-14 h-14 md:w-16 md:h-16'} ${team.rank === 1 ? 'bg-yellow-500 text-yellow-950' :
                                                team.rank === 2 ? 'bg-gray-300 text-gray-900' :
                                                    team.rank === 3 ? 'bg-orange-500 text-orange-950' :
                                                        'bg-quiz-accent text-quiz-muted'
                                                }`}>{team.rank}</div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className={`${S.rankName} font-black text-quiz-text truncate`}>{team.name}</p>
                                                    {team.rank <= 3 && <Trophy size={16} className="text-yellow-500 flex-shrink-0" />}
                                                    {isCurrent && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded bg-quiz-gold text-white font-black uppercase flex-shrink-0">Now</span>
                                                    )}
                                                </div>
                                                <div className={`flex flex-wrap gap-2 ${S.rankMeta} text-quiz-muted mt-1 font-bold`}>
                                                    <span>Tot <span className="text-quiz-text font-black">{team.total_answers || 0}</span></span>
                                                    <span>✓ <span className="text-green-600 font-black">{team.correct_count || 0}</span></span>
                                                    <span>✗ <span className="text-red-600 font-black">{team.wrong_count || 0}</span></span>
                                                    <span>P <span className="text-quiz-text font-black">{team.pass_count || 0}</span></span>
                                                    <span>⚖ <span className="text-red-700 font-black">{team.penalty_count || 0}</span></span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className={`${S.rankScore} font-black text-quiz-gold leading-none`}>{team.total_score}</p>
                                            <p className={`${S.rankPts} text-quiz-muted uppercase tracking-widest font-black`}>pts</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

            </div>

            {/* Penalty Modal */}
            {penaltyModal && (
                <Modal title="⚖️ Apply Penalty" onClose={() => setPenaltyModal(false)}>
                    <form onSubmit={handlePenaltySubmit} className="space-y-5">
                        <div>
                            <label className="block text-base font-bold mb-2 text-quiz-text">Team</label>
                            <select value={penaltyTeam?.id || ''}
                                onChange={e => setPenaltyTeam(teams.find(t => t.id === Number(e.target.value)))}
                                required
                                className="w-full px-4 py-3 text-lg bg-quiz-primary border-2 border-quiz-border rounded-lg text-quiz-text focus:outline-none focus:border-quiz-gold">
                                <option value="">-- Choose --</option>
                                {teams.map(t => <option key={t.id} value={t.id}>{t.team_order}. {t.name} ({t.short_name})</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-base font-bold mb-2 text-quiz-text">Points</label>
                            <div className="flex gap-2 mb-3 flex-wrap">
                                {[-5, -10, -15, -20].map(p => (
                                    <button key={p} type="button" onClick={() => setPenaltyPoints(p)}
                                        className={`px-5 py-3 rounded-lg font-black text-lg transition ${penaltyPoints === p ? 'bg-red-600 text-white' : 'bg-quiz-primary text-quiz-text border-2 border-quiz-border hover:border-red-500'}`}>{p}</button>
                                ))}
                            </div>
                            <input type="number" value={penaltyPoints}
                                onChange={e => setPenaltyPoints(parseInt(e.target.value) || 0)}
                                className="w-full px-4 py-3 text-lg bg-quiz-primary border-2 border-quiz-border rounded-lg text-quiz-text focus:outline-none focus:border-red-500" />
                        </div>
                        <div>
                            <label className="block text-base font-bold mb-2 text-quiz-text">Reason (optional)</label>
                            <input type="text" value={penaltyReason}
                                onChange={e => setPenaltyReason(e.target.value)}
                                placeholder="Rule violation..."
                                className="w-full px-4 py-3 text-lg bg-quiz-primary border-2 border-quiz-border rounded-lg text-quiz-text focus:outline-none focus:border-quiz-gold" />
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                            <button type="button" onClick={() => setPenaltyModal(false)}
                                className="w-full sm:w-auto px-6 py-3 bg-quiz-accent text-quiz-text rounded-lg font-bold text-lg">Cancel</button>
                            <button type="submit" disabled={loading || !penaltyTeam}
                                className="w-full sm:flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-black text-lg disabled:opacity-50 transition">
                                Apply {penaltyPoints}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Buzzer Team Modal */}
            {buzzerTeamModal && (
                <Modal title="🔔 Select Buzzing Team" onClose={() => setBuzzerTeamModal(false)}>
                    <p className="text-lg text-quiz-muted mb-4 font-semibold">Click the team that buzzed in first:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                        {teams.map(team => (
                            <button key={team.id}
                                onClick={() => handleBuzzerTeamSelect(team)}
                                className={`p-4 md:p-5 rounded-lg border-2 text-left transition ${currentTeam?.id === team.id ? 'bg-purple-600 border-purple-400 text-white'
                                    : 'bg-quiz-primary border-quiz-border hover:border-purple-500 text-quiz-text'
                                    }`}>
                                <p className="text-base font-black opacity-70">#{team.team_order}</p>
                                <p className="font-black truncate text-lg md:text-xl">{team.name}</p>
                                <p className="text-sm opacity-70 font-semibold">Score: {getScore(team.id)}</p>
                            </button>
                        ))}
                    </div>
                </Modal>
            )}
        </div>
    );
}

function StatusCell({ label, value, highlight, badge, S }) {
    return (
        <div className="p-4 md:p-5">
            <p className={`${S.label} text-quiz-muted uppercase tracking-wider font-black mb-1`}>{label}</p>
            {badge ? (
                <span className={`inline-block font-black px-3 py-1 rounded ${badge} ${S.statusValue}`}>{value}</span>
            ) : (
                <p className={`${S.statusValue} font-black truncate ${highlight || 'text-quiz-text'}`}>{value}</p>
            )}
        </div>
    );
}

function MiniStat({ label, value, color, S }) {
    return (
        <div className="bg-quiz-primary/50 border-2 border-quiz-border rounded-lg p-3 text-center">
            <p className={`${S.statLabel} text-quiz-muted uppercase tracking-wider font-black`}>{label}</p>
            <p className={`${S.statValue} font-black ${color}`}>{value}</p>
        </div>
    );
}

function ScoreButton({ label, points, icon, color, onClick, disabled, S }) {
    const colors = {
        green: 'bg-green-500 hover:bg-green-600',
        blue: 'bg-blue-400 hover:bg-blue-500',
        red: 'bg-red-400 hover:bg-red-500',
        gray: 'bg-gray-400 hover:bg-gray-500'
    };
    return (
        <button onClick={onClick} disabled={disabled}
            className={`${S.scoreBtn} ${colors[color]} text-white rounded-xl font-black transition flex flex-col items-center justify-center gap-2 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed`}>
            {icon}
            <span className={`${S.scoreBtnLabel} font-black`}>{label}</span>
            {points !== undefined && points !== null && (
                <span className={`${S.scoreBtnNum} font-black leading-none`}>{points > 0 ? `+${points}` : points}</span>
            )}
        </button>
    );
}

function Modal({ title, onClose, children }) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-3 md:p-4">
            <div className="bg-quiz-secondary rounded-xl border-2 border-quiz-border w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center p-5 md:p-6 border-b-2 border-quiz-border sticky top-0 bg-quiz-secondary z-10">
                    <h3 className="text-xl md:text-2xl font-black text-quiz-text">{title}</h3>
                    <button onClick={onClose} className="p-2 text-quiz-muted hover:text-quiz-text transition">
                        <X size={26} />
                    </button>
                </div>
                <div className="p-5 md:p-6">{children}</div>
            </div>
        </div>
    );
}

export default ScoringDashboard;