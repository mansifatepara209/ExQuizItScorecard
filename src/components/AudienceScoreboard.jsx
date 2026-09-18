import BrandHeader from './BrandHeader';
import React, { useState, useEffect, useRef } from 'react';
import { RankingService, EventService, ScoringControlService } from '../services/api';
import { Trophy, Medal, Award, ArrowUp, ArrowDown, Users, Crown, Maximize2, Minimize2 } from 'lucide-react';

function AudienceScoreboard({ eventId = 1 }) {
    const [rankings, setRankings] = useState([]);
    const [eventState, setEventState] = useState(null);
    const [currentTeam, setCurrentTeam] = useState(null);
    const [currentRoundType, setCurrentRoundType] = useState(null);
    const [currentRoundNumber, setCurrentRoundNumber] = useState(null);
    const [loading, setLoading] = useState(true);
    const [rankChanges, setRankChanges] = useState({});

    const [zoom, setZoom] = useState(() => {
        return Number(localStorage.getItem('audienceZoom')) || 1;
    });

    const previousRanksRef = useRef({});

    useEffect(() => {
        localStorage.setItem('audienceZoom', String(zoom));
    }, [zoom]);

    const loadData = async () => {
        try {
            const [rankingsRes, stateRes, controlRes] = await Promise.all([
                RankingService.getRankings(eventId),
                EventService.getState(eventId),
                ScoringControlService.getCurrentTeam(eventId)
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

    if (loading) {
        return (
            <div className="min-h-screen bg-quiz-primary flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-quiz-gold mx-auto mb-6"></div>
                    <p className="text-quiz-text text-3xl font-black tracking-widest">LOADING</p>
                </div>
            </div>
        );
    }

    if (rankings.length === 0) {
        return (
            <div className="min-h-screen flex flex-col relative overflow-hidden">
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: 'url(/brand/eqi_poster_26.webp)' }}
                />
                <div className="absolute inset-0 bg-white/55" />
                <div className="relative z-10 flex flex-col flex-1">
                    <BrandHeader subtitle="Live Scoreboard" />
                    <div className="flex-1 flex items-center justify-center">
                        <div className="bg-white rounded-3xl shadow-2xl px-16 py-12 text-center border-4 border-quiz-border">
                            <Trophy size={120} className="text-quiz-gold mx-auto mb-6" />
                            <p className="text-6xl font-black text-quiz-text mb-4">NO TEAMS YET</p>
                            <p className="text-2xl text-quiz-muted font-bold">Waiting for the event to begin</p>
                        </div>
                    </div>
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

    // ⭐ BIG FONTS, compact layout
    const S = {
        1: {
            // Header
            statusBadge: 'text-base md:text-lg px-5 py-2',
            infoLabel: 'text-xs md:text-sm',
            infoValue: 'text-xl md:text-2xl',
            questionNum: 'text-3xl md:text-4xl',
            // Section headers
            sectionHead: 'text-lg md:text-2xl',
            // Podium
            podiumRank: 'text-3xl md:text-4xl',
            podiumName: 'text-2xl md:text-4xl',
            podiumMeta: 'text-base md:text-lg',
            podiumScore: 'text-5xl md:text-7xl',
            podiumPts: 'text-sm md:text-base',
            miniStat: 'text-xl md:text-2xl',
            miniLabel: 'text-xs md:text-sm',
            // All Teams
            listRank: 'text-2xl md:text-3xl',
            listName: 'text-xl md:text-2xl',
            listMeta: 'text-sm md:text-base',
            listStats: 'text-sm md:text-base',
            listScore: 'text-4xl md:text-5xl',
            listPts: 'text-xs md:text-sm',
        },
        2: {
            statusBadge: 'text-lg md:text-xl px-6 py-2.5',
            infoLabel: 'text-sm md:text-base',
            infoValue: 'text-2xl md:text-3xl',
            questionNum: 'text-4xl md:text-5xl',
            sectionHead: 'text-xl md:text-3xl',
            podiumRank: 'text-4xl md:text-5xl',
            podiumName: 'text-3xl md:text-5xl',
            podiumMeta: 'text-lg md:text-2xl',
            podiumScore: 'text-6xl md:text-8xl',
            podiumPts: 'text-base md:text-lg',
            miniStat: 'text-2xl md:text-3xl',
            miniLabel: 'text-sm md:text-base',
            listRank: 'text-3xl md:text-4xl',
            listName: 'text-2xl md:text-3xl',
            listMeta: 'text-base md:text-xl',
            listStats: 'text-base md:text-lg',
            listScore: 'text-5xl md:text-6xl',
            listPts: 'text-sm md:text-base',
        },
    }[zoom];

    return (
        <div className="min-h-screen text-quiz-text flex flex-col overflow-hidden relative">

            {/* Poster background */}
            <div
                className="fixed inset-0 bg-cover bg-center"
                style={{ backgroundImage: 'url(/brand/eqi_poster_26.webp)' }}
                aria-hidden="true"
            />
            <div className="fixed inset-0 bg-white/55" aria-hidden="true" />

            {/* Foreground */}
            <div className="relative z-10 flex flex-col flex-1">

                {/* Zoom toggle */}
                <button
                    onClick={() => setZoom(z => (z === 1 ? 2 : 1))}
                    className="fixed top-4 right-4 z-50 px-4 py-2 rounded-lg bg-[#C2185B] text-white font-bold shadow-xl hover:bg-[#8B1538] transition flex items-center gap-2"
                    title={zoom === 1 ? 'Enlarge for projector' : 'Back to normal size'}
                >
                    {zoom === 1 ? <Maximize2 size={20} /> : <Minimize2 size={20} />}
                    <span className="text-sm md:text-base">{zoom === 1 ? 'ENLARGE' : 'NORMAL'}</span>
                </button>

                {/* Branded Header */}
                <header className="flex-shrink-0 bg-white shadow-md border-b-4 border-quiz-gold">
                    <div className="px-4 md:px-8 py-4 md:py-5 flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-4 md:gap-6 min-w-0">
                            <img
                                src="/brand/EX-QUIZ-IT.svg"
                                alt="Ex-Quiz-It"
                                className="h-16 md:h-24 w-auto object-contain flex-shrink-0"
                                onError={(e) => { e.target.src = '/brand/EX-QUIZ-IT.png'; }}
                            />
                            {eventState?.is_started === true && eventState?.is_paused !== true && (
                                <div className={`flex-shrink-0 flex items-center gap-2 rounded-full bg-red-600 border-2 border-red-700 shadow-lg ${S.statusBadge}`}>
                                    <span className="w-3 h-3 rounded-full bg-white animate-pulse"></span>
                                    <span className="font-black text-white tracking-widest">LIVE</span>
                                </div>
                            )}
                            {eventState?.is_paused === true && (
                                <div className={`flex-shrink-0 flex items-center gap-2 rounded-full bg-yellow-500 border-2 border-yellow-600 shadow-lg ${S.statusBadge}`}>
                                    <span className="font-black text-yellow-950 tracking-widest">⏸ PAUSED</span>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-4 md:gap-8 flex-shrink-0">
                            <div className="text-right">
                                <p className={`${S.infoLabel} uppercase tracking-widest text-quiz-muted font-black`}>Round</p>
                                <div className="flex items-center gap-2 justify-end mt-1">
                                    {currentRoundNumber !== null && (
                                        <span className={`${S.infoValue} font-black px-3 py-1 rounded ${isBuzzerRound
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-[#C2185B] text-white'
                                            }`}>
                                            R{currentRoundNumber}
                                        </span>
                                    )}
                                    {isBuzzerRound && <span className="text-3xl">🔔</span>}
                                    <p className={`${S.infoValue} font-black text-quiz-text`}>
                                        {eventState?.current_round_name || '—'}
                                    </p>
                                </div>
                            </div>
                            <div className="w-px h-16 bg-quiz-border"></div>
                            <div className="text-right">
                                <p className={`${S.infoLabel} uppercase tracking-widest text-quiz-muted font-black`}>Question</p>
                                <p className={`${S.questionNum} font-black text-[#C2185B] leading-none`}>
                                    {currentQ}
                                    <span className="text-quiz-muted text-xl">/{totalQ}</span>
                                </p>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-hidden grid grid-rows-[auto_1fr] gap-2 md:gap-3 p-2 md:p-3">

                    {/* ⭐ TOP PERFORMERS */}
                    {topThree.length > 0 && (
                        <div className="flex-shrink-0">
                            <div className="flex items-center gap-3 mb-2 px-1">
                                <Crown size={zoom === 1 ? 28 : 36} className="text-quiz-orange" />
                                <h2 className={`${S.sectionHead} font-black uppercase tracking-widest text-white drop-shadow-md`}>
                                    Top Performers
                                </h2>
                                <div className="flex-1 h-1 bg-white/50"></div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 md:gap-3">
                                {podiumOrder.map(({ team, position }) => {
                                    const isCurrent = currentTeam?.id === team.id;
                                    const change = rankChanges[team.id];

                                    const config = {
                                        1: { bg: 'bg-white', border: 'border-yellow-500', shadow: 'shadow-yellow-500/50', medal: '🥇', gradient: 'from-yellow-500 to-yellow-700', icon: <Trophy size={zoom === 1 ? 40 : 52} className="text-yellow-600" /> },
                                        2: { bg: 'bg-white', border: 'border-gray-400', shadow: 'shadow-gray-400/50', medal: '🥈', gradient: 'from-gray-400 to-gray-600', icon: <Medal size={zoom === 1 ? 36 : 48} className="text-gray-600" /> },
                                        3: { bg: 'bg-white', border: 'border-orange-500', shadow: 'shadow-orange-500/50', medal: '🥉', gradient: 'from-orange-500 to-orange-700', icon: <Award size={zoom === 1 ? 36 : 48} className="text-orange-600" /> }
                                    }[position];

                                    return (
                                        <div key={team.id}
                                            className={`relative rounded-xl border-4 ${config.border} ${config.bg} overflow-hidden transition-all ${config.shadow} shadow-xl ${isCurrent ? 'ring-4 ring-[#C2185B]' : ''}`}>
                                            <div className="absolute top-2 right-2">
                                                <span className={`${zoom === 1 ? 'text-4xl md:text-5xl' : 'text-5xl md:text-6xl'} drop-shadow`}>{config.medal}</span>
                                            </div>

                                            {isCurrent && (
                                                <div className={`absolute top-0 left-1/2 -translate-x-1/2 bg-[#C2185B] text-white font-black uppercase tracking-widest rounded-b-md shadow-lg z-10 ${zoom === 1 ? 'px-4 py-0.5 text-sm' : 'px-5 py-1 text-base'}`}>
                                                    {isBuzzerRound ? '🔔 Buzzing' : '🎤 Answering'}
                                                </div>
                                            )}

                                            {change && (
                                                <div className={`absolute top-2 left-2 rounded-full flex items-center justify-center shadow-lg z-10 ${change === 'up' ? 'bg-green-500' : 'bg-red-500'} ${zoom === 1 ? 'w-8 h-8 md:w-10 md:h-10' : 'w-12 h-12'}`}>
                                                    {change === 'up' ? <ArrowUp size={zoom === 1 ? 18 : 24} className="text-white" /> : <ArrowDown size={zoom === 1 ? 18 : 24} className="text-white" />}
                                                </div>
                                            )}

                                            <div className={`${zoom === 1 ? 'p-3 md:p-4' : 'p-5 md:p-6'}`}>
                                                {/* Rank badge + icon inline */}
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className={`inline-flex items-center justify-center rounded-xl bg-gradient-to-br ${config.gradient} text-white font-black shadow-lg ${S.podiumRank} ${zoom === 1 ? 'w-12 h-12 md:w-14 md:h-14' : 'w-16 h-16 md:w-20 md:h-20'}`}>
                                                        {team.rank}
                                                    </div>
                                                    {config.icon}
                                                </div>

                                                <h3 className={`${S.podiumName} font-black text-quiz-text truncate leading-tight`}>
                                                    {team.name}
                                                </h3>
                                                <p className={`${S.podiumMeta} font-bold text-quiz-muted truncate mt-0.5 mb-2`}>
                                                    {team.short_name}{team.institution && ` • ${team.institution}`}
                                                </p>
                                                <div className="flex items-baseline gap-2">
                                                    <span className={`${S.podiumScore} font-black text-[#C2185B] leading-none`}>{team.total_score}</span>
                                                    <span className={`${S.podiumPts} uppercase tracking-widest text-quiz-muted font-black`}>pts</span>
                                                </div>

                                                <div className="grid grid-cols-5 gap-2 mt-3 pt-3 border-t-2 border-quiz-border">
                                                    <MiniCount label="T" value={team.total_answers || 0} color="text-quiz-text" size={S.miniStat} labelSize={S.miniLabel} />
                                                    <MiniCount label="✓" value={team.correct_count || 0} color="text-green-600" size={S.miniStat} labelSize={S.miniLabel} />
                                                    <MiniCount label="✗" value={team.wrong_count || 0} color="text-red-600" size={S.miniStat} labelSize={S.miniLabel} />
                                                    <MiniCount label="P" value={team.pass_count || 0} color="text-quiz-muted" size={S.miniStat} labelSize={S.miniLabel} />
                                                    <MiniCount label="⚖" value={team.penalty_count || 0} color="text-red-800" size={S.miniStat} labelSize={S.miniLabel} />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ⭐ ALL TEAMS — COMPACT CARDS, BIG FONTS */}
                    {rest.length > 0 && (
                        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                            <div className="flex items-center gap-3 mb-2 px-1">
                                <Users size={zoom === 1 ? 28 : 36} className="text-white drop-shadow-md" />
                                <h2 className={`${S.sectionHead} font-black uppercase tracking-widest text-white drop-shadow-md`}>All Teams</h2>
                                <div className="flex-1 h-1 bg-white/50"></div>
                                <span className={`${S.sectionHead} text-white font-black drop-shadow-md`}>{rest.length} teams</span>
                            </div>

                            <div className="flex-1 overflow-y-auto">
                                <div className={`grid gap-2 md:gap-3 ${rest.length <= 6 ? 'grid-cols-1 md:grid-cols-2' :
                                        rest.length <= 12 ? 'grid-cols-1 md:grid-cols-2' :
                                            'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                                    }`}>
                                    {rest.map((team) => {
                                        const isCurrent = currentTeam?.id === team.id;
                                        const change = rankChanges[team.id];

                                        return (
                                            <div key={team.id}
                                                className={`relative flex items-center gap-3 p-2.5 md:p-3 rounded-lg bg-white border-2 ${isCurrent ? 'border-[#C2185B] ring-2 ring-[#C2185B]/40' : 'border-quiz-border'} transition-all shadow-md`}>
                                                {isCurrent && (
                                                    <div className={`absolute -top-2.5 left-3 bg-[#C2185B] text-white font-black uppercase tracking-widest rounded shadow-md z-10 ${zoom === 1 ? 'px-3 py-0.5 text-xs' : 'px-4 py-0.5 text-sm'}`}>
                                                        {isBuzzerRound ? '🔔 Buzzing' : '🎤 Answering'}
                                                    </div>
                                                )}

                                                {change && (
                                                    <div className={`absolute -top-2 -right-2 rounded-full flex items-center justify-center shadow-lg ${change === 'up' ? 'bg-green-500' : 'bg-red-500'} ${zoom === 1 ? 'w-7 h-7' : 'w-9 h-9'}`}>
                                                        {change === 'up' ? <ArrowUp size={zoom === 1 ? 16 : 20} className="text-white" /> : <ArrowDown size={zoom === 1 ? 16 : 20} className="text-white" />}
                                                    </div>
                                                )}

                                                {/* Rank badge — SMALLER */}
                                                <div className={`flex-shrink-0 rounded-lg bg-quiz-accent border-2 border-quiz-border flex items-center justify-center font-black text-quiz-text ${S.listRank} ${zoom === 1 ? 'w-12 h-12 md:w-14 md:h-14' : 'w-16 h-16 md:w-20 md:h-20'}`}>
                                                    {team.rank}
                                                </div>

                                                {/* Name + Meta + Stats */}
                                                <div className="flex-1 min-w-0">
                                                    <h3 className={`${S.listName} font-black text-quiz-text truncate leading-tight`}>
                                                        {team.name}
                                                    </h3>
                                                    <p className={`${S.listMeta} font-bold text-quiz-muted truncate mt-0.5`}>
                                                        {team.short_name}{team.institution && ` • ${team.institution}`}
                                                    </p>
                                                    <div className={`flex flex-wrap gap-2 md:gap-3 mt-1 ${S.listStats} font-black text-quiz-muted`}>
                                                        <span>T: <span className="text-quiz-text">{team.total_answers || 0}</span></span>
                                                        <span>✓: <span className="text-green-600">{team.correct_count || 0}</span></span>
                                                        <span>✗: <span className="text-red-600">{team.wrong_count || 0}</span></span>
                                                        <span>P: <span className="text-quiz-text">{team.pass_count || 0}</span></span>
                                                        <span>⚖: <span className="text-red-800">{team.penalty_count || 0}</span></span>
                                                    </div>
                                                </div>

                                                {/* Score */}
                                                <div className="text-right flex-shrink-0">
                                                    <div className={`${S.listScore} font-black text-[#C2185B] leading-none`}>{team.total_score}</div>
                                                    <div className={`${S.listPts} uppercase tracking-widest text-quiz-muted mt-0.5 font-black`}>pts</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

function MiniCount({ label, value, color, size, labelSize }) {
    return (
        <div className="text-center">
            <p className={`${labelSize} uppercase text-quiz-muted font-black leading-tight`}>{label}</p>
            <p className={`${size} font-black ${color} leading-tight`}>{value}</p>
        </div>
    );
}

export default AudienceScoreboard;