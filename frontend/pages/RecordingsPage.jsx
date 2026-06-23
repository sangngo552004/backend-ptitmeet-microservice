import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { meetingService } from "../services/meetingService";

const formatDateTime = (dateString) => {
  if (!dateString) return "Unknown";
  return new Date(dateString).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const getStatusClass = (status) => {
  switch (status) {
    case "COMPLETED":
      return "bg-green-500/10 text-green-600 dark:text-green-400";
    case "RECORDING":
      return "bg-red-500/10 text-red-500 animate-pulse";
    case "STOPPING":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "FAILED":
      return "bg-red-500/10 text-red-500";
    default:
      return "bg-slate-500/10 text-slate-500 dark:text-slate-400";
  }
};

const RecordingsPage = () => {
  const [recordings, setRecordings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadRecordings = async () => {
      try {
        setIsLoading(true);
        const data = await meetingService.getMyRecordings();
        setRecordings(data || []);
      } catch (error) {
        console.error("Unable to load recordings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadRecordings();
  }, []);

  return (
    <DashboardLayout>
      <div className="mx-auto flex h-full max-w-6xl flex-col p-4 md:p-8 lg:p-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">My Recordings</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Recordings are only visible to the original meeting owner.
          </p>
        </div>

        {isLoading ? (
          <div className="flex min-h-[320px] flex-1 items-center justify-center">
            <div className="size-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary"></div>
          </div>
        ) : recordings.length === 0 ? (
          <div className="flex min-h-[320px] flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center dark:border-slate-700 dark:bg-slate-900/40">
            <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600">video_library</span>
            <h2 className="mt-4 text-xl font-bold text-slate-800 dark:text-white">No recordings yet</h2>
            <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
              Start a recording from a meeting you own and it will appear here after LiveKit finishes processing it.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {recordings.map((recording) => (
              <article
                key={recording.id || recording.egressId}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-slate-700 dark:bg-slate-900/70"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      {recording.roomName || "Untitled meeting"}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Created {formatDateTime(recording.createdAt)}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusClass(recording.status)}`}>
                    {recording.status || "UNKNOWN"}
                  </span>
                </div>

                <div className="mt-5 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-slate-400">key</span>
                    <span className="truncate font-mono text-xs">{recording.egressId}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-slate-400">link</span>
                    <span className="truncate text-xs">{recording.fileUrl || "Processing file URL..."}</span>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href={recording.fileUrl || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                      recording.fileUrl
                        ? "bg-primary/10 text-primary hover:bg-primary/20"
                        : "cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                    }`}
                    onClick={(event) => {
                      if (!recording.fileUrl) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <span className="material-symbols-outlined text-[18px]">play_circle</span>
                    Open recording
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default RecordingsPage;
