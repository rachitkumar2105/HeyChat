import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAjpIM8xK-0WVruoANBO98Uwtui9Y9p8TA",
    authDomain: "heychat-2af30.firebaseapp.com",
    projectId: "heychat-2af30",
    storageBucket: "heychat-2af30.firebasestorage.app",
    messagingSenderId: "456777904060",
    appId: "1:456777904060:web:855ac40b2fba4aa02085b9",
    measurementId: "G-Y04TLML2EQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Export services for the app to use
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

console.log("🔥 Firebase initialized:", app.name);
export { app, analytics };
