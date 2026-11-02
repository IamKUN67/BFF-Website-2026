// ข้อมูลสาธารณะให้ระบบครูใช้ (ที่อยู่ระบบ, รายชื่อครู, วิชาที่เปิดให้เพิ่มคอร์ส, คอร์สของผู้ดูแลพร้อมครูผู้สอน) สร้างตอน build
import { getCollection } from 'astro:content';
import { courseKeys } from '../../lib/overlay';
import { getSite } from '../../lib/site';

export async function GET() {
  const site = await getSite();
  const pages = await getCollection('pages');
  const teachers = (await getCollection('teachers')).map((t) => ({ id: t.id, name: t.data.name }));
  const subjects = pages.filter((p) => p.data.teacherCourses).map((p) => ({ slug: p.data.slug ?? p.id, title: p.data.title }));
  const courses = pages.flatMap((p) => {
    const slug = p.data.slug ?? p.id;
    const keys = courseKeys(slug, p.data.courses);
    return p.data.courses.map((c, i) => ({
      key: keys[i], page: slug, pageTitle: p.data.title, title: c.title, group: c.group ?? '', teachers: c.teachers,
      base: { applyUrl: c.applyUrl ?? '', closed: !!c.closed, ended: !!c.ended, documents: c.documents.map((d) => ({ title: d.title, file: d.file })) },
    }));
  });
  const api = /^https:\/\//.test(site.teacherApiUrl ?? '') ? site.teacherApiUrl : '';
  return new Response(JSON.stringify({ api, teachers, subjects, courses }), { headers: { 'Content-Type': 'application/json' } });
}
