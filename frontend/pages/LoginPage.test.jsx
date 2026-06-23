import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const { navigate, loginWithGoogle, login } = vi.hoisted(() => ({
    navigate: vi.fn(),
    loginWithGoogle: vi.fn(),
    login: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => navigate,
    };
});

vi.mock('@react-oauth/google', () => ({
    GoogleLogin: ({ onSuccess, onError }) => (
        <div>
            <button onClick={() => onSuccess({ credential: 'google-token' })}>Google Sign In</button>
            <button onClick={() => onError()}>Google Error</button>
        </div>
    ),
}));

vi.mock('../services/authService', () => ({
    authService: {
        login,
        loginWithGoogle,
    },
}));

import LoginPage from './LoginPage';

describe('LoginPage', () => {
    beforeEach(() => {
        navigate.mockReset();
        login.mockReset();
        loginWithGoogle.mockReset();
    });

    it('logs in successfully and redirects to home', async () => {
        const setUser = vi.fn();
        login.mockResolvedValue({
            code: 1000,
            data: {
                user: { email: 'demo@example.com' },
            },
        });

        render(
            <MemoryRouter>
                <LoginPage setUser={setUser} />
            </MemoryRouter>
        );

        fireEvent.change(screen.getByPlaceholderText('name@company.com'), {
            target: { value: 'demo@example.com' },
        });
        fireEvent.change(screen.getByPlaceholderText('••••••••'), {
            target: { value: 'password123' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

        await waitFor(() => {
            expect(setUser).toHaveBeenCalledWith({ email: 'demo@example.com' });
        });
        expect(navigate).toHaveBeenCalledWith('/');
    });

    it('renders an API error message when login fails', async () => {
        login.mockRejectedValue({
            response: {
                data: {
                    message: 'Email hoặc mật khẩu không chính xác.',
                },
            },
        });

        render(
            <MemoryRouter>
                <LoginPage setUser={vi.fn()} />
            </MemoryRouter>
        );

        fireEvent.change(screen.getByPlaceholderText('name@company.com'), {
            target: { value: 'demo@example.com' },
        });
        fireEvent.change(screen.getByPlaceholderText('••••••••'), {
            target: { value: 'wrong-password' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

        expect(await screen.findByText('Email hoặc mật khẩu không chính xác.')).toBeInTheDocument();
    });

    it('supports Google login success', async () => {
        const setUser = vi.fn();
        loginWithGoogle.mockResolvedValue({
            code: 1000,
            data: {
                user: { email: 'google@example.com' },
            },
        });

        render(
            <MemoryRouter>
                <LoginPage setUser={setUser} />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByText('Google Sign In'));

        await waitFor(() => {
            expect(setUser).toHaveBeenCalledWith({ email: 'google@example.com' });
        });
        expect(navigate).toHaveBeenCalledWith('/');
    });
});
