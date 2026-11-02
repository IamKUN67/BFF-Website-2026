# ติดตั้งระบบครู (Cloudflare Worker v2) — ทำครั้งเดียว

ครูล็อกอินด้วยชื่อผู้ใช้/รหัสผ่านที่คุณกำหนด เพิ่ม-แก้-ลบคอร์สของตัวเอง ฝากเอกสาร และแก้โปรไฟล์ โดยไม่ต้องมีบัญชี GitHub
คุณ (เจ้าของ) จัดการบัญชีครูได้ที่ `/admin/accounts.html` (มีปุ่ม “จัดการบัญชีครู” มุมซ้ายล่างของหน้า CMS) รวมถึงตั้งรหัสใหม่เมื่อครูลืม

## 1) โทเคน GitHub (ใช้เฉพาะ repo นี้)
GitHub > รูปโปรไฟล์ > Settings > Developer settings > Personal access tokens > **Fine-grained tokens** > Generate new token
- Repository access: **Only select repositories** > BFF-Website-2026
- Repository permissions > **Contents: Read and write**
- คัดลอกโทเคน (github_pat_...) เก็บไว้ ห้ามแจกใคร

## 2) สร้าง Worker
1. cloudflare.com (สมัครฟรี) > Workers & Pages > Create > **Create Worker** ตั้งชื่อ เช่น bff-teacher > Deploy
2. **Edit code** ลบโค้ดเดิม วางโค้ดจาก `worker/teacher-api.js` ทั้งหมด > Deploy
3. จดที่อยู่ Worker เช่น `https://bff-teacher.ชื่อคุณ.workers.dev`

## 3) สร้างที่เก็บบัญชี (KV)
Cloudflare > Storage & Databases > **KV** > Create namespace ชื่อ `bff-accounts`
จากนั้น Worker > Settings > **Bindings** > Add > KV namespace > Variable name = `ACCOUNTS` เลือก namespace ที่สร้าง > Deploy

## 4) ตัวแปร (Worker > Settings > Variables and Secrets)
ชนิด Text:
- `GITHUB_REPO` = `IamKUN67/BFF-Website-2026`
- `GITHUB_BRANCH` = `main`
- `SITE_URL` = `https://iamkun67.github.io/BFF-Website-2026`
- `ALLOWED_ORIGIN` = `https://iamkun67.github.io`

ชนิด **Secret**:
- `GITHUB_TOKEN` = โทเคนข้อ 1
- `SESSION_SECRET` = ข้อความสุ่มยาวๆ 40 ตัวขึ้นไป
- `OWNER_USERNAME` = ชื่อผู้ใช้ของคุณเอง (เช่น owner)
- `OWNER_PASSWORD` = รหัสผ่านของคุณเอง (ยาวๆ เดายาก) — ลืมให้มาแก้ค่านี้ที่ Cloudflare

(รุ่นเก่าที่ใช้ `USERS` ไม่ต้องใช้แล้ว ลบทิ้งได้)

## 5) ผูกกับเว็บ
CMS > ตั้งค่าเว็บไซต์ > ตั้งค่าทั่วไป > “ที่อยู่ระบบล็อกอินครู” ใส่ที่อยู่ Worker แล้วเผยแพร่

## 6) เริ่มใช้งาน
1. ใน CMS หน้าวิชาที่อยากให้ครูเพิ่มคอร์ส ให้ติ๊ก **“เปิดให้ครูเพิ่มคอร์สของตัวเองในหน้านี้”**
2. ใน CMS เมนู **ครูผู้สอน** เพิ่มรายชื่อครูก่อน
3. เปิด `/admin/accounts.html` ล็อกอินด้วยบัญชีเจ้าของ > เพิ่มบัญชีครู (ชื่อผู้ใช้ รหัสผ่าน ผูกกับรายชื่อครู) แล้วส่งรหัสให้ครู
4. ครูเข้า `/login/` (ไอคอนกุญแจบนเว็บ) > ใช้งานพื้นที่ครู

## ข้อควรรู้
- ไฟล์ที่ครูฝากไม่เกิน 6 MB (Worker ฟรีมีเวลาประมวลผลจำกัด) รองรับ pdf doc(x) ppt(x) xls(x) zip rar 7z txt csv และรูป
- ทุกครั้งที่ครูกดบันทึก เว็บ build ใหม่ 1–3 นาที
- คอร์สที่ครูสร้างเก็บที่ `src/content/teacher-courses/` โปรไฟล์ครูอยู่ใน `src/content/teachers/` ไฟล์ที่ฝากอยู่ `public/uploads/teachers/` (ดู/ลบได้ใน GitHub)
- คอร์สที่คุณสร้างใน CMS ครูแก้ได้เฉพาะลิงก์สมัคร สถานะ และเอกสาร ส่วนชื่อวิชา/หน้าวิชาแก้ที่ CMS โดยคุณเท่านั้น
