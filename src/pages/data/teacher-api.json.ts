// ข้อมูลสาธารณะให้ระบบล็อกอินครูใช้ตรวจสิทธิ์ (รายชื่อครู + คอร์สและครูผู้สอนของแต่ละคอร์ส) สร้างตอน build
import { getCollection } from 'astro:content';
import { courseKeys } from '../../lib/overlay';

export async function GET() {
  const teachers = (await getCollection('teachers')).map((t) => ({ id: t.id, name: t.data.name }));
  const courses = (await getCollection('pages')).flatMap((p) => {
    const slug = p.data.slug ?? p.id;
    const keys = courseKeys(slug, p.data.courses);
    return p.data.courses.map((c, i) => ({
      key: keys[i], page: slug, pageTitle: p.data.title, title: c.title, group: c.group ?? '', teachers: c.teachers,
      base: { applyUrl: c.applyUrl ?? '', closed: !!c.closed, ended: !!c.ended, documents: c.documents.map((d) => ({ title: d.title, file: d.file })) },
    }));
  });
  return new Response(JSON.stringify({ teachers, courses }), { headers: { 'Content-Type': 'application/json' } });
}
