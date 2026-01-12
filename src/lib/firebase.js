import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// TODO: Replace with your actual Firebase config
// Go to Firebase Console -> Project Settings -> General -> Your apps -> SDK setups
const firebaseConfig = {
  apiKey: "AIzaSyAjpIM8xK-0WVruoANBO98Uwtui9Y9p8TA",
  authDomain: "heychat-2af30.firebaseapp.com",
  projectId: "heychat-2af30",
  storageBucket: "heychat-2af30.firebasestorage.app",
  messagingSenderId: "456777904060",
  appId: "1:456777904060:web:855ac40b2fba4aa02085b9",
  measurementId: "G-Y04TLML2EQ"
};


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
