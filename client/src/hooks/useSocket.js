import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';

let socketInstance = null;

export const useSocket = () => {
    const { user } = useAuth();
    const { addMessage, updateMessageStatus, removeMessage, setUserOnline, setUserOffline, setTyping, loadContacts } = useChat();
    const socketRef = useRef(null);

    useEffect(() => {
        if (!user) return;
        const token = localStorage.getItem('token');
        if (!token) return;

        // Connect socket
        const socket = io(import.meta.env.VITE_BACKEND_URL || '', {
            auth: { token },
            transports: ['websocket'],
        });
        socketRef.current = socket;
        socketInstance = socket;

        socket.on('connect', () => console.log('Socket connected'));
        socket.on('connect_error', (err) => console.error('Socket error:', err.message));

        // Receive message
        socket.on('receiveMessage', (msg) => {
            addMessage(msg);
        });

        // Message sent confirmation
        socket.on('messageSent', (msg) => {
            addMessage(msg);
        });

        // Delivery status
        socket.on('messageDelivered', ({ messageId }) => {
            updateMessageStatus(messageId, { delivered: true });
        });

        // Seen status
        socket.on('messageSeen', ({ messageId, seenAt }) => {
            updateMessageStatus(messageId, { seen: true, seenAt });
        });

        // Message deleted
        socket.on('messageDeleted', ({ messageId, deleteForEveryone }) => {
            removeMessage(messageId, deleteForEveryone);
        });

        // Online/offline
        socket.on('userOnline', ({ userId }) => setUserOnline(userId));
        socket.on('userOffline', ({ userId }) => setUserOffline(userId));

        // Typing
        socket.on('userTyping', ({ from }) => setTyping(from, true));
        socket.on('userStopTyping', ({ from }) => setTyping(from, false));

        return () => {
            socket.disconnect();
            socketInstance = null;
        };
    }, [user]);

    return socketRef.current;
};

// Export socket instance for use in components
export const getSocket = () => socketInstance;
