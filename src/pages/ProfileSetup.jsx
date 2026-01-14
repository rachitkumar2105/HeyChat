import { useState, useEffect } from 'react';
import { Camera, User, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { auth, db, storage } from '../lib/firebase';
import { doc, setDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { generateKeyPair, storeKeyPair, exportPublicKey, getKeyPair } from '../lib/crypto';

export default function ProfileSetup() {
    const [displayName, setDisplayName] = useState('');
    const [bio, setBio] = useState('');
    const [avatar, setAvatar] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState(null); // Local user state
    const [assignedUsername, setAssignedUsername] = useState('');
    const navigate = useNavigate();

    // Listen for auth state changes
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                console.log("ProfileSetup: User authenticated:", currentUser.email);

                // Fetch the assigned username from Firestore
                const fetchUserDoc = async () => {
                    try {
                        const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', currentUser.uid)));
                        if (!userDoc.empty) {
                            const userData = userDoc.docs[0].data();
                            if (userData.username) {
                                setAssignedUsername(userData.username);
                            }
                        }
                    } catch (e) {
                        console.error("Error fetching user doc:", e);
                    }
                };
                fetchUserDoc();
            } else {
                console.log("ProfileSetup: No user, redirecting to auth...");
                navigate('/auth');
            }
        });
        return () => unsubscribe();
    }, [navigate]);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setAvatar(file);
            setAvatarPreview(URL.createObjectURL(file));
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();

        if (!user) {
            alert("You must be logged in to save your profile.");
            return;
        }

        setLoading(true);

        try {
            let photoURL = '';
            if (avatar) {
                const storageRef = ref(storage, `avatars/${user.uid}`);
                await uploadBytes(storageRef, avatar);
                photoURL = await getDownloadURL(storageRef);
            }

            // Username is already assigned in Auth.jsx and fetched into assignedUsername state
            let username = assignedUsername;
            if (!username) {
                // Fallback for legacy
                username = user.email ? user.email.split('@')[0] : 'user';
            }

            // No need to check uniqueness here again if we trust Auth.jsx, 
            // but if user EDITED it, we would need to check. 
            // For now, prompt implies "Allocate", so we stick to the assigned one.


            // E2EE: Handle Key Generation
            let publicKeyJWK = null;
            try {
                // Check if we already have keys locally
                const existingKeys = await getKeyPair(user.uid);
                if (existingKeys) {
                    console.log("ProfileSetup: Keys already exist locally.");
                    publicKeyJWK = await exportPublicKey(existingKeys.publicKey);
                } else {
                    console.log("ProfileSetup: Generating new E2EE keys...");
                    const keyPair = await generateKeyPair();
                    await storeKeyPair(user.uid, keyPair);
                    publicKeyJWK = await exportPublicKey(keyPair.publicKey);
                    console.log("ProfileSetup: Keys generated and stored locally.");
                }
            } catch (err) {
                console.error("ProfileSetup: Error with keys:", err);
                // We continue even if key gen fails, but E2EE won't work for this user yet.
                // Optionally throw error to block signup.
            }

            console.log("Saving profile for:", user.uid, "Username:", username);

            await setDoc(doc(db, 'users', user.uid), {
                uid: user.uid,
                email: user.email,
                username,
                displayName,
                bio,
                photoURL,
                status: 'online',
                lastSeen: new Date().toISOString(),
                publicKey: publicKeyJWK // Store public key for others to use
            }, { merge: true }); // Merge to avoid overwriting existing fields if any

            console.log("Profile saved successfully!");
            navigate('/dashboard');
        } catch (error) {
            console.error("Error saving profile:", error);
            alert(`Failed to save profile: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (!user) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
            <div className="bg-gray-800 p-8 rounded-3xl shadow-2xl w-full max-w-lg border border-gray-700">
                <h2 className="text-3xl font-bold text-white mb-2 text-center">Complete Your Profile</h2>
                <p className="text-gray-400 text-center mb-8">Let others get to know you better</p>

                <form onSubmit={handleSave} className="space-y-6">
                    {/* Avatar Upload */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="relative group">
                            <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-700 border-4 border-gray-600 flex items-center justify-center">
                                {avatarPreview ? (
                                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <User size={64} className="text-gray-500" />
                                )}
                            </div>
                            <label className="absolute bottom-0 right-0 bg-purple-600 p-2 rounded-full cursor-pointer hover:bg-purple-500 transition-colors shadow-lg">
                                <Camera size={20} className="text-white" />
                                <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                            </label>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Click camera to upload</p>
                    </div>

                    {/* Inputs */}
                    <div>
                        <label className="block text-gray-300 mb-2 font-medium">Display Name</label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 text-white rounded-xl p-4 focus:ring-2 focus:ring-purple-500 outline-none transition-all placeholder-gray-500"
                            placeholder="e.g. John Doe"
                            required
                        />
                    </div>

                    {/* Username Preview */}
                    <div className="bg-gray-700/50 p-4 rounded-xl border border-gray-600/50">
                        <label className="block text-gray-400 text-sm mb-1">Your Username</label>
                        <p className="text-purple-400 font-mono">@{assignedUsername || 'loading...'}</p>
                        <p className="text-xs text-gray-500 mt-1">People can search for you using this username.</p>
                    </div>

                    <div>
                        <label className="block text-gray-300 mb-2 font-medium">Bio (Optional)</label>
                        <textarea
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 text-white rounded-xl p-4 focus:ring-2 focus:ring-purple-500 outline-none transition-all placeholder-gray-500 resize-none h-32"
                            placeholder="Tell us a bit about yourself..."
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg transform hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? 'Saving...' : (
                            <>
                                <Save size={20} />
                                Save Profile
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
