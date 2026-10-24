// ดัชนีค้นหาทั้งเว็บ (สร้างตอน build) — ค้นด้วยการหาข้อความในตัวอักษร จึงใช้ได้ดีกับภาษาไทยที่ไม่มีช่องว่างคั่นคำ
import { getCollection } from 'astro:content';
import { getPublishedPosts, labels, url, plain } from '../lib/site';

const j = (...parts: unknown[]) => plain(parts.filter(Boolean).join(' '), 6000).replace(/[\u200b\u00ad]/g, '');
const secText = (sections: any[]) =>
  sections.map((s) => [s.title, s.text, ...(s.album ?? []).map((a: any) => a.alt), ...(s.videos ?? []).map((v: any) => v.title)].filter(Boolean).join(' ')).join(' ');

export async function GET() {
  const posts = await getPublishedPosts();
  const pages = await getCollection('pages');
  const teachers = new Map((await getCollection('teachers')).map((t) => [t.id, t]));
  const board = await getCollection('board');
  const events = await getCollection('events');
  const items: { t: string; type: string; u: string; x: string }[] = [];
  const pageUrl = (p: (typeof pages)[number]) => url(`/pages/${p.data.slug ?? p.id}/`);

  for (const p of posts) {
    items.push({ t: p.data.title, type: labels.searchTypeNews, u: url(`/news/${p.id}/`), x: j(p.data.category, p.body, secText(p.data.sections)) });
  }
  for (const p of pages) {
    const d = p.data;
    const u = pageUrl(p);
    items.push({ t: d.title, type: labels.searchTypePage, u, x: j(d.description, p.body, secText(d.sections)) });
    for (const c of d.courses) {
      items.push({ t: c.title, type: labels.searchTypeCourse, u, x: j(d.title, c.group, c.schedule, c.description, ...c.teachers.map((id) => teachers.get(id)?.data.name)) });
    }
    for (const id of d.teachers) {
      const t = teachers.get(id);
      if (t) items.push({ t: t.data.name, type: labels.searchTypeTeacher, u, x: j(t.data.position, d.title) });
    }
  }
  const execPage = pages.find((p) => p.data.showExecutives);
  if (execPage) for (const m of board) items.push({ t: m.data.name, type: labels.boardTitle, u: pageUrl(execPage), x: j(m.data.position) });
  for (const e of events) items.push({ t: e.data.title, type: labels.searchTypeEvent, u: url('/calendar/'), x: j(e.data.location, e.data.details) });

  return new Response(JSON.stringify(items), { headers: { 'Content-Type': 'application/json' } });
}
