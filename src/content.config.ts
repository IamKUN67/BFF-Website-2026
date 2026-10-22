// นิยามรูปแบบข้อมูลของเนื้อหาทุกชนิด (ต้องตรงกับ public/admin/config.yml)
// ถ้ากรอกข้อมูลผิดรูปแบบ ตอน build จะแจ้งเตือนว่าไฟล์ไหน ช่องไหนผิด
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// รูปภาพ = ไฟล์รูป + alt text (คำอธิบายรูปภาษาไทย)
const image = (img: () => z.ZodTypeAny) =>
  z.object({ src: img().optional(), alt: z.string().optional() }).optional();

const settings = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/settings' }),
  schema: ({ image: img }) =>
    z.object({
      siteName: z.string(),
      tagline: z.string().optional(),
      welcomeTitle: z.string().optional(),
      welcomeText: z.string().optional(),
      logo: image(img),
      cover: image(img),
      colors: z
        .object({
          primary: z.string().default('#e8590c'),
          accent: z.string().default('#0c8599'),
        })
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

// เมนูหลัก + เมนูย่อย (ลิงก์ภายในเว็บขึ้นต้นด้วย / ลิงก์ภายนอกขึ้นต้นด้วย https://)
const menu = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/menu' }),
  schema: z.object({
    items: z.array(
      z.object({
        label: z.string(),
        link: z.string().optional(),
        children: z
          .array(z.object({ label: z.string(), link: z.string() }))
          .default([]),
      }),
    ),
  }),
});

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: ({ image: img }) =>
    z.object({
      title: z.string(),
      status: z.enum(['draft', 'published']).default('draft'),
      date: z.coerce.date().optional(),
      updated: z.coerce.date().optional(),
      category: z.string().optional(),
      pinned: z.boolean().default(false),
      isNew: z.boolean().default(false),
      notes: z.string().optional(), // หมายเหตุภายใน เช่น "รอเติมข้อมูล" (ไม่แสดงบนเว็บ)
      legacyUrl: z.string().optional(),
      cover: image(img),
      gallery: z
        .array(z.object({ src: img(), alt: z.string() }))
        .default([]),
    }),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    slug: z.string().optional(),
    description: z.string().optional(),
    legacy: z.boolean().default(false), // true = ซ่อนจากเมนูหลัก แต่เปิดผ่านลิงก์ได้
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
  schema: ({ image: img }) =>
    z.object({
      name: z.string(),
      position: z.string().optional(),
      photo: image(img),
      order: z.number().default(100),
    }),
});

export const collections = { settings, menu, posts, pages, events, board };
