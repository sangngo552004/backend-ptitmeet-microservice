import React, { useState, useEffect } from "react";
import { meetingService } from "../../services/meetingService";

const InMeetingSettingsModal = ({ isOpen, onClose, isHost, code, room }) => {
  const [activeTab, setActiveTab] = useState("host");
  const [hostSettings, setHostSettings] = useState({
    waitingRoom: true,
    muteAudioOnEntry: false,
    muteVideoOnEntry: false,
    chatEnabled: true,
    screenShareEnabled: true,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const fetchSettings = async () => {
        try {
          const settings = await meetingService.getMeetingSettings(code);
          if (settings) {
            setHostSettings(settings);
          }
        } catch (error) {
          console.error("Failed to fetch meeting settings:", error);
        }
      };
      fetchSettings();
    }
  }, [isOpen, code]);

  useEffect(() => {
    if (isHost) {
      setActiveTab("host");
    }
  }, [isHost, isOpen]);

  if (!isOpen) return null;

  const handleToggleHostSetting = async (key) => {
    const updatedSettings = {
      ...hostSettings,
      [key]: !hostSettings[key],
    };
    setHostSettings(updatedSettings);

    try {
      await meetingService.updateMeetingSettings(code, updatedSettings);
    } catch (error) {
      console.error("Failed to update host settings:", error);
      // Revert state on failure
      setHostSettings(hostSettings);
      alert("Failed to update settings. Please try again.");
    }
  };

  const navItems = [
    ...(isHost ? [{ id: "host", label: "Host Controls", icon: "admin_panel_settings" }] : []),
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "host":
        return (
          <div className="space-y-4 animate-in fade-in duration-200">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Meeting Security</h3>
            
            {/* Waiting Room */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-transparent hover:border-white/10 transition-colors group">
              <div className="flex gap-3 items-center">
                <div className="p-1.5 rounded-lg bg-black/20 text-gray-400 group-hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-[18px]">meeting_room</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Enable Waiting Room</p>
                  <p className="text-[11px] text-gray-400">Admit guests before they can join</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={hostSettings.waitingRoom}
                  onChange={() => handleToggleHostSetting("waitingRoom")}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-6 mb-2">Participant Permissions</h3>

            {/* Mute Audio on Entry */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-transparent hover:border-white/10 transition-colors group">
              <div className="flex gap-3 items-center">
                <div className="p-1.5 rounded-lg bg-black/20 text-gray-400 group-hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-[18px]">mic_off</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Mute audio upon entry</p>
                  <p className="text-[11px] text-gray-400">Automatically mute participants' microphones</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={hostSettings.muteAudioOnEntry}
                  onChange={() => handleToggleHostSetting("muteAudioOnEntry")}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {/* Mute Video on Entry */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-transparent hover:border-white/10 transition-colors group">
              <div className="flex gap-3 items-center">
                <div className="p-1.5 rounded-lg bg-black/20 text-gray-400 group-hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-[18px]">videocam_off</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Mute video upon entry</p>
                  <p className="text-[11px] text-gray-400">Automatically block participants' cameras</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={hostSettings.muteVideoOnEntry}
                  onChange={() => handleToggleHostSetting("muteVideoOnEntry")}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {/* Chat Enabled */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-transparent hover:border-white/10 transition-colors group">
              <div className="flex gap-3 items-center">
                <div className="p-1.5 rounded-lg bg-black/20 text-gray-400 group-hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-[18px]">chat</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Allow chat messages</p>
                  <p className="text-[11px] text-gray-400">Allow participants to send chat messages</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={hostSettings.chatEnabled}
                  onChange={() => handleToggleHostSetting("chatEnabled")}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {/* Screen Share Enabled */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-transparent hover:border-white/10 transition-colors group">
              <div className="flex gap-3 items-center">
                <div className="p-1.5 rounded-lg bg-black/20 text-gray-400 group-hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-[18px]">screen_share</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Allow screen sharing</p>
                  <p className="text-[11px] text-gray-400">Allow participants to share their screen</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={hostSettings.screenShareEnabled}
                  onChange={() => handleToggleHostSetting("screenShareEnabled")}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        );
      default:
        return (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-gray-300">
            This meeting does not have any additional in-call settings for attendees yet.
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#111418] text-white rounded-2xl w-full max-w-3xl h-[560px] flex flex-col md:flex-row border border-white/5 overflow-hidden shadow-2xl">
        {/* Modal Sidebar */}
        <aside className="w-full md:w-56 bg-[#0a0c0f] flex flex-col border-b md:border-b-0 md:border-r border-white/5 shrink-0 p-4 gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">settings</span>
              Settings
            </h2>
          </div>

          {navItems.length > 0 ? (
            <nav className="flex flex-col gap-1 flex-grow">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all w-full text-left group ${
                    activeTab === item.id
                      ? "bg-primary text-white font-semibold"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span className={`material-symbols-outlined text-[18px] ${activeTab === item.id ? "text-white" : "text-gray-400 group-hover:text-white"}`}>
                    {item.icon}
                  </span>
                  <span className="text-xs">{item.label}</span>
                </button>
              ))}
            </nav>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-gray-400">
              No extra in-meeting settings are available for attendees.
            </div>
          )}
        </aside>

        {/* Modal Main Content */}
        <main className="flex-grow flex flex-col min-w-0 bg-[#111418] relative h-full">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
            <h2 className="text-base font-bold text-white capitalize">{activeTab} Settings</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default InMeetingSettingsModal;
