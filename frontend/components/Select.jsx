import React, { useState, useRef, useEffect } from 'react';

const Select = ({ value, onChange, options, icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative group w-full" ref={dropdownRef}>
      {icon && (
        <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 transition-colors text-[18px] z-10 pointer-events-none">
          {icon}
        </span>
      )}
      <div 
        className={`w-full h-10 ${icon ? 'pl-10' : 'pl-4'} pr-10 bg-white/5 text-white border border-white/10 rounded-lg outline-none text-sm cursor-pointer flex items-center justify-between transition-all hover:bg-white/10 ${isOpen ? 'ring-1 ring-primary border-primary bg-white/10' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : 'Select...'}</span>
        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          expand_more
        </span>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#1a1d21] border border-white/10 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200 py-1.5 max-h-60 overflow-y-auto">
          {options.length > 0 ? (
            options.map((option) => (
              <div
                key={option.value}
                className={`px-3 py-2.5 mx-1.5 rounded-lg text-sm cursor-pointer transition-colors flex items-center justify-between ${
                  value === option.value 
                    ? 'bg-primary/20 text-primary font-medium' 
                    : 'text-gray-300 hover:bg-white/5 hover:text-white'
                }`}
                onClick={() => {
                  onChange({ target: { value: option.value } });
                  setIsOpen(false);
                }}
              >
                <span className="truncate">{option.label}</span>
                {value === option.value && (
                  <span className="material-symbols-outlined text-[16px]">check</span>
                )}
              </div>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-gray-500 italic">No options available</div>
          )}
        </div>
      )}
    </div>
  );
};

export default Select;
