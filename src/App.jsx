import React, { useState, useEffect } from 'react';
import { EventService } from './services/api';
import Sidebar from './components/Sidebar';
import ThemeToggle from './components/ThemeToggle';
import TeamManager from './components/TeamManager';
import RoundManager from './components/RoundManager';
import ExcelImport from './components/ExcelImport';
import ScoringDashboard from './components/ScoringDashboard';
import AudienceScoreboard from './components/AudienceScoreboard';
import SettingsPanel from './components/SettingsPanel';
import ResultsExport from './components/ResultsExport';
import { Menu, RotateCcw } from 'lucide-react';
import './App.css';

function App() {
  const [view, setView] = useState('teams');
  const [eventId] = useState(1);
  const [eventState, setEventState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  // Event actions
  const handleStartEvent = async () => {
    if (!window.confirm('Start the event? Teams and rounds will be locked.')) return;
    try {
      const res = await EventService.start(eventId);
      alert('✅ ' + (res.data.message || 'Event started'));
      forceRefresh();
      setMobileOpen(false);
    } catch (e) {
      alert('❌ ' + (e.response?.data?.error || e.message));
    }
  };

  const handleStopEvent = async () => {
    if (!window.confirm('Stop the event? You can still resume later.')) return;
    try {
      await EventService.stop(eventId);
      alert('⏹️ Event stopped');
      forceRefresh();
      setMobileOpen(false);
    } catch (e) {
      alert('❌ ' + (e.response?.data?.error || e.message));
    }
  };

  const handleResetScores = async () => {
    if (!window.confirm('Reset all scores? Teams and rounds stay.')) return;
    try {
      await EventService.reset(eventId);
      alert('✅ Scores reset');
      forceRefresh();
    } catch (e) {
      alert('❌ ' + (e.response?.data?.error || e.message));
    }
  };

  const handleResetAll = async () => {
    const userInput = window.prompt(
      'This will delete ALL teams, rounds, scores, and history.\n\nType "RESET" to confirm:'
    );
    if (userInput !== 'RESET') {
      if (userInput !== null) alert('Cancelled — you must type RESET');
      return;
    }
    try {
      await EventService.resetAll(eventId);
      alert('🧹 Everything cleared.');
      forceRefresh();
      setView('teams');
      setMobileOpen(false);
    } catch (e) {
      alert('❌ ' + (e.response?.data?.error || e.message));
    }
  };

  const handleImportComplete = () => {
    forceRefresh();
    setView('teams');
  };

  const handleViewChange = (newView) => {
    setView(newView);
    setMobileOpen(false); // close drawer on mobile
  };

  if (loading && !eventState) {
    return (
      <div className="min-h-screen bg-quiz-primary flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-14 w-14 md:h-16 md:w-16 border-t-4 border-b-4 border-quiz-gold mx-auto mb-4"></div>
          <div className="text-quiz-text text-base md:text-xl">Loading Ex-Quiz-It...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-quiz-primary text-quiz-text">
      {/* ============ SIDEBAR ============ */}
      <Sidebar
        currentView={view}
        onViewChange={handleViewChange}
        isCollapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        eventState={eventState}
        onStartEvent={handleStartEvent}
        onStopEvent={handleStopEvent}
        onExportResults={() => { setShowExport(true); setMobileOpen(false); }}
        onResetAll={handleResetAll}
      />

      {/* ============ TOP BAR ============ */}
      <div
        className={`fixed top-0 right-0 z-30 h-14 md:h-16 bg-quiz-secondary/95 backdrop-blur border-b border-quiz-border transition-all duration-300 ${collapsed ? 'lg:left-20' : 'lg:left-64'
          } left-0`}
      >
        <div className="flex items-center justify-between h-full px-3 md:px-6">
          {/* Left: Mobile menu + Event name */}
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg bg-quiz-accent border border-quiz-border text-quiz-text flex-shrink-0"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-quiz-muted uppercase tracking-wider font-semibold hidden md:block">
                Event
              </p>
              <div className="flex items-center gap-2">
                <p className="text-sm md:text-lg font-bold text-quiz-text truncate">
                  {eventState?.name || 'No Event'}
                </p>
                {eventState?.is_started && (
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 border border-green-500/40 rounded-full flex-shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                    <span className="text-[9px] md:text-[10px] font-bold text-green-400 uppercase tracking-wider">
                      Live
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Theme toggle */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* ============ MAIN CONTENT ============ */}
      <main
        className={`transition-all duration-300 pt-16 md:pt-20 pb-4 md:pb-6 px-3 md:px-4 lg:px-6 ${collapsed ? 'lg:ml-20' : 'lg:ml-64'
          }`}
      >
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
          <AudienceScoreboard key={`audience-${refreshKey}`} eventId={eventId} />
        )}
        {view === 'settings' && (
          <SettingsPanel
            eventId={eventId}
            eventState={eventState}
            onUpdate={forceRefresh}
          />
        )}

        {/* Reset Scores */}
        {view !== 'audience' && eventState?.total_teams > 0 && (
          <div className="mt-6 md:mt-8 pt-4 md:pt-6 border-t border-quiz-border">
            <div className="flex flex-wrap gap-2 md:gap-3 justify-end">
              <button
                onClick={handleResetScores}
                className="px-3 md:px-4 py-2 bg-yellow-600/20 hover:bg-yellow-600 text-yellow-400 hover:text-white border border-yellow-600/40 rounded-lg text-xs md:text-sm font-semibold transition flex items-center gap-2"
              >
                <RotateCcw size={14} className="md:w-4 md:h-4" />
                Reset Scores
              </button>
            </div>
          </div>
        )}
      </main>

      {showExport && (
        <ResultsExport
          eventId={eventId}
          eventState={eventState}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}

export default App;