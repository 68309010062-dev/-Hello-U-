// auth.js
import { auth, db, googleProvider } from "./firebase-config.js";
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// เพิ่ม Log เพื่อเช็คความเรียบร้อยใน Console
console.log("🚀ระบบ Auth Module พร้อมทำงานร่วมกับ style.css");

// 1. ระบบเข้าสู่ระบบปกติ (หน้า index.html)
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
            console.error("Login Error:", error);
            alert("❌ ไม่สามารถเข้าสู่ระบบได้! กรุณาตรวจสอบอีเมลและรหัสผ่านอีกครั้ง");
        }
    });
}

// 2. ระบบลงทะเบียนปกติ (หน้า register.html)
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
                authProvider: "email/password",
                displayName: username,
                email: email
            });

            alert("🎉 ลงทะเบียนสำเร็จ!");
            window.location.href = 'index.html';
        } catch (error) {
            console.error("Register Error:", error);
            alert("เกิดข้อผิดพลาดในการลงทะเบียน: " + error.message);
        }
    });
}

// 3. ระบบเข้าสู่ระบบด้วย Google
const googleLoginBtn = document.getElementById('googleLoginBtn');
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;

            await setDoc(doc(db, "users", user.uid), {
                authProvider: "google.com",
                displayName: user.displayName || "Google User",
                email: user.email
            }, { merge: true });

            alert("🎉 เข้าสู่ระบบด้วย Google สำเร็จ!");
            window.location.href = 'main.html';
        } catch (error) {
            console.error("Google Auth Error:", error);
            if (error.code !== 'auth/popup-closed-by-user') {
                alert("❌ ไม่สามารถเข้าสู่ระบบด้วย Google ได้: " + error.message);
            }
        }
    });
}
