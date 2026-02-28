import { useState, useRef, useEffect } from 'react';
import { Search, UserPlus, Bell, X, Check, CheckCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import Avatar from '../common/Avatar';
import { formatLastSeen, formatTime } from '../../utils/validators';
import api from '../../utils/api';

export default function Sidebar({ onSelectFriend }) {
    const { user } = useAuth();
    const { contacts, loadContacts, onlineUsers } = useChat();
    const [tab, setTab] = useState('chats'); // 'chats' | 'search' | 'requests'
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const searchTimer = useRef(null);

    const handleSearch = (val) => {
        setQuery(val);
        clearTimeout(searchTimer.current);
        if (!val.trim()) { setSearchResults([]); return; }
        setSearching(true);
        searchTimer.current = setTimeout(async () => {
            try {
                const res = await api.get(`/user/search?query=${val}`);
                setSearchResults(res.data);
            } catch { setSearchResults([]); }
            finally { setSearching(false); }
        }, 400);
    };

    const sendRequest = async (toId) => {
        try {
            await api.post('/user/request', { toId });
            alert('Request sent!');
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to send request');
        }
    };

    const acceptRequest = async (requestId) => {
        try {
            await api.post('/user/accept', { requestId });
            loadContacts();
        } catch (err) {
            console.error(err);
        }
    };

    const rejectRequest = async (requestId) => {
        try {
            await api.post('/user/reject', { requestId });
            loadContacts();
        } catch (err) {
            console.error(err);
        }
    };

    const pendingRequests = contacts.requests?.filter((r) => r.status === 'pending') || [];

    return (
        <div className="flex flex-col h-full bg-white dark:bg-dark-800 border-r border-gray-100 dark:border-dark-700">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 dark:border-dark-700">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">HeyChat</h2>
                    <div className="flex items-center gap-1">
                        {pendingRequests.length > 0 && (
                            <button
                                onClick={() => setTab('requests')}
                                className="relative btn-ghost p-2 rounded-full"
                            >
                                <Bell className="w-5 h-5" />
                                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                                    {pendingRequests.length}
                                </span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Search bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        className="input-field pl-9 py-2 text-sm"
                        placeholder="Search users..."
                        value={query}
                        onChange={(e) => { handleSearch(e.target.value); if (e.target.value) setTab('search'); else setTab('chats'); }}
                    />
                    {query && (
                        <button onClick={() => { setQuery(''); setSearchResults([]); setTab('chats'); }} className="absolute right-3 top-1/2 -translate-y-1/2">
                            <X className="w-4 h-4 text-gray-400" />
                        </button>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mt-3">
                    {['chats', 'requests'].map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${tab === t
                                    ? 'bg-primary-500 text-white'
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700'
                                }`}
                        >
                            {t}
                            {t === 'requests' && pendingRequests.length > 0 && (
                                <span className="ml-1 bg-red-500 text-white text-xs px-1.5 rounded-full">
                                    {pendingRequests.length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {/* Search results */}
                {tab === 'search' && (
                    <div>
                        {searching && (
                            <div className="flex justify-center py-6">
                                <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        )}
                        {!searching && searchResults.length === 0 && query && (
                            <p className="text-center text-sm text-gray-400 py-8">No users found</p>
                        )}
                        {searchResults.map((u) => {
                            const isFriend = contacts.friends?.some((f) => f._id === u._id);
                            return (
                                <div key={u._id} className="sidebar-item">
                                    <Avatar user={u} showOnline isOnline={onlineUsers.has(u._id)} />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{u.displayName}</p>
                                        <p className="text-xs text-gray-400 truncate">@{u.username}</p>
                                    </div>
                                    {isFriend ? (
                                        <button onClick={() => onSelectFriend(u)} className="btn-primary text-xs py-1.5 px-3">
                                            Chat
                                        </button>
                                    ) : (
                                        <button onClick={() => sendRequest(u._id)} className="btn-ghost text-xs py-1.5 px-3 border border-primary-500 text-primary-500 rounded-xl">
                                            <UserPlus className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Chat requests */}
                {tab === 'requests' && (
                    <div>
                        {pendingRequests.length === 0 ? (
                            <p className="text-center text-sm text-gray-400 py-8">No pending requests</p>
                        ) : (
                            pendingRequests.map((req) => (
                                <div key={req._id} className="sidebar-item">
                                    <Avatar user={req.from} />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{req.from?.displayName}</p>
                                        <p className="text-xs text-gray-400">@{req.from?.username}</p>
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => acceptRequest(req._id)}
                                            className="p-1.5 bg-primary-500 text-white rounded-full hover:bg-primary-600 transition-colors"
                                            title="Accept"
                                        >
                                            <Check className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => rejectRequest(req._id)}
                                            className="p-1.5 bg-gray-100 dark:bg-dark-700 text-gray-500 rounded-full hover:bg-red-100 hover:text-red-500 transition-colors"
                                            title="Reject"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Friends list */}
                {tab === 'chats' && (
                    <div>
                        {contacts.friends?.length === 0 ? (
                            <div className="text-center py-12 px-4">
                                <div className="text-4xl mb-3">💬</div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No chats yet</p>
                                <p className="text-xs text-gray-400 mt-1">Search for users to start chatting</p>
                            </div>
                        ) : (
                            contacts.friends?.map((friend) => (
                                <button
                                    key={friend._id}
                                    onClick={() => onSelectFriend(friend)}
                                    className="sidebar-item w-full text-left"
                                >
                                    <Avatar user={friend} showOnline isOnline={onlineUsers.has(friend._id)} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{friend.displayName}</p>
                                        </div>
                                        <p className="text-xs text-gray-400 truncate">
                                            {onlineUsers.has(friend._id)
                                                ? '🟢 Online'
                                                : `Last seen ${formatLastSeen(friend.lastActive)}`}
                                        </p>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
