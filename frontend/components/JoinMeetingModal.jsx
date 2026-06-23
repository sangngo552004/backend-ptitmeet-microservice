import React, { useState } from 'react';

const JoinMeetingModal = ({ isOpen, onClose, onJoin, isLoading }) => {
  const [code, setCode] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (code.trim()) onJoin(code);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
        <div className="p-6">
          <h3 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Tham gia cuộc họp</h3>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Mã phòng hoặc đường dẫn
              </label>
              <input
                type="text"
                className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-950 focus:ring-0 transition-all text-slate-900 dark:text-white"
                placeholder="Ví dụ: abc-123-xyz"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isLoading || !code.trim()}
                className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? <span className="animate-spin text-lg material-symbols-outlined">progress_activity</span> : 'Tham gia'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default JoinMeetingModal;