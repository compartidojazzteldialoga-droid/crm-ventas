// ============================================================
// CONFIG — reemplazá SCRIPT_URL con tu Google Apps Script URL
// ============================================================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby3K1W52Q6t-BzX8x5pTEHpTC7DbEbh7flqPaLYyqf_LrA8mhPmySL6TRDatd-0HxPW/exec';

const TARIFAS = {
  A: 100,
  B: 150,
};

// ============================================================
// STORAGE — guarda en localStorage como caché local
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
async function pushToSheets(sale) {
  if (!SCRIPT_URL || SCRIPT_URL === 'YOUR_APPS_SCRIPT_URL_HERE') return;
  try {
    await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', sale }),
    });
  } catch (e) {
    console.warn('Sheets sync error:', e);
  }
}

async function deleteFromSheets(id) {
  if (!SCRIPT_URL || SCRIPT_URL === 'YOUR_APPS_SCRIPT_URL_HERE') return;
  try {
    await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    });
  } catch (e) {
    console.warn('Sheets sync error:', e);
  }
}

async function updateStatusInSheets(id, estado) {
  if (!SCRIPT_URL || SCRIPT_URL === 'YOUR_APPS_SCRIPT_URL_HERE') return;
  try {
    await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updateStatus', id, estado }),
    });
  } catch (e) {
    console.warn('Sheets sync error:', e);
  }
}

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
  renderEmployeeTable();
  populateMonthFilter('filter-mes-emp', renderEmployeeTable);
}

async function submitSale() {
  const empName   = document.getElementById('emp-name').value.trim();
  const client    = document.getElementById('client-name').value.trim();
  const tarifa    = document.getElementById('tarifa').value;
  const mes       = document.getElementById('mes').value;
  const estado    = document.getElementById('estado').value;
  const notas     = document.getElementById('notas').value.trim();
  const status    = document.getElementById('form-status');

  if (!empName || !client || !tarifa || !mes) {
    showToast('Completá todos los campos obligatorios', 'error');
    return;
  }

  const sale = {
    id: Date.now().toString(),
    empName,
    client,
    tarifa,
    monto: TARIFAS[tarifa],
    mes,
    estado,
    notas,
    createdAt: new Date().toISOString(),
  };

  status.textContent = 'Guardando...';

  const sales = getSales();
  sales.push(sale);
  saveSales(sales);

  await pushToSheets(sale);

  // Clear form fields (keep name and month)
  document.getElementById('client-name').value = '';
  document.getElementById('notas').value = '';
  document.getElementById('tarifa').value = '';
  document.getElementById('estado').value = 'activa';

  status.textContent = '';
  showToast('Venta registrada correctamente');
  populateMonthFilter('filter-mes-emp', renderEmployeeTable);
  renderEmployeeTable();
}

function renderEmployeeTable() {
  const empName = getStoredEmpName();
  const filterMes = document.getElementById('filter-mes-emp')?.value || '';
  const sales = getSales().filter(s =>
    (!empName || s.empName.toLowerCase() === empName.toLowerCase()) &&
    (!filterMes || s.mes === filterMes)
  );

  const tbody = document.getElementById('emp-table-body');
  if (!sales.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">No hay ventas registradas aún</td></tr>';
    return;
  }

  tbody.innerHTML = sales.map(s => `
    <tr>
      <td>${s.client}</td>
      <td>Tarifa ${s.tarifa}</td>
      <td>${s.monto} €</td>
      <td>${formatMes(s.mes)}</td>
      <td><span class="pill ${s.estado}">${s.estado}</span></td>
      <td>
        <button class="btn btn-outline" style="font-size:0.72rem; padding:4px 10px;"
          onclick="toggleStatus('${s.id}', '${s.estado}', 'emp')">
          ${s.estado === 'activa' ? 'Marcar inactiva' : 'Marcar activa'}
        </button>
      </td>
    </tr>
  `).join('');
}

function getStoredEmpName() {
  // Returns the name typed in the form if present, otherwise empty (show all for that session)
  return document.getElementById('emp-name')?.value.trim() || '';
}

// ============================================================
// ADMIN
// ============================================================
function initAdmin() {
  loadData();
  // Auto-refresh every 30 seconds
  setInterval(loadData, 30000);
}

function loadData() {
  renderAdminStats();
  renderAdminTable();
  renderEmpBreakdown();
  populateMonthFilter('filter-mes', renderAdminTable);
  populateEmpFilter();
}

function renderAdminStats() {
  const filterMes = document.getElementById('filter-mes')?.value || '';
  const sales = getSales().filter(s => !filterMes || s.mes === filterMes);

  const total     = sales.length;
  const activas   = sales.filter(s => s.estado === 'activa');
  const potencial = sales.reduce((acc, s) => acc + s.monto, 0);
  const real      = activas.reduce((acc, s) => acc + s.monto, 0);
  const perdidos  = potencial - real;

  const taA = sales.filter(s => s.tarifa === 'A');
  const taB = sales.filter(s => s.tarifa === 'B');
  const taAact = taA.filter(s => s.estado === 'activa');
  const taBact = taB.filter(s => s.estado === 'activa');

  set('stat-potencial', `${potencial} €`);
  set('stat-real', `${real} €`);
  set('stat-activas', activas.length);
  set('stat-activas-sub', `de ${total} registradas`);
  set('stat-perdidos', `${perdidos} €`);

  set('stat-ta-real', `${taAact.reduce((a, s) => a + s.monto, 0)} €`);
  set('stat-ta-sub', `${taAact.length} activas / ${taA.length} total`);
  set('stat-tb-real', `${taBact.reduce((a, s) => a + s.monto, 0)} €`);
  set('stat-tb-sub', `${taBact.length} activas / ${taB.length} total`);
}

function renderEmpBreakdown() {
  const sales = getSales();
  const emps = {};

  sales.forEach(s => {
    if (!emps[s.empName]) emps[s.empName] = [];
    emps[s.empName].push(s);
  });

  const tbody = document.getElementById('emp-breakdown-body');
  const entries = Object.entries(emps);

  if (!entries.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">Sin datos</td></tr>';
    return;
  }

  tbody.innerHTML = entries.map(([name, ss]) => {
    const activas = ss.filter(s => s.estado === 'activa');
    const potencial = ss.reduce((a, s) => a + s.monto, 0);
    const real = activas.reduce((a, s) => a + s.monto, 0);
    return `
      <tr>
        <td>${name}</td>
        <td>${ss.length}</td>
        <td>${activas.length}</td>
        <td>${potencial} €</td>
        <td>${real} €</td>
      </tr>
    `;
  }).join('');
}

function renderAdminTable() {
  renderAdminStats();
  const filterMes    = document.getElementById('filter-mes')?.value || '';
  const filterEmp    = document.getElementById('filter-emp')?.value || '';
  const filterEstado = document.getElementById('filter-estado')?.value || '';

  const sales = getSales().filter(s =>
    (!filterMes    || s.mes === filterMes) &&
    (!filterEmp    || s.empName === filterEmp) &&
    (!filterEstado || s.estado === filterEstado)
  );

  const tbody = document.getElementById('admin-table-body');
  if (!sales.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty">No hay ventas que coincidan con los filtros</td></tr>';
    return;
  }

  tbody.innerHTML = sales.map(s => `
    <tr>
      <td>${s.empName}</td>
      <td>${s.client}</td>
      <td>Tarifa ${s.tarifa}</td>
      <td>${s.monto} €</td>
      <td>${formatMes(s.mes)}</td>
      <td><span class="pill ${s.estado}">${s.estado}</span></td>
      <td style="color:var(--text-muted); font-size:0.82rem;">${s.notas || '—'}</td>
      <td style="display:flex; gap:6px;">
        <button class="btn btn-outline" style="font-size:0.72rem; padding:4px 10px;"
          onclick="toggleStatus('${s.id}', '${s.estado}', 'admin')">
          ${s.estado === 'activa' ? 'Inactiva' : 'Activa'}
        </button>
        <button class="btn btn-danger" style="font-size:0.72rem; padding:4px 10px;"
          onclick="deleteSale('${s.id}')">
          Eliminar
        </button>
      </td>
    </tr>
  `).join('');
}

// ============================================================
// SHARED ACTIONS
// ============================================================
async function toggleStatus(id, currentEstado, mode) {
  const newEstado = currentEstado === 'activa' ? 'inactiva' : 'activa';
  const sales = getSales().map(s => s.id === id ? { ...s, estado: newEstado } : s);
  saveSales(sales);
  await updateStatusInSheets(id, newEstado);
  showToast(`Venta marcada como ${newEstado}`);
  if (mode === 'emp') renderEmployeeTable();
  else loadData();
}

async function deleteSale(id) {
  if (!confirm('¿Eliminar esta venta?')) return;
  const sales = getSales().filter(s => s.id !== id);
  saveSales(sales);
  await deleteFromSheets(id);
  showToast('Venta eliminada');
  loadData();
}

// ============================================================
// EXPORT CSV
// ============================================================
function exportCSV() {
  const sales = getSales();
  if (!sales.length) { showToast('No hay datos para exportar', 'error'); return; }

  const headers = ['ID', 'Empleado', 'Cliente', 'Tarifa', 'Monto (€)', 'Mes', 'Estado', 'Notas', 'Fecha registro'];
  const rows = sales.map(s => [
    s.id, s.empName, s.client, `Tarifa ${s.tarifa}`, s.monto,
    s.mes, s.estado, s.notas || '', s.createdAt
  ]);

  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ventas_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exportado');
}

// ============================================================
// HELPERS
// ============================================================
function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function formatMes(mes) {
  if (!mes) return '—';
  const [y, m] = mes.split('-');
  const names = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${names[parseInt(m) - 1]} ${y}`;
}

function populateMonthFilter(filterId, callback) {
  const sales = getSales();
  const meses = [...new Set(sales.map(s => s.mes))].sort().reverse();
  const el = document.getElementById(filterId);
  if (!el) return;
  const current = el.value;
  el.innerHTML = '<option value="">Todos los meses</option>' +
    meses.map(m => `<option value="${m}" ${m === current ? 'selected' : ''}>${formatMes(m)}</option>`).join('');
}

function populateEmpFilter() {
  const sales = getSales();
  const emps = [...new Set(sales.map(s => s.empName))].sort();
  const el = document.getElementById('filter-emp');
  if (!el) return;
  const current = el.value;
  el.innerHTML = '<option value="">Todos los empleados</option>' +
    emps.map(e => `<option value="${e}" ${e === current ? 'selected' : ''}>${e}</option>`).join('');
}
