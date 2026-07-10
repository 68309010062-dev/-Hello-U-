<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>หน้าตั้งค่า</title>
    <!-- นำเข้าไอคอนจาก FontAwesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="settings.css">
</head>
<body>

    <!-- 👤 แถบด้านบนแสดงโปรไฟล์ (ถอดโครงสร้างตามหน้าหลักเป๊ะๆ) -->
    <div class="top-bar">
        <div class="user-info">
            <div id="userNameDisplay">ชื่อผู้ใช้: กำลังโหลด...</div>
            <div id="portfolioCountDisplay">จำนวนผลงาน: 0 ชิ้น</div>
        </div>
        <img id="userAvatar" src="https://cdn-icons-png.flaticon.com/512/149/149071.png" alt="User Avatar" class="avatar-img">
    </div>

    <!-- ส่วนเนื้อหาหน้าตั้งค่า -->
    <div class="settings-container">
        <h1 class="page-title">หน้าตั้งค่า</h1>

        <!-- ส่วนเปลี่ยนสีพื้นหลัง -->
        <div class="section-box">
            <h2>เปลี่ยนสีพื้นหลัง</h2>
            <div class="color-container">
                <button id="bgWhiteBtn" class="color-btn color-white" title="สีขาว"></button>
                <button id="bgGradBtn" class="color-btn color-gradient" title="สีไล่เฉด"></button>
                <button id="bgBlackBtn" class="color-btn color-black" title="สีดำ"></button>
            </div>
        </div>

        <!-- ปุ่มแอคชันด้านล่าง -->
        <div class="action-container">
            <button id="logoutBtn" class="btn btn-logout">
                <i class="fa-solid fa-right-from-bracket"></i> ลงชื่อออก
            </button>
            <button id="deleteAccountBtn" class="btn btn-delete">
                <i class="fa-solid fa-trash-can"></i> ลบบัญชีผู้ใช้
            </button>
        </div>
    </div>

    <!-- ========================================== -->
    <!-- ป๊อปอัป Modal ยืนยันการลบบัญชีผู้ใช้ (ปรับสเกลเพื่อโทรศัพท์โดยเฉพาะ) -->
    <!-- ========================================== -->
    <div id="deleteModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); z-index: 9999; justify-content: center; align-items: center; backdrop-filter: blur(5px); padding: 16px; box-sizing: border-box;">
        <div style="background: #1e1b29; color: white; padding: 20px; border-radius: 16px; width: 100%; max-width: 320px; text-align: center; border: 1px solid #ff4d4d; box-shadow: 0 8px 32px rgba(0,0,0,0.5); font-family: sans-serif; box-sizing: border-box;">
            
            <i class="fa-solid fa-circle-exclamation" style="font-size: 36px; color: #ff4d4d; margin-bottom: 10px;"></i>
            <h2 style="color: #ff4d4d; margin: 0 0 6px 0; font-size: 18px; font-weight: bold;">ยืนยันการลบบัญชีถาวร</h2>
            <p style="font-size: 12px; color: #cbd5e0; margin: 0 0 16px 0; line-height: 1.4; padding: 0 8px;">ข้อมูลผลงานทั้งหมดของคุณจะถูกลบออกจากระบบทันทีและไม่สามารถกู้คืนได้</p>
            
            <div style="background: rgba(255,255,255,0.04); padding: 10px; border-radius: 8px; margin-bottom: 16px; border: 1px dashed rgba(255,255,255,0.15);">
                <p style="font-size: 11px; color: #a0aec0; margin: 0 0 4px 0;">กรุณาพิมพ์อีเมลของคุณเพื่อยืนยัน:</p>
                <strong id="modalUserEmailText" style="font-size: 13px; color: #38bdf8; word-break: break-all; display: block; padding: 0 2px;">...</strong>
            </div>

            <input type="text" id="deleteConfirmInput" placeholder="พิมพ์ชื่ออีเมลของคุณที่นี่" autocomplete="off" style="width: 100%; padding: 12px; margin-bottom: 16px; border-radius: 8px; border: 1px solid #4a5568; background: #0f0c1b; color: white; font-size: 14px; text-align: center; box-sizing: border-box; outline: none; -webkit-appearance: none;">
            
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button id="cancelDeleteBtn" type="button" style="flex: 1; padding: 12px; background: #4a5568; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer; -webkit-tap-highlight-color: transparent;">ยกเลิก</button>
                <button id="finalDeleteBtn" type="button" style="flex: 1; padding: 12px; background: #ff4d4d; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer; -webkit-tap-highlight-color: transparent;">ลบบัญชี</button>
            </div>
        </div>
    </div>

    <!-- เชื่อมต่อสคริปต์ JavaScript -->
    <script type="module" src="settings.js"></script>
</body>
</html>
