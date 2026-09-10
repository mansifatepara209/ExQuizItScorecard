import React, { useState, useEffect } from 'react';
import { RankingService, EventService } from '../services/api';
import { Trophy, Medal, Award, Activity, Clock } from 'lucide-react';

function AudienceScoreboard({ eventId = 1 }) {
    const [rankings, setRankings] = useState([]);
    const [eventState, setEventState] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [pulse, setPulse] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        loadData();
        const interval = setInterval(() => {
            loadData();
            setPulse(true);
            setTimeout(() => setPulse(false), 800);
        }, 5000);
        return () => clearInterval(interval);
    }, [eventId]);

    const loadData = async () => {
        try {
            const [rankingsRes, stateRes] = await Promise.all([
                RankingService.getRankings(eventId),
                EventService.getState(eventId)
            ]);
            setRankings(rankingsRes.data);
            setEventState(stateRes.data);
        } catch (error) {
            console.error('Error loading scoreboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const getRankStyle = (rank) => {
        if (rank === 1) return {
            border: 'border-yellow-400',
            bg: 'bg-gradient-to-r from-yellow-500/20 to-yellow-500/5',
            rankBg: 'bg-yellow-500 text-yellow-950',
            scoreColor: 'text-yellow-500',
            icon: <Trophy size={32} className="text-yellow-500" />
        };
        if (rank === 2) return {
            border: 'border-gray-400',
            bg: 'bg-gradient-to-r from-gray-500/20 to-gray-500/5',
            rankBg: 'bg-gray-400 text-gray-900',
            scoreColor: 'text-gray-400',
            icon: <Medal size={32} className="text-gray-400" />
        };
        if (rank === 3) return {
            border: 'border-orange-400',
            bg: 'bg-gradient-to-r from-orange-500/20 to-orange-500/5',
            rankBg: 'bg-orange-500 text-orange-950',
            scoreColor: 'text-orange-500',
            icon: <Award size={32} className="text-orange-500" />
        };
        return {
            border: 'border-quiz-border',
            bg: 'bg-quiz-secondary',
            rankBg: 'bg-quiz-accent text-quiz-text',
            scoreColor: 'text-quiz-text',
            icon: null
        };
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-quiz-primary flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-quiz-gold mx-auto mb-6"></div>
                    <p className="text-quiz-text text-2xl font-light tracking-widest">LOADING SCOREBOARD</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-quiz-primary text-quiz-text overflow-hidden relative">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-quiz-gold opacity-10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500 opacity-10 rounded-full blur-3xl"></div>
            </div>

            <div className="relative z-10 max-w-6xl mx-auto p-6 md:p-10">
                <header className="text-center mb-8 md:mb-12">
                    <div className="flex justify-center mb-6">
                        <div className={`flex items-center gap-3 px-6 py-2 rounded-full border-2 ${eventState?.is_started
                                ? 'bg-red-600/20 border-red-500 shadow-lg shadow-red-500/50'
                                : 'bg-quiz-accent border-quiz-border'
                            }`}>
                            <span className={`w-3 h-3 rounded-full ${eventState?.is_started ? 'bg-red-500 animate-pulse' : 'bg-quiz-muted'
                                }`}></span>
                            <span className={`text-sm font-bold tracking-widest ${eventState?.is_started ? 'text-red-400' : 'text-quiz-muted'
                                }`}>
                                {eventState?.is_started ? 'LIVE' : 'STANDBY'}
                            </span>
                        </div>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-quiz-gold via-red-400 to-quiz-gold mb-4 tracking-tight">
                        {eventState?.name || 'Ex-Quiz-It'}
                    </h1>

                    <div className="flex flex-wrap justify-center items-center gap-4 md:gap-8 text-lg md:text-2xl">
                        <div className="flex items-center gap-2">
                            <Activity className="text-quiz-gold" size={24} />
                            <span className="text-quiz-muted">Round:</span>
                            <span className="font-bold text-quiz-text">{eventState?.current_round_name || 'N/A'}</span>
                        </div>
                        <div className="hidden md:block w-px h-6 bg-quiz-border"></div>
                        <div className="flex items-center gap-2">
                            <span className="text-quiz-muted">Question:</span>
                            <span className="font-bold text-quiz-gold text-3xl">{eventState?.current_question_index || 0}</span>
                            <span className="text-quiz-muted text-xl">/ {eventState?.total_questions || 0}</span>
                        </div>
                    </div>
                </header>

                {rankings.length > 0 ? (
                    <div className="space-y-3">
                        {rankings.map((team) => {
                            const style = getRankStyle(team.rank);
                            const isTopThree = team.rank <= 3;
                            return (
                                <div
                                    key={team.id}
                                    className={`flex items-center gap-4 md:gap-6 p-4 md:p-6 rounded-2xl border-2 ${style.border} ${style.bg} backdrop-blur transition-all hover:scale-[1.01] ${isTopThree ? 'shadow-2xl' : ''
                                        }`}
                                >
                                    <div className={`flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-2xl ${style.rankBg} flex items-center justify-center font-black text-3xl md:text-4xl shadow-lg`}>
                                        {team.rank}
                                    </div>

                                    {isTopThree && (
                                        <div className="hidden md:flex flex-shrink-0">{style.icon}</div>
                                    )}

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className={`font-black truncate ${isTopThree ? 'text-2xl md:text-3xl text-quiz-text' : 'text-xl md:text-2xl text-quiz-text'
                                                }`}>
                                                {team.name}
                                            </h3>
                                            <span className={`text-xs md:text-sm px-2 py-1 rounded font-bold uppercase tracking-wider ${isTopThree ? 'bg-quiz-gold/20 text-quiz-gold' : 'bg-quiz-accent text-quiz-muted'
                                                }`}>
                                                {team.short_name}
                                            </span>
                                        </div>
                                        {team.institution && (
                                            <p className="text-sm md:text-base mt-1 truncate text-quiz-muted">
                                                🏫 {team.institution}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex-shrink-0 text-right">
                                        <div className={`font-black leading-none ${isTopThree ? 'text-4xl md:text-6xl' : 'text-3xl md:text-5xl'
                                            } ${style.scoreColor}`}>
                                            {team.total_score}
                                        </div>
                                        <div className="text-xs uppercase tracking-widest text-quiz-muted mt-1 font-bold">
                                            POINTS
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-20">
                        <Trophy size={80} className="text-quiz-muted mx-auto mb-6" />
                        <p className="text-3xl font-bold text-quiz-muted mb-2">NO TEAMS YET</p>
                        <p className="text-quiz-muted opacity-70">Waiting for the event to begin...</p>
                    </div>
                )}

                <footer className="mt-12 pt-6 border-t border-quiz-border">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
                        <div className="flex items-center gap-2 text-quiz-muted">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            <span className="uppercase tracking-widest font-semibold">Live Updates</span>
                        </div>
                        <div className="flex items-center gap-2 text-quiz-muted">
                            <Clock size={16} />
                            <span className="font-mono text-lg">{currentTime.toLocaleTimeString()}</span>
                        </div>
                        <div className="text-quiz-muted text-xs uppercase tracking-widest">
                            Powered by Ex-Quiz-It
                        </div>
                    </div>
                </footer>
            </div>

            {pulse && (
                <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-full text-sm font-bold animate-pulse z-50">
                    UPDATED
                </div>
            )}
        </div>
    );
}

export default AudienceScoreboard;