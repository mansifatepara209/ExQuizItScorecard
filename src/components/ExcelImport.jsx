import React, { useState } from 'react';
import {
    Upload, Download, CheckCircle, AlertCircle, FileSpreadsheet,
    Loader, X, Users, Layers, Settings as SettingsIcon,
    ArrowRight, RefreshCw, Trash2
} from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function ExcelImport({ eventId = 1, onImportComplete }) {
    const [file, setFile] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [preview, setPreview] = useState(null);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [dragActive, setDragActive] = useState(false);

    const handleFileChange = (e) => {
        const f = e.target.files[0];
        if (f) { setFile(f); resetState(); }
    };

    const handleDrag = (e) => {
        e.preventDefault(); e.stopPropagation();
        setDragActive(e.type === 'dragenter' || e.type === 'dragover');
    };

    const handleDrop = (e) => {
        e.preventDefault(); e.stopPropagation();
        setDragActive(false);
        const f = e.dataTransfer.files[0];
        if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) {
            setFile(f); resetState();
        } else {
            setError('Please upload .xlsx or .xls file');
        }
    };

    const resetState = () => { setPreview(null); setResult(null); setError(null); };
    const resetAll = () => { setFile(null); resetState(); };

    const handlePreview = async () => {
        if (!file) { setError('Please select a file'); return; }
        const fd = new FormData();
        fd.append('file', file);
        try {
            setPreviewLoading(true);
            setError(null);
            const res = await axios.post(`${API_URL}/import/preview/${eventId}`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000
            });
            setPreview(res.data.preview);
        } catch (e) {
            setError(e.response?.data?.error || e.message);
        } finally { setPreviewLoading(false); }
    };

    const handleConfirmImport = async () => {
        if (!file) return;
        const fd = new FormData();
        fd.append('file', file);
        try {
            setImporting(true);
            setError(null);
            const res = await axios.post(`${API_URL}/import/full/${eventId}`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000
            });
            setResult(res.data);
            if (onImportComplete) onImportComplete(res.data);
        } catch (e) {
            setError(e.response?.data?.error || e.message);
        } finally { setImporting(false); }
    };

    const downloadTemplate = async () => {
        try {
            const res = await axios.get(`${API_URL}/import/template`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url; a.download = 'ex-quiz-it-template.xlsx'; a.click();
        } catch (e) { setError('Template download failed'); }
    };

    // ========== SUCCESS ==========
    if (result) {
        const s = result.summary || {};
        const r = result.results || {};
        return (
            <div className="space-y-4 md:space-y-6">
                <div className="bg-gradient-to-r from-green-900/40 to-green-800/20 border-2 border-green-600 rounded-xl p-5 md:p-8 text-center">
                    <div className="flex justify-center mb-3 md:mb-4">
                        <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-green-600 flex items-center justify-center animate-pulse">
                            <CheckCircle size={40} className="md:w-12 md:h-12 text-white" />
                        </div>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-green-400 mb-2">✅ Import Successful!</h2>
                    <p className="text-sm md:text-lg text-quiz-text">All data replaced successfully.</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    <SummaryCard icon={<Users size={22} className="md:w-7 md:h-7 text-blue-500" />} label="Teams" value={s.teamsImported || 0} border="border-blue-500" />
                    <SummaryCard icon={<Layers size={22} className="md:w-7 md:h-7 text-purple-500" />} label="Rounds" value={s.roundsImported || 0} border="border-purple-500" />
                    <SummaryCard icon={<SettingsIcon size={22} className="md:w-7 md:h-7 text-yellow-500" />} label="Settings" value={s.settingsUpdated || 0} border="border-yellow-500" />
                    <SummaryCard icon={<AlertCircle size={22} className="md:w-7 md:h-7 text-red-500" />} label="Errors" value={s.errorsCount || 0} border="border-red-500" />
                </div>

                {r.teams?.length > 0 && (
                    <DetailCard title="👥 Teams" count={r.teams.length} color="text-blue-400">
                        {r.teams.map((t, i) => (
                            <div key={i} className="flex justify-between py-1.5 text-xs md:text-sm border-b border-quiz-border/50 last:border-0 gap-2">
                                <span className="text-quiz-text truncate">
                                    <strong>{t.teamName}</strong>
                                    <span className="text-quiz-muted ml-1">({t.shortName})</span>
                                </span>
                                <span className="text-quiz-muted flex-shrink-0 text-xs">{t.members} mem</span>
                            </div>
                        ))}
                    </DetailCard>
                )}

                {r.rounds?.length > 0 && (
                    <DetailCard title="🔁 Rounds" count={r.rounds.length} color="text-purple-400">
                        {r.rounds.map((rd, i) => (
                            <div key={i} className="flex justify-between py-1.5 text-xs md:text-sm border-b border-quiz-border/50 last:border-0 gap-2">
                                <span className="text-quiz-text truncate font-semibold">{rd.roundName}</span>
                                <div className="flex gap-1 flex-shrink-0">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${rd.type === 'buzzer' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                                        }`}>{rd.type}</span>
                                </div>
                            </div>
                        ))}
                    </DetailCard>
                )}

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <button onClick={resetAll} className="w-full sm:flex-1 py-2.5 md:py-3 bg-quiz-accent text-quiz-text border border-quiz-border rounded-lg font-semibold hover:border-quiz-gold transition text-sm md:text-base">
                        Import Another File
                    </button>
                    <button onClick={() => onImportComplete && onImportComplete()} className="w-full sm:flex-1 py-2.5 md:py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 text-sm md:text-base transition">
                        <RefreshCw size={18} /> Go to Teams
                    </button>
                </div>
            </div>
        );
    }

    // ========== PREVIEW ==========
    if (preview) {
        return (
            <div className="space-y-4 md:space-y-6">
                <div className="bg-red-500/10 border-2 border-red-500/50 rounded-xl p-4 md:p-5 flex flex-col sm:flex-row items-start gap-3 md:gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                        <Trash2 size={20} className="md:w-6 md:h-6 text-red-500" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-base md:text-lg font-bold text-red-400 mb-1">⚠️ This will REPLACE all existing data</h3>
                        <p className="text-xs md:text-sm text-quiz-muted">
                            All current teams, rounds, and scores will be deleted and replaced.
                        </p>
                    </div>
                </div>

                <div className="bg-quiz-secondary border border-quiz-border rounded-lg p-3 md:p-4 flex justify-between items-center gap-3">
                    <div className="flex gap-3 items-center min-w-0">
                        <FileSpreadsheet className="text-green-500 flex-shrink-0" size={24} />
                        <div className="min-w-0">
                            <p className="font-semibold text-quiz-text text-sm md:text-base truncate">{file.name}</p>
                            <p className="text-xs text-quiz-muted">{(file.size / 1024).toFixed(2)} KB</p>
                        </div>
                    </div>
                    <button onClick={resetAll} className="p-2 text-red-500 hover:text-red-400 transition flex-shrink-0">
                        <X size={18} />
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
                    <PreviewCard icon={<Users size={18} />} title="Teams" count={preview.teams?.length || 0} color="text-blue-400" borderColor="border-blue-500/40">
                        {preview.teams?.length > 0 ? (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {preview.teams.map((t, i) => (
                                    <div key={i} className="bg-quiz-primary/50 rounded p-2 text-xs">
                                        <p className="font-bold text-quiz-text truncate">
                                            {t.teamOrder && <span className="text-quiz-muted">#{t.teamOrder} </span>}
                                            {t.teamName}
                                        </p>
                                        <p className="text-quiz-muted truncate">({t.shortName})</p>
                                    </div>
                                ))}
                            </div>
                        ) : <Empty text="No teams found" />}
                    </PreviewCard>

                    <PreviewCard icon={<Layers size={18} />} title="Rounds" count={preview.rounds?.length || 0} color="text-purple-400" borderColor="border-purple-500/40">
                        {preview.rounds?.length > 0 ? (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {preview.rounds.map((r, i) => (
                                    <div key={i} className="bg-quiz-primary/50 rounded p-2 text-xs">
                                        <p className="font-bold text-quiz-text truncate">{r.roundName}</p>
                                        <div className="flex gap-1 mt-1 flex-wrap">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${r.type === 'buzzer' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                                                }`}>{r.type}</span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-quiz-accent text-quiz-muted">{r.questions} Q</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : <Empty text="No rounds found" />}
                    </PreviewCard>

                    <PreviewCard icon={<SettingsIcon size={18} />} title="Settings" count={preview.settings?.eventName ? 1 : 0} color="text-yellow-400" borderColor="border-yellow-500/40">
                        {preview.settings && Object.keys(preview.settings).length > 0 ? (
                            <div className="space-y-2 text-xs">
                                {preview.settings.eventName && (
                                    <div className="bg-quiz-primary/50 rounded p-2">
                                        <p className="text-quiz-muted text-[10px] uppercase">Event</p>
                                        <p className="font-bold text-quiz-text truncate">{preview.settings.eventName}</p>
                                    </div>
                                )}
                                {preview.settings.penaltyPoints !== undefined && (
                                    <div className="bg-quiz-primary/50 rounded p-2">
                                        <p className="text-quiz-muted text-[10px] uppercase">Penalty</p>
                                        <p className="font-bold text-red-400">{preview.settings.penaltyPoints}</p>
                                    </div>
                                )}
                            </div>
                        ) : <Empty text="No settings found" />}
                    </PreviewCard>
                </div>

                {error && (
                    <div className="p-3 md:p-4 bg-red-500/10 border border-red-500/40 rounded-lg flex gap-2 items-start">
                        <AlertCircle className="text-red-500 flex-shrink-0" size={18} />
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                )}

                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                    <button onClick={resetAll} disabled={importing}
                        className="w-full sm:w-auto px-6 py-2.5 md:py-3 bg-quiz-accent text-quiz-text border border-quiz-border rounded-lg font-semibold hover:border-quiz-gold transition disabled:opacity-50 text-sm md:text-base">
                        Cancel
                    </button>
                    <button onClick={handleConfirmImport} disabled={importing}
                        className="w-full sm:flex-1 py-2.5 md:py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 text-sm md:text-base transition">
                        {importing ? <><Loader size={18} className="animate-spin" /> Importing...</> : <><Trash2 size={18} /> Confirm & Replace</>}
                    </button>
                </div>
            </div>
        );
    }

    // ========== UPLOAD ==========
    return (
        <div className="bg-quiz-secondary p-4 md:p-6 rounded-lg border border-quiz-border">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-5 md:mb-6">
                <div>
                    <h2 className="text-xl md:text-2xl font-bold text-quiz-gold flex items-center gap-2">
                        <FileSpreadsheet size={22} md:size={28} /> Import Excel File
                    </h2>
                    <p className="text-xs md:text-sm text-quiz-muted mt-1">Upload your Excel file</p>
                </div>
                <button onClick={downloadTemplate}
                    className="px-3 md:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 font-semibold text-sm transition">
                    <Download size={16} md:size={18} /> Download Template
                </button>
            </div>

            {!file ? (
                <div
                    className={`border-2 border-dashed rounded-xl p-6 md:p-12 text-center transition ${dragActive ? 'border-quiz-gold bg-quiz-accent/50' : 'border-quiz-border hover:border-quiz-gold/60'
                        }`}
                    onDragEnter={handleDrag} onDragLeave={handleDrag}
                    onDragOver={handleDrag} onDrop={handleDrop}
                >
                    <Upload className="mx-auto mb-3 md:mb-4 text-quiz-muted" size={40} md:size={64} />
                    <p className="text-base md:text-xl font-semibold text-quiz-text mb-1 md:mb-2">
                        Drag & drop your Excel file here
                    </p>
                    <p className="text-xs md:text-sm text-quiz-muted mb-4 md:mb-6">Supports .xlsx, .xls files</p>
                    <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" id="file-input" />
                    <label htmlFor="file-input" className="px-6 md:px-8 py-2.5 md:py-3 bg-quiz-gold hover:opacity-80 text-white rounded-lg cursor-pointer inline-block font-semibold text-sm md:text-base transition">
                        Select File
                    </label>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="p-3 md:p-4 bg-quiz-primary border border-quiz-border rounded-lg flex justify-between items-center gap-3">
                        <div className="flex gap-3 items-center min-w-0">
                            <FileSpreadsheet className="text-green-500 flex-shrink-0" size={24} />
                            <div className="min-w-0">
                                <p className="font-semibold text-quiz-text text-sm md:text-base truncate">{file.name}</p>
                                <p className="text-xs text-quiz-muted">{(file.size / 1024).toFixed(2)} KB</p>
                            </div>
                        </div>
                        <button onClick={resetAll} className="p-2 text-red-500 hover:text-red-400 transition flex-shrink-0">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 md:p-4">
                        <p className="text-xs md:text-sm text-blue-400 font-semibold mb-1">📋 Next Step: Preview</p>
                        <p className="text-[11px] md:text-xs text-quiz-muted">
                            Click below to preview what will be imported before confirming.
                        </p>
                    </div>

                    {error && (
                        <div className="p-3 md:p-4 bg-red-500/10 border border-red-500/40 rounded-lg flex gap-2 items-start">
                            <AlertCircle className="text-red-500 flex-shrink-0" size={18} />
                            <p className="text-red-400 text-sm">{error}</p>
                        </div>
                    )}

                    <button onClick={handlePreview} disabled={previewLoading}
                        className="w-full py-3 md:py-4 bg-quiz-gold hover:opacity-80 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 text-base md:text-lg transition">
                        {previewLoading ? <><Loader className="animate-spin" size={22} /> Loading...</> : <><ArrowRight size={22} /> Preview Import</>}
                    </button>
                </div>
            )}

            <div className="mt-5 md:mt-6 p-3 md:p-4 bg-quiz-primary rounded-lg border border-quiz-border">
                <h3 className="text-xs md:text-sm font-bold text-quiz-gold mb-2 md:mb-3">📝 Excel Format</h3>
                <div className="space-y-1.5 text-[11px] md:text-xs text-quiz-muted">
                    <p><strong className="text-quiz-text">Teams:</strong> Team Order, Team Name, Short Name, Institution, Members</p>
                    <p><strong className="text-quiz-text">Rounds:</strong> Round Order, Round Name, Type, Difficulty, Questions, + Points</p>
                    <p><strong className="text-quiz-text">Settings:</strong> Penalty Points, Tie Break Rule, Event Name</p>
                </div>
            </div>
        </div>
    );
}

function SummaryCard({ icon, label, value, border }) {
    return (
        <div className={`bg-quiz-secondary p-3 md:p-5 rounded-lg border-2 ${border}`}>
            <div className="flex items-center justify-between mb-1 md:mb-2">
                <span className="text-[10px] md:text-xs text-quiz-muted uppercase tracking-wider font-semibold truncate">
                    {label}
                </span>
                {icon}
            </div>
            <p className="text-2xl md:text-3xl font-bold text-quiz-text">{value}</p>
        </div>
    );
}

function DetailCard({ title, count, color, children }) {
    return (
        <div className="bg-quiz-secondary rounded-lg border border-quiz-border overflow-hidden">
            <div className="px-3 md:px-4 py-2.5 md:py-3 border-b border-quiz-border flex items-center justify-between">
                <h3 className={`font-bold text-sm md:text-base ${color}`}>{title}</h3>
                <span className="text-xs text-quiz-muted">{count} items</span>
            </div>
            <div className="p-3 md:p-4 max-h-60 overflow-y-auto">{children}</div>
        </div>
    );
}

function PreviewCard({ icon, title, count, color, borderColor, children }) {
    return (
        <div className={`bg-quiz-secondary rounded-lg border ${borderColor} overflow-hidden`}>
            <div className="px-3 md:px-4 py-2.5 md:py-3 border-b border-quiz-border flex items-center justify-between">
                <div className={`flex items-center gap-2 font-bold text-sm md:text-base ${color}`}>
                    {icon}<span>{title}</span>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${count > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>{count}</span>
            </div>
            <div className="p-2.5 md:p-3">{children}</div>
        </div>
    );
}

function Empty({ text }) {
    return <p className="text-xs text-quiz-muted text-center py-4">{text}</p>;
}

export default ExcelImport;