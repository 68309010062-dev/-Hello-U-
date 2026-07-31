import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

document.addEventListener("DOMContentLoaded", () => {
    let currentUserId = null;
    let localPortfoliosRaw = [];
    let currentFilter = "all";

    // Chart Instances
    let typeChartInstance = null;
    let storageChartInstance = null;

    // Elements - Profile & Sidebar
    const userNameDisplay = document.getElementById("userNameDisplay");
    const portfolioCountDisplay = document.getElementById("portfolioCountDisplay");
    const userAvatar = document.getElementById("userAvatar");
    const sidebar = document.getElementById("sidebar");
    const menuToggleBtn = document.getElementById("menuToggleBtn");
    const sidebarOverlay = document.getElementById("sidebarOverlay");
    const toggleIcon = document.getElementById("toggleIcon");
    const settingsBtn = document.getElementById("settingsBtn");

    // Elements - Stats & History
    const statTotalItems = document.getElementById("statTotalItems");
    const statLastUpdated = document.getElementById("statLastUpdated");
    const storageTextDetails = document.getElementById("storageTextDetails");
    const filterTabBtns = document.querySelectorAll(".filter-tab-btn");
    const historyContainer = document.getElementById("historyContainer");

    // --- Sidebar Functions & Initial Close State ---
    function openSidebar() {
        if (sidebar) {
            sidebar.classList.add("mobile-open");
            sidebar.classList.add("active");
            sidebar.classList.remove("collapsed");
        }
        if (sidebarOverlay) {
            sidebarOverlay.classList.add("active");
            sidebarOverlay.style.display = "block";
        }
        if (toggleIcon) {
            toggleIcon.className = "fa-solid fa-chevron-left";
        }
    }

    function closeSidebar() {
        if (sidebar) {
            sidebar.classList.remove("mobile-open");
            sidebar.classList.remove("active");
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

    // 🟢 บังคับปิด Sidebar ทันทีที่เข้าหน้าเว็บ
    closeSidebar();

    // --- Sidebar Event Listeners ---
    if (menuToggleBtn && sidebar) {
        menuToggleBtn.addEventListener("click", () => {
            const isCollapsed = sidebar.classList.contains("collapsed");
            if (isCollapsed) {
                openSidebar();
            } else {
                closeSidebar();
            }
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener("click", closeSidebar);
    }

    // --- Helper Functions ---
    function escapeHtml(text) {
        if (!text) return "";
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

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

    // --- Dynamic Theme Control ---
    function applyGlobalTheme(color) {
        const isWhite = color === "#ffffff";
        document.body.style.background = color;
        document.body.style.color = isWhite ? "#1a202c" : "#ffffff";

        if (userNameDisplay) userNameDisplay.style.color = isWhite ? "#1a202c" : "#ffffff";
        if (portfolioCountDisplay) portfolioCountDisplay.style.color = isWhite ? "#4a5568" : "#a0aec0";

        if (sidebar) {
            sidebar.style.backgroundColor = isWhite ? "#ffffff" : "rgba(15, 12, 27, 0.95)";
            sidebar.style.borderRight = isWhite ? "1px solid #e2e8f0" : "1px solid rgba(255, 255, 255, 0.1)";
        }

        document.querySelectorAll(".sidebar-brand, .menu-item").forEach(item => {
            if (!item.classList.contains("active")) {
                item.style.color = isWhite ? "#2d3748" : "#ffffff";
            }
        });

        document.querySelectorAll(".page-title, .chart-box-card h3").forEach(t => {
            t.style.color = isWhite ? "#1a202c" : "#ffffff";
        });

        if (settingsBtn) {
            settingsBtn.style.color = isWhite ? "#1a202c" : "#ffffff";
            settingsBtn.style.background = isWhite ? "#edf2f7" : "rgba(255,255,255,0.05)";
            settingsBtn.style.borderColor = isWhite ? "#cbd5e0" : "rgba(255,255,255,0.2)";
        }

        filterTabBtns.forEach(btn => {
            const isActive = btn.classList.contains("active");
            if (isWhite) {
                btn.style.background = isActive ? "#2b6cb0" : "#edf2f7";
                btn.style.color = isActive ? "#ffffff" : "#4a5568";
                btn.style.borderColor = isActive ? "#2b6cb0" : "#cbd5e0";
            } else {
                btn.style.background = isActive ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.05)";
                btn.style.color = isActive ? "#ffffff" : "rgba(255, 255, 255, 0.7)";
                btn.style.borderColor = isActive ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.1)";
            }
        });

        const statCards = document.querySelectorAll(".stat-info-card, .chart-box-card");
        statCards.forEach(card => {
            card.style.background = isWhite ? "#ffffff" : "rgba(255, 255, 255, 0.05)";
            card.style.border = isWhite ? "1px solid #e2e8f0" : "1px solid rgba(255, 255, 255, 0.1)";
            card.style.color = isWhite ? "#1a202c" : "#ffffff";
            card.style.boxShadow = isWhite ? "0 2px 8px rgba(0,0,0,0.05)" : "none";
        });

        if (storageTextDetails) {
            storageTextDetails.style.color = isWhite ? "#4a5568" : "rgba(255,255,255,0.7)";
        }

        if (localPortfoliosRaw.length >= 0) {
            loadHistoryData();
        }
    }

    window.addEventListener('storage', (e) => {
        if (e.key === 'userBackground') {
            const newColor = e.newValue || "linear-gradient(180deg, #0f0c1b 0%, #bd00ff 100%)";
            applyGlobalTheme(newColor);
        }
    });

    const savedBg = localStorage.getItem("userBackground") || "linear-gradient(180deg, #0f0c1b 0%, #bd00ff 100%)";
    if (settingsBtn) {
        settingsBtn.addEventListener("click", () => { window.location.href = "settings.html"; });
    }
    applyGlobalTheme(savedBg);

    // --- Authentication State Observer ---
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserId = user.uid;
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
            loadHistoryData();
        } else {
            window.location.href = "index.html";
        }
    });

    // --- Data Fetching & Calculations ---
    async function loadHistoryData() {
        if (!currentUserId || !historyContainer) return;

        try {
            const currentTheme = localStorage.getItem("userBackground") || "linear-gradient(180deg, #0f0c1b 0%, #bd00ff 100%)";
            const isWhite = currentTheme === "#ffffff";
            const loadingColor = isWhite ? "#2d3748" : "#ffffff";
            
            historyContainer.innerHTML = `<p style='color: ${loadingColor}; text-align: center; opacity: 0.7;'>กำลังโหลดประวัติผลงาน...</p>`;

            const portfolioRef = collection(db, "portfolios");
            const q = query(portfolioRef, where("userId", "==", currentUserId));
            const querySnapshot = await getDocs(q);

            localPortfoliosRaw = [];
            querySnapshot.forEach((docItem) => {
                localPortfoliosRaw.push({ id: docItem.id, ...docItem.data() });
            });

            localPortfoliosRaw.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

            const totalCount = localPortfoliosRaw.length;
            if (statTotalItems) statTotalItems.textContent = `${totalCount} ชิ้น`;
            if (portfolioCountDisplay) portfolioCountDisplay.textContent = `จำนวนผลงาน: ${totalCount} ชิ้น`;

            if (totalCount > 0 && statLastUpdated) {
                statLastUpdated.textContent = formatDate(localPortfoliosRaw[0].createdAt);
            } else if (statLastUpdated) {
                statLastUpdated.textContent = "-";
            }

            let totalSizeBytes = 0;
            let fileCount = 0;
            let linkCount = 0;

            localPortfoliosRaw.forEach(item => {
                if (item.type === "file") fileCount++;
                if (item.type === "link") linkCount++;
                if (item.content) {
                    totalSizeBytes += new Blob([item.content]).size;
                }
            });

            const totalKB = (totalSizeBytes / 1024).toFixed(1);
            if (storageTextDetails) {
                storageTextDetails.textContent = `ใช้ไป ${totalKB} KB / โควต้า 10 MB`;
            }

            // Render Chart.js
            renderTypeChart(fileCount, linkCount, isWhite);
            renderStorageChart(totalSizeBytes, isWhite);

            // Render List
            renderFilteredHistory();

        } catch (error) {
            console.error("Error loading history:", error);
            historyContainer.innerHTML = `<p style='color: #e53e3e; text-align: center;'>เกิดข้อผิดพลาดในการโหลดข้อมูล</p>`;
        }
    }

    // --- Chart.js Rendering ---
    function renderTypeChart(files, links, isWhite) {
        const ctx = document.getElementById("typeDistributionChart");
        if (!ctx) return;

        if (typeChartInstance) typeChartInstance.destroy();

        const total = files + links;
        const filePercent = total > 0 ? Math.round((files / total) * 100) : 0;
        const linkPercent = total > 0 ? Math.round((links / total) * 100) : 0;
        const textColor = isWhite ? "#2d3748" : "rgba(255, 255, 255, 0.85)";

        typeChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [`ไฟล์ (${filePercent}%)`, `ลิงก์ (${linkPercent}%)`],
                datasets: [{
                    data: total === 0 ? [1, 0] : [files, links],
                    backgroundColor: total === 0 ? ['#cbd5e0', '#e2e8f0'] : ['#0284c7', '#10b981'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: textColor, font: { size: 11, weight: 'bold' } }
                    }
                }
            }
        });
    }

    function renderStorageChart(usedBytes, isWhite) {
        const ctx = document.getElementById("storageUsageChart");
        if (!ctx) return;

        if (storageChartInstance) storageChartInstance.destroy();

        const maxBytes = 10 * 1024 * 1024; // 10 MB
        const remainingBytes = Math.max(0, maxBytes - usedBytes);
        const textColor = isWhite ? "#2d3748" : "rgba(255, 255, 255, 0.85)";

        storageChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['ใช้ไปแล้ว', 'คงเหลือ'],
                datasets: [{
                    data: [usedBytes, remainingBytes],
                    backgroundColor: ['#f43f5e', isWhite ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: textColor, font: { size: 11, weight: 'bold' } }
                    }
                }
            }
        });
    }

    // --- Render History List ---
    function renderFilteredHistory() {
        if (!historyContainer) return;
        historyContainer.innerHTML = "";

        const currentTheme = localStorage.getItem("userBackground") || "linear-gradient(180deg, #0f0c1b 0%, #bd00ff 100%)";
        const isWhite = currentTheme === "#ffffff";

        const filteredList = localPortfoliosRaw.filter(item => {
            return (currentFilter === "all") || (item.type === currentFilter);
        });

        if (filteredList.length === 0) {
            const emptyColor = isWhite ? "#718096" : "#a0aec0";
            historyContainer.innerHTML = `<p style='color: ${emptyColor}; text-align: center; font-size: 14px; padding: 20px;'>ไม่พบประวัติผลงานในหมวดหมู่นี้</p>`;
            return;
        }

        filteredList.forEach((data) => {
            const card = document.createElement("div");
            card.classList.add("history-card-item");

            card.style.background = isWhite ? "#ffffff" : "rgba(255, 255, 255, 0.05)";
            card.style.color = isWhite ? "#1a202c" : "#ffffff";
            card.style.border = isWhite ? "1px solid #e2e8f0" : "1px solid rgba(255, 255, 255, 0.1)";
            card.style.padding = "14px 16px";
            card.style.borderRadius = "12px";
            card.style.marginBottom = "10px";
            card.style.display = "flex";
            card.style.alignItems = "center";
            card.style.justifyContent = "space-between";
            card.style.boxShadow = isWhite ? "0 2px 4px rgba(0,0,0,0.02)" : "none";

            const safeTitle = escapeHtml(data.title);
            const formattedDate = formatDate(data.createdAt);
            const dateColor = isWhite ? "#718096" : "rgba(255,255,255,0.6)";

            let typeIcon = "";
            let badgeTag = "";

            if (data.type === "file") {
                const isImg = data.content && data.content.startsWith("data:image/");
                typeIcon = isImg 
                    ? `<i class="fa-solid fa-file-image" style="font-size: 20px; color: #0284c7;"></i>`
                    : `<i class="fa-solid fa-file-pdf" style="font-size: 20px; color: #e11d48;"></i>`;
                
                const badgeBg = isWhite ? "#e0f2fe" : "rgba(56, 189, 248, 0.15)";
                const badgeColor = isWhite ? "#0369a1" : "#38bdf8";
                badgeTag = `<span style="background: ${badgeBg}; color: ${badgeColor}; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: bold;">ไฟล์</span>`;
            } else {
                typeIcon = `<i class="fa-solid fa-link" style="font-size: 18px; color: #059669;"></i>`;
                const badgeBg = isWhite ? "#d1fae5" : "rgba(52, 211, 153, 0.15)";
                const badgeColor = isWhite ? "#047857" : "#34d399";
                badgeTag = `<span style="background: ${badgeBg}; color: ${badgeColor}; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: bold;">ลิงก์</span>`;
            }

            const iconBg = isWhite ? "#f8fafc" : "rgba(255,255,255,0.05)";

            card.innerHTML = `
                <div style="display: flex; align-items: center; gap: 14px; width: 80%;">
                    <div style="width: 38px; height: 38px; border-radius: 8px; background: ${iconBg}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        ${typeIcon}
                    </div>
                    <div style="overflow: hidden; width: 100%;">
                        <strong style="display: block; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: ${isWhite ? '#1a202c' : '#ffffff'};">${safeTitle}</strong>
                        <span style="display: block; font-size: 11px; color: ${dateColor}; margin-top: 2px;">
                            <i class="fa-regular fa-clock" style="margin-right: 4px;"></i>${formattedDate}
                        </span>
                    </div>
                </div>
                <div style="display: flex; align-items: center; flex-shrink: 0;">
                    ${badgeTag}
                </div>
            `;

            historyContainer.appendChild(card);
        });
    }

    // Filter Buttons
    filterTabBtns.forEach(btn => {
        btn.addEventListener("click", function() {
            filterTabBtns.forEach(b => b.classList.remove("active"));
            this.classList.add("active");
            currentFilter = this.getAttribute("data-filter");

            const currentTheme = localStorage.getItem("userBackground") || "linear-gradient(180deg, #0f0c1b 0%, #bd00ff 100%)";
            applyGlobalTheme(currentTheme);
            renderFilteredHistory();
        });
    });
});
