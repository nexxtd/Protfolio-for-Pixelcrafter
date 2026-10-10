let DATA = null;
const $ = (id) => document.getElementById(id);
const token = () => localStorage.getItem('pf_token');
const auth = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

if (token()) showApp(); else $('loginCard').style.display = '';

$('loginBtn').onclick = async () => {
  $('loginMsg').textContent = 'Checking…';
  const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('pw').value }) });
  const out = await res.json();
  if (!res.ok) { $('loginMsg').textContent = out.error || 'Login failed'; return; }
  localStorage.setItem('pf_token', out.token);
  showApp();
};
$('logoutBtn').onclick = () => { localStorage.removeItem('pf_token'); location.reload(); };
document.querySelectorAll('#tabs button').forEach((b) => (b.onclick = () => {
  document.querySelectorAll('#tabs button').forEach((x) => x.classList.remove('on'));
  document.querySelectorAll('.panel').forEach((x) => x.classList.remove('on'));
  b.classList.add('on'); $('p-' + b.dataset.t).classList.add('on');
  if (b.dataset.t === 'messages') loadMessages();
}));

async function showApp() {
  $('loginCard').style.display = 'none';
  $('app').hidden = false;
  $('logoutBtn').hidden = false;
  const res = await fetch('/api/content');
  DATA = await res.json();
  // merge server messages view is separate; keep local copy for editing
  const full = await fetch('/api/content').then((r) => r.json());
  DATA = full;
  renderAll();
}

function renderAll() {
  const p = DATA.profile || {};
  $('profileForm').innerHTML = `
    <div class="row">
      <div class="field"><label>Display name</label><input id="f-name" value="${esc(p.name)}" /></div>
      <div class="field"><label>Role</label><input id="f-role" value="${esc(p.role)}" /></div>
    </div>
    <div class="field"><label>Tagline</label><input id="f-tagline" value="${esc(p.tagline)}" /></div>
    <div class="field"><label>Bio</label><textarea id="f-bio" rows="4">${esc(p.bio)}</textarea></div>
    <div class="row">
      <div class="field"><label>Location</label><input id="f-location" value="${esc(p.location)}" /></div>
      <div class="field"><label>Email</label><input id="f-email" value="${esc(p.email)}" /></div>
    </div>
    <div class="row">
      <div class="field"><label>Phone</label><input id="f-phone" value="${esc(p.phone)}" /></div>
      <div class="field"><label>Instagram URL</label><input id="f-instagram" value="${esc(p.instagram)}" /></div>
    </div>
    <div class="field"><label>LinkedIn URL</label><input id="f-linkedin" value="${esc(p.linkedin)}" /></div>
    <div class="row">${['height', 'bust', 'waist', 'hips', 'shoe', 'hair', 'eyes'].map((k) => `<div class="field"><label>${k}</label><input id="f-comp-${k}" value="${esc(p.compCard?.[k])}" /></div>`).join('')}</div>`;
  $('f-heroImage').value = p.heroImage || '';
  $('f-aboutImage').value = p.aboutImage || '';
  $('set-accent').value = DATA.settings?.accentColor || '#c9a96a';
  $('set-announce').value = DATA.settings?.announcement || '';
  $('set-stats').value = (DATA.stats || []).map((s) => `${s.label} | ${s.value}`).join('\n');
  renderLists();
}

function collectProfile() {
  const v = (id) => $(id)?.value ?? '';
  DATA.profile = {
    ...DATA.profile,
    name: v('f-name'), role: v('f-role'), tagline: v('f-tagline'), bio: v('f-bio'),
    location: v('f-location'), email: v('f-email'), phone: v('f-phone'),
    instagram: v('f-instagram'), linkedin: v('f-linkedin'),
    heroImage: v('f-heroImage'), aboutImage: v('f-aboutImage'),
    compCard: { height: v('f-comp-height'), bust: v('f-comp-bust'), waist: v('f-comp-waist'), hips: v('f-comp-hips'), shoe: v('f-comp-shoe'), hair: v('f-comp-hair'), eyes: v('f-comp-eyes') },
  };
  DATA.settings = { ...DATA.settings, accentColor: $('set-accent').value, announcement: $('set-announce').value };
  DATA.stats = $('set-stats').value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const [label, value] = l.split('|').map((x) => (x || '').trim());
    return { label: label || l, value: value || '' };
  });
}

async function saveAll(msg = 'Saved ✓') {
  collectProfile();
  const res = await fetch('/api/content', { method: 'PUT', headers: auth(), body: JSON.stringify(DATA) });
  const out = await res.json();
  if (!res.ok && res.status === 401) { localStorage.removeItem('pf_token'); location.reload(); return; }
  $('saveMsg').textContent = res.ok ? msg + ' — view it on the homepage.' : out.error || 'Save failed';
}
$('saveProfile').onclick = () => saveAll('Profile saved ✓');
$('saveAll').onclick = () => saveAll();
$('viewSite').onclick = () => (location.href = '/');
$('exportBtn').onclick = () => {
  collectProfile();
  const blob = new Blob([JSON.stringify(DATA, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'portfolio-content.json'; a.click();
};

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('');
    if (file.size > 4 * 1024 * 1024) return reject(new Error('Image too large — please use under 4MB'));
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
$('heroFile').onchange = async (e) => { try { $('f-heroImage').value = await fileToDataUrl(e.target.files[0]); } catch (err) { alert(err.message); } };
$('aboutFile').onchange = async (e) => { try { $('f-aboutImage').value = await fileToDataUrl(e.target.files[0]); } catch (err) { alert(err.message); } };
$('g-file').onchange = async (e) => { try { $('g-img').value = await fileToDataUrl(e.target.files[0]); } catch (err) { alert(err.message); } };
$('pr-file').onchange = async (e) => { try { $('pr-img').value = await fileToDataUrl(e.target.files[0]); } catch (err) { alert(err.message); } };

function renderLists() {
  $('gList').innerHTML = (DATA.gallery || []).map((g) => `
    <div class="list-item">${g.image ? `<img src="${esc(g.image)}" />` : ''}
      <div class="grow"><b>${esc(g.title)}</b><br /><span class="muted">${esc(g.category)} — ${esc(g.description || '')}</span></div>
      <button class="danger" data-del-g="${g.id}">Delete</button></div>`).join('');
  document.querySelectorAll('[data-del-g]').forEach((b) => (b.onclick = async () => {
    DATA.gallery = DATA.gallery.filter((x) => x.id !== Number(b.dataset.delG)); renderLists(); await saveAll('Deleted ✓');
  }));

  $('prList').innerHTML = (DATA.projects || []).map((p) => `
    <div class="list-item">${p.image ? `<img src="${esc(p.image)}" />` : ''}
      <div class="grow"><b>${esc(p.title)}</b><br /><span class="muted">${esc(p.role)} · ${esc(p.client || '')}</span></div>
      <button class="danger" data-del-pr="${p.id}">Delete</button></div>`).join('');
  document.querySelectorAll('[data-del-pr]').forEach((b) => (b.onclick = async () => {
    DATA.projects = DATA.projects.filter((x) => x.id !== Number(b.dataset.delPr)); renderLists(); await saveAll('Deleted ✓');
  }));

  $('sList').innerHTML = (DATA.services || []).map((s) => `
    <div class="list-item"><div class="grow"><b>${esc(s.title)}</b><br /><span class="muted">${esc(s.description)} (${esc(s.price || '')})</span></div>
      <button class="danger" data-del-s="${s.id}">Delete</button></div>`).join('');
  document.querySelectorAll('[data-del-s]').forEach((b) => (b.onclick = async () => {
    DATA.services = DATA.services.filter((x) => x.id !== Number(b.dataset.delS)); renderLists(); await saveAll('Deleted ✓');
  }));

  $('tList').innerHTML = (DATA.testimonials || []).map((t) => `
    <div class="list-item"><div class="grow"><b>${esc(t.name)}</b><br /><span class="muted">${esc(t.text)}</span></div>
      <button class="danger" data-del-t="${t.id}">Delete</button></div>`).join('');
  document.querySelectorAll('[data-del-t]').forEach((b) => (b.onclick = async () => {
    DATA.testimonials = DATA.testimonials.filter((x) => x.id !== Number(b.dataset.delT)); renderLists(); await saveAll('Deleted ✓');
  }));
}

const nextId = (arr) => Math.max(0, ...(arr || []).map((x) => x.id || 0)) + 1;
$('gAdd').onclick = async () => {
  DATA.gallery = DATA.gallery || [];
  DATA.gallery.push({ id: nextId(DATA.gallery), title: $('g-title').value || 'Untitled', category: $('g-cat').value || 'Editorial', description: $('g-desc').value || '', image: $('g-img').value || '' });
  renderLists(); await saveAll('Photo added ✓');
};
$('prAdd').onclick = async () => {
  DATA.projects = DATA.projects || [];
  DATA.projects.push({ id: nextId(DATA.projects), title: $('pr-title').value || 'Untitled', role: $('pr-role').value || '', client: $('pr-client').value || '', date: $('pr-date').value || '', status: $('pr-status').value || 'Completed', description: $('pr-desc').value || '', tags: $('pr-tags').value.split(',').map((x) => x.trim()).filter(Boolean), outcome: $('pr-outcome').value || '', image: $('pr-img').value || '' });
  renderLists(); await saveAll('Project added ✓');
};
$('sAdd').onclick = async () => {
  DATA.services = DATA.services || [];
  DATA.services.push({ id: nextId(DATA.services), title: $('s-title').value || 'Untitled', price: $('s-price').value || '', description: $('s-desc').value || '' });
  renderLists(); await saveAll('Service added ✓');
};
$('tAdd').onclick = async () => {
  DATA.testimonials = DATA.testimonials || [];
  DATA.testimonials.push({ id: nextId(DATA.testimonials), name: $('t-name').value || '', role: $('t-role').value || '', text: $('t-text').value || '' });
  renderLists(); await saveAll('Testimonial added ✓');
};

async function loadMessages() {
  const res = await fetch('/api/admin/messages', { headers: auth() });
  if (res.status === 401) { localStorage.removeItem('pf_token'); location.reload(); return; }
  const msgs = await res.json();
  $('msgList').innerHTML = msgs.length ? msgs.map((m) => `
    <div class="list-item"><div class="grow"><b>${esc(m.name)} &lt;${esc(m.email)}&gt;</b><br />${esc(m.message)}<br /><span class="muted">${esc(m.created_at || '')}</span></div>
    <button class="danger" data-del-m="${m.id}">Delete</button></div>`).join('') : '<p class="muted">No messages yet.</p>';
  document.querySelectorAll('[data-del-m]').forEach((b) => (b.onclick = async () => {
    await fetch('/api/admin/messages/' + b.dataset.delM, { method: 'DELETE', headers: auth() });
    loadMessages();
  }));
}
