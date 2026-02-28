import { useState, useRef, useEffect } from 'react';
import {
    MoreVertical, Flag, ShieldOff, Shield, Trash2, User, X
} from 'lucide-react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import ReportModal from './ReportModal';

export default function ChatMenu({ friend, chatId, onClearChat, onViewProfile }) {
    const { user } = useAuth();
    const { loadContacts } = useChat();
    const [open, setOpen] = useState(false);
    const [showReport, setShowReport] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClick = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleBlock = async () => {
        try {
            const res = await api.post('/user/block', { targetId: friend._id });
            setIsBlocked(res.data.blocked);
            setOpen(false);
        } catch (err) {
            console.error(err);
        }
    };

    const handleClearChat = async () => {
        if (!window.confirm('Clear all messages in this chat?')) return;
        try {
            await api.post(`/chat/clear/${chatId}`);
            onClearChat?.();
            setOpen(false);
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setOpen(!open)}
                className="btn-ghost p-2 rounded-full"
                title="More options"
            >
                <MoreVertical className="w-5 h-5" />
            </button>

            {open && (
                <div className="dropdown-menu">
                    <button onClick={() => { setShowReport(true); setOpen(false); }} className="dropdown-item w-full text-left">
                        <Flag className="w-4 h-4" />
                        Report User
                    </button>
                    <button onClick={handleBlock} className="dropdown-item w-full text-left">
                        {isBlocked ? <Shield className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
                        {isBlocked ? 'Unblock User' : 'Block User'}
                    </button>
                    <button onClick={handleClearChat} className="dropdown-item danger w-full text-left">
                        <Trash2 className="w-4 h-4" />
                        Clear Chat
                    </button>
                    <button onClick={() => { onViewProfile?.(); setOpen(false); }} className="dropdown-item w-full text-left">
                        <User className="w-4 h-4" />
                        View Profile
                    </button>
                </div>
            )}

            {showReport && (
                <ReportModal
                    reportedUser={friend}
                    onClose={() => setShowReport(false)}
                />
            )}
        </div>
    );
}
