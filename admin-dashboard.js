import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, collection, query, where, onSnapshot, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

document.addEventListener("DOMContentLoaded", () => {
    let rawUsersData = [];
    let currentUserRole = "admin"; // ค่าเริ่มต้นสำหรับเก็บ Role ของผู้ใช้ปัจจุบัน

    // 🎨 Helper: สร้าง Default Avatar SVG ประจำตัวตามอักษรชื่อ (เหมือน Super Admin)
    function generateDefaultAvatar(name) {
        const firstLetter = (name || "A").charAt(0).toUpperCase();
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
            <rect width="100%" height="100%" fill="#8b5cf6"/>
            <text x="50%" y="55%" font-size="45" font-weight="bold" fill="#ffffff" dominant-baseline="middle" text-anchor="middle">${firstLetter}</text>
        </svg>`;
        return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }

    // 🛠️ โควตาพื้นที่รวมของระบบ (10 GB)
    const MAX_STORAGE_QUOTA = 10 * 1024 * 1024 * 1024; // 10 GB in Bytes
    let totalUsedStorageBytes = 0;
    let storageDisplayMode = "percent"; // "percent" หรือ "gb"

    // Chart Instances Object เพื่อการจัดการที่ปลอดภัย
    const charts = {
        status: null,
        gender: null,
        education: null,
        reason: null,
        age: null
    };

    // Elements
    const userNameDisplay = document.getElementById("userNameDisplay");
    const userOfficerIdDisplay = document.getElementById("userOfficerIdDisplay");
    const userAvatar = document.getElementById("userAvatar");
    const settingsBtn = document.getElementById("settingsBtn");
    const userInfoBox = document.getElementById("userInfoBox");

    const sidebar = document.getElementById("sidebar");
    const menuToggleBtn = document.getElementById("menuToggleBtn");
    const sidebarOverlay = document.getElementById("sidebarOverlay");
    const toggleIcon = document.getElementById("toggleIcon");

    // Elements สถิติ และ ข้อความเปลี่ยนตาม Role
    const statTotalUsers = document.getElementById("statTotalUsers");
    const statActiveUsers = document.getElementById("statActiveUsers");
    const pageTitleText = document.getElementById("pageTitleText");
    const statBadgeText = document.getElementById("statBadgeText");
    const superAdminMenuItem = document.getElementById("superAdminMenuItem");

    // Elements พื้นที่จัดเก็บข้อมูล
    const storageToggleBtn = document.getElementById("storageToggleBtn");
    const storagePrimaryText = document.getElementById("storagePrimaryText");
    const storageSecondaryText = document.getElementById("storageSecondaryText");
    const storageProgressBar = document.getElementById("storageProgressBar");
    const storageMaxText = document.getElementById("storageMaxText");
    const storageRemainingText = document.getElementById("storageRemainingText");

    // ⚡ [Fast-Path Step 1] โหลด Role จาก Cache เพื่อแสดง/ซ่อนเมนูทันที ไม่ต้องรอ Firebase ตอบกลับ
    const cachedRole = localStorage.getItem("lastUserRole");
    if (cachedRole && superAdminMenuItem) {
        currentUserRole = cachedRole;
        superAdminMenuItem.style.display = (cachedRole === "superadmin") ? "flex" : "none";
    }

    // --- Helper: คำนวณอายุจริงจาก birthDate ---
    function calculateAge(birthDateStr) {
        if (!birthDateStr) return null;

        let day = 0, month = 0, yearBE = 0;

        if (typeof birthDateStr === "string" && birthDateStr.includes("/")) {
            const parts = birthDateStr.split("/");
            if (parts.length === 3) {
                day = parseInt(parts[0], 10);
                month = parseInt(parts[1], 10);
                yearBE = parseInt(parts[2], 10);
            }
        } else if (typeof birthDateStr === "string" && birthDateStr.includes("-")) {
            const parts = birthDateStr.split("-");
            if (parts.length === 3) {
                yearBE = parseInt(parts[0], 10);
                month = parseInt(parts[1], 10);
                day = parseInt(parts[2], 10);
            }
        }

        if (!day || !month || !yearBE) return null;

        const birthYearAD = yearBE > 2400 ? yearBE - 543 : yearBE;
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1;
        const currentDay = today.getDate();

        let age = currentYear - birthYearAD;
        if (currentMonth < month || (currentMonth === month && currentDay < day)) {
            age--;
        }

        return age < 0 ? 0 : age;
    }

    // --- Helper: Hover Effect ---
    function addButtonHoverEffect(btn, originalBg, hoverBg) {
        if (!btn) return;
        btn.style.transition = "all 0.2s ease-in-out";
        btn.onmouseenter = () => { if (hoverBg) btn.style.background = hoverBg; };
        btn.onmouseleave = () => { if (originalBg) btn.style.background = originalBg; };
    }

    // --- Navigation ---
    function navigateToSettings(e) {
        if (e) e.stopPropagation();
        window.location.assign("settings.html");
    }

    [settingsBtn, userInfoBox, userAvatar, userNameDisplay, userOfficerIdDisplay].forEach(el => {
        if (el) {
            el.style.cursor = "pointer";
            el.addEventListener("click", navigateToSettings);
        }
    });

    // --- Sidebar Controls ---
    function openSidebar() {
        if (sidebar) sidebar.classList.add("mobile-open", "active"), sidebar.classList.remove("collapsed");
        if (sidebarOverlay) sidebarOverlay.classList.add("active"), sidebarOverlay.style.display = "block";
    }

    function closeSidebar() {
        if (sidebar) sidebar.classList.remove("mobile-open", "active"), sidebar.classList.add("collapsed");
        if (sidebarOverlay) sidebarOverlay.classList.remove("active"), sidebarOverlay.style.display = "none";
        if (toggleIcon) toggleIcon.className = "fa-solid fa-chevron-right";
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

    // --- Theme Control ---
    function applyGlobalTheme(color) {
        document.body.style.background = color;
        const isWhite = color === "#ffffff";

        const textColorMain = isWhite ? "#1a202c" : "#ffffff";
        const textColorSub = isWhite ? "#4a5568" : "#a0aec0";
        const cardBg = isWhite ? "#ffffff" : "rgba(255, 255, 255, 0.05)";
        const cardBorder = isWhite ? "1px solid #e2e8f0" : "1px solid rgba(255, 255, 255, 0.1)";

        document.body.style.color = textColorMain;
        if (userNameDisplay) userNameDisplay.style.color = textColorMain;
        if (userOfficerIdDisplay) userOfficerIdDisplay.style.color = textColorSub;

        const sidebarBrand = document.querySelector(".sidebar-brand");
        if (sidebar) {
            sidebar.style.backgroundColor = isWhite ? "#ffffff" : "rgba(15, 12, 27, 0.95)";
            sidebar.style.borderRight = cardBorder;
        }
        if (sidebarBrand) sidebarBrand.style.color = textColorMain;

        document.querySelectorAll(".sidebar-menu a, .nav-link, .menu-item").forEach(link => {
            link.style.color = isWhite ? "#2d3748" : "rgba(255, 255, 255, 0.8)";
        });

        const searchInput = document.getElementById("searchPortfolioInput");
        const searchIcon = document.querySelector(".fa-magnifying-glass");
        if (searchInput) {
            searchInput.style.background = isWhite ? "#f7fafc" : "rgba(255,255,255,0.1)";
            searchInput.style.color = textColorMain;
            searchInput.style.borderColor = isWhite ? "#cbd5e0" : "rgba(255,255,255,0.2)";
        }
        if (searchIcon) searchIcon.style.color = textColorSub;

        document.querySelectorAll(".page-title, .chart-box-card h3, .stat-card h3, .stat-title, h1, h2, h3, h4, h5, h6, .stat-number, .stat-value, #statTotalUsers, #statActiveUsers").forEach(el => {
            el.style.color = textColorMain;
        });

        document.querySelectorAll(".stat-label, .stat-subtext, .storage-info p, .storage-details span, p, span, label").forEach(sub => {
            if (!sub.classList.contains("badge") && !sub.closest("button")) {
                sub.style.color = textColorSub;
            }
        });

        if (settingsBtn) {
            const btnBg = isWhite ? "#edf2f7" : "rgba(255,255,255,0.05)";
            const btnHoverBg = isWhite ? "#e2e8f0" : "rgba(255,255,255,0.15)";
            settingsBtn.style.color = textColorMain;
            settingsBtn.style.background = btnBg;
            settingsBtn.style.borderColor = isWhite ? "#cbd5e0" : "rgba(255,255,255,0.2)";
            addButtonHoverEffect(settingsBtn, btnBg, btnHoverBg);
        }

        if (storageToggleBtn) {
            storageToggleBtn.style.color = isWhite ? "#2b6cb0" : "#60a5fa";
            storageToggleBtn.style.background = isWhite ? "#ebf8ff" : "rgba(59, 130, 246, 0.15)";
            storageToggleBtn.style.border = isWhite ? "1px solid #bee3f8" : "1px solid rgba(59, 130, 246, 0.3)";
        }

        document.querySelectorAll(".stat-info-card, .chart-box-card, .stat-card, .dashboard-card, .storage-card").forEach(card => {
            card.style.background = cardBg;
            card.style.border = cardBorder;
            card.style.color = textColorMain;
            card.style.boxShadow = isWhite ? "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)" : "none";
        });

        if (rawUsersData.length >= 0) renderAllCharts(isWhite);
    }

    function loadAndApplyTheme() {
        const savedBg = localStorage.getItem("userBackground") || "linear-gradient(180deg, #0f0c1b 0%, #bd00ff 100%)";
        applyGlobalTheme(savedBg);
    }

    loadAndApplyTheme();
    window.addEventListener('storage', (e) => { if (e.key === 'userBackground') loadAndApplyTheme(); });
    window.addEventListener("pageshow", loadAndApplyTheme);

    // --- Auth State & Role Checking (Optimization) ---
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                // ⚡ [Fast-Path Step 2] ยิง Query พร้อมกันแบบ Parallel ดึงข้อมูลเร็วขึ้น 2 เท่า
                const qAdmin = query(collection(db, "admins"), where("uid", "==", user.uid));
                const [adminQuerySnap, userDocSnap] = await Promise.all([
                    getDocs(qAdmin),
                    getDoc(doc(db, "users", user.uid))
                ]);

                const adminData = !adminQuerySnap.empty ? adminQuerySnap.docs[0].data() : null;
                const userData = userDocSnap.exists() ? userDocSnap.data() : {};

                // 📍 1. ตรวจสอบ Role ล่าสุด
                const detectedRole = (userData?.role || adminData?.role || "admin").toLowerCase();
                currentUserRole = (detectedRole === "superadmin" || detectedRole === "super_admin") ? "superadmin" : "admin";

                // ⚡ บันทึกสิทธิ์ลง Cache ไว้ใช้ครั้งต่อไป
                localStorage.setItem("lastUserRole", currentUserRole);

                // 📍 2. อัปเดตเมนูและข้อความ UI Dynamic ตามสิทธิ์ Role
                if (superAdminMenuItem) {
                    superAdminMenuItem.style.display = currentUserRole === "superadmin" ? "flex" : "none";
                }

                if (currentUserRole === "superadmin") {
                    if (pageTitleText) pageTitleText.textContent = "สถิติผู้ใช้งานทั้งระบบ (Overview)";
                    if (statBadgeText) statBadgeText.innerHTML = `<i class="fa-solid fa-database"></i> สมาชิกทั้งหมดในระบบ (รวม Admin)`;
                } else {
                    if (pageTitleText) pageTitleText.textContent = "สถิติผู้ใช้งานทั้งหมด (User Only)";
                    if (statBadgeText) statBadgeText.innerHTML = `<i class="fa-solid fa-database"></i> สมาชิกทั้งหมด (ไม่รวม ADMIN)`;
                }

                const displayName = adminData?.displayName || adminData?.name || userData?.displayName || user.displayName || "ผู้ดูแลระบบ";

                if (userNameDisplay) {
                    const roleLabel = currentUserRole === "superadmin" ? " (Super Admin)" : " (Admin)";
                    userNameDisplay.textContent = displayName + roleLabel;
                }

                if (userOfficerIdDisplay) {
                    const officerId = adminData?.officerId || adminData?.officerID || adminData?.officer_id || adminData?.officerCode ||
                                      userData?.officerId  || userData?.officerID  || userData?.officer_id  || userData?.officerCode  || "-";
                    userOfficerIdDisplay.textContent = `รหัสเจ้าหน้าที่: ${officerId}`;
                }

                // 🎯 [Fix Avatar] ปรับการสร้าง Avatar ให้เหมือนหน้า Super Admin
                if (userAvatar) {
                    const possiblePhotos = [
                        adminData?.photoURL,
                        adminData?.avatar,
                        userData?.photoURL,
                        user.photoURL
                    ].filter(url => typeof url === "string" && url.trim() !== "");

                    const defaultAvatar = generateDefaultAvatar(displayName);
                    const currentPhoto = possiblePhotos.length > 0 ? possiblePhotos[0] : defaultAvatar;

                    if (currentPhoto.startsWith("data:")) {
                        userAvatar.src = currentPhoto;
                    } else {
                        const cacheBuster = `t=${Date.now()}`;
                        userAvatar.src = currentPhoto.includes("?") ? `${currentPhoto}&${cacheBuster}` : `${currentPhoto}?${cacheBuster}`;
                    }

                    userAvatar.onerror = () => {
                        userAvatar.onerror = null;
                        userAvatar.src = defaultAvatar;
                    };
                }

                // 📍 3. เรียกใช้ Real-time Listener ตามสิทธิ์
                listenToUsersStatistics();

            } catch (e) { 
                console.error("Error loading profile:", e); 
            }
        } else {
            localStorage.removeItem("lastUserRole");
            window.location.href = "index.html";
        }
    });

    // --- Fetch Users Statistics (Real-time Listening) ---
    function listenToUsersStatistics() {
        try {
            const usersRef = collection(db, "users");
            
            // 📍 ปรับเปลี่ยน Query: ถ้าเป็น Super Admin ให้ดึงข้อมูลผู้ใช้ทั้งหมด
            let q = usersRef;
            if (currentUserRole !== "superadmin") {
                q = query(usersRef, where("role", "==", "user"));
            }

            onSnapshot(q, (querySnapshot) => {
                rawUsersData = [];
                totalUsedStorageBytes = 0;

                querySnapshot.forEach((docItem) => {
                    const userData = docItem.data();
                    rawUsersData.push({ id: docItem.id, ...userData });

                    const userStorage = userData.usedStorage || userData.storageUsed || userData.storageSize || 0;
                    totalUsedStorageBytes += Number(userStorage);
                });

                // คำนวณผู้ใช้งานออนไลน์ด้วย Heartbeat Check
                const THREE_MINUTES_MS = 3 * 60 * 1000;
                const now = Date.now();

                const activeCount = rawUsersData.filter(u => {
                    if (!u.isOnline) return false;

                    const lastSeenTime = u.lastSeen || u.lastLogin || u.lastActive;
                    if (!lastSeenTime) return false;

                    const lastSeenDate = lastSeenTime.toDate ? lastSeenTime.toDate() : new Date(lastSeenTime);
                    return (now - lastSeenDate.getTime()) <= THREE_MINUTES_MS;
                }).length;

                if (statTotalUsers) statTotalUsers.textContent = rawUsersData.length;
                if (statActiveUsers) statActiveUsers.textContent = activeCount;

                setupStorageToggleBtn();
                const currentTheme = localStorage.getItem("userBackground") || "linear-gradient(180deg, #0f0c1b 0%, #bd00ff 100%)";
                renderAllCharts(currentTheme === "#ffffff");
            }, (error) => {
                console.error("Error with real-time listener:", error);
            });

        } catch (error) {
            console.error("Error setting up listener:", error);
        }
    }

    // --- Setup ปุ่ม Toggle เปลี่ยนโหมดแสดงผลพื้นที่ ---
    function setupStorageToggleBtn() {
        if (!storageToggleBtn) return;
        storageToggleBtn.onclick = (e) => {
            e.stopPropagation();
            storageDisplayMode = storageDisplayMode === "percent" ? "gb" : "percent";
            storageToggleBtn.textContent = storageDisplayMode === "percent" ? "ดูเป็น GB" : "ดูเป็น %";
            updateStorageUI();
        };
    }

    // --- อัปเดตข้อมูลพื้นที่การจัดเก็บเข้า Element DOM ---
    function updateStorageUI() {
        const usedGB = parseFloat((totalUsedStorageBytes / (1024 * 1024 * 1024)).toFixed(2));
        const maxGB = parseFloat((MAX_STORAGE_QUOTA / (1024 * 1024 * 1024)).toFixed(0));
        let usedPercent = Math.min(100, parseFloat(((totalUsedStorageBytes / MAX_STORAGE_QUOTA) * 100).toFixed(1)));

        if (storagePrimaryText) storagePrimaryText.textContent = storageDisplayMode === "percent" ? `${usedPercent}%` : `${usedGB} GB`;
        if (storageSecondaryText) storageSecondaryText.textContent = storageDisplayMode === "percent" ? `(${usedGB} / ${maxGB} GB)` : `/ ${maxGB} GB`;
        if (storageProgressBar) storageProgressBar.style.width = `${usedPercent}%`;
        if (storageMaxText) storageMaxText.textContent = `ความจุทั้งหมด ${maxGB} GB`;
        if (storageRemainingText) {
            const remaining = (maxGB - usedGB).toFixed(2);
            storageRemainingText.textContent = `เหลือพื้นที่อีก ${remaining < 0 ? '0.00' : remaining} GB`;
        }
    }

    // --- Render All Charts ---
    function renderAllCharts(isWhite) {
        const textColor = isWhite ? "#2d3748" : "rgba(255, 255, 255, 0.85)";
        const emptyColor = isWhite ? "#e2e8f0" : "rgba(255, 255, 255, 0.15)";

        updateStorageUI();

        const THREE_MINUTES_MS = 3 * 60 * 1000;
        const now = Date.now();

        let activeUsers = 0;
        let genderCounts = { male: 0, female: 0, lgbtq: 0, unspecific: 0 };
        let eduCounts = { junior: 0, senior: 0, dip: 0, bachelor: 0, master: 0, doctor: 0 };
        let reasonCounts = { keep: 0, apply: 0, share: 0, friend: 0 };
        let ageCounts = { under9: 0, u9to11: 0, u12to16: 0, u17to30: 0, u31to50: 0, u50plus: 0 };

        rawUsersData.forEach(u => {
            // 1. สถานะใช้งาน
            const lastSeenTime = u.lastSeen || u.lastLogin || u.lastActive;
            const lastSeenDate = lastSeenTime ? (lastSeenTime.toDate ? lastSeenTime.toDate() : new Date(lastSeenTime)) : null;
            
            const isOnline = u.isOnline === true && lastSeenDate && ((now - lastSeenDate.getTime()) <= THREE_MINUTES_MS);
            if (isOnline) activeUsers++;

            // 2. เพศ
            const g = String(u.gender || "").toLowerCase();
            if (g === "male" || g.includes("ชาย")) genderCounts.male++;
            else if (g === "female" || g.includes("หญิง")) genderCounts.female++;
            else if (g.includes("lgbt") || g.includes("ทางเลือก") || g.includes("อื่นๆ")) genderCounts.lgbtq++;
            else genderCounts.unspecific++;

            // 3. วุฒิการศึกษา
            const e = String(u.education || "").trim();
            if (e.includes("มัธยมศึกษาตอนต้น") || e.includes("ต่ำกว่า")) eduCounts.junior++;
            else if (e.includes("มัธยมศึกษาตอนปลาย") || e.includes("ปวช")) eduCounts.senior++;
            else if (e.includes("อนุปริญญา") || e.includes("ปวส")) eduCounts.dip++;
            else if (e.includes("ปริญญาเอก")) eduCounts.doctor++;
            else if (e.includes("ปริญญาโท")) eduCounts.master++;
            else if (e === "ปริญญาตรี" || e.includes("ปริญญาตรี")) eduCounts.bachelor++;

            // 4. จุดประสงค์
            const r = String(u.usageReason || u.reason || "").trim();
            if (r.includes("เก็บสะสม")) reasonCounts.keep++;
            else if (r.includes("ยื่นสมัครงาน") || r.includes("สมัครเรียน")) reasonCounts.apply++;
            else if (r.includes("แชร์ผลงาน")) reasonCounts.share++;
            else if (r.includes("เพื่อนแนะนำ")) reasonCounts.friend++;

            // 5. อายุ
            const calcAge = calculateAge(u.birthDate);
            const userAge = Number(calcAge !== null ? calcAge : (u.age ?? u.userAge ?? u.ageUser));
            if (!isNaN(userAge) && userAge >= 0) {
                if (userAge < 9) ageCounts.under9++;
                else if (userAge <= 11) ageCounts.u9to11++;
                else if (userAge <= 16) ageCounts.u12to16++;
                else if (userAge <= 30) ageCounts.u17to30++;
                else if (userAge <= 50) ageCounts.u31to50++;
                else ageCounts.u50plus++;
            }
        });

        // Render Charts
        charts.status = createDoughnutChart("userStatusChart", charts.status, ["กำลังใช้งาน", "ไม่อยู่ในระบบ"], [activeUsers, rawUsersData.length - activeUsers], ["#10b981", "#64748b"], textColor, emptyColor, "%", true);
        charts.gender = createDoughnutChart("genderChart", charts.gender, ["ชาย", "หญิง", "LGBTQ+", "ไม่ระบุ"], [genderCounts.male, genderCounts.female, genderCounts.lgbtq, genderCounts.unspecific], ["#3b82f6", "#ec4899", "#8b5cf6", "#94a3b8"], textColor, emptyColor, "%", true);
        charts.education = createDoughnutChart("educationChart", charts.education, ["มัธยมศึกษาตอนต้นหรือต่ำกว่า", "มัธยมศึกษาตอนปลาย / ปวช.", "อนุปริญญา / ปวส.", "ปริญญาตรี", "ปริญญาโท", "ปริญญาเอก"], [eduCounts.junior, eduCounts.senior, eduCounts.dip, eduCounts.bachelor, eduCounts.master, eduCounts.doctor], ["#f59e0b", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899"], textColor, emptyColor, "%", true);
        charts.reason = createDoughnutChart("reasonChart", charts.reason, ["เก็บสะสมผลงานส่วนตัว", "ใช้สำหรับยื่นสมัครงาน / สมัครเรียน", "ต้องการแชร์ผลงานให้ผู้อื่นดู", "ทดลองใช้งานตามเพื่อนแนะนำ"], [reasonCounts.keep, reasonCounts.apply, reasonCounts.share, reasonCounts.friend], ["#0d9488", "#f43f5e", "#3b82f6", "#eab308"], textColor, emptyColor, "%", true);
        charts.age = createDoughnutChart("ageChart", charts.age, ["ต่ำกว่า 9 ปี", "9-11 ปี", "12-16 ปี", "17-30 ปี", "31-50 ปี", "50 ปีขึ้นไป"], [ageCounts.under9, ageCounts.u9to11, ageCounts.u12to16, ageCounts.u17to30, ageCounts.u31to50, ageCounts.u50plus], ["#10b981", "#06b6d4", "#3b82f6", "#6366f1", "#f59e0b", "#ef4444"], textColor, emptyColor, "%", true);
    }

    // --- Helper สำหรับสร้าง Chart ---
    function createDoughnutChart(canvasId, chartInstance, labels, data, colors, textColor, emptyColor, unit = "", convertToPercent = false) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return null;

        if (chartInstance) chartInstance.destroy();

        const totalSum = data.reduce((a, b) => a + b, 0);

        let finalLabels = labels;
        let finalData = data;
        let finalColors = colors;

        if (convertToPercent && totalSum > 0) {
            finalData = data.map(val => parseFloat(((val / totalSum) * 100).toFixed(1)));
        }

        if (totalSum === 0) {
            finalLabels = ["ไม่มีข้อมูล"];
            finalData = [1];
            finalColors = [emptyColor];
        }

        return new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: finalLabels,
                datasets: [{
                    data: finalData,
                    backgroundColor: finalColors,
                    borderWidth: 2,
                    borderColor: 'transparent'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { 
                            color: textColor, 
                            font: { size: 11, weight: '500' },
                            padding: 12,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            generateLabels: (chart) => {
                                const original = Chart.overrides.doughnut.plugins.legend.labels.generateLabels(chart);
                                if (totalSum > 0) {
                                    return original.map((item, index) => {
                                        item.text = `${item.text}: ${finalData[index]}${unit}`;
                                        return item;
                                    });
                                }
                                return original;
                            }
                        }
                    },
                    tooltip: {
                        enabled: totalSum > 0,
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleFont: { size: 13, weight: 'bold' },
                        bodyFont: { size: 12 },
                        padding: 10,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) label += ': ';
                                if (context.parsed !== null) {
                                    label += context.parsed + unit;
                                    if (convertToPercent) {
                                        label += ` (${data[context.dataIndex]} คน)`;
                                    }
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }
});
