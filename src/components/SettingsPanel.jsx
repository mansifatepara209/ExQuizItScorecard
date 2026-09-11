import React, { useState, useEffect } from 'react';
import { EventService } from '../services/api';
import {
    Save, Settings as SettingsIcon, AlertCircle, CheckCircle,
    Info, Award, Calendar, Users, Layers, RefreshCw
} from 'lucide-react';

function SettingsPanel({ eventId = 1, eventState, onUpdate }) {
    const [eventData, setEventData] = useState({
        name: '',
        description: ''
    });
    const [penaltyPoints, setPenaltyPoints] = useState(-10);
    const [tieBreakRule, setTieBreakRule] = useState('SCORE,CORRECT_COUNT,FEWER_WRONG,FEWER_PENALTIES,ALPHABETICAL');

    const [loading, setLoading] = useState(false);
    const [savingEvent, setSavingEvent] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    // ============ LOAD ============
    useEffect(() => {
        if (eventState) {
            setEventData({
                name: eventState.name || '',
                description: eventState.description || ''
            });
        }
    }, [eventState]);

    useEffect(() => {
        // Load penalty config
        loadConfig();
    }, [eventId]);

    const loadConfig = async () => {
        try {
            const res = await EventService.getConfig(eventId);
            const penalty = res.data.find(c => c.action === 'penalty');
            if (penalty) setPenaltyPoints(penalty.points);
        } catch (e) {
            console.error('Config load error:', e);
        }
    };

    // ============ SAVE EVENT INFO ============
    const saveEventInfo = async () => {
        if (!eventData.name.trim()) {
            showMessage('Event name cannot be empty', 'error');
            return;
        }
        try {
            setSavingEvent(true);
            await EventService.update(eventId, eventData);
            showMessage('✅ Event info saved', 'success');
            if (onUpdate) onUpdate();
        } catch (e) {
            showMessage('❌ ' + (e.response?.data?.error || e.message), 'error');
        } finally {
            setSavingEvent(false);
        }
    };

    // ============ SAVE PENALTY CONFIG ============
    const savePenaltyConfig = async () => {
        try {
            setSavingSettings(true);
            await EventService.updateConfig(eventId, {
                penalty: penaltyPoints
            });
            showMessage('✅ Penalty config saved', 'success');
        } catch (e) {
            showMessage('❌ ' + (e.response?.data?.error || e.message), 'error');
        } finally {
            setSavingSettings(false);
        }
    };

    const showMessage = (text, type = 'info') => {
        setMessage({ text, type });
        setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    };

    // ============ TIE BREAK RULES ============
    const tieBreakOptions = [
        { value: 'SCORE,CORRECT_COUNT,FEWER_WRONG,FEWER_PENALTIES,ALPHABETICAL', label: 'Score → Correct → Fewer Wrong → Fewer Penalties → Alphabetical' },
        { value: 'SCORE,CORRECT_COUNT,ALPHABETICAL', label: 'Score → Correct Count → Alphabetical' },
        { value: 'SCORE,FEWER_WRONG,ALPHABETICAL', label: 'Score → Fewer Wrong → Alphabetical' },
        { value: 'SCORE,ALPHABETICAL', label: 'Score → Alphabetical' }
    ];

    // ============ STATS ============
    const totalTeams = eventState?.total_teams || 0;

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-quiz-gold flex items-center gap-2">
                    <SettingsIcon size={28} /> Settings
                </h2>
                <p className="text-sm text-quiz-muted mt-1">
                    Configure your event. Matches the Settings sheet in the Excel template.
                </p>
            </div>

            {/* Message */}
            {message.text && (
                <div className={`p-4 rounded-lg border flex items-center gap-3 ${message.type === 'success'
                        ? 'bg-green-500/10 border-green-500/40 text-green-400'
                        : message.type === 'error'
                            ? 'bg-red-500/10 border-red-500/40 text-red-400'
                            : 'bg-blue-500/10 border-blue-500/40 text-blue-400'
                    }`}>
                    {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                    <span className="font-medium">{message.text}</span>
                </div>
            )}

            {/* Event Info Section */}
            <Section
                icon={<Calendar size={20} />}
                title="Event Information"
                subtitle="Event name and description"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-quiz-text">
                            Event Name *
                        </label>
                        <input
                            type="text"
                            value={eventData.name}
                            onChange={e => setEventData({ ...eventData, name: e.target.value })}
                            placeholder="Ex-Quiz-It 2026"
                            className="w-full px-4 py-2.5 bg-quiz-primary border border-quiz-border rounded-lg text-quiz-text focus:outline-none focus:border-quiz-gold"
                        />
                        <p className="text-xs text-quiz-muted mt-1">
                            Shown in the navbar and audience scoreboard
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1 text-quiz-text">
                            Description
                        </label>
                        <textarea
                            value={eventData.description}
                            onChange={e => setEventData({ ...eventData, description: e.target.value })}
                            placeholder="Annual quiz competition..."
                            rows="3"
                            className="w-full px-4 py-2.5 bg-quiz-primary border border-quiz-border rounded-lg text-quiz-text focus:outline-none focus:border-quiz-gold resize-none"
                        />
                    </div>

                    <button
                        onClick={saveEventInfo}
                        disabled={savingEvent}
                        className="px-6 py-2.5 bg-quiz-gold hover:opacity-80 text-white rounded-lg font-semibold transition flex items-center gap-2 disabled:opacity-50"
                    >
                        {savingEvent ? (
                            <><RefreshCw size={18} className="animate-spin" /> Saving...</>
                        ) : (
                            <><Save size={18} /> Save Event Info</>
                        )}
                    </button>
                </div>
            </Section>

            {/* Penalty Section */}
            <Section
                icon={<AlertCircle size={20} />}
                title="Penalty Points"
                subtitle="Deducted when a penalty is applied from the Live Scoring panel"
            >
                <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        {[-5, -10, -15, -20, -25].map(p => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => setPenaltyPoints(p)}
                                className={`px-4 py-2 rounded-lg font-bold transition border-2 ${penaltyPoints === p
                                        ? 'bg-red-600 border-red-500 text-white'
                                        : 'bg-quiz-primary border-quiz-border text-quiz-text hover:border-red-500'
                                    }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1 text-quiz-text">
                            Custom Penalty Points
                        </label>
                        <input
                            type="number"
                            value={penaltyPoints}
                            onChange={e => setPenaltyPoints(parseInt(e.target.value) || 0)}
                            className="w-full md:w-48 px-4 py-2.5 bg-quiz-primary border border-quiz-border rounded-lg text-quiz-text focus:outline-none focus:border-red-500"
                        />
                        <p className="text-xs text-quiz-muted mt-1">
                            Negative values deduct points. Default: -10
                        </p>
                    </div>

                    {/* Preview */}
                    <div className="bg-quiz-primary rounded-lg p-4 border border-quiz-border">
                        <p className="text-xs text-quiz-muted uppercase tracking-wider font-semibold mb-2">
                            Preview
                        </p>
                        <div className="flex items-center gap-3 text-sm">
                            <span className="text-quiz-muted">Team at 50 points</span>
                            <span className="text-quiz-muted">→</span>
                            <span className="font-bold text-red-400">
                                {50 + penaltyPoints} points
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={savePenaltyConfig}
                        disabled={savingSettings}
                        className="px-6 py-2.5 bg-quiz-gold hover:opacity-80 text-white rounded-lg font-semibold transition flex items-center gap-2 disabled:opacity-50"
                    >
                        {savingSettings ? (
                            <><RefreshCw size={18} className="animate-spin" /> Saving...</>
                        ) : (
                            <><Save size={18} /> Save Penalty Config</>
                        )}
                    </button>
                </div>
            </Section>

            {/* Tie Break Section */}
            <Section
                icon={<Award size={20} />}
                title="Tie-Break Rule"
                subtitle="How to rank teams with equal scores"
            >
                <div className="space-y-3">
                    {tieBreakOptions.map(opt => (
                        <label
                            key={opt.value}
                            className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition ${tieBreakRule === opt.value
                                    ? 'bg-quiz-gold/10 border-quiz-gold'
                                    : 'bg-quiz-primary border-quiz-border hover:border-quiz-gold/50'
                                }`}
                        >
                            <input
                                type="radio"
                                name="tiebreak"
                                value={opt.value}
                                checked={tieBreakRule === opt.value}
                                onChange={e => setTieBreakRule(e.target.value)}
                                className="mt-1 accent-quiz-gold"
                            />
                            <div className="flex-1">
                                <p className="font-semibold text-quiz-text text-sm">
                                    {opt.label}
                                </p>
                            </div>
                        </label>
                    ))}
                </div>

                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex gap-2">
                    <Info size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-400">
                        Ranking is applied live. Change the rule here and it affects the next recalculation.
                    </p>
                </div>
            </Section>

            {/* Event Status */}
            <Section
                icon={<Info size={20} />}
                title="Event Status"
                subtitle="Read-only information about the current event"
            >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard
                        icon={<Users size={20} />}
                        label="Teams"
                        value={totalTeams}
                        color="text-blue-400"
                    />
                    <StatCard
                        icon={<Layers size={20} />}
                        label="Current Round"
                        value={eventState?.current_round_name || '—'}
                        color="text-purple-400"
                    />
                    <StatCard
                        icon={<Award size={20} />}
                        label="Question"
                        value={`${eventState?.current_question_index || 0}/${eventState?.total_questions || 0}`}
                        color="text-quiz-gold"
                    />
                    <StatCard
                        icon={<AlertCircle size={20} />}
                        label="Status"
                        value={eventState?.is_started ? 'LIVE' : 'Not Started'}
                        color={eventState?.is_started ? 'text-green-400' : 'text-yellow-400'}
                    />
                </div>
            </Section>
        </div>
    );
}

// ============ HELPER COMPONENTS ============
function Section({ icon, title, subtitle, children }) {
    return (
        <div className="bg-quiz-secondary rounded-lg border border-quiz-border overflow-hidden">
            <div className="px-6 py-4 border-b border-quiz-border">
                <h3 className="text-lg font-bold text-quiz-text flex items-center gap-2">
                    <span className="text-quiz-gold">{icon}</span>
                    {title}
                </h3>
                {subtitle && (
                    <p className="text-xs text-quiz-muted mt-1">{subtitle}</p>
                )}
            </div>
            <div className="p-6">
                {children}
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, color }) {
    return (
        <div className="bg-quiz-primary border border-quiz-border rounded-lg p-3">
            <div className={`mb-2 ${color}`}>{icon}</div>
            <p className="text-[10px] text-quiz-muted uppercase tracking-wider font-semibold">
                {label}
            </p>
            <p className={`font-black text-lg ${color} truncate`}>
                {value}
            </p>
        </div>
    );
}

export default SettingsPanel;