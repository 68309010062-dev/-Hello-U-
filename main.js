import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, collection, addDoc, query, where, getDocs, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

document.addEventListener("DOMContentLoaded", () => {
    let currentUserId = null;
    let localPortfoliosRaw = []; // 📦 อาเรย์สำหรับเก็บข้อมูลผลงานที่ดึงมาจาก Firebase เพื่อนำไปกรองและค้นหาในฝั่ง Client
    let currentFilter = "all";   // 📂 สถานะตัวกรองปัจจุบัน (all / file / link)
    let searchKeyword = "";      // 🔍 คำค้นหาปัจจุบัน

    const userNameDisplay = document.getElementById("userNameDisplay");
    const portfolioCountDisplay = document.getElementById("portfolioCountDisplay");
    const userAvatar = document.getElementById("userAvatar");
    
    const addPortfolioBtn = document.getElementById("addPortfolioBtn");
    const floatingAddBtn = document.getElementById("floatingAddBtn");
    const uploadOptionsBox = document.getElementById("uploadOptionsBox");
    const optionItems = document.querySelectorAll(".option-item");
    const fileInputHidden = document.getElementById("fileInputHidden");
    const portfolioContainer = document.getElementById("portfolioContainer");

    const searchPortfolioInput = document.getElementById("searchPortfolioInput");
    const filterTabBtns = document.querySelectorAll(".filter-tab-btn");

    const previewModal = document.getElementById("previewModal");
    const modalContentArea = document.getElementById("modalContentArea");
    const closeModalBtn = document.getElementById("closeModalBtn");
    const modalDownloadBtn = document.getElementById("modalDownloadBtn");
    const settingsBtn = document.getElementById("settingsBtn");

    let scale = 1; let pointX = 0; let pointY = 0; let startX = 0; let startY = 0;
    let isPanning = false; let evCache = []; let prevDiff = -1;

    // ✨ ฟังก์ชันปรับให้ปุ่ม "จาง/สว่าง" ขึ้นตอน Hover
    function addButtonHoverEffect(btn, originalBg, hoverBg) {
        if (!btn) return;
        btn.style.transition = "all 0.2s ease-in-out";
        btn.style.opacity = "0.85";
        
        btn.onmouseenter = () => {
            if (hoverBg) btn.style.background = hoverBg;
            btn.style.opacity = "1";
        };
        
        btn.onmouseleave = () => {
            if (originalBg) btn.style.background = originalBg;
            btn.style.opacity = "0.85";
        };
    }

   // 🎨 ฟังก์ชันอัปเดตธีมสีหน้าหลักให้แมตช์กับสีพื้นหลัง
    function applyGlobalTheme(color) {
        document.body.style.background = color;
        const cards = portfolioContainer ? portfolioContainer.querySelectorAll(".portfolio-card-item") : [];
        const filterBtns = document.querySelectorAll(".filter-tab-btn");
        
        // ดึง Elements ส่วนช่องค้นหามาจัดการสี
        const searchInput = document.getElementById("searchPortfolioInput");
        const searchIcon = document.querySelector(".fa-magnifying-glass");
        
        if (color === "#ffffff") {
            document.body.style.color = "#1a202c";
            
            // 👤 ปรับข้อความหัวเว็บให้เป็นสีดำเข้มชัดเจน
            if (userNameDisplay) userNameDisplay.style.color = "#000000";
            if (portfolioCountDisplay) portfolioCountDisplay.style.color = "#000000";
            
            // 🔍 ปรับแต่งช่องค้นหา (Search Input) ให้เห็นตัวอักษรสีดำตอนพิมพ์
            if (searchInput) {
                searchInput.style.background = "#f7fafc";
                searchInput.style.color = "#000000";
                searchInput.style.borderColor = "#cbd5e0";
            }
            if (searchIcon) {
                searchIcon.style.color = "#4a5568";
            }

            const titles = document.querySelectorAll(".page-title, .upload-options-box h3");
            titles.forEach(t => t.style.color = "#1a202c");

            // ⚙️ ปรับปุ่มเฟืองตั้งค่า
            if (settingsBtn) {
                settingsBtn.style.color = "#1a202c";
                settingsBtn.style.background = "rgba(0, 0, 0, 0.05)";
            }

            // 📂 ปรับแต่งปุ่มกลุ่มฟิลเตอร์ (หมวดหมู่) สำหรับธีมสีขาว
            filterBtns.forEach(btn => {
                if (btn.classList.contains("active")) {
                    btn.style.background = "#2b6cb0";
                    btn.style.color = "#ffffff";
                    btn.style.borderColor = "#2b6cb0";
                } else {
                    btn.style.background = "#edf2f7";
                    btn.style.color = "#4a5568";
                    btn.style.borderColor = "#cbd5e0";
                }
            });

            if (addPortfolioBtn) {
                addPortfolioBtn.style.background = "#2b6cb0"; 
                addPortfolioBtn.style.color = "#ffffff";
                addButtonHoverEffect(addPortfolioBtn, "#2b6cb0", "#1d4ed8");
            }
            if (floatingAddBtn) {
                floatingAddBtn.style.background = "#2b6cb0";
                floatingAddBtn.style.color = "#ffffff";
                addButtonHoverEffect(floatingAddBtn, "#2b6cb0", "#1d4ed8");
            }
            if (uploadOptionsBox) {
                uploadOptionsBox.style.background = "#ffffff";
                uploadOptionsBox.style.color = "#1a202c";
                uploadOptionsBox.style.boxShadow = "0 10px 25px rgba(0,0,0,0.15)";
                uploadOptionsBox.style.border = "1px solid #e2e8f0";
            }

            cards.forEach(card => {
                card.style.background = "rgba(0, 0, 0, 0.04)";
                card.style.color = "#1a202c";
                card.style.border = "1px solid rgba(0, 0, 0, 0.08)";
            });
        } else {
            // 🌌 สำหรับธีมมืด (สีเดิม)
            document.body.style.color = "white";
            if (userNameDisplay) userNameDisplay.style.color = "white";
            if (portfolioCountDisplay) portfolioCountDisplay.style.color = "white";
            
            // คืนค่าช่องค้นหาสำหรับธีมมืด
            if (searchInput) {
                searchInput.style.background = "rgba(255,255,255,0.1)";
                searchInput.style.color = "white";
                searchInput.style.borderColor = "rgba(255,255,255,0.2)";
            }
            if (searchIcon) {
                searchIcon.style.color = "rgba(255,255,255,0.5)";
            }

            const titles = document.querySelectorAll(".page-title, .upload-options-box h3");
            titles.forEach(t => t.style.color = "white");

            if (settingsBtn) {
                settingsBtn.style.color = "white";
                settingsBtn.style.background = "transparent";
            }

            filterBtns.forEach(btn => {
                if (btn.classList.contains("active")) {
                    btn.style.background = "rgba(255, 255, 255, 0.2)";
                    btn.style.color = "white";
                    btn.style.borderColor = "rgba(255, 255, 255, 0.2)";
                } else {
                    btn.style.background = "rgba(255, 255, 255, 0.05)";
                    btn.style.color = "rgba(255, 255, 255, 0.7)";
                    btn.style.borderColor = "rgba(255, 255, 255, 0.1)";
                }
            });

            if (addPortfolioBtn) {
                addPortfolioBtn.style.background = "rgba(255, 255, 255, 0.2)";
                addPortfolioBtn.style.color = "white";
                addButtonHoverEffect(addPortfolioBtn, "rgba(255, 255, 255, 0.2)", "rgba(255, 255, 255, 0.3)");
            }
            if (floatingAddBtn) {
                floatingAddBtn.style.background = "rgba(255, 255, 255, 0.2)";
                floatingAddBtn.style.color = "white";
                addButtonHoverEffect(floatingAddBtn, "rgba(255, 255, 255, 0.2)", "rgba(255, 255, 255, 0.3)");
            }
            if (uploadOptionsBox) {
                uploadOptionsBox.style.background = "rgba(255, 255, 255, 0.1)";
                uploadOptionsBox.style.color = "white";
                uploadOptionsBox.style.boxShadow = "none";
                uploadOptionsBox.style.border = "none";
            }

            cards.forEach(card => {
                card.style.background = "rgba(255, 255, 255, 0.08)";
                card.style.color = "white";
                card.style.border = "1px solid rgba(255, 255, 255, 0.1)";
            });
        }

        if (closeModalBtn) addButtonHoverEffect(closeModalBtn, "transparent", "rgba(255,255,255,0.1)");
        if (modalDownloadBtn) addButtonHoverEffect(modalDownloadBtn, "#4a5568", "#2d3748");
        if (settingsBtn) addButtonHoverEffect(settingsBtn, "transparent", "transparent");
    }

    // 🔄 ระบบดักฟัง Real-time ข้ามหน้าต่าง
    window.addEventListener('storage', (e) => {
        if (e.key === 'userBackground') {
            const newColor = e.newValue || "linear-gradient(180deg, #0f0c1b 0%, #bd00ff 100%)";
            applyGlobalTheme(newColor);
            loadPortfolios(); 
        }
    });

    const savedBg = localStorage.getItem("userBackground") || "linear-gradient(180deg, #0f0c1b 0%, #bd00ff 100%)";
    
    if (settingsBtn) {
        settingsBtn.addEventListener("click", () => {
            window.location.href = "settings.html";
        });
    }

    applyGlobalTheme(savedBg);

    // ตรวจสอบสถานะล็อกอิน
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserId = user.uid;
            try {
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    userNameDisplay.textContent = `ชื่อผู้ใช้: ${userDocSnap.data().displayName || user.displayName || 'ผู้ใช้ทั่วไป'}`;
                } else {
                    userNameDisplay.textContent = `ชื่อผู้ใช้: ${user.displayName || 'กำลังโหลด...'}`;
                }
            } catch (error) { userNameDisplay.textContent = `ชื่อผู้ใช้: ${user.displayName || 'พบข้อผิดพลาด'}`; }
            if (user.photoURL && userAvatar) userAvatar.src = user.photoURL;
            loadPortfolios();
        } else { window.location.href = "index.html"; }
    });

    // 🔄 ฟังก์ชันสำหรับดึงข้อมูลจาก Firebase และตรวจสอบเงื่อนไขจำนวนผลงานเพื่อซ่อนปุ่มเพิ่มผลงาน
    async function loadPortfolios() {
        if (!currentUserId || !portfolioContainer) return;
        try {
            const currentTheme = localStorage.getItem("userBackground") || "linear-gradient(180deg, #0f0c1b 0%, #bd00ff 100%)";
            const loadingColor = currentTheme === "#ffffff" ? "#2d3748" : "white";
            
            portfolioContainer.innerHTML = `<p style='color: ${loadingColor}; text-align: center; opacity: 0.7;'>กำลังดึงรายการผลงาน...</p>`;
            
            const portfolioRef = collection(db, "portfolios");
            const q = query(portfolioRef, where("userId", "==", currentUserId));
            const querySnapshot = await getDocs(q);

            localPortfoliosRaw = [];
            querySnapshot.forEach((docItem) => {
                localPortfoliosRaw.push({
                    id: docItem.id,
                    ...docItem.data()
                });
            });

            const totalCount = localPortfoliosRaw.length;

// 1. ปุ่มบน (addPortfolioBtn): ถ้ามีผลงาน >= 1 ชิ้นให้ซ่อนทันที
if (totalCount >= 1) {
    if (addPortfolioBtn) addPortfolioBtn.style.display = "none";
} else {
    if (addPortfolioBtn) addPortfolioBtn.style.display = "flex";
}

// 2. ปุ่มล่าง (floatingAddBtn): เปิดให้แสดงผลไว้ตลอดเวลา ไม่ว่าจะเก็บผลงานไว้กี่ชิ้นก็ตาม
if (floatingAddBtn) floatingAddBtn.style.display = "flex";

            portfolioCountDisplay.textContent = `จำนวนผลงาน: ${totalCount} ชิ้น`;
            
            // สั่งให้เรนเดอร์เนื้อหาการค้นหาและฟิลเตอร์บนหน้าจอ
            renderFilteredPortfolios();

        } catch (error) { console.error(error); }
    }

    // 🎯 ฟังก์ชันคำนวณ Filter และช่องค้นหา แล้ววาด Card ลงบนหน้าจอ
    function renderFilteredPortfolios() {
        if (!portfolioContainer) return;
        portfolioContainer.innerHTML = "";
        
        const currentTheme = localStorage.getItem("userBackground") || "linear-gradient(180deg, #0f0c1b 0%, #bd00ff 100%)";

        // กรองตามประเภท (ทั้งหมด / ไฟล์ / ลิงก์) และ กรองด้วยคีย์เวิร์ดในช่องค้นหาพร้อมกัน
        const filteredList = localPortfoliosRaw.filter(item => {
            const matchType = (currentFilter === "all") || (item.type === currentFilter);
            const matchSearch = item.title.toLowerCase().includes(searchKeyword.toLowerCase());
            return matchType && matchSearch;
        });

        if (filteredList.length === 0) {
            const emptyColor = currentTheme === "#ffffff" ? "#718096" : "#a0aec0";
            portfolioContainer.innerHTML = `<p style='color: ${emptyColor}; text-align: center; font-size: 14px;'>ไม่พบผลงานที่ตรงตามเงื่อนไข</p>`;
            return;
        }

        filteredList.forEach((data) => {
            const docId = data.id;
            const card = document.createElement("div");
            card.classList.add("portfolio-card-item");
            
            if (currentTheme === "#ffffff") {
                card.style.background = "rgba(0, 0, 0, 0.05)";
                card.style.color = "#1a202c";
                card.style.border = "1px solid rgba(0, 0, 0, 0.1)";
            } else {
                card.style.background = "rgba(255, 255, 255, 0.08)";
                card.style.color = "white";
                card.style.border = "1px solid rgba(255, 255, 255, 0.1)";
            }
            
            card.style.padding = "15px";
            card.style.borderRadius = "12px";
            card.style.display = "flex";
            card.style.alignItems = "center";
            card.style.justifyContent = "space-between";
            card.style.transition = "background 0.3s ease, color 0.3s ease"; 

            let actionButton = "";
            let typeIcon = "";

            if (data.fileType && data.fileType.startsWith("image/")) {
                typeIcon = `<img src="${data.content}" style="width: 42px; height: 42px; object-fit: cover; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2)"/>`;
                actionButton = `<button class="view-file-btn" data-id="${docId}" style="background: #4a5568; color: white; padding: 6px 12px; border: none; border-radius: 6px; font-size: 13px; font-weight: bold; margin-right: 8px; cursor: pointer;"><i class="fa-solid fa-eye"></i> ดูรูปภาพ</button>`;
            } else {
                typeIcon = `<i class="fa-solid fa-link" style="font-size: 20px; color: #4299e1;"></i>`;
                actionButton = `<a class="view-link-btn" href="${data.content}" target="_blank" style="background: #2b6cb0; color: white; padding: 6px 12px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: bold; margin-right: 8px; display: inline-block;"><i class="fa-solid fa-arrow-up-right-from-square"></i> เปิดลิงก์</a>`;
            }

            card.innerHTML = `
                <div style="display: flex; align-items: center; gap: 15px; width: 65%;">
                    <div style="display: flex; align-items: center; justify-content: center; width: 45px;">${typeIcon}</div>
                    <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%;">
                        <strong style="display: block; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${data.title}</strong>
                    </div>
                </div>
                <div style="display: flex; align-items: center;">
                    ${actionButton}
                    <button class="delete-portfolio-btn" data-id="${docId}" style="background: transparent; color: #fc8181; border: none; padding: 6px; cursor: pointer; font-size: 16px;">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;
            portfolioContainer.appendChild(card);
        });

        // เปิดระบบเอฟเฟกต์ปุ่ม Hover ให้ทำงานต่อเนื่อง
        document.querySelectorAll(".view-file-btn").forEach(btn => addButtonHoverEffect(btn, "#4a5568", "#2d3748"));
        document.querySelectorAll(".view-link-btn").forEach(btn => addButtonHoverEffect(btn, "#2b6cb0", "#1d4ed8"));
        document.querySelectorAll(".delete-portfolio-btn").forEach(btn => addButtonHoverEffect(btn, "transparent", "transparent"));

        // ผูกสคริปต์ปุ่มคลิกดูภาพไฟล์พรีวิว
        document.querySelectorAll(".view-file-btn").forEach(btn => {
            btn.addEventListener("click", function() {
                const idToView = this.getAttribute("data-id");
                const targetData = localPortfoliosRaw.find(d => d.id === idToView);
                if (targetData && previewModal && modalContentArea) {
                    modalContentArea.innerHTML = "";
                    scale = 1; pointX = 0; pointY = 0; evCache = []; prevDiff = -1;

                    if (modalDownloadBtn) {
                        modalDownloadBtn.href = targetData.content;
                        modalDownloadBtn.setAttribute("download", targetData.title);
                        modalDownloadBtn.style.display = "flex"; 
                    }

                    modalContentArea.innerHTML = `<img id="zoomable-img" src="${targetData.content}" style="max-width: 100%; max-height: 100%; object-fit: contain; transform: translate(0px, 0px) scale(1); transform-origin: center; cursor: grab; user-select: none; transition: transform 0.1s ease-out;" draggable="false" />`;
                    initZoomAndPan();
                    previewModal.style.display = "flex";
                }
            });
        });

        // ผูกสคริปต์ลบผลงานแยกชิ้น
        document.querySelectorAll(".delete-portfolio-btn").forEach(btn => {
            btn.addEventListener("click", async function() {
                const idToDelete = this.getAttribute("data-id");
                if (confirm("คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?")) {
                    try {
                        await deleteDoc(doc(db, "portfolios", idToDelete));
                        loadPortfolios(); 
                    } catch (err) { console.error(err); }
                }
            });
        });
    }

    // 🔍 ผูกระบบช่องค้นหาผลงาน (พิมพ์แล้วกรองทันที)
    if (searchPortfolioInput) {
        searchPortfolioInput.addEventListener("input", (e) => {
            searchKeyword = e.target.value;
            renderFilteredPortfolios();
        });
    }

    // 📂 ผูกระบบแท็บกดเลือกเมนูตัวกรอง (ทั้งหมด / ไฟล์ / ลิงก์)
    filterTabBtns.forEach(btn => {
        btn.addEventListener("click", function() {
            filterTabBtns.forEach(b => b.classList.remove("active"));
            this.classList.add("active");
            
            currentFilter = this.getAttribute("data-filter");
            
            // สั่งคำนวณสีปุ่มใหม่ตามธีมปัจจุบันทันทีหลังคลิก
            const currentTheme = localStorage.getItem("userBackground") || "linear-gradient(180deg, #0f0c1b 0%, #bd00ff 100%)";
            applyGlobalTheme(currentTheme);
            
            renderFilteredPortfolios();
        });
    });

    // ฟังก์ชันซูมรูปภาพ เข้า-ออก
    function initZoomAndPan() {
        const img = document.getElementById("zoomable-img");
        if (!img) return;
        const updateTransform = () => { img.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`; };
        modalContentArea.addEventListener("wheel", (e) => {
            e.preventDefault();
            const zoomSpeed = 0.1;
            if (e.deltaY < 0) { scale = Math.min(scale + zoomSpeed, 5); } 
            else { scale = Math.max(scale - zoomSpeed, 0.5); }
            updateTransform();
        }, { passive: false });
        img.addEventListener("pointerdown", (e) => {
            evCache.push(e);
            if (evCache.length === 1) {
                isPanning = true; img.style.cursor = "grabbing";
                startX = e.clientX - pointX; startY = e.clientY - pointY;
            }
        });
        img.addEventListener("pointermove", (e) => {
            const index = evCache.findIndex(ev => ev.pointerId === e.pointerId);
            if (index > -1) evCache[index] = e;
            if (evCache.length === 2) {
                isPanning = false;
                const curDiff = Math.hypot(evCache[0].clientX - evCache[1].clientX, evCache[0].clientY - evCache[1].clientY);
                if (prevDiff > 0) {
                    if (curDiff > prevDiff) { scale = Math.min(scale + 0.03, 5); } 
                    else if (curDiff < prevDiff) { scale = Math.max(scale - 0.03, 0.5); }
                    updateTransform();
                }
                prevDiff = curDiff;
            } else if (isPanning) {
                pointX = e.clientX - startX; pointY = e.clientY - startY;
                updateTransform();
            }
        });
        const stopPan = (e) => {
            const index = evCache.findIndex(ev => ev.pointerId === e.pointerId);
            if (index > -1) evCache.splice(index, 1);
            if (evCache.length < 2) prevDiff = -1;
            if (evCache.length === 0) { isPanning = false; img.style.cursor = "grab"; }
        };
        img.addEventListener("pointerup", stopPan);
        img.addEventListener("pointercancel", stopPan);
        img.addEventListener("pointerout", stopPan);
        img.addEventListener("pointerleave", stopPan);
    }

    if (previewModal && closeModalBtn) {
        const closePreview = () => {
            previewModal.style.display = "none";
            modalContentArea.innerHTML = "";
            if (modalDownloadBtn) { modalDownloadBtn.style.display = "none"; modalDownloadBtn.href = "#"; }
        };
        closeModalBtn.addEventListener("click", closePreview);
        previewModal.addEventListener("click", (e) => {
            if (e.target === previewModal || e.target === modalContentArea) { closePreview(); }
        });
    }

    // บันทึกข้อมูลลง Firebase
    async function savePortfolioToFirebase(type, title, content, fileType = null) {
        if (!currentUserId) return;
        try {
            const portfolioRef = collection(db, "portfolios");
            await addDoc(portfolioRef, {
                userId: currentUserId, type: type, title: title, content: content, fileType: fileType, createdAt: serverTimestamp() 
            });
            loadPortfolios();
        } catch (error) { alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล"); }
    }

    // ระบบบีบอัดรูปภาพอัตโนมัติก่อนบันทึก
    function compressImage(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    let width = img.width;
                    let height = img.height;

                    const MAX_WIDTH = 1200;
                    if (width > MAX_WIDTH) {
                        height = Math.round((height * MAX_WIDTH) / width);
                        width = MAX_WIDTH;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, width, height);

                    const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
                    resolve(compressedBase64);
                };
            };
        });
    }

    function toggleUploadOptions() {
        if (uploadOptionsBox.style.display === "none" || uploadOptionsBox.style.display === "") {
            uploadOptionsBox.style.display = "block";
            uploadOptionsBox.scrollIntoView({ behavior: "smooth" });
        } else { uploadOptionsBox.style.display = "none"; }
    }

    if (addPortfolioBtn) addPortfolioBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleUploadOptions(); });
    if (floatingAddBtn) floatingAddBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleUploadOptions(); });

    optionItems.forEach(item => {
        item.style.transition = "opacity 0.2s ease";
        item.style.opacity = "0.8";
        item.addEventListener("mouseenter", () => item.style.opacity = "1");
        item.addEventListener("mouseleave", () => item.style.opacity = "0.8");

        item.addEventListener("click", function() {
            const uploadType = this.getAttribute("data-type");
            uploadOptionsBox.style.display = "none"; 
            if (uploadType === "file") {
                if (fileInputHidden) fileInputHidden.click();
            } else if (uploadType === "link") {
                const url = prompt("กรุณากรอกลิงก์ผลงานของคุณ:", "https://");
                if (url) {
                    const titlePrompt = prompt("กรุณาตั้งชื่อลิงก์ผลงานนี้:", "ลิงก์ผลงานระบุ");
                    savePortfolioToFirebase("link", titlePrompt || "ลิงก์ผลงานระบุ", url);
                }
            }
        });
    });

    if (fileInputHidden) {
        fileInputHidden.setAttribute("accept", "image/*");
        fileInputHidden.addEventListener("change", async (event) => {
            const file = event.target.files[0];
            if (!file || !currentUserId) return;

            const title = file.name;
            const compressedData = await compressImage(file);
            await savePortfolioToFirebase("file", title, compressedData, "image/jpeg");
            
            fileInputHidden.value = ""; 
        });
    }

    document.addEventListener("click", (event) => {
        if (uploadOptionsBox && uploadOptionsBox.style.display === "block") {
            const isClickInside = uploadOptionsBox.contains(event.target) || (addPortfolioBtn && addPortfolioBtn.contains(event.target)) || (floatingAddBtn && floatingAddBtn.contains(event.target));
            if (!isClickInside) uploadOptionsBox.style.display = "none";
        }
    });
});
