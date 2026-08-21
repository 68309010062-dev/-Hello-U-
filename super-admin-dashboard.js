import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    doc, 
    getDoc, 
    setDoc,
    collection, 
    onSnapshot,
    updateDoc, 
    deleteDoc,
    writeBatch,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    let currentSuperAdmin = null;
    let currentTab = "all"; // "all" | "pending" | "blocked"
    let allAdminsList = [];
    let blockedRegistrationsList = [];
    let activeSecretKey = "ADMIN123";
    let unsubscribeAdmins = null;
    let unsubscribeBlocked = null;

    // UI Elements
    const adminTableBody = document.getElementById("adminTableBody");
    const totalAdminsCount = document.getElementById("totalAdminsCount");
    const userNameDisplay = document.getElementById("userNameDisplay");
    const userOfficerIdDisplay = document.getElementById("userOfficerIdDisplay");
    const userAvatar = document.getElementById("userAvatar");
    const settingsBtn = document.getElementById("settingsBtn");
    const tableTitle = document.getElementById("tableTitle");
    const adminSearchInput = document.getElementById("adminSearchInput");
    const changeAdminKeyBtn = document.getElementById("changeAdminKeyBtn");

    // Tab Buttons
    const tabAllAdmins = document.getElementById("tabAllAdmins");
    const tabPendingAdmins = document.getElementById("tabPendingAdmins");
    const tabBlockedAdmins = document.getElementById("tabBlockedAdmins");

    // Sidebar Controls
    const sidebar = document.getElementById("sidebar");
    const toggleIcon = document.getElementById("toggleIcon");
    const sidebarOverlay = document.getElementById("sidebarOverlay");

    function closeSidebar() {
        if (sidebar) {
            sidebar.classList.add("collapsed");
            sidebar.classList.remove("active", "mobile-open");
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

    function generateDefaultAvatar(name) {
        const firstLetter = (name || "A").charAt(0).toUpperCase();
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
            <rect width="100%" height="100%" fill="#8b5cf6"/>
            <text x="50%" y="55%" font-size="45" font-weight="bold" fill="#ffffff" dominant-baseline="middle" text-anchor="middle">${firstLetter}</text>
        </svg>`;
        return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }

    function applyGlobalTheme(color) {
        const isWhite = (color === "#ffffff" || color === "rgb(255, 255, 255)" || color.toLowerCase() === "#fff");
        document.body.style.background = color;
        const textColorMain = isWhite ? "#0f172a" : "#ffffff";
        const textColorSub = isWhite ? "#475569" : "#94a3b8";
        const cardBg = isWhite ? "#ffffff" : "rgba(255, 255, 255, 0.05)";
        const cardBorder = isWhite ? "1px solid #e2e8f0" : "1px solid rgba(255, 255, 255, 0.1)";

        document.body.style.color = textColorMain;
        if (userNameDisplay) userNameDisplay.style.color = textColorMain;
        if (userOfficerIdDisplay) userOfficerIdDisplay.style.color = textColorSub;

        if (sidebar) {
            sidebar.style.backgroundColor = isWhite ? "#ffffff" : "rgba(15, 12, 27, 0.95)";
            sidebar.style.borderRight = cardBorder;
        }

        document.querySelectorAll(".sidebar-menu a, .nav-link, .menu-item, .user-info-box").forEach(el => {
            el.style.color = isWhite ? "#1e293b" : "rgba(255, 255, 255, 0.85)";
        });

        if (settingsBtn) {
            settingsBtn.style.color = isWhite ? "#0f172a" : "#ffffff";
            settingsBtn.style.background = isWhite ? "#f1f5f9" : "rgba(255, 255, 255, 0.08)";
            settingsBtn.style.border = isWhite ? "1px solid #cbd5e1" : "1px solid rgba(255, 255, 255, 0.15)";
        }

        document.querySelectorAll(".dashboard-card, .table-container, .card, table, .super-card, .stat-info-card").forEach(card => {
            card.style.background = cardBg;
            card.style.border = cardBorder;
            card.style.color = textColorMain;
        });

        document.querySelectorAll("th, td").forEach(cell => {
            cell.style.color = textColorMain;
            cell.style.borderColor = isWhite ? "#e2e8f0" : "rgba(255, 255, 255, 0.08)";
        });
    }

    function loadAndApplyTheme() {
        const savedBg = localStorage.getItem("userBackground") || "linear-gradient(180deg, #0f0c1b 0%, #bd00ff 100%)";
        applyGlobalTheme(savedBg);
    }

    loadAndApplyTheme();

    async function getLatestAdminKey() {
        try {
            const configRef = doc(db, "system_settings", "config");
            const keyDoc = await getDoc(configRef);
            
            if (keyDoc.exists() && keyDoc.data().adminKey) {
                activeSecretKey = String(keyDoc.data().adminKey).trim();
            } else {
                await setDoc(configRef, {
                    adminKey: "ADMIN123",
                    createdAt: serverTimestamp()
                }, { merge: true });
                activeSecretKey = "ADMIN123";
            }
        } catch (e) {
            console.warn("Error fetching/creating admin key:", e);
        }
        return activeSecretKey;
    }

    async function validateAdminKey(inputKey) {
        if (!inputKey) return false;
        const realKey = await getLatestAdminKey();
        return inputKey.trim().toUpperCase() === realKey.toUpperCase();
    }

    function updateTabBadge(tabBtn, count) {
        if (!tabBtn) return;
        
        tabBtn.style.position = "relative";
        let badge = tabBtn.querySelector(".tab-badge-count");

        if (count > 0) {
            const displayCount = count > 99 ? "99+" : count;
            if (!badge) {
                badge = document.createElement("span");
                badge.className = "tab-badge-count";
                badge.style.position = "absolute";
                badge.style.top = "-6px";
                badge.style.right = "-6px";
                badge.style.backgroundColor = "#ef4444";
                badge.style.color = "#ffffff";
                badge.style.fontSize = "0.7rem";
                badge.style.fontWeight = "bold";
                badge.style.borderRadius = "10px";
                badge.style.padding = "2px 6px";
                badge.style.minWidth = "18px";
                badge.style.height = "18px";
                badge.style.display = "flex";
                badge.style.alignItems = "center";
                badge.style.justifyContent = "center";
                badge.style.boxShadow = "0 2px 5px rgba(239, 68, 68, 0.5)";
                badge.style.border = "2px solid #0f0c1b";
                tabBtn.appendChild(badge);
            }
            badge.textContent = displayCount;
        } else if (badge) {
            badge.remove();
        }
    }

    function updateBadgesCount() {
        const pendingCount = allAdminsList.filter(item => (item.status || "approved") === "pending").length;

        let blockedIds = new Set();
        blockedRegistrationsList.forEach(item => blockedIds.add(item.docId || item.id || item.email));
        allAdminsList.forEach(item => {
            if (item.isBlocked === true || item.status === "blocked") {
                blockedIds.add(item.id || item.email);
            }
        });

        updateTabBadge(tabPendingAdmins, pendingCount);
        updateTabBadge(tabBlockedAdmins, blockedIds.size);
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentSuperAdmin = user;
            try {
                await getLatestAdminKey();
                let adminDocSnap = await getDoc(doc(db, "admins", user.uid));
                
                if (!adminDocSnap.exists()) {
                    adminDocSnap = await getDoc(doc(db, "superadmins", user.uid));
                }

                if (adminDocSnap.exists()) {
                    const data = adminDocSnap.data();
                    const role = (data.role || "").toLowerCase();

                    if (role !== "superadmin" && role !== "super_admin") {
                        alert("⚠️ คุณไม่มีสิทธิ์เข้าถึงหน้านี้ (เฉพาะ Super Admin เท่านั้น)");
                        window.location.href = "admin-dashboard.html";
                        return;
                    }

                    const displayName = data.displayName || user.displayName || "Super Admin";

                    if (userNameDisplay) userNameDisplay.textContent = displayName;
                    if (userOfficerIdDisplay) userOfficerIdDisplay.textContent = `รหัสเจ้าหน้าที่: ${data.officerId || data.adminCode || "SUPER-01"}`;
                    
                    if (userAvatar) {
                        const currentPhoto = data.photoURL || user.photoURL;
                        userAvatar.src = (currentPhoto && currentPhoto !== "") ? currentPhoto : generateDefaultAvatar(displayName);
                    }

                    listenToAdminsRealtime();
                } else {
                    alert("❌ ไม่พบข้อมูลสิทธิ์ผู้ดูแลระบบ");
                    window.location.href = "index.html";
                }
            } catch (error) {
                console.error("Error verifying Super Admin status:", error);
                window.location.href = "index.html";
            }
        } else {
            window.location.href = "index.html";
        }
    });

    function listenToAdminsRealtime() {
        if (unsubscribeAdmins) unsubscribeAdmins();
        if (unsubscribeBlocked) unsubscribeBlocked();

        unsubscribeAdmins = onSnapshot(collection(db, "admins"), (snapshot) => {
            allAdminsList = [];
            snapshot.forEach((docSnap) => {
                allAdminsList.push({
                    id: docSnap.id,
                    ...docSnap.data()
                });
            });

            if (totalAdminsCount) {
                totalAdminsCount.textContent = snapshot.size;
            }

            updateBadgesCount();
            renderAdminsTable();
        }, (error) => {
            console.error("Realtime admins error:", error);
        });

        unsubscribeBlocked = onSnapshot(collection(db, "blocked_registrations"), (snapshot) => {
            blockedRegistrationsList = [];
            snapshot.forEach((docSnap) => {
                blockedRegistrationsList.push({
                    id: docSnap.id,
                    ...docSnap.data()
                });
            });

            updateBadgesCount();
            renderAdminsTable();
        }, (error) => {
            console.warn("Realtime blocked_registrations error:", error);
        });
    }

    function formatDate(timestamp) {
        if (!timestamp) return "-";
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
    }

    function renderAdminsTable() {
        if (!adminTableBody) return;

        const searchTerm = (adminSearchInput ? adminSearchInput.value : "").trim().toLowerCase();
        let html = "";
        let index = 1;

        if (currentTab === "all") {
            if (tableTitle) tableTitle.innerHTML = `<i class="fa-solid fa-users-gear" style="margin-right: 8px; opacity: 0.8;"></i> รายชื่อผู้ดูแลระบบทั้งหมด`;

            const filteredAdmins = allAdminsList.filter(item => {
                const status = item.status || "approved";
                const isBlocked = item.isBlocked === true || status === "blocked";
                if (status === "pending" || isBlocked) return false;

                if (!searchTerm) return true;
                const name = (item.displayName || "").toLowerCase();
                const email = (item.email || "").toLowerCase();
                const officerId = (item.officerId || item.adminCode || "").toLowerCase();

                return name.includes(searchTerm) || email.includes(searchTerm) || officerId.includes(searchTerm);
            });

            filteredAdmins.sort((a, b) => {
                const roleA = (a.role || "").toLowerCase();
                const roleB = (b.role || "").toLowerCase();
                const isSuperA = roleA === "superadmin" || roleA === "super_admin";
                const isSuperB = roleB === "superadmin" || roleB === "super_admin";

                if (isSuperA && !isSuperB) return -1;
                if (!isSuperA && isSuperB) return 1;
                return 0;
            });

            filteredAdmins.forEach((adminData) => {
                const adminId = adminData.id;
                const isSelf = currentSuperAdmin && currentSuperAdmin.uid === adminId;
                const role = (adminData.role || "admin").toLowerCase();
                const isSuper = role === "superadmin" || role === "super_admin";

                const displayName = adminData.displayName || 'ไม่ระบุชื่อ';
                const avatarSrc = adminData.photoURL && adminData.photoURL !== "" 
                    ? adminData.photoURL 
                    : generateDefaultAvatar(displayName);

                const roleBadge = isSuper 
                    ? `<span style="background: rgba(168, 85, 247, 0.2); color: #c084fc; padding: 4px 10px; border-radius: 12px; font-size: 0.85rem; border: 1px solid rgba(168, 85, 247, 0.3);"><i class="fa-solid fa-crown"></i> Super Admin</span>`
                    : `<span style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; padding: 4px 10px; border-radius: 12px; font-size: 0.85rem; border: 1px solid rgba(56, 189, 248, 0.3);"><i class="fa-solid fa-user-shield"></i> Admin</span>`;

                html += `
                    <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
                        <td style="padding: 14px 16px;">${index++}</td>
                        <td style="padding: 14px 16px; font-weight: 500;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <img src="${avatarSrc}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
                                <div>
                                    <div>${displayName} ${isSelf ? ' <span style="font-size: 0.75rem; opacity: 0.6;">(คุณ)</span>' : ''}</div>
                                    <div style="font-size: 0.8rem; opacity: 0.6;">${adminData.email || ''}</div>
                                </div>
                            </div>
                        </td>
                        <td style="padding: 14px 16px; color: #38bdf8;">${adminData.officerId || adminData.adminCode || '-'}</td>
                        <td style="padding: 14px 16px;">${roleBadge}</td>
                        <td style="padding: 14px 16px; text-align: center;">
                            ${isSelf ? '<span style="font-size: 0.85rem; opacity: 0.5;">-</span>' : `
                                <div style="display: flex; gap: 8px; justify-content: center;">
                                    <button class="toggle-role-btn" data-id="${adminId}" data-name="${displayName}" data-role="${role}" title="เปลี่ยนสิทธิ์" style="background: rgba(255,255,255,0.1); border: none; color: inherit; padding: 6px 10px; border-radius: 6px; cursor: pointer;">
                                        <i class="fa-solid fa-arrows-rotate"></i>
                                    </button>
                                    <button class="delete-admin-btn" data-id="${adminId}" data-name="${displayName}" title="ลบผู้ดูแลระบบ" style="background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; padding: 6px 10px; border-radius: 6px; cursor: pointer;">
                                        <i class="fa-solid fa-trash-can"></i>
                                    </button>
                                </div>
                            `}
                        </td>
                    </tr>
                `;
            });
        } else if (currentTab === "pending") {
            if (tableTitle) tableTitle.innerHTML = `<i class="fa-solid fa-user-clock" style="margin-right: 8px; opacity: 0.8;"></i> คำขออนุมัติแอดมินใหม่`;

            const filteredPending = allAdminsList.filter(item => {
                const status = item.status || "approved";
                if (status !== "pending") return false;

                if (!searchTerm) return true;
                const name = (item.displayName || "").toLowerCase();
                const email = (item.email || "").toLowerCase();
                const officerId = (item.officerId || item.adminCode || "").toLowerCase();

                return name.includes(searchTerm) || email.includes(searchTerm) || officerId.includes(searchTerm);
            });

            filteredPending.forEach((adminData) => {
                const adminId = adminData.id;
                const displayName = adminData.displayName || 'ไม่ระบุชื่อ';
                const avatarSrc = adminData.photoURL && adminData.photoURL !== "" 
                    ? adminData.photoURL 
                    : generateDefaultAvatar(displayName);

                const pendingBadge = `<span style="background: rgba(234, 179, 8, 0.2); color: #fde047; padding: 4px 10px; border-radius: 12px; font-size: 0.85rem; border: 1px solid rgba(234, 179, 8, 0.3);"><i class="fa-solid fa-clock"></i> รออนุมัติ</span>`;

                html += `
                    <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
                        <td style="padding: 14px 16px;">${index++}</td>
                        <td style="padding: 14px 16px; font-weight: 500;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <img src="${avatarSrc}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
                                <div>
                                    <div>${displayName}</div>
                                    <div style="font-size: 0.8rem; opacity: 0.6;">${adminData.email || ''}</div>
                                </div>
                            </div>
                        </td>
                        <td style="padding: 14px 16px; color: #38bdf8;">${adminData.officerId || adminData.adminCode || '-'}</td>
                        <td style="padding: 14px 16px;">${pendingBadge}</td>
                        <td style="padding: 14px 16px; text-align: center;">
                            <div style="display: flex; gap: 8px; justify-content: center;">
                                <button class="approve-admin-btn" data-id="${adminId}" data-name="${displayName}" title="อนุมัติ" style="background: rgba(34, 197, 94, 0.2); border: 1px solid rgba(34, 197, 94, 0.4); color: #86efac; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: 500;">
                                    <i class="fa-solid fa-check"></i> อนุมัติ
                                </button>
                                <button class="reject-admin-btn" data-id="${adminId}" data-name="${displayName}" title="ปฏิเสธ" style="background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; padding: 6px 10px; border-radius: 6px; cursor: pointer;">
                                    <i class="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        } else if (currentTab === "blocked") {
            if (tableTitle) tableTitle.innerHTML = `<i class="fa-solid fa-user-slash" style="margin-right: 8px; color: #fca5a5;"></i> รายชื่อผู้ใช้งาน/แอดมินที่ถูกบล็อก`;

            let combinedBlockedList = [];

            blockedRegistrationsList.forEach(item => {
                combinedBlockedList.push({
                    docId: item.docId || item.id,
                    targetCollection: "blocked_registrations",
                    displayName: item.displayName || "ไม่ระบุชื่อ",
                    email: item.email || "-",
                    officerId: item.officerId || "-",
                    reason: item.reason || "ไม่ระบุเหตุผล",
                    blockType: item.blockType || "temporary",
                    blockUntil: item.blockUntil,
                    createdAt: item.createdAt
                });
            });

            allAdminsList.forEach(item => {
                const isBlocked = item.isBlocked === true || item.status === "blocked";
                if (isBlocked) {
                    const exists = combinedBlockedList.some(b => b.docId === item.id || b.email === item.email);
                    if (!exists) {
                        combinedBlockedList.push({
                            docId: item.id,
                            targetCollection: "admins",
                            displayName: item.displayName || "ไม่ระบุชื่อ",
                            email: item.email || "-",
                            officerId: item.officerId || item.adminCode || "-",
                            reason: item.reason || "ถูกบล็อกโดยผู้ดูแลระบบ",
                            blockType: "permanent",
                            blockUntil: null,
                            createdAt: item.updatedAt || item.createdAt
                        });
                    }
                }
            });

            const filteredBlocked = combinedBlockedList.filter(item => {
                if (!searchTerm) return true;
                const name = (item.displayName || "").toLowerCase();
                const email = (item.email || "").toLowerCase();
                const officerId = (item.officerId || "").toLowerCase();
                const reason = (item.reason || "").toLowerCase();

                return name.includes(searchTerm) || email.includes(searchTerm) || officerId.includes(searchTerm) || reason.includes(searchTerm);
            });

            filteredBlocked.forEach((blockedItem) => {
                const avatarSrc = generateDefaultAvatar(blockedItem.displayName);
                const blockTypeLabel = blockedItem.blockType === "temporary" 
                    ? `<span style="background: rgba(234, 179, 8, 0.2); color: #fde047; padding: 2px 8px; border-radius: 8px; font-size: 0.75rem;">ชั่วคราว</span>` 
                    : `<span style="background: rgba(239, 68, 68, 0.2); color: #fca5a5; padding: 2px 8px; border-radius: 8px; font-size: 0.75rem;">ถาวร</span>`;

                html += `
                    <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.08); opacity: 0.85;">
                        <td style="padding: 14px 16px;">${index++}</td>
                        <td style="padding: 14px 16px; font-weight: 500;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <img src="${avatarSrc}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
                                <div>
                                    <div>${blockedItem.displayName}</div>
                                    <div style="font-size: 0.8rem; opacity: 0.6;">${blockedItem.email}</div>
                                </div>
                            </div>
                        </td>
                        <td style="padding: 14px 16px; color: #38bdf8;">${blockedItem.officerId}</td>
                        <td style="padding: 14px 16px;">
                            <div style="font-size: 0.85rem; color: #fca5a5;">${blockedItem.reason}</div>
                            <div style="font-size: 0.75rem; opacity: 0.6; margin-top: 2px;">
                                ประเภท: ${blockTypeLabel} ${blockedItem.blockUntil ? ` | ถึง: ${formatDate(blockedItem.blockUntil)}` : ''}
                            </div>
                        </td>
                        <td style="padding: 14px 16px; text-align: center;">
                            <div style="display: flex; gap: 8px; justify-content: center;">
                                <button class="view-blocked-detail-btn" 
                                    data-id="${blockedItem.docId}"
                                    data-name="${blockedItem.displayName}"
                                    data-email="${blockedItem.email}"
                                    data-officer="${blockedItem.officerId}"
                                    data-reason="${blockedItem.reason}"
                                    data-until="${blockedItem.blockUntil ? formatDate(blockedItem.blockUntil) : 'ไม่มีกำหนด'}"
                                    data-collection="${blockedItem.targetCollection}"
                                    title="ดูข้อมูล" style="background: rgba(56, 189, 248, 0.2); border: 1px solid rgba(56, 189, 248, 0.4); color: #38bdf8; padding: 6px 10px; border-radius: 6px; cursor: pointer;">
                                    <i class="fa-solid fa-eye"></i> รายละเอียด
                                </button>
                                <button class="unblock-user-btn" 
                                    data-id="${blockedItem.docId}"
                                    data-name="${blockedItem.displayName}"
                                    data-collection="${blockedItem.targetCollection}"
                                    title="ปลดบล็อก" style="background: rgba(34, 197, 94, 0.2); border: 1px solid rgba(34, 197, 94, 0.4); color: #86efac; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: 500;">
                                    <i class="fa-solid fa-lock-open"></i> ปลดบล็อก
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }

        if (html === "") {
            adminTableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; opacity: 0.6; padding: 20px;">
                        ${searchTerm ? 'ไม่พบข้อมูลที่ตรงกับการค้นหา' : (currentTab === 'all' ? 'ไม่พบข้อมูลผู้ดูแลระบบ' : (currentTab === 'pending' ? 'ไม่มีคำขออนุมัติแอดมินใหม่ในขณะนี้' : 'ไม่มีผู้ใช้งานที่ถูกบล็อก'))}
                    </td>
                </tr>`;
            return;
        }

        adminTableBody.innerHTML = html;
        attachTableEventListeners();
    }

    if (changeAdminKeyBtn) {
        changeAdminKeyBtn.addEventListener("click", async () => {
            const currentInput = prompt("🔒 โปรดระบุ Admin Key ปัจจุบัน:");
            if (currentInput === null) return;

            const isValid = await validateAdminKey(currentInput);

            if (!isValid) {
                const keyInDb = await getLatestAdminKey();
                alert(`❌ Admin Key ปัจจุบันไม่ถูกต้อง!\n(คำใบ้ Key ในระบบตอนนี้คือ: "${keyInDb}")`);
                return;
            }

            const newKey = prompt("🔑 กรุณาระบุ Admin Key ใหม่ที่ต้องการใช้:");
            if (!newKey || newKey.trim() === "") {
                alert("⚠️ ไม่ได้กรอก Admin Key ใหม่");
                return;
            }

            try {
                await setDoc(doc(db, "system_settings", "config"), {
                    adminKey: newKey.trim(),
                    updatedAt: serverTimestamp(),
                    updatedBy: currentSuperAdmin ? currentSuperAdmin.uid : "system"
                }, { merge: true });

                activeSecretKey = newKey.trim();
                alert("🎉 เปลี่ยน Admin Key เรียบร้อยแล้ว!");
            } catch (err) {
                alert("❌ เกิดข้อผิดพลาดในการบันทึก Key: " + err.message);
            }
        });
    }

    if (adminSearchInput) {
        adminSearchInput.addEventListener("input", () => {
            renderAdminsTable();
        });
    }

    function setTabActive(activeBtn, inactiveBtn1, inactiveBtn2) {
        activeBtn.style.background = "rgba(168, 85, 247, 0.2)";
        activeBtn.style.borderColor = "rgba(168, 85, 247, 0.4)";
        activeBtn.style.color = "#ffffff";

        [inactiveBtn1, inactiveBtn2].forEach(btn => {
            if (btn) {
                btn.style.background = "rgba(255, 255, 255, 0.05)";
                btn.style.borderColor = "rgba(255, 255, 255, 0.15)";
                btn.style.color = "rgba(255, 255, 255, 0.8)";
            }
        });
    }

    if (tabAllAdmins) {
        tabAllAdmins.addEventListener("click", () => {
            currentTab = "all";
            setTabActive(tabAllAdmins, tabPendingAdmins, tabBlockedAdmins);
            renderAdminsTable();
        });
    }

    if (tabPendingAdmins) {
        tabPendingAdmins.addEventListener("click", () => {
            currentTab = "pending";
            setTabActive(tabPendingAdmins, tabAllAdmins, tabBlockedAdmins);
            renderAdminsTable();
        });
    }

    if (tabBlockedAdmins) {
        tabBlockedAdmins.addEventListener("click", () => {
            currentTab = "blocked";
            setTabActive(tabBlockedAdmins, tabAllAdmins, tabPendingAdmins);
            renderAdminsTable();
        });
    }

    function attachTableEventListeners() {
        // 🔄 ปุ่มเปลี่ยนสิทธิ์ (Toggle Role)
        document.querySelectorAll(".toggle-role-btn").forEach((btn) => {
            btn.addEventListener("click", async (e) => {
                const button = e.currentTarget;
                const adminId = button.getAttribute("data-id");
                const name = button.getAttribute("data-name");
                const currentRole = (button.getAttribute("data-role") || "admin").toLowerCase();

                const isSuper = currentRole === "superadmin" || currentRole === "super_admin";
                const targetRole = isSuper ? "admin" : "superadmin";
                const targetRoleLabel = isSuper ? "Admin" : "Super Admin";

                if (!confirm(`คุณต้องการเปลี่ยนสิทธิ์ของ "${name}" ให้เป็น ${targetRoleLabel} ใช่หรือไม่?`)) return;

                const inputKey = prompt("🔑 กรุณากรอก Admin Key เพื่อยืนยันการเปลี่ยนสิทธิ์:");
                if (inputKey === null) return;

                const isValid = await validateAdminKey(inputKey);
                if (!isValid) {
                    alert("❌ Admin Key ไม่ถูกต้อง!");
                    return;
                }

                try {
                    await updateDoc(doc(db, "admins", adminId), {
                        role: targetRole,
                        updatedAt: serverTimestamp()
                    });
                    alert(`🎉 เปลี่ยนสิทธิ์คุณ "${name}" เป็น ${targetRoleLabel} เรียบร้อยแล้ว`);
                } catch (err) {
                    alert("❌ เกิดข้อผิดพลาดในการเปลี่ยนสิทธิ์: " + err.message);
                }
            });
        });

        // 🗑️ ปุ่มลบผู้ดูแลระบบ (Delete Admin)
        document.querySelectorAll(".delete-admin-btn").forEach((btn) => {
            btn.addEventListener("click", async (e) => {
                const button = e.currentTarget;
                const adminId = button.getAttribute("data-id");
                const name = button.getAttribute("data-name");

                if (!confirm(`⚠️ คุณแน่ใจหรือไม่ว่าต้องการลบแอดมิน "${name}" ออกจากระบบ?`)) return;

                const inputKey = prompt("🔑 กรุณากรอก Admin Key เพื่อยืนยันการลบ:");
                if (inputKey === null) return;

                const isValid = await validateAdminKey(inputKey);
                if (!isValid) {
                    alert("❌ Admin Key ไม่ถูกต้อง!");
                    return;
                }

                try {
                    await deleteDoc(doc(db, "admins", adminId));
                    alert(`🎉 ลบผู้ดูแลระบบ "${name}" เรียบร้อยแล้ว`);
                } catch (err) {
                    alert("❌ เกิดข้อผิดพลาดในการลบ: " + err.message);
                }
            });
        });

        // ✅ ปุ่มอนุมัติ (Approve Admin)
        document.querySelectorAll(".approve-admin-btn").forEach((btn) => {
            btn.addEventListener("click", async (e) => {
                const button = e.currentTarget;
                const adminId = button.getAttribute("data-id");
                const name = button.getAttribute("data-name");

                if (!confirm(`คุณต้องการอนุมัติการสมัครของ "${name}" ใช่หรือไม่?`)) return;

                try {
                    await updateDoc(doc(db, "admins", adminId), {
                        status: "approved",
                        updatedAt: serverTimestamp()
                    });
                    alert(`🎉 อนุมัติการสมัครของคุณ "${name}" เรียบร้อยแล้ว`);
                } catch (err) {
                    alert("❌ เกิดข้อผิดพลาดในการอนุมัติ: " + err.message);
                }
            });
        });

        // ❌ ปุ่มปฏิเสธ (Reject Admin)
        document.querySelectorAll(".reject-admin-btn").forEach((btn) => {
            btn.addEventListener("click", async (e) => {
                const button = e.currentTarget;
                const adminId = button.getAttribute("data-id");
                const name = button.getAttribute("data-name");

                if (!confirm(`คุณต้องการปฏิเสธคำขอสมัครของ "${name}" ใช่หรือไม่?`)) return;

                try {
                    await deleteDoc(doc(db, "admins", adminId));
                    alert(`🎉 ปฏิเสธคำขอของคุณ "${name}" เรียบร้อยแล้ว`);
                } catch (err) {
                    alert("❌ เกิดข้อผิดพลาดในการปฏิเสธคำขอ: " + err.message);
                }
            });
        });

        // 👁️ ปุ่มดูรายละเอียดผู้ถูกบล็อก
        document.querySelectorAll(".view-blocked-detail-btn").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                const button = e.currentTarget;
                const name = button.getAttribute("data-name");
                const email = button.getAttribute("data-email");
                const officer = button.getAttribute("data-officer");
                const reason = button.getAttribute("data-reason");
                const until = button.getAttribute("data-until");

                alert(`📋 รายละเอียดผู้ถูกบล็อก:\n---------------------------\n👤 ชื่อ: ${name}\n📧 อีเมล: ${email}\n🪪 รหัส: ${officer}\n⚠️ สาเหตุที่บล็อก: ${reason}\n⏳ บล็อกถึงวันที่: ${until}`);
            });
        });

        // 🔓 ปุ่มปลดบล็อก (อัปเดตลบ blocked_users ออกด้วย)
        document.querySelectorAll(".unblock-user-btn").forEach((btn) => {
            btn.addEventListener("click", async (e) => {
                const button = e.currentTarget;
                const docId = button.getAttribute("data-id");
                const name = button.getAttribute("data-name");

                if (!confirm(`คุณต้องการปลดบล็อกคุณ "${name}" ใช่หรือไม่?\n(ข้อมูลการบล็อกทั้งหมดจะถูกลบออกจากระบบทันที)`)) return;

                const inputKey = prompt(`🔑 กรุณากรอก Admin Key เพื่อยืนยันการปลดบล็อก:`);
                if (inputKey === null) return;

                const isValid = await validateAdminKey(inputKey);

                if (!isValid) {
                    alert("❌ Admin Key ไม่ถูกต้อง!");
                    return;
                }

                try {
                    const batch = writeBatch(db);

                    // 1. ลบออกจากคอลเลกชัน blocked_users (ตามในภาพ)
                    const blockedUserRef = doc(db, "blocked_users", docId);
                    const blockedUserSnap = await getDoc(blockedUserRef);
                    if (blockedUserSnap.exists()) {
                        batch.delete(blockedUserRef);
                    }

                    // 2. ลบออกจากคอลเลกชัน blocked_registrations
                    const blockedRegRef = doc(db, "blocked_registrations", docId);
                    const blockedRegSnap = await getDoc(blockedRegRef);
                    if (blockedRegSnap.exists()) {
                        batch.delete(blockedRegRef);
                    }

                    // 3. ลบเอกสารเก่าในคอลเลกชัน admins (ถ้ามี)
                    const adminRef = doc(db, "admins", docId);
                    const adminSnap = await getDoc(adminRef);
                    if (adminSnap.exists()) {
                        batch.delete(adminRef);
                    }

                    await batch.commit();

                    alert(`🎉 ปลดบล็อกและลบข้อมูลคุณ "${name}" ออกจากระบบเรียบร้อยแล้ว\nผู้ใช้งานสามารถสมัคร/ลงทะเบียนใหม่ได้ทันที`);
                } catch (err) {
                    alert("❌ เกิดข้อผิดพลาดในการปลดบล็อก: " + err.message);
                }
            });
        });
    }
});
