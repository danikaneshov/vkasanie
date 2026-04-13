import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = { 
    apiKey: "AIzaSyAk8sJuPI1N4EL1hD3CisVRoEs4nmudvP0", 
    authDomain: "damdymdb.firebaseapp.com", 
    projectId: "damdymdb", 
    storageBucket: "damdymdb.firebasestorage.app", 
    messagingSenderId: "43924470905", 
    appId: "1:43924470905:web:0310c5298da38d7f56a8a8" 
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
