import { useState } from 'react';
import { X, Flag } from 'lucide-react';
import api from '../../utils/api';

const REASONS = [
    'Spam or scam',
    'Harassment or bullying',
    'Hate speech',
    'Inappropriate content',
    'Fake account',
    'Other',
];

export default function ReportModal({ reportedUser, messageId, onClose }) {
    const [reason, setReason] = useState('');
    const [custom, setCustom] = useState('');
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const finalReason = reason === 'Other' ? custom : reason;
        if (!finalReason) return;
        setLoading(true);
        try {
            await api.post('/report', {
                reportedUser: reportedUser?._id,
                messageId,
                reason: finalReason,
            });
            setDone(true);
            setTimeout(onClose, 1500);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="card w-full max-w-sm p-6 animate-slide-up">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Flag className="w-4 h-4 text-red-500" />
                        Report {reportedUser?.displayName}
                    </h3>
                    <button onClick={onClose} className="btn-ghost p-1 rounded-full">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {done ? (
                    <div className="text-center py-4 text-primary-600 dark:text-primary-400 font-medium">
                        ✓ Report submitted. Thank you!
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div className="space-y-2">
                            {REASONS.map((r) => (
                                <label key={r} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700">
                                    <input
                                        type="radio"
                                        name="reason"
                                        value={r}
                                        checked={reason === r}
                                        onChange={() => setReason(r)}
                                        className="accent-primary-500"
                                    />
                                    <span className="text-sm text-gray-700 dark:text-gray-300">{r}</span>
                                </label>
                            ))}
                        </div>
                        {reason === 'Other' && (
                            <textarea
                                className="input-field resize-none"
                                rows={2}
                                placeholder="Describe the issue..."
                                value={custom}
                                onChange={(e) => setCustom(e.target.value)}
                            />
                        )}
                        <button
                            type="submit"
                            disabled={!reason || loading}
                            className="btn-primary w-full"
                        >
                            {loading ? 'Submitting...' : 'Submit Report'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
