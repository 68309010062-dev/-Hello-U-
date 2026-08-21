import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, collection, addDoc, query, where, getDocs, deleteDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

document.addEventListener("DOMContentLoaded", () => {
    let currentUserId = null;
    let localPortfoliosRaw = []; 
    let currentFilter = "all";   
    let searchKeyword = "";      

    // Elements
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

    // Sidebar Elements
    const sidebar = document.getElementById("sidebar");
    const menuToggleBtn = document.getElementById("menuToggleBtn");
    const sidebarOverlay = document.getElementById("sidebarOverlay");
    const toggleIcon = document.getElementById("toggleIcon");

    // Zoom/Pan state variables
    let scale = 1, pointX = 0, pointY = 0, startX = 0, startY = 0;
    let isPanning = false, evCache = [], prevDiff = -1;

    // --- Sidebar Toggle Logic ---
    function openSidebar() {
        if (sidebar) {
            sidebar.classList.add("mobile-open", "active");
            sidebar.classList.remove("collapsed");
        }
        if (sidebarOverlay) {
            sidebarOverlay.classList.add("active");
            sidebarOverlay.style.display = "block";
        }
    }

    function closeSidebar() {
        if (sidebar) {
            sidebar.classList.remove("mobile-open", "active");
            sidebar.classList.add("collapsed");
        }
        if (sidebarOverlay) {
            sidebarOverlay.classList.remove("active");
            sidebarOverlay.style.display = "none";
        }
        if (toggleIcon) {
            toggleIcon.className = "fa-solid fa-chevron-right";
        }
    }

    closeSidebar();

    if (menuToggleBtn) {
        menuToggleBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (sidebar && (sidebar.classList.contains("mobile-open") || sidebar.classList.contains("active"))) {
                closeSidebar();
            } else {
                openSidebar();
            }
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeSidebar();
        });
    }

    // --- Helper: Escaping XSS Attacks ---
    function escapeHtml(text) {
        if (!text) return "";
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function sanitizeUrl(url) {
        if (!url) return "#";
        const trimmed = String(url).trim();
        if (
            trimmed.startsWith("http://") || 
            trimmed.startsWith("https://") || 
            trimmed.startsWith("data:image/") ||
            trimmed.startsWith("data:application/pdf") ||
            trimmed.startsWith("data:application/")
        ) {
            return trimmed;
        }
        return "#";
    }

    // --- Format Date to Thai ---
    function formatDate(timestamp) {
        if (!timestamp) return "ไม่ระบุเวลา";
        
        let date;
        if (timestamp.toDate && typeof timestamp.toDate === "function") {
            date = timestamp.toDate();
        } else if (timestamp.seconds) {
            date = new Date(timestamp.seconds * 1000);
        } else {
            date = new Date(timestamp);
        }

        if (isNaN(date.getTime())) return "ไม่ระบุเวลา";

        const monthsTh = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
        const day = date.getDate();
        const month = monthsTh[date.getMonth()];
        const year = date.getFullYear() + 543;
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${day} ${month} ${year} เวลา ${hours}:${minutes} น.`;
    }

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

    function applyGlobalTheme(color) {
        document.body.style.background = color;
        const cards = portfolioContainer ? portfolioContainer.querySelectorAll(".portfolio-card-item") : [];
        const filterBtns = document.querySelectorAll(".filter-tab-btn");
        const sidebarBrand = document.querySelector(".sidebar-brand");
        
        const searchInput = document.getElementById("searchPortfolioInput");
        const searchIcon = document.querySelector(".fa-magnifying-glass");
        
        const isWhite = color === "#ffffff";

        document.body.style.color = isWhite ? "#1a202c" : "white";
        if (userNameDisplay) userNameDisplay.style.color = isWhite ? "#1a202c" : "white";
        if (portfolioCountDisplay) portfolioCountDisplay.style.color = isWhite ? "#4a5568" : "#a0aec0";
        
        if (sidebar) {
            sidebar.style.backgroundColor = isWhite ? "#ffffff" : "rgba(15, 12, 27, 0.95)";
            sidebar.style.borderRight = isWhite ? "1px solid #e2e8f0" : "1px solid rgba(255, 255, 255, 0.1)";
        }
        if (sidebarBrand) sidebarBrand.style.color = isWhite ? "#1a202c" : "white";

        if (searchInput) {
            searchInput.style.background = isWhite ? "#f7fafc" : "rgba(255,255,255,0.1)";
            searchInput.style.color = isWhite ? "#1a202c" : "white";
            searchInput.style.borderColor = isWhite ? "#cbd5e0" : "rgba(255,255,255,0.2)";
        }
        if (searchIcon) searchIcon.style.color = isWhite ? "#4a5568" : "rgba(255,255,255,0.5)";

        document.querySelectorAll(".page-title, .upload-options-box h3").forEach(t => {
            t.style.color = isWhite ? "#1a202c" : "white";
        });

        if (settingsBtn) {
            settingsBtn.style.color = isWhite ? "#1a202c" : "white";
            settingsBtn.style.background = isWhite ? "#edf2f7" : "rgba(255,255,255,0.05)";
            settingsBtn.style.borderColor = isWhite ? "#cbd5e0" : "rgba(255,255,255,0.2)";
        }

        filterBtns.forEach(btn => {
            const isActive = btn.classList.contains("active");
            if (isWhite) {
                btn.style.background = isActive ? "#2b6cb0" : "#edf2f7";
                btn.style.color = isActive ? "#ffffff" : "#4a5568";
                btn.style.borderColor = isActive ? "#2b6cb0" : "#cbd5e0";
            } else {
                btn.style.background = isActive ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.05)";
                btn.style.color = isActive ? "white" : "rgba(255, 255, 255, 0.7)";
                btn.style.borderColor = isActive ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.1)";
            }
        });

        const primaryBtnBg = isWhite ? "#2b6cb0" : "rgba(255, 255, 255, 0.2)";
        const primaryBtnHover = isWhite ? "#1d4ed8" : "rgba(255, 255, 255, 0.3)";

        if (addPortfolioBtn) {
            addPortfolioBtn.style.background = primaryBtnBg; 
            addPortfolioBtn.style.color = "#ffffff";
            addButtonHoverEffect(addPortfolioBtn, primaryBtnBg, primaryBtnHover);
        }
        if (floatingAddBtn) {
            floatingAddBtn.style.background = primaryBtnBg;
            floatingAddBtn.style.color = "#ffffff";
            addButtonHoverEffect(floatingAddBtn, primaryBtnBg, primaryBtnHover);
        }
        if (uploadOptionsBox) {
            uploadOptionsBox.style.background = isWhite ? "#ffffff" : "rgba(255, 255, 255, 0.1)";
            uploadOptionsBox.style.color = isWhite ? "#1a202c" : "white";
            uploadOptionsBox.style.boxShadow = isWhite ? "0 10px 25px rgba(0,0,0,0.15)" : "none";
            uploadOptionsBox.style.border = isWhite ? "1px solid #e2e8f0" : "none";
        }

        cards.forEach(card => {
            card.style.background = isWhite ? "#f7fafc" : "rgba(255, 255, 255, 0.08)";
            card.style.color = isWhite ? "#1a202c" : "white";
            card.style.border = isWhite ? "1px solid #e2e8f0" : "1px solid rgba(255, 255, 255, 0.1)";
        });

        if (closeModalBtn) {
            closeModalBtn.style.position = "fixed";
            closeModalBtn.style.top = "20px";
            closeModalBtn.style.right = "20px";
            closeModalBtn.style.color = "#ffffff";
            closeModalBtn.style.backgroundColor = "#e53e3e";
            closeModalBtn.style.borderRadius = "50%";
            closeModalBtn.style.width = "44px";
            closeModalBtn.style.height = "44px";
            closeModalBtn.style.display = "flex";
            closeModalBtn.style.alignItems = "center";
            closeModalBtn.style.justifyContent = "center";
            closeModalBtn.style.fontSize = "20px";
            closeModalBtn.style.cursor = "pointer";
            closeModalBtn.style.border = "2px solid #ffffff";
            closeModalBtn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.5)";
            closeModalBtn.style.zIndex = "999999";
            
            closeModalBtn.onmouseenter = () => closeModalBtn.style.backgroundColor = "#c53030";
            closeModalBtn.onmouseleave = () => closeModalBtn.style.backgroundColor = "#e53e3e";
        }

        if (modalDownloadBtn) {
            modalDownloadBtn.style.position = "fixed";
            modalDownloadBtn.style.top = "20px";
            modalDownloadBtn.style.right = "75px";
            modalDownloadBtn.style.color = "#ffffff";
            modalDownloadBtn.style.backgroundColor = "#4a5568";
            modalDownloadBtn.style.borderRadius = "50%";
            modalDownloadBtn.style.width = "44px";
            modalDownloadBtn.style.height = "44px";
            modalDownloadBtn.style.display = "flex";
            modalDownloadBtn.style.alignItems = "center";
            modalDownloadBtn.style.justifyContent = "center";
            modalDownloadBtn.style.fontSize = "18px";
            modalDownloadBtn.style.border = "2px solid #ffffff";
            modalDownloadBtn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.5)";
            modalDownloadBtn.style.zIndex = "999999";

            modalDownloadBtn.onmouseenter = () => modalDownloadBtn.style.backgroundColor = "#2d3748";
            modalDownloadBtn.onmouseleave = () => modalDownloadBtn.style.backgroundColor = "#4a5568";
        }
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
        settingsBtn.addEventListener("click", () => { window.location.href = "settings.html"; });
    }
    applyGlobalTheme(savedBg);

    // Auth State Observer
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserId = user.uid;

            // 📍 เพิ่มส่วนอัปเดตสถานะ Online / Offline ไปยัง Firestore
            try {
                const userRef = doc(db, "users", user.uid);
                
                await updateDoc(userRef, {
                    isOnline: true,
                    lastSeen: serverTimestamp()
                });

                window.addEventListener("beforeunload", () => {
                    updateDoc(userRef, {
                        isOnline: false,
                        lastSeen: serverTimestamp()
                    });
                });
            } catch (err) {
                console.error("Error updating online status:", err);
            }

            try {
                const userDocSnap = await getDoc(doc(db, "users", user.uid));
                if (userNameDisplay) {
                    userNameDisplay.textContent = userDocSnap.exists() 
                        ? (userDocSnap.data().displayName || user.displayName || 'ผู้ใช้ทั่วไป')
                        : (user.displayName || 'ผู้ใช้ทั่วไป');
                }
            } catch (error) { 
                console.error("Fetch user error:", error);
                if (userNameDisplay) userNameDisplay.textContent = `${user.displayName || 'ผู้ใช้ทั่วไป'}`; 
            }
            if (user.photoURL && userAvatar) userAvatar.src = user.photoURL;
            loadPortfolios();
        } else { 
            window.location.href = "index.html"; 
        }
    });

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
                localPortfoliosRaw.push({ id: docItem.id, ...docItem.data() });
            });

            localPortfoliosRaw.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

            const totalCount = localPortfoliosRaw.length;
            if (addPortfolioBtn) addPortfolioBtn.style.display = totalCount >= 1 ? "none" : "flex";
            if (floatingAddBtn) floatingAddBtn.style.display = "flex";
            if (portfolioCountDisplay) portfolioCountDisplay.textContent = `จำนวนผลงาน: ${totalCount} ชิ้น`;
            
            renderFilteredPortfolios();

        } catch (error) { 
            console.error("Load portfolios error:", error); 
        }
    }

    function renderFilteredPortfolios() {
        if (!portfolioContainer) return;
        portfolioContainer.innerHTML = "";
        
        const currentTheme = localStorage.getItem("userBackground") || "linear-gradient(180deg, #0f0c1b 0%, #bd00ff 100%)";

        const filteredList = localPortfoliosRaw.filter(item => {
            const matchType = (currentFilter === "all") || (item.type === currentFilter);
            const matchSearch = (item.title || "").toLowerCase().includes(searchKeyword.trim().toLowerCase());
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
            
            const isWhite = currentTheme === "#ffffff";
            card.style.background = isWhite ? "#f7fafc" : "rgba(255, 255, 255, 0.08)";
            card.style.color = isWhite ? "#1a202c" : "white";
            card.style.border = isWhite ? "1px solid #e2e8f0" : "1px solid rgba(255, 255, 255, 0.1)";
            card.style.padding = "15px";
            card.style.borderRadius = "12px";
            card.style.display = "flex";
            card.style.alignItems = "center";
            card.style.justifyContent = "space-between";
            card.style.transition = "background 0.3s ease, color 0.3s ease"; 

            let actionButton = "";
            let typeIcon = "";

            const safeTitle = escapeHtml(data.title);
            const safeContent = sanitizeUrl(data.content);

            if (data.type === "file") {
                const isImgFile = data.content && data.content.startsWith("data:image/");
                typeIcon = isImgFile 
                    ? `<img src="${safeContent}" style="width: 42px; height: 42px; object-fit: cover; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); background: #ffffff;"/>`
                    : `<i class="fa-solid fa-file-pdf" style="font-size: 28px; color: #fc8181;"></i>`;
                actionButton = `<button class="view-file-btn" data-id="${docId}" style="background: #4a5568; color: white; padding: 6px 12px; border: none; border-radius: 6px; font-size: 13px; font-weight: bold; margin-right: 8px; cursor: pointer;"><i class="fa-solid fa-eye"></i> ตรวจสอบไฟล์</button>`;
            } else {
                typeIcon = `<i class="fa-solid fa-link" style="font-size: 20px; color: #4299e1;"></i>`;
                actionButton = `<a class="view-link-btn" href="${safeContent}" target="_blank" rel="noopener noreferrer" style="background: #2b6cb0; color: white; padding: 6px 12px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: bold; margin-right: 8px; display: inline-block;"><i class="fa-solid fa-arrow-up-right-from-square"></i> เปิดลิงก์</a>`;
            }

            const formattedDate = formatDate(data.createdAt);
            const dateColor = isWhite ? "#718096" : "rgba(255,255,255,0.6)";

            card.innerHTML = `
                <div style="display: flex; align-items: center; gap: 15px; width: 65%;">
                    <div style="display: flex; align-items: center; justify-content: center; width: 45px; flex-shrink: 0;">${typeIcon}</div>
                    <div style="overflow: hidden; width: 100%;">
                        <strong style="display: block; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${safeTitle}</strong>
                        <span style="display: block; font-size: 12px; color: ${dateColor}; margin-top: 2px;">
                            <i class="fa-regular fa-clock" style="margin-right: 4px;"></i>${formattedDate}
                        </span>
                    </div>
                </div>
                <div style="display: flex; align-items: center; flex-shrink: 0;">
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
    }

    if (portfolioContainer) {
        portfolioContainer.addEventListener("click", async (e) => {
            const viewBtn = e.target.closest(".view-file-btn");
            const deleteBtn = e.target.closest(".delete-portfolio-btn");

            if (viewBtn) {
                const idToView = viewBtn.getAttribute("data-id");
                const targetData = localPortfoliosRaw.find(d => d.id === idToView);
                if (targetData && previewModal && modalContentArea) {
                    modalContentArea.innerHTML = "";
                    scale = 1; pointX = 0; pointY = 0; evCache = []; prevDiff = -1;

                    const safeUrl = sanitizeUrl(targetData.content);

                    if (modalDownloadBtn) {
                        modalDownloadBtn.href = safeUrl;
                        modalDownloadBtn.setAttribute("download", targetData.title || "portfolio-file");
                        modalDownloadBtn.style.display = "flex"; 
                    }

                    const isImage = targetData.content && (
                        targetData.content.startsWith("data:image/") || 
                        /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(targetData.content)
                    );

                    if (isImage) {
                        modalContentArea.innerHTML = `
                            <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #ffffff; border-radius: 12px; padding: 16px; box-sizing: border-box; overflow: hidden;">
                                <img id="zoomable-img" src="${safeUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain; transform: translate(0px, 0px) scale(1); transform-origin: center; cursor: grab; user-select: none; transition: transform 0.1s ease-out;" draggable="false" />
                            </div>
                        `;
                        initZoomAndPan();
                    } else {
                        modalContentArea.innerHTML = `
                            <iframe src="${safeUrl}" width="100%" height="100%" style="border: none; border-radius: 8px; background: #ffffff;"></iframe>
                        `;
                    }
                    
                    previewModal.style.display = "flex";
                    previewModal.classList.add("active");
                }
            }

            if (deleteBtn) {
                const idToDelete = deleteBtn.getAttribute("data-id");
                if (confirm("คุณแน่ใจหรือไม่ว่าต้องการลบผลงานรายการนี้?")) {
                    try {
                        await deleteDoc(doc(db, "portfolios", idToDelete));
                        alert("🗑️ ลบผลงานสำเร็จ");
                        loadPortfolios(); 
                    } catch (err) { 
                        console.error("Delete document error:", err); 
                        alert("❌ เกิดข้อผิดพลาดในการลบผลงาน");
                    }
                }
            }
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

    function initZoomAndPan() {
        const img = document.getElementById("zoomable-img");
        if (!img || !modalContentArea) return;

        const updateTransform = () => { img.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`; };

        modalContentArea.onwheel = (e) => {
            e.preventDefault();
            const zoomSpeed = 0.1;
            scale = e.deltaY < 0 ? Math.min(scale + zoomSpeed, 5) : Math.max(scale - zoomSpeed, 0.5);
            updateTransform();
        };

        img.onpointerdown = (e) => {
            evCache.push(e);
            if (evCache.length === 1) {
                isPanning = true; img.style.cursor = "grabbing";
                startX = e.clientX - pointX; startY = e.clientY - pointY;
            }
        };

        img.onpointermove = (e) => {
            const index = evCache.findIndex(ev => ev.pointerId === e.pointerId);
            if (index > -1) evCache[index] = e;
            if (evCache.length === 2) {
                isPanning = false;
                const curDiff = Math.hypot(evCache[0].clientX - evCache[1].clientX, evCache[0].clientY - evCache[1].clientY);
                if (prevDiff > 0) {
                    if (curDiff > prevDiff) scale = Math.min(scale + 0.03, 5);
                    else if (curDiff < prevDiff) scale = Math.max(scale - 0.03, 0.5);
                    updateTransform();
                }
                prevDiff = curDiff;
            } else if (isPanning) {
                pointX = e.clientX - startX; pointY = e.clientY - startY;
                updateTransform();
            }
        };

        const stopPan = (e) => {
            const index = evCache.findIndex(ev => ev.pointerId === e.pointerId);
            if (index > -1) evCache.splice(index, 1);
            if (evCache.length < 2) prevDiff = -1;
            if (evCache.length === 0) { isPanning = false; img.style.cursor = "grab"; }
        };

        img.onpointerup = stopPan;
        img.onpointercancel = stopPan;
        img.onpointerout = stopPan;
        img.onpointerleave = stopPan;
    }

    if (previewModal && closeModalBtn) {
        const closePreview = () => {
            previewModal.style.display = "none";
            previewModal.classList.remove("active");
            if (modalContentArea) modalContentArea.innerHTML = "";
            if (modalDownloadBtn) { modalDownloadBtn.style.display = "none"; modalDownloadBtn.href = "#"; }
        };
        closeModalBtn.addEventListener("click", closePreview);
        previewModal.addEventListener("click", (e) => {
            if (e.target === previewModal || e.target === modalContentArea) { closePreview(); }
        });
    }

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
        } catch (error) { 
            console.error("Save portfolio error:", error);
            alert("❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล"); 
        }
    }

    function toggleUploadOptions() {
        if (!uploadOptionsBox) return;
        const isHidden = uploadOptionsBox.style.display === "none" || uploadOptionsBox.style.display === "";
        uploadOptionsBox.style.display = isHidden ? "block" : "none";
        if (isHidden) uploadOptionsBox.scrollIntoView({ behavior: "smooth" });
    }

    if (addPortfolioBtn) addPortfolioBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleUploadOptions(); });
    if (floatingAddBtn) floatingAddBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleUploadOptions(); });

    document.addEventListener("click", (e) => {
        if (uploadOptionsBox && uploadOptionsBox.style.display === "block") {
            const clickedInsideBox = uploadOptionsBox.contains(e.target);
            const clickedAddBtn = addPortfolioBtn && addPortfolioBtn.contains(e.target);
            const clickedFloatingBtn = floatingAddBtn && floatingAddBtn.contains(e.target);
            
            if (!clickedInsideBox && !clickedAddBtn && !clickedFloatingBtn) {
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
            if (uploadOptionsBox) uploadOptionsBox.style.display = "none"; 
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

            if (file.size > 700 * 1024) { 
                alert("❌ ขนาดไฟล์ต้องไม่เกิน 700 KB ครับ แนะนำให้ย่อขนาดรูปภาพหรือลดขนาด PDF ก่อนอัปโหลดนะครับ");
                fileInputHidden.value = "";
                return;
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                const base64Content = e.target.result;
                savePortfolioToFirebase("file", file.name, base64Content);
                fileInputHidden.value = "";
            };
            reader.readAsDataURL(file);
        });
    }
});
