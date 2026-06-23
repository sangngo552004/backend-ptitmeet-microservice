import api from './api';

export const authService = {
    refreshToken: async () => {
        const response = await api.post('/auth/refresh-token');
        return response.data;
    },

    getCurrentUser: async () => {
        const response = await api.get('/users/me');
        return response.data;
    },

    login: async (email, password) => {
        const response = await api.post('/auth/login', { email, password });
        return response.data;
    },

    loginWithGoogle: async (idToken) => {
        const response = await api.post('/auth/google', { idToken });
        return response.data;
    },

    logout: async () => {
        const response = await api.post('/auth/logout');
        return response.data;
    },

    register: async (payload) => {
        const response = await api.post('/auth/register', payload);
        return response.data;
    },

    forgotPassword: async (email) => {
        const response = await api.post('/auth/forgot-password', { email });
        return response.data;
    },

    resetPassword: async (token, newPassword) => {
        const response = await api.post('/auth/reset-password', { token, newPassword });
        return response.data;
    },
};
