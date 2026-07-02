import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, addDoc, collection } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// คอนฟิก Firebase ของโปรเจกต์คุณ
const firebaseConfig = {
  apiKey: "AIzaSyBjiRLf-jk-8dDIKEenhvp6A1jiK0PzdFs",
  authDomain: "hello-u-a03aa.firebaseapp.com",
  projectId: "hello-u-a03aa",
  storageBucket: "hello-u-a03aa.firebasestorage.app",
  messagingSenderId: "1088551404863",
  appId: "1:1088551404863:web:c5ba3fe5daf590e862bf8a"
};

// เริ่มต้นโปรแกรม Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); 

// ==========================================
// 1. ระบบตรวจสอบสถานะผู้ใช้ (สำหรับหน้า main.html)
// ==========================================
const mainContainer = document.getElementById('mainContainer');
const loadingScreen = document.getElementById('loadingScreen');
const userEmailText = document.getElementById('userEmail');

if (mainContainer) {
    // ฟังก์ชันนี้จะทำงานอัตโนมัติเมื่อเปิดหน้า main.html เพื่อเช็คว่าล็อกอินค้างไว้ไหม
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // ถ้ามีผู้ใช้ล็อกอินอยู่จริง -> แสดงข้อมูลและหน้าหลัก
            if(userEmailText) userEmailText.innerText = user.email;
            if(loadingScreen) loadingScreen.style.display = 'none';
            mainContainer.style.display = 'block';
        } else {
            // ถ้าไม่ได้ล็อกอิน (หรือแอบพิมพ์ลิงก์เข้ามาเอง) -> ดีดกลับหน้าแรก
            alert("🔒 กรุณาเข้าสู่ระบบก่อนใช้งานหน้าหลัก");
            window.location.href = 'index.html';
        }
    });
}

// ==========================================
// 2. ระบบออกจากระบบ (Logout)
// ==========================================
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
            alert("🚪 ออกจากระบบเรียบร้อยแล้ว");
            window.location.href = 'index.html';
        } catch (error) {
            alert("เกิดข้อผิดพลาดในการออกจากระบบ: " + error.message);
        }
    });
}

// ==========================================
// 3. ส่วนของการลงทะเบียน (หน้า register.html)
// ==========================================
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const username = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;
        const passwordConfirm = document.getElementById('regPasswordConfirm').value;

        if (password !== passwordConfirm) { alert("❌ รหัสผ่านไม่ตรงกัน"); return; }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await setDoc(doc(db, "users", user.uid), {
                displayName: username,
                email: email,
                createdAt: new Date()
            });

            alert("🎉 ลงทะเบียนสำเร็จ!");
            window.location.href = 'index.html';
        } catch (error) {
            alert("เกิดข้อผิดพลาดในการลงทะเบียน: " + error.message);
        }
    });
}

// ==========================================
// 4. ส่วนของการเช็คอิน (หน้า index.html)
// ==========================================
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await addDoc(collection(db, "checkin_history"), {
                uid: user.uid,
                email: user.email,
                checkInAt: new Date()
            });

            const now = new Date();
            const timeString = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

            alert(`🎉 เช็คอินออนไลน์สำเร็จ!\nเวลาเช็คอิน: ${timeString} น.`);
            loginForm.reset();

            // 🚀 เมื่อเช็คอินผ่าน ให้พาวิ่งไปหน้าหลักทันที
            window.location.href = 'main.html';
        } catch (error) {
            console.error(error);
            alert("❌ ไม่สามารถเช็คอินได้! กรุณาตรวจสอบอีเมลและรหัสผ่านอีกครั้ง");
        }
    });
}
