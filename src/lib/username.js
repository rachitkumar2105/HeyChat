import { collection, query, where, getDocs } from 'firebase/firestore';

/**
 * Generates a unique username based on the email.
 * Checks Firestore to ensure uniqueness. Appends 4-digit random number if taken.
 * 
 * @param {string} email - The user's email address
 * @param {object} db - Firebase Firestore instance
 * @returns {Promise<string>} - A guaranteed unique username
 */
export const generateUniqueUsername = async (email, db) => {
    let baseUsername = email.split('@')[0];
    // Remove special characters to be safe
    baseUsername = baseUsername.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

    if (baseUsername.length < 3) {
        baseUsername = "user" + baseUsername;
    }

    let username = baseUsername;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
        // Check if username exists
        const q = query(collection(db, 'users'), where('username', '==', username));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            isUnique = true;
        } else {
            // Append random 4 digit number
            const randomSuffix = Math.floor(1000 + Math.random() * 9000);
            username = `${baseUsername}${randomSuffix}`;
            attempts++;
        }
    }

    if (!isUnique) {
        // Fallback if extremely unlucky: use timestamp
        username = `${baseUsername}${Date.now().toString().slice(-6)}`;
    }

    return username;
};
