import { useState, useEffect } from 'react';
import { Camera, Save, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { auth, db, storage } from '../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function ProfileSettings() {
    const [displayName, setDisplayName] = useState('');
    const [bio, setBio] = useState('');
    const [photoURL, setPhotoURL] = useState('');
    const [avatar, setAvatar] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchProfile = async () => {
            if (auth.currentUser) {
                const docRef = doc(db, 'users', auth.currentUser.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setDisplayName(data.displayName || '');
                    setBio(data.bio || '');
                    setPhotoURL(data.photoURL || '');
                }
            }
        };
        fetchProfile();
    }, []);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setAvatar(file);
            setAvatarPreview(URL.createObjectURL(file));
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!auth.currentUser) return;
        setLoading(true);

        try {
            let newPhotoURL = photoURL;
            if (avatar) {
                const storageRef = ref(storage, `avatars/${auth.currentUser.uid}`);
                await uploadBytes(storageRef, avatar);
                newPhotoURL = await getDownloadURL(storageRef);
            }

            const userRef = doc(db, 'users', auth.currentUser.uid);
            await updateDoc(userRef, {
                displayName,
                bio,
                photoURL: newPhotoURL
            });

            alert("Profile updated successfully!");
        } catch (error) {
            console.error("Error updating profile:", error);
            alert("Failed to update profile.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
            <div className="bg-gray-800 p-8 rounded-3xl shadow-2xl w-full max-w-lg border border-gray-700 relative">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="absolute top-6 left-6 text-gray-400 hover:text-white transition"
                >
                    <ArrowLeft size={24} />
                </button>

                <h2 className="text-3xl font-bold text-white mb-6 text-center">Edit Profile</h2>

                <form onSubmit={handleSave} className="space-y-6">
                    <div className="flex flex-col items-center mb-8">
                        <div className="relative group">
                            <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-700 border-4 border-gray-600 flex items-center justify-center">
                                {(avatarPreview || photoURL) ? (
                                    <img src={avatarPreview || photoURL} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="text-4xl text-gray-500 font-bold">?</div>
                                )}
                            </div>
                            <label className="absolute bottom-0 right-0 bg-purple-600 p-2 rounded-full cursor-pointer hover:bg-purple-500 transition-colors shadow-lg">
                                <Camera size={20} className="text-white" />
                                <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                            </label>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Change profile photo</p>
                    </div>

                    <div>
                        <label className="block text-gray-300 mb-2 font-medium">Display Name</label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 text-white rounded-xl p-4 focus:ring-2 focus:ring-purple-500 outline-none transition-all placeholder-gray-500"
                            placeholder="Your Name"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-gray-300 mb-2 font-medium">Bio</label>
                        <textarea
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 text-white rounded-xl p-4 focus:ring-2 focus:ring-purple-500 outline-none transition-all placeholder-gray-500 resize-none h-32"
                            placeholder="About you..."
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
                                Save Changes
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
