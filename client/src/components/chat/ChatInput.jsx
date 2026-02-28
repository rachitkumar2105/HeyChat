import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, MicOff, Smile, X, Image } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { getSocket } from '../../hooks/useSocket';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

export default function ChatInput({ friend, replyTo, onCancelReply }) {
    const { user } = useAuth();
    const { dark } = useTheme();
    const [text, setText] = useState('');
    const [showEmoji, setShowEmoji] = useState(false);
    const [recording, setRecording] = useState(false);
    const [uploading, setUploading] = useState(false);
    const inputRef = useRef(null);
    const typingTimer = useRef(null);
    const mediaRecorder = useRef(null);
    const audioChunks = useRef([]);

    const sendMessage = (content, type = 'text', fileUrl = '') => {
        const socket = getSocket();
        if (!socket) return;
        socket.emit('privateMessage', {
            to: friend._id,
            content,
            type,
            fileUrl,
            replyTo: replyTo?._id || null,
        });
        onCancelReply?.();
    };

    const handleSend = () => {
        if (!text.trim()) return;
        sendMessage(text.trim());
        setText('');
        stopTyping();
        inputRef.current?.focus();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleTyping = () => {
        const socket = getSocket();
        if (!socket) return;
        socket.emit('typing', { to: friend._id });
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(stopTyping, 2000);
    };

    const stopTyping = () => {
        const socket = getSocket();
        if (socket) socket.emit('stopTyping', { to: friend._id });
        clearTimeout(typingTimer.current);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                body: formData,
            });
            const data = await res.json();
            if (res.ok) {
                const type = data.type.startsWith('image') ? 'image' : data.type.startsWith('audio') ? 'audio' : 'video';
                sendMessage('', type, data.fileUrl);
            }
        } catch (err) {
            console.error('Upload failed:', err);
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder.current = new MediaRecorder(stream);
            audioChunks.current = [];
            mediaRecorder.current.ondataavailable = (e) => audioChunks.current.push(e.data);
            mediaRecorder.current.onstop = async () => {
                const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
                const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
                const formData = new FormData();
                formData.append('file', file);
                try {
                    const res = await fetch('/api/upload', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                        body: formData,
                    });
                    const data = await res.json();
                    if (res.ok) sendMessage('', 'audio', data.fileUrl);
                } catch (err) {
                    console.error('Voice upload failed:', err);
                }
                stream.getTracks().forEach((t) => t.stop());
            };
            mediaRecorder.current.start();
            setRecording(true);
        } catch (err) {
            alert('Microphone access denied');
        }
    };

    const stopRecording = () => {
        mediaRecorder.current?.stop();
        setRecording(false);
    };

    useEffect(() => () => clearTimeout(typingTimer.current), []);

    return (
        <div className="border-t border-gray-100 dark:border-dark-700 bg-white dark:bg-dark-800 p-3">
            {/* Reply preview */}
            {replyTo && (
                <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-gray-50 dark:bg-dark-700 rounded-xl border-l-4 border-primary-500">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-primary-600 dark:text-primary-400">Replying to message</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{replyTo.content || '[media]'}</p>
                    </div>
                    <button onClick={onCancelReply} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            <div className="flex items-end gap-2">
                {/* Emoji */}
                <div className="relative">
                    <button
                        onClick={() => setShowEmoji(!showEmoji)}
                        className="btn-ghost p-2 rounded-full flex-shrink-0"
                    >
                        <Smile className="w-5 h-5" />
                    </button>
                    {showEmoji && (
                        <div className="absolute bottom-12 left-0 z-50">
                            <EmojiPicker
                                onEmojiClick={(e) => { setText((t) => t + e.emoji); setShowEmoji(false); }}
                                theme={dark ? 'dark' : 'light'}
                                height={350}
                                width={300}
                            />
                        </div>
                    )}
                </div>

                {/* File upload */}
                <label className="btn-ghost p-2 rounded-full flex-shrink-0 cursor-pointer">
                    <Paperclip className="w-5 h-5" />
                    <input type="file" className="hidden" accept="image/*,audio/*" onChange={handleFileUpload} />
                </label>

                {/* Text input */}
                <div className="flex-1">
                    <textarea
                        ref={inputRef}
                        value={text}
                        onChange={(e) => { setText(e.target.value); handleTyping(); }}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message..."
                        rows={1}
                        className="input-field resize-none py-2.5 max-h-32 overflow-y-auto"
                        style={{ lineHeight: '1.4' }}
                    />
                </div>

                {/* Send / Record */}
                {text.trim() ? (
                    <button onClick={handleSend} className="btn-primary p-2.5 rounded-full flex-shrink-0">
                        <Send className="w-5 h-5" />
                    </button>
                ) : (
                    <button
                        onMouseDown={startRecording}
                        onMouseUp={stopRecording}
                        onTouchStart={startRecording}
                        onTouchEnd={stopRecording}
                        className={`p-2.5 rounded-full flex-shrink-0 transition-colors ${recording
                                ? 'bg-red-500 text-white animate-pulse'
                                : 'btn-ghost'
                            }`}
                        title="Hold to record voice note"
                    >
                        {recording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>
                )}

                {uploading && (
                    <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                )}
            </div>
        </div>
    );
}
