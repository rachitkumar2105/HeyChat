import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import api from '../utils/api';

const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
    const { user } = useAuth();
    const [chats, setChats] = useState([]);
    const [activeChat, setActiveChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [contacts, setContacts] = useState({ friends: [], requests: [] });
    const [onlineUsers, setOnlineUsers] = useState(new Set());
    const [typingUsers, setTypingUsers] = useState({});
    const [loadingMessages, setLoadingMessages] = useState(false);

    // Load contacts
    const loadContacts = useCallback(async () => {
        if (!user) return;
        try {
            const res = await api.get('/user/contacts');
            setContacts(res.data);
        } catch (err) {
            console.error('Failed to load contacts:', err);
        }
    }, [user]);

    // Load chat list
    const loadChats = useCallback(async () => {
        if (!user) return;
        try {
            const res = await api.get('/chat/list');
            setChats(res.data);
        } catch (err) {
            console.error('Failed to load chats:', err);
        }
    }, [user]);

    // Open a chat with a user
    const openChat = useCallback(async (friend) => {
        setActiveChat(friend);
        setLoadingMessages(true);
        try {
            const res = await api.get(`/chat/with/${friend._id}`);
            setMessages(res.data.messages || []);
        } catch (err) {
            setMessages([]);
        } finally {
            setLoadingMessages(false);
        }
    }, []);

    // Add a new message to the current chat
    const addMessage = useCallback((msg) => {
        setMessages((prev) => {
            // Avoid duplicates
            if (prev.find((m) => m._id === msg._id)) return prev;
            return [...prev, msg];
        });
    }, []);

    // Update message status
    const updateMessageStatus = useCallback((messageId, update) => {
        setMessages((prev) =>
            prev.map((m) => (m._id === messageId ? { ...m, ...update } : m))
        );
    }, []);

    // Delete message locally
    const removeMessage = useCallback((messageId, deleteForEveryone) => {
        if (deleteForEveryone) {
            setMessages((prev) =>
                prev.map((m) =>
                    m._id === messageId
                        ? { ...m, deletedForEveryone: true, content: 'This message was deleted' }
                        : m
                )
            );
        } else {
            setMessages((prev) => prev.filter((m) => m._id !== messageId));
        }
    }, []);

    const setUserOnline = useCallback((userId) => {
        setOnlineUsers((prev) => new Set([...prev, userId]));
    }, []);

    const setUserOffline = useCallback((userId) => {
        setOnlineUsers((prev) => {
            const next = new Set(prev);
            next.delete(userId);
            return next;
        });
    }, []);

    const setTyping = useCallback((userId, isTyping) => {
        setTypingUsers((prev) => ({ ...prev, [userId]: isTyping }));
    }, []);

    useEffect(() => {
        if (user && !user.isAdmin) {
            loadContacts();
            loadChats();
        }
    }, [user, loadContacts, loadChats]);

    return (
        <ChatContext.Provider value={{
            chats, setChats, activeChat, setActiveChat,
            messages, setMessages, contacts, setContacts,
            onlineUsers, typingUsers, loadingMessages,
            loadContacts, loadChats, openChat,
            addMessage, updateMessageStatus, removeMessage,
            setUserOnline, setUserOffline, setTyping,
        }}>
            {children}
        </ChatContext.Provider>
    );
};

export const useChat = () => useContext(ChatContext);
