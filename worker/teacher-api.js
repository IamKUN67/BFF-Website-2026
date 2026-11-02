// Cloudflare Worker v2: ระบบครู — ล็อกอิน / จัดการคอร์สของตัวเอง / โปรไฟล์ / ฝากไฟล์ + เจ้าของจัดการบัญชีครู
// ตั้งค่าตามไฟล์ README-TH.md (ตัวแปร: GITHUB_REPO GITHUB_BRANCH SITE_URL ALLOWED_ORIGIN, ความลับ: GITHUB_TOKEN SESSION_SECRET OWNER_USERNAME OWNER_PASSWORD, KV: ACCOUNTS)
const enc = new TextEncoder();
const dec = new TextDecoder();
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (h) => new Uint8Array((h.match(/../g) || []).map((x) => parseInt(x, 16)));
const toB64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const utf8ToB64 = (s) => btoa(String.fromCharCode(...enc.encode(s)));
const b64ToUtf8 = (b) => dec.decode(Uint8Array.from(atob(b.replace(/\s/g, '')), (c) => c.charCodeAt(0)));
const same = (a, b) => {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
};
const fail = (status, error) => Object.assign(new Error(error), { status });
const str = (v, n) => String(v ?? '').trim().slice(0, n);
const isHttps = (s) => /^https:\/\//i.test(String(s || '').trim());
const okDate = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? String(s) : '');
const USER_RE = /^[a-z0-9_-]{2,32}$/;

const ALLOWED = new Set(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'zip', 'rar', '7z', 'txt', 'csv', 'png', 'jpg', 'jpeg', 'webp', 'gif']);
const MAX_BYTES = 6 * 1024 * 1024;

async function derive(password, saltHex, iter) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return toHex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations: iter }, key, 256));
}
const sha256 = async (s) => toHex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
async function sign(data, secret) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toB64u(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}
async function makeToken(payload, secret) {
  const body = toB64u(enc.encode(JSON.stringify(payload)));
  return body + '.' + (await sign(body, secret));
}
async function readToken(token, secret) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig || !same(sig, await sign(body, secret))) return null;
  try {
    const p = JSON.parse(dec.decode(fromB64u(body)));
    return p.exp > Date.now() ? p : null;
  } catch {
    return null;
  }
}

// ───── GitHub ─────
const branch = (env) => env.GITHUB_BRANCH || 'main';
const gh = (env, path, init = {}) =>
  fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'bff-teacher-api', ...(init.headers || {}) },
  });
async function readJson(env, path) {
  const r = await gh(env, `${path}?ref=${branch(env)}`);
  if (r.status === 404) return { data: null, sha: null };
  if (!r.ok) throw new Error('github-read');
  const j = await r.json();
  return { data: JSON.parse(b64ToUtf8(j.content)), sha: j.sha };
}
async function putFile(env, path, b64, message, sha) {
  const body = `{"message":${JSON.stringify(message)},"branch":${JSON.stringify(branch(env))}${sha ? `,"sha":${JSON.stringify(sha)}` : ''},"content":"${b64}"}`;
  if (!(await gh(env, path, { method: 'PUT', body })).ok) throw new Error('github-write');
}
async function delFile(env, path, sha, message) {
  const r = await gh(env, path, { method: 'DELETE', body: JSON.stringify({ message, sha, branch: branch(env) }) });
  if (!r.ok) throw new Error('github-delete');
}
const putJson = (env, path, obj, message, sha) => putFile(env, path, utf8ToB64(JSON.stringify(obj, null, 2) + '\n'), message, sha);

async function siteData(env) {
  const r = await fetch(`${env.SITE_URL}/data/teacher-api.json`, { cf: { cacheTtl: 30 } });
  if (!r.ok) throw new Error('site');
  return r.json();
}
const owns = (site, user) => site.courses.filter((c) => user.all || (user.teacher && c.teachers.includes(user.teacher))).map((c) => c.key);
const overlayPath = (user) => `src/content/course-updates/${user.u}.json`;
const coursePath = (id) => `src/content/teacher-courses/${id}.json`;
const COURSE_ID = /^[a-z0-9_-]{2,32}-[a-z0-9]{4,12}$/;

// ───── ล้างข้อมูลที่รับมาจากครู ─────
function cleanDocs(list, folders) {
  return (Array.isArray(list) ? list : [])
    .slice(0, 60)
    .map((d) => ({ title: str(d?.title, 150), file: String(d?.file || ''), note: str(d?.note, 200) }))
    .filter((d) => d.title && folders.some((f) => d.file.startsWith(f)) && !d.file.includes('..'));
}
function clean(u, user) { // คอร์สที่ผู้ดูแลสร้างใน CMS: ครูแก้ได้เฉพาะลิงก์สมัคร สถานะ และเอกสาร
  const out = { closed: !!u.closed, ended: !!u.ended };
  if (typeof u.applyUrl === 'string') out.applyUrl = isHttps(u.applyUrl) ? str(u.applyUrl, 600) : '';
  out.documents = cleanDocs(u.documents, [`/uploads/teachers/${user.u}/`]);
  return out;
}
function cleanCourse(c, user, owner, site) {
  const subject = site.subjects.find((s) => s.slug === c.subject);
  if (!subject) throw fail(400, 'subject');
  const title = str(c.title, 150);
  if (!title) throw fail(400, 'title');
  const ids = new Set(site.teachers.map((t) => t.id));
  return {
    subject: subject.slug, title, group: str(c.group, 80), startDate: okDate(c.startDate), endDate: okDate(c.endDate), schedule: str(c.schedule, 300),
    teachers: (Array.isArray(c.teachers) ? c.teachers : []).filter((t) => ids.has(t)).slice(0, 10),
    description: str(c.description, 5000),
    applyUrl: isHttps(c.applyUrl) ? str(c.applyUrl, 600) : '', closed: !!c.closed, ended: !!c.ended,
    documents: cleanDocs(c.documents, [`/uploads/teachers/${user.u}/`, `/uploads/teachers/${owner}/`]),
    links: (Array.isArray(c.links) ? c.links : []).slice(0, 10).map((l) => ({ label: str(l?.label, 80), url: str(l?.url, 600) })).filter((l) => l.label && isHttps(l.url)),
  };
}
async function listCourses(env, user) {
  const r = await gh(env, `src/content/teacher-courses?ref=${branch(env)}`);
  if (r.status === 404) return [];
  if (!r.ok) throw new Error('github-list');
  const files = (await r.json()).filter((f) => f.name.endsWith('.json') && (user.all || f.name.startsWith(user.u + '-'))).slice(0, 60);
  const out = [];
  await Promise.all(files.map(async (f) => {
    const { data } = await readJson(env, f.path);
    if (data && (user.all || data.owner === user.u)) out.push({ id: f.name.replace(/\.json$/, ''), data });
  }));
  return out.sort((a, b) => b.id.localeCompare(a.id));
}

// ───── บัญชีและการยืนยันตัวตน ─────
async function login(req, env, reply) {
  const { username = '', password = '' } = await req.json().catch(() => ({}));
  const u = String(username).trim().toLowerCase();
  const pw = String(password).slice(0, 200);
  let ok = false, out = null;
  if (env.OWNER_USERNAME && env.OWNER_PASSWORD && u === String(env.OWNER_USERNAME).toLowerCase()) {
    ok = same(await sha256(pw), await sha256(env.OWNER_PASSWORD));
    out = { owner: true, name: 'เจ้าของเว็บไซต์', teacher: '', all: true };
  } else {
    if (!env.ACCOUNTS) throw fail(500, 'config');
    const rec = USER_RE.test(u) ? await env.ACCOUNTS.get('acct:' + u, 'json') : null;
    const hash = await derive(pw, rec?.salt || '00'.repeat(16), rec?.iter || 20000);
    ok = !!rec && same(hash, rec.hash);
    if (ok) out = { owner: false, name: rec.name || u, teacher: rec.teacher || '', all: rec.role === 'admin' };
  }
  if (!ok) {
    await new Promise((r) => setTimeout(r, 700)); // หน่วงเมื่อรหัสผิด กันการเดาสุ่ม
    return reply({ error: 'login' }, 401);
  }
  const exp = Date.now() + 8 * 3600 * 1000;
  return reply({ token: await makeToken({ u, exp, o: out.owner ? 1 : 0 }, env.SESSION_SECRET), exp, ...out });
}
async function auth(req, env) {
  const p = await readToken((req.headers.get('Authorization') || '').replace(/^Bearer /, ''), env.SESSION_SECRET);
  if (!p) return null;
  if (p.o) return String(env.OWNER_USERNAME || '').toLowerCase() === p.u ? { u: p.u, owner: true, name: 'เจ้าของเว็บไซต์', teacher: '', all: true } : null;
  const rec = env.ACCOUNTS ? await env.ACCOUNTS.get('acct:' + p.u, 'json') : null; // ลบบัญชี = ยกเลิกสิทธิ์ทันที
  return rec ? { u: p.u, owner: false, name: rec.name || p.u, teacher: rec.teacher || '', all: rec.role === 'admin' } : null;
}

export default {
  async fetch(req, env) {
    const headers = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      Vary: 'Origin',
    };
    const reply = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const origin = req.headers.get('Origin');
    if (origin && origin !== env.ALLOWED_ORIGIN) return reply({ error: 'origin' }, 403);
    const path = new URL(req.url).pathname;
    try {
      if (path === '/login' && req.method === 'POST') return await login(req, env, reply);
      const user = await auth(req, env);
      if (!user) return reply({ error: 'auth' }, 401);
      const body = req.method === 'POST' && path !== '/upload' ? await req.json().catch(() => ({})) : {};

      // ── เจ้าของ: จัดการบัญชีครู ──
      if (path.startsWith('/owner/')) {
        if (!user.owner) return reply({ error: 'forbidden' }, 403);
        if (path === '/owner/accounts' && req.method === 'GET') {
          const { keys } = await env.ACCOUNTS.list({ prefix: 'acct:', limit: 200 });
          const items = await Promise.all(keys.map(async (k) => {
            const r = await env.ACCOUNTS.get(k.name, 'json');
            return r && { username: k.name.slice(5), name: r.name, teacher: r.teacher, role: r.role };
          }));
          return reply({ accounts: items.filter(Boolean) });
        }
        if (path === '/owner/accounts/save') {
          const u = String(body.username || '').trim().toLowerCase();
          if (!USER_RE.test(u)) throw fail(400, 'username');
          if (env.OWNER_USERNAME && u === String(env.OWNER_USERNAME).toLowerCase()) throw fail(400, 'reserved');
          const old = await env.ACCOUNTS.get('acct:' + u, 'json');
          let rec = { name: str(body.name, 80) || u, teacher: /^[\w-]{0,64}$/.test(body.teacher || '') ? body.teacher || '' : '', role: body.role === 'admin' ? 'admin' : 'teacher' };
          if (body.password) {
            if (String(body.password).length < 8) throw fail(400, 'password');
            const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
            rec = { ...rec, salt, iter: 20000, hash: await derive(String(body.password).slice(0, 200), salt, 20000) };
          } else if (old) rec = { ...rec, salt: old.salt, iter: old.iter, hash: old.hash };
          else throw fail(400, 'password');
          await env.ACCOUNTS.put('acct:' + u, JSON.stringify(rec));
          return reply({ ok: true });
        }
        if (path === '/owner/accounts/delete') {
          await env.ACCOUNTS.delete('acct:' + String(body.username || '').trim().toLowerCase());
          return reply({ ok: true });
        }
        return reply({ error: 'not-found' }, 404);
      }

      // ── ครู ──
      if (path === '/state') {
        const site = await siteData(env);
        const profile = /^[\w-]+$/.test(user.teacher) ? (await readJson(env, `src/content/teachers/${user.teacher}.json`)).data : null;
        return reply({
          user: { name: user.name, teacher: user.teacher, all: user.all, owner: user.owner },
          subjects: site.subjects, teachers: site.teachers, owned: owns(site, user),
          updates: (await readJson(env, overlayPath(user))).data?.updates || {},
          myCourses: user.owner ? [] : await listCourses(env, user), profile,
        });
      }
      if (path === '/save' && req.method === 'POST') {
        const owned = new Set(owns(await siteData(env), user));
        const incoming = body.updates && typeof body.updates === 'object' ? body.updates : {};
        const { data, sha } = await readJson(env, overlayPath(user));
        const updates = { ...(data?.updates || {}) };
        let n = 0;
        for (const [key, val] of Object.entries(incoming)) {
          if (!owned.has(key)) return reply({ error: 'forbidden' }, 403);
          updates[key] = clean(val || {}, user);
          n++;
        }
        if (!n) return reply({ error: 'empty' }, 400);
        await putJson(env, overlayPath(user), { updates }, `คอร์ส: แก้ไขโดย ${user.u}`, sha);
        return reply({ ok: true });
      }
      if (path === '/course/save' && req.method === 'POST') {
        if (user.owner) return reply({ error: 'forbidden' }, 403);
        const site = await siteData(env);
        let id = String(body.id || ''), sha = null, owner = user.u;
        if (id) {
          if (!COURSE_ID.test(id)) throw fail(400, 'id');
          const cur = await readJson(env, coursePath(id));
          if (!cur.data) throw fail(404, 'not-found');
          if (!(user.all || cur.data.owner === user.u)) throw fail(403, 'forbidden');
          owner = cur.data.owner;
          sha = cur.sha;
        } else id = `${user.u}-${Date.now().toString(36)}`;
        const out = { ...cleanCourse(body.data || {}, user, owner, site), owner, updatedBy: user.u, updatedAt: new Date().toISOString() };
        await putJson(env, coursePath(id), out, `คอร์ส: ${out.title} (${user.u})`, sha);
        return reply({ ok: true, id });
      }
      if (path === '/course/delete' && req.method === 'POST') {
        const id = String(body.id || '');
        if (!COURSE_ID.test(id)) throw fail(400, 'id');
        const cur = await readJson(env, coursePath(id));
        if (!cur.data) throw fail(404, 'not-found');
        if (!(user.all || cur.data.owner === user.u)) throw fail(403, 'forbidden');
        await delFile(env, coursePath(id), cur.sha, `คอร์ส: ลบ ${id} (${user.u})`);
        return reply({ ok: true });
      }
      if (path === '/profile/save' && req.method === 'POST') {
        if (!/^[\w-]+$/.test(user.teacher)) throw fail(400, 'no-profile');
        const p = `src/content/teachers/${user.teacher}.json`;
        const cur = await readJson(env, p);
        if (!cur.data) throw fail(404, 'not-found');
        const d = body.data || {};
        const photoSrc = String(d.photo?.src || '');
        const next = {
          ...cur.data, name: str(d.name, 100) || cur.data.name, position: str(d.position, 150),
          email: str(d.email, 120), phone: str(d.phone, 30),
          instagram: isHttps(d.instagram) ? str(d.instagram, 300) : '', facebook: isHttps(d.facebook) ? str(d.facebook, 300) : '', youtube: isHttps(d.youtube) ? str(d.youtube, 300) : '',
        };
        if (photoSrc && !photoSrc.includes('..') && (photoSrc.startsWith(`/uploads/teachers/${user.u}/`) || photoSrc === cur.data.photo?.src)) next.photo = { src: photoSrc, alt: str(d.photo?.alt, 150) || next.name };
        await putJson(env, p, next, `โปรไฟล์ครู: ${user.u}`, cur.sha);
        return reply({ ok: true });
      }
      if (path === '/upload' && req.method === 'POST') {
        if (user.owner) return reply({ error: 'forbidden' }, 403);
        const name = String(new URL(req.url).searchParams.get('name') || '');
        if (!ALLOWED.has((name.split('.').pop() || '').toLowerCase())) return reply({ error: 'type' }, 400);
        const data = (await req.text()).trim();
        if (!data || (data.length * 3) / 4 > MAX_BYTES) return reply({ error: 'size' }, 413);
        if (data.indexOf('"') >= 0 || data.indexOf('\\') >= 0) return reply({ error: 'data' }, 400);
        const safe = `${Date.now()}-${name.replace(/[^A-Za-z0-9._-]/g, '_').slice(-80)}`;
        await putFile(env, `public/uploads/teachers/${user.u}/${safe}`, data, `เอกสาร: ฝากไฟล์โดย ${user.u}`);
        return reply({ file: `/uploads/teachers/${user.u}/${safe}` });
      }
      return reply({ error: 'not-found' }, 404);
    } catch (e) {
      return reply({ error: e.status ? e.message : 'server' }, e.status || 500);
    }
  },
};
