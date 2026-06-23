import React, { useState, useEffect, useRef } from 'react';
import { meetingService } from '../services/meetingService';

const ChatPanel = ({ meetingCode, currentUser, stompClient, isStompConnected }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (meetingCode) {
      fetchHistory();
    }
  }, [meetingCode]);

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      const data = await meetingService.getChatHistory(meetingCode);
      setMessages(data || []);
    } catch (error) {
      console.error("Lỗi tải lịch sử chat:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!stompClient || !isStompConnected) return;

    const chatSubscription = stompClient.subscribe(
      `/topic/meeting/${meetingCode}/chat`,
      (message) => {
        const newMsg = JSON.parse(message.body);
        setMessages((prev) => [...prev, newMsg]);
      }
    );

    return () => chatSubscription.unsubscribe();
  }, [stompClient, isStompConnected, meetingCode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !stompClient || !stompClient.active) return;

    const chatMessage = {
      senderId: currentUser.userId,
      senderName: currentUser.fullName,
      content: inputMessage.trim()
    };

    stompClient.publish({
      destination: `/app/meeting/${meetingCode}/chat.sendMessage`,
      body: JSON.stringify(chatMessage)
    });

    setInputMessage("");
  };

  const formatTime = (isoString) => {
    if (!isoString) return "";
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col flex-grow h-full overflow-hidden">
      {/* Danh sách tin nhắn */}
      <div className="flex-grow overflow-y-auto p-4 space-y-4 no-scrollbar">
        <p className="text-[10px] text-center text-gray-500 font-bold uppercase tracking-widest bg-white/5 py-2 rounded-lg mb-4">
          Messages are saved to history
        </p>
        
        {isLoading ? (
           <div className="text-center text-sm text-gray-500 mt-4">Loading messages...</div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.senderId === currentUser.userId;
            return (
              <div key={msg.id || index} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                <div className="flex items-center gap-2 mb-1 px-1">
                  {!isMe && <span className="text-[10px] font-black text-gray-400">{msg.senderName}</span>}
                  <span className="text-[9px] text-gray-600">{formatTime(msg.timestamp)}</span>
                </div>
                <div
                  className={`max-w-[85%] p-3 text-sm leading-relaxed ${
                    isMe
                      ? "bg-primary text-white rounded-2xl rounded-tr-none shadow-md shadow-primary/10"
                      : "bg-white/5 text-gray-200 rounded-2xl rounded-tl-none border border-white/5"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Ô nhập tin nhắn */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-white/5 bg-background/40 mt-auto">
        <div className="relative">
          <input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Send a message..."
            className="w-full bg-surface border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-white"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-primary hover:bg-primary/10 disabled:text-gray-600 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatPanel;