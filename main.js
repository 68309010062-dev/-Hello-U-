import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { auth, db } from "./firebase-config.js";

document.addEventListener("DOMContentLoaded", () => {
    let currentUserId = null;
    const storage = getStorage();

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

    // 2. 🔐 ดักฟังสถานะล็อกอิน และดึงข้อมูลจากคอลเลกชัน "users" ใน Firestore
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
                console.error("เกิดข้อผิดพลาดในการดึงข้อมูล:", error);
                userNameDisplay.textContent = `ชื่อผู้ใช้: ${user.displayName || 'พบข้อผิดพลาดในการโหลด'}`;
            }

            if (user.photoURL && userAvatar) {
                userAvatar.src = user.photoURL;
            }
        } else {
            console.log("ตรวจพบว่ายังไม่ได้เข้าสู่ระบบ ย้ายหน้ากลับ...");
            window.location.href = "index.html";
        }
    });

    // ➕ ฟังก์ชันแชร์สำหรับเซฟบันทึกข้อมูลรายละเอียดโปรเจกต์ลงฐานข้อมูล Firestore
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
            console.log(`บันทึกข้อมูลผลงานประเภท ${type} เรียบร้อยแล้ว`);
        } catch (error) {
            console.error("เกิดข้อผิดพลาดในการบันทึกข้อมูลลง Firestore:", error);
        }
    }

    // 3. ฟังก์ชันเปิด-ปิดเมนูตัวเลือกอัปโหลด (+เพิ่มผลงาน)
    function toggleUploadOptions() {
        if (uploadOptionsBox.style.display === "none" || uploadOptionsBox.style.display === "") {
            uploadOptionsBox.style.display = "block";
            uploadOptionsBox.scrollIntoView({ behavior: "smooth" });
        } else {
            uploadOptionsBox.style.display = "none";
        }
    }

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

    // 4. ตัวรับคำสั่งจากการเลือกช่องทางอัปโหลดผลงาน (นำ Alert/Prompt ที่ไม่จำเป็นออกแล้ว)
    optionItems.forEach(item => {
        item.addEventListener("click", async function() {
            const uploadType = this.getAttribute("data-type");
            console.log(`เลือกอัปโหลดประเภท: ${uploadType}`);
            uploadOptionsBox.style.display = "none"; // ทำงานเสร็จให้พับเมนูเก็บลงไปทันที
            
            if (uploadType === "file") {
                if (fileInputHidden) {
                    fileInputHidden.click(); // เรียกเปิดหน้าต่างเลือกไฟล์จากเครื่องทันที
                }
            } else if (uploadType === "link") {
                // สำหรับ Link และ Drive สามารถใช้รับค่าจาก Clipboard หรือผูกกับ UI Input Box ในอนาคตได้ 
                // ตอนนี้เซ็ตให้บันทึกเป็นชื่อดีฟอลต์แบบด่วนไปก่อน
                await savePortfolioToFirebase("link", "ลิงก์ผลงานใหม่", "https://example.com");
            } else if (uploadType === "drive") {
                await savePortfolioToFirebase("drive", "กูเกิลไดรฟ์ใหม่", "https://drive.google.com");
            }
        });
    });

    // ➕ ดักฟังเมื่อทำการเลือกไฟล์เสร็จสิ้น -> อัปโหลดขึ้น Cloud Storage ทันทีโดยใช้ชื่อไฟล์เป็นชื่อผลงาน
    if (fileInputHidden) {
        fileInputHidden.addEventListener("change", async (event) => {
            const file = event.target.files[0];
            if (!file || !currentUserId) return;

            // ใช้ชื่อไฟล์จริงจากเครื่องเป็นชื่อผลงานอัตโนมัติ ไม่ต้องเด้งถาม
            const title = file.name; 
            console.log(`เริ่มอัปโหลดไฟล์: ${title}`);

            try {
                // บันทึกไฟล์แยกโฟลเดอร์ตาม UID และเพิ่ม timestamp ป้องกันชื่อไฟล์ซ้ำกัน
                const storageRef = ref(storage, `portfolios/${currentUserId}/${Date.now()}_${file.name}`);
                const snapshot = await uploadBytes(storageRef, file);
                const downloadURL = await getDownloadURL(snapshot.ref);

                // นำข้อมูลลิงก์ที่ได้ไปสร้างเอกสารบันทึกในคอลเลกชัน Firestore ต่อทันที
                await savePortfolioToFirebase("file", title, downloadURL);

            } catch (error) {
                console.error("กระบวนการอัปโหลดไฟล์ล้มเหลว:", error);
            } finally {
                fileInputHidden.value = ""; // เคลียร์ค่าเพื่อให้สามารถกดอัปโหลดซ้ำไฟล์เดิมได้
            }
        });
    }

    // 5. ปุ่มฟันเฟืองสำหรับตั้งค่าโปรไฟล์
    if (settingsBtn) {
        settingsBtn.addEventListener("click", () => {
            console.log("เข้าสู่หน้าตั้งค่าระบบ...");
            // สามารถใส่คำสั่ง window.location.href = "settings.html"; เพื่อเปลี่ยนหน้าในอนาคตได้
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
