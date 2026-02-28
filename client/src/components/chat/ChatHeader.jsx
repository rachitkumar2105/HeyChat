import { ArrowLeft, Phone, Video } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import Avatar from '../common/Avatar';
import ChatMenu from '../chat/ChatMenu';
import { formatLastSeen } from '../../utils/validators';

export default function ChatHeader({ friend, chatId, onBack, onClearChat, onViewProfile }) {
    const { onlineUsers, typingUsers } = useChat();
    const isOnline = onlineUsers.has(friend?._id);
    const isTyping = typingUsers[friend?._id];

    return (
        <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-dark-800 border-b border-gray-100 dark:border-dark-700 shadow-sm">
            {/* Back button (mobile) */}
            <button onClick={onBack} className="md:hidden btn-ghost p-2 rounded-full -ml-1">
                <ArrowLeft className="w-5 h-5" />
            </button>

            <Avatar user={friend} size="md" showOnline isOnline={isOnline} />

            <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">{friend?.displayName}</h3>
                <p className="text-xs text-gray-400 truncate">
                    {isTyping ? (
                        <span className="text-primary-500 font-medium">typing...</span>
                    ) : isOnline ? (
                        <span className="text-primary-500">Online</span>
                    ) : (
                        `Last seen ${formatLastSeen(friend?.lastActive)}`
                    )}
                </p>
            </div>

            <div className="flex items-center gap-1">
                <ChatMenu
                    friend={friend}
                    chatId={chatId}
                    onClearChat={onClearChat}
                    onViewProfile={onViewProfile}
                />
            </div>
        </div>
    );
}
