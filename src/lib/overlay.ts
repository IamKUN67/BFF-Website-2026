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
