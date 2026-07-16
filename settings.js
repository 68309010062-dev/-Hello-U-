import { onAuthStateChanged, deleteUser, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase-config.js"; 

document.addEventListener("DOMContentLoaded", () => {
    let currentUser = null;
    let uploadedAvatarBase64 = null; // ตัวแปรเก็บภาพ Base64 ชั่วคราว

    // 1. ดึง Element จากหน้าจอ
    const userNameDisplay = document.getElementById("userNameDisplay");
    const portfolioCountDisplay = document.getElementById("portfolioCountDisplay");
    const userAvatar = document.getElementById("userAvatar");
    const backToMainBtn = document.getElementById("backToMainBtn");

    // Elements ส่วนแก้ไขโปรไฟล์
    const editDisplayName = document.getElementById("editDisplayName");
    const editAvatarUrl = document.getElementById("editAvatarUrl");
    const editAvatarFile = document.getElementById("editAvatarFile");
    const fileNameDisplay = document.getElementById("fileNameDisplay");
    const saveProfileBtn = document.getElementById("saveProfileBtn");

    const bgWhiteBtn = document.getElementById("bgWhiteBtn");
    const bgGradBtn = document.getElementById("bgGradBtn");
    const bgBlackBtn = document.getElementById("bgBlackBtn");

    const logoutBtn = document.getElementById("logoutBtn");
    const deleteAccountBtn = document.getElementById("deleteAccountBtn");

    // ฟังก์ชันเพิ่มเอฟเฟกต์ให้กับปุ่มย้อนกลับ
    if (backToMainBtn) {
        backToMainBtn.addEventListener("mouseenter", () => {
            const currentBg = localStorage.getItem("userBackground") || "#0f0c1b";
            backToMainBtn.style.background = currentBg === "#ffffff" ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.15)";
        });
        backToMainBtn.addEventListener("mouseleave", () => {
            backToMainBtn.style.background = "transparent";
        });
        backToMainBtn.addEventListener("click", () => {
            window.location.href = "main.html";
        });
    }

    // ฟังก์ชันปรับธีมสีของหน้าเว็บ
    function applyThemeStyles(color) {
        document.body.style.background = color;
        const topBar = document.querySelector(".top-bar");
        const inputs = document.querySelectorAll(".input-group input");

        if (color === "#ffffff") {
            document.body.style.color = "#1a202c";
            if (topBar) {
                topBar.style.background = "rgba(0, 0, 0, 0.05)";
                topBar.style.borderBottom = "1px solid rgba(0, 0, 0, 0.1)";
            }
            if (userAvatar) userAvatar.style.borderColor = "#1a202c";
            inputs.forEach(input => {
                input.style.background = "#f7fafc";
                input.style.color = "#1a202c";
                input.style.borderColor = "#cbd5e0";
            });
        } else {
            document.body.style.color = "white";
            if (topBar) {
                topBar.style.background = "rgba(255, 255, 255, 0.1)";
                topBar.style.borderBottom = "1px solid rgba(255, 255, 255, 0.1)";
            }
            if (userAvatar) userAvatar.style.borderColor = "white";
            inputs.forEach(input => {
                input.style.background = "#0f0c1b";
                input.style.color = "white";
                input.style.borderColor = "#4a5568";
            });
        }
    }

    const savedBg = localStorage.getItem("userBackground") || "linear-gradient(180deg, #0f0c1b 0%, #bd00ff 100%)";
    applyThemeStyles(savedBg);

    // ตรวจสอบสถานะและดึงข้อมูลเดิมมาใส่ใน Input ฟอร์ม
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            let currentName = user.displayName || 'ผู้ใช้ทั่วไป';
            let currentPhoto = user.photoURL || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

            try {
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);
                
                if (userDocSnap.exists()) {
                    const data = userDocSnap.data();
                    currentName = data.displayName || currentName;
                    currentPhoto = data.photoURL || currentPhoto;
                }
            } catch (error) { 
                console.error("Error fetching user doc:", error);
            }

            // แสดงผลบนหัวเว็บ
            userNameDisplay.textContent = `ชื่อผู้ใช้: ${currentName}`;
            if (userAvatar) userAvatar.src = currentPhoto;

            // นำค่าเดิมมาหยอดรอไว้ในช่องแก้ไข
            if (editDisplayName) editDisplayName.value = currentName;
            if (editAvatarUrl && user.photoURL && !user.photoURL.startsWith("data:")) {
                editAvatarUrl.value = user.photoURL;
            }
            
            // ดึงจำนวนผลงานจากฐานข้อมูล
            if (portfolioCountDisplay) {
                try {
                    const portfolioRef = collection(db, "portfolios");
                    const q = query(portfolioRef, where("userId", "==", user.uid));
                    const querySnapshot = await getDocs(q);
                    portfolioCountDisplay.textContent = `จำนวนผลงาน: ${querySnapshot.size} ชิ้น`;
                } catch (err) {
                    portfolioCountDisplay.textContent = "จำนวนผลงาน: 0 ชิ้น";
                }
            }
        } else {
            window.location.href = "index.html"; 
        }
    });

    // ตรวจจับการเลือกไฟล์รูปภาพจากเครื่อง และแปลงเป็น Base64
    if (editAvatarFile) {
        editAvatarFile.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 2 * 1024 * 1024) { // จำกัดขนาดไฟล์ไม่เกิน 2MB
                    alert("❌ ขนาดไฟล์ใหญ่เกินไป! กรุณาเลือกไฟล์ที่ขนาดไม่เกิน 2MB ครับ");
                    editAvatarFile.value = "";
                    fileNameDisplay.textContent = "ยังไม่ได้เลือกไฟล์";
                    return;
                }
                fileNameDisplay.textContent = file.name;
                
                const reader = new FileReader();
                reader.onloadend = () => {
                    uploadedAvatarBase64 = reader.result; // ได้ไฟล์ Base64
                    if (editAvatarUrl) editAvatarUrl.value = ""; // ล้างช่อง URL ออกเพื่อไม่ให้ตีกัน
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // 💾 ฟังก์ชันสำหรับกดปุ่มบันทึกการแก้ไขชื่อและโปรไฟล์
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener("click", async () => {
            if (!currentUser) return;

            const newName = editDisplayName.value.trim();
            let newPhotoUrl = editAvatarUrl.value.trim();

            if (!newName) {
                alert("❌ กรุณากรอกชื่อผู้ใช้ด้วยครับ");
                return;
            }

            // หากมีภาพจากการอัปโหลดไฟล์ ให้ใช้ภาพนั้นแทน URL
            if (uploadedAvatarBase64) {
                newPhotoUrl = uploadedAvatarBase64;
            }

            try {
                saveProfileBtn.disabled = true;
                saveProfileBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...`;

                // 1. อัปเดตข้อมูลไปที่ Firebase Authentication
                const updateData = { displayName: newName };
                if (newPhotoUrl) {
                    updateData.photoURL = newPhotoUrl;
                }
                await updateProfile(currentUser, updateData);

                // 2. บันทึกและซิงค์ข้อมูลลงใน Firestore ป้องกันข้อมูลหลุดหาย
                const userDocRef = doc(db, "users", currentUser.uid);
                await setDoc(userDocRef, {
                    displayName: newName,
                    photoURL: newPhotoUrl || currentUser.photoURL || "",
                    email: currentUser.email,
                    updatedAt: new Date().toISOString()
                }, { merge: true });

                // 3. ปรับการแสดงผลหน้าเว็บปัจจุบันให้เห็นผลทันที
                userNameDisplay.textContent = `ชื่อผู้ใช้: ${newName}`;
                if (newPhotoUrl && userAvatar) {
                    userAvatar.src = newPhotoUrl;
                }

                alert("🎉 บันทึกข้อมูลโปรไฟล์ของคุณสำเร็จแล้ว!");
            } catch (error) {
                console.error(error);
                alert("❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง");
            } finally {
                saveProfileBtn.disabled = false;
                saveProfileBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> บันทึกการเปลี่ยนแปลง`;
            }
        });
    }

    // สลับสีพื้นหลังตามการกดปุ่ม
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

    // ปุ่มลงชื่อออก
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

    // ปุ่มลบบัญชีผู้ใช้
    if (deleteAccountBtn && deleteModal) {
        deleteAccountBtn.addEventListener("click", () => {
            if (!currentUser) return;
            if (modalUserEmailText) modalUserEmailText.textContent = currentUser.email;
            if (deleteConfirmInput) deleteConfirmInput.value = "";
            deleteModal.style.display = "flex";
        });
    }
    if (cancelDeleteBtn && deleteModal) {
        cancelDeleteBtn.addEventListener("click", () => {
            deleteModal.style.display = "none";
        });
    }
    if (finalDeleteBtn && deleteConfirmInput && deleteModal) {
        finalDeleteBtn.addEventListener("click", async () => {
            if (!currentUser) return;
            const userEmail = currentUser.email;
            const userInput = deleteConfirmInput.value.trim();

            if (userInput !== userEmail) {
                alert("❌ อีเมลไม่ถูกต้อง! กรุณาตรวจสอบและพิมพ์ใหม่อีกครั้ง");
                return;
            }

            const finalConfirm = confirm("ยืนยันครั้งสุดท้ายจริง ๆ นะครับ? ระบบจะลบข้อมูลของคุณทั้งหมดทันที");
            if (finalConfirm) {
                try {
                    await deleteDoc(doc(db, "users", currentUser.uid));
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
