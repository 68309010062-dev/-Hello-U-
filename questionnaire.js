import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentStep = 1;
const totalSteps = 5;
let currentUser = null;

// UI Elements
const form = document.getElementById('questionnaireForm');
const steps = document.querySelectorAll('.question-step');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const submitBtn = document.getElementById('submitBtn');
const progressBar = document.getElementById('progressBar');
const stepIndicator = document.getElementById('stepIndicator');
const nameInput = document.getElementById('userFullName');

// 1. ตรวจสอบสถานะและประเภทสิทธิ์ของผู้ใช้
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;

        // 🛡️ เช็กว่าเป็น Admin หรือไม่ (ถ้าใช่ ให้เด้งออกไปหน้า Admin ทันที)
        const adminDoc = await getDoc(doc(db, "admins", user.uid));
        if (adminDoc.exists()) {
            window.location.href = "admin-dashboard.html";
            return;
        }

        // 👤 เช็กข้อมูลผู้ใช้ทั่วไปใน 'users'
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            
            // ตอบแบบสอบถามแล้ว ให้ไปหน้าหลัก
            if (data.isProfileComplete) {
                window.location.href = "main.html";
                return;
            }

            if (data.displayName) {
                nameInput.value = data.displayName;
            }
        }
    } else {
        window.location.href = "index.html";
    }
});

// 2. ฟังก์ชันอัปเดตหน้าแสดงผลคำถาม
function updateStepView() {
    steps.forEach(step => {
        if (parseInt(step.dataset.step) === currentStep) {
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
    } else if (currentStep === 5 && !document.querySelector('input[name="reason"]:checked')) {
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

// 5. บันทึกข้อมูลเฉพาะ User ทั่วไป
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!validateCurrentStep() || !currentUser) return;

    // 💡 แปลง ค.ศ. (จาก input date) เป็น พ.ศ. เพื่อเก็บเข้าฐานข้อมูล
    const rawBirthDate = document.getElementById('birthDate').value; // เช่น "2002-05-20"
    const [yearAD, month, day] = rawBirthDate.split('-');
    const yearBE = parseInt(yearAD) + 543; // บวก 543
    const birthDateInBE = `${day}/${month}/${yearBE}`; // ได้เป็น "20/05/2545"

    try {
        await updateDoc(doc(db, "users", currentUser.uid), {
            displayName: nameInput.value.trim(),
            birthDate: birthDateInBE, // บันทึกค่า วัน/เดือน/ปี(พ.ศ.) ลง Firestore
            gender: document.querySelector('input[name="gender"]:checked')?.value,
            education: document.getElementById('education').value,
            usageReason: document.querySelector('input[name="reason"]:checked')?.value,
            isProfileComplete: true,
            updatedAt: new Date()
        });

        window.location.href = "main.html";

    } catch (error) {
        console.error("Error saving questionnaire:", error);
        alert("❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + error.message);
    }
});

updateStepView();
