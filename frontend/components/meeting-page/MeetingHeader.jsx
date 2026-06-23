import React from "react";

const MeetingHeader = ({ code, isHost, isOwner, isRecordingActive }) => (
    <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6 bg-background/80 backdrop-blur-md z-30 shrink-0 border-b border-white/5">
        <div className="min-w-0 flex flex-col">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{code}</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
            {isRecordingActive && (
                <span className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/12 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-red-300">
                    <span className="block size-2 rounded-full bg-red-500 animate-pulse"></span>
                    Recording
                </span>
            )}
            {isOwner && (
                <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300">
                    Owner
                </span>
            )}
            {isHost && (
                <span className="rounded-full border border-primary/20 bg-primary/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
                    Host
                </span>
            )}
        </div>
    </header>
);

export default MeetingHeader;
