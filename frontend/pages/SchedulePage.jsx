import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { meetingService } from "../services/meetingService";

const SchedulePage = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const today = new Date().toISOString().split("T")[0];

  const [formData, setFormData] = useState({
    title: "",
    date: today,
    time: "10:00",
    duration: 30,
    participants: [],
  });

  const [emailInput, setEmailInput] = useState("");

  const [meetingSettings, setMeetingSettings] = useState({
    waitingRoom: true,
    muteAudioOnEntry: false,
    muteVideoOnEntry: false,
    chatEnabled: true,
    screenShareEnabled: true,
  });

  const handleAddEmail = (e) => {
    e.preventDefault();
    const email = emailInput.trim();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (!formData.participants.includes(email)) {
        setFormData({
          ...formData,
          participants: [...formData.participants, email],
        });
      }
      setEmailInput("");
    } else if (email) {
      alert("Email không hợp lệ!");
    }
  };

  const handleRemoveEmail = (emailToRemove) => {
    setFormData({
      ...formData,
      participants: formData.participants.filter((e) => e !== emailToRemove),
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");

    try {
      const startDateTime = new Date(`${formData.date}T${formData.time}`);
      const endDateTime = new Date(
        startDateTime.getTime() + formData.duration * 60000
      );

      const formatLocal = (d) => {
        const pad = (n) => n.toString().padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
          d.getDate()
        )}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
      };

      const payload = {
        title: formData.title || "Untitled Meeting",
        start_time: formatLocal(startDateTime),
        end_time: formatLocal(endDateTime),
        participant_emails: formData.participants,

        access_type: "TRUSTED",
        settings: JSON.stringify(meetingSettings),
      };

      const newMeeting = await meetingService.scheduleMeeting(payload);

      alert(`Đã lên lịch thành công! Mã phòng: ${newMeeting.meetingCode}`);
      navigate("/");
    } catch (error) {
      setErrorMsg(
        error.response?.data?.message || "Có lỗi xảy ra khi lên lịch."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 lg:p-12 flex justify-center">
        <div className="w-full max-w-3xl flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Schedule a Meeting
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              Set up an upcoming meeting and generate an invitation link.
            </p>
          </div>

          <div className="bg-white dark:bg-[#111418] rounded-xl border border-slate-200 dark:border-[#283039] p-6 md:p-8 shadow-sm">
            {errorMsg && (
              <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-500 text-sm py-3 px-4 rounded-xl flex items-center gap-2">
                <span className="material-symbols-outlined">error</span>
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="flex flex-col gap-8">
              {/* Title Input */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Meeting Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Weekly Team Sync"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full bg-slate-50 dark:bg-[#1C232C] border border-slate-200 dark:border-[#283039] rounded-lg px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                />
              </div>

              {/* Date & Time Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    min={today}
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                    className="w-full bg-slate-50 dark:bg-[#1C232C] border border-slate-200 dark:border-[#283039] rounded-lg px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:outline-none custom-date-input"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Time
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.time}
                    onChange={(e) =>
                      setFormData({ ...formData, time: e.target.value })
                    }
                    className="w-full bg-slate-50 dark:bg-[#1C232C] border border-slate-200 dark:border-[#283039] rounded-lg px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:outline-none custom-time-input"
                  />
                </div>
              </div>

              {/* Duration Radio */}
              <div className="flex flex-col gap-3">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Duration
                </label>
                <div className="flex flex-wrap gap-3">
                  {/* Values in minutes */}
                  {[
                    { label: "15m", val: 15 },
                    { label: "30m", val: 30 },
                    { label: "45m", val: 45 },
                    { label: "1h", val: 60 },
                    { label: "2h", val: 120 },
                  ].map((dur) => (
                    <label key={dur.val} className="cursor-pointer">
                      <input
                        type="radio"
                        name="duration"
                        className="peer sr-only"
                        checked={formData.duration === dur.val}
                        onChange={() =>
                          setFormData({ ...formData, duration: dur.val })
                        }
                      />
                      <div className="px-5 py-2 rounded-full border border-slate-200 dark:border-[#283039] bg-slate-50 dark:bg-[#1C232C] text-sm font-medium text-slate-600 dark:text-slate-400 peer-checked:bg-primary peer-checked:text-white peer-checked:border-primary transition-all">
                        {dur.label}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Participants */}
              <div className="flex flex-col gap-3">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Invite Participants (Optional)
                </label>

                {/* List of added emails */}
                {formData.participants.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-1">
                    {formData.participants.map((email) => (
                      <div
                        key={email}
                        className="flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary px-3 py-1.5 rounded-full text-sm font-medium"
                      >
                        <span>{email}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveEmail(email)}
                          className="hover:text-red-500 transition-colors flex items-center"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            close
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Input field */}
                <div className="relative flex items-center group">
                  <span className="material-symbols-outlined absolute left-3 text-slate-400 group-focus-within:text-primary transition-colors text-[20px]">
                    person_add
                  </span>
                  <input
                    type="email"
                    placeholder="Enter email addresses and press Enter"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault(); // Ngăn form submit
                        handleAddEmail(e);
                      }
                    }}
                    className="w-full bg-slate-50 dark:bg-[#1C232C] border border-slate-200 dark:border-[#283039] rounded-lg pl-10 pr-24 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddEmail}
                    className="absolute right-2 px-4 py-1.5 bg-slate-200 dark:bg-[#283039] hover:bg-slate-300 dark:hover:bg-[#374151] text-xs font-bold rounded-full transition-colors text-slate-700 dark:text-white"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* --- Advanced Meeting Options --- */}
              <div className="flex flex-col gap-4 pt-4 border-t border-slate-100 dark:border-[#283039]">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Meeting Options
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  {/* Option 1: Waiting Room */}
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center mt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={meetingSettings.waitingRoom}
                        onChange={(e) =>
                          setMeetingSettings({
                            ...meetingSettings,
                            waitingRoom: e.target.checked,
                          })
                        }
                      />
                      <div className="size-5 rounded border-2 border-slate-300 dark:border-slate-600 peer-checked:bg-primary peer-checked:border-primary transition-all"></div>
                      <span className="material-symbols-outlined absolute text-white text-[14px] opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none">
                        check
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        Enable Waiting Room
                      </span>
                      <span className="text-xs text-slate-500">
                        Only users admitted by the host can join.
                      </span>
                    </div>
                  </label>

                  {/* Option 2: Mute Audio on Entry */}
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center mt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={meetingSettings.muteAudioOnEntry}
                        onChange={(e) =>
                          setMeetingSettings({
                            ...meetingSettings,
                            muteAudioOnEntry: e.target.checked,
                          })
                        }
                      />
                      <div className="size-5 rounded border-2 border-slate-300 dark:border-slate-600 peer-checked:bg-primary peer-checked:border-primary transition-all"></div>
                      <span className="material-symbols-outlined absolute text-white text-[14px] opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none">
                        check
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        Mute audio upon entry
                      </span>
                      <span className="text-xs text-slate-500">
                        Automatically mute participants' microphones.
                      </span>
                    </div>
                  </label>

                  {/* Option 3: Enable Chat */}
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center mt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={meetingSettings.chatEnabled}
                        onChange={(e) =>
                          setMeetingSettings({
                            ...meetingSettings,
                            chatEnabled: e.target.checked,
                          })
                        }
                      />
                      <div className="size-5 rounded border-2 border-slate-300 dark:border-slate-600 peer-checked:bg-primary peer-checked:border-primary transition-all"></div>
                      <span className="material-symbols-outlined absolute text-white text-[14px] opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none">
                        check
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        Allow Chat
                      </span>
                      <span className="text-xs text-slate-500">
                        Participants can send messages to everyone.
                      </span>
                    </div>
                  </label>

                  {/* Option 4: Mute Video on Entry */}
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center mt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={meetingSettings.muteVideoOnEntry}
                        onChange={(e) =>
                          setMeetingSettings({
                            ...meetingSettings,
                            muteVideoOnEntry: e.target.checked,
                          })
                        }
                      />
                      <div className="size-5 rounded border-2 border-slate-300 dark:border-slate-600 peer-checked:bg-primary peer-checked:border-primary transition-all"></div>
                      <span className="material-symbols-outlined absolute text-white text-[14px] opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none">
                        check
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        Turn off video upon entry
                      </span>
                      <span className="text-xs text-slate-500">
                        Automatically turn off participants' cameras.
                      </span>
                    </div>
                  </label>

                  {/* Option 5: Enable Screen Share */}
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center mt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={meetingSettings.screenShareEnabled}
                        onChange={(e) =>
                          setMeetingSettings({
                            ...meetingSettings,
                            screenShareEnabled: e.target.checked,
                          })
                        }
                      />
                      <div className="size-5 rounded border-2 border-slate-300 dark:border-slate-600 peer-checked:bg-primary peer-checked:border-primary transition-all"></div>
                      <span className="material-symbols-outlined absolute text-white text-[14px] opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none">
                        check
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        Allow Screen Share
                      </span>
                      <span className="text-xs text-slate-500">
                        Participants can share their screens.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Actions Buttons */}
              <div className="pt-4 border-t border-slate-100 dark:border-[#283039] flex items-center justify-end gap-4">
                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="px-6 py-3 rounded-full text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-[#283039] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex items-center justify-center min-w-[200px] gap-2 bg-primary hover:bg-blue-600 disabled:bg-blue-400 disabled:cursor-not-allowed text-white px-8 py-3 rounded-full text-sm font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isLoading ? (
                    <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[20px]">
                        event_available
                      </span>
                      Schedule Meeting
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SchedulePage;
