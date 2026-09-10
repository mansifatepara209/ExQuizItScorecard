import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, ArrowUp, ArrowDown, Save } from 'lucide-react';
import { TeamService, RoundService, EventService } from '../services/api';

const teamSchema = z.object({
    name: z.string().min(1, 'Team name required'),
    shortName: z.string().min(1, 'Short name required').max(10, 'Max 10 characters'),
    institution: z.string().optional(),
    members: z.string().optional()
});

const roundSchema = z.object({
    name: z.string().min(1, 'Round name required'),
    questionCount: z.number().min(1, 'At least 1 question'),
    type: z.enum(['regular', 'buzzer']),
    difficulty: z.enum(['easy', 'moderate', 'hard'])
});

function QuizSetup({ eventId = 1, onComplete }) {
    const [teams, setTeams] = useState([]);
    const [rounds, setRounds] = useState([]);
    const [scoringConfig, setScoringConfig] = useState({
        correct: 10,
        half_correct: 5,
        wrong: 0,
        pass: 0,
        penalty: -10
    });
    const [loading, setLoading] = useState(false);

    const { register: registerTeam, handleSubmit: handleTeamSubmit, reset: resetTeam, formState: { errors: teamErrors } } = useForm({
        resolver: zodResolver(teamSchema)
    });

    const { register: registerRound, handleSubmit: handleRoundSubmit, reset: resetRound, formState: { errors: roundErrors } } = useForm({
        resolver: zodResolver(roundSchema)
    });

    useEffect(() => {
        loadData();
    }, [eventId]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [teamsRes, roundsRes, configRes] = await Promise.all([
                TeamService.getAll(eventId),
                RoundService.getAll(eventId),
                EventService.getConfig(eventId)
            ]);
            setTeams(teamsRes.data);
            setRounds(roundsRes.data);

            // Convert config array to object
            const configObj = {};
            configRes.data.forEach(item => {
                configObj[item.action] = item.points;
            });
            setScoringConfig(configObj);
        } catch (error) {
            console.error('Error loading data:', error);
            alert('Error loading data: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Team Operations
    const addTeam = async (data) => {
        try {
            const teamData = {
                eventId,
                teamOrder: teams.length + 1,
                name: data.name,
                shortName: data.shortName,
                institution: data.institution || '',
                members: data.members || ''
            };
            const response = await TeamService.create(teamData);
            setTeams([...teams, response.data]);
            resetTeam();
        } catch (error) {
            alert('Error adding team: ' + error.response?.data?.error || error.message);
        }
    };

    const removeTeam = async (id) => {
        if (!window.confirm('Are you sure you want to delete this team?')) return;
        try {
            await TeamService.delete(id);
            setTeams(teams.filter(t => t.id !== id));
        } catch (error) {
            alert('Error deleting team: ' + error.response?.data?.error || error.message);
        }
    };

    const moveTeam = async (index, direction) => {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= teams.length) return;

        const newTeams = [...teams];
        const [removed] = newTeams.splice(index, 1);
        newTeams.splice(newIndex, 0, removed);

        // Update order
        const updatedTeams = newTeams.map((team, i) => ({
            ...team,
            order: i + 1
        }));

        try {
            await TeamService.reorder(updatedTeams.map(t => ({ id: t.id, order: t.order })));
            setTeams(updatedTeams);
        } catch (error) {
            alert('Error reordering teams: ' + error.response?.data?.error || error.message);
        }
    };

    // Round Operations
    const addRound = async (data) => {
        try {
            const roundData = {
                eventId,
                roundOrder: rounds.length + 1,
                name: data.name,
                questionCount: data.questionCount,
                type: data.type,
                difficulty: data.difficulty
            };
            const response = await RoundService.create(roundData);
            setRounds([...rounds, response.data]);
            resetRound();
        } catch (error) {
            alert('Error adding round: ' + error.response?.data?.error || error.message);
        }
    };

    const removeRound = async (id) => {
        if (!window.confirm('Are you sure you want to delete this round?')) return;
        try {
            await RoundService.delete(id);
            setRounds(rounds.filter(r => r.id !== id));
        } catch (error) {
            alert('Error deleting round: ' + error.response?.data?.error || error.message);
        }
    };

    // Scoring Configuration
    const updateScoringConfig = async () => {
        try {
            await EventService.updateConfig(eventId, scoringConfig);
            alert('Scoring configuration updated successfully!');
        } catch (error) {
            alert('Error updating scoring config: ' + error.response?.data?.error || error.message);
        }
    };

    return (
        <div className="text-white">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Teams Section */}
                <div className="bg-quiz-secondary p-6 rounded-lg">
                    <h2 className="text-2xl font-bold mb-4 text-quiz-gold">Teams</h2>

                    <form onSubmit={handleTeamSubmit(addTeam)} className="space-y-3 mb-4">
                        <div className="grid grid-cols-2 gap-3">
                            <input
                                {...registerTeam('name')}
                                placeholder="Team Name"
                                className="col-span-2 px-4 py-2 bg-quiz-primary border border-gray-700 rounded-lg focus:outline-none focus:border-quiz-gold"
                            />
                            <input
                                {...registerTeam('shortName')}
                                placeholder="Short Name"
                                className="px-4 py-2 bg-quiz-primary border border-gray-700 rounded-lg focus:outline-none focus:border-quiz-gold"
                            />
                            <input
                                {...registerTeam('institution')}
                                placeholder="Institution"
                                className="px-4 py-2 bg-quiz-primary border border-gray-700 rounded-lg focus:outline-none focus:border-quiz-gold"
                            />
                            <input
                                {...registerTeam('members')}
                                placeholder="Members (comma separated)"
                                className="col-span-2 px-4 py-2 bg-quiz-primary border border-gray-700 rounded-lg focus:outline-none focus:border-quiz-gold"
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full px-4 py-2 bg-quiz-gold text-white rounded-lg hover:opacity-80 transition flex items-center justify-center gap-2"
                        >
                            <Plus size={20} />
                            Add Team
                        </button>
                    </form>

                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {teams.map((team, index) => (
                            <div key={team.id} className="flex items-center justify-between bg-quiz-primary p-3 rounded-lg">
                                <div className="flex items-center gap-4">
                                    <span className="text-gray-400">#{team.team_order}</span>
                                    <span className="font-semibold">{team.name}</span>
                                    <span className="text-sm text-gray-400">({team.short_name})</span>
                                    {team.institution && (
                                        <span className="text-sm text-gray-400">{team.institution}</span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => moveTeam(index, -1)}
                                        disabled={index === 0}
                                        className="p-1 hover:text-quiz-gold transition disabled:opacity-50"
                                    >
                                        <ArrowUp size={20} />
                                    </button>
                                    <button
                                        onClick={() => moveTeam(index, 1)}
                                        disabled={index === teams.length - 1}
                                        className="p-1 hover:text-quiz-gold transition disabled:opacity-50"
                                    >
                                        <ArrowDown size={20} />
                                    </button>
                                    <button
                                        onClick={() => removeTeam(team.id)}
                                        className="p-1 hover:text-red-500 transition"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {teams.length === 0 && (
                            <p className="text-gray-400 text-center py-4">No teams added yet</p>
                        )}
                    </div>
                </div>

                {/* Rounds Section */}
                <div className="bg-quiz-secondary p-6 rounded-lg">
                    <h2 className="text-2xl font-bold mb-4 text-quiz-gold">Rounds</h2>

                    <form onSubmit={handleRoundSubmit(addRound)} className="space-y-3 mb-4">
                        <div className="grid grid-cols-2 gap-3">
                            <input
                                {...registerRound('name')}
                                placeholder="Round Name"
                                className="col-span-2 px-4 py-2 bg-quiz-primary border border-gray-700 rounded-lg focus:outline-none focus:border-quiz-gold"
                            />
                            <input
                                {...registerRound('questionCount')}
                                type="number"
                                placeholder="Questions"
                                className="px-4 py-2 bg-quiz-primary border border-gray-700 rounded-lg focus:outline-none focus:border-quiz-gold"
                            />
                            <select
                                {...registerRound('type')}
                                className="px-4 py-2 bg-quiz-primary border border-gray-700 rounded-lg focus:outline-none focus:border-quiz-gold"
                            >
                                <option value="regular">Regular</option>
                                <option value="buzzer">Buzzer</option>
                            </select>
                            <select
                                {...registerRound('difficulty')}
                                className="col-span-2 px-4 py-2 bg-quiz-primary border border-gray-700 rounded-lg focus:outline-none focus:border-quiz-gold"
                            >
                                <option value="easy">Easy</option>
                                <option value="moderate">Moderate</option>
                                <option value="hard">Hard</option>
                            </select>
                        </div>
                        <button
                            type="submit"
                            className="w-full px-4 py-2 bg-quiz-gold text-white rounded-lg hover:opacity-80 transition flex items-center justify-center gap-2"
                        >
                            <Plus size={20} />
                            Add Round
                        </button>
                    </form>

                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {rounds.map((round, index) => (
                            <div key={round.id} className="flex items-center justify-between bg-quiz-primary p-3 rounded-lg">
                                <div className="flex items-center gap-4">
                                    <span className="text-gray-400">#{round.round_order}</span>
                                    <span className="font-semibold">{round.name}</span>
                                    <span className="text-sm text-gray-400">({round.type})</span>
                                    <span className="text-sm text-gray-400">{round.question_count} Q</span>
                                    <span className={`text-xs px-2 py-1 rounded ${round.difficulty === 'easy' ? 'bg-green-900' :
                                            round.difficulty === 'moderate' ? 'bg-yellow-900' :
                                                'bg-red-900'
                                        }`}>
                                        {round.difficulty}
                                    </span>
                                </div>
                                <button
                                    onClick={() => removeRound(round.id)}
                                    className="p-1 hover:text-red-500 transition"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        ))}
                        {rounds.length === 0 && (
                            <p className="text-gray-400 text-center py-4">No rounds added yet</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Scoring Configuration */}
            <div className="bg-quiz-secondary p-6 rounded-lg mt-8">
                <h2 className="text-2xl font-bold mb-4 text-quiz-gold">Scoring Configuration</h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {Object.entries(scoringConfig).map(([action, points]) => (
                        <div key={action}>
                            <label className="block text-sm font-medium mb-1 capitalize">
                                {action.replace('_', ' ')}
                            </label>
                            <input
                                type="number"
                                value={points}
                                onChange={(e) => setScoringConfig({
                                    ...scoringConfig,
                                    [action]: parseInt(e.target.value) || 0
                                })}
                                className="w-full px-4 py-2 bg-quiz-primary border border-gray-700 rounded-lg focus:outline-none focus:border-quiz-gold"
                            />
                        </div>
                    ))}
                </div>
                <button
                    onClick={updateScoringConfig}
                    className="mt-4 px-6 py-2 bg-quiz-gold text-white rounded-lg hover:opacity-80 transition flex items-center gap-2"
                >
                    <Save size={20} />
                    Save Configuration
                </button>
            </div>
        </div>
    );
}

export default QuizSetup;