const PERMISSION_NAMES = {
    microphone: "microphone",
    camera: "camera",
};

export const stopMediaStream = (stream) => {
    stream?.getTracks?.().forEach((track) => track.stop());
};

const queryPermission = async (name) => {
    if (!navigator?.permissions?.query) {
        return "prompt";
    }

    try {
        const result = await navigator.permissions.query({ name });
        return result.state;
    } catch (error) {
        return "prompt";
    }
};

export const getDevicePermissionStates = async () => {
    const [microphone, camera] = await Promise.all([
        queryPermission(PERMISSION_NAMES.microphone),
        queryPermission(PERMISSION_NAMES.camera),
    ]);

    return { microphone, camera };
};

export const requestDeviceAccess = async ({ audio = false, video = false }) => {
    if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error("This device does not support microphone or camera access.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio, video });
    return {
        stream,
        permissions: {
            microphone: audio ? "granted" : await queryPermission(PERMISSION_NAMES.microphone),
            camera: video ? "granted" : await queryPermission(PERMISSION_NAMES.camera),
        },
    };
};

export const isPermissionDeniedError = (error) =>
    error?.name === "NotAllowedError" ||
    error?.name === "PermissionDeniedError" ||
    error?.message?.toLowerCase?.().includes("permission");

export const getPermissionErrorMessage = (error, deviceLabel) => {
    if (isPermissionDeniedError(error)) {
        return `Browser access to ${deviceLabel} is blocked. Allow it when the browser asks for permission.`;
    }

    if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError") {
        return `No ${deviceLabel} was found on this device.`;
    }

    return `Unable to access ${deviceLabel} right now. Please try again.`;
};
