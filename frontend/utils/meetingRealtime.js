export const SYSTEM_ACTION_TYPES = {
    MEETING_ENDED: "MEETING_ENDED",
    HOST_TRANSFERRED: "HOST_TRANSFERRED",
    RECORDING_STARTED: "RECORDING_STARTED",
    RECORDING_STOPPED: "RECORDING_STOPPED",
    MUTE_ALL: "MUTE_ALL",
    STOP_CAMERA_ALL: "STOP_CAMERA_ALL",
    KICK_ALL: "KICK_ALL",
    MUTE_PARTICIPANT: "MUTE_PARTICIPANT",
    STOP_CAMERA_PARTICIPANT: "STOP_CAMERA_PARTICIPANT",
    KICK_PARTICIPANT: "KICK_PARTICIPANT",
};

export const getWebSocketUrl = () => {
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
    const url = new URL(apiUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = url.pathname.replace(/\/api\/?$/, "") + "/ws";
    url.search = "";
    url.hash = "";
    return url.toString();
};

export const createSystemActionPayload = (type, extra = {}) =>
    JSON.stringify({
        type,
        ...extra,
    });

export const parseSystemAction = (rawMessage) => {
    if (typeof rawMessage !== "string") {
        return null;
    }

    const trimmed = rawMessage.trim();
    if (!trimmed) {
        return null;
    }

    if (!trimmed.startsWith("{")) {
        return { type: trimmed };
    }

    try {
        const parsed = JSON.parse(trimmed);
        if (!parsed?.type) {
            return null;
        }
        return parsed;
    } catch (error) {
        console.error("Unable to parse system action payload:", error);
        return null;
    }
};
