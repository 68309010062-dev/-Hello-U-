import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase-config.js"; // ดึงตัวแปรสำเร็จรูปมาจากไฟล์ config ของคุณ

document.addEventListener("DOMContentLoaded", () => {
    // 1. ดึง Elements หน้าจอ UI
    const userNameDisplay = document.getElementById("userNameDisplay");
    const portfolioCountDisplay = document.getElementById("portfolioCountDisplay");
    const userAvatar = document.getElementById("userAvatar");
    
    const addPortfolioBtn = document.getElementById("addPortfolioBtn");
    const floatingAddBtn = document.getElementById("floatingAddBtn");
    const uploadOptionsBox = document.getElementById("uploadOptionsBox");
    const settingsBtn = document.getElementById("settingsBtn");
    const optionItems = document.querySelectorAll(".option-item");

    // 2. 🔐 ดักฟังสถานะล็อกอิน และดึงข้อมูลจากคอลเลกชัน "users" ใน Firestore
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("ล็อกอินสำเร็จด้วย UID:", user.uid);
            
            try {
                // ชี้ไปยังเอกสารของ user คนนั้นในคอลเลกชัน users โดยใช้ UID เป็นตัวระบุ
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);
                
                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    
                    // ดึงค่า displayName จาก Firestore (เช่น "lol") มาแสดงผล
                    userNameDisplay.textContent = `ชื่อผู้ใช้: ${userData.displayName || user.displayName || 'ผู้ใช้ทั่วไป'}`;
                    
                    // ดึงจำนวนผลงาน (หากยังไม่มีระบบนับในฟิลด์ ให้ตั้ง default เป็น 0 ไปก่อน)
                    portfolioCountDisplay.textContent = `จำนวนผลงาน: ${userData.portfolioCount || 0} ชิ้น`;
                } else {
                    // หากยังไม่ได้เซฟเอกสารลง Firestore ให้ดึงข้อมูลเบื้องต้นจากระบบ Auth มาขัดตาทัพก่อน
                    userNameDisplay.textContent = `ชื่อผู้ใช้: ${user.displayName || 'กำลังโหลดข้อมูล...'}`;
                    portfolioCountDisplay.textContent = `จำนวนผลงาน: 0 ชิ้น`;
                }
            } catch (error) {
                console.error("เกิดข้อผิดพลาดในการดึงข้อมูล:", error);
                userNameDisplay.textContent = `ชื่อผู้ใช้: ${user.displayName || 'พบข้อผิดพลาดในการโหลด'}`;
            }

            // ถ้าผู้ใช้มีรูปโปรไฟล์ (เช่น เข้าด้วย Google) ให้แสดงรูปแทนไอคอนว่างๆ
            if (user.photoURL && userAvatar) {
                userAvatar.src = user.photoURL;
            }
        } else {
            // ป้องกันแอบเข้าหน้าหลักโดยไม่ล็อกอิน -> สั่งเด้งกลับหน้า Login ทันที
            console.log("ตรวจพบว่ายังไม่ได้เข้าสู่ระบบ ย้ายหน้ากลับ...");
            window.location.href = "index.html";
        }
    });

    // 3. ฟังก์ชันเปิด-ปิดเมนูตัวเลือกอัปโหลด (+เพิ่มผลงาน)
    function toggleUploadOptions() {
        if (uploadOptionsBox.style.display === "none" || uploadOptionsBox.style.display === "") {
            uploadOptionsBox.style.display = "block";
            uploadOptionsBox.scrollIntoView({ behavior: "smooth" });
        } else {
            uploadOptionsBox.style.display = "none";
        }
    }

    // ผูก Event ตัวเปิดเมนูเข้ากับปุ่มทั้ง 2 จุด
    if (addPortfolioBtn) {
        addPortfolioBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleUploadOptions();
        });
    }

    if (floatingAddBtn) {
        floatingAddBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleUploadOptions();
        });
    }

    // 4. ตัวรับคำสั่งจากการเลือกช่องทางอัปโหลดผลงาน
    optionItems.forEach(item => {
        item.addEventListener("click", function() {
            const uploadType = this.getAttribute("data-type");
            console.log(`เลือกอัปโหลดประเภท: ${uploadType}`);
            
            if (uploadType === "file") {
                alert("📂 ระบบกำลังเปิดหน้าต่างเลือกไฟล์ของคุณ...");
            } else if (uploadType === "link") {
                alert("🔗 ระบบกำลังเปิดกล่องบันทึกลิงก์ภายนอก...");
            } else if (uploadType === "drive") {
                alert("🤖 ระบบกำลังเรียกการเข้าถึง Google Drive...");
            }
            
            uploadOptionsBox.style.display = "none"; // ทำงานเสร็จให้พับเมนูเก็บลงไป
        });
    });

    // 5. ปุ่มฟันเฟืองสำหรับตั้งค่าโปรไฟล์
    if (settingsBtn) {
        settingsBtn.addEventListener("click", () => {
            alert("⚙️ กำลังพาคุณไปยังหน้าตั้งค่าโปรไฟล์และตั้งค่าระบบ...");
        });
    }

    // 6. คลิกนอกขอบเขตกล่องเมนูตัวเลือก ให้ตัวเลือกปิดตัวลงอัตโนมัติ (UX ที่ดีสำหรับมือถือ)
    document.addEventListener("click", (event) => {
        if (uploadOptionsBox && uploadOptionsBox.style.display === "block") {
            const isClickInside = uploadOptionsBox.contains(event.target) || 
                                  (addPortfolioBtn && addPortfolioBtn.contains(event.target)) || 
                                  (floatingAddBtn && floatingAddBtn.contains(event.target));
            
            if (!isClickInside) {
                uploadOptionsBox.style.display = "none";
            }
        }
    });
});
