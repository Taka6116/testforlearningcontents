// Firebase設定
// ここに自分のFirebase設定を貼り付けてください
const firebaseConfig = {
  apiKey: "AIzaSyAzSZQUvIOIzqGi198mzxB-qYjYGC9UNes",
  authDomain: "learning-app-ccfd7.firebaseapp.com",
  // Realtime DatabaseのURLは、プロジェクトIDから手動で構築されます
  databaseURL: "https://learning-app-ccfd7-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "learning-app-ccfd7",
  storageBucket: "learning-app-ccfd7.firebasestorage.app",
  messagingSenderId: "311519234667",
  appId: "1:311519234667:web:77456e7dd1df0639f4ff2e"
};

// Firebaseの初期化
firebase.initializeApp(firebaseConfig);

// データベース参照 (Realtime Databaseへの参照)
const database = firebase.database();

