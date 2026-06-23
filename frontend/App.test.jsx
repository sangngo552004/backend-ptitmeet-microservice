import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useAuth } = vi.hoisted(() => ({
    useAuth: vi.fn(),
}));

vi.mock('./contexts/AuthContext', () => ({
    useAuth,
}));

vi.mock('./pages/LandingPage', () => ({ default: () => <div>Landing Page</div> }));
vi.mock('./pages/LoginPage', () => ({ default: () => <div>Login Page</div> }));
vi.mock('./pages/WaitingRoomPage', () => ({ default: () => <div>Waiting Room</div> }));
vi.mock('./pages/MeetingPage', () => ({ default: () => <div>Meeting Page</div> }));
vi.mock('./pages/SummaryPage', () => ({ default: () => <div>Summary Page</div> }));
vi.mock('./pages/SchedulePage', () => ({ default: () => <div>Schedule Page</div> }));
vi.mock('./pages/SignUpPage', () => ({ default: () => <div>Sign Up Page</div> }));
vi.mock('./pages/DashboardPage', () => ({ default: () => <div>Dashboard Page</div> }));
vi.mock('./pages/SettingsPage', () => ({ default: () => <div>Settings Page</div> }));
vi.mock('./pages/ForgotPassword', () => ({ default: () => <div>Forgot Password Page</div> }));
vi.mock('./pages/ResetPassword', () => ({ default: () => <div>Reset Password Page</div> }));
vi.mock('./pages/HistoryPage', () => ({ default: () => <div>History Page</div> }));

import App from './App';

describe('App routes', () => {
    beforeEach(() => {
        window.history.pushState({}, '', '/');
        useAuth.mockReset();
    });

    it('shows the landing page for guests on the home route', () => {
        useAuth.mockReturnValue({
            user: null,
            setUser: vi.fn(),
            logout: vi.fn(),
        });

        render(<App />);

        expect(screen.getByText('Landing Page')).toBeInTheDocument();
    });

    it('redirects authenticated users to the dashboard route', async () => {
        useAuth.mockReturnValue({
            user: { id: 'user-1' },
            setUser: vi.fn(),
            logout: vi.fn(),
        });

        render(<App />);

        expect(await screen.findByText('Dashboard Page')).toBeInTheDocument();
    });

    it('redirects guests away from protected routes', async () => {
        window.history.pushState({}, '', '/schedule');
        useAuth.mockReturnValue({
            user: null,
            setUser: vi.fn(),
            logout: vi.fn(),
        });

        render(<App />);

        expect(await screen.findByText('Login Page')).toBeInTheDocument();
    });
});
