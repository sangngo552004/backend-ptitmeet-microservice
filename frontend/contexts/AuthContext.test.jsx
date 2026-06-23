import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { interceptorUse, interceptorEject, api, authService } = vi.hoisted(() => {
    const interceptorUseMock = vi.fn();
    const interceptorEjectMock = vi.fn();
    const apiMock = vi.fn();
    apiMock.interceptors = {
        response: {
            use: interceptorUseMock,
            eject: interceptorEjectMock,
        },
    };

    return {
        interceptorUse: interceptorUseMock,
        interceptorEject: interceptorEjectMock,
        api: apiMock,
        authService: {
            getCurrentUser: vi.fn(),
            login: vi.fn(),
            logout: vi.fn(),
            refreshToken: vi.fn(),
        },
    };
});

vi.mock('../services/api', () => ({
    default: api,
}));

vi.mock('../services/authService', () => ({
    authService,
}));

import { AuthProvider, useAuth } from './AuthContext';

function AuthConsumer() {
    const { user, login, logout, isAuthenticated } = useAuth();

    return (
        <div>
            <span data-testid="auth-state">{isAuthenticated ? 'yes' : 'no'}</span>
            <span data-testid="user-email">{user?.email ?? 'anonymous'}</span>
            <button onClick={() => login('demo@example.com', 'password123')}>login</button>
            <button onClick={() => logout()}>logout</button>
        </div>
    );
}

describe('AuthProvider', () => {
    beforeEach(() => {
        api.mockReset();
        interceptorUse.mockReset();
        interceptorEject.mockReset();
        authService.getCurrentUser.mockReset();
        authService.login.mockReset();
        authService.logout.mockReset();
        authService.refreshToken.mockReset();
    });

    it('hydrates the authenticated user on mount', async () => {
        authService.getCurrentUser.mockResolvedValue({
            code: 1000,
            data: {
                email: 'demo@example.com',
            },
        });

        render(
            <AuthProvider>
                <AuthConsumer />
            </AuthProvider>
        );

        expect(await screen.findByTestId('user-email')).toHaveTextContent('demo@example.com');
        expect(screen.getByTestId('auth-state')).toHaveTextContent('yes');
        expect(interceptorUse).toHaveBeenCalledTimes(1);
    });

    it('refreshes the token and retries the failed request once on 401', async () => {
        authService.getCurrentUser.mockRejectedValue(new Error('missing session'));
        authService.refreshToken.mockResolvedValue({ code: 1000 });
        api.mockResolvedValue({ data: 'retried' });

        render(
            <AuthProvider>
                <AuthConsumer />
            </AuthProvider>
        );

        await waitFor(() => {
            expect(interceptorUse).toHaveBeenCalledTimes(1);
        });

        const [, onRejected] = interceptorUse.mock.calls[0];
        const originalRequest = { url: '/meetings/up-next' };
        const result = await onRejected({
            config: originalRequest,
            response: { status: 401 },
        });

        expect(authService.refreshToken).toHaveBeenCalledTimes(1);
        expect(api).toHaveBeenCalledWith({
            url: '/meetings/up-next',
            _retry: true,
        });
        expect(result).toEqual({ data: 'retried' });
    });

    it('clears the local user after logout', async () => {
        authService.getCurrentUser.mockResolvedValue({
            code: 1000,
            data: {
                email: 'demo@example.com',
            },
        });
        authService.logout.mockResolvedValue({ code: 1000 });

        render(
            <AuthProvider>
                <AuthConsumer />
            </AuthProvider>
        );

        expect(await screen.findByTestId('user-email')).toHaveTextContent('demo@example.com');

        fireEvent.click(screen.getByText('logout'));

        await waitFor(() => {
            expect(screen.getByTestId('user-email')).toHaveTextContent('anonymous');
        });
        expect(screen.getByTestId('auth-state')).toHaveTextContent('no');
    });
});
