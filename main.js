import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, collection, addDoc, query, where, getDocs, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

document.addEventListener("DOMContentLoaded", () => {
    let currentUserId = null;

    const userNameDisplay = document.getElementById("userNameDisplay");
    const portfolioCountDisplay = document.getElementById("portfolioCountDisplay");
    const userAvatar = document.getElementById("userAvatar");
    
    const addPortfolioBtn = document.getElementById("addPortfolioBtn");
    const floatingAddBtn = document.getElementById("floatingAddBtn");
    const uploadOptionsBox = document.getElementById("uploadOptionsBox");
    const optionItems = document.querySelectorAll(".option-item");
    const fileInputHidden = document.getElementById("fileInputHidden");
    const portfolioContainer = document.getElementById("portfolioContainer");

    const previewModal = document.getElementById("previewModal");
    const modalContentArea = document.getElementById("modalContentArea");
    const closeModalBtn = document.getElementById("closeModalBtn");
    const modalDownloadBtn = document.getElementById("modalDownloadBtn");

    let scale = 1; let pointX = 0; let pointY = 0; let startX = 0; let startY = 0;
    let isPanning = false; let evCache = []; let prevDiff = -1;

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

    // ดึงข้อมูลรูปภาพและลิงก์มาแสดงผล
    async function loadPortfolios() {
        if (!currentUserId || !portfolioContainer) return;
        try {
            portfolioContainer.innerHTML = "<p style='color: white; text-align: center; opacity: 0.7;'>กำลังดึงรายการผลงาน...</p>";
            const portfolioRef = collection(db, "portfolios");
            const q = query(portfolioRef, where("userId", "==", currentUserId));
            const querySnapshot = await getDocs(q);

            portfolioContainer.innerHTML = ""; 
            let count = 0;

            if (querySnapshot.empty) {
                portfolioContainer.innerHTML = "<p style='color: #a0aec0; text-align: center; font-size: 14px;'>ยังไม่มีผลงานที่บันทึกไว้</p>";
                portfolioCountDisplay.textContent = `จำนวนผลงาน: 0 ชิ้น`;
                return;
            }

            querySnapshot.forEach((documentItem) => {
                count++;
                const data = documentItem.data();
                const docId = documentItem.id; 
                
                const card = document.createElement("div");
                card.style.background = "rgba(255, 255, 255, 0.08)";
                card.style.padding = "15px";
                card.style.borderRadius = "12px";
                card.style.color = "white";
                card.style.display = "flex";
                card.style.alignItems = "center";
                card.style.justifyContent = "space-between";
                card.style.border = "1px solid rgba(255, 255, 255, 0.1)";

                let actionButton = "";
                let typeIcon = "";

                if (data.fileType && data.fileType.startsWith("image/")) {
                    typeIcon = `<img src="${data.content}" style="width: 42px; height: 42px; object-fit: cover; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2)"/>`;
                    actionButton = `<button class="view-file-btn" data-id="${docId}" style="background: #4a5568; color: white; padding: 6px 12px; border: none; border-radius: 6px; font-size: 13px; font-weight: bold; margin-right: 8px; cursor: pointer;"><i class="fa-solid fa-eye"></i> กดดูรูปภาพ</button>`;
                } else {
                    typeIcon = `<i class="fa-solid fa-link" style="font-size: 20px; color: #4299e1;"></i>`;
                    actionButton = `<a href="${data.content}" target="_blank" style="background: #2b6cb0; color: white; padding: 6px 12px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: bold; margin-right: 8px;"><i class="fa-solid fa-arrow-up-right-from-square"></i> เปิดลิงก์</a>`;
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

            portfolioCountDisplay.textContent = `จำนวนผลงาน: ${count} ชิ้น`;

            // ดึงพรีวิวรูปขึ้นมาดูแบบซูมได้
            document.querySelectorAll(".view-file-btn").forEach(btn => {
                btn.addEventListener("click", function() {
                    const idToView = this.getAttribute("data-id");
                    const targetDoc = querySnapshot.docs.find(d => d.id === idToView);
                    if (targetDoc && previewModal && modalContentArea) {
                        const fileData = targetDoc.data();
                        modalContentArea.innerHTML = "";
                        
                        scale = 1; pointX = 0; pointY = 0; evCache = []; prevDiff = -1;

                        if (modalDownloadBtn) {
                            modalDownloadBtn.href = fileData.content;
                            modalDownloadBtn.setAttribute("download", fileData.title);
                            modalDownloadBtn.style.display = "flex"; 
                        }

                        modalContentArea.innerHTML = `<img id="zoomable-img" src="${fileData.content}" style="max-width: 100%; max-height: 100%; object-fit: contain; transform: translate(0px, 0px) scale(1); transform-origin: center; cursor: grab; user-select: none; transition: transform 0.1s ease-out;" draggable="false" />`;
                        initZoomAndPan();
                        previewModal.style.display = "flex";
                    }
                });
            });

            // ลบรูปภาพหรือลิงก์
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

        } catch (error) { console.error(error); }
    }

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

    // 🎯 ระบบบีบอัดรูปภาพอัตโนมัติก่อนบันทึก
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

                    // ควบคุมความกว้างสูงสุดไม่เกิน 1200px ให้ภาพยังชัดแต่ขนาดเบาหวิว
                    const MAX_WIDTH = 1200;
                    if (width > MAX_WIDTH) {
                        height = Math.round((height * MAX_WIDTH) / width);
                        width = MAX_WIDTH;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, width, height);

                    // บีบอัดคุณภาพเหลือ 70% เซฟพื้นที่ Firestore ได้ดีมาก
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

    // ดักจับเมื่อผู้ใช้เลือกไฟล์รูปภาพจากเครื่อง
    if (fileInputHidden) {
        fileInputHidden.setAttribute("accept", "image/*");
        fileInputHidden.addEventListener("change", async (event) => {
            const file = event.target.files[0];
            if (!file || !currentUserId) return;

            const title = file.name;
            
            // บีบอัดรูปทันทีก่อนอัปโหลด
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
