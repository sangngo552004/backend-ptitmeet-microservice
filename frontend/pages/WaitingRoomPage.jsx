import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Client } from "@stomp/stompjs";
import { meetingService } from "../services/meetingService";
import {
  getDevicePermissionStates,
  getPermissionErrorMessage,
  requestDeviceAccess,
  stopMediaStream,
} from "../utils/mediaPermissions";
import { getWebSocketUrl } from "../utils/meetingRealtime";

const WaitingRoomPage = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const isHostSetup = Boolean(location.state?.hostSetup);
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [isCheckingDevices, setIsCheckingDevices] = useState(true);
  const [deviceError, setDeviceError] = useState("");
  const [permissionState, setPermissionState] = useState({
    microphone: "prompt",
    camera: "prompt",
  });
  const [previewStream, setPreviewStream] = useState(null);
  const [joinState, setJoinState] = useState("IDLE");
  const [errorMsg, setErrorMsg] = useState(null);
  const [waitingMessage, setWaitingMessage] = useState("Joining meeting...");
  const [stompClient, setStompClient] = useState(null);

  const videoRef = useRef(null);
  const mediaPreferenceRef = useRef({ micOn: true, videoOn: true });
  const previewStreamRef = useRef(null);

  useEffect(() => {
    mediaPreferenceRef.current = { micOn, videoOn };
  }, [micOn, videoOn]);

  useEffect(() => {
    previewStreamRef.current = previewStream;
  }, [previewStream]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = previewStream;
    }
  }, [previewStream]);

  useEffect(() => {
    const initializePermissions = async () => {
      setIsCheckingDevices(true);

      try {
        const states = await getDevicePermissionStates();
        setPermissionState(states);

        if (states.camera === "granted") {
          const { stream } = await requestDeviceAccess({ video: true });
          setPreviewStream((previousStream) => {
            stopMediaStream(previousStream);
            return stream;
          });
        }
      } catch (error) {
        console.error("Unable to initialize device setup:", error);
      } finally {
        setIsCheckingDevices(false);
      }
    };

    initializePermissions();

    return () => {
      stopMediaStream(previewStreamRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (stompClient && stompClient.active) stompClient.deactivate();
    };
  }, [stompClient]);

  const syncPermissions = async () => {
    const latestStates = await getDevicePermissionStates();
    setPermissionState(latestStates);
    return latestStates;
  };

  const requestPermissions = async ({ audio = false, video = false }) => {
    try {
      setDeviceError("");
      setIsCheckingDevices(true);

      const { stream, permissions } = await requestDeviceAccess({ audio, video });
      setPermissionState((previousState) => ({
        ...previousState,
        ...permissions,
      }));

      if (video) {
        setPreviewStream((previousStream) => {
          stopMediaStream(previousStream);
          return stream;
        });
      } else {
        stopMediaStream(stream);
      }

      return true;
    } catch (error) {
      console.error("Device access request failed:", error);
      await syncPermissions();
      setDeviceError(
        getPermissionErrorMessage(
          error,
          audio && video ? "microphone and camera" : audio ? "microphone" : "camera"
        )
      );
      return false;
    } finally {
      setIsCheckingDevices(false);
    }
  };

  const ensureSelectedDevicesReady = async () => {
    const requiresMicrophone = micOn && permissionState.microphone !== "granted";
    const requiresCamera = videoOn && permissionState.camera !== "granted";

    if (!requiresMicrophone && !requiresCamera) {
      if (videoOn && !previewStream && permissionState.camera === "granted") {
        await requestPermissions({ video: true });
      }
      return true;
    }

    return requestPermissions({
      audio: requiresMicrophone,
      video: requiresCamera,
    });
  };

  const handleToggleMic = async () => {
    if (micOn) {
      setMicOn(false);
      return;
    }

    if (permissionState.microphone === "granted") {
      setMicOn(true);
      return;
    }

    const granted = await requestPermissions({ audio: true });
    if (granted) {
      setMicOn(true);
    }
  };

  const handleToggleCamera = async () => {
    if (videoOn) {
      setVideoOn(false);
      setPreviewStream((previousStream) => {
        stopMediaStream(previousStream);
        return null;
      });
      return;
    }

    if (permissionState.camera === "granted") {
      setVideoOn(true);
      await requestPermissions({ video: true });
      return;
    }

    const granted = await requestPermissions({ video: true });
    if (granted) {
      setVideoOn(true);
    }
  };

  const goToMeetingRoom = (res) => {
    stopMediaStream(previewStreamRef.current);
    navigate(`/meeting/${code}`, {
      state: {
        token: res.token,
        role: res.role,
        isOwner: Boolean(res.isOwner),
        currentHostId: res.currentHostId,
        serverUrl: res.serverUrl,
        settings: res.settings,
        micOn: mediaPreferenceRef.current.micOn,
        camOn: mediaPreferenceRef.current.videoOn,
      },
    });
  };

  const handleAskToJoin = async () => {
    const devicesReady = await ensureSelectedDevicesReady();
    if (!devicesReady) {
      return;
    }

    setJoinState("ASKING");
    setErrorMsg(null);

    try {
      const response = await meetingService.joinMeeting(code);

      if (response.status === "APPROVED") {
        goToMeetingRoom(response);
      } else if (response.status === "PENDING") {
        setJoinState("WAITING");
        setWaitingMessage(response.message);

        if (!stompClient || !stompClient.active) {
          connectWebSocket();
        }
      }
    } catch (error) {
      console.error("Unable to join meeting:", error);
      setJoinState("IDLE");
      setErrorMsg(
        error.response?.data?.message ||
          "An error occurred while trying to join the meeting. Please try again."
      );
    }
  };

  const connectWebSocket = () => {
    const client = new Client({
      brokerURL: getWebSocketUrl(),
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/meeting/${code}/user/${user.userId}`, (message) => {
          const res = JSON.parse(message.body);

          if (res.status === "APPROVED") {
            goToMeetingRoom(res);
          } else if (res.status === "REJECTED") {
            setJoinState("IDLE");
            setErrorMsg("Your request to join the meeting was rejected by the host.");
            client.deactivate();
          }
        });

        client.subscribe(`/topic/meeting/${code}/waiting-room`, async (msg) => {
          if (msg.body === "HOST_JOINED" || msg.body === "SETTINGS_CHANGED") {
            if (msg.body === "HOST_JOINED") {
              setWaitingMessage("The meeting has started. Please wait for the host to let you in.");
            }

            try {
              const checkRes = await meetingService.joinMeeting(code);
              if (checkRes.status === "APPROVED") {
                goToMeetingRoom(checkRes);
              }
            } catch (error) {
              console.error("Unable to re-check meeting status:", error);
            }
          }
        });
      },
      onStompError: (frame) => {
        console.error("Broker error:", frame.headers["message"]);
      },
    });

    client.activate();
    setStompClient(client);
  };

  const permissionBadgeText = (state) => {
    if (state === "granted") return "Allowed";
    if (state === "denied") return "Blocked";
    return "Needs permission";
  };

  const renderActionButton = () => {
    if (joinState === "ASKING") {
      return (
        <button
          disabled
          className="flex h-16 w-full cursor-not-allowed items-center justify-center gap-3 rounded-2xl bg-blue-900 text-xl font-black text-blue-200 transition-all"
        >
          <div className="size-5 rounded-full border-2 border-blue-200/30 border-t-blue-200 animate-spin"></div>
          {isHostSetup ? "Preparing meeting..." : "Sending request..."}
        </button>
      );
    }

    if (joinState === "WAITING") {
      return (
        <button
          disabled
          className="flex h-16 w-full cursor-not-allowed items-center justify-center gap-3 rounded-2xl bg-slate-800 text-lg font-bold text-gray-400 transition-all shadow-inner"
        >
          <div className="size-5 rounded-full border-2 border-gray-400/30 border-t-gray-400 animate-spin"></div>
          Waiting for host...
        </button>
      );
    }

    return (
      <button
        onClick={handleAskToJoin}
        className="h-16 w-full rounded-2xl bg-primary text-xl font-black text-white shadow-xl transition-all hover:bg-blue-600 active:scale-[0.99]"
      >
        {isHostSetup ? "Start meeting" : "Join now"}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(19,127,236,0.22),_transparent_42%),linear-gradient(180deg,_#0b1017,_#06080d)] text-white">
      <header className="flex h-20 items-center justify-between border-b border-white/5 px-4 md:px-6">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-white">
            <span className="material-symbols-outlined text-xl">videocam</span>
          </div>
          <span className="text-lg font-bold">PTIT-Meet</span>
        </div>
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back
        </button>
      </header>

      <main className="px-4 py-6 md:px-6 md:py-10">
        <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.55fr)]">
          <section className="space-y-5">
            <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-surface shadow-2xl">
              <div className="relative min-h-[360px] aspect-[4/3] sm:min-h-[460px] sm:aspect-[16/10] xl:min-h-[560px]">
                {isCheckingDevices && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="mb-4 size-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin"></div>
                    <p className="text-sm font-bold text-gray-300">Checking camera & mic...</p>
                  </div>
                )}

                {videoOn && previewStream ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-black">
                    <div className="flex size-32 items-center justify-center rounded-full bg-primary/20 text-5xl font-black text-primary">
                      {user?.fullName?.charAt(0) || "U"}
                    </div>
                  </div>
                )}

                <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider backdrop-blur">
                  <span className={`size-2 rounded-full ${videoOn && previewStream ? "bg-green-500 animate-pulse" : "bg-gray-500"}`}></span>
                  {videoOn && previewStream ? "Preview ready" : "Preview paused"}
                </div>

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-4 pb-4 pt-16 sm:px-6">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-primary/80">
                        {isHostSetup ? "Host setup" : "Waiting room"}
                      </p>
                      <h1 className="mt-2 text-2xl font-black sm:text-3xl">
                        {isHostSetup ? "Set up before you go live" : "Ready to join?"}
                      </h1>
                      <p className="mt-2 max-w-xl text-sm text-gray-300">
                        {isHostSetup
                          ? "Check your microphone and camera before starting so the room opens smoothly."
                          : "Make sure your mic and camera look right before sending your join request."}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/40 p-2 backdrop-blur">
                      <button
                        onClick={handleToggleMic}
                        className={`flex size-11 items-center justify-center rounded-full transition-all ${
                          micOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-red-500 text-white"
                        }`}
                        title={micOn ? "Mute microphone before joining" : "Turn microphone on"}
                      >
                        <span className="material-symbols-outlined">{micOn ? "mic" : "mic_off"}</span>
                      </button>
                      <button
                        onClick={handleToggleCamera}
                        className={`flex size-11 items-center justify-center rounded-full transition-all ${
                          videoOn ? "bg-primary text-white hover:bg-blue-600" : "bg-red-500 text-white"
                        }`}
                        title={videoOn ? "Turn camera off" : "Turn camera on"}
                      >
                        <span className="material-symbols-outlined">{videoOn ? "videocam" : "videocam_off"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside className="space-y-5">
            <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-primary/80">Join details</p>
                  <h2 className="mt-2 text-xl font-bold text-white">Before you enter</h2>
                </div>
                <div className="rounded-2xl bg-black/20 px-3 py-2 text-right">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Meeting</p>
                  <p className="mt-1 text-sm font-semibold text-white">{code}</p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                <label className="text-[11px] font-black uppercase tracking-wider text-gray-500">Display name</label>
                <input
                  type="text"
                  value={user?.fullName || ""}
                  readOnly
                  className="mt-3 w-full rounded-2xl border border-white/10 bg-surface px-4 py-3 text-base font-bold text-white"
                />
              </div>

              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-gray-300">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary">headphones</span>
                    <span>Microphone: {permissionBadgeText(permissionState.microphone)}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary">photo_camera</span>
                    <span>Camera: {permissionBadgeText(permissionState.camera)}</span>
                  </div>
                </div>

                {deviceError && (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {deviceError}
                  </div>
                )}

                {errorMsg && (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {errorMsg}
                  </div>
                )}

                {joinState === "WAITING" && (
                  <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
                    {waitingMessage}
                  </div>
                )}
              </div>

              <div className="mt-6 space-y-3">
                {renderActionButton()}
                <button
                  onClick={() => navigate("/")}
                  className="w-full rounded-2xl border border-white/10 px-4 py-3 font-bold text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 text-sm text-gray-300 shadow-lg backdrop-blur">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined mt-0.5 text-primary">tips_and_updates</span>
                <div>
                  <p className="font-semibold text-white">Quick tip</p>
                  <p className="mt-1 text-gray-400">
                    If the browser blocks your camera or microphone, allow access from the browser address bar and try again.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default WaitingRoomPage;
