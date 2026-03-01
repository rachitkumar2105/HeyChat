import { useState, useEffect } from 'react';
import {
    Users, MessageSquare, AlertTriangle, Shield, Trash2,
    Ban, CheckCircle, LogOut, BarChart2, Flag, RefreshCw, Sun, Moon
} from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { formatLastSeen } from '../utils/validators';

function StatCard({ icon: Icon, label, value, color }) {
    return (
        <div className="card p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
                <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{value ?? '—'}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
            </div>
        </div>
    );
}

export default function AdminPage() {
    const { logout } = useAuth();
    const { dark, toggle } = useTheme();
    const [tab, setTab] = useState('users');
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(false);

    const loadStats = async () => {
        try {
            const res = await api.get('/admin/stats');
            setStats(res.data);
        } catch (err) { console.error(err); }
    };

    const loadUsers = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/users');
            setUsers(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const loadReports = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/reports');
            setReports(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        loadStats();
        loadUsers();
        loadReports();
    }, []);

    const handleBan = async (id) => {
        try {
            const res = await api.post(`/admin/ban/${id}`);
            setUsers((prev) => prev.map((u) => u._id === id ? { ...u, isBanned: res.data.isBanned } : u));
        } catch (err) { console.error(err); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Permanently delete this user?')) return;
        try {
            await api.delete(`/admin/user/${id}`);
            setUsers((prev) => prev.filter((u) => u._id !== id));
            loadStats();
        } catch (err) { console.error(err); }
    };

    const handleDeleteMessage = async (msgId, reportId) => {
        try {
            await api.delete(`/admin/message/${msgId}`);
            await api.patch(`/admin/report/${reportId}`, { status: 'reviewed' });
            loadReports();
        } catch (err) { console.error(err); }
    };

    const handleDismissReport = async (reportId) => {
        try {
            await api.patch(`/admin/report/${reportId}`, { status: 'dismissed' });
            loadReports();
        } catch (err) { console.error(err); }
    };

    const tabs = [
        { id: 'users', label: 'Users', icon: Users },
        { id: 'reports', label: 'Reports', icon: Flag },
    ];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-dark-900">
            {/* Top bar */}
            <div className="bg-amber-500 text-white px-6 py-4 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3">
                    <Shield className="w-6 h-6" />
                    <div>
                        <h1 className="font-bold text-lg">HeyChat Admin</h1>
                        <p className="text-amber-100 text-xs">Administration Dashboard</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={toggle} className="p-2 rounded-full hover:bg-amber-600 transition-colors">
                        {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>
                    <button onClick={logout} className="flex items-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors text-sm font-medium">
                        <LogOut className="w-4 h-4" />
                        Logout
                    </button>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard icon={Users} label="Total Users" value={stats?.totalUsers} color="bg-blue-500" />
                    <StatCard icon={CheckCircle} label="Active Now" value={stats?.activeUsers} color="bg-primary-500" />
                    <StatCard icon={MessageSquare} label="Total Messages" value={stats?.totalMessages} color="bg-purple-500" />
                    <StatCard icon={AlertTriangle} label="Reports" value={stats?.totalReports} color="bg-red-500" />
                </div>

                {/* Tabs */}
                <div className="flex gap-2">
                    {tabs.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === t.id
                                ? 'bg-amber-500 text-white shadow-sm'
                                : 'bg-white dark:bg-dark-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 border border-gray-100 dark:border-dark-700'
                                }`}
                        >
                            <t.icon className="w-4 h-4" />
                            {t.label}
                            {t.id === 'reports' && reports.filter((r) => r.status === 'pending').length > 0 && (
                                <span className="bg-red-500 text-white text-xs px-1.5 rounded-full">
                                    {reports.filter((r) => r.status === 'pending').length}
                                </span>
                            )}
                        </button>
                    ))}
                    <button
                        onClick={() => { loadStats(); loadUsers(); loadReports(); }}
                        className="ml-auto btn-ghost flex items-center gap-2 text-sm px-3 py-2 border border-gray-100 dark:border-dark-700 rounded-xl"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                </div>

                {/* Users Tab */}
                {tab === 'users' && (
                    <div className="card overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 dark:border-dark-700">
                            <h2 className="font-semibold text-gray-900 dark:text-white">User Management</h2>
                            <p className="text-xs text-gray-400 mt-0.5">{users.length} total users</p>
                        </div>
                        {loading ? (
                            <div className="flex justify-center py-12">
                                <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 dark:bg-dark-700">
                                            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                                            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Account</th>
                                            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">Logins</th>
                                            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Activity</th>
                                            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-dark-700">
                                        {users.map((u) => (
                                            <tr key={u._id} className="hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors">
                                                <td className="px-5 py-3">
                                                    <div>
                                                        <p className="font-medium text-gray-900 dark:text-white">{u.displayName}</p>
                                                        <p className="text-xs text-gray-400">@{u.username}</p>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs truncate max-w-[150px]">{u.email}</span>
                                                        <span className={`text-[10px] w-fit font-bold uppercase ${u.isVerified ? 'text-green-500' : 'text-amber-500'}`}>
                                                            {u.isVerified ? '● Verified' : '○ Unverified'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3 text-gray-500 dark:text-gray-400 hidden lg:table-cell font-mono text-xs">
                                                    {u.loginCount || 0}
                                                </td>
                                                <td className="px-5 py-3 text-gray-400 text-xs hidden sm:table-cell">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span>Active: {formatLastSeen(u.lastActive)}</span>
                                                        <span>Login: {u.lastLogin ? formatLastSeen(u.lastLogin) : 'Never'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-tight ${u.isBanned
                                                        ? 'bg-red-500 text-white'
                                                        : 'bg-primary-500 text-white'
                                                        }`}>
                                                        {u.isBanned ? 'Banned' : 'Active'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleBan(u._id)}
                                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${u.isBanned
                                                                ? 'bg-green-100 dark:bg-green-900/20 text-green-600 hover:bg-green-200'
                                                                : 'bg-amber-100 dark:bg-amber-900/20 text-amber-600 hover:bg-amber-200'
                                                                }`}
                                                        >
                                                            <Ban className="w-3.5 h-3.5" />
                                                            {u.isBanned ? 'Unban' : 'Ban'}
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(u._id)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-100 dark:bg-red-900/20 text-red-600 hover:bg-red-200 transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                            Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {users.length === 0 && (
                                    <p className="text-center text-gray-400 py-8">No users found</p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Reports Tab */}
                {tab === 'reports' && (
                    <div className="card overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 dark:border-dark-700">
                            <h2 className="font-semibold text-gray-900 dark:text-white">Reports</h2>
                            <p className="text-xs text-gray-400 mt-0.5">{reports.filter((r) => r.status === 'pending').length} pending</p>
                        </div>
                        {loading ? (
                            <div className="flex justify-center py-12">
                                <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : reports.length === 0 ? (
                            <p className="text-center text-gray-400 py-8">No reports</p>
                        ) : (
                            <div className="divide-y divide-gray-50 dark:divide-dark-700">
                                {reports.map((r) => (
                                    <div key={r._id} className="px-5 py-4 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.status === 'pending' ? 'bg-amber-100 text-amber-600' :
                                                        r.status === 'reviewed' ? 'bg-green-100 text-green-600' :
                                                            'bg-gray-100 text-gray-500'
                                                        }`}>
                                                        {r.status}
                                                    </span>
                                                    <span className="text-xs text-gray-400">
                                                        by <strong>{r.reportedBy?.username}</strong>
                                                    </span>
                                                    {r.reportedUser && (
                                                        <span className="text-xs text-gray-400">
                                                            against <strong>{r.reportedUser?.username}</strong>
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{r.reason}</p>
                                                {r.messageId && (
                                                    <p className="text-xs text-gray-400 mt-1 bg-gray-50 dark:bg-dark-700 px-2 py-1 rounded">
                                                        Message: "{r.messageId?.content?.slice(0, 80)}"
                                                    </p>
                                                )}
                                            </div>
                                            {r.status === 'pending' && (
                                                <div className="flex gap-2 flex-shrink-0">
                                                    {r.messageId && (
                                                        <button
                                                            onClick={() => handleDeleteMessage(r.messageId._id, r._id)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-100 dark:bg-red-900/20 text-red-600 hover:bg-red-200 transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                            Remove Msg
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDismissReport(r._id)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-dark-600 text-gray-600 hover:bg-gray-200 transition-colors"
                                                    >
                                                        Dismiss
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
