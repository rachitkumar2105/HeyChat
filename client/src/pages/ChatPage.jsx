import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useSocket } from '../hooks/useSocket';
import Sidebar from '../components/sidebar/Sidebar';
import ChatWindow from '../components/chat/ChatWindow';
import { Sun, Moon, LogOut, MessageCircle } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ChatPage() {
    const { user, logout } = useAuth();
    const { openChat, activeChat, setActiveChat } = useChat();
    const { dark, toggle } = useTheme();
    const [chatId, setChatId] = useState(null);

    // Initialize socket connection
    useSocket();

    const handleSelectFriend = async (friend) => {
        await openChat(friend);
        // chatId will be fetched from the chat object
        setChatId(null); // Will be populated from getChatWith response
    };

    const handleBack = () => {
        setActiveChat(null);
    };

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-dark-900 overflow-hidden">
            {/* Sidebar */}
            <div className={`
        ${activeChat ? 'hidden md:flex' : 'flex'}
        flex-col w-full md:w-80 lg:w-96 flex-shrink-0
      `}>
                {/* User bar */}
                <div className="flex items-center gap-3 px-4 py-3 bg-primary-500 text-white">
                    <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-semibold text-sm flex-shrink-0">
                        {user?.displayName?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{user?.displayName}</p>
                        <p className="text-xs text-primary-100 truncate">@{user?.username}</p>
                    </div>
                    <button onClick={toggle} className="p-1.5 rounded-full hover:bg-white/10 transition-colors" title="Toggle theme">
                        {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>
                    <button onClick={logout} className="p-1.5 rounded-full hover:bg-white/10 transition-colors" title="Logout">
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden">
                    <Sidebar onSelectFriend={handleSelectFriend} />
                </div>
            </div>

            {/* Chat window */}
            <div className={`
        ${activeChat ? 'flex' : 'hidden md:flex'}
        flex-1 flex-col overflow-hidden
      `}>
                {activeChat ? (
                    <ChatWindow
                        friend={activeChat}
                        chatId={chatId}
                        onBack={handleBack}
                    />
                ) : (
                    /* Empty state */
                    <div className="flex flex-col items-center justify-center h-full bg-gray-50 dark:bg-dark-900">
                        <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900/20 rounded-full flex items-center justify-center mb-4">
                            <MessageCircle className="w-10 h-10 text-primary-500" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">HeyChat</h3>
                        <p className="text-gray-400 dark:text-gray-500 text-sm mt-2 text-center max-w-xs">
                            Select a conversation from the sidebar or search for a user to start chatting
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
