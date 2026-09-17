import React, { useState, useEffect } from 'react';
import { RoundService } from '../services/api';
import { Plus, Trash2, Edit, X, Check, AlertCircle, Minus, Award, BookOpen, ListChecks } from 'lucide-react';

function RoundManager({ eventId, onUpdate }) {
    const [rounds, setRounds] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        questionCount: 9,
        type: 'regular',
        difficulty: 'easy',
        correctPoints: 10,
        wrongPoints: 0,
        halfPoints: 5,
        passPoints: 0,
        questionType: ''
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
            setShowModal(false); setEditing(null); resetForm();
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

    const resetForm = () => setFormData({
        name: '',
        questionCount: 9,
        type: 'regular',
        difficulty: 'easy',
        correctPoints: 10,
        wrongPoints: 0,
        halfPoints: 5,
        passPoints: 0,
        questionType: ''
    });

    const editRound = (round) => {
        setEditing(round);
        setFormData({
            name: round.name,
            questionCount: round.question_count ?? 9,
            type: round.type,
            difficulty: round.difficulty,
            correctPoints: round.correct_points ?? 0,
            wrongPoints: round.wrong_points ?? 0,
            halfPoints: round.half_points ?? 0,
            passPoints: round.pass_points ?? 0,
            questionType: round.question_type || ''
        });
        setShowModal(true);
    };

    const formatPoints = (p) => {
        const n = Number(p);
        return n > 0 ? `+${n}` : `${n}`;
    };

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div>
                    <h2 className="text-xl md:text-2xl font-bold text-quiz-gold">Rounds ({rounds.length})</h2>
                    <p className="text-xs md:text-sm text-quiz-muted mt-1 hidden sm:block">
                        Each round has its own scoring points from Excel
                    </p>
                </div>
                <button
                    onClick={() => { resetForm(); setEditing(null); setShowModal(true); }}
                    className="px-3 md:px-4 py-2 bg-quiz-gold hover:opacity-80 text-white rounded-lg flex items-center justify-center gap-2 text-sm font-semibold transition"
                >
                    <Plus size={16} /> Add Round
                </button>
            </div>

            {/* Rounds Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {rounds.map((round) => (
                    <div key={round.id} className="bg-quiz-secondary rounded-lg border border-quiz-border overflow-hidden hover:border-quiz-gold/60 transition">
                        {/* Header */}
                        <div className="p-3 md:p-4 border-b border-quiz-border">
                            <div className="flex justify-between items-start gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <span className="text-[10px] font-bold text-quiz-muted">R#{round.round_order}</span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${round.type === 'buzzer' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                                            }`}>
                                            {round.type === 'buzzer' ? '🔔 Buzzer' : '📋 Regular'}
                                        </span>
                                        {round.question_type && (
                                            <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-quiz-accent text-quiz-muted">
                                                {round.question_type}
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="font-bold text-base md:text-lg text-quiz-text truncate">{round.name}</h3>
                                </div>
                                <div className="flex gap-1 flex-shrink-0">
                                    <button onClick={() => editRound(round)} className="p-1.5 rounded hover:bg-quiz-accent text-quiz-muted hover:text-quiz-gold transition">
                                        <Edit size={14} />
                                    </button>
                                    <button onClick={() => handleDelete(round.id)} className="p-1.5 rounded hover:bg-red-500/20 text-quiz-muted hover:text-red-500 transition">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-3 md:p-4 space-y-3">
                            <div className="flex justify-between text-xs md:text-sm">
                                <span className="text-quiz-muted">Questions</span>
                                <span className="font-bold text-quiz-text">{round.question_count}</span>
                            </div>
                            <div className="flex justify-between text-xs md:text-sm">
                                <span className="text-quiz-muted">Difficulty</span>
                                <span className={`font-bold capitalize ${round.difficulty === 'easy' ? 'text-green-500' :
                                    round.difficulty === 'moderate' ? 'text-yellow-500' : 'text-red-500'
                                    }`}>
                                    {round.difficulty}
                                </span>
                            </div>

                            <div className="border-t border-quiz-border pt-3">
                                <p className="text-[10px] text-quiz-muted uppercase tracking-wider font-semibold mb-2">
                                    Scoring (from Excel)
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    <PointsBadge icon={<Check size={12} />} label="Correct" value={formatPoints(round.correct_points)} color="green" />
                                    <PointsBadge icon={<Minus size={12} />} label="Half" value={formatPoints(round.half_points)} color="blue" />
                                    <PointsBadge icon={<X size={12} />} label="Wrong" value={formatPoints(round.wrong_points)} color="red" />
                                    <PointsBadge icon={<AlertCircle size={12} />} label="Pass" value={formatPoints(round.pass_points)} color="gray" />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {rounds.length === 0 && (
                <div className="text-center py-12 md:py-16 bg-quiz-secondary rounded-lg border border-dashed border-quiz-border">
                    <Award size={40} className="text-quiz-muted mx-auto mb-3" />
                    <p className="text-lg md:text-xl font-bold text-quiz-muted mb-2">No rounds added yet</p>
                    <p className="text-xs md:text-sm text-quiz-muted mb-4">Import Excel or add rounds manually</p>
                    <button
                        onClick={() => { resetForm(); setEditing(null); setShowModal(true); }}
                        className="px-4 md:px-6 py-2 bg-quiz-gold hover:opacity-80 text-white rounded-lg font-semibold inline-flex items-center gap-2 text-sm"
                    >
                        <Plus size={16} /> Add First Round
                    </button>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-3 md:p-4">
                    <div className="bg-quiz-secondary rounded-xl border border-quiz-border w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center p-4 md:p-5 border-b border-quiz-border sticky top-0 bg-quiz-secondary z-10">
                            <h3 className="text-lg md:text-xl font-bold text-quiz-text">
                                {editing ? 'Edit Round' : 'Add New Round'}
                            </h3>
                            <button onClick={() => { setShowModal(false); setEditing(null); resetForm(); }} className="p-1 rounded hover:bg-quiz-accent text-quiz-muted hover:text-quiz-text transition">
                                <X size={22} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-4 md:p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1 text-quiz-text">Round Name *</label>
                                <input type="text" required value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="General Knowledge"
                                    className="w-full px-3 py-2 bg-quiz-primary border border-quiz-border rounded-lg text-quiz-text focus:outline-none focus:border-quiz-gold" />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-quiz-text">Questions *</label>
                                    <input type="number" required min="1" value={formData.questionCount}
                                        onChange={e => setFormData({ ...formData, questionCount: parseInt(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 bg-quiz-primary border border-quiz-border rounded-lg text-quiz-text focus:outline-none focus:border-quiz-gold" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-quiz-text">Round Type *</label>
                                    <select value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                                        className="w-full px-3 py-2 bg-quiz-primary border border-quiz-border rounded-lg text-quiz-text focus:outline-none focus:border-quiz-gold">
                                        <option value="regular">Regular</option>
                                        <option value="buzzer">Buzzer</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-quiz-text">Difficulty *</label>
                                    <select value={formData.difficulty}
                                        onChange={e => setFormData({ ...formData, difficulty: e.target.value })}
                                        className="w-full px-3 py-2 bg-quiz-primary border border-quiz-border rounded-lg text-quiz-text focus:outline-none focus:border-quiz-gold">
                                        <option value="easy">Easy</option>
                                        <option value="moderate">Moderate</option>
                                        <option value="hard">Hard</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-quiz-text">Question Format</label>
                                    <select value={formData.questionType}
                                        onChange={e => setFormData({ ...formData, questionType: e.target.value })}
                                        className="w-full px-3 py-2 bg-quiz-primary border border-quiz-border rounded-lg text-quiz-text focus:outline-none focus:border-quiz-gold">
                                        <option value="">— Not set —</option>
                                        <option value="DIRECT">Direct</option>
                                        <option value="MCQ">Multiple Choice</option>
                                    </select>
                                </div>
                            </div>

                            <div className="border-t border-quiz-border pt-4">
                                <p className="text-sm font-bold text-quiz-gold mb-3 flex items-center gap-2">
                                    <Award size={16} /> Scoring Points
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    <PointInput label="Correct (+)" color="green" value={formData.correctPoints} onChange={v => setFormData({ ...formData, correctPoints: v })} />
                                    <PointInput label="Half (+)" color="blue" value={formData.halfPoints} onChange={v => setFormData({ ...formData, halfPoints: v })} />
                                    <PointInput label="Wrong (−)" color="red" value={formData.wrongPoints} onChange={v => setFormData({ ...formData, wrongPoints: v })} />
                                    <PointInput label="Pass" color="gray" value={formData.passPoints} onChange={v => setFormData({ ...formData, passPoints: v })} />
                                </div>
                            </div>

                            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-2">
                                <button type="button"
                                    onClick={() => { setShowModal(false); setEditing(null); resetForm(); }}
                                    className="w-full sm:w-auto px-5 py-2.5 bg-quiz-accent text-quiz-text rounded-lg font-semibold">
                                    Cancel
                                </button>
                                <button type="submit" className="w-full sm:flex-1 py-2.5 bg-quiz-gold hover:opacity-80 text-white rounded-lg font-bold transition">
                                    {editing ? 'Update Round' : 'Create Round'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function PointsBadge({ icon, label, value, color }) {
    const colors = {
        green: 'bg-green-500/10 border-green-500/30 text-green-500',
        blue: 'bg-blue-500/10 border-blue-500/30 text-blue-500',
        red: 'bg-red-500/10 border-red-500/30 text-red-500',
        gray: 'bg-gray-500/10 border-gray-500/30 text-quiz-muted'
    };
    return (
        <div className={`flex items-center gap-2 ${colors[color]} border rounded-lg px-2 py-1.5`}>
            <span className="flex-shrink-0">{icon}</span>
            <div className="min-w-0">
                <p className="text-[9px] opacity-70 leading-tight">{label}</p>
                <p className="font-bold text-xs">{value}</p>
            </div>
        </div>
    );
}

function PointInput({ label, color, value, onChange }) {
    const colors = {
        green: 'text-green-500 focus:border-green-500',
        blue: 'text-blue-500 focus:border-blue-500',
        red: 'text-red-500 focus:border-red-500',
        gray: 'text-quiz-muted focus:border-quiz-muted'
    };
    return (
        <div>
            <label className={`block text-xs font-medium mb-1 ${colors[color]}`}>{label}</label>
            <input type="number" value={value}
                onChange={e => onChange(parseInt(e.target.value) || 0)}
                className={`w-full px-3 py-2 bg-quiz-primary border border-quiz-border rounded-lg text-quiz-text ${colors[color]}`} />
        </div>
    );
}

export default RoundManager;