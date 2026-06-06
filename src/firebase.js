import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyADoDHS9RR-x7Bx_lgWKi8jFGl__W0OGbc",
  authDomain: "to-do-list-df9cb.firebaseapp.com",
  databaseURL: "https://to-do-list-df9cb-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "to-do-list-df9cb",
  storageBucket: "to-do-list-df9cb.firebasestorage.app",
  messagingSenderId: "230771165648",
  appId: "1:230771165648:web:e1b50da1b9d46f9c3091d5"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
