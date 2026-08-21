import { onAuthStateChanged, deleteUser, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase-config.js"; 

document.addEventListener("DOMContentLoaded", () => {
    let currentUser = null;
    let userRoleCollection = "users"; // ค่าเริ่มต้นสำหรับ Collection
    let currentUserRole = "user";

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
    const deleteModal = document.getElementById("deleteModal");
    const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
    const finalDeleteBtn = document.getElementById("finalDeleteBtn");
    const deleteConfirmInput = document.getElementById("deleteConfirmInput");
    const modalUserEmailText = document.getElementById("modalUserEmailText");

    // 🔙 ฟังก์ชันปุ่มย้อนกลับ (ตรวจสอบตามประเภทบัญชีและ Referrer)
    if (backToMainBtn) {
        backToMainBtn.addEventListener("mouseenter", () => {
            const currentBg = localStorage.getItem("userBackground") || "#0f0c1b";
            backToMainBtn.style.background = currentBg === "#ffffff" ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.15)";
        });
        backToMainBtn.addEventListener("mouseleave", () => {
            backToMainBtn.style.background = "transparent";
        });
        
        backToMainBtn.addEventListener("click", () => {
            const referrer = document.referrer;
            if (currentUserRole === "superadmin" || currentUserRole === "super_admin" || referrer.includes("super-admin-dashboard.html")) {
                window.location.href = "super-admin-dashboard.html";
            } else if (currentUserRole === "admin" || referrer.includes("admin-dashboard.html")) {
                window.location.href = "admin-dashboard.html";
            } else {
                window.location.href = "main.html";
            }
        });
    }

    // 🎨 ฟังก์ชันปรับธีมสีของหน้าเว็บ
    function applyThemeStyles(color) {
        document.body.style.background = color;
        const topBar = document.querySelector(".top-bar");
        const inputs = document.querySelectorAll(".input-group input");
        
        const uploadElements = document.querySelectorAll(
            ".upload-section, .upload-section *, .input-group label, .file-input-label, .file-input-label *, [for='editAvatarFile'], [for='editAvatarFile'] *"
        );
        
        const uploadButtons = document.querySelectorAll(".file-input-label, [for='editAvatarFile'], .upload-btn");

        if (color === "#ffffff") {
            document.body.style.color = "#1a202c";
            if (userNameDisplay) userNameDisplay.style.color = "#000000";
            if (portfolioCountDisplay) portfolioCountDisplay.style.color = "#000000";
            if (fileNameDisplay) fileNameDisplay.style.color = "#4a5568"; 

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

            uploadElements.forEach(el => {
                el.style.color = "#1a202c";
            });
            if (editAvatarFile) editAvatarFile.style.color = "#1a202c";

            uploadButtons.forEach(btn => {
                btn.style.background = "#f7fafc";
                btn.style.borderColor = "#cbd5e0";
                btn.style.boxShadow = "0 2px 4px rgba(0,0,0,0.05)";
            });

        } else {
            document.body.style.color = "white";
            if (userNameDisplay) userNameDisplay.style.color = "white";
            if (portfolioCountDisplay) portfolioCountDisplay.style.color = "white";
            if (fileNameDisplay) fileNameDisplay.style.color = "#cbd5e0";

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

            uploadElements.forEach(el => {
                el.style.color = "white";
            });
            if (editAvatarFile) editAvatarFile.style.color = "white";

            uploadButtons.forEach(btn => {
                btn.style.background = "rgba(255, 255, 255, 0.1)";
                btn.style.borderColor = "rgba(255, 255, 255, 0.2)";
                btn.style.boxShadow = "none";
            });
        }
    }

    const savedBg = localStorage.getItem("userBackground") || "linear-gradient(180deg, #0f0c1b 0%, #bd00ff 100%)";
    applyThemeStyles(savedBg);

    // ตรวจสอบสถานะ ล็อกอิน และเช็กสิทธิ์ว่าเป็น Admin หรือ User
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            let currentName = user.displayName || 'ผู้ใช้ทั่วไป';
            let currentPhoto = user.photoURL || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

            try {
                // 🔍 1. ตรวจสอบจาก Collection "admins" ก่อน
                const adminDocSnap = await getDoc(doc(db, "admins", user.uid));
                
                if (adminDocSnap.exists()) {
                    userRoleCollection = "admins";
                    const data = adminDocSnap.data();
                    currentName = data.displayName || currentName;
                    currentPhoto = data.photoURL || currentPhoto;
                    currentUserRole = data.role || "admin";
                } else {
                    // 🔍 2. ถ้าไม่พบใน admins ให้ดึงจาก Collection "users"
                    const userDocSnap = await getDoc(doc(db, "users", user.uid));
                    if (userDocSnap.exists()) {
                        userRoleCollection = "users";
                        const data = userDocSnap.data();
                        currentName = data.displayName || currentName;
                        currentPhoto = data.photoURL || currentPhoto;
                        currentUserRole = data.role || "user";
                    }
                }
            } catch (error) { 
                console.error("Error fetching user profile doc:", error);
            }

            userNameDisplay.textContent = `ชื่อผู้ใช้: ${currentName}`;
            if (userAvatar) userAvatar.src = currentPhoto;

            if (editDisplayName) editDisplayName.value = currentName;
            
            if (editAvatarUrl) {
                editAvatarUrl.value = currentPhoto.startsWith("data:") ? "" : currentPhoto;
            }
            
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

    // ✂️ ฟังก์ชันย่อขนาดรูปภาพ
    function compressImage(file, maxWidth, maxHeight, callback) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                callback(compressedBase64);
            };
        };
    }

    // 📸 ตรวจจับการเลือกไฟล์รูปภาพ
    if (editAvatarFile) {
        editAvatarFile.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) {
                fileNameDisplay.textContent = file.name;
                compressImage(file, 150, 150, (compressedBase64) => {
                    if (editAvatarUrl) {
                        editAvatarUrl.value = compressedBase64; 
                    }
                });
            }
        });
    }

    // 💾 บันทึกการเปลี่ยนแปลงข้อมูลลง Collection ที่ถูกต้อง (admins หรือ users)
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener("click", async () => {
            if (!currentUser) return;

            const newName = editDisplayName.value.trim();
            const newPhotoUrl = editAvatarUrl.value.trim();

            if (!newName) {
                alert("❌ กรุณากรอกชื่อผู้ใช้ด้วยครับ");
                return;
            }

            try {
                saveProfileBtn.disabled = true;
                saveProfileBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...`;

                const profileUpdateObj = { displayName: newName };
                
                if (newPhotoUrl && !newPhotoUrl.startsWith("data:")) {
                    profileUpdateObj.photoURL = newPhotoUrl;
                }

                await updateProfile(currentUser, profileUpdateObj);

                // 📌 บันทึกข้อมูลไปยัง Collection Target (admins หรือ users)
                const docRef = doc(db, userRoleCollection, currentUser.uid);
                await setDoc(docRef, {
                    displayName: newName,
                    photoURL: newPhotoUrl || currentUser.photoURL || "",
                    email: currentUser.email,
                    updatedAt: new Date().toISOString()
                }, { merge: true });

                userNameDisplay.textContent = `ชื่อผู้ใช้: ${newName}`;
                if (newPhotoUrl && userAvatar) {
                    userAvatar.src = newPhotoUrl;
                }

                if (editAvatarFile) editAvatarFile.value = "";
                if (fileNameDisplay) fileNameDisplay.textContent = "ยังไม่ได้เลือกไฟล์";

                alert("🎉 บันทึกข้อมูลโปรไฟล์ของคุณสำเร็จแล้ว!");
                window.location.reload();

            } catch (error) {
                console.error("Save Profile Error: ", error);
                alert("❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง");
            } finally {
                saveProfileBtn.disabled = false;
                saveProfileBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> บันทึกการเปลี่ยนแปลง`;
            }
        });
    }

    // ปุ่มสลับสีพื้นหลัง
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

    // 🗑️ ลบบัญชีผู้ใช้พร้อมลบเอกสารใน Collection ที่ตรงกัน (admins หรือ users)
    if (finalDeleteBtn && deleteConfirmInput && deleteModal) {
        finalDeleteBtn.addEventListener("click", async () => {
            if (!currentUser) return;
            const userEmail = currentUser.email;
            const userInput = deleteConfirmInput.value.trim();

            if (userInput !== userEmail) {
                alert("❌ อีเมลไม่ถูกต้อง! กรุณาตรวจสอบและพิมพ์ใหม่อีกครั้ง");
                return;
            }

            const finalConfirm = confirm("ยืนยันครั้งสุดท้ายจริง ๆ นะครับ? ระบบจะลบข้อมูลและผลงานของคุณทั้งหมดทันที");
            if (finalConfirm) {
                try {
                    finalDeleteBtn.disabled = true;
                    finalDeleteBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังลบข้อมูล...`;

                    // ลบผลงานทั้งหมดของผู้ใช้ใน portfolios
                    const portfolioRef = collection(db, "portfolios");
                    const q = query(portfolioRef, where("userId", "==", currentUser.uid));
                    const querySnapshot = await getDocs(q);

                    if (!querySnapshot.empty) {
                        const batch = writeBatch(db);
                        querySnapshot.forEach((docSnap) => {
                            batch.delete(docSnap.ref);
                        });
                        await batch.commit();
                    }

                    // ลบเอกสารข้อมูลส่วนตัวตาม Collection (admins หรือ users)
                    await deleteDoc(doc(db, userRoleCollection, currentUser.uid));
                    
                    // ลบบัญชีจาก Firebase Authentication
                    await deleteUser(currentUser);

                    alert("🎉 ลบบัญชีผู้ใช้และผลงานทั้งหมดของคุณเรียบร้อยแล้ว");
                    window.location.href = "index.html";

                } catch (error) {
                    console.error("❌ Delete Account Error:", error);
                    if (error.code === 'auth/requires-recent-login') {
                        alert("⚠️ เพื่อความปลอดภัยสูง กรุณาลงชื่อออกแล้วเข้าสู่ระบบใหม่อีกครั้ง ก่อนทำการลบบัญชีครับ");
                    } else {
                        alert("❌ เกิดข้อผิดพลาดในการลบบัญชี: " + error.message);
                    }
                } finally {
                    finalDeleteBtn.disabled = false;
                    finalDeleteBtn.innerHTML = `ยืนยันลบบัญชี`;
                    deleteModal.style.display = "none";
                }
            }
        });
    }
});
