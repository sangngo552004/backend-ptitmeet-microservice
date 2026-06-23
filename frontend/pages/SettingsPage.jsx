import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import UserProfile from '../components/UserProfile';
import NotificationSettings from '../components/settings/NotificationSettings';
import { useAuth } from '../contexts/AuthContext';

const getInitials = (name) => {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const SettingsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'profile');

  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
  }, [location.state]);

  const navItems = [
    { id: 'profile', label: 'Profile', icon: 'person' },
    { id: 'notifications', label: 'Notifications', icon: 'notifications' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return <UserProfile />;
      case 'notifications':
        return <NotificationSettings />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#111418] text-white flex flex-col md:flex-row font-display animate-in fade-in duration-200">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-[#0a0c0f] flex flex-col border-b md:border-b-0 md:border-r border-white/5 shrink-0">
        <div className="p-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-gray-400 transition-colors hover:text-white"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to dashboard
          </button>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[24px]">settings</span>
            Settings
          </h2>
        </div>

        <nav className="flex-1 px-4 py-2 flex flex-col gap-1.5 overflow-y-auto no-scrollbar">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group w-full text-left ${activeTab === item.id
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <span className={`material-symbols-outlined text-[20px] ${activeTab === item.id ? 'text-white' : 'group-hover:text-white'}`}>
                {item.icon}
              </span>
              <span className="text-sm font-semibold">{item.label}</span>
            </button>
          ))}
        </nav>

          <div className="p-4 border-t border-white/5 mt-auto">
            <div className="flex items-center gap-3">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.fullName || 'User'}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-surface-dark"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-xs font-bold ring-2 ring-surface-dark">
                  {getInitials(user?.fullName)}
                </div>
              )}
              <div className="flex flex-col overflow-hidden">
                <span className="text-xs font-semibold text-white truncate">{user?.fullName || 'User'}</span>
                <span className="text-[10px] text-gray-500 truncate">{user?.email || 'Pro Member'}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col h-full relative min-w-0 bg-[#111418]">
          {/* Content Header */}
          <div className="flex items-start justify-between px-10 pt-10 pb-6 shrink-0 border-b border-white/5">
            <div>
              <h1 className="text-3xl font-bold text-white capitalize tracking-tight">{activeTab}</h1>
              <p className="text-gray-400 text-sm mt-2 font-medium">
                {activeTab === 'profile' && 'Update your personal information.'}
                {activeTab === 'notifications' && 'Adjust your notification preferences.'}
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all group"
            >
              <span className="material-symbols-outlined text-[24px] group-hover:scale-110 transition-transform">close</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto px-10 py-8 no-scrollbar">
            <div className="max-w-3xl">
              {renderContent()}
            </div>
          </div>
        </main>
      </div>
  );
};

export default SettingsPage;
