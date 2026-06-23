import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const { navigate, scheduleMeeting } = vi.hoisted(() => ({
    navigate: vi.fn(),
    scheduleMeeting: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => navigate,
    };
});

vi.mock('../components/DashboardLayout', () => ({
    default: ({ children }) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock('../services/meetingService', () => ({
    meetingService: {
        scheduleMeeting,
    },
}));

import SchedulePage from './SchedulePage';

describe('SchedulePage', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    beforeEach(() => {
        navigate.mockReset();
        scheduleMeeting.mockReset();
        alertSpy.mockClear();
    });

    it('adds participant emails and submits a schedule payload', async () => {
        scheduleMeeting.mockResolvedValue({ meetingCode: 'room-123' });

        render(
            <MemoryRouter>
                <SchedulePage />
            </MemoryRouter>
        );

        fireEvent.change(screen.getByPlaceholderText('e.g., Weekly Team Sync'), {
            target: { value: 'Planning Meeting' },
        });

        const emailInput = screen.getByPlaceholderText('Enter email addresses and press Enter');
        fireEvent.change(emailInput, {
            target: { value: 'guest@example.com' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Add' }));

        expect(screen.getByText('guest@example.com')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Schedule Meeting/i }));

        await waitFor(() => {
            expect(scheduleMeeting).toHaveBeenCalledTimes(1);
        });

        const payload = scheduleMeeting.mock.calls[0][0];
        expect(payload.title).toBe('Planning Meeting');
        expect(payload.participant_emails).toEqual(['guest@example.com']);
        expect(payload.access_type).toBe('TRUSTED');
        expect(JSON.parse(payload.settings)).toMatchObject({
            waitingRoom: true,
            chatEnabled: true,
        });
        expect(alertSpy).toHaveBeenCalledWith('Đã lên lịch thành công! Mã phòng: room-123');
        expect(navigate).toHaveBeenCalledWith('/');
    });

    it('shows backend error messages when scheduling fails', async () => {
        scheduleMeeting.mockRejectedValue({
            response: {
                data: {
                    message: 'Có lỗi xảy ra từ backend.',
                },
            },
        });

        render(
            <MemoryRouter>
                <SchedulePage />
            </MemoryRouter>
        );

        fireEvent.change(screen.getByPlaceholderText('e.g., Weekly Team Sync'), {
            target: { value: 'Planning Meeting' },
        });
        fireEvent.click(screen.getByRole('button', { name: /Schedule Meeting/i }));

        expect(await screen.findByText('Có lỗi xảy ra từ backend.')).toBeInTheDocument();
    });
});
