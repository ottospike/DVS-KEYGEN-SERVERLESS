let subs = [];

function showToast(m, t = 'info') {
    const c = document.getElementById('toast-container'), e = document.createElement('div');
    e.className = 'toast toast-' + t;
    e.innerHTML = '<div class="toast-content"><span>' + m + '</span><button class="toast-close" onclick="this.parentElement.parentElement.remove()">&times;</button></div>';
    c.appendChild(e);
    setTimeout(() => { e.style.animation = 'slideOut 0.3s ease forwards'; setTimeout(() => e.remove(), 300); }, 4000);
}

async function fetchSubs(silent) {
    try {
        const r = await fetch('/api/subscriptions');
        const d = await r.json();
        subs = d.subscriptions || [];
        renderStats();
        renderTable();
    } catch (err) { if (!silent) showToast('Failed: ' + err.message, 'error'); }
}

function renderStats() {
    const now = new Date(), soon = new Date(now.getTime() + 86400000);
    let active = 0, expired = 0, expiring = 0;
    subs.forEach(s => { const e = new Date(s.expiresAt); if (e <= now) expired++; else if (e <= soon) expiring++; else active++; });
    document.getElementById('total-subs').textContent = subs.length;
    document.getElementById('active-subs').textContent = active;
    document.getElementById('expired-subs').textContent = expired;
    document.getElementById('expiring-subs').textContent = expiring;
}

function renderTable() {
    const c = document.getElementById('subs-container');
    if (!subs.length) { c.innerHTML = '<div class="empty-state"><h3>No subscriptions yet</h3><p>Add one above</p></div>'; return; }
    const now = new Date(), soon = new Date(now.getTime() + 86400000);
    const rows = subs.map(s => {
        const exp = new Date(s.expiresAt), sub = new Date(s.subscribedAt);
        let sc = 'active', st = 'Active';
        if (exp <= now) { sc = 'expired'; st = 'Expired'; } else if (exp <= soon) { sc = 'expiring-soon'; st = 'Expiring Soon'; }
        const diff = exp - now;
        let tl = 'Expired';
        if (diff > 0) { const d = Math.floor(diff/86400000), h = Math.floor((diff%86400000)/3600000), m = Math.floor((diff%3600000)/60000); tl = d > 0 ? d+'d '+h+'h' : h > 0 ? h+'h '+m+'m' : m+'m'; }
        return '<tr><td><strong>'+s.email+'</strong></td><td>'+s.quantity+'</td><td>'+sub.toLocaleString()+'</td><td>'+exp.toLocaleString()+'<br><small style="color:#999">'+tl+'</small></td><td><span class="status '+sc+'">'+st+'</span></td><td><div class="actions"><button class="success" onclick="sendKeys(\''+s.email+'\')">Send Keys</button><button class="secondary" onclick="editSub(\''+s.email+'\')">Edit</button><button class="danger" onclick="deleteSub(\''+s.email+'\')">Delete</button></div></td></tr>';
    }).join('');
    c.innerHTML = '<table><thead><tr><th>Email</th><th>Keys</th><th>Subscribed</th><th>Expires</th><th>Status</th><th>Actions</th></tr></thead><tbody>' + rows + '</tbody></table>';
}

document.getElementById('subscribe-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('email').value, qty = parseInt(document.getElementById('quantity').value);
    try {
        const r = await fetch('/api/subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, quantity: qty }) });
        const d = await r.json();
        if (r.ok) { showToast('Added', 'success'); e.target.reset(); fetchSubs(true); } else showToast(d.error, 'error');
    } catch (err) { showToast(err.message, 'error'); }
});

async function sendKeys(email) {
    showToast('Generating keys for ' + email + '...', 'info');
    try {
        const r = await fetch('/api/send-subscription?email=' + encodeURIComponent(email), { method: 'POST' });
        const d = await r.json();
        showToast(r.ok ? d.message : d.error, r.ok ? 'success' : 'error');
        if (r.ok) fetchSubs(true);
    } catch (err) { showToast(err.message, 'error'); }
}

function editSub(email) {
    const s = subs.find(x => x.email === email); if (!s) return;
    document.getElementById('edit-email').value = email;
    document.getElementById('edit-quantity').value = s.quantity;
    document.getElementById('edit-modal').classList.add('active');
}

document.getElementById('edit-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('edit-email').value, qty = parseInt(document.getElementById('edit-quantity').value);
    try {
        const r = await fetch('/api/subscriptions?email=' + encodeURIComponent(email), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity: qty }) });
        if (r.ok) { showToast('Updated', 'success'); document.getElementById('edit-modal').classList.remove('active'); fetchSubs(true); } else { const d = await r.json(); showToast(d.error, 'error'); }
    } catch (err) { showToast(err.message, 'error'); }
});

async function deleteSub(email) {
    if (!confirm('Delete subscription for ' + email + '?')) return;
    try {
        const r = await fetch('/api/subscriptions?email=' + encodeURIComponent(email), { method: 'DELETE' });
        if (r.ok) { showToast('Deleted', 'success'); fetchSubs(true); } else { const d = await r.json(); showToast(d.error, 'error'); }
    } catch (err) { showToast(err.message, 'error'); }
}

document.getElementById('edit-modal').addEventListener('click', e => { if (e.target.id === 'edit-modal') e.target.classList.remove('active'); });
document.addEventListener('DOMContentLoaded', () => { fetchSubs(); setInterval(() => fetchSubs(true), 30000); });
