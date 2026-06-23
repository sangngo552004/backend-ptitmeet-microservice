import React, { useState, useEffect, useRef } from 'react';
import Select from '../Select';

const VideoSettings = ({ room }) => {
  const [mirrorVideo, setMirrorVideo] = useState(
    JSON.parse(localStorage.getItem('ptitmeet_mirrorVideo') || 'true')
  );
  const [hdVideo, setHdVideo] = useState(
    JSON.parse(localStorage.getItem('ptitmeet_hdVideo') || 'false')
  );

  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(localStorage.getItem('ptitmeet_selectedCamera') || '');
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        setCameras(videoDevices);
        if (videoDevices.length > 0 && !selectedCamera) {
          const defaultCam = videoDevices[0].deviceId;
          setSelectedCamera(defaultCam);
          localStorage.setItem('ptitmeet_selectedCamera', defaultCam);
        }
      } catch (err) {
        console.error("Error accessing camera.", err);
      }
    };
    getDevices();
  }, []);

  useEffect(() => {
    let currentStream = null;

    const startPreview = async () => {
      if (selectedCamera) {
        try {
          const newStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: selectedCamera } }
          });
          setStream(newStream);
          currentStream = newStream;
          if (videoRef.current) {
            videoRef.current.srcObject = newStream;
          }
        } catch (err) {
          console.error("Error starting camera preview", err);
        }
      }
    };
    
    startPreview();
    
    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [selectedCamera]);

  const handleToggle = (setter, key, value) => {
    setter(value);
    localStorage.setItem(key, JSON.stringify(value));
  };

  const handleSelect = (setter, key, value) => {
    setter(value);
    localStorage.setItem(key, value);
    if (room) {
      room.switchActiveDevice('videoinput', value);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      {/* Camera Section */}
      <div className="space-y-3">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Camera</label>
        <Select
          icon="videocam"
          value={selectedCamera}
          onChange={(e) => handleSelect(setSelectedCamera, 'ptitmeet_selectedCamera', e.target.value)}
          options={cameras.length > 0 ? cameras.map(cam => ({
            value: cam.deviceId,
            label: cam.label || `Camera ${cam.deviceId.substring(0, 5)}...`
          })) : [{ value: selectedCamera, label: 'No cameras found' }]}
        />

        {/* Video Preview */}
        <div className="w-full aspect-video bg-black/40 rounded-xl border border-white/10 flex items-center justify-center overflow-hidden relative group mt-4">
          {stream ? (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className={`w-full h-full object-cover ${mirrorVideo ? 'scale-x-[-1]' : ''}`} 
            />
          ) : (
            <span className="material-symbols-outlined text-4xl text-gray-500 group-hover:scale-110 transition-transform">videocam_off</span>
          )}
          
          <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${stream ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-[10px] text-white font-medium">{stream ? 'Camera on' : 'Camera off'}</span>
          </div>
        </div>
      </div>

      <div className="h-px bg-white/10 w-full"></div>

      {/* Video Settings */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Video Quality & Behavior</h3>
        
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-transparent hover:border-white/10 transition-colors group">
          <div className="flex gap-3 items-center">
            <div className="p-1.5 rounded-lg bg-black/20 text-gray-400 group-hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[18px]">flip</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Mirror my video</p>
              <p className="text-[11px] text-gray-400">See yourself as you look in a mirror</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={mirrorVideo}
              onChange={(e) => handleToggle(setMirrorVideo, 'ptitmeet_mirrorVideo', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-transparent hover:border-white/10 transition-colors group">
          <div className="flex gap-3 items-center">
            <div className="p-1.5 rounded-lg bg-black/20 text-gray-400 group-hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[18px]">hd</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Enable HD</p>
              <p className="text-[11px] text-gray-400">Send high definition video</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={hdVideo}
              onChange={(e) => handleToggle(setHdVideo, 'ptitmeet_hdVideo', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
      </div>
    </div>
  );
};

export default VideoSettings;
