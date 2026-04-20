/* =========================================
   GI28 PANEL - FIREBASE CONFIG & INIT
   ========================================= */
// Import Firebase SDKs (Latest Modular version)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, updateDoc, query, where, orderBy, deleteDoc, limit, onSnapshot, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Teri exact Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyC2t1TDj9OGoqnZVQfhoP_PCI0xhgf8ePE",
    authDomain: "gi28-smm-panel.firebaseapp.com",
    projectId: "gi28-smm-panel",
    storageBucket: "gi28-smm-panel.firebasestorage.app",
    messagingSenderId: "431905380300",
    appId: "1:431905380300:web:06268d037c504d2046ef69"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Export everything so other files can use it easily
export { 
    auth, 
    db, 
    googleProvider, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signInWithPopup, 
    doc, 
    setDoc,
    getDoc,
    collection,
    getDocs,
    updateDoc,
    query,
    where,
    orderBy,
    deleteDoc,
    limit,
    onSnapshot,
    addDoc
};
