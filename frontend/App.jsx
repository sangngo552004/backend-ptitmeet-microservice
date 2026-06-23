import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import WaitingRoomPage from './pages/WaitingRoomPage';
import MeetingPage from './pages/MeetingPage';
import SummaryPage from './pages/SummaryPage';
import SchedulePage from './pages/SchedulePage';
import SignUpPage from './pages/SignUpPage';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import HistoryPage from './pages/HistoryPage';
import RecordingsPage from './pages/RecordingsPage';
import { useAuth } from './contexts/AuthContext';
const App = () => {
    const { user, setUser, logout } = useAuth();

    return (
        <BrowserRouter>
            <div className="min-h-screen bg-background text-white selection:bg-primary/30">
                <Routes>
                    <Route path="/" element={user ? <Navigate to="/dashboard" /> : <LandingPage />} />
                    <Route path="/login" element={<LoginPage setUser={setUser} />} />
                    <Route path="/signup" element={<SignUpPage />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />

                    {/* Waiting Room có thể cần truyền thêm ID phòng họp sau này */}
                    <Route
                        path="/waiting-room/:code"
                        element={user ? <WaitingRoomPage /> : <Navigate to="/login" />}
                    />

                    <Route path="/meeting/:code" element={<MeetingPage />} />
                    <Route path="/summary" element={<SummaryPage />} />

                    <Route
                        path="/dashboard"
                        element={user ? <DashboardPage onLogout={logout} /> : <Navigate to="/login" />}
                    />

                    <Route
                        path="/schedule"
                        element={user ? <SchedulePage /> : <Navigate to="/login" />}
                    />
                    <Route path="/history" element={user ? <HistoryPage /> : <Navigate to="/login" />} />

                    <Route
                        path="/recordings"
                        element={user ? <RecordingsPage /> : <Navigate to="/login" />}
                    />

                    <Route path="/settings" element={user ? <SettingsPage /> : <Navigate to="/login" />} />

                    {/* Route mặc định: Chuyển về trang chủ nếu không tìm thấy */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </div>
        </BrowserRouter>
    );
};

export default App;
