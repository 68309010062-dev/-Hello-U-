import { onAuthStateChanged, deleteUser } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase-config.js"; 

document.addEventListener("DOMContentLoaded", () => {
    let currentUser = null;

    // 1. ดึง Element จากหน้าจอ
    const userNameDisplay = document.getElementById("userNameDisplay");
    const portfolioCountDisplay = document.getElementById("portfolioCountDisplay");
    const userAvatar = document.getElementById("userAvatar");

    const bgWhiteBtn = document.getElementById("bgWhiteBtn");
    const bgGradBtn = document.getElementById("bgGradBtn");
    const bgBlackBtn = document.getElementById("bgBlackBtn");

    const logoutBtn = document.getElementById("logoutBtn");
    const deleteAccountBtn = document.getElementById("deleteAccountBtn");

    // 🎨 ฟังก์ชันสำหรับปรับสีตัวอักษรและสไตล์ตามสีพื้นหลังที่เลือก
    function applyThemeStyles(color) {
        document.body.style.background = color;
        const topBar = document.querySelector(".top-bar");

        if (color === "#ffffff") {
            // ⚪ ถ้าเป็นสีขาว: เปลี่ยนตัวอักษรหลักเป็นสีเข้ม
            document.body.style.color = "#1a202c";
            if (topBar) {
                topBar.style.background = "rgba(0, 0, 0, 0.05)";
                topBar.style.borderBottom = "1px solid rgba(0, 0, 0, 0.1)";
            }
            if (userAvatar) userAvatar.style.borderColor = "#1a202c";
        } else {
            // ⚫ ถ้าเป็นสีดำ หรือ สีไล่เฉด: เปลี่ยนตัวอักษรหลักเป็นสีขาว
            document.body.style.color = "white";
            if (topBar) {
                topBar.style.background = "rgba(255, 255, 255, 0.1)";
                topBar.style.borderBottom = "1px solid rgba(255, 255, 255, 0.1)";
            }
            if (userAvatar) userAvatar.style.borderColor = "white";
        }
    }

    // 2. ดึงสีพื้นหลังที่เคยเซฟไว้มาใช้ตอนเปิดหน้าเว็บ
    const savedBg = localStorage.getItem("userBackground") || "linear-gradient(180deg, #0f0c1b 0%, #bd00ff 100%)";
    applyThemeStyles(savedBg);

    // 3. ตรวจสอบสถานะการล็อกอิน และดึงข้อมูลผู้ใช้
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            try {
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);
                
                if (userDocSnap.exists()) {
                    userNameDisplay.textContent = `ชื่อผู้ใช้: ${userDocSnap.data().displayName || user.displayName || 'ผู้ใช้ทั่วไป'}`;
                } else {
                    userNameDisplay.textContent = `ชื่อผู้ใช้: ${user.displayName || 'ผู้ใช้ทั่วไป'}`;
                }
            } catch (error) { 
                userNameDisplay.textContent = `ชื่อผู้ใช้: ${user.displayName || 'ผู้ใช้ทั่วไป'}`;
            }
            
            // ดึงจำนวนผลงานมาแสดงในหน้าตั้งค่าด้วย (ถ้ามี element)
            if (portfolioCountDisplay) {
                // ตัวเลขจริงจะดึงจาก Firestore หน้าหลัก แต่อันนี้ใส่ค่าไว้รองรับโครงสร้าง
                portfolioCountDisplay.textContent = localStorage.getItem("portfolioCount") || "จำนวนผลงาน: 0 ชิ้น";
            }

            if (user.photoURL && userAvatar) {
                userAvatar.src = user.photoURL;
            }
        } else {
            window.location.href = "index.html"; 
        }
    });

    // 4. ฟังก์ชันเปลี่ยนสีพื้นหลังเมื่อกดปุ่ม (บันทึกค่าลง localStorage เผื่อให้หน้าหลักดึงไปใช้)
    if (bgWhiteBtn) {
        bgWhiteBtn.addEventListener("click", () => {
            const color = "#ffffff";
            localStorage.setItem("userBackground", color);
            applyThemeStyles(color);
        });
    }
    
    if (bgGradBtn) {
        bgGradBtn.addEventListener("click", () => {
            const color = "linear-gradient(180deg, #0f0c1b 0%, #bd00ff 100%)";
            localStorage.setItem("userBackground", color);
            applyThemeStyles(color);
        });
    }
    
    if (bgBlackBtn) {
        bgBlackBtn.addEventListener("click", () => {
            const color = "#000000";
            localStorage.setItem("userBackground", color);
            applyThemeStyles(color);
        });
    }

    // 5. ปุ่มลงชื่อออก (Logout)
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            if (confirm("คุณต้องการลงชื่อออกจากระบบใช่หรือไม่?")) {
                try {
                    await auth.signOut();
                    window.location.href = "index.html";
                } catch (error) { 
                    alert("เกิดข้อผิดพลาดในการลงชื่อออก"); 
                }
            }
        });
    }

    // 6. ปุ่มลบบัญชีผู้ใช้ (ระบบเปิด Modal บังคับพิมพ์เพื่อความปลอดภัยขั้นสุด)
    const deleteModal = document.getElementById("deleteModal");
    const modalUserEmailText = document.getElementById("modalUserEmailText");
    const deleteConfirmInput = document.getElementById("deleteConfirmInput");
    const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
    const finalDeleteBtn = document.getElementById("finalDeleteBtn");

    if (deleteAccountBtn && deleteModal) {
        // เมื่อคลิกปุ่ม "ลบบัญชี" สีแดงในหน้าตั้งค่า
        deleteAccountBtn.addEventListener("click", () => {
            if (!currentUser) return;
            
            // นำอีเมลของผู้ใช้ปัจจุบันไปแสดงใน Modal เพื่อให้ผู้ใช้ดูแล้วพิมพ์ตาม
            if (modalUserEmailText) modalUserEmailText.textContent = currentUser.email;
            
            // ล้างค่าในช่องพิมพ์เก่าทิ้งก่อนเปิด
            if (deleteConfirmInput) deleteConfirmInput.value = "";
            
            // สั่งแสดงผล Modal ขึ้นมาบนหน้าจอ
            deleteModal.style.display = "flex";
        });
    }

    // ปุ่มกดยกเลิกใน Modal
    if (cancelDeleteBtn && deleteModal) {
        cancelDeleteBtn.addEventListener("click", () => {
            deleteModal.style.display = "none"; // ซ่อน Modal
        });
    }

    // ปุ่มกดยืนยันลบใน Modal
    if (finalDeleteBtn && deleteConfirmInput && deleteModal) {
        finalDeleteBtn.addEventListener("click", async () => {
            if (!currentUser) return;

            const userEmail = currentUser.email;
            const userInput = deleteConfirmInput.value.trim(); // ตัดช่องว่างหน้าหลังออกให้

            // 1. เช็กความปลอดภัยด่านแรก: พิมพ์ตรงกับ Email บัญชี Google ปัจจุบันไหม
            if (userInput !== userEmail) {
                alert("❌ อีเมลไม่ถูกต้อง! กรุณาตรวจสอบและพิมพ์ใหม่อีกครั้ง");
                return; // เด้งออก ไม่ทำงานต่อ
            }

            // 2. เช็กด่านสุดท้ายเพื่อความชัวร์
            const finalConfirm = confirm("ยืนยันครั้งสุดท้ายจริง ๆ นะครับ? ระบบจะลบข้อมูลของคุณทั้งหมดทันที");
            if (finalConfirm) {
                try {
                    // ลบเอกสารออกจาก Firestore
                    await deleteDoc(doc(db, "users", currentUser.uid));
                    // ลบตัวผู้ใช้ออกจาก Firebase Auth
                    await deleteUser(currentUser);
                    
                    alert("ลบบัญชีผู้ใช้ของคุณสำเร็จแล้ว");
                    window.location.href = "index.html";
                } catch (error) {
                    console.error(error);
                    alert("เพื่อความปลอดภัยขั้นสูง กรุณาลงชื่อออกแล้วเข้าสู่ระบบใหม่อีกครั้ง ก่อนทำการลบบัญชีนะครับพี่");
                    deleteModal.style.display = "none";
                }
            }
        });
    }
});
