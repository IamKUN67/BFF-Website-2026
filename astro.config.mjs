// ตั้งค่า Astro: คำนวณ URL ของ GitHub Pages อัตโนมัติจากชื่อ repo
// ไม่ต้องแก้ไฟล์นี้เมื่อเปลี่ยนชื่อ repo หรือย้ายบัญชี
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// GITHUB_REPOSITORY มีรูปแบบ "เจ้าของ/ชื่อrepo" (มีเฉพาะตอน build บน GitHub)
const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? 'localhost/bff-2026').split('/');

// ถ้า repo ชื่อ "<owner>.github.io" เว็บจะอยู่ที่ราก (/) ไม่ต้องมี base
const isUserSite = repo.toLowerCase() === `${owner.toLowerCase()}.github.io`;
const base = process.env.GITHUB_REPOSITORY && !isUserSite ? `/${repo}` : '/';

// ปลั๊กอินเล็กๆ สำหรับเนื้อหาข่าว/หน้า (markdown):
//  - รูปและลิงก์ภายในที่ขึ้นต้นด้วย "/" (เช่น /uploads/a.webp) → ใส่ base path ให้
//  - ลิงก์นอกเว็บ → เปิดแท็บใหม่ พร้อม rel="noopener"
function rehypeSiteLinks() {
  const prefix = base === '/' ? '' : base;
  return (tree) => {
    const walk = (node) => {
      if (node.type === 'element' && node.properties) {
        for (const key of ['src', 'href']) {
          const v = node.properties[key];
          if (typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') && prefix && !v.startsWith(prefix + '/')) {
            node.properties[key] = prefix + v;
          }
        }
        const href = node.properties.href;
        if (node.tagName === 'a' && typeof href === 'string' && /^https?:\/\//.test(href)) {
          node.properties.target = '_blank';
          node.properties.rel = 'noopener';
        }
      }
      node.children?.forEach(walk);
    };
    walk(tree);
  };
}

export default defineConfig({
  site: process.env.GITHUB_REPOSITORY ? `https://${owner}.github.io` : 'http://localhost:4321',
  base,
  trailingSlash: 'always',
  integrations: [sitemap()],
  markdown: { rehypePlugins: [rehypeSiteLinks] },
});
