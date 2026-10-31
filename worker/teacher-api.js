// Cloudflare Worker: ระบบล็อกอินครู — ตรวจชื่อผู้ใช้/รหัสผ่าน แล้วบันทึกการแก้ไขคอร์ส + ไฟล์เอกสารลง GitHub แทนครู
// ตั้งค่าตามไฟล์ README-TH.md (ตัวแปร: GITHUB_REPO GITHUB_BRANCH SITE_URL ALLOWED_ORIGIN / ความลับ: GITHUB_TOKEN SESSION_SECRET USERS)
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

const ALLOWED = new Set(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'zip', 'rar', '7z', 'txt', 'csv', 'png', 'jpg', 'jpeg', 'webp', 'gif']);
const MAX_BYTES = 6 * 1024 * 1024;

async function derive(password, saltHex, iter) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return toHex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations: iter }, key, 256));
}
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
// เขียนไฟล์ผ่าน GitHub API (ประกอบ JSON เองเพื่อไม่ต้องแปลงไฟล์ใหญ่ — b64 ต้องไม่มีอักขระที่ทำลายโครงสร้าง JSON)
async function putFile(env, path, b64, message, sha) {
  const body = `{"message":${JSON.stringify(message)},"branch":${JSON.stringify(branch(env))}${sha ? `,"sha":${JSON.stringify(sha)}` : ''},"content":"${b64}"}`;
  const r = await gh(env, path, { method: 'PUT', body });
  if (!r.ok) throw new Error('github-write');
}
async function siteData(env) {
  const r = await fetch(`${env.SITE_URL}/data/teacher-api.json`, { cf: { cacheTtl: 30 } });
  if (!r.ok) throw new Error('site');
  return r.json();
}
const owns = (site, user) => site.courses.filter((c) => user.all || (user.teacher && c.teachers.includes(user.teacher))).map((c) => c.key);
const overlayPath = (user) => `src/content/course-updates/${user.u}.json`;

function clean(u, user) {
  const out = { closed: !!u.closed, ended: !!u.ended };
  if (typeof u.applyUrl === 'string') out.applyUrl = /^https:\/\//i.test(u.applyUrl.trim()) ? u.applyUrl.trim().slice(0, 600) : '';
  out.documents = (Array.isArray(u.documents) ? u.documents : [])
    .slice(0, 60)
    .map((d) => ({ title: String(d?.title || '').trim().slice(0, 150), file: String(d?.file || ''), note: String(d?.note || '').trim().slice(0, 200) }))
    .filter((d) => d.title && d.file.startsWith(`/uploads/teachers/${user.u}/`) && !d.file.includes('..'));
  return out;
}

async function login(req, env, reply) {
  const { username = '', password = '' } = await req.json().catch(() => ({}));
  const users = JSON.parse(env.USERS || '{}');
  const u = String(username).trim().toLowerCase();
  const rec = /^[a-z0-9_-]{2,32}$/.test(u) ? users[u] : null;
  const hash = await derive(String(password).slice(0, 200), rec?.salt || '00'.repeat(16), rec?.iter || 20000);
  if (!rec || !same(hash, rec.hash)) {
    await new Promise((r) => setTimeout(r, 700)); // หน่วงเวลาเมื่อรหัสผิด กันการเดาสุ่ม
    return reply({ error: 'login' }, 401);
  }
  const exp = Date.now() + 8 * 3600 * 1000;
  return reply({ token: await makeToken({ u, exp }, env.SESSION_SECRET), exp, name: rec.name || u, teacher: rec.teacher || '', all: !!rec.all });
}
async function auth(req, env) {
  const p = await readToken((req.headers.get('Authorization') || '').replace(/^Bearer /, ''), env.SESSION_SECRET);
  const rec = p && JSON.parse(env.USERS || '{}')[p.u];
  return rec ? { u: p.u, name: rec.name || p.u, teacher: rec.teacher || '', all: !!rec.all } : null; // ลบผู้ใช้ออกจาก USERS = ยกเลิกสิทธิ์ทันที
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
    const url = new URL(req.url);
    try {
      if (url.pathname === '/login' && req.method === 'POST') return await login(req, env, reply);
      const user = await auth(req, env);
      if (!user) return reply({ error: 'auth' }, 401);

      if (url.pathname === '/state') {
        const site = await siteData(env);
        const { data } = await readJson(env, overlayPath(user));
        return reply({ user: { name: user.name, teacher: user.teacher, all: user.all }, owned: owns(site, user), updates: data?.updates || {} });
      }
      if (url.pathname === '/save' && req.method === 'POST') {
        const body = await req.json();
        const owned = new Set(owns(await siteData(env), user));
        const incoming = body && typeof body.updates === 'object' && body.updates ? body.updates : {};
        const { data, sha } = await readJson(env, overlayPath(user));
        const updates = { ...(data?.updates || {}) };
        let n = 0;
        for (const [key, val] of Object.entries(incoming)) {
          if (!owned.has(key)) return reply({ error: 'forbidden' }, 403);
          updates[key] = clean(val || {}, user);
          n++;
        }
        if (!n) return reply({ error: 'empty' }, 400);
        await putFile(env, overlayPath(user), utf8ToB64(JSON.stringify({ updates }, null, 2) + '\n'), `คอร์ส: แก้ไขโดย ${user.u}`, sha);
        return reply({ ok: true });
      }
      if (url.pathname === '/upload' && req.method === 'POST') {
        const name = String(url.searchParams.get('name') || '');
        const ext = (name.split('.').pop() || '').toLowerCase();
        if (!ALLOWED.has(ext)) return reply({ error: 'type' }, 400);
        const data = (await req.text()).trim();
        if (!data || (data.length * 3) / 4 > MAX_BYTES) return reply({ error: 'size' }, 413);
        if (data.indexOf('"') >= 0 || data.indexOf('\\') >= 0) return reply({ error: 'data' }, 400);
        const safe = `${Date.now()}-${name.replace(/[^A-Za-z0-9._-]/g, '_').slice(-80)}`;
        await putFile(env, `public/uploads/teachers/${user.u}/${safe}`, data, `เอกสาร: ฝากไฟล์โดย ${user.u}`);
        return reply({ file: `/uploads/teachers/${user.u}/${safe}` });
      }
      return reply({ error: 'not-found' }, 404);
    } catch (e) {
      return reply({ error: 'server' }, 500);
    }
  },
};
