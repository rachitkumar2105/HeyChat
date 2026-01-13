import { useState, useEffect } from 'react';
import Sidebar from '../components/chat/Sidebar';
import ChatWindow from '../components/chat/ChatWindow';
import CallModal from '../components/call/CallModal';
import useWebRTC from '../hooks/useWebRTC';
import { db, auth } from '../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export default function Dashboard() {
  const [selectedChat, setSelectedChat] = useState(null);

  // Calling Hook
  const {
    startCall, answerCall, endCall,
    localStream, remoteStream, callStatus, incomingCallData
  } = useWebRTC();

  const [callerName, setCallerName] = useState('');

  // Handle incoming call name resolution
  useEffect(() => {
    if (incomingCallData?.callerId) {
      getDoc(doc(db, 'users', incomingCallData.callerId)).then(snap => {
        if (snap.exists()) setCallerName(snap.data().displayName);
      });
    }
  }, [incomingCallData]);

  // Self-healing: Assign username to old users on login
  useEffect(() => {
    const checkAndFixUsername = async () => {
      if (!auth.currentUser) return;

      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (!userData.username && userData.email) {
          const newUsername = userData.email.split('@')[0];
          await updateDoc(userRef, { username: newUsername });
          console.log("Auto-assigned username to legacy user:", newUsername);
        }
      }
    };

    checkAndFixUsername();
  }, []);

  // Handle starting a call from ChatWindow
  const handleStartCall = () => {
    if (selectedChat) {
      startCall(selectedChat.id);
      setCallerName(selectedChat.displayName);
    }
  };

  const isCallModalOpen = callStatus !== 'idle' && callStatus !== 'ended';

  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden relative">
      <div className={`
        ${selectedChat ? 'hidden md:flex' : 'flex'} 
        w-full md:w-80 flex-col border-r border-gray-800
      `}>
        <Sidebar onSelectChat={setSelectedChat} selectedChat={selectedChat} />
      </div>

      <div className={`
        ${selectedChat ? 'flex' : 'hidden md:flex'} 
        flex-1 flex-col
      `}>
        {selectedChat ? (
          <ChatWindow
            chatUser={selectedChat}
            onBack={() => setSelectedChat(null)}
            onCallStart={handleStartCall}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-900 p-4 text-center">
            <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mb-6 animate-pulse">
              <span className="text-5xl">👋</span>
            </div>
            <h2 className="text-3xl font-bold text-gray-200 mb-2">Welcome to Heychat</h2>
            <p className="text-gray-500 text-lg">Select a conversation to start chatting</p>
          </div>
        )}
      </div>

      {/* Global Call Modal */}
      <CallModal
        isOpen={isCallModalOpen}
        isIncoming={callStatus === 'incoming'}
        callerName={callerName}
        onAnswer={() => answerCall(incomingCallData.id)}
        onEnd={endCall}
        localStream={localStream}
        remoteStream={remoteStream}
      />
    </div>
  );
}
