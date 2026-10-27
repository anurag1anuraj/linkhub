// LinkHub Firebase setup. Replace these values only if you use a different Firebase web app.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyB3WvgnibJ-gZOmTvw8XMBEDrg14naKsOs",
  authDomain: "blog-54a4a.firebaseapp.com",
  projectId: "blog-54a4a",
  storageBucket: "blog-54a4a.firebasestorage.app",
  messagingSenderId: "291306080900",
  appId: "1:291306080900:web:506341a607004fc93690d1",
  measurementId: "G-TGW733YDLL"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Analytics is optional and is only initialized where supported (for example, not in all local environments).
isSupported().then((supported) => {
  if (supported) getAnalytics(app);
}).catch(() => {});
