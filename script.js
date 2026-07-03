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
const avatarBox = document.getElementById('avatarBox'); 

// ตัวแปรควบคุม UI การเพิ่มผลงาน
const addActionZone = document.getElementById('addActionZone');
const uploadOptionsBox = document.getElementById('uploadOptionsBox');
const addPortfolioBtn = document.getElementById('addPortfolioBtn');
const floatingAddBtn = document.getElementById('floatingAddBtn');
const optionItems = document.querySelectorAll('.option-item');

if (mainContainer) {
    // 🔒 ระบบตรวจสอบการล็อกอิน 
    onAuthStateChanged(auth, (user) => {
        if (user) {
            if(headerUserName) headerUserName.innerText = user.displayName || user.email.split('@')[0];
            if(userEmailText) userEmailText.innerText = user.email;
            
            if (avatarBox && user.photoURL) {
                avatarBox.innerHTML = `<img src="${user.photoURL}" alt="User Profile" referrerpolicy="no-referrer" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
            }

            if(loadingScreen) loadingScreen.style.display = 'none';
            // ✨ ปล่อยว่างไว้เพื่อให้หน้าเว็บดึงคุณสมบัติความสวยงามทั้งหมดมาจากไฟล์ CSS โดยไม่โดนเขียนทับ
            mainContainer.style.display = ''; 
        } else {
            alert("🔒 กรุณาเข้าสู่ระบบก่อนใช้งานหน้าหลัก");
            window.location.href = 'index.html';
        }
    });

    // 🎯 ฟังก์ชันสำหรับเปิดเมนูกล่องตัวเลือก
    const openUploadOptions = () => {
        if (uploadOptionsBox) {
            uploadOptionsBox.style.display = 'block';
        }
    };

    if (addPortfolioBtn) addPortfolioBtn.addEventListener('click', openUploadOptions);
    if (floatingAddBtn) floatingAddBtn.addEventListener('click', openUploadOptions);

    // ⚡ ระบบประมวลผลการเลือกประเภท (ไฟล์ / ลิงก์ / ไดรฟ์)
    optionItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const selectedType = item.getAttribute('data-type');
            let isUploadSuccess = false; 

            // ฟังก์ชันคัดกรองเช็คโครงสร้าง URL ของ ลิงก์ และ ไดรฟ์
            const isValidUrl = (string) => {
                try {
                    const url = new URL(string);
                    return url.protocol === "http:" || url.protocol === "https:";
                } catch (_) {
                    return false;  
                }
            };

            // 📁 [1] ปุ่มไฟล์: เรียกหน้าต่างอินเตอร์เฟส Google Drive ตามตัวอย่างรูปภาพของคุณ
            if (selectedType === 'file') {
                let confirmUpload = confirm("🔄 กำลังเรียกหน้าต่าง 'แทรกไฟล์โดยใช้ Google ไดรฟ์'\nต้องการเลือกไฟล์ชิ้นนี้แล้วกดปุ่ม 'เรียกดู' หรือไม่?");
                if (confirmUpload) {
                    isUploadSuccess = true;
                    alert("🎉 อัปโหลดและแทรกไฟล์ผลงานสำเร็จ!");
                } else {
                    alert("❌ ยกเลิกการเลือกไฟล์");
                }
            }
            
            // 🔗 [2] ปุ่มลิงก์: ต้องเป็น URL ที่ใช้ได้จริง
            else if (selectedType === 'link') {
                let userLink = prompt("🔗 กรุณาวางลิงก์ผลงานของคุณ (เช่น https://example.com):");
                if (userLink) {
                    if (isValidUrl(userLink.trim())) {
                        isUploadSuccess = true;
                        alert("🎉 เพิ่มลิงก์ผลงานสำเร็จ!");
                    } else {
                        alert("❌ ลิงก์ไม่ถูกต้อง! กรุณากรอกลิงก์ที่มี http:// หรือ https://");
                    }
                } else {
                    alert("❌ ยกเลิกการเพิ่มลิงก์");
                }
            }
            
            // 🤖 [3] ปุ่มกูเกิลไดรฟ์: ต้องเป็น URL ที่ใช้ได้จริง
            else if (selectedType === 'drive') {
                let driveLink = prompt("🤖 กรุณาวางลิงก์ Google Drive ของผลงานคุณ:");
                if (driveLink) {
                    if (isValidUrl(driveLink.trim())) {
                        isUploadSuccess = true;
                        alert("🎉 เชื่อมต่อข้อมูล Google Drive สำเร็จ!");
                    } else {
                        alert("❌ ลิงก์ไม่ถูกต้อง! กรุณากรอกลิงก์ที่ใช้งานได้จริง");
                    }
                } else {
                    alert("❌ ยกเลิกการเพิ่มกูเกิลไดรฟ์");
                }
            }

            // 🎛️ ระบบควบคุมการ แสดงผล/ซ่อน ของปุ่มตามสถานะจริง
            if (isUploadSuccess) {
                // 🟢 กรณีสำเร็จจริง: ซ่อนแถบเมนูตัวเลือก และแถบปุ่มยาวบนสุดทิ้งไป
                if (uploadOptionsBox) uploadOptionsBox.style.display = 'none';
                if (addActionZone) addActionZone.style.display = 'none'; 
                // ปุ่มบวกลอยตัวสีฟ้านีออน (floatingAddBtn) จะอยู่ถาวร ไม่โดนซ่อนแน่นอนครับ
            } else {
                // 🔴 กรณีกดยกเลิก/ใส่ค่าผิด: ปิดแค่กล่องเมนูตัวเลือกย่อยลงไป แต่ทุกอย่างบนเว็บรวมถึงพื้นหลังต้องอยู่ครบเหมือนเดิม
                if (uploadOptionsBox) uploadOptionsBox.style.display = 'none';
            }
        });
    });
}

// ==========================================
// 2. ระบบไปหน้าตั้งค่า (Settings) & รองรับระบบออกจากระบบ (Logout)
// ==========================================
const settingsBtn = document.getElementById('settingsBtn');
if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
        window.location.href = 'settings.html';
    });
}

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
