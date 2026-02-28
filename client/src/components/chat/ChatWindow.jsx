import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { getSocket } from '../../hooks/useSocket';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import ChatHeader from './ChatHeader';
import ForwardModal from './ForwardModal';
import Avatar from '../common/Avatar';
import { formatLastSeen } from '../../utils/validators';

export default function ChatWindow({ friend, chatId, onBack }) {
    const { user } = useAuth();
    const { messages, setMessages, loadingMessages, typingUsers } = useChat();
    const [replyTo, setReplyTo] = useState(null);
    const [forwardMsg, setForwardMsg] = useState(null);
    const [showProfile, setShowProfile] = useState(false);
    const bottomRef = useRef(null);
    const socket = getSocket();

    // Scroll to bottom on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Mark messages as seen
    useEffect(() => {
        if (!friend || !socket) return;
        messages.forEach((msg) => {
            if (
                String(msg.sender?._id || msg.sender) === String(friend._id) &&
                !msg.seen
            ) {
                socket.emit('messageSeen', { messageId: msg._id, senderId: friend._id });
            }
        });
    }, [messages, friend, socket]);

    const handleClearChat = () => setMessages([]);

    const isTyping = typingUsers[friend?._id];

    return (
        <div className="flex flex-col h-full">
            <ChatHeader
                friend={friend}
                chatId={chatId}
                onBack={onBack}
                onClearChat={handleClearChat}
                onViewProfile={() => setShowProfile(true)}
            />

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-3 bg-gray-50 dark:bg-dark-900 space-y-0.5">
                {loadingMessages ? (
                    <div className="flex justify-center items-center h-full">
                        <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/20 rounded-full flex items-center justify-center mb-3">
                            <span className="text-3xl">👋</span>
                        </div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            Say hi to {friend?.displayName}!
                        </p>
                        <p className="text-xs text-gray-400 mt-1">Messages are end-to-end encrypted</p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <MessageBubble
                            key={msg._id}
                            message={msg}
                            onReply={setReplyTo}
                            onForward={setForwardMsg}
                        />
                    ))
                )}

                {/* Typing indicator */}
                {isTyping && (
                    <div className="flex items-center gap-2 py-1">
                        <div className="message-received flex items-center gap-1 py-3 px-4">
                            <span className="typing-dot" style={{ animationDelay: '0ms' }} />
                            <span className="typing-dot" style={{ animationDelay: '160ms' }} />
                            <span className="typing-dot" style={{ animationDelay: '320ms' }} />
                        </div>
                    </div>
                )}

                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <ChatInput
                friend={friend}
                replyTo={replyTo}
                onCancelReply={() => setReplyTo(null)}
            />

            {/* Forward modal */}
            {forwardMsg && (
                <ForwardModal message={forwardMsg} onClose={() => setForwardMsg(null)} />
            )}

            {/* Profile modal */}
            {showProfile && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="card w-full max-w-xs p-6 text-center animate-slide-up">
                        <button
                            onClick={() => setShowProfile(false)}
                            className="absolute top-4 right-4 btn-ghost p-1 rounded-full"
                        >
                            ✕
                        </button>
                        <Avatar user={friend} size="xl" className="mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{friend?.displayName}</h3>
                        <p className="text-sm text-gray-400 mt-1">@{friend?.username}</p>
                        <p className="text-xs text-gray-400 mt-2">
                            Last seen {formatLastSeen(friend?.lastActive)}
                        </p>
                        <button onClick={() => setShowProfile(false)} className="btn-primary w-full mt-4">
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
