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
        { id: 'live', label: 'Live View', icon: Monitor },
        { id: 'scoring', label: 'Scoring', icon: Play },
        { id: 'audience', label: 'Audience', icon: Monitor },
        { id: 'settings', label: 'Settings', icon: Settings }
    ];

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
                className={`fixed top-0 left-0 h-screen bg-quiz-secondary border-r border-quiz-border z-50 flex flex-col transition-all duration-300 ${isCollapsed ? 'lg:w-[72px]' : 'lg:w-64'
                    } w-72 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                    }`}
            >
                {/* ⭐ Header with logo */}
                <div className={`flex items-center border-b border-quiz-border h-16 md:h-20 flex-shrink-0 ${isCollapsed ? 'lg:justify-center px-2' : 'justify-between px-3 md:px-4'
                    }`}>
                    {/* Logo — hidden when collapsed on desktop */}
                    <img
                        src="/brand/EX-QUIZ-IT.png"
                        alt="Ex-Quiz-It"
                        className={`object-contain transition-all ${isCollapsed ? 'lg:hidden' : 'h-10 md:h-12 w-auto'
                            }`}
                    />

                    {/* Collapsed header — show only expand button */}
                    {isCollapsed && (
                        <button
                            onClick={onToggleCollapse}
                            className="hidden lg:flex items-center justify-center w-12 h-12 rounded-xl hover:bg-quiz-accent text-quiz-muted hover:text-quiz-gold transition"
                            title="Expand sidebar"
                        >
                            <ChevronRight size={22} />
                        </button>
                    )}

                    <button
                        onClick={onMobileClose}
                        className="lg:hidden p-2 text-quiz-muted hover:text-quiz-text transition"
                        aria-label="Close menu"
                    >
                        <X size={20} />
                    </button>

                    {!isCollapsed && (
                        <button
                            onClick={onToggleCollapse}
                            className="hidden lg:flex p-1.5 rounded-lg hover:bg-quiz-accent text-quiz-muted hover:text-quiz-gold transition"
                            title="Collapse sidebar"
                        >
                            <ChevronLeft size={18} />
                        </button>
                    )}
                </div>

                {/* ⭐ Nav items */}
                <nav className="flex-1 overflow-y-auto py-3 md:py-4">
                    <ul className={`space-y-1 ${isCollapsed ? 'lg:px-2 lg:space-y-2' : 'px-2 md:px-3'}`}>
                        {menuItems.map(item => {
                            const Icon = item.icon;
                            const isActive = currentView === item.id;
                            return (
                                <li key={item.id}>
                                    <button
                                        onClick={() => onViewChange(item.id)}
                                        title={isCollapsed ? item.label : ''}
                                        className={`w-full flex items-center rounded-xl transition ${isActive
                                                ? 'bg-quiz-gold text-white shadow-lg shadow-quiz-gold/30'
                                                : 'text-quiz-muted hover:text-quiz-text hover:bg-quiz-accent'
                                            } ${isCollapsed
                                                ? 'lg:justify-center lg:w-12 lg:h-12 lg:mx-auto lg:p-0 p-3 gap-3'
                                                : 'gap-3 px-3 py-2.5 md:py-3'
                                            }`}
                                    >
                                        <Icon
                                            size={isCollapsed ? 24 : 20}
                                            className="flex-shrink-0"
                                            strokeWidth={isCollapsed ? 2.2 : 2}
                                        />
                                        <span className={`font-medium text-sm md:text-base truncate ${isCollapsed ? 'lg:hidden' : ''}`}>
                                            {item.label}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                {/* ⭐ Bottom controls */}
                <div className={`border-t border-quiz-border flex-shrink-0 ${isCollapsed ? 'lg:p-2 lg:space-y-2 p-2 md:p-3 space-y-1.5 md:space-y-2' : 'p-2 md:p-3 space-y-1.5 md:space-y-2'
                    }`}>

                    {/* LIVE badge — hidden when collapsed */}
                    {isLive && (
                        <div className={`flex items-center justify-center rounded-lg bg-green-500/20 border border-green-500 ${isCollapsed ? 'lg:hidden px-3 py-2' : 'px-3 py-2'
                            }`}>
                            <span className="text-xs font-bold text-green-600 uppercase tracking-wider">
                                ● LIVE
                            </span>
                        </div>
                    )}

                    {/* PAUSED badge — hidden when collapsed */}
                    {isPaused && (
                        <div className={`flex items-center justify-center rounded-lg bg-yellow-500/20 border border-yellow-500 ${isCollapsed ? 'lg:hidden px-3 py-2' : 'px-3 py-2'
                            }`}>
                            <span className="text-xs font-bold text-yellow-600 uppercase tracking-wider">
                                ⏸ PAUSED
                            </span>
                        </div>
                    )}

                    {/* Start Event */}
                    {!isStarted ? (
                        <button
                            onClick={onStartEvent}
                            title={isCollapsed ? 'Start Event' : ''}
                            className={`w-full flex items-center rounded-xl bg-green-600 hover:bg-green-700 text-white transition font-semibold ${isCollapsed
                                    ? 'lg:justify-center lg:w-12 lg:h-12 lg:mx-auto lg:p-0 p-3 gap-2 text-sm'
                                    : 'gap-2 px-3 py-2.5 text-sm'
                                }`}
                        >
                            <Play size={isCollapsed ? 22 : 18} className="flex-shrink-0" />
                            <span className={`${isCollapsed ? 'lg:hidden' : ''}`}>Start Event</span>
                        </button>
                    ) : (
                        <>
                            {/* Pause / Resume */}
                            {!isPaused ? (
                                <button
                                    onClick={onPauseEvent}
                                    title={isCollapsed ? 'Pause Event' : ''}
                                    className={`w-full flex items-center rounded-xl bg-yellow-600 hover:bg-yellow-700 text-white transition font-semibold ${isCollapsed
                                            ? 'lg:justify-center lg:w-12 lg:h-12 lg:mx-auto lg:p-0 p-3 gap-2 text-sm'
                                            : 'gap-2 px-3 py-2.5 text-sm'
                                        }`}
                                >
                                    <Pause size={isCollapsed ? 22 : 18} className="flex-shrink-0" />
                                    <span className={`${isCollapsed ? 'lg:hidden' : ''}`}>Pause</span>
                                </button>
                            ) : (
                                <button
                                    onClick={onResumeEvent}
                                    title={isCollapsed ? 'Resume Event' : ''}
                                    className={`w-full flex items-center rounded-xl bg-green-600 hover:bg-green-700 text-white transition font-semibold ${isCollapsed
                                            ? 'lg:justify-center lg:w-12 lg:h-12 lg:mx-auto lg:p-0 p-3 gap-2 text-sm'
                                            : 'gap-2 px-3 py-2.5 text-sm'
                                        }`}
                                >
                                    <Play size={isCollapsed ? 22 : 18} className="flex-shrink-0" />
                                    <span className={`${isCollapsed ? 'lg:hidden' : ''}`}>Resume</span>
                                </button>
                            )}

                            {/* Stop Event */}
                            <button
                                onClick={onStopEvent}
                                title={isCollapsed ? 'Stop Event' : ''}
                                className={`w-full flex items-center rounded-xl bg-orange-600 hover:bg-orange-700 text-white transition font-semibold ${isCollapsed
                                        ? 'lg:justify-center lg:w-12 lg:h-12 lg:mx-auto lg:p-0 p-3 gap-2 text-sm'
                                        : 'gap-2 px-3 py-2.5 text-sm'
                                    }`}
                            >
                                <Power size={isCollapsed ? 22 : 18} className="flex-shrink-0" />
                                <span className={`${isCollapsed ? 'lg:hidden' : ''}`}>Stop Event</span>
                            </button>
                        </>
                    )}

                    {/* Export Results */}
                    <button
                        onClick={onExportResults}
                        title={isCollapsed ? 'Export Results' : ''}
                        className={`w-full flex items-center rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition font-semibold ${isCollapsed
                                ? 'lg:justify-center lg:w-12 lg:h-12 lg:mx-auto lg:p-0 p-3 gap-2 text-sm'
                                : 'gap-2 px-3 py-2.5 text-sm'
                            }`}
                    >
                        <Download size={isCollapsed ? 22 : 18} className="flex-shrink-0" />
                        <span className={`${isCollapsed ? 'lg:hidden' : ''}`}>Export Results</span>
                    </button>

                    {/* Reset All */}
                    <button
                        onClick={onResetAll}
                        title={isCollapsed ? 'Reset All' : ''}
                        className={`w-full flex items-center rounded-xl bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-600/40 transition font-semibold ${isCollapsed
                                ? 'lg:justify-center lg:w-12 lg:h-12 lg:mx-auto lg:p-0 p-3 gap-2 text-sm'
                                : 'gap-2 px-3 py-2.5 text-sm'
                            }`}
                    >
                        <RotateCcw size={isCollapsed ? 22 : 18} className="flex-shrink-0" />
                        <span className={`${isCollapsed ? 'lg:hidden' : ''}`}>Reset All</span>
                    </button>
                </div>
            </aside>
        </>
    );
}

export default Sidebar;