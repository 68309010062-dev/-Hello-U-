import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentStep = 1;
let totalSteps = 5; // ค่าเริ่มต้นสำหรับ User ทั่วไป
let currentUser = null;
let userTargetCollection = "users"; // เก็บชื่อ Collection ('admins' หรือ 'users')
let userRole = "user"; // เก็บสิทธิ์ผู้ใช้ ('user', 'admin', 'superadmin')

// UI Elements
const form = document.getElementById('questionnaireForm');
const steps = document.querySelectorAll('.question-step');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const submitBtn = document.getElementById('submitBtn');
const progressBar = document.getElementById('progressBar');
const stepIndicator = document.getElementById('stepIndicator');
const nameInput = document.getElementById('userFullName');

// 1. ตรวจสอบสถานะและประเภทสิทธิ์ของผู้ใช้ (Admin / Super Admin / User)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;

        try {
            // 🛡️ 1. ตรวจสอบในคอลเลกชัน 'admins' ก่อน (Admin & Super Admin)
            const adminDocSnap = await getDoc(doc(db, "admins", user.uid));
            
            if (adminDocSnap.exists()) {
                userTargetCollection = "admins";
                const adminData = adminDocSnap.data();
                userRole = adminData.role || "admin";

                // 👑 หากเป็น Admin/Super Admin ให้ลดจำนวนข้อลงเหลือ 4 ข้อ (ข้ามข้อจุดประสงค์)
                totalSteps = 4;

                // หากทำแบบสอบถามแล้ว ให้แยกหน้า Dashboard ตามสิทธิ์
                if (adminData.isProfileComplete) {
                    redirectToDashboard(userRole);
                    return;
                }

                if (adminData.displayName && nameInput) {
                    nameInput.value = adminData.displayName;
                }
            } else {
                // 👤 2. หากไม่พบใน 'admins' ให้ตรวจสอบใน 'users'
                const userDocSnap = await getDoc(doc(db, "users", user.uid));
                if (userDocSnap.exists()) {
                    userTargetCollection = "users";
                    const userData = userDocSnap.data();
                    userRole = userData.role || "user";
                    totalSteps = 5;

                    // ตอบแบบสอบถามแล้ว ให้ไปหน้าหลัก
                    if (userData.isProfileComplete) {
                        redirectToDashboard(userRole);
                        return;
                    }

                    if (userData.displayName && nameInput) {
                        nameInput.value = userData.displayName;
                    }
                }
            }
        } catch (error) {
            console.error("เกิดข้อผิดพลาดในการตรวจสอบข้อมูลผู้ใช้:", error);
        }

        // อัปเดตการแสดงผลของหน้าหลังจากได้สิทธิ์และจำนวน steps เรียบร้อย
        updateStepView();
    } else {
        window.location.href = "index.html";
    }
});

// ฟังก์ชันนำทางไปยัง Dashboard ตามระดับสิทธิ์
function redirectToDashboard(role) {
    const r = (role || "").toLowerCase();
    if (r === "superadmin" || r === "super_admin") {
        window.location.href = "super-admin-dashboard.html";
    } else if (r === "admin") {
        window.location.href = "admin-dashboard.html";
    } else {
        window.location.href = "main.html";
    }
}

// 2. ฟังก์ชันอัปเดตหน้าแสดงผลคำถาม
function updateStepView() {
    steps.forEach(step => {
        const stepNum = parseInt(step.dataset.step);
        if (stepNum === currentStep) {
            step.classList.add('active');
        } else {
            step.classList.remove('active');
        }
    });

    const progressPercent = (currentStep / totalSteps) * 100;
    progressBar.style.width = `${progressPercent}%`;
    stepIndicator.innerText = `คำถาม ${currentStep} จาก ${totalSteps}`;

    prevBtn.style.display = currentStep === 1 ? 'none' : 'block';
    if (currentStep === totalSteps) {
        nextBtn.style.display = 'none';
        submitBtn.style.display = 'block';
    } else {
        nextBtn.style.display = 'block';
        submitBtn.style.display = 'none';
    }
}

// 3. ตรวจสอบการกรอกข้อมูลทีละขั้นตอน
function validateCurrentStep() {
    if (currentStep === 1 && !nameInput.value.trim()) {
        alert("⚠️ กรุณากรอกชื่อ-นามสกุลของคุณ");
        nameInput.focus();
        return false;
    } else if (currentStep === 2 && !document.getElementById('birthDate').value) {
        alert("⚠️ กรุณาเลือกวัน/เดือน/ปีเกิด");
        return false;
    } else if (currentStep === 3 && !document.querySelector('input[name="gender"]:checked')) {
        alert("⚠️ กรุณาเลือกเพศของคุณ");
        return false;
    } else if (currentStep === 4 && !document.getElementById('education').value) {
        alert("⚠️ กรุณาเลือกวุฒิการศึกษา");
        return false;
    } else if (currentStep === 5 && totalSteps === 5 && !document.querySelector('input[name="reason"]:checked')) {
        alert("⚠️ กรุณาเลือกจุดประสงค์การใช้งาน");
        return false;
    }
    return true;
}

// 4. Event Listeners ปุ่มถัดไป/ย้อนกลับ
nextBtn.addEventListener('click', () => {
    if (validateCurrentStep() && currentStep < totalSteps) {
        currentStep++;
        updateStepView();
    }
});

prevBtn.addEventListener('click', () => {
    if (currentStep > 1) {
        currentStep--;
        updateStepView();
    }
});

// 5. บันทึกข้อมูลไปยัง Collection ที่ถูกต้อง (admins หรือ users)
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!validateCurrentStep() || !currentUser) return;

    // แปลง ค.ศ. (จาก input date) เป็น พ.ศ.
    const rawBirthDate = document.getElementById('birthDate').value;
    const [yearAD, month, day] = rawBirthDate.split('-');
    const yearBE = parseInt(yearAD) + 543;
    const birthDateInBE = `${day}/${month}/${yearBE}`;

    // เตรียม Payload ข้อมูล
    const payload = {
        displayName: nameInput.value.trim(),
        birthDate: birthDateInBE,
        gender: document.querySelector('input[name="gender"]:checked')?.value,
        education: document.getElementById('education').value,
        isProfileComplete: true,
        updatedAt: new Date()
    };

    // ใส่ข้อมูล usageReason เฉพาะ User ทั่วไปที่มีขั้นตอนที่ 5
    if (totalSteps === 5) {
        payload.usageReason = document.querySelector('input[name="reason"]:checked')?.value || "";
    }

    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึกข้อมูล...`;

        // บันทึกไปยัง Target Collection ที่ระบุ (admins หรือ users)
        await updateDoc(doc(db, userTargetCollection, currentUser.uid), payload);

        // นำทางไปยัง Dashboard ที่เหมาะสม
        redirectToDashboard(userRole);

    } catch (error) {
        console.error("Error saving questionnaire:", error);
        alert("❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + error.message);
        submitBtn.disabled = false;
        submitBtn.innerHTML = `🚀 บันทึกและเข้าสู่ระบบ`;
    }
});

updateStepView();
