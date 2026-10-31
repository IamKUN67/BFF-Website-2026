# ติดตั้งระบบล็อกอินครู (Cloudflare Worker) — ทำครั้งเดียว

ระบบนี้ให้ครูล็อกอินด้วยชื่อผู้ใช้/รหัสผ่านที่คุณกำหนด แล้วแก้ได้เฉพาะคอร์สของตัวเอง โดยไม่ต้องมีบัญชี GitHub

## 1) สร้างโทเคน GitHub สำหรับตัวกลาง (ใช้เฉพาะ repo นี้)
GitHub > รูปโปรไฟล์ > Settings > Developer settings > Personal access tokens > **Fine-grained tokens** > Generate new token
- Repository access: **Only select repositories** เลือก BFF-Website-2026
- Permissions > Repository permissions > **Contents: Read and write**
- คัดลอกโทเคน (ขึ้นต้น github_pat_...) เก็บไว้ ห้ามแจกใคร

## 2) สร้าง Worker
1. สมัคร cloudflare.com (ฟรี) > Workers & Pages > Create > **Create Worker** ตั้งชื่อ เช่น bff-teacher > Deploy
2. กด **Edit code** ลบโค้ดเดิม วางโค้ดจากไฟล์ `worker/teacher-api.js` ทั้งหมด > Deploy
3. จดที่อยู่ Worker เช่น `https://bff-teacher.ชื่อคุณ.workers.dev`

## 3) ตั้งค่าตัวแปร (Worker > Settings > Variables and Secrets)
ชนิด Text:
- `GITHUB_REPO` = `IamKUN67/BFF-Website-2026`
- `GITHUB_BRANCH` = `main`
- `SITE_URL` = `https://iamkun67.github.io/BFF-Website-2026`
- `ALLOWED_ORIGIN` = `https://iamkun67.github.io`

ชนิด **Secret** (ซ่อนค่า):
- `GITHUB_TOKEN` = โทเคนจากข้อ 1
- `SESSION_SECRET` = ข้อความสุ่มยาวๆ (พิมพ์มั่ว 40 ตัวขึ้นไป)
- `USERS` = รายชื่อบัญชี (ดูข้อ 4)

## 4) สร้างบัญชีครู
เปิด `https://iamkun67.github.io/BFF-Website-2026/tools/password.html` กรอกชื่อผู้ใช้ รหัสผ่าน เลือกครู กด "สร้างบัญชี" ได้ข้อความ 1 บรรทัด
นำทุกบัญชีมารวมเป็น JSON ก้อนเดียวแล้ววางในตัวแปร USERS:
```
{ "somchai": {...}, "malee": {...} }
```
ลบหรือเปลี่ยนรหัส = แก้ USERS แล้วกด Deploy (ครูที่ถูกลบจะเข้าไม่ได้ทันที)

## 5) ผูกกับเว็บ
หน้าแอดมิน > ตั้งค่าเว็บไซต์ > ตั้งค่าทั่วไป > ช่อง "ที่อยู่ระบบล็อกอินครู" ใส่ที่อยู่ Worker (https://...) แล้วเผยแพร่
และในหน้าวิชา > คอร์ส ให้เลือกชื่อครูในช่อง "ครูผู้สอน" ของคอร์สนั้น (บัญชีครูจะเห็นเฉพาะคอร์สที่เลือกชื่อตัวเอง)

## ข้อควรรู้
- ไฟล์ที่ครูฝากต้องไม่เกิน 6 MB (แผน Worker ฟรี มีเวลาประมวลผลจำกัด) ชนิดที่รองรับ: pdf doc(x) ppt(x) xls(x) zip rar 7z txt csv รูป
- ทุกครั้งที่ครูกดบันทึก เว็บจะ build ใหม่ 1–3 นาที
- ข้อมูลที่ครูแก้เก็บที่ `src/content/course-updates/ชื่อผู้ใช้.json` และไฟล์ที่ `public/uploads/teachers/ชื่อผู้ใช้/` (ดู/ลบได้ใน GitHub)
- ครูแก้ได้แค่: ลิงก์สมัคร, ติ๊กปิดรับสมัคร/คอร์สจบแล้ว, เอกสารของตนเอง ส่วนเนื้อหาอื่นของคอร์สยังแก้ผ่าน CMS โดยคุณ
