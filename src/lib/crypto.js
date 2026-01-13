
// Web Crypto API helpers for End-to-End Encryption

const DB_NAME = 'heychat-keys';
const STORE_NAME = 'key-pairs';
const DB_VERSION = 1;

/**
 * Open (or create) the IndexedDB for storing keys.
 */
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => reject('IndexedDB error: ' + event.target.error);

        request.onsuccess = (event) => resolve(event.target.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'uid' });
            }
        };
    });
}

/**
 * Generate a new RSA-OAEP Key Pair.
 */
export async function generateKeyPair() {
    try {
        const keyPair = await window.crypto.subtle.generateKey(
            {
                name: "RSA-OAEP",
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: "SHA-256",
            },
            true, // extractable
            ["encrypt", "decrypt"]
        );
        return keyPair;
    } catch (error) {
        console.error("Error generating keys:", error);
        throw error;
    }
}

/**
 * Store the key pair in IndexedDB.
 */
export async function storeKeyPair(uid, keyPair) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put({ uid, publicKey: keyPair.publicKey, privateKey: keyPair.privateKey });

        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

/**
 * Retrieve the key pair from IndexedDB.
 */
export async function getKeyPair(uid) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(uid);

        request.onsuccess = () => {
            resolve(request.result ? {
                publicKey: request.result.publicKey,
                privateKey: request.result.privateKey
            } : null);
        };
        request.onerror = (e) => reject(e.target.error);
    });
}

/**
 * Export Public Key to JWK format (for Firestore).
 */
export async function exportPublicKey(key) {
    const exported = await window.crypto.subtle.exportKey("jwk", key);
    return JSON.stringify(exported);
}

/**
 * Import Public Key from JWK string (from Firestore).
 */
export async function importPublicKey(jwkString) {
    try {
        const jwk = JSON.parse(jwkString);
        return await window.crypto.subtle.importKey(
            "jwk",
            jwk,
            {
                name: "RSA-OAEP",
                hash: "SHA-256",
            },
            true,
            ["encrypt"]
        );
    } catch (e) {
        console.error("Failed to import public key", e);
        return null;
    }
}

/**
 * Generate a random AES-GCM key for session encryption.
 */
async function generateSessionKey() {
    return await window.crypto.subtle.generateKey(
        {
            name: "AES-GCM",
            length: 256,
        },
        true,
        ["encrypt", "decrypt"]
    );
}

/**
 * Encrypt a message for multiple recipients (e.g. sender and receiver).
 * Returns payload with encrypted content and encrypted session keys.
 */
export async function encryptMessage(text, recipientPublicKeys) {
    // 1. Generate AES Session Key
    const sessionKey = await generateSessionKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // 2. Encrypt the actual message text with AES
    const encoder = new TextEncoder();
    const encodedText = encoder.encode(text);

    const encryptedContent = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv,
        },
        sessionKey,
        encodedText
    );

    // 3. Encrypt the Session Key for each recipient using their Public Key
    const exportedSessionKey = await window.crypto.subtle.exportKey("raw", sessionKey);

    const encryptedKeys = {};
    for (const [uid, pubKey] of Object.entries(recipientPublicKeys)) {
        if (pubKey) {
            const encryptedKey = await window.crypto.subtle.encrypt(
                { name: "RSA-OAEP" },
                pubKey,
                exportedSessionKey
            );
            // Convert buffers to storage-friendly strings
            encryptedKeys[uid] = arrayBufferToBase64(encryptedKey);
        }
    }

    return {
        text: arrayBufferToBase64(encryptedContent), // The encrypted message
        iv: arrayBufferToBase64(iv),
        keys: encryptedKeys // Map of uid -> encryptedSessionKey
    };
}

/**
 * Decrypt a message using the user's Private Key.
 */
export async function decryptMessage(messageData, privateKey, uid) {
    if (!messageData.keys || !messageData.keys[uid]) {
        throw new Error("No session key found for this user");
    }

    try {
        // 1. Decrypt the Session Key using Private Key
        const encryptedSessionKey = base64ToArrayBuffer(messageData.keys[uid]);
        const sessionKeyRaw = await window.crypto.subtle.decrypt(
            { name: "RSA-OAEP" },
            privateKey,
            encryptedSessionKey
        );

        // 2. Import the Session Key
        const sessionKey = await window.crypto.subtle.importKey(
            "raw",
            sessionKeyRaw,
            { name: "AES-GCM" },
            false,
            ["decrypt"]
        );

        // 3. Decrypt the content
        const iv = base64ToArrayBuffer(messageData.iv);
        const encryptedContent = base64ToArrayBuffer(messageData.text);

        const decryptedContent = await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv,
            },
            sessionKey,
            encryptedContent
        );

        const decoder = new TextDecoder();
        return decoder.decode(decryptedContent);
    } catch (e) {
        console.error("Decryption failed:", e);
        return "⚠️ Decryption Error: " + e.message;
    }
}



/**
 * Encrypt a File/Blob using a new random AES key.
 * Returns { encryptedBlob, sessionKey, iv }
 */
export async function encryptFile(file) {
    const sessionKey = await generateSessionKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const fileBuffer = await file.arrayBuffer();

    const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        sessionKey,
        fileBuffer
    );

    // Export key to be encrypted later with RSA
    const exportedSessionKey = await window.crypto.subtle.exportKey("raw", sessionKey);

    return {
        encryptedBlob: new Blob([encryptedBuffer]),
        sessionKey: exportedSessionKey, // Raw buffer
        iv: iv // Raw buffer
    };
}

/**
 * Decrypt a File/Blob using a provided session key.
 */
export async function decryptFile(encryptedBlob, sessionKeyRaw, ivRaw) {
    const sessionKey = await window.crypto.subtle.importKey(
        "raw",
        sessionKeyRaw,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
    );

    const encryptedBuffer = await encryptedBlob.arrayBuffer();

    const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: ivRaw },
        sessionKey,
        encryptedBuffer
    );

    return new Blob([decryptedBuffer]);
}

// --- Helpers ---

export function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

export function base64ToArrayBuffer(base64) {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}
