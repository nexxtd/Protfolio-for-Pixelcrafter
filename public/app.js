let DATA = null;
let activeFilter = 'All';
const $ = (id) => document.getElementById(id);

async function load() {
  const res = await fetch('/api/content');
  DATA = await res.json();
  render();
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function render() {
  const p = DATA.profile || {};
  document.title = `${p.name || 'Portfolio'} — Model & Project Manager`;
  $('brandName').textContent = p.name || '';
  $('footName').textContent = p.name || '';
  $('heroRole').textContent = p.role || '';
  $('heroName').textContent = p.name || '';
  $('heroTagline').textContent = p.tagline || '';
  $('heroBio').textContent = (p.bio || '').slice(0, 220);
  $('aboutBio').textContent = p.bio || '';
  $('aboutMeta').textContent = [p.location, p.email, p.phone].filter(Boolean).join(' · ');
  if (p.heroImage) $('heroImg').src = p.heroImage;
  if (p.aboutImage) $('aboutImg').src = p.aboutImage;
  if (DATA.settings?.accentColor) document.documentElement.style.setProperty('--accent', DATA.settings.accentColor);
  if (DATA.settings?.announcement) { $('announce').hidden = false; $('announce').textContent = DATA.settings.announcement; }

  $('stats').innerHTML = (DATA.stats || []).map((s) => `<div><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join('');
  $('marquee').innerHTML = Array(2).fill(['EDITORIAL', 'COMMERCIAL', 'RUNWAY', 'PROJECT MANAGEMENT', 'ART DIRECTION', 'LOOKBOOKS'].map((t) => `<span>✦ ${t}</span>`).join('')).join('');

  const comp = p.compCard || {};
  $('compCard').innerHTML = Object.entries(comp).map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');

  const cats = ['All', ...new Set((DATA.gallery || []).map((g) => g.category).filter(Boolean))];
  $('filters').innerHTML = cats.map((c) => `<button data-c="${esc(c)}" class="${c === activeFilter ? 'on' : ''}">${esc(c)}</button>`).join('');
  document.querySelectorAll('#filters button').forEach((b) => (b.onclick = () => { activeFilter = b.dataset.c; render(); }));

  const items = (DATA.gallery || []).filter((g) => activeFilter === 'All' || g.category === activeFilter);
  $('galleryGrid').innerHTML = items.map((g) => `
    <figure class="g-item" data-id="${g.id}">
      ${g.image ? `<img src="${esc(g.image)}" alt="${esc(g.title)}" loading="lazy" />` : `<img alt="" />`}
      <figcaption class="cap"><b>${esc(g.title)}</b><span>${esc(g.category || '')}</span></figcaption>
    </figure>`).join('');
  document.querySelectorAll('.g-item').forEach((el) => (el.onclick = () => openLightbox(Number(el.dataset.id))));

  $('projectGrid').innerHTML = (DATA.projects || []).map((pr) => `
    <article class="card" data-id="${pr.id}" style="cursor:pointer">
      ${pr.image ? `<img src="${esc(pr.image)}" alt="" style="width:100%;height:220px;object-fit:cover;border-radius:12px;margin-bottom:12px" />` : ''}
      <p class="kicker">${esc(pr.status || '')} · ${esc(pr.date || '')}</p>
      <h3>${esc(pr.title)}</h3>
      <p class="muted">${esc(pr.role || '')}${pr.client ? ` — ${esc(pr.client)}` : ''}</p>
      <p>${esc((pr.description || '').slice(0, 140))}…</p>
      <div>${(pr.tags || []).map((t) => `<span class="pill">${esc(t)}</span>`).join('')}</div>
    </article>`).join('');
  document.querySelectorAll('#projectGrid .card').forEach((el) => (el.onclick = () => openProject(Number(el.dataset.id))));

  $('serviceGrid').innerHTML = (DATA.services || []).map((s) => `
    <article class="card"><h3>${esc(s.title)}</h3><p class="muted">${esc(s.description)}</p><p><b>${esc(s.price || '')}</b></p></article>`).join('');

  $('quoteGrid').innerHTML = (DATA.testimonials || []).map((t) => `
    <article class="card"><p>“${esc(t.text)}”</p><p><b>${esc(t.name)}</b> <span class="muted">· ${esc(t.role || '')}</span></p></article>`).join('');

  $('contactList').innerHTML = [
    p.email && `<li>✉️ <a href="mailto:${esc(p.email)}">${esc(p.email)}</a></li>`,
    p.phone && `<li>📞 ${esc(p.phone)}</li>`,
    p.location && `<li>📍 ${esc(p.location)}</li>`,
    p.instagram && `<li>📸 <a href="${esc(p.instagram)}" target="_blank" rel="noreferrer">Instagram</a></li>`,
    p.linkedin && `<li>💼 <a href="${esc(p.linkedin)}" target="_blank" rel="noreferrer">LinkedIn</a></li>`,
  ].filter(Boolean).join('');
  $('year').textContent = new Date().getFullYear();
}

function openLightbox(id) {
  const g = (DATA.gallery || []).find((x) => x.id === id);
  if (!g) return;
  $('lbImg').src = g.image || '';
  $('lbCap').textContent = `${g.title || ''} — ${g.description || ''}`;
  $('lightbox').hidden = false;
}

function openProject(id) {
  const pr = (DATA.projects || []).find((x) => x.id === id);
  if (!pr) return;
  $('modalBody').innerHTML = `
    ${pr.image ? `<img src="${esc(pr.image)}" style="width:100%;border-radius:12px;margin-bottom:12px" />` : ''}
    <p class="kicker">${esc(pr.status || '')} · ${esc(pr.date || '')}</p>
    <h2>${esc(pr.title)}</h2>
    <p class="muted">${esc(pr.role || '')}${pr.client ? ` — ${esc(pr.client)}` : ''}</p>
    <p>${esc(pr.description || '')}</p>
    ${pr.outcome ? `<p><b>Outcome:</b> ${esc(pr.outcome)}</p>` : ''}
    <div>${(pr.tags || []).map((t) => `<span class="pill">${esc(t)}</span>`).join('')}</div>`;
  $('modal').hidden = false;
}

$('lbClose').onclick = () => ($('lightbox').hidden = true);
$('lightbox').onclick = (e) => { if (e.target.id === 'lightbox') $('lightbox').hidden = true; };
$('modalClose').onclick = () => ($('modal').hidden = true);
$('modal').onclick = (e) => { if (e.target.id === 'modal') $('modal').hidden = true; };
$('menuBtn').onclick = () => $('mobileLinks').classList.toggle('open');
document.querySelectorAll('#mobileLinks a').forEach((a) => (a.onclick = () => $('mobileLinks').classList.remove('open')));

$('contactForm').onsubmit = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  $('formMsg').textContent = 'Sending…';
  const res = await fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: fd.get('name'), email: fd.get('email'), message: fd.get('message') }),
  });
  const out = await res.json();
  $('formMsg').textContent = res.ok ? 'Thanks — message sent! I reply within 48 hours.' : out.error || 'Failed to send.';
  if (res.ok) e.target.reset();
};

load();
