import React from "react";

const LeaveModal = ({ isOpen, onClose, onConfirm, isHost }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-white/10 p-6 rounded-3xl shadow-2xl w-full max-w-sm flex flex-col gap-6 animate-in fade-in zoom-in duration-200">
        <div>
          <h3 className="text-xl font-bold text-white mb-2">Leave meeting?</h3>
          {isHost ? (
            <p className="text-sm text-gray-400">
              You are the host. Do you want to just leave, or end the meeting for everyone?
            </p>
          ) : (
            <p className="text-sm text-gray-400">
              Are you sure you want to leave this meeting?
            </p>
          )}
        </div>
        
        <div className="flex flex-col gap-3">
          {isHost && (
            <button 
              onClick={() => onConfirm("END")}
              className="w-full py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-colors"
            >
              End meeting for all
            </button>
          )}
          <button 
            onClick={() => onConfirm("LEAVE")}
            className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-colors"
          >
            {isHost ? "Just leave" : "Leave Call"}
          </button>
          <button 
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-transparent text-gray-400 hover:text-white font-bold transition-colors mt-2"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeaveModal;