import React, { useState } from 'react';

const NotificationSettings = () => {
  const [chatNotif, setChatNotif] = useState(
    JSON.parse(localStorage.getItem('ptitmeet_chatNotif') || 'true')
  );
  const [joinLeaveNotif, setJoinLeaveNotif] = useState(
    JSON.parse(localStorage.getItem('ptitmeet_joinLeaveNotif') || 'true')
  );
  const [raiseHandNotif, setRaiseHandNotif] = useState(
    JSON.parse(localStorage.getItem('ptitmeet_raiseHandNotif') || 'true')
  );
  const [reminderNotif, setReminderNotif] = useState(
    JSON.parse(localStorage.getItem('ptitmeet_reminderNotif') || 'true')
  );

  const handleToggle = (setter, key, value) => {
    setter(value);
    localStorage.setItem(key, JSON.stringify(value));
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      <div className="space-y-3">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">In-Meeting Notifications</label>
        
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-transparent hover:border-white/10 transition-colors group">
          <div className="flex gap-3 items-center">
            <div className="p-1.5 rounded-lg bg-black/20 text-gray-400 group-hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[18px]">chat</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Chat Messages</p>
              <p className="text-[11px] text-gray-400">Play sound when receiving a new message</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={chatNotif}
              onChange={(e) => handleToggle(setChatNotif, 'ptitmeet_chatNotif', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-transparent hover:border-white/10 transition-colors group">
          <div className="flex gap-3 items-center">
            <div className="p-1.5 rounded-lg bg-black/20 text-gray-400 group-hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[18px]">group_add</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Join / Leave Sounds</p>
              <p className="text-[11px] text-gray-400">Play sound when someone joins or leaves</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={joinLeaveNotif}
              onChange={(e) => handleToggle(setJoinLeaveNotif, 'ptitmeet_joinLeaveNotif', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-transparent hover:border-white/10 transition-colors group">
          <div className="flex gap-3 items-center">
            <div className="p-1.5 rounded-lg bg-black/20 text-gray-400 group-hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[18px]">front_hand</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Raise Hand Sounds</p>
              <p className="text-[11px] text-gray-400">Play sound when someone raises a hand</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={raiseHandNotif}
              onChange={(e) => handleToggle(setRaiseHandNotif, 'ptitmeet_raiseHandNotif', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
      </div>

      <div className="h-px bg-white/10 w-full"></div>

      <div className="space-y-3">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">General Notifications</label>

        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-transparent hover:border-white/10 transition-colors group">
          <div className="flex gap-3 items-center">
            <div className="p-1.5 rounded-lg bg-black/20 text-gray-400 group-hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[18px]">event</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Meeting Reminders</p>
              <p className="text-[11px] text-gray-400">Remind me 5 minutes before upcoming meetings</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={reminderNotif}
              onChange={(e) => handleToggle(setReminderNotif, 'ptitmeet_reminderNotif', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;
