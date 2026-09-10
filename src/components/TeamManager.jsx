import React, { useState, useEffect } from 'react';
import { TeamService, RankingService } from '../services/api';
import { Plus, Trash2, Edit, Search, RefreshCw, X, ArrowUp, ArrowDown, Trophy } from 'lucide-react';

function TeamManager({ eventId = 1, onUpdate }) {
    const [teams, setTeams] = useState([]);
    const [search, setSearch] = useState('');
    const [modal, setModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ name: '', shortName: '', institution: '', members: '' });
    const [reordering, setReordering] = useState(false);

    useEffect(() => { load(); }, [eventId]);

    const load = async () => {
        try {
            const teamRes = await TeamService.getWithMembers(eventId);
            const rankRes = await RankingService.getRankings(eventId);

            const scoreMap = {};
            rankRes.data.forEach(r => {
                scoreMap[r.id] = { score: r.total_score, rank: r.rank };
            });

            const enriched = teamRes.data.map(t => ({
                ...t,
                total_score: scoreMap[t.id]?.score || 0,
                rank: scoreMap[t.id]?.rank || '-'
            }));

            enriched.sort((a, b) => a.team_order - b.team_order);
            setTeams(enriched);
        } catch (e) {
            console.error('Load error:', e);
        }
    };

    const submit = async (e) => {
        e.preventDefault();
        try {
            if (editing) await TeamService.update(editing.id, form);
            else await TeamService.create({ eventId, ...form });
            await load();
            if (onUpdate) onUpdate();
            setModal(false); setEditing(null); resetForm();
        } catch (e) { alert('Error: ' + e.message); }
    };

    const del = async (id) => {
        if (!window.confirm('Delete team?')) return;
        try {
            await TeamService.delete(id);
            await load();
            if (onUpdate) onUpdate();
        } catch (e) { alert('Error: ' + e.message); }
    };

    const moveTeam = async (index, direction) => {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= teams.length) return;

        const newTeams = [...teams];
        const [moved] = newTeams.splice(index, 1);
        newTeams.splice(newIndex, 0, moved);

        const updatedTeams = newTeams.map((t, i) => ({ ...t, team_order: i + 1 }));
        setTeams(updatedTeams);
        setReordering(true);

        try {
            await TeamService.reorder(updatedTeams.map(t => ({ id: t.id, order: t.team_order })));
            const rankRes = await RankingService.getRankings(eventId);
            const scoreMap = {};
            rankRes.data.forEach(r => {
                scoreMap[r.id] = { score: r.total_score, rank: r.rank };
            });
            setTeams(prev => prev.map(t => ({
                ...t,
                total_score: scoreMap[t.id]?.score || 0,
                rank: scoreMap[t.id]?.rank || '-'
            })));
        } catch (e) {
            console.error('Reorder failed:', e);
            alert('Failed to save order: ' + e.message);
            await load();
        } finally {
            setReordering(false);
        }
    };

    const resetForm = () => setForm({ name: '', shortName: '', institution: '', members: '' });

    const edit = (t) => {
        setEditing(t);
        setForm({
            name: t.name,
            shortName: t.short_name,
            institution: t.institution || '',
            members: t.members || ''
        });
        setModal(true);
    };

    const filtered = teams.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.short_name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="bg-quiz-secondary p-6 rounded-lg border border-quiz-border">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-quiz-gold">
                    Teams ({teams.length})
                    {reordering && <span className="text-sm text-yellow-400 ml-3">Saving order...</span>}
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => { resetForm(); setEditing(null); setModal(true); }}
                        className="px-4 py-2 bg-quiz-gold text-white rounded flex items-center gap-2 hover:opacity-80"
                    >
                        <Plus size={18} /> Add Team
                    </button>
                    <button onClick={load} className="px-4 py-2 bg-quiz-accent text-quiz-text rounded flex items-center gap-2 hover:opacity-80">
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-quiz-muted" size={18} />
                <input
                    type="text"
                    placeholder="Search teams..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-quiz-primary border border-quiz-border rounded text-quiz-text placeholder:text-quiz-muted focus:outline-none focus:border-quiz-gold"
                />
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-quiz-accent">
                        <tr>
                            <th className="px-2 py-3 text-center w-16 text-quiz-text">Order</th>
                            <th className="px-2 py-3 text-center w-20 text-quiz-text">Move</th>
                            <th className="px-4 py-3 text-left text-quiz-text">Team</th>
                            <th className="px-4 py-3 text-left text-quiz-text">Short</th>
                            <th className="px-4 py-3 text-left text-quiz-text">Institution</th>
                            <th className="px-4 py-3 text-left text-quiz-text">Members</th>
                            <th className="px-4 py-3 text-center text-quiz-text">Score</th>
                            <th className="px-4 py-3 text-center text-quiz-text">Rank</th>
                            <th className="px-4 py-3 text-left text-quiz-text">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((t) => {
                            const realIndex = teams.findIndex(x => x.id === t.id);
                            return (
                                <tr key={t.id} className="border-t border-quiz-border hover:bg-quiz-accent/50 transition">
                                    <td className="px-2 py-3 text-center">
                                        <span className="text-2xl font-bold text-quiz-gold">{t.team_order}</span>
                                    </td>
                                    <td className="px-2 py-3">
                                        <div className="flex flex-col items-center gap-1">
                                            <button
                                                onClick={() => moveTeam(realIndex, -1)}
                                                disabled={realIndex === 0 || reordering}
                                                className="p-1 hover:text-quiz-gold transition disabled:opacity-30 disabled:cursor-not-allowed text-quiz-muted"
                                                title="Move Up"
                                            >
                                                <ArrowUp size={18} />
                                            </button>
                                            <button
                                                onClick={() => moveTeam(realIndex, 1)}
                                                disabled={realIndex === teams.length - 1 || reordering}
                                                className="p-1 hover:text-quiz-gold transition disabled:opacity-30 disabled:cursor-not-allowed text-quiz-muted"
                                                title="Move Down"
                                            >
                                                <ArrowDown size={18} />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-quiz-text">{t.name}</td>
                                    <td className="px-4 py-3 text-quiz-text">{t.short_name}</td>
                                    <td className="px-4 py-3 text-quiz-muted">{t.institution || '-'}</td>
                                    <td className="px-4 py-3">
                                        {t.member_details?.length > 0 ? (
                                            <div className="text-sm space-y-0.5">
                                                {t.member_details.map((m, i) => (
                                                    <div key={i} className="text-quiz-muted">
                                                        {i + 1}. {m.member_name}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-quiz-muted">{t.member_count || 0}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="text-2xl font-bold text-quiz-gold">{t.total_score}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            {t.rank === 1 && <Trophy size={16} className="text-yellow-400" />}
                                            <span className={`font-bold ${t.rank === 1 ? 'text-yellow-400' :
                                                    t.rank === 2 ? 'text-gray-400' :
                                                        t.rank === 3 ? 'text-orange-500' : 'text-quiz-muted'
                                                }`}>
                                                #{t.rank}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-2">
                                            <button onClick={() => edit(t)} className="p-1 hover:text-quiz-gold text-quiz-muted">
                                                <Edit size={18} />
                                            </button>
                                            <button onClick={() => del(t.id)} className="p-1 hover:text-red-500 text-quiz-muted">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {filtered.length === 0 && (
                    <p className="text-center text-quiz-muted py-8">
                        {search ? 'No matches' : 'No teams yet'}
                    </p>
                )}
            </div>

            {modal && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
                    <div className="bg-quiz-secondary p-6 rounded-lg w-full max-w-2xl border border-quiz-border">
                        <div className="flex justify-between mb-4">
                            <h3 className="text-xl font-bold text-quiz-text">{editing ? 'Edit' : 'Add'} Team</h3>
                            <button onClick={() => { setModal(false); setEditing(null); resetForm(); }} className="text-quiz-muted hover:text-quiz-text">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={submit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm mb-1 text-quiz-text">Team Name *</label>
                                    <input type="text" required value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                        className="w-full px-3 py-2 bg-quiz-primary border border-quiz-border rounded text-quiz-text focus:outline-none focus:border-quiz-gold" />
                                </div>
                                <div>
                                    <label className="block text-sm mb-1 text-quiz-text">Short Name *</label>
                                    <input type="text" required value={form.shortName}
                                        onChange={e => setForm({ ...form, shortName: e.target.value })}
                                        className="w-full px-3 py-2 bg-quiz-primary border border-quiz-border rounded text-quiz-text focus:outline-none focus:border-quiz-gold" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm mb-1 text-quiz-text">Institution</label>
                                <input type="text" value={form.institution}
                                    onChange={e => setForm({ ...form, institution: e.target.value })}
                                    className="w-full px-3 py-2 bg-quiz-primary border border-quiz-border rounded text-quiz-text focus:outline-none focus:border-quiz-gold" />
                            </div>
                            <div>
                                <label className="block text-sm mb-1 text-quiz-text">Members (separate with ; or ,)</label>
                                <input type="text" value={form.members}
                                    onChange={e => setForm({ ...form, members: e.target.value })}
                                    placeholder="Alice; Bob; Carol"
                                    className="w-full px-3 py-2 bg-quiz-primary border border-quiz-border rounded text-quiz-text focus:outline-none focus:border-quiz-gold" />
                            </div>
                            <div className="flex gap-3">
                                <button type="submit" className="flex-1 py-2 bg-quiz-gold text-white rounded hover:opacity-80">
                                    {editing ? 'Update' : 'Create'}
                                </button>
                                <button type="button"
                                    onClick={() => { setModal(false); setEditing(null); resetForm(); }}
                                    className="px-6 py-2 bg-quiz-accent text-quiz-text rounded hover:opacity-80">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TeamManager;