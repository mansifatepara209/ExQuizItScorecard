import React, { useState } from 'react';
import { Upload, Download, CheckCircle, AlertCircle, FileSpreadsheet, Loader, X } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function ExcelImport({ eventId = 1, onImportComplete }) {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [importedData, setImportedData] = useState(null);
    const [error, setError] = useState(null);
    const [dragActive, setDragActive] = useState(false);

    const handleFileChange = (e) => {
        const f = e.target.files[0];
        if (f) { setFile(f); setError(null); setSuccess(false); }
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
            setFile(f); setError(null); setSuccess(false);
        } else {
            setError('Please upload .xlsx or .xls file');
        }
    };

    const handleImport = async () => {
        if (!file) { setError('Please select a file'); return; }

        const fd = new FormData();
        fd.append('file', file);

        try {
            setLoading(true);
            setError(null);
            const res = await axios.post(`${API_URL}/import/full/${eventId}`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 60000
            });
            setImportedData(res.data);
            setSuccess(true);
            if (onImportComplete) onImportComplete(res.data);
        } catch (e) {
            let msg = 'Import failed';
            if (e.response?.data?.error) msg = e.response.data.error;
            else if (e.message) msg = e.message;
            setError(msg);
            setSuccess(false);
        } finally {
            setLoading(false);
        }
    };

    const downloadTemplate = async () => {
        try {
            const res = await axios.get(`${API_URL}/import/template`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = 'ex-quiz-it-template.xlsx';
            a.click();
        } catch (e) { setError('Template download failed'); }
    };

    const reset = () => {
        setFile(null);
        setSuccess(false);
        setImportedData(null);
        setError(null);
    };

    if (success && importedData) {
        const s = importedData.summary || {};
        const r = importedData.results || {};

        return (
            <div className="bg-quiz-secondary p-8 rounded-lg text-center border border-quiz-border">
                <div className="flex justify-center mb-6">
                    <div className="w-24 h-24 rounded-full bg-green-600 flex items-center justify-center animate-pulse">
                        <CheckCircle size={64} className="text-white" />
                    </div>
                </div>

                <h2 className="text-4xl font-bold text-green-500 mb-4">✅ Import Successful!</h2>
                <p className="text-xl text-quiz-text mb-8">Data has been added to your event successfully</p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-quiz-primary p-4 rounded-lg border border-quiz-border">
                        <p className="text-blue-400 text-sm mb-1">Teams</p>
                        <p className="text-3xl font-bold text-quiz-text">{s.teamsImported || 0}</p>
                    </div>
                    <div className="bg-quiz-primary p-4 rounded-lg border border-quiz-border">
                        <p className="text-purple-400 text-sm mb-1">Rounds</p>
                        <p className="text-3xl font-bold text-quiz-text">{s.roundsImported || 0}</p>
                    </div>
                    <div className="bg-quiz-primary p-4 rounded-lg border border-quiz-border">
                        <p className="text-yellow-400 text-sm mb-1">Settings</p>
                        <p className="text-3xl font-bold text-quiz-text">{s.settingsUpdated || 0}</p>
                    </div>
                    <div className="bg-quiz-primary p-4 rounded-lg border border-quiz-border">
                        <p className="text-red-400 text-sm mb-1">Errors</p>
                        <p className="text-3xl font-bold text-quiz-text">{s.errorsCount || 0}</p>
                    </div>
                </div>

                {r.teams?.length > 0 && (
                    <div className="bg-quiz-primary p-4 rounded-lg mb-4 text-left border border-quiz-border">
                        <p className="font-semibold text-quiz-gold mb-2">👥 Teams Added ({r.teams.length})</p>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                            {r.teams.map((t, i) => (
                                <div key={i} className="text-sm text-quiz-muted">• {t.teamName} ({t.members} members)</div>
                            ))}
                        </div>
                    </div>
                )}

                {r.rounds?.length > 0 && (
                    <div className="bg-quiz-primary p-4 rounded-lg mb-4 text-left border border-quiz-border">
                        <p className="font-semibold text-quiz-gold mb-2">🔁 Rounds Added ({r.rounds.length})</p>
                        <div className="space-y-1">
                            {r.rounds.map((rd, i) => (
                                <div key={i} className="text-sm text-quiz-muted">• {rd.roundName} ({rd.type}, {rd.difficulty})</div>
                            ))}
                        </div>
                    </div>
                )}

                {r.errors?.length > 0 && (
                    <div className="bg-red-900/30 border border-red-700 p-4 rounded-lg mb-4 text-left">
                        <p className="font-semibold text-red-400 mb-2">⚠️ {r.errors.length} rows had errors</p>
                        {r.errors.map((e, i) => (
                            <div key={i} className="text-sm text-red-300">• {e.sheet}: {e.error}</div>
                        ))}
                    </div>
                )}

                <div className="flex gap-4">
                    <button onClick={reset} className="flex-1 py-3 bg-quiz-gold text-white rounded-lg font-semibold hover:opacity-80">
                        Import Another File
                    </button>
                    <button
                        onClick={() => { if (onImportComplete) onImportComplete(); }}
                        className="flex-1 py-3 bg-green-600 text-white rounded-lg font-semibold hover:opacity-80"
                    >
                        Refresh App
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-quiz-secondary p-6 rounded-lg border border-quiz-border">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-quiz-gold flex items-center gap-2">
                    <FileSpreadsheet size={28} /> Import Excel File
                </h2>
                <button onClick={downloadTemplate}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:opacity-80">
                    <Download size={18} /> Download Template
                </button>
            </div>

            {!file && (
                <div
                    className={`border-2 border-dashed rounded-lg p-12 text-center ${dragActive ? 'border-quiz-gold bg-quiz-accent' : 'border-quiz-border'
                        }`}
                    onDragEnter={handleDrag} onDragLeave={handleDrag}
                    onDragOver={handleDrag} onDrop={handleDrop}
                >
                    <Upload className="mx-auto mb-4 text-quiz-muted" size={64} />
                    <p className="text-xl mb-2 text-quiz-text">Drag & drop your Excel file here</p>
                    <p className="text-sm text-quiz-muted mb-6">Supports .xlsx, .xls files</p>
                    <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" id="file-input" />
                    <label htmlFor="file-input" className="px-8 py-3 bg-quiz-gold text-white rounded-lg cursor-pointer inline-block font-semibold hover:opacity-80">
                        Select File
                    </label>
                </div>
            )}

            {file && (
                <div className="p-4 bg-quiz-primary rounded-lg flex justify-between items-center border border-quiz-border">
                    <div className="flex gap-3 items-center">
                        <FileSpreadsheet className="text-green-500" size={32} />
                        <div>
                            <p className="font-semibold text-quiz-text">{file.name}</p>
                            <p className="text-sm text-quiz-muted">{(file.size / 1024).toFixed(2)} KB</p>
                        </div>
                    </div>
                    <button onClick={reset} className="text-red-500 p-2 hover:text-red-400">
                        <X size={24} />
                    </button>
                </div>
            )}

            {error && (
                <div className="mt-4 p-4 bg-red-900/50 border border-red-700 rounded-lg flex gap-3">
                    <AlertCircle className="text-red-500" size={24} />
                    <div>
                        <p className="font-semibold text-red-400">Import Failed</p>
                        <p className="text-red-300">{error}</p>
                    </div>
                </div>
            )}

            {file && (
                <button
                    onClick={handleImport}
                    disabled={loading}
                    className="mt-6 w-full py-4 bg-quiz-gold text-white rounded-lg font-bold text-lg flex items-center justify-center gap-2 hover:opacity-80 disabled:opacity-50"
                >
                    {loading ? (
                        <><Loader className="animate-spin" size={24} /> Importing...</>
                    ) : (
                        <><Upload size={24} /> Import All Data</>
                    )}
                </button>
            )}
        </div>
    );
}

export default ExcelImport;