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
        
        const searchInput = document.getElementById("searchPortfolioInput");
        const searchIcon = document.querySelector(".fa-magnifying-glass");
        
        if (color === "#ffffff") {
            document.body.style.color = "#1a202c";
            if (userNameDisplay) userNameDisplay.style.color = "#000000";
            if (portfolioCountDisplay) portfolioCountDisplay.style.color = "#000000";
            
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

            if (settingsBtn) {
                settingsBtn.style.color = "#1a202c";
                settingsBtn.style.background = "rgba(0, 0, 0, 0.05)";
            }

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
            document.body.style.color = "white";
            if (userNameDisplay) userNameDisplay.style.color = "white";
            if (portfolioCountDisplay) portfolioCountDisplay.style.color = "white";
            
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
                    if (userNameDisplay) userNameDisplay.textContent = `ชื่อผู้ใช้: ${userDocSnap.data().displayName || user.displayName || 'ผู้ใช้ทั่วไป'}`;
                } else {
                    if (userNameDisplay) userNameDisplay.textContent = `ชื่อผู้ใช้: ${user.displayName || 'กำลังโหลด...'}`;
                }
            } catch (error) { 
                if (userNameDisplay) userNameDisplay.textContent = `ชื่อผู้ใช้: ${user.displayName || 'พบข้อผิดพลาด'}`; 
            }
            if (user.photoURL && userAvatar) userAvatar.src = user.photoURL;
            loadPortfolios();
        } else { window.location.href = "index.html"; }
    });

    // 🔄 ดึงข้อมูลผลงาน
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

            if (totalCount >= 1) {
                if (addPortfolioBtn) addPortfolioBtn.style.display = "none";
            } else {
                if (addPortfolioBtn) addPortfolioBtn.style.display = "flex";
            }

            if (floatingAddBtn) floatingAddBtn.style.display = "flex";
            if (portfolioCountDisplay) portfolioCountDisplay.textContent = `จำนวนผลงาน: ${totalCount} ชิ้น`;
            
            renderFilteredPortfolios();

        } catch (error) { console.error(error); }
    }

    // 🎯 เรนเดอร์การ์ดผลงานลงหน้าจอ
    function renderFilteredPortfolios() {
        if (!portfolioContainer) return;
        portfolioContainer.innerHTML = "";
        
        const currentTheme = localStorage.getItem("userBackground") || "linear-gradient(180deg, #0f0c1b 0%, #bd00ff 100%)";

        const filteredList = localPortfoliosRaw.filter(item => {
            const matchType = (currentFilter === "all") || (item.type === currentFilter);
            // 🛠️ เพิ่ม .trim() ป้องกันกรณีพิมพ์เว้นวรรค
            const matchSearch = item.title.toLowerCase().includes(searchKeyword.trim().toLowerCase());
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

            if (data.type === "file") {
                const isImgFile = data.content.startsWith("data:image/");
                if (isImgFile) {
                    typeIcon = `<img src="${data.content}" style="width: 42px; height: 42px; object-fit: cover; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2)"/>`;
                } else {
                    typeIcon = `<i class="fa-solid fa-file-pdf" style="font-size: 28px; color: #fc8181;"></i>`;
                }
                actionButton = `<button class="view-file-btn" data-id="${docId}" style="background: #4a5568; color: white; padding: 6px 12px; border: none; border-radius: 6px; font-size: 13px; font-weight: bold; margin-right: 8px; cursor: pointer;"><i class="fa-solid fa-eye"></i> ตรวจสอบไฟล์</button>`;
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

        document.querySelectorAll(".view-file-btn").forEach(btn => addButtonHoverEffect(btn, "#4a5568", "#2d3748"));
        document.querySelectorAll(".view-link-btn").forEach(btn => addButtonHoverEffect(btn, "#2b6cb0", "#1d4ed8"));
        document.querySelectorAll(".delete-portfolio-btn").forEach(btn => addButtonHoverEffect(btn, "transparent", "transparent"));

        // ผูกปุ่มคลิกพรีวิวไฟล์ Base64
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

                    const isImage = targetData.content.startsWith("data:image/");

                    if (isImage) {
                        modalContentArea.innerHTML = `<img id="zoomable-img" src="${targetData.content}" style="max-width: 100%; max-height: 100%; object-fit: contain; transform: translate(0px, 0px) scale(1); transform-origin: center; cursor: grab; user-select: none; transition: transform 0.1s ease-out;" draggable="false" />`;
                        initZoomAndPan();
                    } else {
                        modalContentArea.innerHTML = `<object data="${targetData.content}" type="application/pdf" width="100%" height="100%" style="border-radius: 8px;"><p>ไม่สามารถแสดงพรีวิวได้ <a href="${targetData.content}" download="${targetData.title}">ดาวน์โหลดไฟล์ที่นี่</a></p></object>`;
                    }
                    
                    previewModal.style.display = "flex";
                }
            });
        });

        // ปุ่มลบรายการผลงาน
        document.querySelectorAll(".delete-portfolio-btn").forEach(btn => {
            btn.addEventListener("click", async function() {
                const idToDelete = this.getAttribute("data-id");
                if (confirm("คุณแน่ใจหรือไม่ว่าต้องการลบผลงานรายการนี้?")) {
                    try {
                        await deleteDoc(doc(db, "portfolios", idToDelete));
                        alert("🗑️ ลบผลงานสำเร็จ");
                        loadPortfolios(); 
                    } catch (err) { console.error(err); }
                }
            });
        });
    }

    if (searchPortfolioInput) {
        searchPortfolioInput.addEventListener("input", (e) => {
            searchKeyword = e.target.value;
            renderFilteredPortfolios();
        });
    }

    filterTabBtns.forEach(btn => {
        btn.addEventListener("click", function() {
            filterTabBtns.forEach(b => b.classList.remove("active"));
            this.classList.add("active");
            currentFilter = this.getAttribute("data-filter");
            const currentTheme = localStorage.getItem("userBackground") || "linear-gradient(180deg, #0f0c1b 0%, #bd00ff 100%)";
            applyGlobalTheme(currentTheme);
            renderFilteredPortfolios();
        });
    });

    // 🛠️ แก้ไขและรวมการทำงานของ Zoom & Pan ให้มีประสิทธิภาพ ไม่ซ้อน Event
    function initZoomAndPan() {
        const img = document.getElementById("zoomable-img");
        if (!img || !modalContentArea) return;
        
        const updateTransform = () => { img.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`; };
        
        // ล้าง Event เก่าก่อนผูกใหม่ทุกครั้ง ป้องกันปัญหากดซ้ำแล้วความเร็วเพิ่มทวีคูณ
        const cloneContent = modalContentArea.cloneNode(true);
        modalContentArea.parentNode.replaceChild(cloneContent, modalContentArea);
        
        // ดึง Element ใหม่หลังการ clone เพื่อผูก Event ใหม่ที่สะอาดสะอ้าน
        const newModalContentArea = document.getElementById("modalContentArea");
        const newImg = document.getElementById("zoomable-img");

        newModalContentArea.addEventListener("wheel", (e) => {
            e.preventDefault();
            const zoomSpeed = 0.1;
            if (e.deltaY < 0) { scale = Math.min(scale + zoomSpeed, 5); } 
            else { scale = Math.max(scale - zoomSpeed, 0.5); }
            updateTransform();
        }, { passive: false });

        newImg.addEventListener("pointerdown", (e) => {
            evCache.push(e);
            if (evCache.length === 1) {
                isPanning = true; newImg.style.cursor = "grabbing";
                startX = e.clientX - pointX; startY = e.clientY - pointY;
            }
        });

        newImg.addEventListener("pointermove", (e) => {
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
            if (evCache.length === 0) { isPanning = false; newImg.style.cursor = "grab"; }
        };

        newImg.addEventListener("pointerup", stopPan);
        newImg.addEventListener("pointercancel", stopPan);
        newImg.addEventListener("pointerout", stopPan);
        newImg.addEventListener("pointerleave", stopPan);
    }

    if (previewModal && closeModalBtn) {
        const closePreview = () => {
            previewModal.style.display = "none";
            // 🛠️ คืนค่ากล่องแสดงเนื้อหาให้ว่างเพื่อล้างความทรงจำสเปซหลังปิดโมดอล
            if(document.getElementById("modalContentArea")) {
                document.getElementById("modalContentArea").innerHTML = "";
            }
            if (modalDownloadBtn) { modalDownloadBtn.style.display = "none"; modalDownloadBtn.href = "#"; }
        };
        closeModalBtn.addEventListener("click", closePreview);
        previewModal.addEventListener("click", (e) => {
            // เช็ค target id ปัจจุบันหลังจากทำ Clone Node
            const currentArea = document.getElementById("modalContentArea");
            if (e.target === previewModal || e.target === currentArea) { closePreview(); }
        });
    }

    // 💾 ฟังก์ชันบันทึกข้อมูลลงฐานข้อมูล Firestore โดยตรง
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
            loadPortfolios();
        } catch (error) { alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล"); }
    }

    function toggleUploadOptions() {
        if (uploadOptionsBox.style.display === "none" || uploadOptionsBox.style.display === "") {
            uploadOptionsBox.style.display = "block";
            uploadOptionsBox.scrollIntoView({ behavior: "smooth" });
        } else { uploadOptionsBox.style.display = "none"; }
    }

    if (addPortfolioBtn) addPortfolioBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleUploadOptions(); });
    if (floatingAddBtn) floatingAddBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleUploadOptions(); });

    // 🛠️ เพิ่มฟังก์ชันปิดเมนูอัปโหลดเมื่อผู้ใช้คลิกพื้นที่อื่นข้างนอก (Click Outside)
    document.addEventListener("click", (e) => {
        if (uploadOptionsBox && uploadOptionsBox.style.display === "block") {
            if (!uploadOptionsBox.contains(e.target) && e.target !== addPortfolioBtn && !addPortfolioBtn.contains(e.target) && e.target !== floatingAddBtn && !floatingAddBtn.contains(e.target)) {
                uploadOptionsBox.style.display = "none";
            }
        }
    });

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
        fileInputHidden.setAttribute("accept", "image/*, application/pdf");
        
        fileInputHidden.addEventListener("change", async (event) => {
            const file = event.target.files[0];
            if (!file || !currentUserId) return;

            if (file.size > 1024 * 1024) { 
                alert("❌ เนื่องจากเราทำงานบนโหมดฟรี 100% ขนาดไฟล์ต้องไม่เกิน 1 MB ครับ แนะนำให้ย่อขนาดรูปภาพก่อนอัปโหลดนะครับ");
                fileInputHidden.value = "";
                return;
            }

            if (portfolioContainer) {
                portfolioContainer.insertAdjacentHTML('afterbegin', `<p id="uploading-text" style="text-align:center; color:#3182ce; font-weight:bold; padding:15px;">⏳ กำลังประมวลผลและแปลงข้อมูลไฟล์...</p>`);
            }

            try {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = async () => {
                    const base64Data = reader.result;
                    const loadingText = document.getElementById("uploading-text");
                    if (loadingText) loadingText.remove();

                    await savePortfolioToFirebase("file", file.name, base64Data);
                    alert("🎉 บันทึกผลงานสำเร็จ!");
                };
            } catch (err) {
                const loadingText = document.getElementById("uploading-text");
                if (loadingText) loadingText.remove();
                console.error("Upload failed: ", err);
                alert("เกิดข้อผิดพลาดในการประมวลผลไฟล์");
            }
            fileInputHidden.value = ""; 
        });
    }
});
