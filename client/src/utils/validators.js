// Password validation rules
export const validatePassword = (password) => {
    const rules = [
        { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
        { id: 'upper', label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
        { id: 'lower', label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
        { id: 'number', label: 'One number', test: (p) => /[0-9]/.test(p) },
        { id: 'special', label: 'One special character (!@#$%...)', test: (p) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
    ];
    return rules.map((rule) => ({ ...rule, valid: rule.test(password) }));
};

export const isPasswordValid = (password) =>
    validatePassword(password).every((r) => r.valid);

// Email validation
export const isEmailValid = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Format timestamp
export const formatTime = (date) => {
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const formatDate = (date) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    const oneDay = 86400000;
    if (diff < oneDay && d.getDate() === now.getDate()) return 'Today';
    if (diff < 2 * oneDay) return 'Yesterday';
    return d.toLocaleDateString();
};

export const formatLastSeen = (date) => {
    if (!date) return 'Never';
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
};

// Get initials for avatar
export const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
};
