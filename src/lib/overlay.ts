// ข้อมูลที่ครูแก้ผ่านหน้า "จัดการคอร์สของฉัน" (ไฟล์ใน src/content/course-updates/<ชื่อผู้ใช้>.json) รวมเข้ากับข้อมูลคอร์สตอน build
const mods = import.meta.glob('../content/course-updates/*.json', { eager: true, import: 'default' }) as Record<string, any>;
export const overlay: Record<string, any> = Object.assign({}, ...Object.values(mods).map((m) => m?.updates ?? {}));

/** รหัสประจำคอร์ส = ชื่อหน้าวิชา + ชื่อคอร์ส (ชื่อซ้ำในหน้าเดียวกันต่อท้าย #2, #3) */
export function courseKeys(pageSlug: string, courses: { title: string }[]) {
  const seen = new Map<string, number>();
  return courses.map((c) => {
    const base = `${pageSlug}::${c.title}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n > 1 ? `${base}#${n}` : base;
  });
}

export function mergeCourse(c: any, o: any) {
  if (!o) return c;
  return {
    ...c,
    applyUrl: o.applyUrl !== undefined ? o.applyUrl : c.applyUrl,
    closed: o.closed ?? c.closed,
    ended: o.ended ?? c.ended,
    documents: [...(c.documents ?? []), ...(o.documents ?? [])],
  };
}

// คอร์สที่ครูสร้างเองผ่านหน้าพื้นที่ครู (ไฟล์ใน src/content/teacher-courses/*.json) — นำไปต่อท้ายคอร์สของหน้าวิชานั้น
const tc = import.meta.glob('../content/teacher-courses/*.json', { eager: true, import: 'default' }) as Record<string, any>;
const toDate = (s: any) => { const x = s ? new Date(s) : null; return x && !Number.isNaN(x.getTime()) ? x : null; };
export function teacherCoursesFor(slug: string) {
  return Object.entries(tc)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, c]) => c)
    .filter((c) => c?.subject === slug && c.title)
    .map((c) => ({
      title: String(c.title), group: c.group || null, startDate: toDate(c.startDate), endDate: toDate(c.endDate), schedule: c.schedule || null,
      teachers: Array.isArray(c.teachers) ? c.teachers : [], description: c.description || null, applyUrl: c.applyUrl || null, closed: !!c.closed, ended: !!c.ended,
      documents: Array.isArray(c.documents) ? c.documents : [], links: Array.isArray(c.links) ? c.links : [],
    }));
}
