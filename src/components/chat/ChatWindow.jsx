import { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, Phone, Video, MoreVertical, Smile, ArrowLeft } from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import {
    collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, setDoc, doc, getDoc
} from 'firebase/firestore';
import CallModal from '../call/CallModal';

export default function ChatWindow({ chatUser, onBack, onCallStart }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [chatId, setChatId] = useState(null);
    const messagesEndRef = useRef(null);
    const [isCallOpen, setIsCallOpen] = useState(false);
    const currentUser = auth.currentUser;

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (!currentUser || !chatUser) return;

        // Generate a consistent Chat ID: alphabetical order of UIDs ensures consistency
        const id = currentUser.uid > chatUser.uid
            ? `${currentUser.uid}_${chatUser.id}`
            : `${chatUser.id}_${currentUser.uid}`;

        setChatId(id);

        // Create the chat document if it doesn't exist
        const setupChat = async () => {
            const chatRef = doc(db, 'chats', id);
            const chatSnap = await getDoc(chatRef);
            if (!chatSnap.exists()) {
                await setDoc(chatRef, {
                    users: [currentUser.uid, chatUser.id],
                    createdAt: serverTimestamp()
                });
            }
        };
        setupChat();

        // Listen for messages
        const q = query(
            collection(db, 'chats', id, 'messages'),
            orderBy('createdAt', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMessages(snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })));
        });

        return () => unsubscribe();
    }, [chatUser, currentUser]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !chatId) return;

        try {
            await addDoc(collection(db, 'chats', chatId, 'messages'), {
                text: newMessage,
                senderId: currentUser.uid,
                createdAt: serverTimestamp(),
            });
            setNewMessage('');
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };

    return (
        <div className="flex-1 bg-gray-900 flex flex-col relative overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/80 backdrop-blur-md z-10">
                <div className="flex items-center gap-4">
                    {onBack && (
                        <button onClick={onBack} className="md:hidden p-2 hover:bg-gray-800 rounded-full transition text-gray-400">
                            <ArrowLeft size={24} />
                        </button>
                    )}
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center font-bold text-lg">
                        {chatUser.photoURL ? (
                            <img src={chatUser.photoURL} alt={chatUser.displayName} className="w-full h-full object-cover" />
                        ) : (
                            chatUser.displayName?.[0]?.toUpperCase()
                        )}
                    </div>
                    <div>
                        <h3 className="font-bold text-white cursor-pointer">{chatUser.displayName}</h3>
                        <span className="text-xs text-green-400 flex items-center gap-1">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            Online
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-purple-400">
                    <button onClick={onCallStart} className="p-2 hover:bg-gray-800 rounded-full transition"><Phone size={20} /></button>
                    <button onClick={onCallStart} className="p-2 hover:bg-gray-800 rounded-full transition"><Video size={20} /></button>
                    <button className="p-2 hover:bg-gray-800 rounded-full transition"><MoreVertical size={20} /></button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed">
                {messages.map((msg) => {
                    const isMe = msg.senderId === currentUser.uid;
                    return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                            <div className={`
                            max-w-[70%] p-3 px-4 rounded-2xl shadow-md text-sm md:text-base break-words
                            ${isMe
                                    ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-tr-none'
                                    : 'bg-gray-800 border border-gray-700 text-gray-100 rounded-tl-none'
                                }
                        `}>
                                <p>{msg.text}</p>
                                <div className={`text-[10px] mt-1 flex gap-1 items-center opacity-70 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    {msg.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-4 bg-gray-900 border-t border-gray-800 z-10">
                <div className="flex items-center gap-2 bg-gray-800 p-2 rounded-full border border-gray-700 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500 transition-all">
                    <button type="button" className="p-2 text-gray-400 hover:text-white transition"><Paperclip size={20} /></button>
                    <input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="flex-1 bg-transparent px-2 py-2 outline-none text-white placeholder-gray-500"
                        placeholder="Type a message..."
                    />
                    <button type="button" className="p-2 text-gray-400 hover:text-white transition"><Smile size={20} /></button>
                    <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="p-3 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full hover:shadow-lg hover:scale-105 transition transform text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Send size={18} />
                    </button>
                </div>
            </form>

            {/* Call Modal Mockup */}
            <CallModal
                isOpen={isCallOpen}
                onClose={() => setIsCallOpen(false)}
                callerName={chatUser.displayName}
            />
        </div>
    )
}
