import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { meetingService } from '../services/meetingService';

const SummaryPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Hứng dữ liệu từ MeetingPage truyền sang (actionTaken: LEAVE, END, KICKED)
  const leaveData = location.state || {}; 

  // States
  const [stats, setStats] = useState({ participants: 0, messages: 0, duration: "0s" });
  const [isLoading, setIsLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [isRatingSubmitted, setIsRatingSubmitted] = useState(false);


  // 2. Tải dữ liệu thật từ Backend
  useEffect(() => {
    const fetchSummary = async () => {
      if (!leaveData.meetingCode) {
        setIsLoading(false);
        return;
      }
      try {
        const response = await meetingService.getMeetingSummary(leaveData.meetingCode, leaveData.actionTaken);
        setStats(response.data); 
      } catch (error) {
        console.error("Lỗi tải Summary:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummary();
  }, [leaveData]);

  // 3. Xử lý Gửi đánh giá sao
  const handleRatingSubmit = async (selectedStar) => {
    if (isRatingSubmitted || !leaveData.meetingCode) return;
    setRating(selectedStar);
    try {
      await meetingService.submitFeedback(leaveData.meetingCode, selectedStar);
      setIsRatingSubmitted(true);
    } catch (error) {
      console.error("Lỗi gửi đánh giá:", error);
    }
  };

  // Xác định Tiêu đề trang
  let pageTitle = "You left the meeting";
  if (leaveData.actionTaken === "END") pageTitle = "You ended the meeting";
  if (leaveData.actionTaken === "ENDED_BY_HOST") pageTitle = "The host has ended this meeting";
  if (leaveData.actionTaken === "KICKED" || leaveData.actionTaken === "KICKED_BY_HOST") pageTitle = "You were kicked from the meeting";


  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background text-white font-sans">
      <div className="max-w-2xl w-full text-center">
        
        {/* ICON CHÀO TẠM BIỆT */}
        <div className="size-20 bg-white/5 rounded-full flex items-center justify-center text-gray-400 mx-auto mb-8 shadow-inner border border-white/10">
          <span className="material-symbols-outlined text-4xl">waving_hand</span>
        </div>
        
        <h1 className="text-4xl font-black mb-4">{pageTitle}</h1>
        <p className="text-gray-400 mb-12">
          Meeting ID: <span className="font-mono text-gray-300">{leaveData.meetingCode || "Unknown"}</span> 
          <span className="mx-2">•</span> 
          <span className="font-bold text-white">{isLoading ? "Calculating..." : stats.duration}</span> duration
        </p>

        {/* NÚT ĐIỀU HƯỚNG */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          {(leaveData.actionTaken !== "END" && leaveData.actionTaken !== "ENDED_BY_HOST") && (
            <button
              onClick={() => navigate(`/waiting-room/${leaveData.meetingCode}`)}
              className="px-8 h-14 bg-primary hover:bg-blue-600 text-white font-black rounded-full shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">replay</span>
              Rejoin Meeting
            </button>
          )}
          <button
            onClick={() => navigate('/')}
            className="px-8 h-14 bg-white/5 hover:bg-white/10 text-white font-bold rounded-full border border-white/5 transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined">dashboard</span>
            Return Home
          </button>
        </div>

        {/* BẢNG THỐNG KÊ (STATS CARD) */}
        <div className="bg-surface rounded-2xl border border-white/5 overflow-hidden text-left shadow-2xl">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">
              {leaveData.actionTaken === "LEAVE" || leaveData.actionTaken === "KICKED" || leaveData.actionTaken === "KICKED_BY_HOST" ? "Your Personal Stats" : "Meeting Summary"}
            </h2>
            <span className="text-xs font-bold text-gray-400 bg-white/5 px-2 py-1 rounded">Archived</span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x divide-white/5">
            {/* CỘT TRÁI */}
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined">group</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-tighter">Participants</p>
                  <p className="text-lg font-black">{isLoading ? "--" : stats.participants} Joined</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="size-10 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500">
                  <span className="material-symbols-outlined">chat</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-tighter">Chat Messages</p>
                  <p className="text-lg font-black">{isLoading ? "--" : stats.messages} Sent</p>
                </div>
              </div>
            </div>

            {/* CỘT PHẢI */}
            <div className="p-6 space-y-6 border-t sm:border-t-0 border-white/5">
              <div className="flex items-center gap-4">
                <div className="size-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                  <span className="material-symbols-outlined">radio_button_checked</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-tighter">Recording</p>
                  <p className="text-sm font-bold text-gray-400">Not recorded</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="size-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500">
                  <span className="material-symbols-outlined">star</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-tighter">Call Quality</p>
                  
                  <div className={`flex text-yellow-400 mt-1 ${isRatingSubmitted ? 'opacity-80' : 'cursor-pointer'}`}>
                    {[1, 2, 3, 4, 5].map((star) => {
                      const isFilled = (hoverRating || rating) >= star;
                      return (
                        <span 
                          key={star}
                          onClick={() => !isRatingSubmitted && handleRatingSubmit(star)}
                          onMouseEnter={() => !isRatingSubmitted && setHoverRating(star)}
                          onMouseLeave={() => !isRatingSubmitted && setHoverRating(0)}
                          className={`material-symbols-outlined text-[22px] transition-all ${!isRatingSubmitted ? 'hover:scale-110' : ''}`}
                          style={{ fontVariationSettings: isFilled ? "'FILL' 1" : "'FILL' 0" }}
                        >
                          star
                        </span>
                      );
                    })}
                  </div>

                  {isRatingSubmitted && (
                    <p className="text-xs font-bold text-green-400 animate-in fade-in duration-300 mt-1">
                      Thanks for your feedback!
                    </p>
                  )}
                  
                </div>
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
};

export default SummaryPage;
