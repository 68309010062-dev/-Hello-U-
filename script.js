import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    GoogleAuthProvider, // 👈 เพิ่มสิ่งนี้
    signInWithPopup     // 👈 เพิ่มสิ่งนี้
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
const googleProvider = new GoogleAuthProvider(); // 👈 สร้างตัวแปรเรียกใช้งาน Google Provider

// ==========================================
// 1. ระบบตรวจสอบสถานะผู้ใช้ (สำหรับหน้า main.html)
// ==========================================
const mainContainer = document.getElementById('mainContainer');
const loadingScreen = document.getElementById('loadingScreen');
const userEmailText = document.getElementById('userEmail');

if (mainContainer) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            if(userEmailText) userEmailText.innerText = user.email;
            if(loadingScreen) loadingScreen.style.display = 'none';
            mainContainer.style.display = 'block';
        } else {
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
                email: email
            });

            alert("🎉 ลงทะเบียนสำเร็จ!");
            window.location.href = 'index.html';
        } catch (error) {
            alert("เกิดข้อผิดพลาดในการลงทะเบียน: " + error.message);
        }
    });
}

// ==========================================
// 4. ส่วนของการเข้าสู่ระบบ (หน้า index.html)
// ==========================================
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
            alert("🎉 เข้าสู่ระบบสำเร็จ!");
            loginForm.reset();
            window.location.href = 'main.html';
        } catch (error) {
            console.error(error);
            alert("❌ ไม่สามารถเข้าสู่ระบบได้! กรุณาตรวจสอบอีเมลและรหัสผ่านอีกครั้ง");
        }
    });
}

// ==========================================
// 5. ระบบเข้าสู่ระบบด้วย Google (Sign-in with Google)
// ==========================================
const googleLoginBtn = document.getElementById('googleLoginBtn');
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
        try {
            // เรียกเปิดหน้าต่างป็อปอัปของ Google เพื่อล็อกอิน
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;

            // บันทึกหรืออัปเดตข้อมูลผู้ใช้ลงในคอลเลกชัน users ให้ตรงสไตล์โครงสร้าง Firestore ของคุณ
            await setDoc(doc(db, "users", user.uid), {
                authProvider: "google.com",              // 👈 ระบุประเภท Provider ให้ชัดเจน
                displayName: user.displayName || "lol",   // ดึงชื่อโปรไฟล์จาก Google (หากไม่มีให้ระบุค่าเริ่มต้น)
                email: user.email                         // ดึงอีเมลจาก Google
                // หมายเหตุ: ละเว้น createdAt สำหรับผู้ใช้เก่าที่เคยเข้าสู่ระบบแล้ว เพื่อป้องกันการบันทึกเวลาสมัครทับซ้ำๆ
            }, { merge: true }); // ใช้ merge: true เพื่ออัปเดตข้อมูลฟิลด์โดยไม่ไปลบฟิลด์อื่นที่มีอยู่เดิม

            alert("🎉 เข้าสู่ระบบด้วย Google สำเร็จ!");
            window.location.href = 'main.html';
        } catch (error) {
            console.error(error);
            if (error.code !== 'auth/popup-closed-by-user') {
                alert("❌ ไม่สามารถลงทะเบียนหรือเข้าสู่ระบบด้วย Google ได้: " + error.message);
            }
        }
    });
}
