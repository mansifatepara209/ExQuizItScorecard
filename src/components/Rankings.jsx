import React, { useState, useEffect } from 'react';
import { RankingService, ScoreService } from '../services/api';
import { Trophy, Medal, Award } from 'lucide-react';

function Rankings({ eventId }) {
    const [rankings, setRankings] = useState([]);
    const [history, setHistory] = useState([]);
    const [tab, setTab] = useState('rankings');

    useEffect(() => {
        loadData();
        const i = setInterval(loadData, 5000);
        return () => clearInterval(i);
    }, [eventId]);

    const loadData = async () => {
        try {
            const [r, h] = await Promise.all([
                RankingService.getRankings(eventId),
                ScoreService.getHistory(eventId)
            ]);
            setRankings(r.data);
            setHistory(h.data);
        } catch (e) { console.error(e); }
    };

    const getIcon = (rank) => {
        if (rank === 1) return <Trophy className="text-yellow-400" size={24} />;
        if (rank === 2) return <Medal className="text-gray-300" size={24} />;
        if (rank === 3) return <Award className="text-orange-600" size={24} />;
        return <span className="text-2xl font-bold text-gray-500 w-8 text-center">#{rank}</span>;
    };

    return (
        <div>
            <div className="flex gap-2 mb-6">
                <button onClick={() => setTab('rankings')}
                    className={`px-4 py-2 rounded-lg ${tab === 'rankings' ? 'bg-quiz-gold' : 'bg-quiz-secondary'}`}>
                    Rankings
                </button>
                <button onClick={() => setTab('history')}
                    className={`px-4 py-2 rounded-lg ${tab === 'history' ? 'bg-quiz-gold' : 'bg-quiz-secondary'}`}>
                    Score History ({history.length})
                </button>
            </div>

            {tab === 'rankings' && (
                <div className="bg-quiz-secondary p-6 rounded-lg">
                    <h2 className="text-2xl font-bold mb-6 text-quiz-gold">Live Rankings</h2>
                    <div className="space-y-3">
                        {rankings.map(team => (
                            <div key={team.id} className={`flex items-center justify-between p-4 rounded-lg ${team.rank <= 3 ? 'bg-quiz-primary border-2 border-quiz-gold' : 'bg-quiz-primary'
                                }`}>
                                <div className="flex items-center gap-4">
                                    {getIcon(team.rank)}
                                    <div>
                                        <p className="font-bold text-lg">{team.name}</p>
                                        <p className="text-sm text-gray-400">
                                            {team.short_name} • {team.institution || '-'}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-3xl font-bold text-quiz-gold">{team.total_score}</p>
                                    <p className="text-xs text-gray-400">{team.questions_answered} questions</p>
                                </div>
                            </div>
                        ))}
                        {rankings.length === 0 && <p className="text-center text-gray-400 py-8">No teams to rank yet</p>}
                    </div>
                </div>
            )}

            {tab === 'history' && (
                <div className="bg-quiz-secondary p-6 rounded-lg">
                    <h2 className="text-2xl font-bold mb-6 text-quiz-gold">Score History</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-quiz-primary">
                                <tr>
                                    <th className="px-4 py-2 text-left">Time</th>
                                    <th className="px-4 py-2 text-left">Team</th>
                                    <th className="px-4 py-2 text-left">Round</th>
                                    <th className="px-4 py-2 text-left">Q#</th>
                                    <th className="px-4 py-2 text-left">Action</th>
                                    <th className="px-4 py-2 text-right">Points</th>
                                    <th className="px-4 py-2 text-right">Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map(h => (
                                    <tr key={h.id} className="border-t border-gray-700">
                                        <td className="px-4 py-2 text-sm text-gray-400">
                                            {new Date(h.timestamp).toLocaleTimeString()}
                                        </td>
                                        <td className="px-4 py-2">{h.team_name}</td>
                                        <td className="px-4 py-2">{h.round_name}</td>
                                        <td className="px-4 py-2">{(h.question_index || 0) + 1}</td>
                                        <td className="px-4 py-2 capitalize">{h.action?.replace('_', ' ')}</td>
                                        <td className={`px-4 py-2 text-right font-bold ${h.points > 0 ? 'text-green-500' : h.points < 0 ? 'text-red-500' : 'text-gray-400'
                                            }`}>{h.points > 0 ? '+' : ''}{h.points}</td>
                                        <td className="px-4 py-2 text-right text-quiz-gold font-bold">{h.after_score}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {history.length === 0 && <p className="text-center text-gray-400 py-8">No score history yet</p>}
                    </div>
                </div>
            )}
        </div>
    );
}

export default Rankings;