import React from "react";

const ActionConfirmModal = ({
    isOpen,
    title,
    description,
    confirmLabel,
    confirmClassName = "bg-red-500 hover:bg-red-600 text-white",
    onClose,
    onConfirm,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-surface p-6 shadow-2xl">
                <div className="mb-6">
                    <div className="mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-red-500/15 text-red-400">
                        <span className="material-symbols-outlined">warning</span>
                    </div>
                    <h3 className="text-2xl font-black text-white">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-gray-400">{description}</p>
                </div>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={onConfirm}
                        className={`w-full rounded-2xl px-4 py-3 text-sm font-bold transition-colors ${confirmClassName}`}
                    >
                        {confirmLabel}
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

export default ActionConfirmModal;
