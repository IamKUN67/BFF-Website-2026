// ข้อมูลไฟล์ที่อัปโหลด (นามสกุล + ขนาด) สำหรับแสดงในรายการเอกสารดาวน์โหลด — ขนาดอ่านจากไฟล์จริงตอน build
import { statSync } from 'node:fs';
import { join } from 'node:path';

export function fileInfo(file: string) {
  const ext = (file.split('?')[0].split('.').pop() ?? '').toUpperCase().slice(0, 5);
  let size = '';
  try {
    const b = statSync(join(process.cwd(), 'public', decodeURIComponent(file))).size;
    size = b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`;
  } catch {
    /* ไม่พบไฟล์ในเครื่อง build — ไม่แสดงขนาด */
  }
  return { ext, size };
}
