import { useState } from 'react';
import { ArrowLeft, User, Lock, ChevronRight, Camera, Bell, HelpCircle, LogOut, Instagram, Twitter, Linkedin, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function SettingsPage() {
    const { user, logout, setUser } = useAuth();
    const navigate = useNavigate();
    const [view, setView] = useState('main'); // main, account, privacy
    const [loading, setLoading] = useState(false);

    // Profile State
    const [profileData, setProfileData] = useState({
        displayName: user?.displayName || '',
        about: user?.about || 'Hey there! I am using HeyChat',
        phoneNumber: user?.phoneNumber || '',
        socialLinks: user?.socialLinks || { instagram: '', twitter: '', linkedin: '', website: '' }
    });

    // Privacy State
    const [privacyData, setPrivacyData] = useState(user?.privacy || {
        lastSeen: 'everyone',
        profilePhoto: 'everyone',
        about: 'everyone',
        status: 'everyone',
        readReceipts: true
    });

    const handleUpdateProfile = async () => {
        setLoading(true);
        try {
            const res = await api.put('/user/profile', profileData);
            setUser({ ...user, ...res.data.user });
            alert('Profile updated!');
        } catch (err) {
            alert('Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePrivacy = async (key, value) => {
        const newPrivacy = { ...privacyData, [key]: value };
        setPrivacyData(newPrivacy);
        try {
            await api.put('/user/privacy', { privacy: newPrivacy });
            setUser({ ...user, privacy: newPrivacy });
        } catch (err) {
            console.error('Failed to update privacy');
        }
    };

    const renderMain = () => (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center gap-4 p-6 bg-white dark:bg-dark-800 mb-2 border-b dark:border-dark-700">
                <div className="relative group">
                    <img
                        src={user?.profilePic || `https://ui-avatars.com/api/?name=${user?.displayName}&background=random`}
                        className="w-16 h-16 rounded-full object-cover border-2 border-primary-500/20"
                    />
                    <div className="absolute -bottom-1 -right-1 p-1.5 bg-primary-500 text-white rounded-full border-2 border-white dark:border-dark-800">
                        <Camera className="w-3.5 h-3.5" />
                    </div>
                </div>
                <div className="flex-1">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{user?.displayName}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{user?.about || 'Available'}</p>
                </div>
            </div>

            <div className="space-y-1">
                <button onClick={() => setView('account')} className="w-full flex items-center justify-between p-4 bg-white dark:bg-dark-800 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl">
                            <User className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">Account</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Security notifications, change number</p>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300" />
                </button>

                <button onClick={() => setView('privacy')} className="w-full flex items-center justify-between p-4 bg-white dark:bg-dark-800 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl">
                            <Lock className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">Privacy</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Block contacts, disappearing messages</p>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300" />
                </button>
            </div>

            <div className="mt-8 px-6">
                <button
                    onClick={logout}
                    className="w-full flex items-center justify-center gap-2 p-4 text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-900/10 rounded-2xl transition-colors border-2 border-dashed border-red-200 dark:border-red-900/30"
                >
                    <LogOut className="w-5 h-5" />
                    Logout
                </button>
            </div>
        </div>
    );

    const renderAccount = () => (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300 p-6 space-y-6">
            <div className="space-y-4">
                <div>
                    <label className="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider ml-1">Display Name</label>
                    <input
                        className="input-field mt-1.5"
                        value={profileData.displayName}
                        onChange={(e) => setProfileData({ ...profileData, displayName: e.target.value })}
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider ml-1">About</label>
                    <textarea
                        className="input-field mt-1.5 resize-none h-20"
                        value={profileData.about}
                        onChange={(e) => setProfileData({ ...profileData, about: e.target.value })}
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider ml-1">Phone Number</label>
                    <input
                        className="input-field mt-1.5"
                        placeholder="+91 XXXXX XXXXX"
                        value={profileData.phoneNumber}
                        onChange={(e) => setProfileData({ ...profileData, phoneNumber: e.target.value })}
                    />
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Social Media Handles</h3>
                <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center gap-3 p-3 bg-white dark:bg-dark-800 rounded-2xl border dark:border-dark-700">
                        <Instagram className="w-5 h-5 text-pink-500" />
                        <input
                            className="bg-transparent flex-1 outline-none text-sm dark:text-white"
                            placeholder="Instagram ID"
                            value={profileData.socialLinks.instagram}
                            onChange={(e) => setProfileData({ ...profileData, socialLinks: { ...profileData.socialLinks, instagram: e.target.value } })}
                        />
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-white dark:bg-dark-800 rounded-2xl border dark:border-dark-700">
                        <Twitter className="w-5 h-5 text-blue-400" />
                        <input
                            className="bg-transparent flex-1 outline-none text-sm dark:text-white"
                            placeholder="Twitter ID"
                            value={profileData.socialLinks.twitter}
                            onChange={(e) => setProfileData({ ...profileData, socialLinks: { ...profileData.socialLinks, twitter: e.target.value } })}
                        />
                    </div>
                </div>
            </div>

            <button
                disabled={loading}
                onClick={handleUpdateProfile}
                className="btn-primary w-full py-4 rounded-2xl font-bold shadow-lg shadow-primary-500/20 disabled:opacity-50"
            >
                {loading ? 'Saving Changes...' : 'Save Changes'}
            </button>
        </div>
    );

    const renderPrivacy = () => (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300 px-6 py-4 space-y-6">
            <div className="space-y-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Who can see my personal info</p>

                {[
                    { label: 'Last seen and online', key: 'lastSeen' },
                    { label: 'Profile picture', key: 'profilePhoto' },
                    { label: 'About', key: 'about' },
                    { label: 'Status', key: 'status' }
                ].map((item) => (
                    <div key={item.key} className="flex flex-col py-3 border-b dark:border-dark-700 last:border-0">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">{item.label}</span>
                            <span className="text-xs font-medium text-primary-500 capitalize bg-primary-50 dark:bg-primary-900/20 px-2 py-1 rounded-lg">
                                {privacyData[item.key]}
                            </span>
                        </div>
                        <div className="flex gap-2">
                            {['everyone', 'contacts', 'nobody'].map((opt) => (
                                <button
                                    key={opt}
                                    onClick={() => handleUpdatePrivacy(item.key, opt)}
                                    className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-lg border transition-all ${privacyData[item.key] === opt
                                            ? 'bg-primary-500 text-white border-primary-500'
                                            : 'bg-white dark:bg-dark-800 text-gray-400 border-gray-100 dark:border-dark-700'
                                        }`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}

                <div className="flex items-center justify-between py-4 mt-2">
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">Read receipts</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight pr-8">If turned off, you won't send or receive Read receipts.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={privacyData.readReceipts}
                            onChange={(e) => handleUpdatePrivacy('readReceipts', e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-dark-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:bg-dark-900 peer-checked:bg-primary-500"></div>
                    </label>
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-dark-900 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-4 p-4 bg-white dark:bg-dark-800 border-b dark:border-dark-700 shrink-0">
                <button
                    onClick={() => view === 'main' ? navigate('/chat') : setView('main')}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-full text-gray-500"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white capitalize">
                    {view === 'main' ? 'Settings' : view}
                </h1>
            </div>

            {/* Content Swiper Area */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
                {view === 'main' && renderMain()}
                {view === 'account' && renderAccount()}
                {view === 'privacy' && renderPrivacy()}
            </div>
        </div>
    );
}
