// ============================================================
// CONFIG
// ============================================================
const JSONBIN_KEY  = '$2a$10$pbwFfdMJ74BhV1FBAY6XEOX/DDUfx4El.nGaMcbDVWYZjJ7I0ShA6';
const BIN_USERS    = '69b94bd3c3097a1dd53261ca';
const BIN_SALES    = '69b94ba3c3097a1dd53260da';
const BIN_TARIFAS  = '69b955a2c3097a1dd5328feb';
const SCRIPT_URL   = 'YOUR_APPS_SCRIPT_URL_HERE';
let TARIFAS        = { A: 100, B: 150 }; // se sobreescribe desde JSONBin

const API = 'https://api.jsonbin.io/v3/b';
const HEADERS = {
  'Content-Type': 'application/json',
  'X-Master-Key': JSONBIN_KEY,
  'X-Bin-Versioning': 'false'
};

// ============================================================
// JSONBIN HELPERS
// ============================================================
async function readBin(binId) {
  const res = await fetch(`${API}/${binId}/latest`, { headers: HEADERS });
  const json = await res.json();
  return json.record;
}

async function writeBin(binId, data) {
  await fetch(`${API}/${binId}`, {
    method: 'PUT',
    headers: HEADERS,
    body: JSON.stringify(data)
  });
}

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
  const next = (localStorage.getItem('crm_theme') || 'dark') === 'dark' ? 'light' : 'dark';
  localStorage.setItem('crm_theme', next);
  applyTheme();
}

// ============================================================
// AUTH
// ============================================================
function getSession() { return JSON.parse(sessionStorage.getItem('crm_session') || 'null'); }
function setSession(u) { sessionStorage.setItem('crm_session', JSON.stringify(u)); }

function requireAuth(role) {
  const s = getSession();
  if (!s) { window.location.href = 'index.html'; return; }
  if (role === 'admin' && s.role !== 'admin') window.location.href = 'employee.html';
  if (role === 'employee' && s.role === 'admin') window.location.href = 'admin.html';
}

function doLogout() { sessionStorage.removeItem('crm_session'); window.location.href = 'index.html'; }

async function doLogin() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const errEl    = document.getElementById('login-error');
  const btn      = document.querySelector('.btn-primary');
  errEl.style.display = 'none';

  if (!username || !password) { errEl.style.display = 'block'; errEl.textContent = 'Completá los campos'; return; }

  btn.textContent = 'Verificando...';
  btn.disabled = true;

  try {
    const data  = await readBin(BIN_USERS);
    const users = data.users || [];
    const user  = users.find(u => u.username === username && u.password === password);

    if (!user) {
      errEl.style.display = 'block';
      errEl.textContent = 'Usuario o contraseña incorrectos';
      btn.textContent = 'Entrar'; btn.disabled = false;
      return;
    }

    setSession({ username: user.username, name: user.name, role: user.role });
    window.location.href = user.role === 'admin' ? 'admin.html' : 'employee.html';
  } catch (e) {
    errEl.style.display = 'block';
    errEl.textContent = 'Error de conexión, intentá de nuevo';
    btn.textContent = 'Entrar'; btn.disabled = false;
  }
}

// ============================================================
// USERS
// ============================================================
async function getUsers() {
  const data = await readBin(BIN_USERS);
  return data.users || [];
}

async function saveUsers(users) {
  await writeBin(BIN_USERS, { users });
}

async function createUser() {
  const name     = document.getElementById('new-name').value.trim();
  const username = document.getElementById('new-user').value.trim();
  const password = document.getElementById('new-pass').value.trim();
  const role     = document.getElementById('new-role').value;

  if (!name || !username || !password) { showToast('Completá todos los campos', 'error'); return; }

  const users = await getUsers();
  if (users.find(u => u.username === username)) { showToast('Ese usuario ya existe', 'error'); return; }

  showToast('Creando usuario...');
  users.push({ id: Date.now().toString(), name, username, password, role });
  await saveUsers(users);

  document.getElementById('new-name').value = '';
  document.getElementById('new-user').value = '';
  document.getElementById('new-pass').value = '';

  showToast(`Usuario "${username}" creado`);
  renderUsersTable();
}

async function deleteUser(id) {
  if (!confirm('¿Eliminar este usuario?')) return;
  const users = (await getUsers()).filter(u => u.id !== id);
  await saveUsers(users);
  showToast('Usuario eliminado');
  renderUsersTable();
}

async function startEditUser(id) {
  const users = await getUsers();
  const u = users.find(x => x.id === id);
  if (!u) return;

  document.getElementById('new-name').value = u.name;
  document.getElementById('new-user').value = u.username;
  document.getElementById('new-pass').value = u.password;
  document.getElementById('new-role').value = u.role;

  const btn = document.getElementById('save-user-btn');
  btn.textContent = 'Guardar cambios';
  btn.onclick = () => updateUser(id);
  document.getElementById('new-name').focus();
  document.getElementById('cancel-edit-btn').style.display = 'inline-block';
}

function cancelEdit() {
  document.getElementById('new-name').value = '';
  document.getElementById('new-user').value = '';
  document.getElementById('new-pass').value = '';
  document.getElementById('new-role').value = 'employee';
  const btn = document.getElementById('save-user-btn');
  btn.textContent = 'Crear usuario';
  btn.onclick = createUser;
  document.getElementById('cancel-edit-btn').style.display = 'none';
}

async function updateUser(id) {
  const name     = document.getElementById('new-name').value.trim();
  const username = document.getElementById('new-user').value.trim();
  const password = document.getElementById('new-pass').value.trim();
  const role     = document.getElementById('new-role').value;

  if (!name || !username || !password) { showToast('Completá todos los campos', 'error'); return; }

  const users = await getUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return;

  users[idx] = { ...users[idx], name, username, password, role };
  await saveUsers(users);
  showToast('Usuario actualizado');
  cancelEdit();
  renderUsersTable();
}

async function renderUsersTable() {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" class="empty">Cargando...</td></tr>';
  const users = await getUsers();
  if (!users.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty">Sin usuarios</td></tr>'; return; }
  tbody.innerHTML = users.map(u => `
    <tr>
      <td>${u.name}</td>
      <td>${u.username}</td>
      <td><span class="pill ${u.role === 'admin' ? 'activa' : 'inactiva'}">${u.role}</span></td>
      <td style="display:flex;gap:6px;">
        <button class="btn btn-outline" style="font-size:0.72rem;padding:4px 10px;" onclick="startEditUser('${u.id}')">Editar</button>
        ${u.id !== 'admin-default' ? `<button class="btn btn-danger" style="font-size:0.72rem;padding:4px 10px;" onclick="deleteUser('${u.id}')">Eliminar</button>` : ''}
      </td>
    </tr>
  `).join('');
}

// ============================================================
// SALES
// ============================================================
async function getSales() {
  const data = await readBin(BIN_SALES);
  return data.sales || [];
}

async function saveSales(sales) {
  await writeBin(BIN_SALES, { sales });
  // Sync to Google Sheets
  syncToSheets(sales);
}

async function submitSale() {
  const session = getSession();
  const client  = document.getElementById('client-name').value.trim();
  const tarifaId = document.getElementById('tarifa').value;
  const mes     = document.getElementById('mes').value;
  const estado  = document.getElementById('estado').value;
  const notas   = document.getElementById('notas').value.trim();
  const status  = document.getElementById('form-status');

  if (!client || !tarifaId || !mes) { showToast('Completá todos los campos obligatorios', 'error'); return; }

  const tarifas = await getTarifas();
  const tarifa  = tarifas.find(t => t.id === tarifaId);
  if (!tarifa) { showToast('Tarifa no válida', 'error'); return; }

  const sale = {
    id: Date.now().toString(),
    empName: session.name, empUsername: session.username,
    client, tarifa: tarifa.nombre, tarifaId, monto: tarifa.monto, mes, estado, notas,
    createdAt: new Date().toISOString(),
  };

  status.textContent = 'Guardando...';
  const sales = await getSales();
  sales.push(sale);
  await saveSales(sales);

  document.getElementById('client-name').value = '';
  document.getElementById('notas').value = '';
  document.getElementById('tarifa').value = '';
  document.getElementById('estado').value = 'activa';
  status.textContent = '';

  showToast('Venta registrada');
  await initEmployee();
}

async function toggleStatus(id, current, mode) {
  const next = current === 'activa' ? 'inactiva' : 'activa';
  const sales = await getSales();
  const updated = sales.map(s => s.id === id ? { ...s, estado: next } : s);
  await saveSales(updated);
  showToast(`Venta marcada como ${next}`);
  if (mode === 'emp') await initEmployee(); else await loadData();
}

async function deleteSale(id) {
  if (!confirm('¿Eliminar esta venta?')) return;
  const sales = (await getSales()).filter(s => s.id !== id);
  await saveSales(sales);
  showToast('Venta eliminada');
  await loadData();
}

// ============================================================
// EMPLOYEE
// ============================================================
async function initEmployee() {
  const sales = await getSales();
  const session = getSession();
  const mySales = sales.filter(s => s.empUsername === session?.username);
  populateMonthFilter('filter-mes-emp', mySales, () => renderEmployeeTable(mySales));
  renderEmployeeTable(mySales);
}

function renderEmployeeTable(sales) {
  const session   = getSession();
  const filterMes = document.getElementById('filter-mes-emp')?.value || '';
  const filtered  = (sales || []).filter(s => !filterMes || s.mes === filterMes);
  const tbody     = document.getElementById('emp-table-body');
  if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">No hay ventas registradas aún</td></tr>'; return; }
  tbody.innerHTML = filtered.map(s => `
    <tr>
      <td>${s.client}</td><td>${s.tarifa}</td><td>${s.monto} €</td>
      <td>${formatMes(s.mes)}</td><td><span class="pill ${s.estado}">${s.estado}</span></td>
      <td><button class="btn btn-outline" style="font-size:0.72rem;padding:4px 10px;"
        onclick="toggleStatus('${s.id}','${s.estado}','emp')">
        ${s.estado === 'activa' ? 'Marcar inactiva' : 'Marcar activa'}
      </button></td>
    </tr>
  `).join('');
}

// ============================================================
// ADMIN
// ============================================================
async function initAdmin() {
  await loadData();
  setInterval(loadData, 30000);
}

async function loadData() {
  const sales = await getSales();
  renderAdminStats(sales);
  renderAdminTable(sales);
  renderEmpBreakdown(sales);
  populateMonthFilter('filter-mes', sales, () => loadData());
  populateEmpFilter(sales);
}

function renderAdminStats(sales) {
  const fm  = document.getElementById('filter-mes')?.value || '';
  const s   = sales.filter(x => !fm || x.mes === fm);
  const act = s.filter(x => x.estado === 'activa');
  const pot = s.reduce((a, x) => a + x.monto, 0);
  const real = act.reduce((a, x) => a + x.monto, 0);
  const taA = s.filter(x => x.tarifa === 'A'), taAa = taA.filter(x => x.estado === 'activa');
  const taB = s.filter(x => x.tarifa === 'B'), taBa = taB.filter(x => x.estado === 'activa');

  set('stat-potencial', `${pot} €`);
  set('stat-real', `${real} €`);
  set('stat-activas', act.length);
  set('stat-activas-sub', `de ${s.length} registradas`);
  set('stat-perdidos', `${pot - real} €`);
  set('stat-ta-real', `${taAa.reduce((a,x)=>a+x.monto,0)} €`);
  set('stat-ta-sub', `${taAa.length} activas / ${taA.length} total`);
  set('stat-tb-real', `${taBa.reduce((a,x)=>a+x.monto,0)} €`);
  set('stat-tb-sub', `${taBa.length} activas / ${taB.length} total`);
}

function renderEmpBreakdown(sales) {
  const emps = {};
  sales.forEach(s => { if (!emps[s.empName]) emps[s.empName] = []; emps[s.empName].push(s); });
  const tbody = document.getElementById('emp-breakdown-body');
  if (!tbody) return;
  const entries = Object.entries(emps);
  if (!entries.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty">Sin datos</td></tr>'; return; }
  tbody.innerHTML = entries.map(([name, ss]) => {
    const act = ss.filter(s => s.estado === 'activa');
    return `<tr><td>${name}</td><td>${ss.length}</td><td>${act.length}</td><td>${ss.reduce((a,s)=>a+s.monto,0)} €</td><td>${act.reduce((a,s)=>a+s.monto,0)} €</td></tr>`;
  }).join('');
}

function renderAdminTable(sales) {
  const fm = document.getElementById('filter-mes')?.value || '';
  const fe = document.getElementById('filter-emp')?.value || '';
  const fs = document.getElementById('filter-estado')?.value || '';
  const filtered = sales.filter(s => (!fm||s.mes===fm) && (!fe||s.empName===fe) && (!fs||s.estado===fs));
  const tbody = document.getElementById('admin-table-body');
  if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty">No hay ventas que coincidan</td></tr>'; return; }
  tbody.innerHTML = filtered.map(s => `
    <tr>
      <td>${s.empName}</td><td>${s.client}</td><td>${s.tarifa}</td><td>${s.monto} €</td>
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
// EXPORT CSV + SHEETS SYNC
// ============================================================
async function exportCSV() {
  const sales = await getSales();
  if (!sales.length) { showToast('No hay datos para exportar', 'error'); return; }
  const headers = ['ID','Empleado','Cliente','Tarifa','Monto (€)','Mes','Estado','Notas','Fecha'];
  const rows = sales.map(s => [s.id,s.empName,s.client,`Tarifa ${s.tarifa}`,s.monto,s.mes,s.estado,s.notas||'',s.createdAt]);
  const csv = [headers,...rows].map(r=>r.map(v=>`"${v}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  a.download = `ventas_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  showToast('CSV exportado');
}

async function syncToSheets(sales) {
  if (!SCRIPT_URL || SCRIPT_URL === 'YOUR_APPS_SCRIPT_URL_HERE') return;
  try {
    const form = new FormData();
    form.append('payload', JSON.stringify({ action: 'syncAll', sales }));
    await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: form });
  } catch (e) { console.warn('Sheets sync:', e); }
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

function populateMonthFilter(filterId, sales, cb) {
  const meses = [...new Set((sales||[]).map(s => s.mes))].sort().reverse();
  const el = document.getElementById(filterId);
  if (!el) return;
  const cur = el.value;
  el.innerHTML = '<option value="">Todos los meses</option>' + meses.map(m=>`<option value="${m}" ${m===cur?'selected':''}>${formatMes(m)}</option>`).join('');
  if (cb) el.onchange = cb;
}

function populateEmpFilter(sales) {
  const emps = [...new Set((sales||[]).map(s => s.empName))].sort();
  const el = document.getElementById('filter-emp');
  if (!el) return;
  const cur = el.value;
  el.innerHTML = '<option value="">Todos los empleados</option>' + emps.map(e=>`<option value="${e}" ${e===cur?'selected':''}>${e}</option>`).join('');
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => { t.className = 'toast'; }, 3000);
}

// ============================================================
// SIDEBAR
// ============================================================
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const isOpen  = sidebar.classList.contains('open');
  sidebar.classList.toggle('open', !isOpen);
  overlay.classList.toggle('show', !isOpen);
  if (!isOpen) {
    renderSidebarUsers();
    renderSidebarTarifas();
  }
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('show');
}

// ============================================================
// TARIFAS
// ============================================================
async function getTarifas() {
  const data = await readBin(BIN_TARIFAS);
  return data.tarifas || [];
}

async function saveTarifas(tarifas) {
  await writeBin(BIN_TARIFAS, { tarifas });
}

async function loadTarifas() {
  const tarifas = await getTarifas();
  // Update global TARIFAS map
  TARIFAS = {};
  tarifas.forEach(t => { TARIFAS[t.id] = t.monto; });
  return tarifas;
}

async function populateTarifaSelect() {
  const tarifas = await getTarifas();
  const sel = document.getElementById('tarifa');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Seleccionar —</option>' +
    tarifas.map(t => `<option value="${t.id}">${t.nombre} — ${t.monto} €</option>`).join('');
}

async function renderSidebarTarifas() {
  const tarifas = await getTarifas();
  const container = document.getElementById('sidebar-tarifas-list');
  if (!container) return;
  container.innerHTML = tarifas.map(t => `
    <div class="sidebar-tarifa-row" id="trow-${t.id}">
      <div style="display:flex;gap:8px;align-items:center;flex:1;">
        <input type="text" value="${t.nombre}" id="tname-${t.id}" style="flex:1;font-size:0.85rem;padding:6px 10px;" />
        <input type="number" value="${t.monto}" id="tmonto-${t.id}" style="width:80px;font-size:0.85rem;padding:6px 10px;" />
        <span style="color:var(--text-muted);font-size:0.8rem;">€</span>
      </div>
      <div style="display:flex;gap:6px;margin-top:6px;">
        <button class="btn btn-primary" style="font-size:0.72rem;padding:4px 10px;" onclick="saveTarifa('${t.id}')">Guardar</button>
        <button class="btn btn-danger" style="font-size:0.72rem;padding:4px 10px;" onclick="deleteTarifa('${t.id}')">Eliminar</button>
      </div>
    </div>
  `).join('');
}

async function saveTarifa(id) {
  const nombre = document.getElementById(`tname-${id}`).value.trim();
  const monto  = parseFloat(document.getElementById(`tmonto-${id}`).value);
  if (!nombre || isNaN(monto)) { showToast('Datos inválidos', 'error'); return; }
  const tarifas = await getTarifas();
  const idx = tarifas.findIndex(t => t.id === id);
  if (idx === -1) return;
  tarifas[idx] = { ...tarifas[idx], nombre, monto };
  await saveTarifas(tarifas);
  showToast('Tarifa actualizada');
  await loadTarifas();
}

async function deleteTarifa(id) {
  if (!confirm('¿Eliminar esta tarifa?')) return;
  const tarifas = (await getTarifas()).filter(t => t.id !== id);
  await saveTarifas(tarifas);
  showToast('Tarifa eliminada');
  renderSidebarTarifas();
  await loadTarifas();
}

async function addTarifa() {
  const nombre = document.getElementById('new-tarifa-nombre').value.trim();
  const monto  = parseFloat(document.getElementById('new-tarifa-monto').value);
  if (!nombre || isNaN(monto)) { showToast('Completá nombre y monto', 'error'); return; }
  const tarifas = await getTarifas();
  tarifas.push({ id: Date.now().toString(), nombre, monto });
  await saveTarifas(tarifas);
  document.getElementById('new-tarifa-nombre').value = '';
  document.getElementById('new-tarifa-monto').value = '';
  showToast('Tarifa agregada');
  renderSidebarTarifas();
  await loadTarifas();
}

// ============================================================
// SIDEBAR USERS (mini version)
// ============================================================
async function renderSidebarUsers() {
  const tbody = document.getElementById('sidebar-users-list');
  if (!tbody) return;
  tbody.innerHTML = '<div style="color:var(--text-muted);font-size:0.82rem;">Cargando...</div>';
  const users = await getUsers();
  tbody.innerHTML = users.map(u => `
    <div class="sidebar-user-row">
      <div>
        <div style="font-size:0.88rem;">${u.name}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);">${u.username} · <span class="pill ${u.role==='admin'?'activa':'inactiva'}" style="font-size:0.65rem;padding:2px 7px;">${u.role}</span></div>
      </div>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-outline" style="font-size:0.68rem;padding:3px 8px;" onclick="sidebarEditUser('${u.id}')">Editar</button>
        ${u.id!=='admin-default'?`<button class="btn btn-danger" style="font-size:0.68rem;padding:3px 8px;" onclick="deleteUser('${u.id}')">✕</button>`:''}
      </div>
    </div>
  `).join('');
}

async function sidebarCreateUser() {
  const name     = document.getElementById('sb-new-name').value.trim();
  const username = document.getElementById('sb-new-user').value.trim();
  const password = document.getElementById('sb-new-pass').value.trim();
  const role     = document.getElementById('sb-new-role').value;
  if (!name || !username || !password) { showToast('Completá todos los campos', 'error'); return; }
  const users = await getUsers();
  if (users.find(u => u.username === username)) { showToast('Ese usuario ya existe', 'error'); return; }
  users.push({ id: Date.now().toString(), name, username, password, role });
  await saveUsers(users);
  document.getElementById('sb-new-name').value = '';
  document.getElementById('sb-new-user').value = '';
  document.getElementById('sb-new-pass').value = '';
  showToast(`Usuario "${username}" creado`);
  renderSidebarUsers();
}

async function sidebarEditUser(id) {
  const users = await getUsers();
  const u = users.find(x => x.id === id);
  if (!u) return;
  const newName = prompt('Nombre completo:', u.name);
  if (newName === null) return;
  const newPass = prompt('Nueva contraseña (dejá vacío para no cambiar):', '');
  const newRole = prompt('Rol (admin / employee):', u.role);
  const updated = {
    ...u,
    name: newName || u.name,
    password: newPass ? newPass : u.password,
    role: (newRole === 'admin' || newRole === 'employee') ? newRole : u.role
  };
  const idx = users.findIndex(x => x.id === id);
  users[idx] = updated;
  await saveUsers(users);
  showToast('Usuario actualizado');
  renderSidebarUsers();
}
