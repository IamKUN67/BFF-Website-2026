// นิยามรูปแบบข้อมูลของเนื้อหาทุกชนิด (ต้องตรงกับ public/admin/config.yml)
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// รูปภาพ = path ของไฟล์ (เช่น /uploads/abc.webp) + alt text (คำอธิบายรูปภาษาไทย)
const image = z.object({ src: z.string().optional(), alt: z.string().optional() }).optional();

const settings = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/settings' }),
  schema: z.object({
    siteName: z.string(),
    tagline: z.string().optional(),
    welcomeTitle: z.string().optional(),
    welcomeText: z.string().optional(),
    logo: image,
    cover: image,
    colors: z
      .object({ primary: z.string().default('#1a73c4'), accent: z.string().default('#d32f2f') })
      .default({}),
    social: z
      .object({
        instagram: z.string().optional(),
        facebook: z.string().optional(),
        line: z.string().optional(),
        discord: z.string().optional(),
      })
      .default({}),
    email: z.string().optional(),
    address: z.string().optional(),
    footerText: z.string().optional(),
  }),
});

const menu = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/menu' }),
  schema: z.object({
    items: z.array(
      z.object({
        label: z.string(),
        link: z.string().optional(),
        children: z.array(z.object({ label: z.string(), link: z.string() })).default([]),
      }),
    ),
  }),
});

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    status: z.enum(['draft', 'published']).default('draft'),
    date: z.coerce.date().optional(),
    updated: z.coerce.date().optional(),
    category: z.string().optional(),
    pinned: z.boolean().default(false),
    isNew: z.boolean().default(false),
    notes: z.string().optional(), // หมายเหตุภายใน (ไม่แสดงบนเว็บ)
    cover: image,
    gallery: z.array(z.object({ src: z.string(), alt: z.string() })).default([]),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    slug: z.string().optional(),
    description: z.string().optional(),
    legacy: z.boolean().default(false),
    showContact: z.boolean().default(false), // true = แสดงการ์ดช่องทางติดต่อจากหน้าตั้งค่า
  }),
});

const events = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/events' }),
  schema: z.object({
    title: z.string(),
    start: z.coerce.date(),
    end: z.coerce.date().optional(),
    location: z.string().optional(),
    details: z.string().optional(),
    link: z.string().optional(),
  }),
});

const board = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/board' }),
  schema: z.object({
    name: z.string(),
    position: z.string().optional(),
    photo: image,
    order: z.number().default(100),
  }),
});

export const collections = { settings, menu, posts, pages, events, board };
