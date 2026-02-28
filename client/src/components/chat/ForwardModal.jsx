import { useState } from 'react';
import { X, Forward } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import Avatar from '../common/Avatar';
import api from '../../utils/api';

export default function ForwardModal({ message, onClose }) {
    const { contacts } = useChat();
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);

    const handleForward = async () => {
        if (!selected) return;
        setLoading(true);
        try {
            await api.post('/chat/forward', { messageId: message._id, toUserId: selected._id });
            setDone(true);
            setTimeout(onClose, 1200);
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to forward');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="card w-full max-w-sm p-6 animate-slide-up">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Forward className="w-4 h-4 text-primary-500" />
                        Forward Message
                    </h3>
                    <button onClick={onClose} className="btn-ghost p-1 rounded-full"><X className="w-4 h-4" /></button>
                </div>

                {done ? (
                    <p className="text-center text-primary-600 dark:text-primary-400 py-4 font-medium">✓ Message forwarded!</p>
                ) : (
                    <>
                        <div className="space-y-1 max-h-60 overflow-y-auto mb-4">
                            {contacts.friends?.map((friend) => (
                                <button
                                    key={friend._id}
                                    onClick={() => setSelected(friend)}
                                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors ${selected?._id === friend._id
                                            ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-300 dark:border-primary-700'
                                            : 'hover:bg-gray-50 dark:hover:bg-dark-700'
                                        }`}
                                >
                                    <Avatar user={friend} size="sm" />
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">{friend.displayName}</span>
                                    {selected?._id === friend._id && (
                                        <span className="ml-auto text-primary-500 text-xs font-bold">✓</span>
                                    )}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={handleForward}
                            disabled={!selected || loading}
                            className="btn-primary w-full"
                        >
                            {loading ? 'Forwarding...' : 'Forward'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
