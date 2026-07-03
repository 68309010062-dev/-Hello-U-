// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBjiRLf-jk-8dDIKEenhvp6A1jiK0PzdFs",
  authDomain: "hello-u-a03aa.firebaseapp.com",
  projectId: "hello-u-a03aa",
  storageBucket: "hello-u-a03aa.firebasestorage.app",
  messagingSenderId: "1088551404863",
  appId: "1:1088551404863:web:c5ba3fe5daf590e862bf8a"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app); 
export const googleProvider = new GoogleAuthProvider();
