// นิยามรูปแบบข้อมูลของเนื้อหาทุกชนิด (ต้องตรงกับ public/admin/config.yml)
// หมายเหตุ: หน้าแอดมินจะบันทึกช่องที่เว้นว่างเป็น null จึงต้องรับ null ได้ทุกช่องที่ไม่บังคับ (nullish)
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const str = z.string().nullish();
const bool = z.boolean().nullish().transform((v) => v ?? false);
const list = <T extends z.ZodTypeAny>(item: T) =>
  z.array(item).nullish().transform((v) => v ?? []);

// รูปภาพ = path ของไฟล์ (เช่น /uploads/abc.webp) + alt text (คำอธิบายรูปภาษาไทย)
const image = z.object({ src: str, alt: str }).nullish();

// ส่วนเนื้อหา: หัวข้อ + รูปประกอบ + ข้อความ + อัลบั้มรูป + วิดีโอ YouTube
const sections = list(
  z.object({
    title: str,
    text: str,
    image,
    imageSize: str, // 25 | 50 | 75 | 100 (% ความกว้าง)
    imageAlign: str, // left | center | right
    textAlign: str, // left | center | right | justify
    textSize: str, // normal | large | xlarge
    albumSize: str, // 4 | 3 | 2 (จำนวนคอลัมน์)
    album: list(z.object({ src: z.string(), alt: str })),
    videos: list(z.object({ url: z.string(), title: str })),
  }),
);

// คอร์สเรียน (อยู่ในหน้าวิชาแต่ละหน้า) — teachers = รหัสของครูในโฟลเดอร์ teachers
const course = z.object({
  title: z.string(),
  group: str,
  startDate: z.coerce.date().nullish(),
  endDate: z.coerce.date().nullish(),
  schedule: str,
  teachers: list(z.string()),
  description: str,
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
  }),
});

const menu = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/menu' }),
  schema: z.object({
    items: z.array(
      z.object({
        label: z.string(),
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
    date: z.coerce.date().nullish(),
    updated: z.coerce.date().nullish(),
    category: str,
    pinned: bool,
    isNew: bool,
    notes: str, // หมายเหตุภายใน (ไม่แสดงบนเว็บ)
    cover: image,
    sections,
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    slug: str,
    description: str,
    legacy: bool,
    showContact: bool, // แสดงการ์ดช่องทางติดต่อจากหน้าตั้งค่า
    showExecutives: bool, // แสดงรายชื่อผู้บริหารท้ายหน้า
    links: list(z.object({ label: z.string(), url: z.string(), note: str })), // ปุ่มลิงก์ใหญ่ เช่น ฟอร์ม
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
    end: z.coerce.date().nullish(),
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

const teachers = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/teachers' }),
  schema: z.object(person),
});

export const collections = { settings, menu, posts, pages, events, board, teachers };
