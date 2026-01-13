import { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, Phone, Video, MoreVertical, Smile, ArrowLeft } from 'lucide-react';
import { auth, db, storage } from '../../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
    collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, setDoc, doc, getDoc
} from 'firebase/firestore';
import { encryptMessage, decryptMessage, getKeyPair, importPublicKey, encryptFile, decryptFile, arrayBufferToBase64, base64ToArrayBuffer } from '../../lib/crypto';
import CallModal from '../call/CallModal';

export default function ChatWindow({ chatUser, onBack, onCallStart }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [chatId, setChatId] = useState(null);
    const messagesEndRef = useRef(null);
    const [isCallOpen, setIsCallOpen] = useState(false);
    const [recipientPublicKey, setRecipientPublicKey] = useState(null);
    const [myKeys, setMyKeys] = useState(null);
    const [decryptedCache, setDecryptedCache] = useState({});
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);
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
        const otherId = chatUser.id || chatUser.uid;
        if (!otherId) {
            console.error("ChatWindow: chatUser has no ID/UID", chatUser);
            return;
        }

        const id = currentUser.uid > otherId
            ? `${currentUser.uid}_${otherId}`
            : `${otherId}_${currentUser.uid}`;

        setChatId(id);

        // Create the chat document if it doesn't exist
        const setupChat = async () => {
            const chatRef = doc(db, 'chats', id);
            const chatSnap = await getDoc(chatRef);
            if (!chatSnap.exists()) {
                await setDoc(chatRef, {
                    users: [currentUser.uid, otherId],
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

    // Fetch keys on load
    useEffect(() => {
        const fetchKeys = async () => {
            if (!currentUser || !chatUser) return;

            // 1. Get my keys from local storage
            try {
                const keys = await getKeyPair(currentUser.uid);
                setMyKeys(keys);
            } catch (e) {
                console.error("Failed to load my keys:", e);
            }

            // 2. Get recipient's public key from Firestore
            try {
                const userDoc = await getDoc(doc(db, 'users', chatUser.id || chatUser.uid));
                if (userDoc.exists() && userDoc.data().publicKey) {
                    const importedKey = await importPublicKey(userDoc.data().publicKey);
                    setRecipientPublicKey(importedKey);
                } else {
                    console.warn("Recipient has no public key");
                }
            } catch (e) {
                console.error("Failed to fetch recipient public key:", e);
            }
        };
        fetchKeys();
    }, [chatUser, currentUser]);

    // Decrypt messages when they change or keys are loaded
    useEffect(() => {
        const decryptAll = async () => {
            if (!myKeys || messages.length === 0) return;

            const newCache = { ...decryptedCache };
            let updated = false;

            for (const msg of messages) {
                // Skip if already in cache
                if (newCache[msg.id]) continue;

                if (msg.type === 'image' && msg.keys && msg.keys[currentUser.uid]) {
                    // Decrypt Image
                    try {
                        // 1. Decrypt AES Key using RSA Private Key
                        const encryptedSessionKey = base64ToArrayBuffer(msg.keys[currentUser.uid]);
                        const sessionKeyRaw = await window.crypto.subtle.decrypt(
                            { name: "RSA-OAEP" },
                            myKeys.privateKey,
                            encryptedSessionKey
                        );

                        // 2. Fetch Encrypted Blob
                        const response = await fetch(msg.url);
                        const encryptedBlob = await response.blob();

                        // 3. Decrypt Blob
                        const iv = base64ToArrayBuffer(msg.iv);
                        const decryptedBlob = await decryptFile(encryptedBlob, sessionKeyRaw, iv);

                        newCache[msg.id] = URL.createObjectURL(decryptedBlob);
                        updated = true;
                    } catch (e) {
                        console.error("Failed to decrypt image", e);
                        newCache[msg.id] = null; // Mark failure
                    }
                }
                // Decrypt Text
                else if (msg.keys && !newCache[msg.id]) {
                    try {
                        const text = await decryptMessage(msg, myKeys.privateKey, currentUser.uid);
                        newCache[msg.id] = text;
                        updated = true;
                    } catch (e) {
                        newCache[msg.id] = "🔒 Decryption Failed";
                        updated = true;
                    }
                }
                // Handle legacy plaintext
                else if (!msg.keys && !newCache[msg.id]) {
                    newCache[msg.id] = msg.text;
                    updated = true;
                }
            }

            if (updated) {
                setDecryptedCache(newCache);
            }
        };
        decryptAll();
    }, [messages, myKeys]);

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file || !chatId || !myKeys || !recipientPublicKey) return;

        setUploading(true);
        try {
            console.log("🔒 Encrypting Image...");
            // 1. Encrypt File
            const { encryptedBlob, sessionKey, iv } = await encryptFile(file);

            // 2. Encrypt Session Key for recipients
            const recipientId = chatUser.id || chatUser.uid;

            // Encrypt keys using RSA
            const encryptedKeyMe = await window.crypto.subtle.encrypt(
                { name: "RSA-OAEP" },
                myKeys.publicKey,
                sessionKey
            );
            const encryptedKeyOther = await window.crypto.subtle.encrypt(
                { name: "RSA-OAEP" },
                recipientPublicKey,
                sessionKey
            );

            const keys = {
                [currentUser.uid]: arrayBufferToBase64(encryptedKeyMe),
                [recipientId]: arrayBufferToBase64(encryptedKeyOther)
            };

            // 3. Upload Encrypted Blob
            const storageRef = ref(storage, `chat-images/${chatId}/${Date.now()}_encrypted`);
            await uploadBytes(storageRef, encryptedBlob);
            const downloadURL = await getDownloadURL(storageRef);

            // 4. Send Message
            await addDoc(collection(db, 'chats', chatId, 'messages'), {
                type: 'image',
                url: downloadURL,
                iv: arrayBufferToBase64(iv),
                keys: keys,
                senderId: currentUser.uid,
                createdAt: serverTimestamp(),
                text: '[Encrypted Photo]' // Fallback text
            });

        } catch (error) {
            console.error("Error uploading image:", error);
            alert("Upload failed.");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !chatId) return;

        try {
            let messageData = {
                text: newMessage, // Fallback for legacy clients (optional, or send garbled text to enforce)
                senderId: currentUser.uid,
                createdAt: serverTimestamp(),
            };

            // If we have both keys, start Encryption
            if (myKeys && recipientPublicKey) {
                console.log("🔒 Encrypting message...");
                const recipientId = chatUser.id || chatUser.uid;
                const publicKeys = {
                    [currentUser.uid]: myKeys.publicKey, // Encrypt for self so I can read it later
                    [recipientId]: recipientPublicKey
                };

                const encryptedData = await encryptMessage(newMessage, publicKeys);

                // Overwrite/Extend messageData with encrypted fields
                messageData = {
                    ...messageData,
                    text: encryptedData.text, // Store encrypted ciphertext in main text field (or separate one)
                    iv: encryptedData.iv,
                    keys: encryptedData.keys
                };
            } else {
                console.warn("⚠️ Sending in PLAINTEXT (Missing keys)");
            }

            await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);
            setNewMessage('');
        } catch (error) {
            console.error("Error sending message:", error);
            alert("Failed to send message. Please try again.");
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
                                {msg.type === 'image' ? (
                                    decryptedCache[msg.id] ? (
                                        <img src={decryptedCache[msg.id]} alt="Encrypted" className="rounded-lg max-w-full" />
                                    ) : (
                                        <div className="flex items-center gap-2 italic opacity-70">
                                            <span>🔒 Decrypting Photo...</span>
                                        </div>
                                    )
                                ) : (
                                    <p>{decryptedCache[msg.id] || (msg.keys ? "🔒 Decrypting..." : msg.text)}</p>
                                )}

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
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className={`p-2 text-gray-400 hover:text-white transition ${uploading ? 'animate-pulse' : ''}`}
                            disabled={uploading}
                        >
                            <Paperclip size={20} />
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileSelect}
                        />
                    </div>
                    <input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="flex-1 bg-transparent px-2 py-2 outline-none text-white placeholder-gray-500"
                        placeholder={recipientPublicKey ? "Type a secure message..." : "Type a message (Unencrypted)..."}
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
