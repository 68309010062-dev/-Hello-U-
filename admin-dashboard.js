import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

document.addEventListener("DOMContentLoaded", () => {
    let rawUsersData = [];

    // 🛠️ โควตาพื้นที่รวมของระบบ (ตั้งไว้ที่ 10 GB)
    const MAX_STORAGE_QUOTA = 10 * 1024 * 1024 * 1024; // 10 GB in Bytes
    let totalUsedStorageBytes = 0;
    let storageDisplayMode = "percent"; // สถานะแสดงผลพื้นที่ ("percent" หรือ "gb")

    // Chart Instances
    let statusChartInstance = null;
    let genderChartInstance = null;
    let educationChartInstance = null;
    let reasonChartInstance = null;
    let ageChartInstance = null;

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

    // Elements สถิติ
    const statTotalUsers = document.getElementById("statTotalUsers");
    const statActiveUsers = document.getElementById("statActiveUsers");

    // Elements พื้นที่จัดเก็บข้อมูล
    const storageToggleBtn = document.getElementById("storageToggleBtn");
    const storagePrimaryText = document.getElementById("storagePrimaryText");
    const storageSecondaryText = document.getElementById("storageSecondaryText");
    const storageProgressBar = document.getElementById("storageProgressBar");
    const storageMaxText = document.getElementById("storageMaxText");
    const storageRemainingText = document.getElementById("storageRemainingText");

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

        if (age < 0) age = 0;

        return age;
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

    const clickableProfileElements = [settingsBtn, userInfoBox, userAvatar, userNameDisplay, userOfficerIdDisplay];
    clickableProfileElements.forEach(el => {
        if (el) {
            el.style.cursor = "pointer";
            el.addEventListener("click", navigateToSettings);
        }
    });

    // --- Sidebar Controls ---
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

    // --- Theme Control (แก้ไขปรับปรุงแล้ว) ---
    function applyGlobalTheme(color) {
        document.body.style.background = color;
        const isWhite = color === "#ffffff";

        const textColorMain = isWhite ? "#1a202c" : "#ffffff";
        const textColorSub = isWhite ? "#4a5568" : "#a0aec0";
        const cardBg = isWhite ? "#ffffff" : "rgba(255, 255, 255, 0.05)";
        const cardBorder = isWhite ? "1px solid #e2e8f0" : "1px solid rgba(255, 255, 255, 0.1)";

        // 1. ปรับสี Text หลัก และ Subtext ของ Body
        document.body.style.color = textColorMain;
        if (userNameDisplay) userNameDisplay.style.color = textColorMain;
        if (userOfficerIdDisplay) userOfficerIdDisplay.style.color = textColorSub;

        // 2. ปรับ Sidebar
        const sidebarBrand = document.querySelector(".sidebar-brand");
        if (sidebar) {
            sidebar.style.backgroundColor = isWhite ? "#ffffff" : "rgba(15, 12, 27, 0.95)";
            sidebar.style.borderRight = cardBorder;
        }
        if (sidebarBrand) sidebarBrand.style.color = textColorMain;

        // เปลี่ยนสีเมนูลิงก์ใน Sidebar
        document.querySelectorAll(".sidebar-menu a, .nav-link, .menu-item").forEach(link => {
            link.style.color = isWhite ? "#2d3748" : "rgba(255, 255, 255, 0.8)";
        });

        // 3. ปรับ Search Input
        const searchInput = document.getElementById("searchPortfolioInput");
        const searchIcon = document.querySelector(".fa-magnifying-glass");
        if (searchInput) {
            searchInput.style.background = isWhite ? "#f7fafc" : "rgba(255,255,255,0.1)";
            searchInput.style.color = textColorMain;
            searchInput.style.borderColor = isWhite ? "#cbd5e0" : "rgba(255,255,255,0.2)";
        }
        if (searchIcon) searchIcon.style.color = textColorSub;

        // 4. หัวข้อหลัก / รอง / ตัวเลขสถิติ / รายละเอียดพื้นที่
        document.querySelectorAll(".page-title, .chart-box-card h3, .stat-card h3, .stat-title, h1, h2, h3, h4, h5, h6").forEach(t => {
            t.style.color = textColorMain;
        });

        document.querySelectorAll(".stat-number, .stat-value, #statTotalUsers, #statActiveUsers").forEach(num => {
            num.style.color = textColorMain;
        });

        document.querySelectorAll(".stat-label, .stat-subtext, .storage-info p, .storage-details span, p, span, label").forEach(sub => {
            // ยกเว้นปุ่มหรือส่วนที่ไม่ต้องการให้เปลี่ยนสี
            if (!sub.classList.contains("badge") && !sub.closest("button")) {
                sub.style.color = textColorSub;
            }
        });

        // 5. ปรับปุ่ม Settings
        if (settingsBtn) {
            const btnBg = isWhite ? "#edf2f7" : "rgba(255,255,255,0.05)";
            const btnHoverBg = isWhite ? "#e2e8f0" : "rgba(255,255,255,0.15)";
            settingsBtn.style.color = textColorMain;
            settingsBtn.style.background = btnBg;
            settingsBtn.style.borderColor = isWhite ? "#cbd5e0" : "rgba(255,255,255,0.2)";
            addButtonHoverEffect(settingsBtn, btnBg, btnHoverBg);
        }

        // 6. ปรับปุ่ม สลับโหมด GB/% (storageToggleBtn)
        if (storageToggleBtn) {
            storageToggleBtn.style.color = isWhite ? "#2b6cb0" : "#60a5fa";
            storageToggleBtn.style.background = isWhite ? "#ebf8ff" : "rgba(59, 130, 246, 0.15)";
            storageToggleBtn.style.border = isWhite ? "1px solid #bee3f8" : "1px solid rgba(59, 130, 246, 0.3)";
        }

        // 7. การ์ดคอนเทนต์ สถิติ และ กราฟ
        document.querySelectorAll(".stat-info-card, .chart-box-card, .stat-card, .dashboard-card, .storage-card").forEach(card => {
            card.style.background = cardBg;
            card.style.border = cardBorder;
            card.style.color = textColorMain;
            card.style.boxShadow = isWhite ? "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)" : "none";
        });

        // 8. Re-render กราฟเพื่อให้ Chart.js อัปเดตสี Text ใน Legend
        if (rawUsersData.length >= 0) renderAllCharts(isWhite);
    }

    function loadAndApplyTheme() {
        const savedBg = localStorage.getItem("userBackground") || "linear-gradient(180deg, #0f0c1b 0%, #bd00ff 100%)";
        applyGlobalTheme(savedBg);
    }

    loadAndApplyTheme();

    window.addEventListener('storage', (e) => {
        if (e.key === 'userBackground') loadAndApplyTheme();
    });

    window.addEventListener("pageshow", () => {
        loadAndApplyTheme();
    });

    // --- Auth State ---
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                const qAdmin = query(collection(db, "admins"), where("uid", "==", user.uid));
                const adminQuerySnap = await getDocs(qAdmin);
                
                let adminData = null;
                if (!adminQuerySnap.empty) {
                    adminData = adminQuerySnap.docs[0].data();
                }

                const userDocSnap = await getDoc(doc(db, "users", user.uid));
                const userData = userDocSnap.exists() ? userDocSnap.data() : {};

                if (userNameDisplay) {
                    userNameDisplay.textContent = 
                        adminData?.displayName || adminData?.name || 
                        userData?.displayName || user.displayName || "ผู้ดูแลระบบ";
                }

                if (userOfficerIdDisplay) {
                    const officerId = 
                        adminData?.officerId || adminData?.officerID || adminData?.officer_id || adminData?.officerCode ||
                        userData?.officerId  || userData?.officerID  || userData?.officer_id  || userData?.officerCode  || 
                        "-";

                    userOfficerIdDisplay.textContent = `รหัสเจ้าหน้าที่: ${officerId}`;
                }

                if (userAvatar) {
                    const currentPhoto = userData?.photoURL || adminData?.photoURL || adminData?.avatar || user.photoURL;
                    if (currentPhoto) {
                        const cacheBuster = currentPhoto.startsWith("data:") 
                            ? currentPhoto 
                            : `${currentPhoto}${currentPhoto.includes('?') ? '&' : '?'}t=${Date.now()}`;
                        userAvatar.src = cacheBuster;
                    } else {
                        userAvatar.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`;
                    }
                }

            } catch (e) { 
                console.error("Error loading admin profile:", e); 
            }

            loadUsersStatistics();
        } else {
            window.location.href = "index.html";
        }
    });

    // --- Fetch Users Statistics ---
    async function loadUsersStatistics() {
        try {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("role", "==", "user"));
            const querySnapshot = await getDocs(q);

            rawUsersData = [];
            totalUsedStorageBytes = 0;

            querySnapshot.forEach((docItem) => {
                const userData = docItem.data();
                rawUsersData.push({ id: docItem.id, ...userData });

                const userStorage = userData.usedStorage || userData.storageUsed || userData.storageSize || 0;
                totalUsedStorageBytes += Number(userStorage);
            });

            const totalCount = rawUsersData.length;
            
            // 🛠️ นับ Active Users (ย้อนหลัง 15 นาที)
            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

            const activeCount = rawUsersData.filter(u => {
                if (u.isOnline === true) return true;

                const lastSeenTime = u.lastSeen || u.lastLogin || u.lastActive;
                if (lastSeenTime) {
                    const lastSeenDate = lastSeenTime.toDate ? lastSeenTime.toDate() : new Date(lastSeenTime);
                    return lastSeenDate >= fifteenMinutesAgo;
                }

                return false;
            }).length;

            if (statTotalUsers) statTotalUsers.textContent = totalCount;
            if (statActiveUsers) statActiveUsers.textContent = activeCount;

            setupStorageToggleBtn();

            const currentTheme = localStorage.getItem("userBackground") || "linear-gradient(180deg, #0f0c1b 0%, #bd00ff 100%)";
            renderAllCharts(currentTheme === "#ffffff");

        } catch (error) {
            console.error("Error fetching users stats:", error);
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
        let usedPercent = parseFloat(((totalUsedStorageBytes / MAX_STORAGE_QUOTA) * 100).toFixed(1));
        if (usedPercent > 100) usedPercent = 100;

        if (storagePrimaryText) {
            storagePrimaryText.textContent = storageDisplayMode === "percent" ? `${usedPercent}%` : `${usedGB} GB`;
        }
        if (storageSecondaryText) {
            storageSecondaryText.textContent = storageDisplayMode === "percent" ? `(${usedGB} / ${maxGB} GB)` : `/ ${maxGB} GB`;
        }
        if (storageProgressBar) {
            storageProgressBar.style.width = `${usedPercent}%`;
        }
        if (storageMaxText) {
            storageMaxText.textContent = `ความจุทั้งหมด ${maxGB} GB`;
        }
        if (storageRemainingText) {
            const remaining = (maxGB - usedGB).toFixed(2);
            storageRemainingText.textContent = `เหลือพื้นที่อีก ${remaining < 0 ? '0.00' : remaining} GB`;
        }
    }

    // --- Render All Charts ---
    function renderAllCharts(isWhite) {
        const textColor = isWhite ? "#2d3748" : "rgba(255, 255, 255, 0.85)";
        const emptyColor = isWhite ? "#e2e8f0" : "rgba(255, 255, 255, 0.15)";

        // 1. อัปเดตการ์ดพื้นที่จัดเก็บข้อมูล
        updateStorageUI();

        // 2. สถานะการใช้งาน
        const totalUsers = rawUsersData.length;
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        const activeUsers = rawUsersData.filter(u => {
            if (u.isOnline === true) return true;
            const lastSeenTime = u.lastSeen || u.lastLogin || u.lastActive;
            if (lastSeenTime) {
                const lastSeenDate = lastSeenTime.toDate ? lastSeenTime.toDate() : new Date(lastSeenTime);
                return lastSeenDate >= fifteenMinutesAgo;
            }
            return false;
        }).length;
        const inactiveUsers = totalUsers - activeUsers;

        statusChartInstance = createDoughnutChart(
            "userStatusChart",
            statusChartInstance,
            ["กำลังใช้งาน", "ไม่อยู่ในระบบ"],
            [activeUsers, inactiveUsers],
            ["#10b981", "#64748b"],
            textColor,
            emptyColor,
            "%",
            true
        );

        // 3. สัดส่วนเพศ
        const male = rawUsersData.filter(u => {
            const g = String(u.gender || "").toLowerCase();
            return g === "male" || g.includes("ชาย");
        }).length;

        const female = rawUsersData.filter(u => {
            const g = String(u.gender || "").toLowerCase();
            return g === "female" || g.includes("หญิง");
        }).length;

        const lgbtq = rawUsersData.filter(u => {
            const g = String(u.gender || "").toLowerCase();
            return g.includes("lgbt") || g.includes("ทางเลือก") || g.includes("อื่นๆ");
        }).length;

        const unspecificGender = rawUsersData.filter(u => {
            const g = String(u.gender || "").trim();
            return g === "" || g.includes("ไม่ระบุ");
        }).length;

        genderChartInstance = createDoughnutChart(
            "genderChart",
            genderChartInstance,
            ["ชาย", "หญิง", "LGBTQ+", "ไม่ระบุ"],
            [male, female, lgbtq, unspecificGender],
            ["#3b82f6", "#ec4899", "#8b5cf6", "#94a3b8"],
            textColor,
            emptyColor,
            "%",
            true
        );

        // 4. วุฒิการศึกษา
        const eduJunior = rawUsersData.filter(u => {
            const e = String(u.education || "").trim();
            return e.includes("มัธยมศึกษาตอนต้น") || e.includes("ต่ำกว่า");
        }).length;

        const eduSenior = rawUsersData.filter(u => {
            const e = String(u.education || "").trim();
            return e.includes("มัธยมศึกษาตอนปลาย") || e.includes("ปวช");
        }).length;

        const eduDip = rawUsersData.filter(u => {
            const e = String(u.education || "").trim();
            return e.includes("อนุปริญญา") || e.includes("ปวส");
        }).length;

        const eduBachelor = rawUsersData.filter(u => {
            const e = String(u.education || "").trim();
            return e === "ปริญญาตรี" || (e.includes("ปริญญาตรี") && !e.includes("โท") && !e.includes("เอก"));
        }).length;

        const eduMaster = rawUsersData.filter(u => {
            const e = String(u.education || "").trim();
            return e.includes("ปริญญาโท");
        }).length;

        const eduDoctor = rawUsersData.filter(u => {
            const e = String(u.education || "").trim();
            return e.includes("ปริญญาเอก");
        }).length;

        educationChartInstance = createDoughnutChart(
            "educationChart",
            educationChartInstance,
            [
                "มัธยมศึกษาตอนต้นหรือต่ำกว่า", 
                "มัธยมศึกษาตอนปลาย / ปวช.", 
                "อนุปริญญา / ปวส.", 
                "ปริญญาตรี", 
                "ปริญญาโท", 
                "ปริญญาเอก"
            ],
            [eduJunior, eduSenior, eduDip, eduBachelor, eduMaster, eduDoctor],
            ["#f59e0b", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899"],
            textColor,
            emptyColor,
            "%",
            true
        );

        // 5. จุดประสงค์หลักในการใช้งาน
        const reasonKeep = rawUsersData.filter(u => {
            const r = String(u.usageReason || u.reason || "").trim();
            return r.includes("เก็บสะสมผลงานส่วนตัว") || r.includes("เก็บสะสม");
        }).length;

        const reasonApply = rawUsersData.filter(u => {
            const r = String(u.usageReason || u.reason || "").trim();
            return r.includes("ยื่นสมัครงาน") || r.includes("สมัครเรียน");
        }).length;

        const reasonShare = rawUsersData.filter(u => {
            const r = String(u.usageReason || u.reason || "").trim();
            return r.includes("แชร์ผลงานให้ผู้อื่นดู") || r.includes("แชร์ผลงาน");
        }).length;

        const reasonFriend = rawUsersData.filter(u => {
            const r = String(u.usageReason || u.reason || "").trim();
            return r.includes("ทดลองใช้งานตามเพื่อนแนะนำ") || r.includes("เพื่อนแนะนำ");
        }).length;

        reasonChartInstance = createDoughnutChart(
            "reasonChart",
            reasonChartInstance,
            [
                "เก็บสะสมผลงานส่วนตัว", 
                "ใช้สำหรับยื่นสมัครงาน / สมัครเรียน", 
                "ต้องการแชร์ผลงานให้ผู้อื่นดู", 
                "ทดลองใช้งานตามเพื่อนแนะนำ"
            ],
            [reasonKeep, reasonApply, reasonShare, reasonFriend],
            ["#0d9488", "#f43f5e", "#3b82f6", "#eab308"],
            textColor,
            emptyColor,
            "%",
            true
        );

        // 6. ช่วงอายุผู้ใช้งาน
        let ageUnder9 = 0;   // ต่ำกว่า 9 ปี
        let age9to11 = 0;    // 9 - 11 ปี
        let age12to16 = 0;   // 12 - 16 ปี
        let age17to30 = 0;   // 17 - 30 ปี
        let age31to50 = 0;   // 31 - 50 ปี
        let age50plus = 0;   // 50 ปีขึ้นไป

        rawUsersData.forEach(u => {
            const calculatedAge = calculateAge(u.birthDate);
            const userAge = calculatedAge !== null ? calculatedAge : (u.age ?? u.userAge ?? u.ageUser);

            if (userAge !== null && userAge !== undefined && userAge !== "") {
                const numericAge = Number(userAge);
                
                if (!isNaN(numericAge) && numericAge >= 0) {
                    if (numericAge < 9) {
                        ageUnder9++;
                    } else if (numericAge >= 9 && numericAge <= 11) {
                        age9to11++;
                    } else if (numericAge >= 12 && numericAge <= 16) {
                        age12to16++;
                    } else if (numericAge >= 17 && numericAge <= 30) {
                        age17to30++;
                    } else if (numericAge >= 31 && numericAge <= 50) {
                        age31to50++;
                    } else if (numericAge > 50) {
                        age50plus++;
                    }
                }
            }
        });

        ageChartInstance = createDoughnutChart(
            "ageChart",
            ageChartInstance,
            ["ต่ำกว่า 9 ปี", "9-11 ปี", "12-16 ปี", "17-30 ปี", "31-50 ปี", "50 ปีขึ้นไป"],
            [ageUnder9, age9to11, age12to16, age17to30, age31to50, age50plus],
            ["#10b981", "#06b6d4", "#3b82f6", "#6366f1", "#f59e0b", "#ef4444"],
            textColor,
            emptyColor,
            "%",
            true
        );
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
                                        const originalValue = data[context.dataIndex];
                                        label += ` (${originalValue} คน)`;
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
