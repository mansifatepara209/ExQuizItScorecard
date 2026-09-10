import React, { useState, useEffect } from 'react';
import { EventService } from '../services/api';
import { Save } from 'lucide-react';

function Settings({ eventId, eventState, onUpdate }) {
    const [eventData, setEventData] = useState({ name: '', description: '' });
    const [config, setConfig] = useState({});
    const [msg, setMsg] = useState('');

    useEffect(() => {
        if (eventState) {
            setEventData({
                name: eventState.name || '',
                description: eventState.description || ''
            });
        }
        loadConfig();
    }, [eventState]);

    const loadConfig = async () => {
        try {
            const res = await EventService.getConfig(eventId);
            const obj = {};
            res.data.forEach(c => { obj[c.action] = c.points; });
            setConfig(obj);
        } catch (e) { console.error(e); }
    };

    const saveInfo = async () => {
        try {
            await EventService.update(eventId, eventData);
            setMsg('✅ Event info saved!');
            if (onUpdate) onUpdate();
            setTimeout(() => setMsg(''), 3000);
        } catch (e) { setMsg('❌ ' + e.message); }
    };

    const saveConfig = async () => {
        try {
            await EventService.updateConfig(eventId, config);
            setMsg('✅ Scoring config saved!');
            setTimeout(() => setMsg(''), 3000);
        } catch (e) { setMsg('❌ ' + e.message); }
    };

    const actions = [
        { key: 'correct', label: 'Correct', color: 'text-green-500' },
        { key: 'half_correct', label: 'Half Correct', color: 'text-blue-500' },
        { key: 'wrong', label: 'Wrong', color: 'text-red-500' },
        { key: 'pass', label: 'Pass', color: 'text-gray-400' },
        { key: 'penalty', label: 'Penalty', color: 'text-red-700' }
    ];

    return (
        <div className="space-y-6">
            {msg && <div className="bg-quiz-secondary p-4 rounded-lg text-center">{msg}</div>}

            <div className="bg-quiz-secondary p-6 rounded-lg">
                <h2 className="text-2xl font-bold mb-4 text-quiz-gold">Event Information</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm mb-1">Event Name</label>
                        <input type="text" value={eventData.name}
                            onChange={e => setEventData({ ...eventData, name: e.target.value })}
                            className="w-full px-4 py-2 bg-quiz-primary border border-gray-700 rounded text-white" />
                    </div>
                    <div>
                        <label className="block text-sm mb-1">Description</label>
                        <textarea value={eventData.description} rows="3"
                            onChange={e => setEventData({ ...eventData, description: e.target.value })}
                            className="w-full px-4 py-2 bg-quiz-primary border border-gray-700 rounded text-white" />
                    </div>
                    <button onClick={saveInfo}
                        className="px-6 py-2 bg-quiz-gold rounded hover:opacity-80 flex items-center gap-2">
                        <Save size={18} /> Save Event Info
                    </button>
                </div>
            </div>

            <div className="bg-quiz-secondary p-6 rounded-lg">
                <h2 className="text-2xl font-bold mb-4 text-quiz-gold">Scoring Configuration</h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {actions.map(a => (
                        <div key={a.key}>
                            <label className={`block text-sm mb-1 ${a.color}`}>{a.label}</label>
                            <input type="number" value={config[a.key] || 0}
                                onChange={e => setConfig({ ...config, [a.key]: parseInt(e.target.value) || 0 })}
                                className="w-full px-4 py-2 bg-quiz-primary border border-gray-700 rounded text-white" />
                        </div>
                    ))}
                </div>
                <button onClick={saveConfig}
                    className="mt-6 px-6 py-2 bg-quiz-gold rounded hover:opacity-80 flex items-center gap-2">
                    <Save size={18} /> Save Scoring Config
                </button>
            </div>

            <div className="bg-quiz-secondary p-6 rounded-lg">
                <h2 className="text-2xl font-bold mb-4 text-quiz-gold">Current Status</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <p className="text-gray-400">Teams</p>
                        <p className="text-xl font-bold">{eventState?.total_teams || 0}</p>
                    </div>
                    <div>
                        <p className="text-gray-400">Current Round</p>
                        <p className="text-xl font-bold">{eventState?.current_round_name || 'None'}</p>
                    </div>
                    <div>
                        <p className="text-gray-400">Question</p>
                        <p className="text-xl font-bold">{eventState?.current_question_index || 0} / {eventState?.total_questions || 0}</p>
                    </div>
                    <div>
                        <p className="text-gray-400">Status</p>
                        <p className={`text-xl font-bold ${eventState?.is_started ? 'text-green-500' : 'text-yellow-500'}`}>
                            {eventState?.is_started ? 'Live' : 'Setup'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Settings;