// ============================================================
// CONFIG
// ============================================================
const SCRIPT_URL = 'YOUR_APPS_SCRIPT_URL_HERE';

const TARIFAS = { A: 100, B: 150 };

// ============================================================
// THEME
// ============================================================
function applyTheme() {
  const theme = localStorage.getItem('crm_theme') || 'dark';
  document.body.classList.toggle('light', theme === 'light');
  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = theme === 'light' ? '🌙 Modo oscuro' : '☀ Modo claro';
}

function toggleTheme() {
  const current = localStorage.getItem('crm_theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('crm_theme', next);
  applyTheme();
}

// ============================================================
// AUTH
// ============================================================
function getSession() {
  return JSON.parse(sessionStorage.getItem('crm_session') || 'null');
}

function setSession(user) {
  sessionStorage.setItem('crm_session', JSON.stringify(user));
}

function requireAuth(role) {
  const session = getSession();
  if (!session) { window.location.href = 'index.html'; return; }
  if (role === 'admin' && session.role !== 'admin') { window.location.href = 'employee.html'; }
  if (role === 'employee' && session.role === 'admin') { window.location.href = 'admin.html'; }
}

function doLogout() {
  sessionStorage.removeItem('crm_session');
  window.location.href = 'index.html';
}

async function doLogin() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  if (!username || !password) { errEl.style.display = 'block'; errEl.textContent = 'Completá los campos'; return; }

  const users = getUsers();
  const user = users.find(u => u.username === username && u.password === password);

  if (!user) { errEl.style.display = 'block'; errEl.textContent = 'Usuario o contraseña incorrectos'; return; }

  setSession({ username: user.username, name: user.name, role: user.role });
  window.location.href = user.role === 'admin' ? 'admin.html' : 'employee.html';
}

// ============================================================
// USERS STORAGE
// ============================================================
function getUsers() {
  const stored = localStorage.getItem('crm_users');
  if (stored) return JSON.parse(stored);
  // Default admin user
  const defaults = [{ id: 'admin-default', name: 'Administrador', username: 'admin', password: 'admin123', role: 'admin' }];
  localStorage.setItem('crm_users', JSON.stringify(defaults));
  return defaults;
}

function saveUsers(users) {
  localStorage.setItem('crm_users', JSON.stringify(users));
}

function createUser() {
  const name     = document.getElementById('new-name').value.trim();
  const username = document.getElementById('new-user').value.trim();
  const password = document.getElementById('new-pass').value.trim();
  const role     = document.getElementById('new-role').value;

  if (!name || !username || !password) { showToast('Completá todos los campos', 'error'); return; }

  const users = getUsers();
  if (users.find(u => u.username === username)) { showToast('Ese usuario ya existe', 'error'); return; }

  users.push({ id: Date.now().toString(), name, username, password, role });
  saveUsers(users);
  pushUsersToSheets(users);

  document.getElementById('new-name').value = '';
  document.getElementById('new-user').value = '';
  document.getElementById('new-pass').value = '';

  showToast(`Usuario "${username}" creado`);
  renderUsersTable();
}

function deleteUser(id) {
  if (!confirm('¿Eliminar este usuario?')) return;
  const users = getUsers().filter(u => u.id !== id);
  saveUsers(users);
  pushUsersToSheets(users);
  showToast('Usuario eliminado');
  renderUsersTable();
}

function renderUsersTable() {
  const users = getUsers();
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;
  tbody.innerHTML = users.map(u => `
    <tr>
      <td>${u.name}</td>
      <td>${u.username}</td>
      <td><span class="pill ${u.role === 'admin' ? 'active' : 'inactive'}">${u.role}</span></td>
      <td>
        ${u.id !== 'admin-default' ? `<button class="btn btn-danger" style="font-size:0.72rem;padding:4px 10px;" onclick="deleteUser('${u.id}')">Eliminar</button>` : '—'}
      </td>
    </tr>
  `).join('');
}

// ============================================================
// SALES STORAGE
// ============================================================
function getSales() {
  return JSON.parse(localStorage.getItem('crm_sales') || '[]');
}

function saveSales(sales) {
  localStorage.setItem('crm_sales', JSON.stringify(sales));
}

// ============================================================
// GOOGLE SHEETS SYNC
// ============================================================
async function sheetsRequest(params) {
  if (!SCRIPT_URL || SCRIPT_URL === 'YOUR_APPS_SCRIPT_URL_HERE') return;
  try {
    const form = new FormData();
    form.append('payload', JSON.stringify(params));
    await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: form });
  } catch (e) { console.warn('Sheets sync error:', e); }
}

async function pushToSheets(sale) { await sheetsRequest({ action: 'add', sale }); }
async function deleteFromSheets(id) { await sheetsRequest({ action: 'delete', id }); }
async function updateStatusInSheets(id, estado) { await sheetsRequest({ action: 'updateStatus', id, estado }); }
async function pushUsersToSheets(users) { await sheetsRequest({ action: 'syncUsers', users }); }

// ============================================================
// TOAST
// ============================================================
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => { t.className = 'toast'; }, 3000);
}

// ============================================================
// EMPLOYEE
// ============================================================
function initEmployee() {
  populateMonthFilter('filter-mes-emp', renderEmployeeTable);
  renderEmployeeTable();
}

async function submitSale() {
  const session = getSession();
  const client  = document.getElementById('client-name').value.trim();
  const tarifa  = document.getElementById('tarifa').value;
  const mes     = document.getElementById('mes').value;
  const estado  = document.getElementById('estado').value;
  const notas   = document.getElementById('notas').value.trim();
  const status  = document.getElementById('form-status');

  if (!client || !tarifa || !mes) { showToast('Completá todos los campos obligatorios', 'error'); return; }

  const sale = {
    id: Date.now().toString(),
    empName: session.name,
    empUsername: session.username,
    client, tarifa,
    monto: TARIFAS[tarifa],
    mes, estado, notas,
    createdAt: new Date().toISOString(),
  };

  status.textContent = 'Guardando...';
  const sales = getSales();
  sales.push(sale);
  saveSales(sales);
  await pushToSheets(sale);

  document.getElementById('client-name').value = '';
  document.getElementById('notas').value = '';
  document.getElementById('tarifa').value = '';
  document.getElementById('estado').value = 'activa';
  status.textContent = '';

  showToast('Venta registrada');
  populateMonthFilter('filter-mes-emp', renderEmployeeTable);
  renderEmployeeTable();
}

function renderEmployeeTable() {
  const session = getSession();
  const filterMes = document.getElementById('filter-mes-emp')?.value || '';
  const sales = getSales().filter(s =>
    s.empUsername === session?.username &&
    (!filterMes || s.mes === filterMes)
  );

  const tbody = document.getElementById('emp-table-body');
  if (!sales.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">No hay ventas registradas aún</td></tr>'; return; }

  tbody.innerHTML = sales.map(s => `
    <tr>
      <td>${s.client}</td>
      <td>Tarifa ${s.tarifa}</td>
      <td>${s.monto} €</td>
      <td>${formatMes(s.mes)}</td>
      <td><span class="pill ${s.estado}">${s.estado}</span></td>
      <td>
        <button class="btn btn-outline" style="font-size:0.72rem;padding:4px 10px;" onclick="toggleStatus('${s.id}','${s.estado}','emp')">
          ${s.estado === 'activa' ? 'Marcar inactiva' : 'Marcar activa'}
        </button>
      </td>
    </tr>
  `).join('');
}

// ============================================================
// ADMIN
// ============================================================
function initAdmin() {
  loadData();
  setInterval(loadData, 30000);
}

function loadData() {
  renderAdminStats();
  renderAdminTable();
  renderEmpBreakdown();
  renderUsersTable();
  populateMonthFilter('filter-mes', renderAdminTable);
  populateEmpFilter();
}

function renderAdminStats() {
  const filterMes = document.getElementById('filter-mes')?.value || '';
  const sales = getSales().filter(s => !filterMes || s.mes === filterMes);
  const activas = sales.filter(s => s.estado === 'activa');
  const potencial = sales.reduce((a, s) => a + s.monto, 0);
  const real = activas.reduce((a, s) => a + s.monto, 0);

  const taA = sales.filter(s => s.tarifa === 'A'), taAact = taA.filter(s => s.estado === 'activa');
  const taB = sales.filter(s => s.tarifa === 'B'), taBact = taB.filter(s => s.estado === 'activa');

  set('stat-potencial', `${potencial} €`);
  set('stat-real', `${real} €`);
  set('stat-activas', activas.length);
  set('stat-activas-sub', `de ${sales.length} registradas`);
  set('stat-perdidos', `${potencial - real} €`);
  set('stat-ta-real', `${taAact.reduce((a, s) => a + s.monto, 0)} €`);
  set('stat-ta-sub', `${taAact.length} activas / ${taA.length} total`);
  set('stat-tb-real', `${taBact.reduce((a, s) => a + s.monto, 0)} €`);
  set('stat-tb-sub', `${taBact.length} activas / ${taB.length} total`);
}

function renderEmpBreakdown() {
  const emps = {};
  getSales().forEach(s => { if (!emps[s.empName]) emps[s.empName] = []; emps[s.empName].push(s); });
  const tbody = document.getElementById('emp-breakdown-body');
  const entries = Object.entries(emps);
  if (!entries.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty">Sin datos</td></tr>'; return; }
  tbody.innerHTML = entries.map(([name, ss]) => {
    const act = ss.filter(s => s.estado === 'activa');
    return `<tr><td>${name}</td><td>${ss.length}</td><td>${act.length}</td><td>${ss.reduce((a,s)=>a+s.monto,0)} €</td><td>${act.reduce((a,s)=>a+s.monto,0)} €</td></tr>`;
  }).join('');
}

function renderAdminTable() {
  renderAdminStats();
  const fm = document.getElementById('filter-mes')?.value || '';
  const fe = document.getElementById('filter-emp')?.value || '';
  const fs = document.getElementById('filter-estado')?.value || '';
  const sales = getSales().filter(s => (!fm || s.mes === fm) && (!fe || s.empName === fe) && (!fs || s.estado === fs));
  const tbody = document.getElementById('admin-table-body');
  if (!sales.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty">No hay ventas que coincidan</td></tr>'; return; }
  tbody.innerHTML = sales.map(s => `
    <tr>
      <td>${s.empName}</td><td>${s.client}</td><td>Tarifa ${s.tarifa}</td><td>${s.monto} €</td>
      <td>${formatMes(s.mes)}</td><td><span class="pill ${s.estado}">${s.estado}</span></td>
      <td style="color:var(--text-muted);font-size:0.82rem;">${s.notas||'—'}</td>
      <td style="display:flex;gap:6px;">
        <button class="btn btn-outline" style="font-size:0.72rem;padding:4px 10px;" onclick="toggleStatus('${s.id}','${s.estado}','admin')">
          ${s.estado==='activa'?'Inactiva':'Activa'}
        </button>
        <button class="btn btn-danger" style="font-size:0.72rem;padding:4px 10px;" onclick="deleteSale('${s.id}')">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

// ============================================================
// SHARED ACTIONS
// ============================================================
async function toggleStatus(id, current, mode) {
  const next = current === 'activa' ? 'inactiva' : 'activa';
  saveSales(getSales().map(s => s.id === id ? { ...s, estado: next } : s));
  await updateStatusInSheets(id, next);
  showToast(`Venta marcada como ${next}`);
  if (mode === 'emp') renderEmployeeTable(); else loadData();
}

async function deleteSale(id) {
  if (!confirm('¿Eliminar esta venta?')) return;
  saveSales(getSales().filter(s => s.id !== id));
  await deleteFromSheets(id);
  showToast('Venta eliminada');
  loadData();
}

function exportCSV() {
  const sales = getSales();
  if (!sales.length) { showToast('No hay datos para exportar', 'error'); return; }
  const headers = ['ID','Empleado','Cliente','Tarifa','Monto (€)','Mes','Estado','Notas','Fecha'];
  const rows = sales.map(s => [s.id, s.empName, s.client, `Tarifa ${s.tarifa}`, s.monto, s.mes, s.estado, s.notas||'', s.createdAt]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = `ventas_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  showToast('CSV exportado');
}

// ============================================================
// HELPERS
// ============================================================
function set(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

function formatMes(mes) {
  if (!mes) return '—';
  const [y, m] = mes.split('-');
  return `${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][parseInt(m)-1]} ${y}`;
}

function populateMonthFilter(filterId, cb) {
  const meses = [...new Set(getSales().map(s => s.mes))].sort().reverse();
  const el = document.getElementById(filterId);
  if (!el) return;
  const cur = el.value;
  el.innerHTML = '<option value="">Todos los meses</option>' + meses.map(m => `<option value="${m}" ${m===cur?'selected':''}>${formatMes(m)}</option>`).join('');
}

function populateEmpFilter() {
  const emps = [...new Set(getSales().map(s => s.empName))].sort();
  const el = document.getElementById('filter-emp');
  if (!el) return;
  const cur = el.value;
  el.innerHTML = '<option value="">Todos los empleados</option>' + emps.map(e => `<option value="${e}" ${e===cur?'selected':''}>${e}</option>`).join('');
}
