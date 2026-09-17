import React, { useState, useEffect, useRef } from 'react';
import { RankingService, EventService, ScoringControlService } from '../services/api';
import { Trophy, Medal, Award, ArrowUp, ArrowDown, Users, Crown, PartyPopper, Rocket } from 'lucide-react';

function AudienceScoreboard({ eventId = 1 }) {
    const [rankings, setRankings] = useState([]);
    const [eventState, setEventState] = useState(null);
    const [currentTeam, setCurrentTeam] = useState(null);
    const [currentRoundType, setCurrentRoundType] = useState(null);
    const [currentRoundNumber, setCurrentRoundNumber] = useState(null);
    const [loading, setLoading] = useState(true);
    const [rankChanges, setRankChanges] = useState({});

    // Splash
    const [splash, setSplash] = useState(null);
    const [shownSplashes, setShownSplashes] = useState(new Set());
    const splashTimerRef = useRef(null);

    const previousRanksRef = useRef({});

    const loadData = async () => {
        try {
            const [rankingsRes, stateRes, controlRes, splashRes] = await Promise.all([
                RankingService.getRankings(eventId),
                EventService.getState(eventId),
                ScoringControlService.getCurrentTeam(eventId),
                ScoringControlService.getSplash(eventId)
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

            setRankings(newRankings);
            setEventState(stateRes.data);
            setCurrentTeam(controlRes.data.team || null);
            setCurrentRoundType(controlRes.data.round?.type || null);
            setCurrentRoundNumber(controlRes.data.round?.round_order || null);

            const visibleChanges = {};
            Object.keys(changes).forEach(id => {
                if (changes[id] === 'up' || changes[id] === 'down') {
                    visibleChanges[id] = changes[id];
                }
            });
            setRankChanges(visibleChanges);
            setTimeout(() => setRankChanges({}), 2500);

            // ⭐ SPLASH LOGIC
            const eventIsActive =
                (stateRes.data?.is_started === 1 || stateRes.data?.is_started === true) &&
                (stateRes.data?.is_paused === 0 || stateRes.data?.is_paused === false);
            const splashData = splashRes.data;

            console.log('📊 Splash data from API:', splashData);
            console.log('📊 Event active:', eventIsActive);

            if (eventIsActive && splashData?.show_splash) {
                const isEventComplete = splashData.show_splash === 'event_completed';
                const splashKey = isEventComplete
                    ? 'event_completed'
                    : `${splashData.show_splash}-${splashData.splash_round_id}`;

                console.log('📊 Splash key:', splashKey, 'Already shown:', shownSplashes.has(splashKey));

                if (!shownSplashes.has(splashKey)) {
                    console.log('🎬 TRIGGERING SPLASH:', splashData.show_splash);
                    setSplash({
                        type: splashData.show_splash,
                        roundId: splashData.splash_round_id,
                        roundName: splashData.splash_round_name || 'Round',
                        roundOrder: splashData.splash_round_order || 0
                    });
                    setShownSplashes(prev => new Set([...prev, splashKey]));
                }
            } else if (!eventIsActive) {
                setSplash(null);
            } else if (!splashData?.show_splash) {
                // ⭐ Splash was cleared in DB (e.g. admin started next round)
                // Hide any local splash so audience shows normal scoreboard
                setSplash(null);
            }
        } catch (error) {
            console.error('Error loading scoreboard:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 2000);
        return () => clearInterval(interval);
    }, [eventId]);

    useEffect(() => {
        if (splash) {
            if (splashTimerRef.current) clearTimeout(splashTimerRef.current);

            // ⭐ "next_round" splash persists until admin starts the next round
            // (backend clears it via clearSplash when nextRound() is called)
            if (splash.type === 'next_round') {
                return () => {
                    if (splashTimerRef.current) clearTimeout(splashTimerRef.current);
                };
            }

            // Other splashes (round_completed, event_completed) auto-hide
            const duration = 2000;
            console.log(`⏱️ Splash will hide in ${duration}ms`);
            splashTimerRef.current = setTimeout(async () => {
                setSplash(null);
                // ⭐ Clear from DB so it doesn't re-show on next poll
                try {
                    await ScoringControlService.clearSplash(eventId);
                    console.log('✅ Splash cleared from DB');
                } catch (err) {
                    console.warn('Could not clear splash from DB:', err);
                }
            }, duration);
        }
        return () => {
            if (splashTimerRef.current) clearTimeout(splashTimerRef.current);
        };
    }, [splash, eventId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-quiz-primary flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-quiz-gold mx-auto mb-4"></div>
                    <p className="text-quiz-text text-xl tracking-widest">LOADING</p>
                </div>
            </div>
        );
    }

    if (rankings.length === 0) {
        return (
            <div className="min-h-screen bg-quiz-primary flex items-center justify-center">
                <div className="text-center">
                    <Trophy size={80} className="text-quiz-muted mx-auto mb-4 opacity-50" />
                    <p className="text-3xl font-black text-quiz-muted mb-2">NO TEAMS YET</p>
                    <p className="text-quiz-muted opacity-70">Waiting for the event to begin</p>
                </div>
            </div>
        );
    }

    const topThree = rankings.slice(0, 3);
    const rest = rankings.slice(3);
    const isBuzzerRound = currentRoundType === 'buzzer';
    const currentQ = Math.min(
        (eventState?.current_question_index || 0) + 1,
        eventState?.total_questions || 0
    );
    const totalQ = eventState?.total_questions || 0;

    const podiumOrder = [
        { team: topThree[0], position: 1 },
        { team: topThree[1], position: 2 },
        { team: topThree[2], position: 3 }
    ].filter(p => p.team);

    const splashBg = splash?.type === 'event_completed'
        ? 'bg-gradient-to-br from-yellow-500 via-quiz-gold to-purple-700'
        : splash?.type === 'round_completed'
            ? 'bg-gradient-to-br from-green-600 via-green-700 to-emerald-800'
            : 'bg-gradient-to-br from-quiz-gold via-red-500 to-orange-600';

    return (
        <div className="min-h-screen bg-quiz-primary text-quiz-text flex flex-col overflow-hidden relative">

            {/* ⭐ SPLASH SCREEN */}
            {splash && (
                <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 ${splashBg}`}
                    style={{ animation: 'splashFadeIn 0.5s ease-out' }}
                >
                    <div className="text-center animate-scale-in">
                        {splash.type === 'event_completed' ? (
                            <>
                                <div className="flex justify-center mb-6">
                                    <div className="w-40 h-40 rounded-full bg-white/20 backdrop-blur-sm border-4 border-white/40 flex items-center justify-center">
                                        <Trophy size={100} className="text-white" />
                                    </div>
                                </div>
                                <h1 className="text-7xl md:text-9xl lg:text-[12rem] font-black text-white mb-4 tracking-tight drop-shadow-2xl leading-none">
                                    EVENT
                                </h1>
                                <p className="text-5xl md:text-7xl lg:text-8xl font-black text-white/95 mb-6 drop-shadow-xl">
                                    COMPLETE!
                                </p>
                                <div className="inline-block px-8 py-4 bg-white/20 backdrop-blur rounded-2xl border-2 border-white/40">
                                    <p className="text-2xl md:text-4xl font-bold text-white">
                                        🏆 Congratulations to all teams!
                                    </p>
                                </div>
                            </>
                        ) : splash.type === 'round_completed' ? (
                            <>
                                <div className="flex justify-center mb-6">
                                    <div className="w-32 h-32 rounded-full bg-white/20 backdrop-blur-sm border-4 border-white/40 flex items-center justify-center">
                                        <PartyPopper size={80} className="text-white" />
                                    </div>
                                </div>
                                <h1 className="text-6xl md:text-8xl lg:text-9xl font-black text-white mb-4 tracking-tight drop-shadow-2xl">
                                    ROUND {splash.roundOrder}
                                </h1>
                                <p className="text-4xl md:text-6xl lg:text-7xl font-black text-white/95 mb-6 drop-shadow-xl">
                                    COMPLETED
                                </p>
                                <div className="inline-block px-8 py-4 bg-white/20 backdrop-blur rounded-2xl border-2 border-white/40">
                                    <p className="text-2xl md:text-4xl font-bold text-white">
                                        {splash.roundName}
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex justify-center mb-6">
                                    <div className="w-32 h-32 rounded-full bg-white/20 backdrop-blur-sm border-4 border-white/40 flex items-center justify-center">
                                        <Rocket size={80} className="text-white" />
                                    </div>
                                </div>
                                <p className="text-3xl md:text-5xl font-bold text-white/90 mb-3 tracking-widest">
                                    NEXT ROUND
                                </p>
                                <h1 className="text-7xl md:text-9xl lg:text-[12rem] font-black text-white mb-4 tracking-tight drop-shadow-2xl leading-none">
                                    R{splash.roundOrder}
                                </h1>
                                <div className="inline-block px-10 py-5 bg-white/20 backdrop-blur rounded-2xl border-2 border-white/40">
                                    <p className="text-3xl md:text-5xl font-black text-white">
                                        {splash.roundName}
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="absolute top-10 left-10 w-4 h-4 rounded-full bg-white/40 animate-ping"></div>
                    <div className="absolute top-20 right-20 w-6 h-6 rounded-full bg-white/30 animate-ping" style={{ animationDelay: '0.3s' }}></div>
                    <div className="absolute bottom-20 left-32 w-5 h-5 rounded-full bg-white/35 animate-ping" style={{ animationDelay: '0.6s' }}></div>
                </div>
            )}

            <header className="flex-shrink-0 px-4 md:px-6 py-3 border-b border-quiz-border bg-quiz-secondary/50 backdrop-blur">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3 md:gap-4 min-w-0">
                        {eventState?.is_started === true && eventState?.is_paused !== true && (
                            <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/20 border border-red-500">
                                <span className="text-xs font-bold text-red-400 tracking-widest">● LIVE</span>
                            </div>
                        )}
                        {eventState?.is_paused === true && (
                            <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-600/20 border border-yellow-500">
                                <span className="text-xs font-bold text-yellow-400 tracking-widest">⏸ PAUSED</span>
                            </div>
                        )}
                        <h1 className="text-xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-quiz-gold to-red-400 truncate">
                            {eventState?.name || 'Ex-Quiz-It'}
                        </h1>
                    </div>

                    <div className="flex items-center gap-4 md:gap-6 flex-shrink-0">
                        <div className="text-right">
                            <p className="text-[10px] uppercase tracking-widest text-quiz-muted font-bold">Round</p>
                            <div className="flex items-center gap-2 justify-end">
                                {currentRoundNumber !== null && (
                                    <span className={`text-xs md:text-sm font-black px-2 py-0.5 rounded ${isBuzzerRound
                                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                        }`}>
                                        R{currentRoundNumber}
                                    </span>
                                )}
                                {isBuzzerRound && <span className="text-base md:text-lg">🔔</span>}
                                <p className={`text-sm md:text-base font-black ${isBuzzerRound ? 'text-purple-400' : 'text-quiz-text'}`}>
                                    {eventState?.current_round_name || '—'}
                                </p>
                            </div>
                        </div>
                        <div className="w-px h-8 bg-quiz-border"></div>
                        <div className="text-right">
                            <p className="text-[10px] uppercase tracking-widest text-quiz-muted font-bold">Question</p>
                            <p className="text-lg md:text-xl font-black text-quiz-gold">
                                {currentQ}
                                <span className="text-quiz-muted text-sm">/{totalQ}</span>
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-hidden grid grid-rows-[auto_1fr] gap-2 md:gap-3 p-2 md:p-3">
                {topThree.length > 0 && (
                    <div className="flex-shrink-0">
                        <div className="flex items-center gap-2 mb-2 px-1">
                            <Crown size={16} className="text-yellow-400" />
                            <h2 className="text-xs md:text-sm font-black uppercase tracking-widest text-quiz-muted">
                                Top Performers
                            </h2>
                            <div className="flex-1 h-px bg-gradient-to-r from-quiz-border to-transparent"></div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 md:gap-3">
                            {podiumOrder.map(({ team, position }) => {
                                const isCurrent = currentTeam?.id === team.id;
                                const change = rankChanges[team.id];

                                const config = {
                                    1: { gradient: 'from-yellow-500 to-yellow-700', border: 'border-yellow-400', glow: 'shadow-yellow-500/50', medal: '🥇', icon: <Trophy size={28} className="text-yellow-200 drop-shadow-lg" />, bgTint: 'bg-gradient-to-br from-yellow-500/20 to-transparent' },
                                    2: { gradient: 'from-gray-400 to-gray-600', border: 'border-gray-400', glow: 'shadow-gray-400/40', medal: '🥈', icon: <Medal size={24} className="text-gray-100 drop-shadow-lg" />, bgTint: 'bg-gradient-to-br from-gray-400/20 to-transparent' },
                                    3: { gradient: 'from-orange-500 to-orange-700', border: 'border-orange-400', glow: 'shadow-orange-500/40', medal: '🥉', icon: <Award size={24} className="text-orange-100 drop-shadow-lg" />, bgTint: 'bg-gradient-to-br from-orange-500/20 to-transparent' }
                                }[position];

                                return (
                                    <div key={team.id}
                                        className={`relative rounded-2xl border-2 ${config.border} ${config.bgTint} backdrop-blur overflow-hidden transition-all ${config.glow} shadow-2xl ${isCurrent ? 'ring-4 ring-quiz-gold' : ''}`}>
                                        <div className="absolute top-2 right-2">
                                            <span className="text-2xl md:text-3xl">{config.medal}</span>
                                        </div>

                                        {isCurrent && (
                                            <div className="absolute -top-0 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-quiz-gold text-white text-[9px] font-black uppercase tracking-widest rounded-b-md shadow-lg z-10">
                                                {isBuzzerRound ? '🔔 Buzzing' : '🎤 Answering'}
                                            </div>
                                        )}

                                        {change && (
                                            <div className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center shadow-lg z-10 ${change === 'up' ? 'bg-green-500' : 'bg-red-500'
                                                }`}>
                                                {change === 'up' ? <ArrowUp size={14} className="text-white" /> : <ArrowDown size={14} className="text-white" />}
                                            </div>
                                        )}

                                        <div className="p-3 md:p-4 pt-4 md:pt-6">
                                            <div className={`inline-flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br ${config.gradient} text-white font-black text-xl md:text-2xl shadow-lg mb-2`}>
                                                {team.rank}
                                            </div>
                                            <div className="mb-2">{config.icon}</div>
                                            <h3 className="text-base md:text-2xl font-black text-quiz-text truncate leading-tight mb-0.5">
                                                {team.name}
                                            </h3>
                                            <p className="text-[10px] md:text-xs text-quiz-muted truncate mb-2">
                                                {team.short_name}{team.institution && ` • ${team.institution}`}
                                            </p>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-3xl md:text-5xl font-black text-quiz-gold leading-none">{team.total_score}</span>
                                                <span className="text-[10px] uppercase tracking-widest text-quiz-muted font-bold">pts</span>
                                            </div>

                                            <div className="grid grid-cols-5 gap-1 mt-3 pt-3 border-t border-quiz-border/50">
                                                <MiniCount label="T" value={team.total_answers || 0} color="text-quiz-text" />
                                                <MiniCount label="✓" value={team.correct_count || 0} color="text-green-500" />
                                                <MiniCount label="✗" value={team.wrong_count || 0} color="text-red-500" />
                                                <MiniCount label="P" value={team.pass_count || 0} color="text-quiz-muted" />
                                                <MiniCount label="⚖" value={team.penalty_count || 0} color="text-red-700" />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {rest.length > 0 && (
                    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                        <div className="flex items-center gap-2 mb-2 px-1">
                            <Users size={16} className="text-quiz-muted" />
                            <h2 className="text-xs md:text-sm font-black uppercase tracking-widest text-quiz-muted">All Teams</h2>
                            <div className="flex-1 h-px bg-gradient-to-r from-quiz-border to-transparent"></div>
                            <span className="text-xs text-quiz-muted font-semibold">{rest.length} teams</span>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            <div className={`grid gap-2 ${rest.length <= 3 ? 'grid-cols-1 md:grid-cols-3' :
                                rest.length <= 6 ? 'grid-cols-2 md:grid-cols-3' :
                                    rest.length <= 9 ? 'grid-cols-2 md:grid-cols-3' :
                                        'grid-cols-2 md:grid-cols-4'
                                }`}>
                                {rest.map((team) => {
                                    const isCurrent = currentTeam?.id === team.id;
                                    const change = rankChanges[team.id];

                                    return (
                                        <div key={team.id}
                                            className={`relative flex items-center gap-3 p-2.5 md:p-3 rounded-xl bg-quiz-secondary border-2 ${isCurrent ? 'border-quiz-gold ring-2 ring-quiz-gold/50' : 'border-quiz-border'
                                                } transition-all`}>
                                            {isCurrent && (
                                                <div className="absolute -top-2 left-2 px-2 py-0.5 bg-quiz-gold text-white text-[8px] font-black uppercase tracking-widest rounded shadow-md z-10">
                                                    {isBuzzerRound ? '🔔 Buzzing' : '🎤 Answering'}
                                                </div>
                                            )}

                                            {change && (
                                                <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center shadow-lg ${change === 'up' ? 'bg-green-500' : 'bg-red-500'
                                                    }`}>
                                                    {change === 'up' ? <ArrowUp size={12} className="text-white" /> : <ArrowDown size={12} className="text-white" />}
                                                </div>
                                            )}

                                            <div className="flex-shrink-0 w-11 h-11 md:w-12 md:h-12 rounded-xl bg-quiz-accent border border-quiz-border flex items-center justify-center font-black text-lg md:text-xl text-quiz-text">
                                                {team.rank}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-black text-sm md:text-base text-quiz-text truncate">{team.name}</h3>
                                                <p className="text-[10px] md:text-xs text-quiz-muted truncate">
                                                    {team.short_name}{team.institution && ` • ${team.institution}`}
                                                </p>
                                                <div className="flex gap-2 mt-1 text-[10px] text-quiz-muted">
                                                    <span>T: <span className="text-quiz-text font-bold">{team.total_answers || 0}</span></span>
                                                    <span>✓: <span className="text-green-500 font-bold">{team.correct_count || 0}</span></span>
                                                    <span>✗: <span className="text-red-500 font-bold">{team.wrong_count || 0}</span></span>
                                                    <span>P: <span className="text-quiz-text font-bold">{team.pass_count || 0}</span></span>
                                                    <span>⚖: <span className="text-red-700 font-bold">{team.penalty_count || 0}</span></span>
                                                </div>
                                            </div>

                                            <div className="text-right flex-shrink-0">
                                                <div className="text-2xl md:text-3xl font-black text-quiz-gold leading-none">{team.total_score}</div>
                                                <div className="text-[8px] uppercase tracking-widest text-quiz-muted mt-0.5">pts</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </main>

            <style>{`
                @keyframes splashFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.7); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-scale-in {
                    animation: scaleIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
            `}</style>
        </div>
    );
}

function MiniCount({ label, value, color }) {
    return (
        <div className="text-center">
            <p className="text-[9px] uppercase text-quiz-muted font-bold leading-tight">{label}</p>
            <p className={`text-xs md:text-sm font-black ${color} leading-tight`}>{value}</p>
        </div>
    );
}

export default AudienceScoreboard;