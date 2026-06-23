import React from "react";

const DEVICE_COPY = {
    microphone: {
        icon: "mic",
        title: "Allow microphone access",
        description: "Continue to let the browser show its microphone permission prompt. Once allowed, your microphone will turn on right away.",
        label: "Allow microphone",
    },
    camera: {
        icon: "videocam",
        title: "Allow camera access",
        description: "Continue to let the browser show its camera permission prompt. Once allowed, your camera will turn on right away.",
        label: "Allow camera",
    },
};

const DevicePermissionModal = ({
    isOpen,
    device,
    errorMessage,
    isRequesting,
    onClose,
    onRequestAccess,
}) => {
    if (!isOpen || !device) return null;

    const content = DEVICE_COPY[device];
    if (!content) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-surface p-6 shadow-2xl">
                <div className="mb-6">
                    <div className="mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                        <span className="material-symbols-outlined">{content.icon}</span>
                    </div>
                    <h3 className="text-2xl font-black text-white">{content.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-gray-400">{content.description}</p>
                </div>

                {errorMessage && (
                    <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        {errorMessage}
                    </div>
                )}

                <div className="flex flex-col gap-3">
                    <button
                        onClick={onRequestAccess}
                        disabled={isRequesting}
                        className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-blue-400"
                    >
                        {isRequesting ? "Waiting for browser permission..." : content.label}
                    </button>
                    <button
                        onClick={onClose}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DevicePermissionModal;
