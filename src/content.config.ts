// นิยามรูปแบบข้อมูลของเนื้อหาทุกชนิด (ต้องตรงกับ public/admin/config.yml)
// หมายเหตุ: หน้าแอดมินจะบันทึกช่องที่เว้นว่างเป็น null จึงต้องรับ null ได้ทุกช่องที่ไม่บังคับ (nullish)
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const str = z.string().nullish();
// วันที่ที่ไม่บังคับ: หน้าแอดมินอาจบันทึกช่องว่างเป็น null, "" หรือ "Invalid date" ให้ถือว่า "ไม่มีวันที่" ทั้งหมด
const optDate = z.preprocess((v) => {
  if (v == null) return undefined;
  if (typeof v === 'string' && (!v.trim() || /invalid/i.test(v))) return undefined;
  if (v instanceof Date && Number.isNaN(v.getTime())) return undefined;
  return v;
}, z.coerce.date().optional());
// ขนาดเป็นเปอร์เซ็นต์ (5–100) รับได้ทั้งเลขและข้อความ เช่น 50 หรือ "50" ค่าที่เกินช่วงจะถูกปรับให้อยู่ในช่วง
const pct = z.preprocess((v) => {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(100, Math.max(5, n)) : undefined;
}, z.number().optional());
const bool = z.boolean().nullish().transform((v) => v ?? false);
const list = <T extends z.ZodTypeAny>(item: T) =>
  z.array(item).nullish().transform((v) => v ?? []);

// รูปภาพ = path ของไฟล์ (เช่น /uploads/abc.webp) + alt text (คำอธิบายรูปภาษาไทย)
const image = z.object({ src: str, alt: str }).nullish();

// ส่วนเนื้อหา: หัวข้อ + รูปประกอบ + ข้อความ + อัลบั้มรูป + วิดีโอ YouTube
const sections = list(
  z.object({
    title: str,
    titleAlign: str, // left | center | right
    titleSize: str, // normal | large | xlarge
    text: str,
    image,
    imageSize: pct, // % ความกว้าง
    imageAlign: str, // left | center | right
    textAlign: str, // left | center | right | justify
    textSize: str, // normal | large | xlarge
    albumSize: str, // 2–6 (จำนวนคอลัมน์)
    albumWidth: pct, // % ความกว้างของอัลบั้มทั้งชุด
    albumAlign: str, // left | center | right
    albumRatio: str, // 4:3 | 16:9 | 1:1 | 3:4 | auto (สัดส่วนรูปย่อ)
    album: list(z.object({ src: z.string(), alt: str })),
    videos: list(z.object({ url: z.string(), title: str, width: pct, align: str, ratio: str })),
    videosAlign: str, // left | center | right (การจัดแถววิดีโอ)
  }),
);

// คอร์สเรียน (อยู่ในหน้าวิชาแต่ละหน้า) — teachers = รหัสของครูในโฟลเดอร์ teachers
const course = z.object({
  title: z.string(),
  group: str,
  startDate: optDate,
  endDate: optDate,
  schedule: str,
  teachers: list(z.string()),
  description: str,
  applyUrl: str, // ลิงก์ฟอร์มสมัคร (ครูแนบเอง)
  closed: bool, // ติ๊ก = ปิดรับสมัครแล้ว
  ended: bool, // ติ๊ก = คอร์สนี้จบแล้ว
  documents: list(z.object({ title: z.string(), file: z.string(), note: str })), // เอกสารที่ครูฝากไว้
  links: list(z.object({ label: z.string(), url: z.string() })),
});

const person = {
  name: z.string(),
  position: str,
  photo: image,
  instagram: str,
  facebook: str,
  youtube: str,
  email: str,
  phone: str,
  order: z.number().nullish().transform((v) => v ?? 100),
};

const settings = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/settings' }),
  schema: z.object({
    siteName: z.string(),
    tagline: str,
    welcomeTitle: str,
    welcomeText: str,
    logo: image,
    cover: image,
    colors: z
      .object({ primary: str, accent: str })
      .nullish()
      .transform((c) => ({ primary: c?.primary || '#1a73c4', accent: c?.accent || '#d32f2f' })),
    social: z
      .object({ instagram: str, facebook: str, youtube: str, line: str, discord: str })
      .nullish()
      .transform((s) => s ?? {}),
    email: str,
    address: str,
    footerText: str,
    goatcounterCode: str, // GoatCounter (นับยอดเข้าชม ไม่ใช้คุกกี้)
    cloudflareToken: str, // หรือ Cloudflare Web Analytics
  }),
});

const menu = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/menu' }),
  schema: z.object({
    items: z.array(
      z.object({
        label: z.string(),
        icon: str, // house | megaphone | school | palette | phone
        link: str,
        children: list(z.object({ label: z.string(), link: z.string() })),
      }),
    ),
  }),
});

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    status: z.enum(['draft', 'published']).nullish().transform((v) => v ?? 'draft'),
    date: optDate,
    updated: optDate,
    category: str,
    pinned: bool,
    isNew: bool,
    notes: str, // หมายเหตุภายใน (ไม่แสดงบนเว็บ)
    cover: image,
    coverSize: pct,
    coverAlign: str,
    bodyAlign: str,
    bodySize: str,
    sections,
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    slug: str,
    description: str,
    bodyAlign: str,
    bodySize: str,
    legacy: bool,
    showContact: bool, // แสดงการ์ดช่องทางติดต่อจากหน้าตั้งค่า
    showExecutives: bool, // แสดงรายชื่อผู้บริหารท้ายหน้า
    links: list(z.object({ label: z.string(), url: z.string(), note: str, width: pct, align: str })), // ปุ่มลิงก์ใหญ่ เช่น ฟอร์ม
    embeds: list(z.object({ title: str, url: z.string(), height: z.number().nullish(), width: pct, align: str })), // ฝังแบบฟอร์ม/เอกสาร
    newsCategory: str, // แสดงข่าวหมวดนี้ท้ายหน้า (เว้นว่าง = ไม่แสดง)
    teachers: list(z.string()), // ครูผู้สอนประจำวิชา (รหัสจากโฟลเดอร์ teachers)
    courses: list(course),
    sections,
  }),
});

const events = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/events' }),
  schema: z.object({
    title: z.string(),
    start: z.coerce.date(),
    end: optDate,
    location: str,
    details: str,
    link: str,
  }),
});

const board = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/board' }),
  schema: z.object({
    name: z.string(),
    position: str,
    photo: image,
    instagram: str,
    facebook: str,
    youtube: str,
    email: str,
    phone: str,
    order: z.number().nullish().transform((v) => v ?? 100),
  }),
});

// หน้าสไลด์ต้อนรับ (หน้าแรกสุดของลิงก์เว็บ)
const intro = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/intro' }),
  schema: z.object({
    enabled: z.boolean().nullish().transform((v) => v ?? true),
    title: str,
    subtitle: str,
    autoplay: z.boolean().nullish().transform((v) => v ?? true),
    interval: z.number().nullish().transform((v) => v ?? 6),
    fit: str, // cover | contain (ค่าเริ่มต้นของทุกสไลด์)
    slides: list(z.object({ file: str, youtube: str, alt: str, caption: str, fit: str, focus: str })),
    buttons: list(z.object({ label: z.string(), url: z.string(), color: str })),
  }),
});

// ไทม์ไลน์ BFF: เหตุการณ์สำคัญที่ผู้ดูแลเพิ่มเอง (ข่าวที่เผยแพร่และมีวันที่จะเข้าไทม์ไลน์อัตโนมัติ)
const milestones = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/milestones' }),
  schema: z.object({
    date: z.coerce.date(),
    yearOnly: bool,
    title: z.string(),
    text: str,
    textAlign: str,
    textSize: str,
    image,
    imageSize: pct,
    imageAlign: str,
    link: str,
    album: list(z.object({ src: z.string(), alt: str })),
  }),
});

const teachers = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/teachers' }),
  schema: z.object(person),
});

export const collections = { settings, menu, posts, pages, events, board, teachers, intro, milestones };
