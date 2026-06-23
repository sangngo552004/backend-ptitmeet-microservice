import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const { navigate, resetPassword } = vi.hoisted(() => ({
    navigate: vi.fn(),
    resetPassword: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => navigate,
        useSearchParams: () => [new URLSearchParams('?token=test-token')],
    };
});

vi.mock('../services/authService', () => ({
    authService: {
        resetPassword,
    },
}));

import ResetPassword from './ResetPassword';

describe('ResetPassword', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    beforeEach(() => {
        navigate.mockReset();
        resetPassword.mockReset();
        alertSpy.mockClear();
    });

    it('prevents submit when passwords do not match', async () => {
        render(
            <MemoryRouter>
                <ResetPassword />
            </MemoryRouter>
        );

        fireEvent.change(screen.getAllByPlaceholderText('••••••••')[0], { target: { value: 'one' } });
        fireEvent.change(screen.getAllByPlaceholderText('••••••••')[1], { target: { value: 'two' } });
        fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

        expect(alertSpy).toHaveBeenCalledWith('Mật khẩu không khớp!');
        expect(resetPassword).not.toHaveBeenCalled();
    });

    it('shows success state and navigates to login', async () => {
        resetPassword.mockResolvedValue({ code: 1000 });

        render(
            <MemoryRouter>
                <ResetPassword />
            </MemoryRouter>
        );

        fireEvent.change(screen.getAllByPlaceholderText('••••••••')[0], { target: { value: 'password123' } });
        fireEvent.change(screen.getAllByPlaceholderText('••••••••')[1], { target: { value: 'password123' } });
        fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

        expect(await screen.findByText('Thành công!')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập ngay' }));
        expect(navigate).toHaveBeenCalledWith('/login');
    });
});
