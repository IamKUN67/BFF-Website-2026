// ฟังก์ชันช่วยกลางของเว็บ: อ่านเนื้อหา, สร้างลิงก์ให้ถูกต้องบน GitHub Pages, จัดรูปวันที่ไทย
import { getCollection, getEntry } from 'astro:content';
import { marked } from 'marked';
import labels from '../data/labels.json';
export { labels };

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

/** ใส่ base path ให้ลิงก์ภายใน (ลิงก์นอกเว็บ/#/mailto ไม่แตะ) */
export const url = (p = '/') =>
  /^(https?:|mailto:|tel:|#)/.test(p) ? p : p.startsWith('/') ? base + p : p;

export async function getSite() {
  const e = await getEntry('settings', 'site');
  if (!e) throw new Error('ไม่พบไฟล์ src/content/settings/site.json');
  return e.data;
}

export async function getMenu() {
  const e = await getEntry('menu', 'menu');
  return e?.data.items ?? [];
}

/** ข่าวที่เผยแพร่แล้ว: ปักหมุดก่อน แล้วใหม่ไปเก่า (ไม่มีวันที่ เรียงตามเลขไฟล์) */
export async function getPublishedPosts() {
  const all = await getCollection('posts', ({ data }) => data.status === 'published');
  return all.sort(
    (a, b) =>
      Number(b.data.pinned) - Number(a.data.pinned) ||
      (b.data.date?.getTime() ?? -Infinity) - (a.data.date?.getTime() ?? -Infinity) ||
      b.id.localeCompare(a.id),
  );
}

export const iso = (d: Date) => d.toISOString().slice(0, 10);

export const fmtDate = (d?: Date) =>
  d
    ? d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    : '';

/** รูป: คืนค่า src ที่ใส่ base แล้ว + alt; เตือนตอน build ถ้ามีรูปแต่ไม่มี alt */
export function img(i?: { src?: string | null; alt?: string | null } | null, where = '') {
  if (!i?.src) return null;
  if (!i.alt) console.warn(`[เตือน] รูป ${i.src} ${where} ยังไม่มีคำอธิบายรูป (alt)`);
  return { src: url(i.src), alt: i.alt ?? '' };
}

/** เลือกสีตัวอักษรขาว/เข้ม ให้อ่านชัดบนสีที่ผู้ดูแลตั้ง */
export function onColor(hex: string) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const f = (v: number) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
  return L > 0.179 ? '#1a1410' : '#ffffff';
}

/** ตัดข้อความจาก markdown เป็นคำอธิบายสั้นสำหรับ meta description */
export const plain = (s = '', n = 160) =>
  s.replace(/[#*_>`\[\]()!]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

/** แปลงข้อความ markdown (จากช่อง "ข้อความ" ในแต่ละส่วน) เป็น HTML + ใส่ base path ให้รูป/ลิงก์ภายใน */
export function md(text?: string | null) {
  if (!text) return '';
  let html = marked.parse(text, { async: false, gfm: true, breaks: true }) as string;
  html = html.replace(/(src|href)="\/(?!\/)/g, `$1="${base}/`);
  html = html.replace(/<a href="(https?:[^"]*)"/g, '<a href="$1" target="_blank" rel="noopener"');
  return html;
}

/** ดึงรหัสวิดีโอจากลิงก์ YouTube ทุกรูปแบบ (watch, youtu.be, shorts, embed, live) */
export function youtubeId(link: string): string | null {
  try {
    const u = new URL(link.trim());
    let id: string | null = null;
    if (u.hostname === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (u.hostname.endsWith('youtube.com')) {
      id = u.pathname === '/watch' ? u.searchParams.get('v') : (u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]+)/)?.[1] ?? null);
    }
    return id && /^[\w-]{6,}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
