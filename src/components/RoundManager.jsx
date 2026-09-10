import React, { useState, useEffect } from 'react';
import { RoundService } from '../services/api';
import { Plus, Trash2, Edit, X } from 'lucide-react';

function RoundManager({ eventId, onUpdate }) {
    const [rounds, setRounds] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [formData, setFormData] = useState({
        name: '', questionCount: 10, type: 'regular', difficulty: 'easy'
    });

    useEffect(() => { loadRounds(); }, [eventId]);

    const loadRounds = async () => {
        try {
            const res = await RoundService.getAll(eventId);
            setRounds(res.data);
        } catch (e) { console.error(e); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editing) await RoundService.update(editing.id, formData);
            else await RoundService.create({ eventId, ...formData });
            await loadRounds();
            if (onUpdate) onUpdate();
            setShowModal(false);
            setEditing(null);
            resetForm();
        } catch (e) { alert('Error: ' + e.message); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this round?')) return;
        try {
            await RoundService.delete(id);
            await loadRounds();
            if (onUpdate) onUpdate();
        } catch (e) { alert('Error: ' + e.message); }
    };

    const resetForm = () => setFormData({ name: '', questionCount: 10, type: 'regular', difficulty: 'easy' });

    const editRound = (round) => {
        setEditing(round);
        setFormData({
            name: round.name,
            questionCount: round.question_count,
            type: round.type,
            difficulty: round.difficulty
        });
        setShowModal(true);
    };

    return (
        <div className="bg-quiz-secondary p-6 rounded-lg border border-quiz-border">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-quiz-gold">Rounds ({rounds.length})</h2>
                <button
                    onClick={() => { resetForm(); setEditing(null); setShowModal(true); }}
                    className="px-4 py-2 bg-quiz-gold text-white rounded-lg flex items-center gap-2 hover:opacity-80"
                >
                    <Plus size={18} /> Add Round
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rounds.map(round => (
                    <div key={round.id} className="bg-quiz-primary p-4 rounded-lg border border-quiz-border">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h3 className="font-bold text-lg text-quiz-text">{round.name}</h3>
                                <p className="text-sm text-quiz-muted">Round #{round.round_order}</p>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => editRound(round)} className="p-1 hover:text-quiz-gold text-quiz-muted">
                                    <Edit size={16} />
                                </button>
                                <button onClick={() => handleDelete(round.id)} className="p-1 hover:text-red-500 text-quiz-muted">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="space-y-1 text-sm text-quiz-text">
                            <p>Questions: <span className="text-quiz-gold font-bold">{round.question_count}</span></p>
                            <p>Type: <span className={`px-2 py-0.5 rounded text-xs ${round.type === 'buzzer' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                                }`}>{round.type}</span></p>
                            <p>Difficulty: <span className={
                                round.difficulty === 'easy' ? 'text-green-500' :
                                    round.difficulty === 'moderate' ? 'text-yellow-500' :
                                        'text-red-500'
                            }>{round.difficulty}</span></p>
                        </div>
                    </div>
                ))}
            </div>

            {rounds.length === 0 && (
                <p className="text-center text-quiz-muted py-8">No rounds added yet</p>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
                    <div className="bg-quiz-secondary p-6 rounded-lg w-full max-w-md border border-quiz-border">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-quiz-text">{editing ? 'Edit' : 'Add'} Round</h3>
                            <button onClick={() => { setShowModal(false); setEditing(null); resetForm(); }} className="text-quiz-muted hover:text-quiz-text">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm mb-1 text-quiz-text">Round Name</label>
                                <input type="text" required value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 bg-quiz-primary border border-quiz-border rounded text-quiz-text focus:outline-none focus:border-quiz-gold" />
                            </div>
                            <div>
                                <label className="block text-sm mb-1 text-quiz-text">Question Count</label>
                                <input type="number" required min="1" value={formData.questionCount}
                                    onChange={e => setFormData({ ...formData, questionCount: parseInt(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 bg-quiz-primary border border-quiz-border rounded text-quiz-text focus:outline-none focus:border-quiz-gold" />
                            </div>
                            <div>
                                <label className="block text-sm mb-1 text-quiz-text">Type</label>
                                <select value={formData.type}
                                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                                    className="w-full px-3 py-2 bg-quiz-primary border border-quiz-border rounded text-quiz-text focus:outline-none focus:border-quiz-gold">
                                    <option value="regular">Regular</option>
                                    <option value="buzzer">Buzzer</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm mb-1 text-quiz-text">Difficulty</label>
                                <select value={formData.difficulty}
                                    onChange={e => setFormData({ ...formData, difficulty: e.target.value })}
                                    className="w-full px-3 py-2 bg-quiz-primary border border-quiz-border rounded text-quiz-text focus:outline-none focus:border-quiz-gold">
                                    <option value="easy">Easy</option>
                                    <option value="moderate">Moderate</option>
                                    <option value="hard">Hard</option>
                                </select>
                            </div>
                            <button type="submit" className="w-full py-2 bg-quiz-gold text-white rounded hover:opacity-80">
                                {editing ? 'Update' : 'Create'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default RoundManager;