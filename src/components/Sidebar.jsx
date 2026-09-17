import React from 'react';
import {
    Users, Layers, Upload, Play, Monitor, Settings,
    X, ChevronLeft, ChevronRight,
    Download, Power, RotateCcw, Pause
} from 'lucide-react';

function Sidebar({
    currentView,
    onViewChange,
    isCollapsed,
    onToggleCollapse,
    mobileOpen,
    onMobileClose,
    eventState,
    onStartEvent,
    onStopEvent,
    onPauseEvent,
    onResumeEvent,
    onExportResults,
    onResetAll
}) {
    const menuItems = [
        { id: 'teams', label: 'Teams', icon: Users },
        { id: 'rounds', label: 'Rounds', icon: Layers },
        { id: 'import', label: 'Import Excel', icon: Upload },
        { id: 'scoring', label: 'Live Scoring', icon: Play },
        { id: 'audience', label: 'Audience', icon: Monitor },
        { id: 'settings', label: 'Settings', icon: Settings }
    ];

    // ⭐ Boolean-safe checks for MySQL tinyint values
    const isStarted = Boolean(eventState?.is_started);
    const isPaused = Boolean(eventState?.is_paused);
    const isLive = isStarted && !isPaused;

    return (
        <>
            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
                    onClick={onMobileClose}
                />
            )}

            <aside
                className={`fixed top-0 left-0 h-screen bg-quiz-secondary border-r border-quiz-border z-50 flex flex-col transition-all duration-300 ${isCollapsed ? 'lg:w-20' : 'lg:w-64'
                    } w-72 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                    }`}
            >
                {/* Header with single toggle */}
                <div className={`flex items-center border-b border-quiz-border h-14 md:h-16 px-3 md:px-4 flex-shrink-0 ${isCollapsed ? 'lg:justify-center' : 'justify-between'
                    }`}>
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-quiz-gold flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-black text-sm">EQ</span>
                        </div>
                        <h1 className={`text-lg md:text-xl font-bold text-quiz-gold whitespace-nowrap ${isCollapsed ? 'lg:hidden' : ''
                            }`}>
                            Ex-Quiz-It
                        </h1>
                    </div>

                    <button
                        onClick={onMobileClose}
                        className="lg:hidden p-2 text-quiz-muted hover:text-quiz-text transition"
                        aria-label="Close menu"
                    >
                        <X size={20} />
                    </button>

                    <button
                        onClick={onToggleCollapse}
                        className="hidden lg:flex p-1.5 rounded-lg hover:bg-quiz-accent text-quiz-muted hover:text-quiz-gold transition"
                        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                    </button>
                </div>

                {/* Nav items */}
                <nav className="flex-1 overflow-y-auto py-3 md:py-4">
                    <ul className="space-y-1 px-2 md:px-3">
                        {menuItems.map(item => {
                            const Icon = item.icon;
                            const isActive = currentView === item.id;
                            return (
                                <li key={item.id}>
                                    <button
                                        onClick={() => onViewChange(item.id)}
                                        title={isCollapsed ? item.label : ''}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 md:py-3 rounded-lg transition ${isActive
                                                ? 'bg-quiz-gold text-white shadow-lg shadow-quiz-gold/30'
                                                : 'text-quiz-muted hover:text-quiz-text hover:bg-quiz-accent'
                                            } ${isCollapsed ? 'lg:justify-center' : ''}`}
                                    >
                                        <Icon size={20} className="flex-shrink-0" />
                                        <span className={`font-medium text-sm md:text-base truncate ${isCollapsed ? 'lg:hidden' : ''
                                            }`}>
                                            {item.label}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                {/* Bottom controls */}
                <div className="border-t border-quiz-border p-2 md:p-3 space-y-1.5 md:space-y-2 flex-shrink-0">
                    {/* ⭐ LIVE badge — uses Boolean-safe check */}
                    {isLive && (
                        <div className="flex items-center justify-center px-3 py-2 bg-green-900/30 border border-green-700 rounded-lg">
                            <span className="text-xs font-bold text-green-400 uppercase tracking-wider">
                                ● LIVE
                            </span>
                        </div>
                    )}

                    {/* ⭐ PAUSED badge — uses Boolean-safe check */}
                    {isPaused && (
                        <div className="flex items-center justify-center px-3 py-2 bg-yellow-900/30 border border-yellow-700 rounded-lg">
                            <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">
                                ⏸ PAUSED
                            </span>
                        </div>
                    )}

                    {/* Start Event — when not started */}
                    {!isStarted ? (
                        <button
                            onClick={onStartEvent}
                            title={isCollapsed ? 'Start Event' : ''}
                            className={`w-full flex items-center gap-2 px-3 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-semibold text-sm ${isCollapsed ? 'lg:justify-center' : ''
                                }`}
                        >
                            <Play size={18} className="flex-shrink-0" />
                            <span className={isCollapsed ? 'lg:hidden' : ''}>Start Event</span>
                        </button>
                    ) : (
                        <>
                            {/* Pause / Resume */}
                            {!isPaused ? (
                                <button
                                    onClick={onPauseEvent}
                                    title={isCollapsed ? 'Pause Event' : ''}
                                    className={`w-full flex items-center gap-2 px-3 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition font-semibold text-sm ${isCollapsed ? 'lg:justify-center' : ''
                                        }`}
                                >
                                    <Pause size={18} className="flex-shrink-0" />
                                    <span className={isCollapsed ? 'lg:hidden' : ''}>Pause</span>
                                </button>
                            ) : (
                                <button
                                    onClick={onResumeEvent}
                                    title={isCollapsed ? 'Resume Event' : ''}
                                    className={`w-full flex items-center gap-2 px-3 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-semibold text-sm ${isCollapsed ? 'lg:justify-center' : ''
                                        }`}
                                >
                                    <Play size={18} className="flex-shrink-0" />
                                    <span className={isCollapsed ? 'lg:hidden' : ''}>Resume</span>
                                </button>
                            )}

                            {/* Stop Event */}
                            <button
                                onClick={onStopEvent}
                                title={isCollapsed ? 'Stop Event' : ''}
                                className={`w-full flex items-center gap-2 px-3 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition font-semibold text-sm ${isCollapsed ? 'lg:justify-center' : ''
                                    }`}
                            >
                                <Power size={18} className="flex-shrink-0" />
                                <span className={isCollapsed ? 'lg:hidden' : ''}>Stop Event</span>
                            </button>
                        </>
                    )}

                    {/* Export Results */}
                    <button
                        onClick={onExportResults}
                        title={isCollapsed ? 'Export Results' : ''}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-semibold text-sm ${isCollapsed ? 'lg:justify-center' : ''
                            }`}
                    >
                        <Download size={18} className="flex-shrink-0" />
                        <span className={isCollapsed ? 'lg:hidden' : ''}>Export Results</span>
                    </button>

                    {/* Reset All */}
                    <button
                        onClick={onResetAll}
                        title={isCollapsed ? 'Reset All' : ''}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-600/40 rounded-lg transition font-semibold text-sm ${isCollapsed ? 'lg:justify-center' : ''
                            }`}
                    >
                        <RotateCcw size={18} className="flex-shrink-0" />
                        <span className={isCollapsed ? 'lg:hidden' : ''}>Reset All</span>
                    </button>
                </div>
            </aside>
        </>
    );
}

export default Sidebar;