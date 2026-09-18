import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    ScoreService, RankingService, TeamService,
    ScoringControlService, EventService, RoundService
} from '../services/api';
import {
    Check, X, Minus, AlertCircle, RotateCcw,
    Award, ArrowRight, Flag, Users, Ban, Trophy,
    Pause, Play, Lock, PartyPopper, ChevronRight, XCircle,
    Crown, Medal, ArrowUp, ArrowDown
} from 'lucide-react';

function CombinedDashboard({ eventId = 1, eventState, onUpdate }) {
    // ═══════════════ STATE ═══════════════
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

    const [currentRoundType, setCurrentRoundType] = useState(null);
    const [currentRoundNumber, setCurrentRoundNumber] = useState(null);
    const [rankChanges, setRankChanges] = useState({});

    const previousRanksRef = useRef({});
    const audiencePollRef = useRef(null);

    // ═══════════════ LOAD DATA ═══════════════
    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [teamsRes, rankingsRes, controlRes, roundsRes] = await Promise.all([
                TeamService.getAll(eventId),
                RankingService.getRankings(eventId),
                ScoringControlService.getCurrentTeam(eventId),
                RoundService.getAll(eventId)
            ]);

            const newRankings = rankingsRes.data;
            const prevRanks = previousRanksRef.current;
            const changes = {};
            newRankings.forEach(team => {
                const prevRank = prevRanks[team.id];
                if (prevRank !== undefined && prevRank !== team.rank) {
                    changes[team.id] = team.rank < prevRank ? 'up' : 'down';
                }
            });
            previousRanksRef.current = {};
            newRankings.forEach(t => { previousRanksRef.current[t.id] = t.rank; });

            const visibleChanges = {};
            Object.keys(changes).forEach(id => {
                if (changes[id] === 'up' || changes[id] === 'down') {
                    visibleChanges[id] = changes[id];
                }
            });
            setRankChanges(visibleChanges);
            setTimeout(() => setRankChanges({}), 2500);

            setTeams(teamsRes.data);
            setRankings(newRankings);

            const control = controlRes.data;
            setCurrentTeam(control.team);
            setCurrentRound(control.round);
            setQuestionIndex(control.questionIndex);
            setHasScoredThisQuestion(control.hasScoredThisQuestion || false);
            setIsPaused(control.isPaused || false);
            setCurrentRoundType(control.round?.type || null);
            setCurrentRoundNumber(control.round?.round_order || null);

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

    useEffect(() => {
        loadData();
        audiencePollRef.current = setInterval(async () => {
            try {
                const rankingsRes = await RankingService.getRankings(eventId);
                const newRankings = rankingsRes.data;
                const prevRanks = previousRanksRef.current;
                const changes = {};
                newRankings.forEach(team => {
                    const prevRank = prevRanks[team.id];
                    if (prevRank !== undefined && prevRank !== team.rank) {
                        changes[team.id] = team.rank < prevRank ? 'up' : 'down';
                    }
                });
                previousRanksRef.current = {};
                newRankings.forEach(t => { previousRanksRef.current[t.id] = t.rank; });
                const visibleChanges = {};
                Object.keys(changes).forEach(id => {
                    if (changes[id] === 'up' || changes[id] === 'down') {
                        visibleChanges[id] = changes[id];
                    }
                });
                setRankChanges(visibleChanges);
                setTimeout(() => setRankChanges({}), 2500);
                setRankings(newRankings);
            } catch (e) { /* silent */ }
        }, 2000);
        return () => clearInterval(audiencePollRef.current);
    }, [loadData, eventId]);

    const showMessage = (text, type = 'info') => {
        setMessage({ text, type });
        setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    };

    const isLastQuestion = currentRound && questionIndex === (currentRound.question_count - 1);

    // ═══════════════ SCORING ACTIONS ═══════════════
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

    const getScore = (id) => rankings.find(r => r.id === id)?.total_score || 0;
    const getRank = (id) => rankings.find(r => r.id === id)?.rank || '-';
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

    // ═══════════════ RENDER ═══════════════
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

    const topThree = rankings.slice(0, 3);
    const rest = rankings.slice(3);
    const isBuzzerRound = currentRoundType === 'buzzer';

    return (
        <div className="h-[calc(100vh-5rem)] md:h-[calc(100vh-6rem)] overflow-hidden p-2 md:p-3">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 md:gap-3 h-full">

                {/* ═══════════════════════════════════════════ */}
                {/* LEFT — SCORING PANEL (1/3)                  */}
                {/* ═══════════════════════════════════════════ */}
                <div className="flex flex-col gap-2 h-full overflow-y-auto min-w-0">

                    {/* Status bar */}
                    <div className="bg-quiz-secondary rounded-lg border border-quiz-border flex-shrink-0">
                        <div className="grid grid-cols-3 divide-x divide-quiz-border">
                            <div className="p-2">
                                <p className="text-[10px] uppercase text-quiz-muted font-bold">Round</p>
                                <p className="text-sm font-bold text-quiz-gold truncate">
                                    {currentRound ? `R${currentRound.round_order} — ${currentRound.name}` : 'N/A'}
                                </p>
                            </div>
                            <div className="p-2">
                                <p className="text-[10px] uppercase text-quiz-muted font-bold">Question</p>
                                <p className="text-sm font-bold text-quiz-text">
                                    {currentRound ? `${Math.min(questionIndex + 1, currentRound.question_count)} / ${currentRound.question_count}` : 'N/A'}
                                </p>
                            </div>
                            <div className="p-2">
                                <p className="text-[10px] uppercase text-quiz-muted font-bold">Type</p>
                                <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${isBuzzerRound ? 'bg-purple-500/20 text-purple-600' : 'bg-blue-500/20 text-blue-600'}`}>
                                    {currentRound?.type?.toUpperCase() || 'N/A'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Current team card */}
                    {currentTeam ? (
                        <div className={`bg-gradient-to-r from-quiz-gold/20 to-quiz-gold/5 border-2 rounded-lg p-3 flex-shrink-0 ${hasScoredThisQuestion ? 'border-green-500' : 'border-quiz-gold'}`}>
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-10 h-10 rounded-lg bg-quiz-gold flex items-center justify-center flex-shrink-0">
                                        <span className="text-base font-black text-white">{currentTeam.team_order}</span>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[9px] text-quiz-muted uppercase font-bold">
                                            {isBuzzerRound ? '🔔 Buzzing' : 'Now Answering'}
                                        </p>
                                        <h2 className="text-base font-black text-quiz-text truncate">{currentTeam.name}</h2>
                                    </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="text-[9px] text-quiz-muted uppercase font-bold">Score</p>
                                    <p className="text-xl font-black text-quiz-gold leading-none">{getScore(currentTeam.id)}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-5 gap-1">
                                <MiniStat label="T" value={getCounts(currentTeam.id).total} color="text-quiz-text" />
                                <MiniStat label="✓" value={getCounts(currentTeam.id).correct} color="text-green-600" />
                                <MiniStat label="✗" value={getCounts(currentTeam.id).wrong} color="text-red-600" />
                                <MiniStat label="P" value={getCounts(currentTeam.id).pass} color="text-quiz-muted" />
                                <MiniStat label="⚖" value={getCounts(currentTeam.id).penalty} color="text-red-700" />
                            </div>
                        </div>
                    ) : (
                        <div className="bg-quiz-secondary border-2 border-dashed border-quiz-border rounded-lg p-3 text-center flex-shrink-0">
                            <Users size={24} className="text-quiz-muted mx-auto mb-1" />
                            <p className="text-xs font-bold text-quiz-muted">
                                {isBuzzerRound ? '🔔 Waiting for buzz' : 'No team assigned'}
                            </p>
                            {isBuzzerRound && (
                                <button onClick={() => setBuzzerTeamModal(true)}
                                    className="mt-1.5 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-semibold">
                                    Select Team
                                </button>
                            )}
                        </div>
                    )}

                    {/* Score buttons */}
                    <div className="flex-shrink-0">
                        <p className="text-[10px] text-quiz-muted uppercase tracking-widest font-bold mb-1.5">Score This Question</p>
                        <div className="grid grid-cols-2 gap-2">
                            <ScoreBtn label="Correct" points={currentRound?.correct_points} icon={<Check size={22} />} color="green" onClick={() => handleScoreAction('correct')} disabled={!canScore} />
                            <ScoreBtn label="Half" points={currentRound?.half_points} icon={<Minus size={22} />} color="blue" onClick={() => handleScoreAction('half_correct')} disabled={!canScore} />
                            <ScoreBtn label="Wrong" points={currentRound?.wrong_points} icon={<X size={22} />} color="red" onClick={() => handleScoreAction('wrong')} disabled={!canScore} />
                            <ScoreBtn label="Pass" points={currentRound?.pass_points} icon={<AlertCircle size={22} />} color="gray" onClick={() => handleScoreAction('pass')} disabled={!canScore} />
                        </div>
                    </div>

                    {/* Next / Round complete button */}
                    <div className="flex-shrink-0">
                        {roundCompleted ? (
                            <button onClick={handleRoundCompleted} disabled={loading}
                                className={`w-full px-3 py-3 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 text-sm shadow-md transition ${hasNextRound
                                    ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800'
                                    : 'bg-gradient-to-r from-yellow-500 to-quiz-gold hover:opacity-90'
                                    }`}>
                                <PartyPopper size={18} />
                                {hasNextRound ? 'Round Completed → Next' : 'Event Completed'}
                            </button>
                        ) : (
                            <button onClick={handleNextQuestion}
                                disabled={loading || !currentRound || isPaused || !hasScoredThisQuestion}
                                className={`w-full px-3 py-3 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 text-sm shadow-md transition ${!hasScoredThisQuestion ? 'bg-gray-500 cursor-not-allowed' :
                                    isLastQuestion ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:opacity-90' :
                                        'bg-quiz-gold hover:opacity-90'
                                    }`}>
                                {!hasScoredThisQuestion ? (<><Lock size={18} /> Score Required</>) :
                                    isLastQuestion ? (<><PartyPopper size={18} /> Round Completed</>) :
                                        (<><ArrowRight size={18} /> Next Question</>)}
                            </button>
                        )}
                    </div>

                    {/* Utilities */}
                    <div className="grid grid-cols-3 gap-2 flex-shrink-0">
                        <button onClick={handlePause} disabled={loading || isPaused}
                            className="px-2 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1 disabled:opacity-50 transition">
                            <Pause size={14} /> Pause
                        </button>
                        <button onClick={() => openPenaltyModal(currentTeam)} disabled={loading || isPaused}
                            className="px-2 py-2.5 bg-red-900 hover:bg-red-800 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1 disabled:opacity-50 transition">
                            <Ban size={14} /> Penalty
                        </button>
                        <button onClick={handleUndo} disabled={loading || !currentTeam || isPaused}
                            className="px-2 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1 disabled:opacity-50 transition">
                            <RotateCcw size={14} /> Undo
                        </button>
                    </div>

                    {/* Buzzer round — change team */}
                    {isBuzzerRound && !roundCompleted && (
                        <button onClick={() => setBuzzerTeamModal(true)} disabled={loading || isPaused}
                            className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition flex-shrink-0">
                            🔔 Change Buzzing Team
                        </button>
                    )}

                    {/* Score assigned message */}
                    {hasScoredThisQuestion && !roundCompleted && (
                        <div className="flex items-center gap-1.5 text-[10px] text-green-700 bg-green-500/10 border border-green-500/40 rounded px-2 py-1.5 flex-shrink-0">
                            <Lock size={12} />
                            <span>Score assigned. Click <strong>{isLastQuestion ? 'Round Completed' : 'Next Question'}</strong>.</span>
                        </div>
                    )}

                    {/* Message toast */}
                    {message.text && (
                        <div className={`p-2 rounded-lg border text-xs flex-shrink-0 ${message.type === 'success' ? 'bg-green-500/10 border-green-500/40 text-green-700' :
                            message.type === 'error' ? 'bg-red-500/10 border-red-500/40 text-red-700' :
                                'bg-blue-500/10 border-blue-500/40 text-blue-700'
                            }`}>{message.text}</div>
                    )}
                </div>

                {/* ═══════════════════════════════════════════ */}
                {/* RIGHT — AUDIENCE VIEW (2/3)                 */}
                {/* ═══════════════════════════════════════════ */}
                <div className="lg:col-span-2 bg-white rounded-lg border-2 border-quiz-border overflow-hidden shadow-lg flex flex-col h-full min-h-0">

                    {/* Round info strip */}
                    <div className="bg-gradient-to-r from-[#C2185B] via-[#E91E63] to-[#7B1FA2] px-4 py-3 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-3 min-w-0">
                            {currentRoundNumber !== null && (
                                <span className="text-base font-black text-white bg-white/20 rounded px-2.5 py-1 flex-shrink-0">
                                    R{currentRoundNumber}
                                </span>
                            )}
                            <p className="text-base md:text-xl font-black text-white truncate">
                                {eventState?.current_round_name || 'Ex-Quiz-It'}
                            </p>
                        </div>
                        <p className="text-base md:text-xl font-black text-white flex-shrink-0">
                            Q {Math.min((eventState?.current_question_index || 0) + 1, eventState?.total_questions || 0)}
                            <span className="opacity-70">/{eventState?.total_questions || 0}</span>
                        </p>
                    </div>

                    {/* ⭐ CONTENT — fills remaining height, no scroll for ≤ 9 teams */}
                    <div className="flex-1 flex flex-col min-h-0 p-3 gap-3 overflow-hidden">
                        {/* ⭐ CONTENT — scrollable */}
                        {/* <div className="flex-1 overflow-y-auto p-3 space-y-3"> */}

                        {/* Top 3 — takes 2 parts of remaining space */}
                        {topThree.length > 0 && (
                            <div className="flex-[2] min-h-0 flex flex-col">
                                <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                                    <Crown size={18} className="text-quiz-orange" />
                                    <h3 className="text-sm font-black uppercase tracking-widest text-quiz-muted">Top Performers</h3>
                                    <div className="flex-1 h-0.5 bg-gradient-to-r from-quiz-border to-transparent"></div>
                                </div>
                                <div className="flex-1 grid grid-cols-3 gap-3">
                                    {topThree.map((team, idx) => {
                                        const position = idx + 1;
                                        const isActive = currentTeam?.id === team.id;
                                        const change = rankChanges[team.id];
                                        const config = {
                                            1: { border: 'border-yellow-400', medal: '🥇', gradient: 'from-yellow-500 to-yellow-700' },
                                            2: { border: 'border-gray-400', medal: '🥈', gradient: 'from-gray-400 to-gray-600' },
                                            3: { border: 'border-orange-400', medal: '🥉', gradient: 'from-orange-500 to-orange-700' },
                                        }[position];

                                        return (
                                            <div key={team.id}
                                                className={`relative overflow-visible bg-white rounded-lg border-2 ${config.border} p-3 md:p-4 shadow-sm flex flex-col justify-between ${isActive ? 'ring-2 ring-[#C2185B]' : ''}`}>
                                                <div className="absolute top-2 right-2 text-2xl md:text-3xl">{config.medal}</div>

                                                {isActive && (
                                                    <div className={`absolute -top-2.5 left-2 z-10 px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest text-white shadow-md ${isBuzzerRound ? 'bg-purple-600' : 'bg-[#C2185B]'}`}>
                                                        {isBuzzerRound ? '🔔 Buzzing' : '🎤 Answering'}
                                                    </div>
                                                )}

                                                {change && (
                                                    <div className={`absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center ${change === 'up' ? 'bg-green-500' : 'bg-red-500'}`}>
                                                        {change === 'up' ? <ArrowUp size={12} className="text-white" /> : <ArrowDown size={12} className="text-white" />}
                                                    </div>
                                                )}

                                                {/* Top row: rank + name */}
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-md bg-gradient-to-br ${config.gradient} text-white font-black flex items-center justify-center text-xl md:text-2xl`}>
                                                        {team.rank}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <h3 className="text-lg md:text-2xl font-black text-quiz-text truncate leading-tight">{team.name}</h3>
                                                        <p className="text-[10px] md:text-xs text-quiz-muted truncate">{team.short_name}</p>
                                                    </div>
                                                </div>

                                                {/* Score */}
                                                <div className="flex items-baseline gap-1.5 mb-2">
                                                    <span className="text-3xl md:text-4xl font-black text-[#C2185B] leading-none">{team.total_score}</span>
                                                    <span className="text-[10px] md:text-xs text-quiz-muted uppercase font-black">pts</span>
                                                </div>

                                                {/* ⭐ Stats row — T / ✓ / ✗ / P / ⚖ */}
                                                <div className="flex justify-between items-center pt-2 border-t border-quiz-border mt-auto">
                                                    <div className="text-center flex-1">
                                                        <p className="text-[9px] uppercase text-quiz-muted font-bold leading-tight">T</p>
                                                        <p className="text-xs md:text-sm font-black text-quiz-text leading-tight">{getCounts(team.id).total}</p>
                                                    </div>
                                                    <div className="text-center flex-1">
                                                        <p className="text-[9px] uppercase text-green-600 font-bold leading-tight">✓</p>
                                                        <p className="text-xs md:text-sm font-black text-green-600 leading-tight">{getCounts(team.id).correct}</p>
                                                    </div>
                                                    <div className="text-center flex-1">
                                                        <p className="text-[9px] uppercase text-red-600 font-bold leading-tight">✗</p>
                                                        <p className="text-xs md:text-sm font-black text-red-600 leading-tight">{getCounts(team.id).wrong}</p>
                                                    </div>
                                                    <div className="text-center flex-1">
                                                        <p className="text-[9px] uppercase text-quiz-muted font-bold leading-tight">P</p>
                                                        <p className="text-xs md:text-sm font-black text-quiz-muted leading-tight">{getCounts(team.id).pass}</p>
                                                    </div>
                                                    <div className="text-center flex-1">
                                                        <p className="text-[9px] uppercase text-red-800 font-bold leading-tight">⚖</p>
                                                        <p className="text-xs md:text-sm font-black text-red-800 leading-tight">{getCounts(team.id).penalty}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* All Teams — takes 3 parts of remaining space */}
                        {rest.length > 0 && (
                            <div className="flex-[3] min-h-0 flex flex-col">
                                <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                                    <Users size={18} className="text-quiz-muted" />
                                    <h3 className="text-sm font-black uppercase tracking-widest text-quiz-muted">All Teams</h3>
                                    <div className="flex-1 h-0.5 bg-gradient-to-r from-quiz-border to-transparent"></div>
                                    <span className="text-xs text-quiz-muted font-bold">{rest.length}</span>
                                </div>

                                <div className={`flex-1 min-h-0 grid gap-3 content-stretch ${rest.length <= 2 ? 'grid-cols-2' :
                                    rest.length <= 4 ? 'grid-cols-2' :
                                        rest.length <= 6 ? 'grid-cols-3' :
                                            rest.length <= 9 ? 'grid-cols-3' :
                                                'grid-cols-4'
                                    }`}>
                                    {rest.map((team) => {
                                        const isActive = currentTeam?.id === team.id;
                                        const change = rankChanges[team.id];
                                        const counts = getCounts(team.id);

                                        return (
                                            <div key={team.id}
                                                className={`relative overflow-visible flex flex-col gap-2 p-3 md:p-4 rounded-lg bg-white border-2 ${isActive
                                                    ? `border-[#C2185B] ring-2 ring-[#C2185B]/40 ${isBuzzerRound ? 'border-purple-600 ring-purple-500/40' : ''}`
                                                    : 'border-quiz-border'
                                                    } shadow-sm`}>

                                                {isActive && (
                                                    <div className={`absolute -top-2.5 left-2 z-10 px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest text-white shadow-lg ${isBuzzerRound ? 'bg-purple-600' : 'bg-[#C2185B]'}`}>
                                                        {isBuzzerRound ? '🔔 Buzzing' : '🎤 Answering'}
                                                    </div>
                                                )}

                                                {change && (
                                                    <div className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center ${change === 'up' ? 'bg-green-500' : 'bg-red-500'}`}>
                                                        {change === 'up' ? <ArrowUp size={12} className="text-white" /> : <ArrowDown size={12} className="text-white" />}
                                                    </div>
                                                )}

                                                {/* Top row: rank + name + score */}
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-lg bg-quiz-accent border border-quiz-border flex items-center justify-center font-black text-lg md:text-2xl text-quiz-text">
                                                        {team.rank}
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-base md:text-lg font-black text-quiz-text truncate leading-tight">{team.name}</h4>
                                                        <p className="text-[10px] md:text-xs text-quiz-muted truncate">{team.short_name}</p>
                                                    </div>

                                                    <div className="text-right flex-shrink-0">
                                                        <div className="text-2xl md:text-3xl font-black text-[#C2185B] leading-none">{team.total_score}</div>
                                                        <div className="text-[10px] text-quiz-muted uppercase font-black">pts</div>
                                                    </div>
                                                </div>

                                                {/* ⭐ Bottom row: Stats (T / ✓ / ✗ / P / ⚖) */}
                                                <div className="flex justify-between items-center pt-2 border-t border-quiz-border">
                                                    <div className="text-center flex-1">
                                                        <p className="text-[9px] md:text-[10px] uppercase text-quiz-muted font-bold leading-tight">T</p>
                                                        <p className="text-xs md:text-sm font-black text-quiz-text leading-tight">{counts.total}</p>
                                                    </div>
                                                    <div className="text-center flex-1">
                                                        <p className="text-[9px] md:text-[10px] uppercase text-green-600 font-bold leading-tight">✓</p>
                                                        <p className="text-xs md:text-sm font-black text-green-600 leading-tight">{counts.correct}</p>
                                                    </div>
                                                    <div className="text-center flex-1">
                                                        <p className="text-[9px] md:text-[10px] uppercase text-red-600 font-bold leading-tight">✗</p>
                                                        <p className="text-xs md:text-sm font-black text-red-600 leading-tight">{counts.wrong}</p>
                                                    </div>
                                                    <div className="text-center flex-1">
                                                        <p className="text-[9px] md:text-[10px] uppercase text-quiz-muted font-bold leading-tight">P</p>
                                                        <p className="text-xs md:text-sm font-black text-quiz-muted leading-tight">{counts.pass}</p>
                                                    </div>
                                                    <div className="text-center flex-1">
                                                        <p className="text-[9px] md:text-[10px] uppercase text-red-800 font-bold leading-tight">⚖</p>
                                                        <p className="text-xs md:text-sm font-black text-red-800 leading-tight">{counts.penalty}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ═══════════════ MODALS ═══════════════ */}
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

            {penaltyModal && (
                <Modal title="⚖️ Apply Penalty" onClose={() => setPenaltyModal(false)}>
                    <form onSubmit={handlePenaltySubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold mb-2 text-quiz-text">Team</label>
                            <select value={penaltyTeam?.id || ''}
                                onChange={e => setPenaltyTeam(teams.find(t => t.id === Number(e.target.value)))}
                                required
                                className="w-full px-3 py-2 bg-quiz-primary border border-quiz-border rounded-lg text-quiz-text">
                                <option value="">-- Choose --</option>
                                {teams.map(t => <option key={t.id} value={t.id}>{t.team_order}. {t.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-2 text-quiz-text">Points</label>
                            <div className="flex gap-2 mb-2 flex-wrap">
                                {[-5, -10, -15, -20].map(p => (
                                    <button key={p} type="button" onClick={() => setPenaltyPoints(p)}
                                        className={`px-3 py-2 rounded-lg font-bold text-sm transition ${penaltyPoints === p ? 'bg-red-600 text-white' : 'bg-quiz-primary text-quiz-text border border-quiz-border hover:border-red-500'}`}>{p}</button>
                                ))}
                            </div>
                            <input type="number" value={penaltyPoints}
                                onChange={e => setPenaltyPoints(parseInt(e.target.value) || 0)}
                                className="w-full px-3 py-2 bg-quiz-primary border border-quiz-border rounded-lg text-quiz-text" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-2 text-quiz-text">Reason (optional)</label>
                            <input type="text" value={penaltyReason}
                                onChange={e => setPenaltyReason(e.target.value)}
                                className="w-full px-3 py-2 bg-quiz-primary border border-quiz-border rounded-lg text-quiz-text" />
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

            {buzzerTeamModal && (
                <Modal title="🔔 Select Buzzing Team" onClose={() => setBuzzerTeamModal(false)}>
                    <p className="text-sm text-quiz-muted mb-4">Click the team that buzzed in first:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-96 overflow-y-auto">
                        {teams.map(team => (
                            <button key={team.id}
                                onClick={() => handleBuzzerTeamSelect(team)}
                                className={`p-3 rounded-lg border-2 text-left transition ${currentTeam?.id === team.id ? 'bg-purple-600 border-purple-400 text-white'
                                    : 'bg-quiz-primary border-quiz-border hover:border-purple-500 text-quiz-text'}`}>
                                <p className="text-xs font-bold opacity-70">#{team.team_order}</p>
                                <p className="font-bold truncate text-sm">{team.name}</p>
                            </button>
                        ))}
                    </div>
                </Modal>
            )}
        </div>
    );
}

// ═══════════════ HELPERS ═══════════════
function MiniStat({ label, value, color }) {
    return (
        <div className="bg-quiz-primary/50 border border-quiz-border rounded p-1 text-center">
            <p className="text-[9px] text-quiz-muted uppercase font-bold leading-tight">{label}</p>
            <p className={`text-sm md:text-base font-black ${color}`}>{value}</p>
        </div>
    );
}

function ScoreBtn({ label, points, icon, color, onClick, disabled }) {
    const colors = {
        green: 'bg-green-500 hover:bg-green-600',
        blue: 'bg-blue-400 hover:bg-blue-500',
        red: 'bg-red-400 hover:bg-red-500',
        gray: 'bg-gray-400 hover:bg-gray-500'
    };
    return (
        <button onClick={onClick} disabled={disabled}
            className={`p-2.5 md:p-3 ${colors[color]} text-white rounded-lg font-bold transition flex flex-col items-center justify-center gap-0.5 shadow-md disabled:opacity-40 disabled:cursor-not-allowed`}>
            {icon}
            <span className="text-xs md:text-sm">{label}</span>
            {points !== undefined && points !== null && (
                <span className="text-base md:text-lg font-black">{points > 0 ? `+${points}` : points}</span>
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

export default CombinedDashboard;