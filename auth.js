// auth.js
import { auth, db, googleProvider } from "./firebase-config.js";
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

console.log("🚀 ระบบ Auth Module เวอร์ชันง่าย ปลอดภัย (ไม่ต้องใส่บัตร) เริ่มทำงาน");

// 1. ระบบเข้าสู่ระบบปกติ (Email/Password)
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
            loginForm.reset();
            window.location.href = 'main.html'; // ย้ายหน้าไปหน้าหลักทันที
        } catch (error) {
            console.error("Login Error:", error);
            alert("❌ ไม่สามารถเข้าสู่ระบบได้! กรุณาตรวจสอบอีเมลและรหัสผ่านอีกครั้ง");
        }
    });
}

// 2. ระบบลงทะเบียนปกติ
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

            // บันทึกข้อมูลตั้งต้นลง Firestore
            await setDoc(doc(db, "users", user.uid), {
                authProvider: "email/password",
                displayName: username,
                email: email
            });

            window.location.href = 'index.html';
        } catch (error) {
            console.error("Register Error:", error);
            alert("เกิดข้อผิดพลาดในการลงทะเบียน: " + error.message);
        }
    });
}

// 3. ระบบเข้าสู่ระบบด้วย Google (ดึงแค่โปรไฟล์เพื่อเข้าหน้าเว็บ ไม่ยุ่งเกี่ยวกับกูเกิลไดรฟ์)
const googleLoginBtn = document.getElementById('googleLoginBtn');
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
        try {
            // เรียกหน้าต่างล็อกอิน Google ของ Firebase (ฟรี ไม่มีค่าใช้จ่าย)
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;

            // บันทึกข้อมูลลงฐานข้อมูล Firebase เพื่อระบุตัวตน
            await setDoc(doc(db, "users", user.uid), {
                authProvider: "google.com",
                displayName: user.displayName || "Google User",
                email: user.email
            }, { merge: true });

            console.log("ล็อกอินด้วย Google และบันทึกข้อมูลผู้ใช้สำเร็จ");
            window.location.href = 'main.html'; // ผ่านฉลุยไปหน้าหลัก
        } catch (error) {
            console.error("Google Auth Error:", error);
            if (error.code !== 'auth/popup-closed-by-user') {
                alert("❌ เกิดข้อผิดพลาดในการล็อกอินด้วย Google: " + error.message);
            }
        }
    });
}
