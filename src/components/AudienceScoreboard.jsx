import React, { useState, useEffect, useRef } from 'react';
import { RankingService, EventService, ScoringControlService } from '../services/api';
import { Trophy, Medal, Award, ArrowUp, ArrowDown, Minus, Users } from 'lucide-react';

function AudienceScoreboard({ eventId = 1 }) {
    const [rankings, setRankings] = useState([]);
    const [eventState, setEventState] = useState(null);
    const [currentTeam, setCurrentTeam] = useState(null);
    const [loading, setLoading] = useState(true);

    // Track rank changes: { teamId: 'up' | 'down' | 'same' }
    const previousRanksRef = useRef({});
    const [rankChanges, setRankChanges] = useState({});

    // ============ LOAD DATA ============
    const loadData = async () => {
        try {
            const [rankingsRes, stateRes, controlRes] = await Promise.all([
                RankingService.getRankings(eventId),
                EventService.getState(eventId),
                ScoringControlService.getCurrentTeam(eventId)
            ]);

            const newRankings = rankingsRes.data;
            const prevRanks = previousRanksRef.current;

            // Calculate rank changes
            const changes = {};
            newRankings.forEach(team => {
                const prevRank = prevRanks[team.id];
                if (prevRank === undefined) {
                    changes[team.id] = 'new';
                } else if (team.rank < prevRank) {
                    changes[team.id] = 'up';      // moved up (smaller number)
                } else if (team.rank > prevRank) {
                    changes[team.id] = 'down';    // moved down
                } else {
                    changes[team.id] = 'same';
                }
            });

            // Update refs and state
            previousRanksRef.current = {};
            newRankings.forEach(t => { previousRanksRef.current[t.id] = t.rank; });

            setRankings(newRankings);
            setEventState(stateRes.data);
            setCurrentTeam(controlRes.data.team);

            // Flash change indicators briefly
            const visibleChanges = {};
            Object.keys(changes).forEach(id => {
                if (changes[id] === 'up' || changes[id] === 'down') {
                    visibleChanges[id] = changes[id];
                }
            });
            setRankChanges(visibleChanges);
            setTimeout(() => setRankChanges({}), 2500);

        } catch (error) {
            console.error('Error loading scoreboard:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 4000); // refresh every 4s
        return () => clearInterval(interval);
    }, [eventId]);

    // ============ RANK STYLE ============
    const getRankStyle = (rank) => {
        if (rank === 1) return {
            rankBg: 'bg-gradient-to-br from-yellow-400 to-yellow-600',
            rankText: 'text-yellow-950',
            border: 'border-yellow-400',
            bg: 'bg-gradient-to-r from-yellow-500/15 to-transparent',
            scoreColor: 'text-yellow-400',
            icon: <Trophy size={28} className="text-yellow-400" />
        };
        if (rank === 2) return {
            rankBg: 'bg-gradient-to-br from-gray-300 to-gray-500',
            rankText: 'text-gray-900',
            border: 'border-gray-400',
            bg: 'bg-gradient-to-r from-gray-400/15 to-transparent',
            scoreColor: 'text-gray-300',
            icon: <Medal size={28} className="text-gray-300" />
        };
        if (rank === 3) return {
            rankBg: 'bg-gradient-to-br from-orange-400 to-orange-700',
            rankText: 'text-orange-950',
            border: 'border-orange-500',
            bg: 'bg-gradient-to-r from-orange-500/15 to-transparent',
            scoreColor: 'text-orange-400',
            icon: <Award size={28} className="text-orange-400" />
        };
        return {
            rankBg: 'bg-quiz-accent',
            rankText: 'text-quiz-text',
            border: 'border-quiz-border',
            bg: 'bg-quiz-secondary',
            scoreColor: 'text-quiz-text',
            icon: null
        };
    };

    // ============ LOADING ============
    if (loading) {
        return (
            <div className="min-h-screen bg-quiz-primary flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-quiz-gold mx-auto mb-4"></div>
                    <p className="text-quiz-text text-xl font-light tracking-widest">
                        LOADING
                    </p>
                </div>
            </div>
        );
    }

    // ============ EMPTY STATE ============
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

    // ============ DYNAMIC SIZING ============
    // Adjust layout based on team count so all fit on one screen
    const teamCount = rankings.length;
    const isCompact = teamCount > 6;
    const isVeryCompact = teamCount > 9;

    return (
        <div className="min-h-screen bg-quiz-primary text-quiz-text flex flex-col">
            {/* ============ HEADER ============ */}
            <header className="flex-shrink-0 px-6 py-4 border-b border-quiz-border bg-quiz-secondary/50 backdrop-blur">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    {/* Left: Event Name */}
                    <div className="flex items-center gap-4">
                        {eventState?.is_started && (
                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/20 border border-red-500">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                <span className="text-xs font-bold text-red-400 tracking-widest">
                                    LIVE
                                </span>
                            </div>
                        )}
                        <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-quiz-gold to-red-400">
                            {eventState?.name || 'Ex-Quiz-It'}
                        </h1>
                    </div>

                    {/* Right: Round + Question */}
                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <p className="text-[10px] uppercase tracking-widest text-quiz-muted font-bold">
                                Round
                            </p>
                            <p className="text-lg font-black text-quiz-text">
                                {eventState?.current_round_name || '—'}
                            </p>
                        </div>
                        <div className="w-px h-10 bg-quiz-border"></div>
                        <div className="text-right">
                            <p className="text-[10px] uppercase tracking-widest text-quiz-muted font-bold">
                                Question
                            </p>
                            <p className="text-2xl font-black text-quiz-gold">
                                {eventState?.current_question_index || 0}
                                <span className="text-quiz-muted text-base">
                                    /{eventState?.total_questions || 0}
                                </span>
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            {/* ============ TEAMS LIST ============ */}
            <main className="flex-1 overflow-hidden px-4 py-3">
                <div className={`h-full grid gap-2 ${isVeryCompact
                        ? 'grid-cols-2 md:grid-cols-3'
                        : isCompact
                            ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                            : 'grid-cols-1 md:grid-cols-2'
                    }`}>
                    {rankings.map((team) => {
                        const style = getRankStyle(team.rank);
                        const isCurrent = currentTeam?.id === team.id;
                        const change = rankChanges[team.id];

                        return (
                            <div
                                key={team.id}
                                className={`relative flex items-center gap-3 p-3 rounded-xl border-2 ${style.border} ${style.bg} transition-all ${isCurrent ? 'ring-4 ring-quiz-gold shadow-2xl scale-[1.02]' : ''
                                    }`}
                            >
                                {/* Current Answering Indicator */}
                                {isCurrent && (
                                    <div className="absolute -top-2 left-3 px-2 py-0.5 bg-quiz-gold text-white text-[9px] font-black uppercase tracking-widest rounded">
                                        Answering
                                    </div>
                                )}

                                {/* Rank Badge */}
                                <div className={`flex-shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-xl ${style.rankBg} ${style.rankText} flex items-center justify-center font-black text-xl md:text-2xl shadow-lg`}>
                                    {team.rank}
                                </div>

                                {/* Team Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className={`font-black truncate ${isVeryCompact ? 'text-sm' : isCompact ? 'text-base' : 'text-xl md:text-2xl'
                                            } text-quiz-text`}>
                                            {team.name}
                                        </h3>
                                        {style.icon && (
                                            <div className="flex-shrink-0">
                                                {style.icon}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] uppercase tracking-wider font-bold text-quiz-muted">
                                            {team.short_name}
                                        </span>
                                        {team.institution && !isCompact && (
                                            <>
                                                <span className="text-quiz-muted text-xs">•</span>
                                                <span className="text-xs text-quiz-muted truncate">
                                                    {team.institution}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Score */}
                                <div className="flex-shrink-0 text-right">
                                    <div className={`font-black leading-none ${isVeryCompact ? 'text-xl' : isCompact ? 'text-2xl md:text-3xl' : 'text-3xl md:text-5xl'
                                        } ${style.scoreColor}`}>
                                        {team.total_score}
                                    </div>
                                    {!isCompact && (
                                        <div className="text-[9px] uppercase tracking-widest text-quiz-muted mt-1 font-bold">
                                            POINTS
                                        </div>
                                    )}
                                </div>

                                {/* Rank Change Arrow */}
                                {change && (
                                    <div className={`absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-lg ${change === 'up' ? 'bg-green-500 animate-bounce' :
                                            change === 'down' ? 'bg-red-500 animate-bounce' :
                                                'bg-gray-500'
                                        }`}>
                                        {change === 'up' && <ArrowUp size={16} className="text-white" />}
                                        {change === 'down' && <ArrowDown size={16} className="text-white" />}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </main>

            {/* ============ FOOTER ============ */}
            <footer className="flex-shrink-0 px-6 py-2 border-t border-quiz-border bg-quiz-secondary/50">
                <div className="flex items-center justify-between text-xs text-quiz-muted">
                    <div className="flex items-center gap-2">
                        <Users size={14} />
                        <span>{rankings.length} teams competing</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                            <ArrowUp size={12} className="text-green-500" />
                            <span>rank up</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <ArrowDown size={12} className="text-red-500" />
                            <span>rank down</span>
                        </div>
                    </div>
                    <div className="uppercase tracking-widest font-bold">
                        Ex-Quiz-It
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default AudienceScoreboard;