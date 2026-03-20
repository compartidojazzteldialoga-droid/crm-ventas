// ============================================================
// CONFIG
// ============================================================
const JSONBIN_KEY = '$2a$10$pbwFfdMJ74BhV1FBAY6XEOX/DDUfx4El.nGaMcbDVWYZjJ7I0ShA6';
const BIN_USERS   = '69b94bd3c3097a1dd53261ca';
const BIN_SALES   = '69b94ba3c3097a1dd53260da';
const BIN_CAMP    = '69b9ba0eb7ec241ddc796ee8';
const SCRIPT_URL  = 'YOUR_APPS_SCRIPT_URL_HERE';

const API     = 'https://api.jsonbin.io/v3/b';
const HEADERS = { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_KEY, 'X-Bin-Versioning': 'false' };

const ESTADOS = ['activo', 'activo_parcial', 'en_curso', 'cancelado'];
const ESTADO_LABELS = { activo: 'Activo', activo_parcial: 'Activo parcial', en_curso: 'En curso', cancelado: 'Cancelado' };
const ESTADO_CLASS  = { activo: 'activo', activo_parcial: 'parcial', en_curso: 'en_curso', cancelado: 'cancelado' };

// ============================================================
// JSONBIN
// ============================================================
async function readBin(binId) {
  const res = await fetch(`${API}/${binId}/latest`, { headers: HEADERS });
  const json = await res.json();
  return json.record;
}
async function writeBin(binId, data) {
  await fetch(`${API}/${binId}`, { method: 'PUT', headers: HEADERS, body: JSON.stringify(data) });
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
function doLogout() { sessionStorage.removeItem('crm_session'); window.location.href = 'index.html'; }

function requireAuth(role) {
  const s = getSession();
  if (!s) { window.location.href = 'index.html'; return; }
  if (role === 'superadmin' && s.role !== 'superadmin') window.location.href = 'admin.html';
  if (role === 'admin' && s.role === 'employee') window.location.href = 'employee.html';
  if (role === 'employee' && (s.role === 'admin' || s.role === 'superadmin')) window.location.href = 'admin.html';
}

function isSuperAdmin() { const s = getSession(); return s?.role === 'superadmin'; }
function isAdmin()      { const s = getSession(); return s?.role === 'admin' || s?.role === 'superadmin'; }

function hasPerm(perm) {
  const s = getSession();
  if (!s) return false;
  if (s.role === 'superadmin') return true;
  if (s.role === 'admin') {
    if (perm === 'gestionar_permisos') return (s.perms || []).includes('gestionar_permisos');
    return true;
  }
  return (s.perms || []).includes(perm);
}

async function doLogin() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const errEl    = document.getElementById('login-error');
  const btn      = document.querySelector('.btn-primary');
  errEl.style.display = 'none';
  if (!username || !password) { errEl.style.display = 'block'; errEl.textContent = 'Completá los campos'; return; }
  btn.textContent = 'Verificando...'; btn.disabled = true;
  try {
    const data  = await readBin(BIN_USERS);
    const users = data.users || [];
    const user  = users.find(u => u.username === username && u.password === password);
    if (!user) { errEl.style.display = 'block'; errEl.textContent = 'Usuario o contraseña incorrectos'; btn.textContent = 'Entrar'; btn.disabled = false; return; }
    setSession({ username: user.username, name: user.name, role: user.role, perms: user.perms || [] });
    const dest = (user.role === 'superadmin' || user.role === 'admin') ? 'admin.html' : 'employee.html';
    window.location.href = dest;
  } catch (e) {
    errEl.style.display = 'block'; errEl.textContent = 'Error de conexión, intentá de nuevo';
    btn.textContent = 'Entrar'; btn.disabled = false;
  }
}

// ============================================================
// USERS
// ============================================================
async function getUsers() { const d = await readBin(BIN_USERS); return d.users || []; }
async function saveUsers(users) { await writeBin(BIN_USERS, { users }); }

async function createUser() {
  const name     = document.getElementById('new-name').value.trim();
  const username = document.getElementById('new-user').value.trim();
  const password = document.getElementById('new-pass').value.trim();
  const role     = document.getElementById('new-role').value;
  if (!name || !username || !password) { showToast('Completá todos los campos', 'error'); return; }
  const users = await getUsers();
  if (users.find(u => u.username === username)) { showToast('Ese usuario ya existe', 'error'); return; }
  users.push({ id: Date.now().toString(), name, username, password, role, perms: [] });
  await saveUsers(users);
  document.getElementById('new-name').value = '';
  document.getElementById('new-user').value = '';
  document.getElementById('new-pass').value = '';
  showToast(`Usuario "${username}" creado`);
  if (typeof renderUsersTable === 'function') renderUsersTable();
}

async function deleteUser(id) {
  if (!confirm('¿Eliminar este usuario?')) return;
  await saveUsers((await getUsers()).filter(u => u.id !== id));
  showToast('Usuario eliminado');
  if (typeof renderUsersTable === 'function') renderUsersTable();
}

async function renderUsersTable() {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" class="empty">Cargando...</td></tr>';
  const allUsers = await getUsers();
  const session  = getSession();
  // superadmin sees all, admin sees only employees
  const users = isSuperAdmin() ? allUsers : allUsers.filter(u => u.role === 'employee');
  if (!users.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty">Sin usuarios</td></tr>'; return; }
  tbody.innerHTML = users.map(u => `
    <tr>
      <td>${u.name}</td>
      <td>${u.username}</td>
      <td><span class="pill ${u.role === 'superadmin' ? 'activo' : u.role === 'admin' ? 'en_curso' : 'parcial'}">${u.role === 'superadmin' ? 'Super Admin' : u.role === 'admin' ? 'Administrador' : 'Colaborador'}</span></td>
      <td>
        ${u.id !== 'superadmin-default' ? `<button class="btn btn-outline" style="font-size:0.72rem;padding:4px 10px;" onclick="openEditUser('${u.id}')">Editar</button>` : ''}
        ${(isSuperAdmin() && u.id !== 'superadmin-default') ? `<button class="btn btn-danger" style="font-size:0.72rem;padding:4px 10px;" onclick="deleteUser('${u.id}')">Eliminar</button>` : ''}
        ${(!isSuperAdmin() && u.id !== 'admin-default') ? `<button class="btn btn-danger" style="font-size:0.72rem;padding:4px 10px;" onclick="deleteUser('${u.id}')">Eliminar</button>` : ''}
      </td>
    </tr>
  `).join('');
}

async function openEditUser(id) {
  const users = await getUsers();
  const u = users.find(x => x.id === id);
  if (!u) return;
  document.getElementById('edit-user-id').value   = u.id;
  document.getElementById('edit-user-name').value = u.name;
  document.getElementById('edit-user-user').value = u.username;
  document.getElementById('edit-user-pass').value = u.password;
  document.getElementById('edit-user-role').value = u.role;
  document.getElementById('edit-user-modal').style.display = 'flex';
}

function closeEditUser() {
  document.getElementById('edit-user-modal').style.display = 'none';
}

async function saveEditUser() {
  const id       = document.getElementById('edit-user-id').value;
  const name     = document.getElementById('edit-user-name').value.trim();
  const username = document.getElementById('edit-user-user').value.trim();
  const password = document.getElementById('edit-user-pass').value.trim();
  const role     = document.getElementById('edit-user-role').value;
  if (!name || !username || !password) { showToast('Completá todos los campos', 'error'); return; }
  const users = await getUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return;
  users[idx] = { ...users[idx], name, username, password, role };
  await saveUsers(users);
  closeEditUser();
  showToast('Usuario actualizado');
  renderUsersTable();
}

// ============================================================
// PERMISOS
// ============================================================
const ALL_PERMS = [
  { id: 'ver_precios',       label: 'Ver precio de tarifas' },
  { id: 'editar_estado',     label: 'Editar estado de ventas' },
  { id: 'editar_venta',      label: 'Editar información de venta' },
  { id: 'eliminar_venta',    label: 'Eliminar ventas' },
  { id: 'gestionar_permisos',label: 'Gestionar permisos de colaboradores' },
];

async function renderPermisosTable() {
  const tbody = document.getElementById('permisos-table-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="empty">Cargando...</td></tr>';
  const allUsers = await getUsers();

  // superadmin can assign 'gestionar_permisos' to admins
  // admin (with gestionar_permisos) can assign perms to employees only
  const empPerms  = ALL_PERMS.filter(p => p.id !== 'gestionar_permisos');
  const adminPerms = ALL_PERMS.filter(p => p.id === 'gestionar_permisos');

  const employees = allUsers.filter(u => u.role === 'employee');
  const admins    = allUsers.filter(u => u.role === 'admin');

  let html = '';

  // Admins section (only superadmin sees this)
  if (isSuperAdmin() && admins.length) {
    html += `<tr><td colspan="3" style="padding:12px 24px;font-size:0.72rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-muted);background:var(--surface2);">Administradores</td></tr>`;
    html += admins.map(u => {
      const perms = u.perms || [];
      return `<tr>
        <td>${u.name}</td>
        <td style="text-align:center;">
          <input type="checkbox" id="perm-${u.id}-gestionar_permisos" ${perms.includes('gestionar_permisos') ? 'checked' : ''} />
          <label for="perm-${u.id}-gestionar_permisos" style="font-size:0.82rem;margin-left:6px;">Gestionar permisos de colaboradores</label>
        </td>
        <td><button class="btn btn-primary" style="font-size:0.72rem;padding:4px 12px;" onclick="savePerms('${u.id}')">Guardar</button></td>
      </tr>`;
    }).join('');
  }

  // Employees section
  if (employees.length) {
    const canManage = isSuperAdmin() || hasPerm('gestionar_permisos');
    if (!canManage) { tbody.innerHTML = '<tr><td colspan="6" class="empty">Sin permisos para gestionar colaboradores</td></tr>'; return; }

    const headers = empPerms.map(p => `<th>${p.label}</th>`).join('');
    document.getElementById('permisos-thead').innerHTML =
      `<tr><th>Colaborador</th>${headers}<th>Guardar</th></tr>`;

    html += employees.map(u => {
      const perms = u.perms || [];
      const checks = empPerms.map(p => `
        <td style="text-align:center;">
          <input type="checkbox" id="perm-${u.id}-${p.id}" ${perms.includes(p.id) ? 'checked' : ''} />
        </td>
      `).join('');
      return `<tr><td>${u.name}</td>${checks}<td>
        <button class="btn btn-primary" style="font-size:0.72rem;padding:4px 12px;" onclick="savePerms('${u.id}')">Guardar</button>
      </td></tr>`;
    }).join('');
  }

  if (!html) { tbody.innerHTML = '<tr><td colspan="6" class="empty">Sin usuarios para gestionar</td></tr>'; return; }
  tbody.innerHTML = html;
}

async function savePerms(userId) {
  const users = await getUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return;
  const isEmp = users[idx].role === 'employee';
  const permList = isEmp ? ALL_PERMS.filter(p => p.id !== 'gestionar_permisos') : ALL_PERMS.filter(p => p.id === 'gestionar_permisos');
  const perms = permList.filter(p => document.getElementById(`perm-${userId}-${p.id}`)?.checked).map(p => p.id);
  users[idx].perms = perms;
  await saveUsers(users);
  const session = getSession();
  if (session && session.username === users[idx].username) setSession({ ...session, perms });
  showToast('Permisos guardados');
}

// ============================================================
// CAMPAÑAS
// ============================================================
async function getCampanas() { const d = await readBin(BIN_CAMP); return d.campanas || []; }
async function saveCampanas(campanas) { await writeBin(BIN_CAMP, { campanas }); }

async function renderCampanasTable() {
  const tbody = document.getElementById('campanas-table-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="3" class="empty">Cargando...</td></tr>';
  const campanas = await getCampanas();
  if (!campanas.length) { tbody.innerHTML = '<tr><td colspan="3" class="empty">Sin campañas</td></tr>'; return; }
  tbody.innerHTML = campanas.map(c => `
    <tr>
      <td>${c.nombre}</td>
      <td><span class="pill ${c.activa ? 'activo' : 'cancelado'}">${c.activa ? 'Activa' : 'Inactiva'}</span></td>
      <td style="display:flex;gap:6px;">
        <a href="tarifas.html?camp=${c.id}" class="btn btn-outline" style="font-size:0.72rem;padding:4px 10px;">Ver tarifas</a>
        <button class="btn btn-outline" style="font-size:0.72rem;padding:4px 10px;" onclick="toggleCampana('${c.id}')">${c.activa ? 'Desactivar' : 'Activar'}</button>
        <button class="btn btn-danger" style="font-size:0.72rem;padding:4px 10px;" onclick="deleteCampana('${c.id}')">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

async function addCampana() {
  const nombre = document.getElementById('new-camp-nombre').value.trim();
  if (!nombre) { showToast('Ingresá un nombre', 'error'); return; }
  const campanas = await getCampanas();
  campanas.push({ id: Date.now().toString(), nombre, activa: true, tarifas: [] });
  await saveCampanas(campanas);
  document.getElementById('new-camp-nombre').value = '';
  showToast('Campaña creada');
  renderCampanasTable();
}

async function toggleCampana(id) {
  const campanas = await getCampanas();
  const idx = campanas.findIndex(c => c.id === id);
  if (idx === -1) return;
  campanas[idx].activa = !campanas[idx].activa;
  await saveCampanas(campanas);
  renderCampanasTable();
}

async function deleteCampana(id) {
  if (!confirm('¿Eliminar esta campaña?')) return;
  await saveCampanas((await getCampanas()).filter(c => c.id !== id));
  showToast('Campaña eliminada');
  renderCampanasTable();
}

// ============================================================
// TARIFAS (dentro de campaña)
// ============================================================
async function getTarifasByCamp(campId) {
  const campanas = await getCampanas();
  const camp = campanas.find(c => c.id === campId);
  return camp ? { camp, tarifas: camp.tarifas || [] } : null;
}

async function renderTarifasTable() {
  const tbody = document.getElementById('tarifas-table-body');
  if (!tbody) return;
  const params = new URLSearchParams(window.location.search);
  const campId = params.get('camp');
  if (!campId) { tbody.innerHTML = '<tr><td colspan="5" class="empty">No se especificó campaña</td></tr>'; return; }

  tbody.innerHTML = '<tr><td colspan="5" class="empty">Cargando...</td></tr>';
  const result = await getTarifasByCamp(campId);
  if (!result) { tbody.innerHTML = '<tr><td colspan="5" class="empty">Campaña no encontrada</td></tr>'; return; }

  const { camp, tarifas } = result;
  const title = document.getElementById('camp-title');
  if (title) title.textContent = `Tarifas — ${camp.nombre}`;

  if (!tarifas.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty">Sin tarifas en esta campaña</td></tr>'; return; }

  tbody.innerHTML = tarifas.map(t => `
    <tr>
      <td><input type="text" value="${t.nombre}" id="tname-${t.id}" style="background:transparent;border:none;border-bottom:1px solid var(--border);color:var(--text);font-size:0.9rem;padding:4px 0;width:100%;outline:none;" /></td>
      <td><div style="display:flex;align-items:center;gap:6px;"><input type="number" value="${t.gananciaDistribuidor}" id="tdist-${t.id}" style="background:transparent;border:none;border-bottom:1px solid var(--border);color:var(--text);font-size:0.9rem;padding:4px 0;width:80px;outline:none;" /><span style="color:var(--text-muted);">€</span></div></td>
      <td><div style="display:flex;align-items:center;gap:6px;"><input type="number" value="${t.gananciaColaborador}" id="tcolab-${t.id}" style="background:transparent;border:none;border-bottom:1px solid var(--border);color:var(--text);font-size:0.9rem;padding:4px 0;width:80px;outline:none;" /><span style="color:var(--text-muted);">€</span></div></td>
      <td style="display:flex;gap:6px;">
        <button class="btn btn-primary" style="font-size:0.72rem;padding:4px 12px;" onclick="saveTarifa('${campId}','${t.id}')">Guardar</button>
        <button class="btn btn-danger" style="font-size:0.72rem;padding:4px 12px;" onclick="deleteTarifa('${campId}','${t.id}')">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

async function saveTarifa(campId, tarifaId) {
  const nombre = document.getElementById(`tname-${tarifaId}`).value.trim();
  const dist   = parseFloat(document.getElementById(`tdist-${tarifaId}`).value);
  const colab  = parseFloat(document.getElementById(`tcolab-${tarifaId}`).value);
  if (!nombre || isNaN(dist) || isNaN(colab)) { showToast('Datos inválidos', 'error'); return; }
  const campanas = await getCampanas();
  const cIdx = campanas.findIndex(c => c.id === campId);
  if (cIdx === -1) return;
  const tIdx = campanas[cIdx].tarifas.findIndex(t => t.id === tarifaId);
  if (tIdx === -1) return;
  campanas[cIdx].tarifas[tIdx] = { ...campanas[cIdx].tarifas[tIdx], nombre, gananciaDistribuidor: dist, gananciaColaborador: colab };
  await saveCampanas(campanas);
  showToast('Tarifa actualizada');
}

async function deleteTarifa(campId, tarifaId) {
  if (!confirm('¿Eliminar esta tarifa?')) return;
  const campanas = await getCampanas();
  const cIdx = campanas.findIndex(c => c.id === campId);
  if (cIdx === -1) return;
  campanas[cIdx].tarifas = campanas[cIdx].tarifas.filter(t => t.id !== tarifaId);
  await saveCampanas(campanas);
  showToast('Tarifa eliminada');
  renderTarifasTable();
}

async function addTarifa() {
  const params = new URLSearchParams(window.location.search);
  const campId = params.get('camp');
  const nombre = document.getElementById('new-tarifa-nombre').value.trim();
  const dist   = parseFloat(document.getElementById('new-tarifa-dist').value);
  const colab  = parseFloat(document.getElementById('new-tarifa-colab').value);
  if (!nombre || isNaN(dist) || isNaN(colab)) { showToast('Completá todos los campos', 'error'); return; }
  const campanas = await getCampanas();
  const cIdx = campanas.findIndex(c => c.id === campId);
  if (cIdx === -1) return;
  campanas[cIdx].tarifas.push({ id: Date.now().toString(), nombre, gananciaDistribuidor: dist, gananciaColaborador: colab });
  await saveCampanas(campanas);
  document.getElementById('new-tarifa-nombre').value = '';
  document.getElementById('new-tarifa-dist').value   = '';
  document.getElementById('new-tarifa-colab').value  = '';
  showToast('Tarifa agregada');
  renderTarifasTable();
}

// ============================================================
// SALES
// ============================================================
async function getSales() { const d = await readBin(BIN_SALES); return d.sales || []; }
async function saveSales(sales) {
  await writeBin(BIN_SALES, { sales });
  syncToSheets(sales);
}

async function populateCampanaSelect() {
  const campanas = await getCampanas();
  const sel = document.getElementById('campana');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Seleccionar campaña —</option>' +
    campanas.filter(c => c.activa).map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
}

async function onCampanaChange() {
  const campId = document.getElementById('campana').value;
  const sel    = document.getElementById('tarifa');
  if (!campId) { sel.innerHTML = '<option value="">— Primero seleccioná campaña —</option>'; return; }
  const result = await getTarifasByCamp(campId);
  if (!result) return;
  const session = getSession();
  const showPrice = hasPerm('ver_precios');
  sel.innerHTML = '<option value="">— Seleccionar tarifa —</option>' +
    result.tarifas.map(t => `<option value="${t.id}">${t.nombre}${showPrice ? ` — Dist: ${t.gananciaDistribuidor}€ / Colab: ${t.gananciaColaborador}€` : ''}</option>`).join('');
}

async function submitSale() {
  const session  = getSession();
  const campId   = document.getElementById('campana').value;
  const tarifaId = document.getElementById('tarifa').value;
  const client   = document.getElementById('client-name').value.trim();
  const dni      = document.getElementById('client-dni').value.trim();
  const numeros  = document.getElementById('client-numeros').value.trim();
  const mes      = document.getElementById('mes').value;
  const estado   = document.getElementById('estado').value;
  const notas    = document.getElementById('notas').value.trim();
  const status   = document.getElementById('form-status');

  if (!campId || !tarifaId || !client || !mes) { showToast('Completá los campos obligatorios', 'error'); return; }

  const result = await getTarifasByCamp(campId);
  const campana = result?.camp;
  const tarifa  = result?.tarifas.find(t => t.id === tarifaId);
  if (!tarifa) { showToast('Tarifa no válida', 'error'); return; }

  const sale = {
    id: Date.now().toString(),
    empName: session.name, empUsername: session.username,
    campanaId: campId, campanaNombre: campana.nombre,
    tarifaId, tarifaNombre: tarifa.nombre,
    gananciaDistribuidor: tarifa.gananciaDistribuidor,
    gananciaColaborador: tarifa.gananciaColaborador,
    client, dni, numeros, mes, estado, notas,
    createdAt: new Date().toISOString(),
  };

  status.textContent = 'Guardando...';
  const sales = await getSales();
  sales.push(sale);
  await saveSales(sales);

  ['client-name','client-dni','client-numeros','notas'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  document.getElementById('tarifa').value  = '';
  document.getElementById('estado').value  = 'activo';
  status.textContent = '';
  showToast('Venta registrada');
  const s = getSession();
  if (s.role === 'employee') await initEmployee(); else await loadData();
}

async function toggleStatus(id, current, mode) {
  const next = ESTADOS[(ESTADOS.indexOf(current) + 1) % ESTADOS.length];
  const sales = await getSales();
  const updated = sales.map(s => s.id === id ? { ...s, estado: next } : s);
  await saveSales(updated);
  showToast(`Estado: ${ESTADO_LABELS[next]}`);
  if (mode === 'emp') await initEmployee(); else await loadData();
}

async function setStatus(id, next, mode) {
  const sales = await getSales();
  const updated = sales.map(s => s.id === id ? { ...s, estado: next } : s);
  await saveSales(updated);
  showToast(`Estado: ${ESTADO_LABELS[next]}`);
  if (mode === 'emp') await initEmployee(); else await loadData();
}

async function deleteSale(id) {
  if (!confirm('¿Eliminar esta venta?')) return;
  await saveSales((await getSales()).filter(s => s.id !== id));
  showToast('Venta eliminada');
  await loadData();
}

// ============================================================
// EMPLOYEE
// ============================================================
async function initEmployee() {
  await populateCampanaSelect();
  const sales = await getSales();
  const session = getSession();
  const mySales = sales.filter(s => s.empUsername === session?.username);
  populateMonthFilter('filter-mes-emp', mySales, () => renderEmployeeTable(mySales));
  renderEmployeeTable(mySales);
}

function renderEmployeeTable(sales) {
  const filterMes = document.getElementById('filter-mes-emp')?.value || '';
  const filtered  = (sales || []).filter(s => !filterMes || s.mes === filterMes);
  const tbody     = document.getElementById('emp-table-body');
  const canEdit   = hasPerm('editar_estado');
  const canDel    = hasPerm('eliminar_venta');
  if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty">No hay ventas registradas aún</td></tr>'; return; }
  tbody.innerHTML = filtered.map(s => `
    <tr>
      <td>${s.client}</td>
      <td>${s.dni||'—'}</td>
      <td>${s.campanaNombre||'—'}</td>
      <td>${s.tarifaNombre||'—'}</td>
      <td>${formatMes(s.mes)}</td>
      <td><span class="pill ${ESTADO_CLASS[s.estado]||'en_curso'}">${ESTADO_LABELS[s.estado]||s.estado}</span></td>
      <td>
        ${canEdit ? `<select onchange="setStatus('${s.id}',this.value,'emp')" style="font-size:0.78rem;padding:4px 8px;">
          ${ESTADOS.map(e=>`<option value="${e}" ${s.estado===e?'selected':''}>${ESTADO_LABELS[e]}</option>`).join('')}
        </select>` : '—'}
      </td>
      <td>${canDel ? `<button class="btn btn-danger" style="font-size:0.72rem;padding:4px 10px;" onclick="deleteSale('${s.id}')">Eliminar</button>` : '—'}</td>
    </tr>
  `).join('');
}

// ============================================================
// ADMIN
// ============================================================
async function initAdmin() {
  document.getElementById('mes').value = new Date().toISOString().slice(0, 7);
  await populateCampanaSelect();
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
  populateCampFilter(sales);
}

function renderAdminStats(sales) {
  const fm  = document.getElementById('filter-mes')?.value || '';
  const fc  = document.getElementById('filter-camp')?.value || '';
  const s   = sales.filter(x => (!fm || x.mes === fm) && (!fc || x.campanaId === fc));
  const act = s.filter(x => x.estado !== 'cancelado');
  const pot = s.reduce((a, x) => a + (x.gananciaDistribuidor || 0), 0);
  const real = act.reduce((a, x) => a + (x.gananciaDistribuidor || 0), 0);
  const potColab = s.reduce((a, x) => a + (x.gananciaColaborador || 0), 0);
  const realColab = act.reduce((a, x) => a + (x.gananciaColaborador || 0), 0);

  set('stat-potencial', `${pot} €`);
  set('stat-real', `${real} €`);
  set('stat-activas', act.length);
  set('stat-activas-sub', `de ${s.length} registradas`);
  set('stat-perdidos', `${pot - real} €`);
  set('stat-gan-dist', `${real} €`);
  set('stat-gan-colab', `${realColab} €`);
}

function renderEmpBreakdown(sales) {
  const emps = {};
  sales.forEach(s => { if (!emps[s.empName]) emps[s.empName] = []; emps[s.empName].push(s); });
  const tbody = document.getElementById('emp-breakdown-body');
  if (!tbody) return;
  const entries = Object.entries(emps);
  if (!entries.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">Sin datos</td></tr>'; return; }
  tbody.innerHTML = entries.map(([name, ss]) => {
    const act = ss.filter(s => s.estado !== 'cancelado');
    return `<tr>
      <td>${name}</td><td>${ss.length}</td><td>${act.length}</td>
      <td>${ss.reduce((a,s)=>a+(s.gananciaDistribuidor||0),0)} €</td>
      <td>${act.reduce((a,s)=>a+(s.gananciaDistribuidor||0),0)} €</td>
      <td>${act.reduce((a,s)=>a+(s.gananciaColaborador||0),0)} €</td>
    </tr>`;
  }).join('');
}

function renderAdminTable(sales) {
  renderAdminStats(sales);
  const fm = document.getElementById('filter-mes')?.value || '';
  const fe = document.getElementById('filter-emp')?.value || '';
  const fs = document.getElementById('filter-estado')?.value || '';
  const fc = document.getElementById('filter-camp')?.value || '';
  const filtered = sales.filter(s =>
    (!fm||s.mes===fm) && (!fe||s.empName===fe) && (!fs||s.estado===fs) && (!fc||s.campanaId===fc)
  );
  const tbody = document.getElementById('admin-table-body');
  if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">No hay ventas que coincidan</td></tr>'; return; }
  tbody.innerHTML = filtered.map(s => {
    const estadoKey = s.estado === 'activa' ? 'activo' : s.estado === 'inactiva' ? 'cancelado' : s.estado;
    const estadoLabel = ESTADO_LABELS[estadoKey] || estadoKey;
    const estadoClass = ESTADO_CLASS[estadoKey] || 'en_curso';
    return `
    <tr>
      <td><div style="font-size:0.88rem;">${s.empName}</div><div style="font-size:0.75rem;color:var(--text-muted);">${s.client}${s.dni ? ' · ' + s.dni : ''}</div></td>
      <td><div>${s.campanaNombre||'—'}</div><div style="font-size:0.78rem;color:var(--text-muted);">${s.tarifaNombre||'—'}</div></td>
      <td>${s.gananciaDistribuidor||0} €</td>
      <td>${formatMes(s.mes)}</td>
      <td><span class="pill ${estadoClass}">${estadoLabel}</span></td>
      <td>
        <select onchange="setStatus('${s.id}',this.value,'admin')" style="font-size:0.78rem;padding:4px 8px;max-width:130px;">
          ${ESTADOS.map(e=>`<option value="${e}" ${estadoKey===e?'selected':''}>${ESTADO_LABELS[e]}</option>`).join('')}
        </select>
      </td>
      <td><button class="btn btn-danger" style="font-size:0.72rem;padding:4px 10px;" onclick="deleteSale('${s.id}')">Eliminar</button></td>
    </tr>`;
  }).join('');
}

// ============================================================
// EXPORT + SHEETS
// ============================================================
async function exportCSV() {
  const sales = await getSales();
  if (!sales.length) { showToast('No hay datos para exportar', 'error'); return; }
  const headers = ['ID','Empleado','Cliente','DNI','Campaña','Tarifa','Gan.Dist(€)','Gan.Colab(€)','Mes','Estado','Notas','Fecha'];
  const rows = sales.map(s => [s.id,s.empName,s.client,s.dni||'',s.campanaNombre,s.tarifaNombre,s.gananciaDistribuidor,s.gananciaColaborador,s.mes,s.estado,s.notas||'',s.createdAt]);
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
// SIDEBAR
// ============================================================
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('show');
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

function populateCampFilter(sales) {
  const camps = [...new Map((sales||[]).map(s => [s.campanaId, s.campanaNombre])).entries()];
  const el = document.getElementById('filter-camp');
  if (!el) return;
  const cur = el.value;
  el.innerHTML = '<option value="">Todas las campañas</option>' + camps.map(([id,n])=>`<option value="${id}" ${id===cur?'selected':''}>${n}</option>`).join('');
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => { t.className = 'toast'; }, 3000);
}
