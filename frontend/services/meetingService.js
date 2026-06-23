import api from './api';

export const meetingService = {
    createInstantMeeting: async () => {
        const response = await api.post('/meetings/instant');
        return response.data.data;
    },

    joinMeeting: async (meetingCode, password = null) => {
        const response = await api.post(`/meetings/${meetingCode}/join`, { password });
        return response.data.data;
    },

    getMeetingInfo: async (meetingCode) => {
        const response = await api.get(`/meetings/${meetingCode}/info`);
        return response.data.data;
    },

    getWaitingList: async (meetingCode) => {
        const response = await api.get(`/meetings/${meetingCode}/waiting-room`);
        return response.data.data;
    },

    processApproval: async (meetingCode, participantId, action) => {
        const response = await api.post(`/meetings/${meetingCode}/approval`, {
            participantId,
            action
        });
        return response.data;
    },

    scheduleMeeting: async (meetingData) => {
        const response = await api.post('/meetings/schedule', meetingData);
        return response.data.data;
    },

    getHistory: async (page = 1, size = 6, role = 'ALL', status = 'ALL') => {
        const response = await api.get(`/meetings/history?page=${page}&size=${size}&role=${role}&status=${status}`);
        return response.data.data;
    },

    getUpNext: async () => {
        const response = await api.get('/meetings/up-next');
        return response.data.data;
    },

    getChatHistory: async (code) => {
        const response = await api.get(`/meetings/${code}/chat/history`);
        return response.data.data;
    },

    getMyRecordings: async () => {
        const response = await api.get('/livekit/recordings/my');
        return response.data.data;
    },

    leaveMeeting: async (code) => {
        return await api.post(`/meetings/${code}/leave`);
    },

    endMeetingForAll: async (code) => {
        return await api.post(`/meetings/${code}/end`);
    },

    startRecordMeeting: async (code) => {
        return await api.post(`/livekit/recordings/start?meetingCode=${code}`);
    },

    endRecordMeeting: async (egressId) => {
        return await api.post(`/livekit/recordings/stop?egressId=${egressId}`);
    },

    getMeetingSummary: async (code, actionTaken) => {
        const response = await api.get(`/meetings/${code}/summary?action=${actionTaken}`);
        return response.data;
    },

    submitFeedback: async (code, rating) => {
        const response = await api.post(`/meetings/${code}/feedback`, { rating });
        return response.data;
    },

    getMeetingSettings: async (code) => {
        const response = await api.get(`/meetings/${code}/settings`);
        return typeof response.data.data === 'string' ? JSON.parse(response.data.data) : response.data.data;
    },

    updateMeetingSettings: async (code, settings) => {
        const response = await api.put(`/meetings/${code}/settings`, settings);
        return response.data.data;
    },
};
