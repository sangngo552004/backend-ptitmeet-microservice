import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    navigate,
    meetingJoin,
    getDevicePermissionStates,
    requestDeviceAccess,
    stopMediaStream,
    getWebSocketUrl,
    useAuth,
    clientActivate,
    clientDeactivate,
} = vi.hoisted(() => {
    const activate = vi.fn();
    const deactivate = vi.fn();
    return {
        navigate: vi.fn(),
        meetingJoin: vi.fn(),
        getDevicePermissionStates: vi.fn(),
        requestDeviceAccess: vi.fn(),
        stopMediaStream: vi.fn(),
        getWebSocketUrl: vi.fn(),
        useAuth: vi.fn(),
        clientActivate: activate,
        clientDeactivate: deactivate,
    };
});

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => navigate,
        useLocation: () => ({ state: {} }),
        useParams: () => ({ code: 'room-123' }),
    };
});

vi.mock('../contexts/AuthContext', () => ({
    useAuth,
}));

vi.mock('../services/meetingService', () => ({
    meetingService: {
        joinMeeting: meetingJoin,
    },
}));

vi.mock('../utils/mediaPermissions', () => ({
    getDevicePermissionStates,
    getPermissionErrorMessage: () => 'Permission error',
    requestDeviceAccess,
    stopMediaStream,
}));

vi.mock('../utils/meetingRealtime', () => ({
    getWebSocketUrl,
}));

vi.mock('@stomp/stompjs', () => ({
    Client: function MockClient(config) {
        this.active = false;
        this.subscribe = vi.fn();
        this.activate = () => {
            this.active = true;
            clientActivate(config);
            config.onConnect?.();
        };
        this.deactivate = () => {
            this.active = false;
            clientDeactivate();
        };
    },
}));

import WaitingRoomPage from './WaitingRoomPage';

describe('WaitingRoomPage', () => {
    beforeEach(() => {
        navigate.mockReset();
        meetingJoin.mockReset();
        getDevicePermissionStates.mockReset();
        requestDeviceAccess.mockReset();
        stopMediaStream.mockReset();
        getWebSocketUrl.mockReset();
        useAuth.mockReset();
        clientActivate.mockReset();
        clientDeactivate.mockReset();

        useAuth.mockReturnValue({
            user: {
                userId: 'user-1',
                fullName: 'Demo User',
            },
        });
        getDevicePermissionStates.mockResolvedValue({
            microphone: 'granted',
            camera: 'granted',
        });
        requestDeviceAccess.mockResolvedValue({
            stream: { getTracks: () => [] },
            permissions: { microphone: 'granted', camera: 'granted' },
        });
        getWebSocketUrl.mockReturnValue('ws://localhost:8080/ws');
    });

    it('navigates to meeting when join is approved', async () => {
        meetingJoin.mockResolvedValue({
            status: 'APPROVED',
            token: 'join-token',
            role: 'ATTENDEE',
            serverUrl: 'wss://livekit.example',
        });

        render(<WaitingRoomPage />);

        fireEvent.click(await screen.findByRole('button', { name: 'Join now' }));

        await waitFor(() => {
            expect(navigate).toHaveBeenCalledWith('/meeting/room-123', {
                state: {
                    token: 'join-token',
                    role: 'ATTENDEE',
                    isOwner: false,
                    currentHostId: undefined,
                    serverUrl: 'wss://livekit.example',
                    settings: undefined,
                    micOn: true,
                    camOn: true,
                },
            });
        });
    });

    it('shows waiting state and opens websocket when join is pending', async () => {
        meetingJoin.mockResolvedValue({
            status: 'PENDING',
            message: 'Please wait for the host.',
        });

        render(<WaitingRoomPage />);

        fireEvent.click(await screen.findByRole('button', { name: 'Join now' }));

        expect(await screen.findByText('Please wait for the host.')).toBeInTheDocument();
        expect(await screen.findByRole('button', { name: 'Waiting for host...' })).toBeDisabled();
        expect(clientActivate).toHaveBeenCalled();
    });
});
