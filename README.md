# ⚔️ War of the Three Friend (สงครามสามก๊กเพื่อนซี้)

เกมกระดานสามก๊กออนไลน์ เล่นกับเพื่อนต่างเน็ตได้ผ่านเว็บเบราว์เซอร์
สร้างห้อง / เข้าด้วยรหัสห้อง / เล่นเรียลไทม์ผ่าน WebSocket

- **Backend:** Node.js + Express + Socket.IO
- **Frontend:** HTML/CSS/JS (ไม่ต้อง build)
- **การ์ด 108 ใบ · ขุนพล 30 · 4 บทบาท** ตามกฎสามก๊กฉบับมาตรฐาน

---

## 🚀 วิธี Deploy ขึ้น Render (ฟรี) — เล่นกับเพื่อนต่างเน็ต

### ขั้นที่ 1 — อัปโหลดโค้ดขึ้น GitHub
1. สมัคร/ล็อกอิน [github.com](https://github.com) แล้วกด **New repository**
   - ตั้งชื่อ เช่น `war-of-the-three-friend` → กด **Create**
2. บนเครื่องคุณ เปิด Git Bash / Terminal ในโฟลเดอร์เกมนี้ แล้วรัน
   (โค้ดถูก `git init` + commit ไว้ให้แล้ว — แค่ใส่ remote กับ push):
   ```bash
   git remote add origin https://github.com/<ชื่อคุณ>/war-of-the-three-friend.git
   git branch -M main
   git push -u origin main
   ```

### ขั้นที่ 2 — Deploy บน Render
1. สมัคร/ล็อกอิน [render.com](https://render.com) (ล็อกอินด้วย GitHub ได้เลย)
2. กด **New +** → **Web Service** → เลือก repo ที่เพิ่ง push
3. Render จะอ่าน `render.yaml` ให้อัตโนมัติ หรือกรอกเองดังนี้:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
4. กด **Create Web Service** รอ ~2 นาที

### ขั้นที่ 3 — เล่น!
เสร็จแล้วจะได้ลิงก์เช่น
```
https://war-of-the-three-friend.onrender.com
```
**ส่งลิงก์นี้ให้เพื่อน** เปิดในเบราว์เซอร์ → สร้างห้อง → แชร์รหัสห้อง (เช่น `WTK-A1B2C3`) → เพื่อนกด "เล่นออนไลน์" ใส่รหัส → เล่นได้เลย 🎉

> ⚠️ **หมายเหตุแพ็กฟรีของ Render:** เซิร์ฟเวอร์จะ "หลับ" หลังไม่มีคนใช้ ~15 นาที
> ครั้งแรกที่เปิดอาจรอ ~30 วินาทีให้ตื่น หลังจากนั้นลื่นปกติ

---

## 💻 รันบนเครื่องตัวเอง (ทดสอบ)
```bash
npm install
npm start
```
เปิด `http://localhost:3000`

### เล่นใน LAN เดียวกัน
หาเลข IP เครื่อง (เช่น `192.168.1.10`) แล้วให้เพื่อนในวง Wi-Fi เดียวกันเปิด
`http://192.168.1.10:3000`

---

## 📁 โครงสร้างไฟล์
```
server.js            # เซิร์ฟเวอร์ + กติกาเกมทั้งหมด (server-authoritative)
public/
  index.html         # หน้าเว็บ
  css/style.css      # ธีม
  js/game.js         # ลอจิกฝั่งเบราว์เซอร์
  js/data.js         # ข้อมูลขุนพล/การ์ด/บทบาท (ไทย)
GeneralCard/ GameCard/ Roll/   # รูปการ์ด
render.yaml          # ตั้งค่า deploy อัตโนมัติ
```
