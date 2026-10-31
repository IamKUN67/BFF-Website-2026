// ตั้งค่า Astro: คำนวณ URL ของ GitHub Pages อัตโนมัติจากชื่อ repo
// ไม่ต้องแก้ไฟล์นี้เมื่อเปลี่ยนชื่อ repo หรือย้ายบัญชี
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readFileSync } from 'node:fs';

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

// ย่อหน้าที่มีแค่ลิงก์ YouTube ลิงก์เดียว → เครื่องเล่นวิดีโอในหน้าเว็บ
const labels = JSON.parse(readFileSync(new URL('./src/data/labels.json', import.meta.url), 'utf-8'));
function youtubeId(link) {
  try {
    const u = new URL(link.trim());
    let id = null;
    if (u.hostname === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (u.hostname.endsWith('youtube.com'))
      id = u.pathname === '/watch' ? u.searchParams.get('v') : (u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]+)/)?.[1] ?? null);
    return id && /^[\w-]{6,}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
function rehypeYoutube() {
  const embed = (id) => ({
    type: 'element', tagName: 'div', properties: { className: ['video'] },
    children: [{
      type: 'element', tagName: 'iframe', children: [],
      properties: {
        src: `https://www.youtube-nocookie.com/embed/${id}`, title: labels.videoDefaultTitle, loading: 'lazy',
        allowFullScreen: true, referrerPolicy: 'strict-origin-when-cross-origin',
        allow: 'accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share',
      },
    }],
  });
  const text = (n) => (n.type === 'text' ? n.value : (n.children || []).map(text).join(''));
  const isBr = (k) => k.type === 'element' && k.tagName === 'br';
  const blank = (k) => (k.type === 'text' && !k.value.trim()) || isBr(k);
  return (tree) => {
    const walk = (node) => {
      if (!node.children) return;
      node.children = node.children.flatMap((c) => {
        if (c.type === 'element' && c.tagName === 'p') {
          const real = c.children.filter((k) => !blank(k));
          const out = [];
          let seg = [];
          let found = false;
          const flush = () => {
            while (seg.length && blank(seg[0])) seg.shift();
            while (seg.length && blank(seg[seg.length - 1])) seg.pop();
            if (seg.length) out.push({ type: 'element', tagName: 'p', properties: {}, children: seg });
            seg = [];
          };
          for (const k of c.children) {
            if (k.type === 'element' && k.tagName === 'a') {
              const id = youtubeId(String(k.properties?.href ?? ''));
              if (id && (real.length === 1 || /^https?:/i.test(text(k).trim()))) {
                flush();
                out.push(embed(id));
                found = true;
                continue;
              }
            }
            seg.push(k);
          }
          if (!found) { walk(c); return [c]; }
          flush();
          return out;
        }
        walk(c);
        return [c];
      });
    };
    walk(tree);
  };
}

export default defineConfig({
  site: process.env.GITHUB_REPOSITORY ? `https://${owner}.github.io` : 'http://localhost:4321',
  base,
  trailingSlash: 'always',
  integrations: [sitemap({ filter: (page) => !/\/(login|teacher)\/?$/.test(page) })],
  markdown: { rehypePlugins: [rehypeYoutube, rehypeSiteLinks] },
});
