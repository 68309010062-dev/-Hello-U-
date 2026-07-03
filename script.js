import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    GoogleAuthProvider,
    signInWithPopup
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
const googleProvider = new GoogleAuthProvider();

// ==========================================
// 1. ระบบตรวจสอบสถานะผู้ใช้ และควบคุม UI หน้าหลัก (main.html)
// ==========================================
const mainContainer = document.getElementById('mainContainer');
const loadingScreen = document.getElementById('loadingScreen');
const userEmailText = document.getElementById('userEmail'); 
const headerUserName = document.getElementById('headerUserName'); 

// ตัวแปรควบคุม UI การเพิ่มผลงาน
const addActionZone = document.getElementById('addActionZone');
const uploadOptionsBox = document.getElementById('uploadOptionsBox');
const addPortfolioBtn = document.getElementById('addPortfolioBtn');
const floatingAddBtn = document.getElementById('floatingAddBtn');
const optionItems = document.querySelectorAll('.option-item');

if (mainContainer) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // แสดงข้อมูลผู้ใช้บนแถบแสดงผลด้านบน
            if(headerUserName) headerUserName.innerText = user.displayName || user.email;
            if(userEmailText) userEmailText.innerText = user.email;
            
            if(loadingScreen) loadingScreen.style.display = 'none';
            mainContainer.style.display = 'block';
        } else {
            alert("🔒 กรุณาเข้าสู่ระบบก่อนใช้งานหน้าหลัก");
            window.location.href = 'index.html';
        }
    });

    // ฟังก์ชันเปิดกล่อง "เพิ่มผลงานเป็น" (ตอนกดปุ่มบวก)
    const openUploadOptions = () => {
        if (uploadOptionsBox) {
            uploadOptionsBox.style.display = 'block';
        }
    };

    // ผูกเหตุการณ์ปุ่มบวกทั้ง 2 จุด ให้เปิดกล่องตัวเลือก
    if (addPortfolioBtn) addPortfolioBtn.addEventListener('click', openUploadOptions);
    if (floatingAddBtn) floatingAddBtn.addEventListener('click', openUploadOptions);

    // เมื่อคลิกเลือกประเภทการเพิ่มผลงาน (ไฟล์ / ลิงก์ / กูเกิลไดรฟ์)
    optionItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const selectedType = item.getAttribute('data-type');
            
            alert(`คุณเลือกเพิ่มผลงานในรูปแบบ: ${selectedType}`);
            
            // ✨ เงื่อนไข: เมื่อเลือกประเภทเสร็จสิ้น ปิดกล่องตัวเลือก และซ่อนปุ่มเพิ่มผลงานทั้งหมดออกไปทันที
            if (uploadOptionsBox) uploadOptionsBox.style.display = 'none';
            if (addActionZone) addActionZone.style.display = 'none'; 
            if (floatingAddBtn) floatingAddBtn.style.display = 'none';
        });
    });
}

// ==========================================
// 2. ระบบไปหน้าตั้งค่า (Settings) & รองรับระบบออกจากระบบ (Logout)
// ==========================================
// ⚙️ ปุ่มฟันเฟืองเมื่อกดแล้วจะพาวิ่งไปที่หน้าตั้งค่า settings.html ทันทีตามต้องการ
const settingsBtn = document.getElementById('settingsBtn');
if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
        window.location.href = 'settings.html';
    });
}

// 🚪 ฟังก์ชันออกจากระบบสแตนด์บายรอไว้ (สำหรับปุ่มที่มี id="logoutBtn" ภายในหน้า settings.html)
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
// 3. ส่วนของการลงทะเบียนปกติ (หน้า register.html)
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
                authProvider: "email/password",
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
// 4. ส่วนของการเข้าสู่ระบบปกติ (หน้า index.html)
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
            console.error(error);
            if (error.code !== 'auth/popup-closed-by-user') {
                alert("❌ ไม่สามารถลงทะเบียนหรือเข้าสู่ระบบด้วย Google ได้: " + error.message);
            }
        }
    });
}
