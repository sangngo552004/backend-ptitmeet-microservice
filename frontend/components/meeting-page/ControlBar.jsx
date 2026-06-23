import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useRoomContext, useLocalParticipant } from "@livekit/components-react";
import LeaveModal from "./LeaveModal";
import { meetingService } from "../../services/meetingService";
import DevicePermissionModal from "./DevicePermissionModal";
import InMeetingSettingsModal from "./InMeetingSettingsModal";
import {
    getPermissionErrorMessage,
    isPermissionDeniedError,
    requestDeviceAccess,
    stopMediaStream,
} from "../../utils/mediaPermissions";
import { SYSTEM_ACTION_TYPES, createSystemActionPayload } from "../../utils/meetingRealtime";

const ControlBar = ({
    sidebarOpen, setSidebarOpen, activeTab, setActiveTab, waitingCount, unreadCount, isHost, isOwner, code, stompClient, meetingSettings
}) => {
    const navigate = useNavigate();
    const room = useRoomContext();
    const [isRecord, setIsRecord] = useState(false)
    const [egressId, setEgressId] = useState(null)
    const egressIdRef = useRef(null);
    const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [isHandRaised, setIsHandRaised] = useState(false);
    const [showReactions, setShowReactions] = useState(false);
    const [permissionModal, setPermissionModal] = useState({ isOpen: false, device: null });
    const [permissionError, setPermissionError] = useState("");
    const [isRequestingPermission, setIsRequestingPermission] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);

    React.useEffect(() => {
        const handleSystemAction = async (e) => {
            if (!localParticipant) return;
            const action = e.detail;
            if ((action === 'MUTE_ALL' || action === 'MUTE_PARTICIPANT') && isMicrophoneEnabled) {
                await localParticipant.setMicrophoneEnabled(false);
            } else if ((action === 'STOP_CAMERA_ALL' || action === 'STOP_CAMERA_PARTICIPANT') && isCameraEnabled) {
                await localParticipant.setCameraEnabled(false);
            }
        };

        window.addEventListener('SYSTEM_ACTION', handleSystemAction);
        return () => window.removeEventListener('SYSTEM_ACTION', handleSystemAction);
    }, [localParticipant, isMicrophoneEnabled, isCameraEnabled]);

    const handleRecordMeeting = async () => {
        if (!isOwner) {
            return;
        }
        try {
            if (!isRecord) {
                const recordRes = await meetingService.startRecordMeeting(code);
                console.log("Start recording response:", JSON.stringify(recordRes.data));
                const id = recordRes.data?.data?.egressId || recordRes.data?.data?.egress_id;
                console.log("Extracted egressId:", id);
                setEgressId(id);
                egressIdRef.current = id;
                if (stompClient?.active && localParticipant) {
                    stompClient.publish({
                        destination: `/app/meeting/${code}/system`,
                        body: createSystemActionPayload(SYSTEM_ACTION_TYPES.RECORDING_STARTED, {
                            actorId: localParticipant.identity,
                            actorName: localParticipant.name || "Meeting owner",
                        }),
                    });
                }
            } else {
                const currentEgressId = egressIdRef.current;
                console.log("Stopping with egressId:", currentEgressId);
                await meetingService.endRecordMeeting(currentEgressId);
                setEgressId(null);
                egressIdRef.current = null;
                if (stompClient?.active && localParticipant) {
                    stompClient.publish({
                        destination: `/app/meeting/${code}/system`,
                        body: createSystemActionPayload(SYSTEM_ACTION_TYPES.RECORDING_STOPPED, {
                            actorId: localParticipant.identity,
                            actorName: localParticipant.name || "Meeting owner",
                        }),
                    });
                }
            }
            setIsRecord(!isRecord);
        } catch (error) {
            console.error("Recording error:", error);
            alert("Recording error: " + (error.response?.data?.message || error.message));
        }
    };
    
    const toggleMic = async () => {
        if (localParticipant) {
            if (!isMicrophoneEnabled) {
                try {
                    await localParticipant.setMicrophoneEnabled(true);
                } catch (error) {
                    console.error("Unable to enable microphone:", error);
                    if (isPermissionDeniedError(error)) {
                        setPermissionError(getPermissionErrorMessage(error, "microphone"));
                        setPermissionModal({ isOpen: true, device: "microphone" });
                    }
                }
                return;
            }
            await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
        }
    };

    const toggleCam = async () => {
        if (localParticipant) {
            if (!isCameraEnabled) {
                try {
                    await localParticipant.setCameraEnabled(true);
                } catch (error) {
                    console.error("Unable to enable camera:", error);
                    if (isPermissionDeniedError(error)) {
                        setPermissionError(getPermissionErrorMessage(error, "camera"));
                        setPermissionModal({ isOpen: true, device: "camera" });
                    }
                }
                return;
            }
            await localParticipant.setCameraEnabled(!isCameraEnabled);
        }
    };

    const handlePermissionRequest = async () => {
        if (!localParticipant || !permissionModal.device) return;

        const wantsMicrophone = permissionModal.device === "microphone";

        try {
            setIsRequestingPermission(true);
            setPermissionError("");

            const { stream } = await requestDeviceAccess({
                audio: wantsMicrophone,
                video: !wantsMicrophone,
            });

            stopMediaStream(stream);

            if (wantsMicrophone) {
                await localParticipant.setMicrophoneEnabled(true);
            } else {
                await localParticipant.setCameraEnabled(true);
            }

            setPermissionModal({ isOpen: false, device: null });
        } catch (error) {
            console.error("Device permission request failed:", error);
            setPermissionError(
                getPermissionErrorMessage(error, wantsMicrophone ? "microphone" : "camera")
            );
        } finally {
            setIsRequestingPermission(false);
        }
    };

    const toggleScreenShare = async () => {
        if (localParticipant) {
            await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
        }
    };

    const toggleHandRaise = async () => {
        const newHandRaisedState = !isHandRaised;
        setIsHandRaised(newHandRaisedState);
        
        if (localParticipant) {
            const event = new CustomEvent('hand_raise', { 
                detail: { identity: localParticipant.identity, isRaised: newHandRaisedState }
            });
            window.dispatchEvent(event);
            
            if (room) {
                const encoder = new TextEncoder();
                const data = JSON.stringify({ isRaised: newHandRaisedState });
                await room.localParticipant.publishData(encoder.encode(data), {
                    reliable: true,
                    topic: 'hand_raise'
                });
            }
        }
    };

    const sendReaction = async (emoji) => {
        if (room && localParticipant) {
            const reactionPayload = {
                emoji,
                senderId: localParticipant.identity,
                senderName: localParticipant.name || localParticipant.identity || "You",
            };

            window.dispatchEvent(new CustomEvent("reaction", {
                detail: reactionPayload,
            }));

            const encoder = new TextEncoder();
            const data = JSON.stringify(reactionPayload);
            await room.localParticipant.publishData(encoder.encode(data), {
                reliable: true,
                topic: 'reaction'
            });
        }
    };

    const handleProcessLeave = async (action) => {
        try {
            if (action === "END") {
                await meetingService.endMeetingForAll(code);
            } else {
                await meetingService.leaveMeeting(code);
            }

            if (stompClient && stompClient.active) {
                stompClient.deactivate();
            }

            if (room) {
                room.disconnect();
            }

            navigate("/summary", {
                state: {
                    meetingCode: code,
                    actionTaken: action,
                    isHost: isHost
                }
            });
        } catch (error) {
            alert("Unable to leave the meeting: " + error.message);
        }
    };

    const onLeaveButtonClicked = () => {
        if (isHost) {
            setShowLeaveModal(true);
        } else {
            setShowLeaveModal(true);
        }
    };

    return (
        <>
            <DevicePermissionModal
                isOpen={permissionModal.isOpen}
                device={permissionModal.device}
                errorMessage={permissionError}
                isRequesting={isRequestingPermission}
                onClose={() => {
                    setPermissionError("");
                    setPermissionModal({ isOpen: false, device: null });
                }}
                onRequestAccess={handlePermissionRequest}
            />
            <LeaveModal
                isOpen={showLeaveModal}
                onClose={() => setShowLeaveModal(false)}
                onConfirm={handleProcessLeave}
                isHost={isHost}
            />
            <footer className="w-full px-3 pb-3 pt-2 relative z-40 bg-background shrink-0 border-t border-white/5">
                <div className="mx-auto flex max-w-full flex-wrap items-center justify-center gap-2 rounded-[28px] border border-white/10 bg-surface/90 p-2 shadow-2xl backdrop-blur-xl md:flex-nowrap md:gap-3">

                    <button
                        onClick={toggleMic}
                        className={`size-12 rounded-full flex items-center justify-center transition-all ${
                            isMicrophoneEnabled ? "bg-white/10 hover:bg-white/20 text-white" : "bg-red-500 text-white shadow-lg shadow-red-500/20"
                            }`}
                    >
                        <span className="material-symbols-outlined">{isMicrophoneEnabled ? "mic" : "mic_off"}</span>
                    </button>

                    <button
                        onClick={toggleCam}
                        className={`size-12 rounded-full flex items-center justify-center transition-all ${
                            isCameraEnabled ? "bg-white/10 hover:bg-white/20 text-white" : "bg-red-500 text-white shadow-lg shadow-red-500/20"
                            }`}
                    >
                        <span className="material-symbols-outlined">{isCameraEnabled ? "videocam" : "videocam_off"}</span>
                    </button>

                    <div className="w-px h-8 bg-white/10 mx-1"></div>

                    <button
                        onClick={() => {
                            const isScreenShareAllowed = isHost || meetingSettings?.screenShareEnabled !== false;
                            if (!isScreenShareAllowed) {
                                alert("Screen sharing has been disabled by the host.");
                                return;
                            }
                            toggleScreenShare();
                        }}
                        className={`size-12 rounded-full flex items-center justify-center transition-all ${
                            isScreenShareEnabled ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-white/10 hover:bg-white/20 text-white"
                            } ${(!isHost && meetingSettings?.screenShareEnabled === false) ? "opacity-40 cursor-not-allowed" : ""}`}
                        title={(!isHost && meetingSettings?.screenShareEnabled === false) ? "Screen sharing has been disabled by the host" : "Share screen"}
                    >
                        <span className="material-symbols-outlined text-[22px]">
                            {isScreenShareEnabled ? "stop_screen_share" : "present_to_all"}
                        </span>
                    </button>

                    <button
                        onClick={toggleHandRaise}
                        className={`size-12 rounded-full flex items-center justify-center transition-all ${
                            isHandRaised ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-white/10 hover:bg-white/20 text-white"
                        }`}
                    >
                        <span className="material-symbols-outlined text-[22px]">front_hand</span>
                    </button>

                    <div className="relative">
                        <button 
                            onClick={() => setShowReactions(!showReactions)}
                            className={`size-12 rounded-full flex items-center justify-center transition-all ${
                                showReactions ? "bg-white/30 text-white" : "bg-white/10 hover:bg-white/20 text-white"
                            }`}
                        >
                            <span className="material-symbols-outlined text-[22px]">sentiment_satisfied</span>
                        </button>
                        
                        {showReactions && (
                            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2 bg-surface/90 backdrop-blur-xl p-2 rounded-full border border-white/10 shadow-2xl">
                                {['👍', '❤️', '👏', '😂', '🎉', '😮'].map(emoji => (
                                    <button
                                        key={emoji}
                                        onClick={() => sendReaction(emoji)}
                                        className="text-2xl hover:scale-125 transition-transform p-2 rounded-full hover:bg-white/10"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => { setSidebarOpen(sidebarOpen && activeTab === "chat" ? false : true); setActiveTab("chat"); }}
                        className={`relative size-12 rounded-full flex items-center justify-center transition-all ${
                            sidebarOpen && activeTab === "chat" ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-white/10 hover:bg-white/20 text-white"
                            }`}
                    >
                        <span className="material-symbols-outlined text-[22px]">chat_bubble</span>
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white border border-background">
                                {unreadCount > 9 ? "9+" : unreadCount}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => { setSidebarOpen(sidebarOpen && activeTab === "people" ? false : true); setActiveTab("people"); }}
                        className={`relative size-12 rounded-full flex items-center justify-center transition-all ${
                            sidebarOpen && activeTab === "people" ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-white/10 hover:bg-white/20 text-white"
                            }`}
                    >
                        <span className="material-symbols-outlined text-[22px]">group</span>
                        {isHost && waitingCount > 0 && (
                            <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold border border-background animate-bounce">
                                {waitingCount}
                            </span>
                        )}
                    </button>

                    {isHost && (
                        <div className="relative">
                            <button
                                onClick={() => setShowMoreMenu(!showMoreMenu)}
                                className={`size-12 rounded-full flex items-center justify-center transition-all ${
                                    showMoreMenu ? "bg-white/30 text-white" : "bg-white/10 hover:bg-white/20 text-white"
                                }`}
                            >
                                <span className="material-symbols-outlined text-[22px]">more_vert</span>
                            </button>
                            
                            {showMoreMenu && (
                                <div className="absolute bottom-16 left-1/2 z-[60] flex min-w-44 -translate-x-1/2 flex-col gap-1 rounded-xl border border-white/10 bg-surface/95 p-2 shadow-2xl backdrop-blur">
                                    <button
                                        onClick={() => {
                                            setShowSettings(true);
                                            setShowMoreMenu(false);
                                        }}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 text-gray-200 hover:text-white transition-colors text-left"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">settings</span>
                                        <span className="text-xs font-semibold">Host controls</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="w-px h-8 bg-white/10 mx-1"></div>
                    <button
                        onClick={handleRecordMeeting}
                        disabled={!isOwner}
                        className={`size-12 rounded-full flex items-center justify-center transition-all ${
                            isRecord
                                ? "bg-red-500 text-white shadow-lg shadow-red-500/20"
                                : "bg-white/10 text-white"
                        } ${isOwner ? "hover:bg-white/20" : "cursor-not-allowed opacity-40"}`}
                        title={isOwner ? "Record meeting" : "Only the meeting owner can record"}
                    >
                        <span className="material-symbols-outlined text-[22px]">
                            {isRecord ? "screen_record" : "fiber_manual_record"}
                        </span>
                    </button>

                    <button
                        onClick={onLeaveButtonClicked}
                        className="min-w-[120px] px-6 py-3 rounded-full bg-red-500 hover:bg-red-600 text-white font-black text-sm shadow-xl shadow-red-500/20 active:scale-95 transition-all"
                    >
                        Leave Call
                    </button>
                </div>
            </footer>
            <InMeetingSettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                isHost={isHost}
                code={code}
                room={room}
            />
        </>
    );
};

export default ControlBar;
