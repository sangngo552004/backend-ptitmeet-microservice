import React, { useState, useEffect } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';

const Reactions = () => {
    const room = useRoomContext();
    const [reactions, setReactions] = useState([]);

    useEffect(() => {
        if (!room) return;

        const handleDataReceived = (payload, participant, kind, topic) => {
            if (topic === 'reaction') {
                const decoder = new TextDecoder();
                const reactionStr = decoder.decode(payload);
                try {
                    const reactionData = JSON.parse(reactionStr);
                    addReaction({
                        emoji: reactionData.emoji,
                        senderId: reactionData.senderId || participant?.identity || "Unknown",
                        senderName: reactionData.senderName || participant?.name || participant?.identity || "Unknown",
                    });
                } catch (e) {
                    console.error("Failed to parse reaction", e);
                }
            } else if (topic === 'hand_raise') {
                const decoder = new TextDecoder();
                const str = decoder.decode(payload);
                try {
                    const data = JSON.parse(str);
                    if (!participant?.identity) {
                        return;
                    }
                    const event = new CustomEvent('hand_raise', { 
                        detail: { identity: participant.identity, isRaised: data.isRaised }
                    });
                    window.dispatchEvent(event);
                    window.dispatchEvent(new CustomEvent("meeting_cue", {
                        detail: {
                            type: "handRaise",
                            senderId: participant.identity,
                            isRaised: data.isRaised,
                        },
                    }));
                } catch(e) {}
            }
        };

        room.on(RoomEvent.DataReceived, handleDataReceived);

        const handleParticipantDisconnected = (participant) => {
            if (!participant?.identity) {
                return;
            }
            window.dispatchEvent(new CustomEvent("meeting_cue", {
                detail: {
                    type: "joinLeave",
                    senderId: participant.identity,
                    senderName: participant.name || participant.identity || "A participant",
                    message: "left the meeting",
                },
            }));
        };

        room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

        return () => {
            room.off(RoomEvent.DataReceived, handleDataReceived);
            room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
        };
    }, [room]);

    useEffect(() => {
        const handleLocalReaction = (event) => {
            if (!event.detail?.emoji) {
                return;
            }

            addReaction({
                emoji: event.detail.emoji,
                senderId: event.detail.senderId || "local",
                senderName: event.detail.senderName || "You",
            });
        };

        window.addEventListener("reaction", handleLocalReaction);
        return () => window.removeEventListener("reaction", handleLocalReaction);
    }, []);

    const addReaction = ({ emoji, senderId, senderName }) => {
        const id = Math.random().toString(36).substring(7);
        const newReaction = {
            id,
            emoji,
            senderId,
            senderName,
            left: Math.random() * 80 + 10 + '%', // Random position between 10% and 90%
        };

        setReactions((prev) => [...prev, newReaction]);

        // Remove reaction after animation ends
        setTimeout(() => {
            setReactions((prev) => prev.filter((r) => r.id !== id));
        }, 3000);
    };

    return (
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
            <style>
                {`
                    @keyframes float-up {
                        0% { transform: translateY(0) scale(1); opacity: 1; }
                        100% { transform: translateY(-80vh) scale(1.5); opacity: 0; }
                    }
                    .animate-float-up {
                        animation: float-up 3s ease-out forwards;
                    }
                    @keyframes handBounce {
                        0%, 100% { transform: translateY(0); }
                        50% { transform: translateY(-25%); }
                    }
                `}
            </style>
            {reactions.map((r) => (
                <div
                    key={r.id}
                    className="absolute bottom-24 flex flex-col items-center gap-1 animate-float-up"
                    style={{ left: r.left }}
                >
                    <span className="text-[11px] font-semibold text-white bg-black/60 px-2 py-1 rounded-full whitespace-nowrap">
                        {r.senderName}
                    </span>
                    <span className="text-4xl">{r.emoji}</span>
                </div>
            ))}
        </div>
    );
};

export default Reactions;
