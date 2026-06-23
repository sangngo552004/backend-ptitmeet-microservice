import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState("");

  return (
    <div className="relative overflow-hidden bg-background">
      {/* Hiệu ứng nền (Background Glow) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-primary/20 rounded-full blur-[120px] -z-10 pointer-events-none opacity-50"></div>

      {/* Thanh điều hướng (Navbar) - Chỉ dành cho khách */}
      <header className="h-20 flex items-center justify-between px-6 lg:px-12 max-w-7xl mx-auto w-full sticky top-0 bg-background/50 backdrop-blur-md z-50">
        <div className="flex items-center gap-2">
          <div className="size-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-2xl">videocam</span>
          </div>
          <span className="text-xl font-black tracking-tight">PTIT-Meet</span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/login')}
            className="text-sm font-semibold text-gray-400 hover:text-white"
          >
            Sign In
          </button>
          <button
            onClick={() => navigate('/signup')}
            className="bg-primary hover:bg-blue-600 px-6 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-primary/20 transition-all hover:scale-105"
          >
            Create account
          </button>
        </div>
      </header>

      {/* Phần Hero chính */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 py-20 lg:py-32 flex flex-col lg:flex-row items-center gap-16">
        <div className="flex-1 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest mb-6">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            Version 4.0 is here
          </div>
          <h1 className="text-5xl lg:text-7xl font-black leading-[1.1] mb-8 tracking-tight">
            Secure Video <br /> Meetings for <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">Modern Teams</span>
          </h1>
          <p className="text-lg lg:text-xl text-gray-400 mb-10 max-w-xl mx-auto lg:mx-0">
            Create meetings, admit participants, record sessions, and review your owned meeting history from one workspace.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
            <button
              onClick={() => navigate('/login')}
              className="h-14 px-10 bg-primary hover:bg-blue-600 text-white rounded-full font-bold flex items-center gap-3 transition-all hover:scale-105 w-full sm:w-auto justify-center"
            >
              <span className="material-symbols-outlined">video_call</span>
              Start New Meeting
            </button>
            <div className="relative w-full sm:w-64 group">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors">keyboard</span>
              <input
                type="text"
                value={meetingCode}
                onChange={(event) => setMeetingCode(event.target.value)}
                placeholder="Enter code"
                className="w-full h-14 pl-12 pr-20 rounded-full bg-surface border border-white/10 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
              />
              <button
                onClick={() => navigate('/login', { state: { pendingMeetingCode: meetingCode.trim() } })}
                className="absolute right-2 top-2 bottom-2 px-4 rounded-full text-primary hover:bg-primary/10 font-bold text-sm transition-colors"
              >
                Sign in to join
              </button>
            </div>
          </div>
        </div>
        <div className="flex-1 w-full max-w-[600px] lg:max-w-none relative">
          <div className="aspect-video bg-surface rounded-2xl overflow-hidden shadow-2xl border border-white/10">
            <img
              src="https://picsum.photos/1200/800?random=1"
              alt="UI Mockup"
              className="w-full h-full object-cover opacity-80"
            />
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-12 border-t border-white/5 opacity-70">
        <div className="grid grid-cols-1 gap-4 text-center sm:grid-cols-3">
          <div className="rounded-2xl border border-white/5 bg-white/5 p-5">
            <p className="text-sm font-bold text-primary">Owner-first data</p>
            <p className="mt-2 text-sm text-gray-400">Chat history and recordings stay with the original meeting owner.</p>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/5 p-5">
            <p className="text-sm font-bold text-primary">Live moderation</p>
            <p className="mt-2 text-sm text-gray-400">Waiting room, approvals, and runtime host controls are built in.</p>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/5 p-5">
            <p className="text-sm font-bold text-primary">Recording workflow</p>
            <p className="mt-2 text-sm text-gray-400">Start recording inside the meeting and review completed files later.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
