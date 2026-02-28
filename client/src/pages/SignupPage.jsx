import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageCircle, Eye, EyeOff, CheckCircle, XCircle, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { validatePassword, isEmailValid } from '../utils/validators';

export default function SignupPage() {
    const { signup } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ displayName: '', username: '', email: '', password: '' });
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const pwRules = validatePassword(form.password);
    const allValid = pwRules.every((r) => r.valid);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!isEmailValid(form.email)) { setError('Invalid email format'); return; }
        if (!allValid) { setError('Password does not meet all requirements'); return; }

        setLoading(true);
        try {
            await signup(form);
            setSuccess('Account created! Redirecting to login...');
            setTimeout(() => navigate('/login'), 1500);
        } catch (err) {
            setError(err.response?.data?.error || 'Signup failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-green-50 dark:from-dark-900 dark:via-dark-800 dark:to-dark-900 p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-500 rounded-2xl shadow-lg mb-4">
                        <MessageCircle className="w-9 h-9 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create Account</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Join HeyChat today</p>
                </div>

                <div className="card p-8">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Display Name</label>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="Your full name"
                                value={form.displayName}
                                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Username</label>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="Unique username (lowercase)"
                                value={form.username}
                                onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
                            <input
                                type="email"
                                className="input-field"
                                placeholder="you@example.com"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password</label>
                            <div className="relative">
                                <input
                                    type={showPw ? 'text' : 'password'}
                                    className="input-field pr-11"
                                    placeholder="Create a strong password"
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPw(!showPw)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>

                            {/* Live password validation */}
                            {form.password && (
                                <div className="mt-3 space-y-1.5 p-3 bg-gray-50 dark:bg-dark-700 rounded-xl">
                                    {pwRules.map((rule) => (
                                        <div key={rule.id} className="flex items-center gap-2 text-xs">
                                            {rule.valid ? (
                                                <CheckCircle className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
                                            ) : (
                                                <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                                            )}
                                            <span className={rule.valid ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'}>
                                                {rule.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-xl border border-red-100 dark:border-red-800">
                                {error}
                            </div>
                        )}
                        {success && (
                            <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm px-4 py-3 rounded-xl border border-green-100 dark:border-green-800">
                                {success}
                            </div>
                        )}

                        <button type="submit" disabled={loading || !allValid} className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <UserPlus className="w-4 h-4" />
                                    Create Account
                                </>
                            )}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        Already have an account?{' '}
                        <Link to="/login" className="text-primary-600 dark:text-primary-400 font-semibold hover:underline">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
