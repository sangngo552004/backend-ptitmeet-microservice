import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { meetingService } from "../services/meetingService";

const formatDateTime = (dateString) => {
  if (!dateString) return "Không xác định";
  const date = new Date(dateString);
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const getStatusBadge = (status) => {
  switch (status) {
    case "FINISHED":
      return <span className="rounded-full bg-slate-500/10 px-3 py-1 text-xs font-bold text-slate-500 dark:text-slate-400">Finished</span>;
    case "CANCELED":
      return <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold text-red-500">Canceled</span>;
    case "ACTIVE":
      return <span className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-bold text-green-600 dark:text-green-400">Live</span>;
    case "SCHEDULED":
      return <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-600 dark:text-blue-400">Upcoming</span>;
    default:
      return <span className="rounded-full bg-slate-500/10 px-3 py-1 text-xs font-bold text-slate-500">{status}</span>;
  }
};

const HistoryPage = () => {
  const navigate = useNavigate();
  const [historyData, setHistoryData] = useState({ content: [], totalPages: 0, totalElements: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [filterRole, setFilterRole] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const itemsPerPage = 6;

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setIsLoading(true);
        const data = await meetingService.getHistory(currentPage, itemsPerPage, filterRole, filterStatus);
        setHistoryData(data);
      } catch (error) {
        console.error("Lỗi khi tải lịch sử:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [currentPage, filterRole, filterStatus]);

  const openChatHistory = async (meeting) => {
    try {
      setSelectedMeeting(meeting);
      setIsChatLoading(true);
      const data = await meetingService.getChatHistory(meeting.meetingCode);
      setChatHistory(data || []);
    } catch (error) {
      console.error("Unable to load chat history:", error);
      setChatHistory([]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const totalPages = Math.ceil(historyData.totalElements / itemsPerPage);
  const indexOfFirstItem = (currentPage - 1) * itemsPerPage;

  return (
    <DashboardLayout>
      <div className="mx-auto flex h-full max-w-7xl flex-col p-4 md:p-8 lg:p-12">
        <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Meeting History</h1>
            <p className="mt-1 text-slate-500 dark:text-slate-400">
              Review the meetings you joined. Full chat history is only available for meetings you originally created.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-1.5 dark:border-slate-700 dark:bg-slate-800">
              <select
                value={filterRole}
                onChange={(event) => {
                  setFilterRole(event.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent px-3 py-1.5 text-sm font-medium text-slate-700 outline-none dark:text-slate-200"
              >
                <option value="ALL">All Roles</option>
                <option value="HOST">Hosted by me</option>
                <option value="GUEST">Attended as guest</option>
              </select>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-1.5 dark:border-slate-700 dark:bg-slate-800">
              <select
                value={filterStatus}
                onChange={(event) => {
                  setFilterStatus(event.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent px-3 py-1.5 text-sm font-medium text-slate-700 outline-none dark:text-slate-200"
              >
                <option value="ALL">All statuses</option>
                <option value="ACTIVE">Live</option>
                <option value="SCHEDULED">Upcoming</option>
                <option value="FINISHED">Finished</option>
                <option value="CANCELED">Canceled</option>
              </select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-[400px] flex-1 items-center justify-center">
            <div className="size-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary"></div>
          </div>
        ) : historyData.totalElements === 0 ? (
          <div className="flex min-h-[400px] flex-1 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white/80 p-12 text-center dark:border-slate-700 dark:bg-slate-800/50">
            <span className="material-symbols-outlined mb-4 text-6xl text-slate-300 dark:text-slate-600">search_off</span>
            <h3 className="text-xl font-bold text-slate-700 dark:text-white">No results found</h3>
            <p className="mt-2 text-slate-500">Try changing the filters or create a new meeting.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {historyData.content.map((meeting) => {
                const isOwner = Boolean(meeting.owner ?? meeting.isOwner ?? meeting.host);
                const canViewChatHistory = Boolean(meeting.canViewChatHistory);
                const canViewRecordings = Boolean(meeting.canViewRecordings);
                const canRejoin = meeting.status === "ACTIVE" || meeting.status === "SCHEDULED";

                return (
                  <article
                    key={meeting.meetingCode}
                    className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:shadow-lg dark:border-slate-700 dark:bg-slate-800/80"
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`rounded px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${isOwner ? "border border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400" : "border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"}`}>
                          {isOwner ? "Owner" : "Guest"}
                        </span>
                      </div>
                      {getStatusBadge(meeting.status)}
                    </div>

                    <h3 className="mb-2 line-clamp-1 text-lg font-bold text-slate-900 transition-colors hover:text-primary dark:text-white">
                      {meeting.title || "Untitled Meeting"}
                    </h3>

                    <div className="mb-6 flex-grow space-y-2">
                      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <span className="material-symbols-outlined text-[18px]">calendar_today</span>
                        <span>{formatDateTime(meeting.startTime)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <span className="material-symbols-outlined text-[18px]">key</span>
                        <span className="font-mono">{meeting.meetingCode}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <span className="material-symbols-outlined text-[18px]">shield</span>
                        <span>{canViewChatHistory ? "You can review full chat history" : "Chat history is owner-only"}</span>
                      </div>
                    </div>

                    <div className="mt-auto flex flex-col gap-3">
                      {canRejoin ? (
                        <button
                          onClick={() => navigate(`/waiting-room/${meeting.meetingCode}`)}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary/10 py-2.5 font-bold text-primary transition-colors hover:bg-primary/20"
                        >
                          <span className="material-symbols-outlined text-[18px]">login</span>
                          Rejoin meeting
                        </button>
                      ) : (
                        <div className="rounded-xl bg-slate-100 py-2.5 text-center font-bold text-slate-400 dark:bg-slate-700/50">
                          Ended
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => openChatHistory(meeting)}
                          disabled={!canViewChatHistory}
                          className={`rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                            canViewChatHistory
                              ? "bg-slate-900 text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                              : "cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                          }`}
                        >
                          View chat
                        </button>
                        <button
                          onClick={() => navigate("/recordings")}
                          disabled={!canViewRecordings}
                          className={`rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                            canViewRecordings
                              ? "bg-primary/10 text-primary hover:bg-primary/20"
                              : "cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                          }`}
                        >
                          Recordings
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {historyData.totalPages > 1 && (
              <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-6 dark:border-slate-700">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Showing <span className="font-bold text-slate-900 dark:text-white">{indexOfFirstItem + 1}</span> to{" "}
                  <span className="font-bold text-slate-900 dark:text-white">
                    {Math.min(currentPage * itemsPerPage, historyData.totalElements)}
                  </span>{" "}
                  of <span className="font-bold text-slate-900 dark:text-white">{historyData.totalElements}</span> meetings
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <span className="material-symbols-outlined">chevron_left</span>
                  </button>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedMeeting && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-700">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedMeeting.title || "Chat history"}</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Full chat history for meeting code <span className="font-mono">{selectedMeeting.meetingCode}</span>
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedMeeting(null);
                  setChatHistory([]);
                }}
                className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {isChatLoading ? (
                <div className="flex min-h-[240px] items-center justify-center">
                  <div className="size-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary"></div>
                </div>
              ) : chatHistory.length === 0 ? (
                <div className="flex min-h-[240px] flex-col items-center justify-center text-center">
                  <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600">chat_bubble</span>
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No saved messages for this meeting.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {chatHistory.map((message, index) => (
                    <div key={message.id || `${message.senderId}-${message.timestamp}-${index}`} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{message.senderName || "Unknown"}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(message.timestamp)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">{message.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default HistoryPage;
