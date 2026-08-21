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

// 🔑 ค่าสำรอง (Fallback) กรณีดึงจาก Firestore ไม่สำเร็จ
const DEFAULT_ADMIN_KEY = "ADMIN123";

// 🔑 ฟังก์ชันดึง Admin Key ล่าสุดจาก Firestore
async function getAdminKeyFromDB() {
    let key = DEFAULT_ADMIN_KEY;
    try {
        const configDoc = await getDoc(doc(db, "system_settings", "config"));
        if (configDoc.exists()) {
            const data = configDoc.data();
            if (data.adminKey) key = data.adminKey.trim();
        }
    } catch (error) {
        console.warn("⚠️ ไม่สามารถดึง Admin Key จาก Firestore ได้ ใช้ค่าเริ่มต้นแทน:", error.message);
    }
    return key;
}

// -------------------------------------------------------------
// 0. ฟังก์ชันช่วยเหลือและแปลภาษา
// -------------------------------------------------------------

function getDeviceId() {
    let deviceId = localStorage.getItem("app_device_id");
    if (!deviceId) {
        deviceId = "dev_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
        localStorage.setItem("app_device_id", deviceId);
    }
    return deviceId;
}

export function translateStatus(status) {
    if (!status) return 'ไม่ระบุ';
    const s = status.toLowerCase();
    
    switch (s) {
        case 'pending': case 'รออนุมัติ': case 'รอการอนุมัติ':
            return '⏳ รอการอนุมัติ';
        case 'approved': case 'อนุมัติแล้ว': case 'อนุมัติ':
            return '✅ อนุมัติแล้ว';
        case 'rejected': case 'ไม่อนุมัติ': case 'ปฏิเสธ':
            return '❌ ปฏิเสธการเข้าใช้งาน';
        default:
            return status;
    }
}

export function translateRole(role) {
    if (!role) return 'ไม่ระบุ';
    const r = role.toLowerCase();
    
    switch (r) {
        case 'super_admin': case 'superadmin':
            return '👑 ผู้ดูแลระบบสูงสุด';
        case 'admin':
            return '🛡️ ผู้ดูแลระบบ';
        case 'user':
            return '👤 ผู้ใช้งานทั่วไป';
        default:
            return role;
    }
}

// 🔍 ฟังก์ชันตรวจสอบชื่อผู้ใช้ซ้ำกันในระบบ
async function isUsernameTaken(username) {
    try {
        const qUser = query(collection(db, "users"), where("displayName", "==", username));
        const userSnap = await getDocs(qUser);
        if (!userSnap.empty) return true;

        const qAdmin = query(collection(db, "admins"), where("displayName", "==", username));
        const adminSnap = await getDocs(qAdmin);
        return !adminSnap.empty;
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการเช็กชื่อผู้ใช้ซ้ำ:", error);
        return false;
    }
}

// 🛡️ ตรวจสอบการถูกบล็อกของอีเมลจาก Firestore เท่านั้น
async function isEmailBlocked(email) {
    if (!email) return false;
    try {
        const emailLower = email.trim().toLowerCase();
        const q = query(collection(db, "blocked_users"), where("email", "==", emailLower));
        const querySnapshot = await getDocs(q);
        
        return !querySnapshot.empty;
    } catch (error) {
        console.warn("⚠️ ไม่สามารถตรวจสอบสถานะการถูกระงับจาก Firestore ได้:", error.message);
        return false;
    }
}

// 🔒 ฟังก์ชันปิดตัวเลือก Admin บน UI
function disableAdminOptionsUI() {
    const regRoleSelect = document.getElementById('regRole');
    const adminKeyGroup = document.getElementById('adminKeyGroup');

    if (regRoleSelect) {
        regRoleSelect.value = "user";
        const adminOpt = regRoleSelect.querySelector('option[value="admin"]');
        const superOpt = regRoleSelect.querySelector('option[value="superadmin"]');
        if (adminOpt) adminOpt.disabled = true;
        if (superOpt) superOpt.disabled = true;
    }
    if (adminKeyGroup) {
        adminKeyGroup.style.display = "none";
    }
}

// 🛡️ ตรวจสอบสถานะการบล็อก Admin Key จาก Firestore Database เท่านั้น
async function checkAdminKeyBlockStatus(officerId = "", username = "") {
    const deviceId = getDeviceId();
    const now = Date.now();

    try {
        let blockDocSnap = null;

        if (officerId && username) {
            const customDocId = `${officerId.trim()}_${username.trim()}`.replace(/[\/\\#?]/g, '-');
            const docRef = doc(db, "blocked_registrations", customDocId);
            blockDocSnap = await getDoc(docRef);
        }

        if (!blockDocSnap || !blockDocSnap.exists()) {
            const q = query(collection(db, "blocked_registrations"), where("deviceId", "==", deviceId));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                blockDocSnap = querySnapshot.docs[0];
            }
        }

        if (blockDocSnap && blockDocSnap.exists()) {
            const blockData = blockDocSnap.data();
            const blockRef = blockDocSnap.ref;

            if (blockData.blockType === "temporary" && blockData.blockUntil) {
                const blockUntilTime = blockData.blockUntil.toMillis ? blockData.blockUntil.toMillis() : Number(blockData.blockUntil);
                if (now < blockUntilTime) {
                    const daysLeft = Math.ceil((blockUntilTime - now) / (1000 * 60 * 60 * 24));
                    disableAdminOptionsUI();
                    return { isBlocked: true, daysLeft };
                } else {
                    await deleteDoc(blockRef);
                }
            }
        }
    } catch (error) {
        console.warn("⚠️ เกิดข้อผิดพลาดในการตรวจสอบข้อมูลการบล็อกจาก Firestore:", error.message);
    }

    return { isBlocked: false };
}

// 🛡️ บันทึกการบล็อกลงใน Firestore Database เท่านั้น
async function recordBlockToFirestore(role, email = "", displayName = "", officerId = "") {
    const deviceId = getDeviceId();
    const emailLower = email ? email.trim().toLowerCase() : "";
    const cleanDisplayName = displayName.trim();
    const cleanOfficerId = officerId.trim();

    let customDocId = `${cleanOfficerId}_${cleanDisplayName}`.replace(/[\/\\#?]/g, '-');
    if (!cleanOfficerId && !cleanDisplayName) {
        customDocId = deviceId;
    }

    const blockRef = doc(db, "blocked_registrations", customDocId);
    const blockedUserRef = emailLower ? doc(db, "blocked_users", customDocId) : null;

    const ninetyDaysInMs = 90 * 24 * 60 * 60 * 1000;
    const blockUntilTime = Date.now() + ninetyDaysInMs;

    const tempData = {
        docId: customDocId,
        deviceId: deviceId,
        displayName: cleanDisplayName || "ไม่ระบุ",
        officerId: cleanOfficerId || "ไม่ระบุ",
        email: emailLower || "ไม่ระบุ",
        roleTarget: role,
        reason: "กรอก Admin Key ผิดครบ 3 ครั้ง",
        blockType: "temporary",
        blockUntil: new Date(blockUntilTime),
        createdAt: serverTimestamp()
    };

    try {
        await setDoc(blockRef, tempData);
        if (blockedUserRef) await setDoc(blockedUserRef, tempData);
        console.log(`⛔ บันทึกการบล็อกลง Firestore สำเร็จ! Document ID: "${customDocId}"`);
    } catch (error) {
        console.error("❌ ไม่สามารถบันทึกข้อมูลการบล็อกลง Firestore ได้:", error);
    }
}

async function deleteAdminData(docId) {
    try {
        await deleteDoc(doc(db, "admins", docId));
        console.log(`🗑️ ลบข้อมูลผู้ดูแลระบบ (${docId}) เรียบร้อยแล้ว`);
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการลบเอกสารผู้ดูแลระบบ:", error);
    }
}

async function deleteUserData(docId) {
    try {
        await deleteDoc(doc(db, "users", docId));
        console.log(`🗑️ ลบข้อมูลผู้ใช้งาน (${docId}) เรียบร้อยแล้ว`);
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการลบเอกสารผู้ใช้งาน:", error);
    }
}

export async function deleteCurrentUserAccount() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const adminRef = doc(db, "admins", user.uid);
        const adminSnap = await getDoc(adminRef);

        if (adminSnap.exists()) {
            await deleteAdminData(user.uid);
        } else {
            await deleteUserData(user.uid);
        }

        await deleteUser(user);
        alert("🗑️ บัญชีของคุณถูกลบออกจากระบบเรียบร้อยแล้ว");
        window.location.href = 'index.html';

    } catch (error) {
        console.error("❌ เกิดข้อผิดพลาดในการลบบัญชี:", error);
        
        if (error.code === 'auth/requires-recent-login') {
            alert("⚠️ เพื่อความปลอดภัย กรุณาเข้าสู่ระบบใหม่อีกครั้งก่อนทำการลบบัญชี");
            await auth.signOut();
            window.location.href = 'index.html';
        } else {
            alert("❌ ไม่สามารถลบบัญชีได้: " + translateAuthError(error.code));
        }
    }
}

// -------------------------------------------------------------
// 🔄 ฟังก์ชันนำทางหลังเข้าสู่ระบบ (Redirect Logic)
// -------------------------------------------------------------
async function redirectAfterLogin(user) {
    try {
        // 1. ตรวจสอบว่าบัญชีถูกบล็อกหรือไม่
        const isBlocked = await isEmailBlocked(user.email);
        if (isBlocked) {
            alert("❌ บัญชีอีเมลนี้ถูกระงับการใช้งานในระบบ! โปรดติดต่อผู้ดูแลระบบ");
            await auth.signOut();
            window.location.href = 'index.html';
            return;
        }

        // 2. ตรวจสอบข้อมูลในคอลเลกชัน "admins"
        const adminDocRef = doc(db, "admins", user.uid);
        const adminDocSnap = await getDoc(adminDocRef);
        
        if (adminDocSnap.exists()) {
            const adminData = adminDocSnap.data();
            const currentRole = (adminData.role || "").toLowerCase();
            const currentStatus = (adminData.status || "").toLowerCase();

            // เช็กการอนุมัติสำหรับ Admin (ยกเว้น Super Admin)
            if (currentRole !== "superadmin" && currentRole !== "super_admin") {
                if (currentStatus === "pending" || currentStatus === "รออนุมัติ" || currentStatus === "รอการอนุมัติ") {
                    await auth.signOut();
                    showAdminPendingModal(adminData.displayName || "ผู้สมัครแอดมิน");
                    return;
                }

                if (currentStatus === "rejected" || currentStatus === "ไม่อนุมัติ" || currentStatus === "ปฏิเสธ") {
                    alert("❌ คำขอสิทธิ์ผู้ดูแลระบบของคุณไม่ได้รับการอนุมัติ ระบบจะลบข้อมูลบัญชีนี้โดยอัตโนมัติ");
                    
                    await deleteAdminData(user.uid);
                    try {
                        await deleteUser(user);
                    } catch (e) {
                        await auth.signOut();
                    }

                    window.location.href = 'index.html';
                    return;
                }
            }

            if (adminData.isProfileComplete !== true) {
                window.location.href = 'questionnaire.html';
                return;
            }

            if (currentRole === "superadmin" || currentRole === "super_admin") {
                window.location.href = 'super-admin-dashboard.html';
            } else {
                window.location.href = 'admin-dashboard.html';
            }
            return;
        }

        // 3. ตรวจสอบข้อมูลในคอลเลกชัน "users"
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            
            if (userData.isProfileComplete === true) {
                window.location.href = 'main.html';
            } else {
                window.location.href = 'questionnaire.html';
            }
        } else {
            await setDoc(userDocRef, {
                uid: user.uid,
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

    const closeModal = () => {
        document.getElementById('pendingAdminModal')?.remove();
        window.location.href = 'index.html';
    };

    document.getElementById('closePendingBtn')?.addEventListener('click', closeModal);
    document.getElementById('pendingAdminModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'pendingAdminModal') closeModal();
    });
}

// -------------------------------------------------------------
// Event Listeners การทำงานฝั่ง UI
// -------------------------------------------------------------
let failedAttemptsCount = 0;

document.addEventListener('DOMContentLoaded', () => {
    const regRoleSelect = document.getElementById('regRole');
    const adminKeyGroup = document.getElementById('adminKeyGroup');

    if (regRoleSelect && adminKeyGroup) {
        regRoleSelect.addEventListener('change', (e) => {
            const role = e.target.value;
            adminKeyGroup.style.display = (role === 'admin' || role === 'superadmin') ? 'block' : 'none';
        });
    }

    checkAdminKeyBlockStatus();
});

// 2. ระบบเข้าสู่ระบบ (index.html)
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const email = document.getElementById('loginEmail')?.value.trim().toLowerCase();
        const password = document.getElementById('loginPassword')?.value;

        if (!email || !password) return;

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

// 3. ระบบลงทะเบียน (register.html)
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const submitRegBtn = document.getElementById('submitRegBtn');
        const username = document.getElementById('regName')?.value.trim();
        const email = document.getElementById('regEmail')?.value.trim().toLowerCase();
        const password = document.getElementById('regPassword')?.value;
        const passwordConfirm = document.getElementById('regPasswordConfirm')?.value;
        const role = document.getElementById('regRole')?.value || 'user';
        const officerIdInput = document.getElementById('adminOfficerId')?.value?.trim() || '';
        const inputAdminKey = document.getElementById('adminKey')?.value?.trim() || '';
        const attemptWarning = document.getElementById('attemptWarning');

        if (!username || !email || !password || !passwordConfirm) {
            alert("❌ กรุณากรอกข้อมูลในช่องที่จำเป็นให้ครบถ้วน");
            return;
        }

        if (password !== passwordConfirm) { alert("❌ รหัสผ่านยืนยันไม่ตรงกัน"); return; }
        if (password.length < 6) { alert("❌ รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร"); return; }

        const isDuplicateUser = await isUsernameTaken(username);
        if (isDuplicateUser) {
            alert("❌ ชื่อผู้ใช้นี้ถูกใช้งานแล้ว กรุณาใช้ชื่ออื่น");
            return;
        }

        if (role === 'admin' || role === 'superadmin') {
            const blockStatus = await checkAdminKeyBlockStatus(officerIdInput, username);
            
            if (blockStatus.isBlocked) {
                disableAdminOptionsUI();
                alert(`⛔ บัญชีหรืออุปกรณ์นี้ถูกระงับสิทธิ์การสมัคร Admin ชั่วคราว (เหลือเวลาอีกประมาณ ${blockStatus.daysLeft} วัน)\n\nระบบจะปรับสิทธิ์เป็นผู้ใช้ทั่วไป`);
                return;
            }

            if (!officerIdInput) {
                alert("❌ กรุณากรอกรหัสเจ้าหน้าที่");
                document.getElementById('adminOfficerId')?.focus();
                return;
            }

            if (!inputAdminKey) {
                alert("❌ กรุณากรอก Admin Key ยืนยันสิทธิ์");
                document.getElementById('adminKey')?.focus();
                return;
            }

            // 🟢 ดึง Admin Key จาก Firestore มาตรวจสอบสิทธิ์
            const dbAdminKey = await getAdminKeyFromDB();

            if (inputAdminKey !== dbAdminKey) {
                failedAttemptsCount++;

                if (failedAttemptsCount >= 3) {
                    await recordBlockToFirestore(role, email, username, officerIdInput);
                    alert(`⛔ คุณ (${username}) ใส่ Admin Key ผิดครบ 3 ครั้ง!\n\nระบบได้ทำการบันทึกบล็อกการสมัครสิทธิ์ Admin ของคุณเป็นเวลา 90 วันแล้ว`);
                    disableAdminOptionsUI();
                    return;
                } else {
                    const remaining = 3 - failedAttemptsCount;
                    if (attemptWarning) {
                        attemptWarning.textContent = `⚠️ Admin Key ไม่ถูกต้อง! (เตือนครั้งที่ ${failedAttemptsCount}/3 - หากผิดครบ 3 ครั้งจะถูกบล็อก 90 วัน)`;
                    }
                    alert(`❌ Admin Key ไม่ถูกต้อง! (เหลือโอกาสอีก ${remaining} ครั้ง หากผิดครบระบบจะบันทึกบล็อกทันที)`);
                    return;
                }
            }

            failedAttemptsCount = 0;
        }

        if (submitRegBtn) {
            submitRegBtn.disabled = true;
            submitRegBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึกข้อมูล...`;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            if (role === 'admin' || role === 'superadmin') {
                const isSuperAdmin = (role === 'superadmin');
                
                const adminDocData = {
                    uid: user.uid,
                    authProvider: "email/password",
                    displayName: username,
                    email: email,
                    officerId: officerIdInput,
                    role: role,
                    // 🛠️ แก้ไข: หากเป็น superadmin ให้ approved ทันที แต่ถ้าเป็น admin ทั่วไปให้เป็น pending
                    status: isSuperAdmin ? 'approved' : 'pending',
                    isProfileComplete: false,
                    createdAt: serverTimestamp()
                };

                await setDoc(doc(db, "admins", user.uid), adminDocData);
                
                // 🛠️ แก้ไข: ถ้าเป็น admin ปกติ ให้ Sign out แล้วแสดง Modal รออนุมัติ
                if (!isSuperAdmin) {
                    await auth.signOut();
                    showAdminPendingModal(username);
                } else {
                    alert("🎉 สมัครสมาชิกผู้ดูแลระบบสูงสุดสำเร็จ!");
                    window.location.href = 'questionnaire.html';
                }

            } else {
                await setDoc(doc(db, "users", user.uid), {
                    uid: user.uid,
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

// 4. ระบบเข้าสู่ระบบด้วย Google
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

// 5. ปุ่มร้องขอลบบัญชีด้วยตนเอง
const deleteAccountBtn = document.getElementById('deleteAccountBtn');
if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener('click', async () => {
        if (confirm("⚠️ คุณแน่ใจหรือไม่ที่จะลบบัญชีนี้? การกระทำนี้ไม่สามารถย้อนกลับได้")) {
            await deleteCurrentUserAccount();
        }
    });
}

// 6. ฟังก์ชันแปล Error Code จาก Firebase เป็นภาษาไทย
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
