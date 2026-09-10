import React, { useState, useEffect } from 'react';
import { EventService } from './services/api';
import { Users, Layers, Upload, Play, RotateCcw } from 'lucide-react';
import TeamManager from './components/TeamManager';
import RoundManager from './components/RoundManager';
import ExcelImport from './components/ExcelImport';
import ScoringDashboard from './components/ScoringDashboard';
import AudienceScoreboard from './components/AudienceScoreboard';
import ThemeToggle from './components/ThemeToggle';
import './App.css';

function App() {
  const [view, setView] = useState('teams');
  const [eventId] = useState(1);
  const [eventState, setEventState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => { loadState(); }, [refreshKey]);

  const loadState = async () => {
    try {
      const res = await EventService.getState(eventId);
      setEventState(res.data);
    } catch (e) {
      console.error('Event state error:', e);
    } finally {
      setLoading(false);
    }
  };

  const forceRefresh = () => setRefreshKey(prev => prev + 1);

  const handleStartEvent = async () => {
    if (!window.confirm('Start the event? Teams and rounds will be locked.')) return;
    try {
      setStarting(true);
      const res = await EventService.start(eventId);
      alert('✅ ' + res.data.message);
      forceRefresh();
    } catch (e) {
      alert('❌ ' + (e.response?.data?.error || e.message));
    } finally { setStarting(false); }
  };

  const handleResetEvent = async () => {
    if (!window.confirm('Reset event? All scores will be deleted!')) return;
    try {
      await EventService.reset(eventId);
      alert('✅ Event reset');
      forceRefresh();
    } catch (e) {
      alert('❌ ' + (e.response?.data?.error || e.message));
    }
  };

  const handleImportComplete = () => {
    forceRefresh();
    setView('teams');
  };

  if (loading && !eventState) {
    return (
      <div className="min-h-screen bg-quiz-primary flex items-center justify-center">
        <div className="text-quiz-text text-xl">Loading...</div>
      </div>
    );
  }

  const tabs = [
    { id: 'teams', label: 'Teams', icon: Users },
    { id: 'rounds', label: 'Rounds', icon: Layers },
    { id: 'import', label: 'Import Excel', icon: Upload },
    { id: 'scoring', label: 'Live Scoring', icon: Play },
    { id: 'audience', label: 'Audience', icon: Users }
  ];

  return (
    <div className="min-h-screen bg-quiz-primary text-quiz-text">
      <nav className="bg-quiz-secondary border-b border-quiz-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              <h1 className="text-xl font-bold text-quiz-gold">Ex-Quiz-It</h1>
              <div className="flex gap-1">
                {tabs.map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setView(tab.id)}
                      className={`px-3 py-2 rounded-lg transition flex items-center gap-2 text-sm ${view === tab.id
                          ? 'bg-quiz-gold text-white'
                          : 'text-quiz-muted hover:text-quiz-text hover:bg-quiz-accent'
                        }`}
                    >
                      <Icon size={16} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-quiz-muted hidden md:inline">
                {eventState?.name || 'No Event'}
              </span>

              <ThemeToggle />

              {!eventState?.is_started ? (
                <button
                  onClick={handleStartEvent}
                  disabled={starting}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition flex items-center gap-2 font-semibold text-sm disabled:opacity-50"
                >
                  <Play size={16} />
                  {starting ? 'Starting...' : 'Start Event'}
                </button>
              ) : (
                <>
                  <span className="flex items-center gap-2 px-3 py-1 bg-green-900 text-green-400 rounded-full text-xs font-semibold">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    LIVE
                  </span>
                  <button
                    onClick={handleResetEvent}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition flex items-center gap-2 text-sm"
                  >
                    <RotateCcw size={16} />
                    Reset
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {view === 'teams' && (
          <TeamManager key={`teams-${refreshKey}`} eventId={eventId} onUpdate={forceRefresh} />
        )}
        {view === 'rounds' && (
          <RoundManager key={`rounds-${refreshKey}`} eventId={eventId} onUpdate={forceRefresh} />
        )}
        {view === 'import' && (
          <ExcelImport eventId={eventId} onImportComplete={handleImportComplete} />
        )}
        {view === 'scoring' && (
          <ScoringDashboard
            key={`scoring-${refreshKey}`}
            eventId={eventId}
            eventState={eventState}
            onUpdate={forceRefresh}
          />
        )}
        {view === 'audience' && (
          <AudienceScoreboard eventId={eventId} />
        )}
      </div>
    </div>
  );
}

export default App;