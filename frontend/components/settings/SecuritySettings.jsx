import React, { useState } from 'react';

const SecuritySettings = () => {
  const [e2ee, setE2ee] = useState(
    JSON.parse(localStorage.getItem('ptitmeet_e2ee') || 'true')
  );
  const [twoFactor, setTwoFactor] = useState(
    JSON.parse(localStorage.getItem('ptitmeet_twoFactor') || 'false')
  );

  const handleToggle = (setter, key, value) => {
    setter(value);
    localStorage.setItem(key, JSON.stringify(value));
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      <div className="space-y-3">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Meeting Security</label>
        
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-transparent hover:border-white/10 transition-colors group">
          <div className="flex gap-3 items-center">
            <div className="p-1.5 rounded-lg bg-green-500/10 text-green-500 group-hover:bg-green-500/20 transition-colors">
              <span className="material-symbols-outlined text-[18px]">enhanced_encryption</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">End-to-End Encryption</p>
              <p className="text-[11px] text-gray-400">Secure your meetings with E2EE</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={e2ee}
              onChange={(e) => handleToggle(setE2ee, 'ptitmeet_e2ee', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
      </div>

      <div className="h-px bg-white/10 w-full"></div>

      <div className="space-y-3">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Account Security</label>

        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-transparent hover:border-white/10 transition-colors group">
          <div className="flex gap-3 items-center">
            <div className="p-1.5 rounded-lg bg-black/20 text-gray-400 group-hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[18px]">phonelink_lock</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Two-Factor Authentication</p>
              <p className="text-[11px] text-gray-400">Add an extra layer of security to your account</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={twoFactor}
              onChange={(e) => handleToggle(setTwoFactor, 'ptitmeet_twoFactor', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-transparent hover:border-white/10 transition-colors group">
          <div className="flex gap-3 items-center">
            <div className="p-1.5 rounded-lg bg-black/20 text-gray-400 group-hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[18px]">password</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Change Password</p>
              <p className="text-[11px] text-gray-400">Last changed 3 months ago</p>
            </div>
          </div>
          <button className="px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors">
            Update
          </button>
        </div>
      </div>
    </div>
  );
};

export default SecuritySettings;
