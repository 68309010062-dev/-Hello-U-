import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
// 🎯 ดึง storage ที่เซ็ตค่าแอปพลิเคชันเสร็จแล้วมาจาก config ของคุณโดยตรง
import { auth, db, storage } from "./firebase-config.js"; 

document.addEventListener("DOMContentLoaded", () => {
    let currentUserId = null;

    // 1. ดึง Elements หน้าจอ UI
    const userNameDisplay = document.getElementById("userNameDisplay");
    const portfolioCountDisplay = document.getElementById("portfolioCountDisplay");
    const userAvatar = document.getElementById("userAvatar");
    
    const addPortfolioBtn = document.getElementById("addPortfolioBtn");
    const floatingAddBtn = document.getElementById("floatingAddBtn");
    const uploadOptionsBox = document.getElementById("uploadOptionsBox");
    const settingsBtn = document.getElementById("settingsBtn");
    const optionItems = document.querySelectorAll(".option-item");
    const fileInputHidden = document.getElementById("fileInputHidden");

    // 2. 🔐 ตรวจสอบสถานะล็อกอิน
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("ล็อกอินสำเร็จด้วย UID:", user.uid);
            currentUserId = user.uid;
            
            try {
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);
                
                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    userNameDisplay.textContent = `ชื่อผู้ใช้: ${userData.displayName || user.displayName || 'ผู้ใช้ทั่วไป'}`;
                    portfolioCountDisplay.textContent = `จำนวนผลงาน: ${userData.portfolioCount || 0} ชิ้น`;
                } else {
                    userNameDisplay.textContent = `ชื่อผู้ใช้: ${user.displayName || 'กำลังโหลดข้อมูล...'}`;
                    portfolioCountDisplay.textContent = `จำนวนผลงาน: 0 ชิ้น`;
                }
            } catch (error) {
                console.error("เกิดข้อผิดพลาดในการดึงข้อมูลโปรไฟล์:", error);
            }

            if (user.photoURL && userAvatar) {
                userAvatar.src = user.photoURL;
            }
        } else {
            window.location.href = "index.html";
        }
    });

    // 🗄️ ฟังก์ชันเซฟข้อมูลลง Firestore คอลเลกชัน portfolios
    async function savePortfolioToFirebase(type, title, content) {
        if (!currentUserId) return;
        try {
            const portfolioRef = collection(db, "portfolios");
            await addDoc(portfolioRef, {
                userId: currentUserId,
                type: type,         
                title: title,       
                content: content,   
                createdAt: serverTimestamp() 
            });
            console.log(`[Firestore] บันทึกผลงานสำเร็จ: ${title}`);
        } catch (error) {
            console.error("[Firestore Error] บันทึกข้อมูลล้มเหลว:", error);
        }
    }

    // 3. ฟังก์ชันเปิด-ปิดเมนูตัวเลือก
    function toggleUploadOptions() {
        if (uploadOptionsBox.style.display === "none" || uploadOptionsBox.style.display === "") {
            uploadOptionsBox.style.display = "block";
            uploadOptionsBox.scrollIntoView({ behavior: "smooth" });
        } else {
            uploadOptionsBox.style.display = "none";
        }
    }

    if (addPortfolioBtn) addPortfolioBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleUploadOptions(); });
    if (floatingAddBtn) floatingAddBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleUploadOptions(); });

    // 4. ตัวรับคำสั่งเมื่อเลือกประเภท
    optionItems.forEach(item => {
        item.addEventListener("click", function() {
            const uploadType = this.getAttribute("data-type");
            uploadOptionsBox.style.display = "none"; 
            
            if (uploadType === "file") {
                if (fileInputHidden) {
                    console.log("กำลังเปิดหน้าต่างเลือกไฟล์...");
                    fileInputHidden.click(); // สั่งเปิดหน้าต่างเลือกไฟล์
                }
            } else if (uploadType === "link") {
                savePortfolioToFirebase("link", "ลิงก์ผลงานด่วน", "https://example.com");
            } else if (uploadType === "drive") {
                savePortfolioToFirebase("drive", "กูเกิลไดรฟ์ด่วน", "https://drive.google.com");
            }
        });
    });

    // 🔥 5. ดักฟังเมื่อเลือกไฟล์เสร็จ -> ส่งขึ้น Cloud Storage ทันที
    if (fileInputHidden) {
        fileInputHidden.addEventListener("change", async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            if (!currentUserId || !storage) {
                console.error("อัปโหลดไม่ได้: ระบบตรวจไม่พบรหัสผู้ใช้หรือตัวแปร storage ขาดหายไป");
                return;
            }

            const title = file.name; 
            console.log(`[Storage] เริ่มอัปโหลดไฟล์: ${title}`);

            try {
                // อัปโหลดไฟล์ดิบเข้าโฟลเดอร์แยกตาม UID ผู้ใช้
                const storageRef = ref(storage, `portfolios/${currentUserId}/${Date.now()}_${file.name}`);
                const snapshot = await uploadBytes(storageRef, file);
                
                // ดึง URL ลิงก์ไฟล์
                const downloadURL = await getDownloadURL(snapshot.ref);
                console.log("[Storage] สำเร็จ! ได้ URL ลิงก์ไฟล์แล้ว");

                // บันทึกต่อเข้าสู่ฐานข้อมูล Firestore
                await savePortfolioToFirebase("file", title, downloadURL);

            } catch (error) {
                console.error("[Storage Error] เกิดปัญหาระหว่างส่งไฟล์ขึ้นคลาวด์:", error);
            } finally {
                fileInputHidden.value = ""; // รีเซ็ตอินพุตให้เลือกใหม่ได้เรื่อยๆ
            }
        });
    }

    // คลิกด้านนอกปิดเมนู
    document.addEventListener("click", (event) => {
        if (uploadOptionsBox && uploadOptionsBox.style.display === "block") {
            const isClickInside = uploadOptionsBox.contains(event.target) || 
                                  (addPortfolioBtn && addPortfolioBtn.contains(event.target)) || 
                                  (floatingAddBtn && floatingAddBtn.contains(event.target));
            if (!isClickInside) uploadOptionsBox.style.display = "none";
        }
    });
});
