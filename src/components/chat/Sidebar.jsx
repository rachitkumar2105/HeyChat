import { useState, useEffect } from 'react';
import { Search, LogOut, Settings, MessageSquarePlus } from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

export default function Sidebar({ onSelectChat, selectedChat }) {
    const [users, setUsers] = useState([]); // List of users to chat with
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();
    const currentUser = auth.currentUser;

    useEffect(() => {
        if (!currentUser) return;

        // TODO: In a real app, we would query 'chats' collection.
        // For this simple 1-on-1 version, we will list ALL users except self.
        // Optimization: Implement pagination or search-only for large user bases.

        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('uid', '!=', currentUser.uid));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const usersList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setUsers(usersList);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching users:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const filteredUsers = users.filter(user => {
        const nameMatch = user.displayName?.toLowerCase().includes(searchTerm.toLowerCase());
        const usernameMatch = user.username?.toLowerCase().includes(searchTerm.toLowerCase());
        return nameMatch || usernameMatch;
    });

    const handleLogout = () => {
        auth.signOut();
        navigate('/auth');
    };

    return (
        <div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
                <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
                    Heychat
                </h1>
                <div className="flex gap-2">
                    <button onClick={() => navigate('/settings')} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition">
                        <Settings size={20} />
                    </button>
                    <button onClick={handleLogout} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-red-400 transition">
                        <LogOut size={20} />
                    </button>
                </div>
            </div>


            {/* Search */}
            <div className="p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-3 text-gray-500" size={18} />
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-800 text-white pl-10 pr-4 py-2.5 rounded-xl border border-gray-700 focus:ring-2 focus:ring-purple-600 focus:border-transparent outline-none transition-all placeholder-gray-500"
                    />
                </div>
            </div>

            {/* User List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                {loading ? (
                    <div className="flex justify-center p-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="text-center text-gray-500 mt-10 p-4">
                        <p>No users found.</p>
                        <p className="text-sm">Invite friends to join!</p>
                    </div>
                ) : (
                    filteredUsers.map(user => (
                        <div
                            key={user.id}
                            onClick={() => onSelectChat(user)}
                            className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all ${selectedChat?.id === user.id
                                ? 'bg-purple-600/20 border border-purple-500/50'
                                : 'hover:bg-gray-800 border border-transparent'
                                }`}
                        >
                            <div className="relative">
                                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center text-lg font-bold text-gray-300">
                                    {user.photoURL ? (
                                        <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                                    ) : (
                                        user.displayName?.[0]?.toUpperCase() || '?'
                                    )}
                                </div>
                                {/* Status Indicator */}
                                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-gray-900 rounded-full"></span>
                            </div>

                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-200 truncate">{user.displayName}</h3>
                                <p className="text-xs text-purple-400 font-medium">@{user.username || user.email?.split('@')[0]}</p>
                                <p className="text-sm text-gray-500 truncate">{user.bio || "Available"}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div >
    );
}
