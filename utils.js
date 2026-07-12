// utils.js — Security helpers shared by all pages
// ป้องกัน XSS: แปลงข้อความให้ปลอดภัยก่อนแทรกลงใน innerHTML
// (เผื่อกรณีชื่อชมรม/คำอธิบายมีอักขระ <, >, ", ', & ปนอยู่ ไม่ว่าจะตั้งใจหรือไม่ตั้งใจ)
function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
