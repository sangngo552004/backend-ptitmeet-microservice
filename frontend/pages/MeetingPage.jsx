import React, { useState, useEffect, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { meetingService } from "../services/meetingService";
import { Client } from "@stomp/stompjs";

import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import "@livekit/components-styles";

import MeetingHeader from "../components/meeting-page/MeetingHeader.jsx";
import ParticipantGrid from "../components/meeting-page/ParticipantGrid.jsx";
import MeetingSidebar from "../components/meeting-page/MeetingSidebar";
import ControlBar from "../components/meeting-page/ControlBar";
import Reactions from "../components/meeting-page/Reactions"; // Import Reactions component
import {
  getWebSocketUrl,
  parseSystemAction,
  SYSTEM_ACTION_TYPES,
} from "../utils/meetingRealtime";
import { playMeetingCue } from "../utils/meetingSounds";

const MeetingPage = () => {
  const { code } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const joinData = location.state || {};
  const [isHost, setIsHost] = useState(joinData.role === "HOST");
  const [isOwner] = useState(Boolean(joinData.isOwner));
  const [currentHostId, setCurrentHostId] = useState(
    String(joinData.currentHostId || user?.userId || user?.id || "")
  );
  const token = joinData.token;
  const serverUrl = joinData.serverUrl;

  const initialAudioEnabled = joinData.micOn ?? true;
  const initialVideoEnabled = joinData.camOn ?? joinData.videoOn ?? true;
  const currentUserId = String(user?.userId || user?.id || "");

  const [activeTab, setActiveTab] = useState("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [meetingSettings, setMeetingSettings] = useState(() => {
    try {
      if (joinData.settings) {
        return typeof joinData.settings === "string" ? JSON.parse(joinData.settings) : joinData.settings;
      }
    } catch (e) {
      console.error("Error parsing settings", e);
    }
    return {
      waitingRoom: true,
      muteAudioOnEntry: false,
      muteVideoOnEntry: false,
      chatEnabled: true,
      screenShareEnabled: true,
    };
  });

  const [waitingList, setWaitingList] = useState([]);
  const [isLoadingWaiting, setIsLoadingWaiting] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [notificationToast, setNotificationToast] = useState(null);
  const [inviteToast, setInviteToast] = useState(null);
  const [isRecordingActive, setIsRecordingActive] = useState(false);

  const [stompClient, setStompClient] = useState(null);
  const [isStompConnected, setIsStompConnected] = useState(false);
  const adminSubscriptionRef = useRef(null);
  const isHostRef = useRef(isHost);

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  useEffect(() => {
    if (!token || !serverUrl) {
      alert("Meeting details were not found. Please join again.");
      navigate("/");
    }
  }, [token, serverUrl, navigate]);

  useEffect(() => {
    if (sidebarOpen && activeTab === "chat") {
      setUnreadMessages(0);
      setNotificationToast((prev) => (prev?.kind === "chat" ? null : prev));
    }
  }, [activeTab, sidebarOpen]);

  useEffect(() => {
    if (!notificationToast) return;
    const timeoutId = window.setTimeout(() => setNotificationToast(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [notificationToast]);

  useEffect(() => {
    const handleMeetingCue = (event) => {
      const cue = event.detail;
      if (!cue?.type) return;
      if (String(cue.senderId || "") === currentUserId) return;
      if (cue.type === "handRaise" && cue.isRaised) {
        playMeetingCue("handRaise");
        setNotificationToast({
          kind: "handRaise",
          title: "Hand raised",
          subtitle: cue.senderName || "Participant",
          content: "wants attention",
        });
      }
      if (cue.type === "joinLeave") {
        playMeetingCue("joinLeave");
      }
    };

    window.addEventListener("meeting_cue", handleMeetingCue);
    return () => window.removeEventListener("meeting_cue", handleMeetingCue);
  }, [currentUserId]);

  useEffect(() => {
    if (!code) return;

    const client = new Client({
      brokerURL: getWebSocketUrl(),
      reconnectDelay: 5000,
      onConnect: () => {
        setIsStompConnected(true);

        client.subscribe(`/topic/meeting/${code}/system`, (message) => {
            const action = parseSystemAction(message.body);
            if (!action?.type) return;

            const isTargetedAtCurrentUser =
              !action.targetParticipantId ||
              String(action.targetParticipantId) === currentUserId;

            if (action.type === "SETTINGS_UPDATED") {
              setMeetingSettings(action.settings);
            } else if (action.type === SYSTEM_ACTION_TYPES.HOST_TRANSFERRED) {
              setCurrentHostId(String(action.newHostId || ""));
              const becameHost = String(action.newHostId || "") === currentUserId;
              setIsHost(becameHost);
              if (becameHost) {
                fetchWaitingList();
              }
            } else if (action.type === SYSTEM_ACTION_TYPES.RECORDING_STARTED) {
              setIsRecordingActive(true);
              setNotificationToast({
                kind: "recording",
                title: "Recording started",
                subtitle: action.actorName || "Meeting owner",
                content: "is recording this meeting",
              });
              playMeetingCue("chat");
            } else if (action.type === SYSTEM_ACTION_TYPES.RECORDING_STOPPED) {
              setIsRecordingActive(false);
              setNotificationToast({
                kind: "recording",
                title: "Recording stopped",
                subtitle: action.actorName || "Meeting owner",
                content: "stopped the recording",
              });
            } else if (action.type === SYSTEM_ACTION_TYPES.MEETING_ENDED) {
               if (!isHostRef.current) {
                   navigate("/summary", { 
                       state: { meetingCode: code, actionTaken: "ENDED_BY_HOST" } 
                   });
               }
            } else if (
              !isHostRef.current &&
              (action.type === SYSTEM_ACTION_TYPES.MUTE_ALL ||
                (action.type === SYSTEM_ACTION_TYPES.MUTE_PARTICIPANT && isTargetedAtCurrentUser))
            ) {
               window.dispatchEvent(new CustomEvent('SYSTEM_ACTION', { detail: action.type }));
            } else if (
              !isHostRef.current &&
              (action.type === SYSTEM_ACTION_TYPES.STOP_CAMERA_ALL ||
                (action.type === SYSTEM_ACTION_TYPES.STOP_CAMERA_PARTICIPANT && isTargetedAtCurrentUser))
            ) {
               window.dispatchEvent(new CustomEvent('SYSTEM_ACTION', { detail: action.type }));
             } else if (
              !isHostRef.current &&
              (action.type === SYSTEM_ACTION_TYPES.KICK_ALL ||
                (action.type === SYSTEM_ACTION_TYPES.KICK_PARTICIPANT && isTargetedAtCurrentUser))
            ) {
                navigate("/summary", { 
                    state: { meetingCode: code, actionTaken: "KICKED" } 
                });
             }
        });
      },
      onDisconnect: () => setIsStompConnected(false),
      onStompError: (frame) => {
        console.error("STOMP error:", frame.headers["message"], frame.body);
        setIsStompConnected(false);
      },
      onWebSocketError: (error) => {
        console.error("WebSocket error:", error);
        setIsStompConnected(false);
      }
    });

    client.activate();
    setStompClient(client);

    return () => {
      if (adminSubscriptionRef.current) {
        adminSubscriptionRef.current.unsubscribe();
        adminSubscriptionRef.current = null;
      }
      if (client.active) client.deactivate();
    };
  }, [code, currentUserId, navigate]);

  useEffect(() => {
    if (adminSubscriptionRef.current) {
      adminSubscriptionRef.current.unsubscribe();
      adminSubscriptionRef.current = null;
    }

    if (!stompClient || !isStompConnected || !isHost) {
      return;
    }

    fetchWaitingList();
    adminSubscriptionRef.current = stompClient.subscribe(`/topic/meeting/${code}/admin`, (message) => {
      fetchWaitingList();
      try {
        const request = JSON.parse(message.body);
        setInviteToast({
          participantId: request.participantId,
          userId: request.userId,
          displayName: request.displayName || "Someone",
        });
        playMeetingCue("joinLeave");
      } catch (error) {
        console.error("Unable to parse waiting-room request:", error);
      }
    });

    return () => {
      if (adminSubscriptionRef.current) {
        adminSubscriptionRef.current.unsubscribe();
        adminSubscriptionRef.current = null;
      }
    };
  }, [code, isHost, isStompConnected, stompClient]);

  const fetchWaitingList = async () => {
    try {
      setIsLoadingWaiting(true);
      const data = await meetingService.getWaitingList(code);
      setWaitingList(data);
    } catch (error) {
      console.error("Unable to load waiting list:", error);
    } finally {
      setIsLoadingWaiting(false);
    }
  };

  const handleApproval = async (participantId, action) => {
    try {
      await meetingService.processApproval(code, participantId, action);
      setWaitingList((prev) => prev.filter((p) => p.participantId !== participantId));
    } catch (error) {
      alert("Unable to process the request: " + (error.response?.data?.message || ""));
    }
  };

  const handleIncomingMessage = (message) => {
    const senderId = String(message?.senderId || "");
    if (!message || senderId === currentUserId) return;

    const isChatOpen = sidebarOpen && activeTab === "chat";
    playMeetingCue("chat");
    if (!isChatOpen) {
      setUnreadMessages((prev) => prev + 1);
      setNotificationToast({
        kind: "chat",
        title: "New message",
        subtitle: message.senderName || "New message",
        content: message.content || "",
      });
    }

    if (document.hidden && "Notification" in window && Notification.permission === "granted") {
      new Notification(message.senderName || "New message", {
        body: message.content || "",
      });
    }
  };

  if (!token || !serverUrl) return <div className="h-screen bg-background flex items-center justify-center text-white">Connecting...</div>;

  return (
      <LiveKitRoom video={initialVideoEnabled} audio={initialAudioEnabled} token={token} serverUrl={serverUrl} connect={true}>
        <div className="h-screen w-full flex flex-col bg-background overflow-hidden text-white font-sans">
          {notificationToast && (
            <div className="pointer-events-none fixed left-4 right-4 top-20 z-[120] mx-auto w-full max-w-sm rounded-2xl border border-white/10 bg-surface/95 p-4 shadow-2xl backdrop-blur md:left-auto md:right-6 md:mx-0 md:w-80">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{notificationToast.title}</p>
              <p className="mt-2 text-sm font-semibold text-white">{notificationToast.subtitle}</p>
              <p className="mt-1 line-clamp-2 text-sm text-gray-300">{notificationToast.content}</p>
            </div>
          )}
          <MeetingHeader code={code} isHost={isHost} isOwner={isOwner} isRecordingActive={isRecordingActive} />
          {inviteToast && (
            <div className="fixed left-4 right-4 top-20 z-[125] mx-auto w-full max-w-sm rounded-2xl border border-primary/20 bg-surface/95 p-4 shadow-2xl backdrop-blur md:left-auto md:right-6 md:mx-0 md:w-[360px]">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Join request</p>
              <p className="mt-2 text-sm font-semibold text-white">{inviteToast.displayName}</p>
              <p className="mt-1 text-sm text-gray-300">wants to enter this meeting.</p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={async () => {
                    await handleApproval(inviteToast.participantId, "APPROVED");
                    setInviteToast(null);
                  }}
                  className="flex-1 rounded-xl bg-green-500/20 px-3 py-2 text-sm font-bold text-green-300 transition-colors hover:bg-green-500 hover:text-white"
                >
                  Admit
                </button>
                <button
                  onClick={async () => {
                    await handleApproval(inviteToast.participantId, "REJECTED");
                    setInviteToast(null);
                  }}
                  className="flex-1 rounded-xl bg-red-500/20 px-3 py-2 text-sm font-bold text-red-300 transition-colors hover:bg-red-500 hover:text-white"
                >
                  Deny
                </button>
              </div>
            </div>
          )}
          <div className="relative flex min-h-0 flex-grow overflow-hidden w-full">
            <ParticipantGrid sidebarOpen={sidebarOpen} currentHostId={currentHostId} />
            <MeetingSidebar
                sidebarOpen={sidebarOpen}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                isHost={isHost}
                currentHostId={currentHostId}
                waitingList={waitingList}
                isLoadingWaiting={isLoadingWaiting}
                handleApproval={handleApproval}
                fetchWaitingList={fetchWaitingList}
                stompClient={stompClient}
                isStompConnected={isStompConnected}
                currentUser={user}
                meetingCode={code}
                onIncomingMessage={handleIncomingMessage}
                meetingSettings={meetingSettings}
            />
          </div>
          <ControlBar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} activeTab={activeTab} setActiveTab={setActiveTab} waitingCount={waitingList.length} unreadCount={unreadMessages} isHost={isHost} isOwner={isOwner} code={code} stompClient={stompClient} meetingSettings={meetingSettings}/>
          <RoomAudioRenderer />
          <Reactions /> {/* Add Reactions component here */}
        </div>
      </LiveKitRoom>
  );
};

export default MeetingPage;
