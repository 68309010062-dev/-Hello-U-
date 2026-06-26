// 1. นำเข้า Firebase และโมดูลที่จำเป็นทั้งหมดให้ครบ (เพิ่ม GoogleAuthProvider และ signInWithPopup)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    GoogleAuthProvider, 
    signInWithPopup 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, addDoc, collection } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// คอนฟิก Firebase ของคุณ
const firebaseConfig = {
  apiKey: "AIzaSyBjiRLf-jk-8dDIKEenhvp6A1jiK0PzdFs",
  authDomain: "hello-u-a03aa.firebaseapp.com",
  projectId: "hello-u-a03aa",
  storageBucket: "hello-u-a03aa.firebasestorage.app",
  messagingSenderId: "1088551404863",
  appId: "1:1088551404863:web:c5ba3fe5daf590e862bf8a"
};

// เริ่มต้น Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); 

// ** สำคัญมาก: สร้างตัวแปรสำหรับเชื่อมต่อกับ Google Auth **
const googleProvider = new GoogleAuthProvider();

// ==========================================
// 1. ส่วนของการลงทะเบียน (Register) ด้วย อีเมลจริง + รหัสผ่าน
// ==========================================
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const username = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim(); // ใช้ ID อีเมลจริงจากฟอร์มใหม่
        const password = document.getElementById('regPassword').value;
        const passwordConfirm = document.getElementById('regPasswordConfirm').value;

        if (password !== passwordConfirm) { alert("❌ รหัสผ่านไม่ตรงกัน"); return; }

        try {
            // สร้างบัญชีผู้ใช้
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // บันทึกข้อมูลลงฐานข้อมูล Firestore
            await setDoc(doc(db, "users", user.uid), {
                displayName: username,
                email: email,
                authProvider: "email/password",
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
// 2. ระบบลงทะเบียนด้วยบัญชี Google (หน้า register.html)
// ==========================================
const googleSignUpBtn = document.getElementById('googleSignUpBtn');
if (googleSignUpBtn) {
    googleSignUpBtn.addEventListener('click', async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;

            // บันทึกผู้ใช้รายใหม่จาก Google ลง Firestore
            await setDoc(doc(db, "users", user.uid), {
                displayName: user.displayName || "ผู้ใช้ Google",
                email: user.email,
                authProvider: "google",
                createdAt: new Date()
            });

            alert(`🎉 ลงทะเบียนและเชื่อมต่อ Google สำเร็จ!\nยินดีต้อนรับคุณ ${user.displayName}`);
            window.location.href = 'index.html';
        } catch (error) {
            console.error(error);
            alert("❌ ไม่สามารถลงทะเบียนด้วย Google ได้ หรือถูกยกเลิก");
        }
    });
}

// ==========================================
// 3. ระบบเช็คอินด้วย อีเมลจริง + รหัสผ่าน (หน้า index.html)
// ==========================================
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        // ตรวจสอบให้มั่นใจว่าหน้า HTML ใช้ ID 'loginEmail' (ไม่ใช่ loginName แบบเก่า)
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // บันทึกประวัติเช็คอิน
            await addDoc(collection(db, "checkin_history"), {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || "ผู้ใช้ทั่วไป",
                checkInAt: new Date(),
                authProvider: "email/password"
            });

            const now = new Date();
            const timeString = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

            alert(`🎉 เช็คอินออนไลน์สำเร็จ!\nยินดีต้อนรับคุณ ${user.displayName || email}\nเวลาเช็คอิน: ${timeString} น.`);
            loginForm.reset();
        } catch (error) {
            console.error(error);
            alert("❌ ไม่สามารถเช็คอินได้! กรุณาตรวจสอบอีเมลและรหัสผ่านอีกครั้ง");
        }
    });
}

// ==========================================
// 4. ระบบปุ่มเช็คอินผ่าน Google (หน้า index.html)
// ==========================================
const googleLoginBtn = document.getElementById('googleLoginBtn');
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
        try {
            // เปิดหน้าต่างล็อกอินของ Google Popup
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;

            // บันทึกประวัติการเช็คอินลงคอลเลกชัน checkin_history บน Firestore
            await addDoc(collection(db, "checkin_history"), {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || "ผู้ใช้ Google",
                checkInAt: new Date(),
                authProvider: "google"
            });

            const now = new Date();
            const timeString = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

            alert(`🎉 เช็คอินด้วย Google สำเร็จ!\nยินดีต้อนรับคุณ ${user.displayName}\nเวลาเช็คอิน: ${timeString} น.`);
        } catch (error) {
            console.error(error);
            alert("❌ การเช็คอินผ่าน Google ล้มเหลว หรือถูกยกเลิก");
        }
    });
}