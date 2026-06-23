import React, { useState, useRef, useEffect } from "react";
import { useParticipants } from "@livekit/components-react";
import { meetingService } from "../../services/meetingService.js"; // Đảm bảo import đúng đường dẫn
import ActionConfirmModal from "./ActionConfirmModal";
import {
    SYSTEM_ACTION_TYPES,
    createSystemActionPayload,
} from "../../utils/meetingRealtime";

const buildMessageKey = (msg) => {
    if (msg?.id) return `id:${msg.id}`;
    return `tmp:${msg?.senderId || "unknown"}:${msg?.content || ""}:${msg?.timestamp || ""}`;
};

const MeetingSidebar = ({
                            sidebarOpen, activeTab, setActiveTab,
                            isHost, currentHostId, waitingList, isLoadingWaiting, handleApproval, fetchWaitingList,
                        stompClient, isStompConnected, currentUser, meetingCode, onIncomingMessage, meetingSettings
                        }) => {
    const chatEndRef = useRef(null);
    const participants = useParticipants();
    const [confirmState, setConfirmState] = useState({
        isOpen: false,
        title: "",
        description: "",
        confirmLabel: "",
        payload: null,
    });

    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState("");
    const [isLoadingChat, setIsLoadingChat] = useState(false);
    const currentUserId = currentUser?.userId || currentUser?.id;
    const currentUserName = currentUser?.fullName || currentUser?.name || "You";

    const upsertMessages = (incoming) => {
        const nextItems = Array.isArray(incoming) ? incoming : [incoming];
        setMessages((prev) => {
            const merged = [...prev];
            const existingKeys = new Set(prev.map(buildMessageKey));

            nextItems.forEach((item) => {
                const key = buildMessageKey(item);
                if (!existingKeys.has(key)) {
                    merged.push(item);
                    existingKeys.add(key);
                }
            });

            return merged.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
        });
    };

    useEffect(() => {
        if (meetingCode) {
            fetchHistory();
        }
    }, [meetingCode]);

    const fetchHistory = async () => {
        try {
            setIsLoadingChat(true);
            const data = await meetingService.getChatHistory(meetingCode);
            setMessages(data || []);
        } catch (error) {
            console.error("Unable to load chat history:", error);
        } finally {
            setIsLoadingChat(false);
        }
    };

    useEffect(() => {
        if (!stompClient || !isStompConnected || !meetingCode) return;

        const chatSubscription = stompClient.subscribe(
            `/topic/meeting/${meetingCode}/chat`,
            (message) => {
                const newMsg = JSON.parse(message.body);
                upsertMessages(newMsg);
                onIncomingMessage?.(newMsg);
            }
        );

        return () => chatSubscription.unsubscribe();
    }, [meetingCode, onIncomingMessage, stompClient, isStompConnected]);

    useEffect(() => {
        if (isStompConnected && sidebarOpen && activeTab === "chat") {
            fetchHistory();
        }
    }, [isStompConnected, sidebarOpen, activeTab, meetingCode]);

    useEffect(() => {
        if (!meetingCode) {
            return;
        }

        const syncHistory = async () => {
            try {
                const data = await meetingService.getChatHistory(meetingCode);
                upsertMessages(data || []);
            } catch (error) {
                console.error("Unable to sync chat:", error);
            }
        };

        syncHistory();
        const intervalId = window.setInterval(syncHistory, 2500);

        return () => window.clearInterval(intervalId);
    }, [meetingCode]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, sidebarOpen, activeTab]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!inputMessage.trim() || !stompClient || !stompClient.active) return;

        const content = inputMessage.trim();
        const chatMessage = {
            senderId: currentUserId,
            senderName: currentUserName,
            content
        };

        stompClient.publish({
            destination: `/app/meeting/${meetingCode}/chat.sendMessage`,
            body: JSON.stringify(chatMessage)
        });

        setInputMessage("");
    };

    const handleMuteAll = () => {
        if (!stompClient || !stompClient.active) return;
        stompClient.publish({
            destination: `/app/meeting/${meetingCode}/system`,
            body: createSystemActionPayload(SYSTEM_ACTION_TYPES.MUTE_ALL)
        });
    };

    const handleStopCameraAll = () => {
        if (!stompClient || !stompClient.active) return;
        stompClient.publish({
            destination: `/app/meeting/${meetingCode}/system`,
            body: createSystemActionPayload(SYSTEM_ACTION_TYPES.STOP_CAMERA_ALL)
        });
    };

    const publishSystemAction = (payload) => {
        if (!stompClient || !stompClient.active) return;
        stompClient.publish({
            destination: `/app/meeting/${meetingCode}/system`,
            body: payload,
        });
    };

    const openKickConfirm = ({ isAll = false, participant }) => {
        const participantName = participant?.name || participant?.identity || "this participant";
        setConfirmState({
            isOpen: true,
            title: isAll ? "Kick everyone from this meeting?" : `Kick ${participantName}?`,
            description: isAll
                ? "Everyone in the meeting will be removed immediately and will need to join again to come back."
                : `${participantName} will be removed from the meeting immediately and will need to rejoin to come back.`,
            confirmLabel: isAll ? "Kick all participants" : "Kick participant",
            payload: isAll
                ? createSystemActionPayload(SYSTEM_ACTION_TYPES.KICK_ALL)
                : createSystemActionPayload(SYSTEM_ACTION_TYPES.KICK_PARTICIPANT, {
                    targetParticipantId: participant.identity,
                    targetParticipantName: participantName,
                }),
        });
    };

    const handleParticipantAction = (participant, actionType) => {
        if (!participant?.identity) return;

        if (actionType === SYSTEM_ACTION_TYPES.KICK_PARTICIPANT) {
            openKickConfirm({ participant });
            return;
        }

        publishSystemAction(
            createSystemActionPayload(actionType, {
                targetParticipantId: participant.identity,
                targetParticipantName: participant.name || participant.identity,
            })
        );
    };

    const formatTime = (isoString) => {
        if (!isoString) return "";
        return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    return (
        <>
            <ActionConfirmModal
                isOpen={confirmState.isOpen}
                title={confirmState.title}
                description={confirmState.description}
                confirmLabel={confirmState.confirmLabel}
                onClose={() => setConfirmState({ isOpen: false, title: "", description: "", confirmLabel: "", payload: null })}
                onConfirm={() => {
                    if (confirmState.payload) {
                        publishSystemAction(confirmState.payload);
                    }
                    setConfirmState({ isOpen: false, title: "", description: "", confirmLabel: "", payload: null });
                }}
            />
            <aside className={`fixed inset-x-3 bottom-[104px] z-20 h-[min(68vh,560px)] rounded-[28px] border border-white/10 bg-surface shadow-2xl transition-transform duration-300 md:inset-x-auto md:top-16 md:right-0 md:bottom-[92px] md:h-auto md:max-w-80 md:rounded-none md:border-l md:border-t-0 ${sidebarOpen ? "translate-y-0 md:translate-x-0" : "translate-y-[120%] md:translate-y-0 md:translate-x-full"}`}>
            <div className="flex h-full min-h-0 flex-col">
                <div className="flex p-2 gap-1 border-b border-white/5 bg-background/20">
                    <button onClick={() => setActiveTab("chat")} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "chat" ? "bg-primary text-white" : "text-gray-500 hover:bg-white/5"}`}>
                        Messages
                    </button>
                    <button onClick={() => setActiveTab("people")} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "people" ? "bg-primary text-white" : "text-gray-500 hover:bg-white/5"}`}>
                        People ({participants.length})
                    </button>
                </div>

                {activeTab === "chat" && (
                    <div className="flex min-h-0 flex-1 flex-col">
                        <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                            <p className="text-[10px] text-center text-gray-500 font-bold uppercase tracking-widest bg-white/5 py-2 rounded-lg">
                                Messages are saved to history
                            </p>

                            {isLoadingChat ? (
                                <div className="text-center text-sm text-gray-500 mt-4">Loading messages...</div>
                            ) : (
                                messages.map((msg, idx) => {
                                    const isMe = String(msg.senderId) === String(currentUserId);
                                    return (
                                        <div key={msg.id || idx} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                                            <div className="flex items-center gap-2 mb-1 px-1">
                                                {!isMe && <span className="text-[10px] font-black text-gray-400">{msg.senderName}</span>}
                                                <span className="text-[9px] text-gray-600">{formatTime(msg.timestamp)}</span>
                                            </div>
                                            <div className={`max-w-[85%] p-3 text-sm leading-relaxed ${isMe ? "bg-primary text-white rounded-2xl rounded-tr-none shadow-md shadow-primary/10" : "bg-white/5 text-gray-200 rounded-2xl rounded-tl-none border border-white/5"}`}>
                                                {msg.content}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        <form onSubmit={handleSendMessage} className="shrink-0 border-t border-white/5 bg-background/40 p-4">
                            <div className="relative">
                                <input
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    placeholder={isHost || meetingSettings?.chatEnabled !== false ? "Send a message..." : "Chat has been disabled by the host"}
                                    className={`w-full bg-surface border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50 ${(isHost || meetingSettings?.chatEnabled !== false) ? "" : "opacity-50 cursor-not-allowed"}`}
                                    disabled={!isStompConnected || (!isHost && meetingSettings?.chatEnabled === false)}
                                />
                                <button
                                    type="submit"
                                    disabled={!inputMessage.trim() || !isStompConnected || (!isHost && meetingSettings?.chatEnabled === false)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-primary hover:bg-primary/10 disabled:text-gray-600 rounded-lg transition-colors"
                                >
                                    <span className="material-symbols-outlined">send</span>
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {activeTab === "people" && (
                    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto no-scrollbar">

                        <div className="p-4 border-b border-white/5">
                            <button className="w-full py-2.5 rounded-xl border border-primary/30 text-primary text-xs font-bold hover:bg-primary/5 transition-colors flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined text-sm">person_add</span> Invite someone
                            </button>
                        </div>

                        {isHost && waitingList.length > 0 && (
                            <div className="mb-2">
                                <div className="px-4 py-2 bg-red-500/10 text-red-400 text-[10px] font-bold uppercase tracking-widest flex justify-between items-center border-y border-red-500/10">
                                    <span>Waiting Room ({waitingList.length})</span>
                                    <button onClick={fetchWaitingList} className="hover:text-red-300">
                                        <span className="material-symbols-outlined text-sm">refresh</span>
                                    </button>
                                </div>
                                <div className="p-2 space-y-2">
                                    {isLoadingWaiting ? (
                                        <div className="p-4 text-center text-sm text-gray-500">Loading...</div>
                                    ) : (
                                        waitingList.map((p) => (
                                            <div key={p.participantId} className="bg-white/5 p-2 rounded-xl border border-white/10 flex flex-col gap-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                                                        {p.displayName?.charAt(0) || "U"}
                                                    </div>
                                                    <div className="flex flex-col flex-1 overflow-hidden">
                                                        <span className="text-sm font-semibold truncate">{p.displayName}</span>
                                                        <span className="text-[10px] text-gray-500 truncate">{p.email}</span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleApproval(p.participantId, "APPROVED")} className="flex-1 bg-green-500/20 hover:bg-green-500 text-green-500 hover:text-white py-1.5 rounded-lg text-xs font-bold transition-all">
                                                        Admit
                                                    </button>
                                                    <button onClick={() => handleApproval(p.participantId, "REJECTED")} className="flex-1 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white py-1.5 rounded-lg text-xs font-bold transition-all">
                                                        Deny
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        <div>
                            <div className="px-4 py-2 bg-white/5 text-gray-400 text-[10px] font-bold uppercase tracking-widest border-y border-white/5">
                                In Call ({participants.length})
                            </div>
                            <div className="p-2 space-y-1">
                                {participants.map((p) => (
                                    <div key={p.sid} className="rounded-xl p-2 transition-colors hover:bg-white/5 group">
                                        {String(p.identity || "") === String(currentHostId || "") && (
                                            <div className="mb-2 inline-flex rounded-full bg-primary/15 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-primary">
                                                Host
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold border border-white/10">
                                                {(p.name || p.identity || "U").charAt(0)}
                                            </div>
                                            <div className="flex min-w-0 flex-col">
                                                <span className="max-w-[140px] truncate text-sm font-semibold">{p.name || p.identity} {p.isLocal && "(You)"}</span>
                                                <span className="text-[10px] text-gray-500 truncate">{p.identity}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <span className={`material-symbols-outlined text-[18px] ${!p.isMicrophoneEnabled ? "text-red-500" : "text-gray-400"}`}>
                        {!p.isMicrophoneEnabled ? "mic_off" : "mic"}
                      </span>
                                            <span className={`material-symbols-outlined text-[18px] ${!p.isCameraEnabled ? "text-red-500" : "text-gray-400"}`}>
                        {!p.isCameraEnabled ? "videocam_off" : "videocam"}
                      </span>
                                        </div>
                                    </div>
                                        {isHost && !p.isLocal && (
                                            <div className="mt-2 grid grid-cols-3 gap-2">
                                                <button
                                                    onClick={() => handleParticipantAction(p, SYSTEM_ACTION_TYPES.MUTE_PARTICIPANT)}
                                                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-bold text-gray-200 transition-colors hover:bg-white/10"
                                                >
                                                    Mute
                                                </button>
                                                <button
                                                    onClick={() => handleParticipantAction(p, SYSTEM_ACTION_TYPES.STOP_CAMERA_PARTICIPANT)}
                                                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-bold text-gray-200 transition-colors hover:bg-white/10"
                                                >
                                                    Stop cam
                                                </button>
                                                <button
                                                    onClick={() => handleParticipantAction(p, SYSTEM_ACTION_TYPES.KICK_PARTICIPANT)}
                                                    className="rounded-lg bg-red-500/20 px-3 py-2 text-[11px] font-bold text-red-300 transition-colors hover:bg-red-500 hover:text-white"
                                                >
                                                    Kick
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {isHost && (
                            <div className="p-4 border-t border-white/5 mt-auto flex flex-col gap-2">
                                <button onClick={handleMuteAll} className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold transition-colors">
                                    Mute All Participants
                                </button>
                                <button onClick={handleStopCameraAll} className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold transition-colors">
                                    Stop Camera All
                                </button>
                                <button onClick={() => openKickConfirm({ isAll: true })} className="w-full py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white text-xs font-bold transition-colors">
                                    Kick All Participants
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
            </aside>
        </>
    );
};

export default MeetingSidebar;
