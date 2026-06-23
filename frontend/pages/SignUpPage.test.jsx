import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const { navigate, register, loginWithGoogle } = vi.hoisted(() => ({
    navigate: vi.fn(),
    register: vi.fn(),
    loginWithGoogle: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => navigate,
    };
});

vi.mock('@react-oauth/google', () => ({
    GoogleLogin: ({ onSuccess }) => <button onClick={() => onSuccess({ credential: 'google-token' })}>Google Sign Up</button>,
}));

vi.mock('../services/authService', () => ({
    authService: {
        register,
        loginWithGoogle,
    },
}));

import SignUpPage from './SignUpPage';

describe('SignUpPage', () => {
    beforeEach(() => {
        navigate.mockReset();
        register.mockReset();
        loginWithGoogle.mockReset();
    });

    it('shows local validation when passwords do not match', async () => {
        render(
            <MemoryRouter>
                <SignUpPage />
            </MemoryRouter>
        );

        fireEvent.change(screen.getByPlaceholderText('Alex Morgan'), { target: { value: 'Demo User' } });
        fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'demo@example.com' } });
        fireEvent.change(screen.getAllByPlaceholderText('••••••••')[0], { target: { value: 'password123' } });
        fireEvent.change(screen.getAllByPlaceholderText('••••••••')[1], { target: { value: 'mismatch' } });
        fireEvent.click(screen.getByLabelText(/I agree/i));
        fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

        expect(await screen.findByText('Mật khẩu không khớp')).toBeInTheDocument();
        expect(register).not.toHaveBeenCalled();
    });

    it('submits registration and redirects to login', async () => {
        register.mockResolvedValue({ code: 1000 });

        render(
            <MemoryRouter>
                <SignUpPage />
            </MemoryRouter>
        );

        fireEvent.change(screen.getByPlaceholderText('Alex Morgan'), { target: { value: 'Demo User' } });
        fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'demo@example.com' } });
        fireEvent.change(screen.getAllByPlaceholderText('••••••••')[0], { target: { value: 'password123' } });
        fireEvent.change(screen.getAllByPlaceholderText('••••••••')[1], { target: { value: 'password123' } });
        fireEvent.click(screen.getByLabelText(/I agree/i));
        fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

        await waitFor(() => {
            expect(register).toHaveBeenCalledTimes(1);
        });
        expect(navigate).toHaveBeenCalledWith('/login');
    });
});
