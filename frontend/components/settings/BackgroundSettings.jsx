import React, { useState } from 'react';

const BackgroundSettings = () => {
  const [selectedBg, setSelectedBg] = useState(
    localStorage.getItem('ptitmeet_selectedBg') || 'none'
  );

  const handleSelect = (id) => {
    setSelectedBg(id);
    localStorage.setItem('ptitmeet_selectedBg', id);
  };

  const backgrounds = [
    { id: 'none', label: 'None', icon: 'block' },
    { id: 'blur', label: 'Blur', icon: 'blur_on' },
    { id: 'bg1', label: 'Office', image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=200&h=120' },
    { id: 'bg2', label: 'Living Room', image: 'https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&q=80&w=200&h=120' },
    { id: 'bg3', label: 'Nature', image: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&q=80&w=200&h=120' },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      <div className="space-y-4">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Virtual Background</label>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {backgrounds.map((bg) => (
            <button
              key={bg.id}
              onClick={() => handleSelect(bg.id)}
              className={`relative aspect-video rounded-xl overflow-hidden border-2 transition-all ${
                selectedBg === bg.id ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:border-white/20'
              }`}
            >
              {bg.image ? (
                <img src={bg.image} alt={bg.label} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-white/5 flex items-center justify-center">
                  <span className="material-symbols-outlined text-3xl text-gray-400">{bg.icon}</span>
                </div>
              )}
              {selectedBg === bg.id && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-md">
                  <span className="material-symbols-outlined text-white text-[14px]">check</span>
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-black/60 backdrop-blur-sm text-[10px] text-white font-medium text-center">
                {bg.label}
              </div>
            </button>
          ))}
          
          <button className="aspect-video rounded-xl bg-white/5 border border-dashed border-white/20 hover:border-white/40 hover:bg-white/10 transition-all flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-white">
            <span className="material-symbols-outlined text-2xl">add_photo_alternate</span>
            <span className="text-[10px] font-medium">Add Image</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default BackgroundSettings;
