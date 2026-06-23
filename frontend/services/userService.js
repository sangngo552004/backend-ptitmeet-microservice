import api from './api';

export const userService = {
    updateProfile: async (payload) => {
        const response = await api.put('/users/profile', payload);
        return response.data;
    },
    uploadAvatar: async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post('/users/avatar', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },
};
