import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const api = axios.create({ baseURL: API_URL, timeout: 60000 });

api.interceptors.response.use(
    res => res,
    err => {
        if (err.response) console.error('API Error:', err.response.data);
        return Promise.reject(err);
    }
);

export const EventService = {
    getState: (id) => api.get(`/event/state/${id}`),
    update: (id, data) => api.put(`/event/${id}`, data),
    start: (id) => api.post(`/event/start/${id}`),
    stop: (id) => api.post(`/event/stop/${id}`),
    pause: (id) => api.post(`/event/pause/${id}`),
    resume: (id) => api.post(`/event/resume/${id}`),
    reset: (id) => api.post(`/event/reset/${id}`),
    resetAll: (id) => api.post(`/event/reset-all/${id}`),
    getConfig: (id) => api.get(`/event/config/${id}`),
    updateConfig: (id, config) => api.put(`/event/config/${id}`, { config }),
    updateSettings: (id, data) => api.put(`/event/settings/${id}`, data)
};

export const TeamService = {
    getAll: (eventId) => api.get(`/teams/${eventId}`),
    getWithMembers: (eventId) => api.get(`/teams/with-members/${eventId}`),
    create: (data) => api.post('/teams', data),
    update: (id, data) => api.put(`/teams/${id}`, data),
    delete: (id) => api.delete(`/teams/${id}`),
    reorder: (teams) => api.post('/teams/reorder', { teams })
};

export const RoundService = {
    getAll: (eventId) => api.get(`/rounds/${eventId}`),
    create: (data) => api.post('/rounds', data),
    update: (id, data) => api.put(`/rounds/${id}`, data),
    delete: (id) => api.delete(`/rounds/${id}`)
};

export const ScoreService = {
    apply: (data) => api.post('/scores', data),
    penalty: (data) => api.post('/scores/penalty', data),
    undo: (teamId, roundId) => api.delete(`/scores/undo/${teamId}/${roundId}`),
    getHistory: (eventId) => api.get(`/scores/history/${eventId}`)
};

export const RankingService = {
    getRankings: (eventId) => api.get(`/rankings/${eventId}`)
};

export const ScoringControlService = {
    getCurrentTeam: (eventId) => api.get(`/scoring/current-team/${eventId}`),
    nextQuestion: (eventId) => api.post(`/scoring/next-question/${eventId}`),
    setRound: (eventId, roundId) => api.post(`/scoring/set-round/${eventId}/${roundId}`),
    setBuzzerTeam: (eventId, teamId) => api.post(`/scoring/set-buzzer-team/${eventId}`, { teamId }),
    showRoundCompleted: (eventId) => api.post(`/scoring/show-round-completed/${eventId}`),
    showEventCompleted: (eventId) => api.post(`/scoring/show-event-completed/${eventId}`),
    showNextRound: (eventId) => api.post(`/scoring/show-next-round/${eventId}`), // ⭐ ADD THIS
    clearSplash: (eventId) => api.post(`/scoring/clear-splash/${eventId}`),
    nextRound: (eventId) => api.post(`/scoring/next-round/${eventId}`),
    getSplash: (eventId) => api.get(`/event/splash/${eventId}`)
};

export const ImportService = {
    preview: (eventId, data) => api.post(`/import/preview/${eventId}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    importFull: (eventId, data) => api.post(`/import/full/${eventId}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    downloadTemplate: () => api.get('/import/template', { responseType: 'blob' }),
    exportResults: (eventId) => api.get(`/import/export-results/${eventId}`, { responseType: 'blob' })
};

export const HealthService = {
    check: () => api.get('/health')
};

export default {
    EventService, TeamService, RoundService, ScoreService,
    RankingService, ScoringControlService, ImportService, HealthService
};