import React, { useState, useEffect } from 'react';
import { TeamService, RoundService, RankingService } from '../services/api';
import { Users, Layers, Trophy, Activity } from 'lucide-react';

function Dashboard({ eventId, eventState }) {
    const [teams, setTeams] = useState([]);
    const [rounds, setRounds] = useState([]);
    const [rankings, setRankings] = useState([]);

    useEffect(() => { loadData(); }, [eventId]);

    const loadData = async () => {
        try {
            const [t, r, rk] = await Promise.all([
                TeamService.getAll(eventId),
                RoundService.getAll(eventId),
                RankingService.getRankings(eventId)
            ]);
            setTeams(t.data);
            setRounds(r.data);
            setRankings(rk.data);
        } catch (e) { console.error(e); }
    };

    const StatCard = ({ icon: Icon, label, value, color }) => (
        <div className="bg-quiz-secondary p-6 rounded-lg">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-gray-400 text-sm">{label}</p>
                    <p className={`text-3xl font-bold mt-2 ${color}`}>{value}</p>
                </div>
                <Icon size={40} className={color} />
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold text-quiz-gold">Event Dashboard</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Users} label="Teams" value={teams.length} color="text-blue-500" />
                <StatCard icon={Layers} label="Rounds" value={rounds.length} color="text-purple-500" />
                <StatCard icon={Trophy} label="Status" value={eventState?.is_started ? 'Live' : 'Setup'} color="text-green-500" />
                <StatCard icon={Activity} label="Current Round" value={eventState?.current_round_name || 'None'} color="text-quiz-gold" />
            </div>

            <div className="bg-quiz-secondary p-6 rounded-lg">
                <h3 className="text-xl font-semibold mb-4 text-quiz-gold">Top Teams</h3>
                {rankings.length === 0 ? (
                    <p className="text-gray-400">No teams yet</p>
                ) : (
                    <div className="space-y-2">
                        {rankings.slice(0, 5).map(team => (
                            <div key={team.id} className="flex justify-between items-center bg-quiz-primary p-3 rounded">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl font-bold text-quiz-gold w-12">#{team.rank}</span>
                                    <div>
                                        <p className="font-semibold">{team.name}</p>
                                        <p className="text-sm text-gray-400">{team.institution || '-'}</p>
                                    </div>
                                </div>
                                <span className="text-2xl font-bold text-quiz-gold">{team.total_score}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-quiz-secondary p-6 rounded-lg">
                <h3 className="text-xl font-semibold mb-4 text-quiz-gold">Rounds</h3>
                {rounds.length === 0 ? (
                    <p className="text-gray-400">No rounds yet</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {rounds.map(round => (
                            <div key={round.id} className="bg-quiz-primary p-4 rounded">
                                <p className="font-semibold">{round.name}</p>
                                <p className="text-sm text-gray-400">{round.question_count} questions</p>
                                <div className="mt-2 flex gap-2">
                                    <span className={`text-xs px-2 py-1 rounded ${round.type === 'buzzer' ? 'bg-purple-900' : 'bg-blue-900'
                                        }`}>{round.type}</span>
                                    <span className={`text-xs px-2 py-1 rounded ${round.difficulty === 'easy' ? 'bg-green-900' :
                                            round.difficulty === 'moderate' ? 'bg-yellow-900' : 'bg-red-900'
                                        }`}>{round.difficulty}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Dashboard;