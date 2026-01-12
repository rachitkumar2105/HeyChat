import { useState, useEffect, useRef } from 'react';
import { db, auth } from '../lib/firebase';
import {
    collection, doc, onSnapshot, addDoc, setDoc, updateDoc, getDoc, deleteDoc
} from 'firebase/firestore';

const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
        },
    ],
    iceCandidatePoolSize: 10,
};

export default function useWebRTC() {
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [callStatus, setCallStatus] = useState('idle'); // idle, calling, incoming, active, ended
    const [callId, setCallId] = useState(null);
    const [incomingCallData, setIncomingCallData] = useState(null);

    const pc = useRef(null);

    // Initialize PeerConnection
    const createPeerConnection = () => {
        pc.current = new RTCPeerConnection(servers);

        pc.current.onicecandidate = (event) => {
            if (event.candidate && callId) {
                // This needs to be handled based on whether we are caller or callee
                // For simplicity, we'll push to a subcollection in the 'call' doc
                // This logic is usually split in createCall/answerCall functions
            }
        };

        pc.current.ontrack = (event) => {
            event.streams[0].getTracks().forEach((track) => {
                setRemoteStream((prev) => {
                    if (!prev) return event.streams[0];
                    return prev; // Stream already set
                });
            });
        };

        // Fallback for getting remote stream if ontrack doesn't fire immediately as expected in some browsers
        const remote = new MediaStream();
        pc.current.ontrack = (event) => {
            event.streams[0].getTracks().forEach((track) => {
                remote.addTrack(track);
            });
            setRemoteStream(remote);
        }
    };

    const setupSources = async (video = true, audio = true) => {
        const stream = await navigator.mediaDevices.getUserMedia({ video, audio });
        setLocalStream(stream);
        return stream;
    };

    const startCall = async (calleeId) => {
        const stream = await setupSources();
        createPeerConnection();

        stream.getTracks().forEach((track) => {
            pc.current.addTrack(track, stream);
        });

        const callDoc = doc(collection(db, 'calls'));
        const offerCandidates = collection(callDoc, 'offerCandidates');
        const answerCandidates = collection(callDoc, 'answerCandidates');

        setCallId(callDoc.id);

        pc.current.onicecandidate = (event) => {
            if (event.candidate) {
                addDoc(offerCandidates, event.candidate.toJSON());
            }
        };

        const offerDescription = await pc.current.createOffer();
        await pc.current.setLocalDescription(offerDescription);

        const offer = {
            sdp: offerDescription.sdp,
            type: offerDescription.type,
        };

        await setDoc(callDoc, {
            callerId: auth.currentUser.uid,
            calleeId,
            offer,
            status: 'offering',
            timestamp: new Date()
        });

        setCallStatus('calling');

        onSnapshot(callDoc, (snapshot) => {
            const data = snapshot.data();
            if (!pc.current || !data) return;

            if (pc.current.signalingState !== 'stable' && data.answer) {
                const answerDescription = new RTCSessionDescription(data.answer);
                pc.current.setRemoteDescription(answerDescription);
                setCallStatus('active');
            }

            if (data.status === 'ended') {
                endCall(false); // Don't delete doc again if remote ended it
            }
        });

        onSnapshot(answerCandidates, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const candidate = new RTCIceCandidate(change.doc.data());
                    pc.current.addIceCandidate(candidate);
                }
            });
        });

        return callDoc.id;
    };

    const answerCall = async (callIdToAnswer) => {
        const stream = await setupSources();
        createPeerConnection();
        setCallId(callIdToAnswer);

        stream.getTracks().forEach((track) => {
            pc.current.addTrack(track, stream);
        });

        const callDoc = doc(db, 'calls', callIdToAnswer);
        const offerCandidates = collection(callDoc, 'offerCandidates');
        const answerCandidates = collection(callDoc, 'answerCandidates');

        pc.current.onicecandidate = (event) => {
            if (event.candidate) {
                addDoc(answerCandidates, event.candidate.toJSON());
            }
        };

        const callData = (await getDoc(callDoc)).data();
        const offerDescription = callData.offer;

        await pc.current.setRemoteDescription(new RTCSessionDescription(offerDescription));

        const answerDescription = await pc.current.createAnswer();
        await pc.current.setLocalDescription(answerDescription);

        const answer = {
            type: answerDescription.type,
            sdp: answerDescription.sdp,
        };

        await updateDoc(callDoc, { answer, status: 'answered' });
        setCallStatus('active');

        onSnapshot(offerCandidates, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const candidate = new RTCIceCandidate(change.doc.data());
                    pc.current.addIceCandidate(candidate);
                }
            });
        });

        // Listen for end
        onSnapshot(callDoc, (snapshot) => {
            if (snapshot.data()?.status === 'ended') endCall(false);
        });
    };

    const endCall = async (notifyRemote = true) => {
        setCallStatus('ended');

        if (pc.current) {
            pc.current.close();
            pc.current = null;
        }

        if (localStream) {
            localStream.getTracks().forEach((track) => track.stop());
            setLocalStream(null);
        }

        setRemoteStream(null);

        if (callId && notifyRemote) {
            // We only mark as ended, we don't delete immediately so other side knows
            try {
                await updateDoc(doc(db, 'calls', callId), { status: 'ended' });
            } catch (e) { console.log("Call doc might already be gone"); }
        }

        setCallId(null);
        setIncomingCallData(null);

        // Reset status to idle after short delay to clear UI
        setTimeout(() => setCallStatus('idle'), 2000);
    };

    // Global Listener for Incoming Calls
    useEffect(() => {
        if (!auth.currentUser) return;

        const q = collection(db, 'calls');
        const unsubscribe = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    if (data.calleeId === auth.currentUser.uid && data.status === 'offering') {
                        // Verify this call isn't old (e.g. > 1 min)
                        // Here we just accept it
                        setIncomingCallData({ id: change.doc.id, ...data });
                        setCallStatus('incoming');
                    }
                }
            });
        });

        return () => unsubscribe();
    }, []);

    return {
        startCall,
        answerCall,
        endCall,
        localStream,
        remoteStream,
        callStatus,
        incomingCallData
    };
}
