import React, { useState } from 'react';
import { Download, FileSpreadsheet, Award, History, CheckCircle, Loader, AlertCircle } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function ResultsExport({ eventId = 1, eventState, onClose }) {
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState(null);

    // ============ DOWNLOAD FULL RESULTS ============
    const handleDownload = async () => {
        try {
            setDownloading(true);
            setError(null);

            const res = await axios.get(`${API_URL}/import/export-results/${eventId}`, {
                responseType: 'blob',
                timeout: 60000
            });

            // Create download
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
            const filename = `${(eventState?.name || 'ex-quiz-it').replace(/\s+/g, '-')}_results_${timestamp}.xlsx`;

            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

        } catch (e) {
            console.error('Export error:', e);
            setError(e.response?.data?.error || e.message || 'Export failed');
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-quiz-secondary rounded-xl border border-quiz-border w-full max-w-lg overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-quiz-gold/20 to-transparent px-6 py-5 border-b border-quiz-border">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-quiz-gold flex items-center justify-center flex-shrink-0">
                            <FileSpreadsheet size={28} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-quiz-text">
                                Export Results
                            </h2>
                            <p className="text-sm text-quiz-muted mt-0.5">
                                Download the complete scorecard
                            </p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    {/* What's Included */}
                    <div>
                        <p className="text-xs uppercase tracking-widest text-quiz-muted font-bold mb-3">
                            What's included
                        </p>
                        <div className="space-y-2">
                            <InfoRow
                                icon={<Award size={18} className="text-yellow-500" />}
                                title="Final Rankings"
                                description="Rank, team, institution, total score, counts"
                            />
                            <InfoRow
                                icon={<History size={18} className="text-blue-500" />}
                                title="Complete Score History"
                                description="Every scoring action with timestamp"
                            />
                        </div>
                    </div>

                    {/* Event Info */}
                    {eventState && (
                        <div className="bg-quiz-primary rounded-lg p-4 border border-quiz-border">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <p className="text-quiz-muted text-xs uppercase">Event</p>
                                    <p className="font-bold text-quiz-text truncate">
                                        {eventState.name || '—'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-quiz-muted text-xs uppercase">Teams</p>
                                    <p className="font-bold text-quiz-text">
                                        {eventState.total_teams || 0}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-quiz-muted text-xs uppercase">Rounds</p>
                                    <p className="font-bold text-quiz-text">
                                        {eventState.total_questions ? '✓' : '—'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-quiz-muted text-xs uppercase">Status</p>
                                    <p className={`font-bold ${eventState.is_started ? 'text-green-400' : 'text-yellow-400'}`}>
                                        {eventState.is_started ? 'LIVE' : 'Not Started'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Warning */}
                    {eventState?.is_started && (
                        <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-lg p-3 flex gap-2">
                            <AlertCircle size={16} className="text-yellow-500 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-yellow-400">
                                The event is still live. Consider stopping it before exporting for a cleaner final result.
                            </p>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-3 flex gap-2">
                            <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-red-400">{error}</p>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="px-6 py-4 border-t border-quiz-border flex gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-quiz-accent text-quiz-text border border-quiz-border rounded-lg font-semibold hover:border-quiz-gold transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleDownload}
                        disabled={downloading}
                        className="flex-1 py-2.5 bg-quiz-gold hover:opacity-80 text-white rounded-lg font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {downloading ? (
                            <>
                                <Loader size={18} className="animate-spin" />
                                Downloading...
                            </>
                        ) : (
                            <>
                                <Download size={18} />
                                Download Excel File
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ============ HELPER ============
function InfoRow({ icon, title, description }) {
    return (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-quiz-primary border border-quiz-border">
            <div className="flex-shrink-0 mt-0.5">{icon}</div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-quiz-text">{title}</p>
                <p className="text-xs text-quiz-muted mt-0.5">{description}</p>
            </div>
            <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
        </div>
    );
}

export default ResultsExport;