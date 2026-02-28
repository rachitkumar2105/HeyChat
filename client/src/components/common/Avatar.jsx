import { getInitials, formatTime } from '../../utils/validators';

export default function Avatar({ user, size = 'md', showOnline = false, isOnline = false }) {
    const sizes = {
        sm: 'w-8 h-8 text-xs',
        md: 'w-10 h-10 text-sm',
        lg: 'w-12 h-12 text-base',
        xl: 'w-16 h-16 text-xl',
    };

    return (
        <div className="relative flex-shrink-0">
            {user?.profilePic ? (
                <img
                    src={user.profilePic}
                    alt={user.displayName}
                    className={`${sizes[size]} avatar`}
                />
            ) : (
                <div className={`${sizes[size]} avatar`}>
                    {getInitials(user?.displayName || user?.username || '?')}
                </div>
            )}
            {showOnline && (
                <span className={`online-dot ${isOnline ? 'bg-primary-500' : 'bg-gray-400'}`} />
            )}
        </div>
    );
}
