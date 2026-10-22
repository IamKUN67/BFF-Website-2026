// ตั้งค่า Astro: คำนวณ URL ของ GitHub Pages อัตโนมัติจากชื่อ repo
// ไม่ต้องแก้ไฟล์นี้เมื่อเปลี่ยนชื่อ repo หรือย้ายบัญชี
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// GITHUB_REPOSITORY มีรูปแบบ "เจ้าของ/ชื่อrepo" (มีเฉพาะตอน build บน GitHub)
const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? 'localhost/bff-2026').split('/');

// ถ้า repo ชื่อ "<owner>.github.io" เว็บจะอยู่ที่ราก (/) ไม่ต้องมี base
const isUserSite = repo.toLowerCase() === `${owner.toLowerCase()}.github.io`;

export default defineConfig({
  site: process.env.GITHUB_REPOSITORY ? `https://${owner}.github.io` : 'http://localhost:4321',
  base: process.env.GITHUB_REPOSITORY && !isUserSite ? `/${repo}` : '/',
  trailingSlash: 'always',
  integrations: [sitemap()],
});
