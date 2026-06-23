import React, { useState, useEffect } from 'react';
import Select from '../Select';

const AudioSettings = ({ room }) => {
  const [noiseCancellation, setNoiseCancellation] = useState(
    JSON.parse(localStorage.getItem('ptitmeet_noiseCancellation') || 'true')
  );
  const [echoReduction, setEchoReduction] = useState(
    JSON.parse(localStorage.getItem('ptitmeet_echoReduction') || 'false')
  );
  const [autoVolume, setAutoVolume] = useState(
    JSON.parse(localStorage.getItem('ptitmeet_autoVolume') || 'true')
  );

  const [microphones, setMicrophones] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [selectedMic, setSelectedMic] = useState(localStorage.getItem('ptitmeet_selectedMic') || '');
  const [selectedSpeaker, setSelectedSpeaker] = useState(localStorage.getItem('ptitmeet_selectedSpeaker') || '');
  const [inputLevel, setInputLevel] = useState(0);

  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        const mics = devices.filter(device => device.kind === 'audioinput');
        const spks = devices.filter(device => device.kind === 'audiooutput');
        
        setMicrophones(mics);
        setSpeakers(spks);
        
        if (mics.length > 0 && !selectedMic) setSelectedMic(mics[0].deviceId);
        if (spks.length > 0 && !selectedSpeaker) setSelectedSpeaker(spks[0].deviceId);
      } catch (err) {
        console.error("Error accessing media devices.", err);
      }
    };

    getDevices();
  }, []);

  // Simulate audio input level
  useEffect(() => {
    const interval = setInterval(() => {
      setInputLevel(Math.random() * 80 + 10);
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = (setter, key, value) => {
    setter(value);
    localStorage.setItem(key, JSON.stringify(value));
  };

  const handleSelect = (setter, key, value) => {
    setter(value);
    localStorage.setItem(key, value);
    if (room) {
      if (key === 'ptitmeet_selectedMic') {
        room.switchActiveDevice('audioinput', value);
      } else if (key === 'ptitmeet_selectedSpeaker') {
        room.switchActiveDevice('audiooutput', value);
      }
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      {/* Microphone Section */}
      <div className="space-y-3">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Microphone</label>
        <Select
          icon="mic"
          value={selectedMic}
          onChange={(e) => handleSelect(setSelectedMic, 'ptitmeet_selectedMic', e.target.value)}
          options={microphones.length > 0 ? microphones.map(mic => ({
            value: mic.deviceId,
            label: mic.label || `Microphone ${mic.deviceId.substring(0, 5)}...`
          })) : [{ value: selectedMic, label: 'No microphones found' }]}
        />

        {/* Input Level */}
        <div className="bg-white/5 rounded-lg p-3 border border-white/10 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-surface-dark flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[18px]">graphic_eq</span>
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <div className="flex justify-between text-[10px] text-gray-400 font-medium uppercase">
              <span>Input Level</span>
              <span className={inputLevel > 30 ? "text-primary" : "text-gray-500"}>{inputLevel > 30 ? "Good" : "Low"}</span>
            </div>
            <div className="h-1.5 w-full bg-surface-dark rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-200" style={{ width: `${inputLevel}%` }}></div>
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer group mt-2 w-fit">
          <input
            type="checkbox"
            checked={autoVolume}
            onChange={(e) => handleToggle(setAutoVolume, 'ptitmeet_autoVolume', e.target.checked)}
            className="rounded border-gray-600 bg-surface-darker text-primary focus:ring-1 focus:ring-primary size-4"
          />
          <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">Auto-adjust volume</span>
        </label>
      </div>

      <div className="h-px bg-white/10 w-full"></div>

      {/* Speakers Section */}
      <div className="space-y-3">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Speakers</label>
        <div className="flex gap-3 items-start flex-col sm:flex-row">
          <div className="flex-1 w-full">
            <Select
              icon="volume_up"
              value={selectedSpeaker}
              onChange={(e) => handleSelect(setSelectedSpeaker, 'ptitmeet_selectedSpeaker', e.target.value)}
              options={speakers.length > 0 ? speakers.map(spk => ({
                value: spk.deviceId,
                label: spk.label || `Speaker ${spk.deviceId.substring(0, 5)}...`
              })) : [{ value: selectedSpeaker, label: 'System Default Audio' }]}
            />
          </div>
          <button className="h-10 px-4 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium border border-white/10 transition-colors flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">play_arrow</span>
            Test
          </button>
        </div>
      </div>

      <div className="h-px bg-white/10 w-full"></div>

      {/* Enhancements */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Enhancements</h3>
        
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-transparent hover:border-white/10 transition-colors group">
          <div className="flex gap-3 items-center">
            <div className="p-1.5 rounded-lg bg-black/20 text-gray-400 group-hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[18px]">blur_on</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Noise Cancellation</p>
              <p className="text-[11px] text-gray-400">Reduce background noise</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={noiseCancellation}
              onChange={(e) => handleToggle(setNoiseCancellation, 'ptitmeet_noiseCancellation', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-transparent hover:border-white/10 transition-colors group">
          <div className="flex gap-3 items-center">
            <div className="p-1.5 rounded-lg bg-black/20 text-gray-400 group-hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[18px]">settings_voice</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Echo Reduction</p>
              <p className="text-[11px] text-gray-400">Prevent audio feedback</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={echoReduction}
              onChange={(e) => handleToggle(setEchoReduction, 'ptitmeet_echoReduction', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

      </div>
    </div>
  );
};

export default AudioSettings;
