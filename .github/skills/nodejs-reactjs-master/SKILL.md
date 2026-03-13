---
name: NodeJS ReactJS Master Workflow
summary: >
  เวิร์กโฟลว์สำหรับ dev ไทยที่ต้องการแนวทางแก้ปัญหา/รีวิว/ดีบั๊ก Node.js และ React.js อย่างเป็นขั้นตอน พร้อม checklist คุณภาพ
---

# NodeJS ReactJS Master Workflow

## เป้าหมาย

- ได้โค้ด Node.js หรือ React.js ที่อ่านง่าย ทันสมัย ประสิทธิภาพดี และเหมาะกับ dev ไทย
- ได้แนวทางดีบั๊ก/รีวิว/ปรับปรุงโค้ดที่เป็นระบบ

## ขั้นตอนการทำงาน (Workflow)

1. **รับ requirement/โจทย์**
   - ถามกลับถ้าข้อมูลไม่พอ
2. **วางแผนโครงสร้างโค้ด**
   - เลือกวิธีที่ง่ายและ O(n) ที่สุด
   - หลีกเลี่ยง library ที่ไม่จำเป็น
3. **ลงมือเขียน/ปรับปรุงโค้ด**
   - ใส่คอมเมนต์เฉพาะจุดสำคัญ
   - ใช้ syntax/feature ทันสมัย (ES6+, React Hooks)
4. **ตรวจสอบคุณภาพ (Checklist)**
   - โค้ดอ่านง่าย, ชื่อสื่อความ, ไม่มี magic number
   - มี error handling ที่เหมาะสม
   - React: ใช้ key ที่ unique, ไม่ mutate props, ใช้ useEffect/useMemo อย่างถูกต้อง
   - Node.js: ไม่ block event loop, ใช้ async/await แทน callback
5. **ทดสอบ/ตัวอย่างการใช้งาน**
   - เพิ่มตัวอย่างหรือ test case สั้น ๆ
6. **อธิบายผลลัพธ์/แนวคิด**
   - อธิบายสั้น ๆ ว่าโค้ดนี้แก้ปัญหาอย่างไร

## จุดตัดสินใจ (Decision Points)

- ถ้า requirement ไม่ชัด ให้ถามกลับก่อนเริ่ม
- ถ้าเลือกได้หลายวิธี ให้เลือกที่ง่าย/อ่านง่าย/ประสิทธิภาพดีสุด
- ถ้าเจอ edge case ให้แจ้ง dev เสมอ

## ตัวอย่าง prompt

- "ช่วยรีวิวโค้ด React hook นี้ว่ามี bug หรือเปล่า"
- "ช่วย debug error Node.js นี้แบบ dev ไทย ๆ"
- "ช่วย refactor โค้ด Express middleware นี้ให้กระชับขึ้น"

## ข้อเสนอแนะ

- อาจแยก workflow ย่อยสำหรับ testing, performance tuning, หรือ security เฉพาะทางได้ในอนาคต
