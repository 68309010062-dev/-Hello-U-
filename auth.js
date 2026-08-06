import { auth, db, googleProvider } from "./firebase-config.js";
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    signInWithPopup,
    deleteUser
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    doc, 
    setDoc, 
    getDoc, 
    deleteDoc, 
    collection, 
    query, 
    where, 
    getDocs,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

console.log("🚀 ระบบยืนยันตัวตน (Auth Module) เริ่มทำงาน");

// 🔑 รหัสผ่านลับสำหรับอนุมัติสมัครแอดมิน
const ADMIN_SECRET_CODE = "ADMIN1234"; 
const MAX_ATTEMPTS = 3; 

// -------------------------------------------------------------
// 0. ฟังก์ชันช่วยเหลือและแปลภาษา (Helper & Translation Functions)
// -------------------------------------------------------------

/**
 * 💡 ฟังก์ชันแปลงสถานะเป็นภาษาไทยสำหรับนำไปแสดงบนหน้า UI
 * @param {string} status - สถานะที่ดึงมาจาก Firestore
 * @returns {string} - สถานะภาษาไทยพร้อมไอคอน
 */
export function translateStatus(status) {
    if (!status) return 'ไม่ระบุ';
    const s = status.toLowerCase();
    
    switch (s) {
        case 'รอการอนุมัติ':
            return '⏳ รอการอนุมัติ';
        case 'approved':
        case 'อนุมัติแล้ว':
        case 'อนุมัติ':
            return '✅ อนุมัติแล้ว';
        case 'rejected':
        case 'ไม่อนุมัติ':
        case 'ปฏิเสธ':
            return '❌ ปฏิเสธการเข้าใช้งาน';
        default:
            return status;
    }
}

/**
 * 💡 ฟังก์ชันแปลงบทบาท (Role) เป็นภาษาไทยสำหรับแสดงผล
 */
export function translateRole(role) {
    if (!role) return 'ไม่ระบุ';
    const r = role.toLowerCase();
    
    switch (r) {
        case 'super_admin':
            return '👑 ผู้ดูแลระบบหลัก';
        case 'admin':
            return '🛡️ ผู้ดูแลระบบ';
        case 'user':
            return '👤 ผู้ใช้งานทั่วไป';
        default:
            return role;
    }
}

async function isEmailBlocked(email) {
    if (!email) return false;
    try {
        const blockRef = doc(db, "blocked_users", email.toLowerCase());
        const blockSnap = await getDoc(blockRef);
        return blockSnap.exists();
    } catch (error) {
        console.warn("⚠️ ไม่สามารถตรวจสอบสถานะการถูกระงับได้:", error.message);
        return false;
    }
}

async function addEmailToBlockedCollection(email, reason = "กรอกรหัสอนุมัติแอดมินผิดเกิน 3 ครั้ง") {
    try {
        await setDoc(doc(db, "blocked_users", email.toLowerCase()), {
            email: email.toLowerCase(),
            reason: reason,
            blockedAt: serverTimestamp()
        });
        console.log(`❌ ระงับการใช้งานอีเมล ${email} เรียบร้อยแล้ว`);
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการบันทึกรายชื่อผู้ถูกระงับ:", error);
    }
}

// 🗑️ ฟังก์ชันจัดการลบข้อมูลใน Firestore
async function deleteAdminData(officerId) {
    try {
        await deleteDoc(doc(db, "admins", officerId));
        console.log(`🗑️ ลบข้อมูลผู้ดูแลระบบ (${officerId}) เรียบร้อยแล้ว`);
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการลบเอกสารผู้ดูแลระบบ:", error);
    }
}

async function deleteUserData(uid) {
    try {
        await deleteDoc(doc(db, "users", uid));
        console.log(`🗑️ ลบข้อมูลผู้ใช้งาน (${uid}) เรียบร้อยแล้ว`);
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการลบเอกสารผู้ใช้งาน:", error);
    }
}

// 🗑️ ฟังก์ชันลบบัญชีผู้ใช้งานปัจจุบัน (ทั้ง Firestore และ Firebase Auth)
export async function deleteCurrentUserAccount() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        // 1. ตรวจสอบและลบข้อมูลใน Firestore ก่อน
        const qAdmin = query(collection(db, "admins"), where("uid", "==", user.uid));
        const adminSnap = await getDocs(qAdmin);

        if (!adminSnap.empty) {
            const officerId = adminSnap.docs[0].id;
            await deleteAdminData(officerId);
        } else {
            await deleteUserData(user.uid);
        }

        // 2. ลบบัญชีผู้ใช้จาก Firebase Auth
        await deleteUser(user);
        console.log("✅ ลบบัญชีผู้ใช้งานสำเร็จ");
        
        alert("🗑️ บัญชีของคุณถูกลบออกจากระบบเรียบร้อยแล้ว");
        window.location.href = 'index.html';

    } catch (error) {
        console.error("❌ เกิดข้อผิดพลาดในการลบบัญชี:", error);
        
        // หากระบบแจ้งว่าการล็อกอินเก่านานเกินไป ต้องให้ผู้ใช้ Re-authenticate ใหม่
        if (error.code === 'auth/requires-recent-login') {
            alert("⚠️ เพื่อความปลอดภัย กรุณาเข้าสู่ระบบใหม่อีกครั้งก่อนทำการลบบัญชี");
            await auth.signOut();
            window.location.href = 'index.html';
        } else {
            alert("❌ ไม่สามารถลบบัญชีได้: " + translateAuthError(error.code));
        }
    }
}

async function redirectAfterLogin(user) {
    try {
        // 1. ตรวจสอบในคอลเลกชัน Admins ก่อน
        const qAdmin = query(collection(db, "admins"), where("uid", "==", user.uid));
        const adminQuerySnap = await getDocs(qAdmin);
        
        if (!adminQuerySnap.empty) {
            const adminDoc = adminQuerySnap.docs[0];
            const adminData = adminDoc.data();
            const currentStatus = (adminData.status || "").toLowerCase();

            // ⚡ เช็กสถานะรอการอนุมัติ (รองรับทั้งภาษาอังกฤษและภาษาไทย)
            if (currentStatus === "pending" || currentStatus === "รออนุมัติ" || currentStatus === "รอการอนุมัติ") {
                await auth.signOut();
                showAdminPendingModal(adminData.displayName || "ผู้สมัครแอดมิน");
                return;
            }

            // ⚡ บัญชีที่โดนปฏิเสธ (Rejected) จะทำการลบบัญชีทิ้งอัตโนมัติ
            if (currentStatus === "rejected" || currentStatus === "ไม่อนุมัติ" || currentStatus === "ปฏิเสธ") {
                alert("❌ คำขอสิทธิ์ผู้ดูแลระบบของคุณไม่ได้รับการอนุมัติ ระบบจะลบข้อมูลบัญชีนี้โดยอัตโนมัติ");
                
                // ลบ Document ออกจาก Firestore
                await deleteAdminData(adminDoc.id);
                
                // ลบ Auth บัญชีนี้ออกจากระบบ
                try {
                    await deleteUser(user);
                } catch (e) {
                    await auth.signOut();
                }

                window.location.href = 'index.html';
                return;
            }

            // ⚡ แยกทางไประหว่าง Super Admin และ Admin ทั่วไป
            if (adminData.role === "super_admin") {
                window.location.href = 'super-admin.html';
            } else {
                window.location.href = 'admin-dashboard.html';
            }
            return;
        }

        // 2. หากไม่ใช่ Admin ตรวจสอบในคอลเลกชัน Users
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.isProfileComplete === true) {
                window.location.href = 'main.html';
            } else {
                window.location.href = 'questionnaire.html';
            }
        } else {
            // กรณีเป็น User ใหม่ที่เพิ่งเข้าผ่าน Google และยังไม่มี Document ใน Firestore
            await setDoc(userRef, {
                authProvider: user.providerData[0]?.providerId || "google.com",
                displayName: user.displayName || "ผู้ใช้งาน",
                email: user.email.toLowerCase(),
                role: "user",
                isProfileComplete: false,
                createdAt: serverTimestamp()
            });
            window.location.href = 'questionnaire.html';
        }
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์ผู้ใช้งาน:", error);
        window.location.href = 'index.html';
    }
}

function showAdminPendingModal(username) {
    const existingModal = document.getElementById('pendingAdminModal');
    if (existingModal) existingModal.remove();

    const modalHtml = `
        <div id="pendingAdminModal" style="
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(6px);
            display: flex; align-items: center; justify-content: center;
            z-index: 999999; animation: fadeIn 0.25s ease-out;
            font-family: system-ui, -apple-system, sans-serif;
        ">
            <div style="
                background: #ffffff; width: 90%; max-width: 420px;
                padding: 32px 24px; border-radius: 24px; text-align: center;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
            ">
                <div style="
                    width: 72px; height: 72px; background: #FEF3C7; color: #D97706;
                    border-radius: 50%; display: flex; align-items: center; justify-content: center;
                    font-size: 32px; margin: 0 auto 16px auto;
                ">
                    <i class="fa-solid fa-hourglass-half"></i>
                </div>
                
                <h3 style="color: #0F172A; margin: 0 0 8px 0; font-size: 1.35rem; font-weight: 700;">
                    รอการอนุมัติสิทธิ์ผู้ดูแลระบบ
                </h3>
                
                <p style="color: #475569; font-size: 0.95rem; line-height: 1.5; margin: 0 0 20px 0;">
                    สวัสดีคุณ <strong style="color: #4F46E5;">${username}</strong><br>
                    ระบบลงทะเบียนสิทธิ์แอดมินเรียบร้อยแล้ว โปรดรอการอนุมัติจากผู้ดูแลระบบหลัก
                </p>

                <button id="closePendingBtn" style="
                    width: 100%; padding: 12px; background: #4F46E5; color: white;
                    border: none; border-radius: 12px; font-size: 1rem; font-weight: 600;
                    cursor: pointer;
                ">
                    ตกลง (กลับหน้าเข้าสู่ระบบ)
                </button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // ปิดเมื่อกดปุ่ม
    document.getElementById('closePendingBtn')?.addEventListener('click', () => {
        const modal = document.getElementById('pendingAdminModal');
        if (modal) modal.remove();
        window.location.href = 'index.html';
    });

    // ปิดเมื่อคลิกพื้นหลัง (Backdrop Click)
    const modalElement = document.getElementById('pendingAdminModal');
    modalElement?.addEventListener('click', (e) => {
        if (e.target === modalElement) {
            modalElement.remove();
            window.location.href = 'index.html';
        }
    });
}

// -------------------------------------------------------------
// 1. ซ่อน/แสดง & ตรวจสอบ Role (ทำใน Register Page)
// -------------------------------------------------------------
const regRoleSelect = document.getElementById('regRole');
const adminKeyGroup = document.getElementById('adminKeyGroup');

if (regRoleSelect && adminKeyGroup) {
    regRoleSelect.addEventListener('change', (e) => {
        const adminSecretInput = document.getElementById('adminSecretKey');
        const adminKeyError = document.getElementById('adminKeyError');

        if (e.target.value === 'admin') {
            adminKeyGroup.style.display = 'block';
        } else {
            adminKeyGroup.style.display = 'none';
            if (adminKeyError) adminKeyError.style.display = 'none';
            if (adminSecretInput) {
                adminSecretInput.style.borderColor = '#bcccdc';
                adminSecretInput.disabled = false;
            }
        }
    });
}

// -------------------------------------------------------------
// 2. ระบบเข้าสู่ระบบปกติ (Email/Password)
// -------------------------------------------------------------
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const emailInput = document.getElementById('loginEmail');
        const passwordInput = document.getElementById('loginPassword');
        
        if (!emailInput || !passwordInput) return;

        const email = emailInput.value.trim().toLowerCase();
        const password = passwordInput.value;

        const isBlocked = await isEmailBlocked(email);
        if (isBlocked) {
            alert("❌ อีเมลนี้ถูกระงับการใช้งานในระบบ! โปรดติดต่อผู้ดูแลระบบ");
            return;
        }

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            loginForm.reset();
            await redirectAfterLogin(userCredential.user);
        } catch (error) {
            console.error("เกิดข้อผิดพลาดในการเข้าสู่ระบบ:", error);
            alert("❌ เข้าสู่ระบบไม่สำเร็จ: " + translateAuthError(error.code));
        }
    });
}

// -------------------------------------------------------------
// 3. ระบบลงทะเบียน (Register Form)
// -------------------------------------------------------------
const registerForm = document.getElementById('registerForm');

if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const submitRegBtn = document.getElementById('submitRegBtn');
        const regNameEl = document.getElementById('regName');
        const regEmailEl = document.getElementById('regEmail');
        const regPasswordEl = document.getElementById('regPassword');
        const regPasswordConfirmEl = document.getElementById('regPasswordConfirm');
        const adminSecretInput = document.getElementById('adminSecretKey');
        const adminOfficerIdInput = document.getElementById('adminOfficerId');
        const adminKeyError = document.getElementById('adminKeyError');
        const adminKeyErrorText = document.getElementById('adminKeyErrorText');

        if (!regNameEl || !regEmailEl || !regPasswordEl || !regPasswordConfirmEl) {
            alert("❌ โครงสร้างฟอร์มไม่สมบูรณ์ ตรวจสอบ id ใน HTML");
            return;
        }

        const username = regNameEl.value.trim();
        const email = regEmailEl.value.trim().toLowerCase();
        const password = regPasswordEl.value;
        const passwordConfirm = regPasswordConfirmEl.value;
        
        const role = regRoleSelect?.value || 'user';
        const adminKeyInput = adminSecretInput?.value?.trim() || '';
        const officerIdInput = adminOfficerIdInput?.value?.trim() || '';

        if (!email) {
            alert("❌ กรุณากรอกอีเมล");
            return;
        }

        if (password !== passwordConfirm) { 
            alert("❌ รหัสผ่านยืนยันไม่ตรงกัน"); 
            return; 
        }

        if (password.length < 6) {
            alert("❌ รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
            return;
        }

        if (submitRegBtn) {
            submitRegBtn.disabled = true;
            submitRegBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึกข้อมูล...`;
        }

        if (role === 'admin') {
            if (!officerIdInput) {
                alert("❌ กรุณากรอกรหัสเจ้าหน้าที่");
                if (adminOfficerIdInput) adminOfficerIdInput.focus();
                resetSubmitButton(submitRegBtn);
                return;
            }

            if (adminKeyInput !== ADMIN_SECRET_CODE) {
                let attempts = parseInt(localStorage.getItem(`attempts_${email}`) || '0') + 1;
                localStorage.setItem(`attempts_${email}`, attempts.toString());

                if (attempts >= MAX_ATTEMPTS) {
                    await addEmailToBlockedCollection(email);
                    localStorage.removeItem(`attempts_${email}`);

                    if (adminKeyError && adminKeyErrorText) {
                        adminKeyError.style.display = 'block';
                        adminKeyErrorText.innerText = "❌ ระบุรหัสอนุมัติผิดเกิน 3 ครั้ง! อีเมลนี้ถูกระงับการใช้งานในระบบแล้ว";
                    }
                    if (adminSecretInput) {
                        adminSecretInput.style.borderColor = '#e53e3e';
                        adminSecretInput.disabled = true;
                    }
                } else {
                    const remaining = MAX_ATTEMPTS - attempts;
                    if (adminKeyError && adminKeyErrorText) {
                        adminKeyError.style.display = 'block';
                        adminKeyErrorText.innerText = `รหัสอนุมัติแอดมินไม่ถูกต้อง! สามารถลองได้อีก ${remaining} ครั้ง`;
                    }
                    if (adminSecretInput) {
                        adminSecretInput.style.borderColor = '#e53e3e';
                        adminSecretInput.focus();
                    }
                }
                resetSubmitButton(submitRegBtn);
                return;
            } else {
                localStorage.removeItem(`attempts_${email}`);
            }
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            if (role === 'admin') {
                await setDoc(doc(db, "admins", officerIdInput), {
                    uid: user.uid,
                    authProvider: "email/password",
                    displayName: username,
                    email: email,
                    officerId: officerIdInput,
                    role: "admin",
                    status: "pending",
                    createdAt: serverTimestamp()
                });

                await auth.signOut();
                showAdminPendingModal(username);

            } else {
                await setDoc(doc(db, "users", user.uid), {
                    authProvider: "email/password",
                    displayName: username,
                    email: email,
                    role: "user",
                    isProfileComplete: false,
                    createdAt: serverTimestamp()
                });

                alert("🎉 สมัครสมาชิกสำเร็จ! กรุณาทำแบบสอบถามเพื่อเริ่มต้นใช้งาน");
                window.location.href = 'questionnaire.html';
            }

        } catch (error) {
            console.error("❌ รายละเอียดข้อผิดพลาดในการลงทะเบียน:", error);
            alert("❌ ไม่สามารถลงทะเบียนได้: " + translateAuthError(error.code));
        } finally {
            resetSubmitButton(submitRegBtn);
        }
    });
}

function resetSubmitButton(btn) {
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = `📝 บันทึกข้อมูลลงทะเบียน`;
    }
}

// -------------------------------------------------------------
// 4. ระบบเข้าสู่ระบบด้วย Google
// -------------------------------------------------------------
const googleLoginBtn = document.getElementById('googleLoginBtn');
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;

            const isBlocked = await isEmailBlocked(user.email);
            if (isBlocked) {
                alert("❌ บัญชีอีเมลนี้ถูกระงับการใช้งานในระบบ");
                await auth.signOut();
                return;
            }

            await redirectAfterLogin(user);

        } catch (error) {
            console.error("เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย Google:", error);
            if (error.code !== 'auth/popup-closed-by-user') {
                alert("❌ เกิดข้อผิดพลาดในการล็อกอินด้วย Google: " + translateAuthError(error.code));
            }
        }
    });
}

// -------------------------------------------------------------
// 5. ปุ่มร้องขอลบบัญชีด้วยตนเอง (สำหรับผูกกับปุ่มบน UI ถ้ามี)
// -------------------------------------------------------------
const deleteAccountBtn = document.getElementById('deleteAccountBtn');
if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener('click', async () => {
        const confirmDelete = confirm("⚠️ คุณแน่ใจหรือไม่ที่จะลบบัญชีนี้? การกระทำนี้ไม่สามารถย้อนกลับได้");
        if (confirmDelete) {
            await deleteCurrentUserAccount();
        }
    });
}

// -------------------------------------------------------------
// 6. ฟังก์ชันแปล Error Code จาก Firebase เป็นภาษาไทย
// -------------------------------------------------------------
function translateAuthError(errorCode) {
    switch (errorCode) {
        case 'auth/email-already-in-use':
            return "อีเมลนี้เคยลงทะเบียนไว้แล้ว กรุณาใช้อีเมลอื่น หรือเข้าสู่ระบบ";
        case 'auth/invalid-email':
            return "รูปแบบอีเมลไม่ถูกต้อง";
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            return "อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง";
        case 'auth/weak-password':
            return "รหัสผ่านง่ายเกินไป กรุณาตั้งอย่างน้อย 6 ตัวอักษร";
        case 'auth/too-many-requests':
            return "มีการพยายามเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณาลองใหม่ในภายหลัง";
        case 'auth/network-request-failed':
            return "ปัญหาการเชื่อมต่อเครือข่าย กรุณาตรวจสอบอินเทอร์เน็ตของคุณ";
        default:
            return "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ (" + errorCode + ")";
    }
}
