import { useState, useRef } from 'react';
import { Check, CheckCheck, Reply, Forward, Trash2, MoreVertical, Mic, Image } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatTime } from '../../utils/validators';
import api from '../../utils/api';
import { useChat } from '../../context/ChatContext';
import ReportModal from './ReportModal';

export default function MessageBubble({ message, onReply, onForward }) {
    const { user } = useAuth();
    const { removeMessage } = useChat();
    const [showActions, setShowActions] = useState(false);
    const [showReport, setShowReport] = useState(false);
    const isSent = String(message.sender?._id || message.sender) === String(user?.id || user?._id);

    const handleDelete = async (deleteForEveryone) => {
        try {
            await api.delete(`/chat/message/${message._id}`, { data: { deleteForEveryone } });
            removeMessage(message._id, deleteForEveryone);
        } catch (err) {
            console.error(err);
        }
    };

    if (message.deletedForEveryone) {
        return (
            <div className={`flex ${isSent ? 'justify-end' : 'justify-start'} mb-1`}>
                <span className="text-xs text-gray-400 dark:text-gray-500 italic px-3 py-1.5 bg-gray-100 dark:bg-dark-700 rounded-xl">
                    🚫 This message was deleted
                </span>
            </div>
        );
    }

    const renderContent = () => {
        if (message.type === 'image') {
            return (
                <img
                    src={message.fileUrl}
                    alt="Shared image"
                    className="max-w-[220px] rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => window.open(message.fileUrl, '_blank')}
                />
            );
        }
        if (message.type === 'audio') {
            return (
                <div className="flex items-center gap-2 min-w-[180px]">
                    <Mic className="w-4 h-4 flex-shrink-0" />
                    <audio controls src={message.fileUrl} className="h-8 max-w-[160px]" />
                </div>
            );
        }
        return <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>;
    };

    const renderTicks = () => {
        if (!isSent) return null;
        if (message.seen) return <CheckCheck className="w-3.5 h-3.5 text-blue-400" />;
        if (message.delivered) return <CheckCheck className="w-3.5 h-3.5 opacity-70" />;
        return <Check className="w-3.5 h-3.5 opacity-70" />;
    };

    return (
        <div
            className={`flex ${isSent ? 'justify-end' : 'justify-start'} mb-1 group`}
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}
        >
            <div className="flex flex-col max-w-xs lg:max-w-md">
                {/* Reply preview */}
                {message.replyTo && (
                    <div className={`text-xs px-3 py-1.5 mb-1 rounded-xl border-l-2 border-primary-400 ${isSent ? 'bg-primary-600/30 text-primary-100' : 'bg-gray-100 dark:bg-dark-600 text-gray-500 dark:text-gray-400'
                        }`}>
                        <span className="font-medium">Replying to:</span> {message.replyTo.content?.slice(0, 50) || '[media]'}
                    </div>
                )}

                <div className="relative flex items-end gap-1">
                    {/* Action buttons (hover) */}
                    {showActions && (
                        <div className={`flex items-center gap-1 ${isSent ? 'order-first' : 'order-last'}`}>
                            <button
                                onClick={() => onReply?.(message)}
                                className="p-1 rounded-full bg-gray-100 dark:bg-dark-600 hover:bg-gray-200 dark:hover:bg-dark-500 transition-colors"
                                title="Reply"
                            >
                                <Reply className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />
                            </button>
                            <button
                                onClick={() => onForward?.(message)}
                                className="p-1 rounded-full bg-gray-100 dark:bg-dark-600 hover:bg-gray-200 dark:hover:bg-dark-500 transition-colors"
                                title="Forward"
                            >
                                <Forward className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />
                            </button>
                            <div className="relative group/del">
                                <button
                                    className="p-1 rounded-full bg-gray-100 dark:bg-dark-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                    title="Delete"
                                >
                                    <Trash2 className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300 group-hover/del:text-red-500" />
                                </button>
                                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover/del:flex flex-col gap-1 bg-white dark:bg-dark-700 rounded-xl shadow-xl border border-gray-100 dark:border-dark-600 p-1 z-10 min-w-[140px]">
                                    <button
                                        onClick={() => handleDelete(false)}
                                        className="text-xs px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-dark-600 rounded-lg text-left whitespace-nowrap"
                                    >
                                        Delete for me
                                    </button>
                                    {isSent && (
                                        <button
                                            onClick={() => handleDelete(true)}
                                            className="text-xs px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-lg text-left whitespace-nowrap"
                                        >
                                            Delete for everyone
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Bubble */}
                    <div className={isSent ? 'message-sent' : 'message-received'}>
                        {message.forwarded && (
                            <p className="text-xs opacity-60 mb-1 flex items-center gap-1">
                                <Forward className="w-3 h-3" /> Forwarded
                            </p>
                        )}
                        {renderContent()}
                        <div className={`flex items-center gap-1 mt-1 ${isSent ? 'justify-end' : 'justify-start'}`}>
                            <span className="text-xs opacity-60">{formatTime(message.createdAt)}</span>
                            {renderTicks()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
