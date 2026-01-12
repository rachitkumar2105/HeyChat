import React, { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Video, Mic, MicOff, VideoOff, Camera } from 'lucide-react';

export default function CallModal({
    isOpen, onClose, isIncoming, callerName,
    onAnswer, onEnd, localStream, remoteStream
}) {
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);

    useEffect(() => {
        if (localStream && localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    useEffect(() => {
        if (remoteStream && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 backdrop-blur-md">
            <div className="relative w-full max-w-4xl aspect-video bg-gray-900 rounded-3xl overflow-hidden shadow-2xl border border-gray-800 flex flex-col">

                {/* Remote Video (Main) */}
                <div className="flex-1 relative bg-gray-800 flex items-center justify-center">
                    {remoteStream ? (
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="flex flex-col items-center animate-pulse">
                            <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-4xl font-bold mb-4 text-white shadow-lg">
                                {callerName?.[0]?.toUpperCase() || '?'}
                            </div>
                            <p className="text-xl text-gray-300 font-medium">
                                {isIncoming ? 'Incoming Video Call...' : 'Calling...'}
                            </p>
                        </div>
                    )}

                    {/* Local Video (PiP) */}
                    {localStream && (
                        <div className="absolute top-4 right-4 w-48 aspect-[3/4] bg-black rounded-xl overflow-hidden shadow-xl border-2 border-gray-700">
                            <video
                                ref={localVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover"
                            />
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="h-24 bg-gray-900/80 backdrop-blur flex items-center justify-center gap-6 pb-4">
                    {isIncoming ? (
                        <>
                            <button
                                onClick={onAnswer}
                                className="p-4 bg-green-500 hover:bg-green-400 rounded-full text-white shadow-lg hover:shadow-green-500/50 transition-all transform hover:scale-110"
                            >
                                <Phone size={28} fill="currentColor" />
                            </button>
                            <button
                                onClick={onEnd}
                                className="p-4 bg-red-500 hover:bg-red-400 rounded-full text-white shadow-lg hover:shadow-red-500/50 transition-all transform hover:scale-110"
                            >
                                <PhoneOff size={28} fill="currentColor" />
                            </button>
                        </>
                    ) : (
                        <>
                            <button className="p-4 bg-gray-700 hover:bg-gray-600 rounded-full text-white transition-all">
                                <Mic size={24} />
                            </button>
                            <button
                                onClick={onEnd}
                                className="p-4 bg-red-600 hover:bg-red-500 rounded-full text-white shadow-lg hover:shadow-red-500/50 transition-all transform hover:scale-110 w-16 h-16 flex items-center justify-center"
                            >
                                <PhoneOff size={32} fill="currentColor" />
                            </button>
                            <button className="p-4 bg-gray-700 hover:bg-gray-600 rounded-full text-white transition-all">
                                <Video size={24} />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
