import React, { useState, useEffect } from "react";
import { useTracks, VideoTrack } from "@livekit/components-react";
import { isTrackReference } from "@livekit/components-core";
import { Track } from "livekit-client";

const ParticipantGrid = ({ sidebarOpen, currentHostId }) => {
    // Lấy tất cả tracks từ phòng họp
    const tracks = useTracks([
        { source: Track.Source.Camera, withPlaceholder: true },
        { source: Track.Source.ScreenShare, withPlaceholder: false },
    ], {
        onlySubscribed: false,
    });

    // 1. Tách biệt màn hình share và camera
    const screenShareTrack = tracks.find(
        (t) => isTrackReference(t) && t.source === Track.Source.ScreenShare,
    );
    const cameraTracks = tracks.filter(t => t.source !== Track.Source.ScreenShare);

    // 2. Hàm tính toán Grid CSS
    const getGridClass = (count) => {
        if (count === 0) return "";
        if (count === 1) return "grid-cols-1";
        if (count <= 4) return "grid-cols-1 md:grid-cols-2";
        if (count <= 9) return "grid-cols-2 lg:grid-cols-3";
        return "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
    };

    return (
        <main className={`flex-grow w-full h-full p-4 transition-all duration-300 ${sidebarOpen ? "lg:pr-[320px]" : ""}`}>
            <div className="h-full max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-4">

                {/* VÙNG HIỂN THỊ CHÍNH (SPOTLIGHT) */}
                <div className={`flex-grow flex items-center justify-center bg-black/20 rounded-3xl overflow-hidden min-h-[50vh] transition-all ${screenShareTrack ? 'lg:w-3/4' : 'w-full'}`}>
                    {screenShareTrack ? (
                        <ParticipantTile trackRef={screenShareTrack} isLarge currentHostId={currentHostId} />
                    ) : (
                        <div className={`grid gap-4 w-full h-full auto-rows-fr ${getGridClass(cameraTracks.length)}`}>
                            {cameraTracks.map((t) => (
                                <ParticipantTile key={`${t.participant.sid}-${t.source}`} trackRef={t} currentHostId={currentHostId} />
                            ))}
                        </div>
                    )}
                </div>

                {/* THANH SIDEBAR (Chỉ hiện khi đang có người share màn hình) */}
                {screenShareTrack && cameraTracks.length > 0 && (
                    <div className="lg:w-1/4 flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto pb-2 lg:pb-0 scrollbar-hide">
                        {cameraTracks.map((t) => (
                            <div key={`${t.participant.sid}-${t.source}`} className="min-w-[200px] lg:min-w-full aspect-video">
                                <ParticipantTile trackRef={t} currentHostId={currentHostId} />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* CSS Animation cho nút giơ tay */}
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes handBounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}} />
        </main>
    );
};

// Component hiển thị từng Participant
const ParticipantTile = ({ trackRef, isLarge = false, currentHostId }) => {
    // Lấy thông tin participant trực tiếp từ trackRef (Thay thế cho useParticipant)
    const p = trackRef.participant;
    const isScreenShare = trackRef.source === Track.Source.ScreenShare;
    const hasVideoTrack = isTrackReference(trackRef);
    const name = p.name || p.identity || "Unknown";
    const isHost = String(p.identity || "") === String(currentHostId || "");

    const [isHandRaised, setIsHandRaised] = useState(false);

    // Lắng nghe sự kiện giơ tay (Custom Event)
    useEffect(() => {
        const handleHandRaise = (e) => {
            if (e.detail?.identity === p.identity) {
                setIsHandRaised(e.detail.isRaised);
            }
        };
        window.addEventListener('hand_raise', handleHandRaise);
        return () => window.removeEventListener('hand_raise', handleHandRaise);
    }, [p.identity]);

    return (
        <div className={`group relative bg-gray-900 rounded-2xl overflow-hidden border-2 transition-all shadow-lg w-full h-full ${
            p.isSpeaking && !isScreenShare ? "border-blue-500 shadow-blue-500/20" : "border-white/5"
        }`}>
            {/* Video hoặc Avatar */}
            {(hasVideoTrack && (p.isCameraEnabled || isScreenShare)) ? (
                <VideoTrack
                    trackRef={trackRef}
                    className={`w-full h-full ${isScreenShare ? 'object-contain' : 'object-cover'} bg-black`}
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-black">
                    <img
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`}
                        alt={name}
                        className={`${isLarge ? 'w-32 h-32' : 'w-16 h-16'} rounded-full border-4 border-white/10`}
                    />
                </div>
            )}

            {/* Overlay thông tin tên */}
            <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg flex items-center gap-2">
                <span className="text-[11px] font-medium text-white">
                    {name} {p.isLocal && "(You)"} {isScreenShare && " presenting"}
                </span>
                {isHost && (
                    <span className="rounded-full bg-primary/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                        Host
                    </span>
                )}

                {/* Icon Mic tắt */}
                {!p.isMicrophoneEnabled && !isScreenShare && (
                    <span className="material-symbols-outlined text-red-500 text-[14px]">mic_off</span>
                )}
            </div>

            {/* Icon Giơ tay */}
            {isHandRaised && !isScreenShare && (
                <div className="absolute top-3 right-3 bg-yellow-500 text-white p-1.5 rounded-full shadow-lg flex items-center justify-center"
                     style={{ animation: 'handBounce 1s infinite' }}>
                    <span className="material-symbols-outlined text-[16px]">front_hand</span>
                </div>
            )}
        </div>
    );
};

export default ParticipantGrid;
