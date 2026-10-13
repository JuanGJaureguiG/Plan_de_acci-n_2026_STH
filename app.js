// ---- Fecha de corte de la matriz de datos ----
// Actualizar esta fecha/hora cada vez que se recargue una nueva versión de
// Matriz_Plan_de_Acción_2026.xlsx en el tablero (el Plan de Acción está en
// actualización continua, esta fecha NO se recalcula sola).
const DATA_CUTOFF = new Date(2026, 9, 9); // 09/10/2026 — 3er seguimiento del Plan de Acción
const DATA_CUTOFF_HAS_TIME = false; // true solo si se conoce la hora exacta del corte

function formatCutoff(d, hasTime) {
  const datePart = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  if (!hasTime) return datePart;
  const timePart = d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${datePart}, ${timePart}`;
}

// ---- Setup ----
const AREAS = [...new Set(DATA.map(d => d.area))].sort();
const CUS_ORDER = ['Ibagué','Neiva','Garzón','Pitalito','Lérida','La Dorada','Planadas'];
const CUS = CUS_ORDER.filter(c => DATA.some(d => d.cu === c));
const FRENTES = [...new Set(DATA.map(d => d.frente))].sort((a,b) => {
  const na = DATA.find(d=>d.frente===a).frenteNum, nb = DATA.find(d=>d.frente===b).frenteNum;
  return na - nb;
});
const PERIODS_ORDER = ['Mensual','Bimestral','Trimestral','Semestral','Anual'];
const PERIODS = PERIODS_ORDER.filter(p => DATA.some(d => d.periodicidad === p));

const CU_COLORS = {
  'Ibagué':    '#16324F',
  'Neiva':     '#2F7A6D',
  'Garzón':    '#E2962B',
  'Pitalito':  '#8A5FBF',
  'Lérida':    '#4F8FC0',
  'La Dorada': '#C25B8E',
  'Planadas':  '#6FA85A',
};

const COLOR_MAP = { good: '#2F7A6D', warn: '#E2962B', danger: '#C0453A' };

// ---- Dynamic "Proyección" — regla de tres día del año / 365 ----
function computeProyeccion() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = Math.floor((now - start) / 86400000) + 1;
  const daysInYear = (now.getFullYear() % 4 === 0 && (now.getFullYear() % 100 !== 0 || now.getFullYear() % 400 === 0)) ? 366 : 365;
  return { pct: (diff / daysInYear) * 100, day: diff, daysInYear, date: now };
}
const PROY = computeProyeccion();

function paceStatus(avg) {
  if (avg === null || avg === undefined) return 'na';
  const diff = avg - PROY.pct;
  if (diff >= 0) return 'good';
  if (diff >= -15) return 'warn';
  return 'danger';
}
const COLOR_MAP_FULL = Object.assign({ na: '#c7cbd1' }, COLOR_MAP);
function pctColor(v) { return COLOR_MAP_FULL[paceStatus(v)]; }

// ---- Filters state ----
const filters = { area: 'ALL', cu: 'ALL', frente: 'ALL', periodicidad: 'ALL' };

function filteredData() {
  return DATA.filter(r =>
    (filters.area === 'ALL' || r.area === filters.area) &&
    (filters.cu === 'ALL' || r.cu === filters.cu) &&
    (filters.frente === 'ALL' || r.frente === filters.frente) &&
    (filters.periodicidad === 'ALL' || r.periodicidad === filters.periodicidad)
  );
}

// Promedia solo sobre acciones con dato real (norm !== null); las "N/A"
// (sin meta asignada a ese CU/acción) se cuentan aparte y no penalizan el promedio.
function groupAvg(rows, keyFn) {
  const map = new Map();
  rows.forEach(r => {
    const k = keyFn(r);
    if (!map.has(k)) map.set(k, { vals: [], naCount: 0 });
    if (r.norm === null || r.norm === undefined) map.get(k).naCount++;
    else map.get(k).vals.push(r.norm);
  });
  return Array.from(map.entries())
    .filter(([key, g]) => g.vals.length > 0)
    .map(([key, g]) => ({
      key,
      avg: g.vals.reduce((a, b) => a + b, 0) / g.vals.length,
      count: g.vals.length,
      naCount: g.naCount
    }));
}

// ---- Header "corte" badge ----
function buildCorteBadge() {
  document.getElementById('corteBadge').innerHTML = `
    <div class="cb-label">Corte de datos</div>
    <div class="cb-value">${formatCutoff(DATA_CUTOFF, DATA_CUTOFF_HAS_TIME)}</div>
    <div class="cb-sub">3er seguimiento · Plan de Acción en actualización continua</div>
  `;
}

// ---- KPI Row (siempre a nivel Sede completo, no se filtra) ----
function buildKPIs() {
  const validNorm = DATA.filter(d => d.norm !== null && d.norm !== undefined).map(d => d.norm);
  const naCount = DATA.length - validNorm.length;
  const avanceSede = validNorm.reduce((a, b) => a + b, 0) / validNorm.length;
  const brecha = avanceSede - PROY.pct;
  const brechaColor = brecha >= 0 ? 'var(--teal)' : (brecha >= -10 ? 'var(--accent)' : 'var(--danger)');
  const brechaSign = brecha >= 0 ? '+' : '';

  document.getElementById('kpiRow').innerHTML = `
    <div class="kpi" style="border-left-color:var(--accent)">
      <div class="kpi-label" style="color:var(--accent)">Avance Sede</div>
      <div class="kpi-value">${avanceSede.toFixed(1)}%</div>
      <div class="kpi-sub">Promedio sobre ${validNorm.length} acciones con dato reportado</div>
    </div>
    <div class="kpi" style="border-left-color:var(--ink)">
      <div class="kpi-label" style="color:var(--ink)">Proyección de Cumplimiento</div>
      <div class="kpi-value">${PROY.pct.toFixed(1)}%</div>
      <div class="kpi-sub">Ritmo esperado: día ${PROY.day} de ${PROY.daysInYear}</div>
    </div>
    <div class="kpi" style="border-left-color:${brechaColor}">
      <div class="kpi-label" style="color:${brechaColor}">Brecha vs. Ritmo Esperado</div>
      <div class="kpi-value" style="color:${brechaColor}">${brechaSign}${brecha.toFixed(1)} pts</div>
      <div class="kpi-sub">${brecha >= 0 ? 'La Sede va adelantada al ritmo del año' : 'La Sede va atrasada frente al ritmo del año'}</div>
    </div>
    <div class="kpi" style="border-left-color:var(--purple)">
      <div class="kpi-label" style="color:var(--purple)">Total de Acciones</div>
      <div class="kpi-value">${DATA.length}</div>
      <div class="kpi-sub">${AREAS.length} Áreas · ${CUS.length} CU · ${FRENTES.length} Frentes · ${naCount} sin meta aplicable (N/A)</div>
    </div>
  `;

  document.getElementById('kpiNote').innerHTML =
    `<b>¿Cómo se calcula la Proyección?</b> Regla de tres dinámica: (día actual del año ÷ ${PROY.daysInYear}) × 100 — se recalcula sola cada vez que se abre el tablero, según la fecha del día.
    Es la referencia de ritmo más directamente comparable para acciones de periodicidad <b>Anual</b>; para comparar de forma homogénea acciones Mensuales, Bimestrales, Trimestrales o Semestrales, usa el filtro de Periodicidad.
    Avance Sede, Proyección y Brecha son indicadores institucionales globales y no cambian con los filtros; los gráficos, alertas y la tabla sí responden a ellos.
    Las <b>${naCount} acciones marcadas "N/A"</b> (sin meta asignada a ese CU en esa acción) se excluyen de todos los promedios — en la tabla aparecen en gris con "N/A" en vez de 0%.
    El <b>Corte de datos</b> (arriba a la derecha) es distinto: es la fecha del último seguimiento cargado al tablero, y solo cambia cuando se publica una nueva versión de la matriz.`;

  document.getElementById('footerText').textContent =
    `Datos: Matriz de Plan de Acción 2026 · UNIMINUTO Sede Tolima - Huila · Corte de datos: ${formatCutoff(DATA_CUTOFF, DATA_CUTOFF_HAS_TIME)} · Proyección de ritmo calculada hoy, ${PROY.date.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

// ---- Sidebar filter sections ----
function toggleSection(headerEl) {
  headerEl.classList.toggle('collapsed');
  headerEl.nextElementSibling.classList.toggle('collapsed');
}

function buildFilterGroup(containerId, options, filterKey, labelFn) {
  const cont = document.getElementById(containerId);
  cont.innerHTML = '';
  const allBtn = document.createElement('button');
  allBtn.className = 'fbtn active-all';
  allBtn.textContent = 'TODOS';
  allBtn.onclick = () => { filters[filterKey] = 'ALL'; refreshFilterTabs(); renderAll(); };
  cont.appendChild(allBtn);
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'fbtn';
    btn.textContent = labelFn ? labelFn(opt) : opt;
    btn.dataset.value = opt;
    btn.onclick = () => { filters[filterKey] = opt; refreshFilterTabs(); renderAll(); };
    cont.appendChild(btn);
  });
}

function refreshFilterTabs() {
  [['filterArea', 'area'], ['filterCU', 'cu'], ['filterFrente', 'frente'], ['filterPeriod', 'periodicidad']].forEach(([containerId, key]) => {
    const cont = document.getElementById(containerId);
    const buttons = cont.querySelectorAll('.fbtn');
    buttons.forEach(b => {
      if (!b.dataset.value) {
        b.className = filters[key] === 'ALL' ? 'fbtn active-all' : 'fbtn';
      } else {
        b.className = filters[key] === b.dataset.value ? 'fbtn active' : 'fbtn';
      }
    });
  });

  const rows = filteredData();
  const activeFilters = Object.entries(filters).filter(([k, v]) => v !== 'ALL');
  const status = document.getElementById('filterStatus');
  if (activeFilters.length === 0) {
    status.innerHTML = `Mostrando <b>${rows.length}</b> de ${DATA.length} acciones (sin filtros activos)`;
  } else {
    const labels = { area: 'Área', cu: 'CU', frente: 'Frente', periodicidad: 'Periodicidad' };
    const parts = activeFilters.map(([k, v]) => `${labels[k]}: <b>${v.length > 40 ? v.slice(0,40)+'…' : v}</b>`).join(' · ');
    status.innerHTML = `Mostrando <b>${rows.length}</b> de ${DATA.length} acciones — ${parts} <span class="reset" onclick="resetFilters()">Limpiar filtros</span>`;
  }
  document.getElementById('tableCount').textContent = `${rows.length} acciones`;
}

function resetFilters() {
  filters.area = 'ALL'; filters.cu = 'ALL'; filters.frente = 'ALL'; filters.periodicidad = 'ALL';
  refreshFilterTabs();
  renderAll();
}

// ---- Charts ----
let charts = {};

function destroyChart(key) {
  if (charts[key]) { charts[key].destroy(); charts[key] = null; }
}

// Custom inline data-label plugin (no external CDN dependency — avoids
// chartjs-plugin-datalabels reliability issues; consistent with other STH dashboards)
const dataLabelPlugin = {
  id: 'dataLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const horizontal = chart.options.indexAxis === 'y';
    chart.data.datasets.forEach((dataset, dsIndex) => {
      const meta = chart.getDatasetMeta(dsIndex);
      meta.data.forEach((bar, index) => {
        const value = dataset.data[index];
        if (value === null || value === undefined) return;
        const text = value.toFixed(1) + '%';
        ctx.save();
        ctx.font = "600 10.5px 'IBM Plex Sans', sans-serif";
        ctx.fillStyle = '#16324F';
        if (horizontal) {
          const chartArea = chart.chartArea;
          const fits = bar.x + 6 + ctx.measureText(text).width < chartArea.right;
          ctx.textBaseline = 'middle';
          if (fits) {
            ctx.textAlign = 'left';
            ctx.fillText(text, bar.x + 6, bar.y);
          } else {
            ctx.textAlign = 'right';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(text, bar.x - 6, bar.y);
          }
        } else {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(text, bar.x, bar.y - 5);
        }
        ctx.restore();
      });
    });
  }
};

function buildBarChart(canvasId, groups, horizontal, labelMap) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  const labels = groups.map(g => labelMap ? labelMap(g.key) : g.key);
  const values = groups.map(g => +g.avg.toFixed(1));
  const colors = groups.map(g => pctColor(g.avg));
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderRadius: 5,
        borderSkipped: false,
      }]
    },
    plugins: [dataLabelPlugin],
    options: {
      indexAxis: horizontal ? 'y' : 'x',
      responsive: true,
      layout: { padding: horizontal ? { right: 34 } : { top: 22 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#16324F',
          titleFont: { family: 'IBM Plex Sans' },
          bodyFont: { family: 'IBM Plex Sans' },
          callbacks: {
            label: (ctx) => {
              const g = groups[ctx.dataIndex];
              const base = `Avance: ${ctx.parsed[horizontal ? 'x' : 'y']}%  ·  n=${g.count}`;
              return g.naCount ? `${base}  ·  ${g.naCount} N/A (no cuentan en el promedio)` : base;
            }
          }
        }
      },
      scales: horizontal ? {
        x: { ticks: { color: '#6b7280', font: { size: 10, family: 'IBM Plex Sans' }, callback: v => v + '%' }, grid: { color: '#eef0eb' }, min: 0, max: 100 },
        y: { ticks: { color: '#16324F', font: { size: 10.5, family: 'IBM Plex Sans' } }, grid: { display: false } }
      } : {
        x: { ticks: { color: '#16324F', font: { size: 10.5, family: 'IBM Plex Sans' } }, grid: { display: false } },
        y: { ticks: { color: '#6b7280', font: { size: 10, family: 'IBM Plex Sans' }, callback: v => v + '%' }, grid: { color: '#eef0eb' }, min: 0, max: 100 }
      }
    }
  });
}

function buildCharts() {
  const rows = filteredData();

  destroyChart('area');
  const areaGroups = groupAvg(rows, r => r.area).sort((a, b) => b.avg - a.avg);
  charts.area = areaGroups.length
    ? buildBarChart('areaChart', areaGroups, true)
    : emptyChart('areaChart');

  destroyChart('cu');
  const cuRows = groupAvg(rows, r => r.cu);
  const cuGroups = CUS.filter(c => cuRows.some(g => g.key === c)).map(c => cuRows.find(g => g.key === c));
  charts.cu = cuGroups.length
    ? buildBarChart('cuChart', cuGroups, false)
    : emptyChart('cuChart');

  destroyChart('frente');
  const frenteRows = groupAvg(rows, r => r.frenteLabel);
  const frenteGroups = FRENTES.map(f => DATA.find(d => d.frente === f).frenteLabel)
    .filter((label, i, arr) => arr.indexOf(label) === i)
    .map(label => frenteRows.find(g => g.key === label))
    .filter(Boolean);
  charts.frente = frenteGroups.length
    ? buildBarChart('frenteChart', frenteGroups, true)
    : emptyChart('frenteChart');

  destroyChart('reto');
  const retoGroups = groupAvg(rows, r => r.reto).sort((a, b) => b.avg - a.avg);
  charts.reto = retoGroups.length
    ? buildBarChart('retoChart', retoGroups, true, k => k.length > 42 ? k.slice(0, 42) + '…' : k)
    : emptyChart('retoChart');
}

function emptyChart(canvasId) {
  const ctx = document.getElementById(canvasId);
  const parent = ctx.parentElement;
  ctx.style.display = 'none';
  let msg = parent.querySelector('.empty-state');
  if (!msg) {
    msg = document.createElement('div');
    msg.className = 'empty-state';
    parent.appendChild(msg);
  }
  msg.textContent = 'No hay acciones para los filtros seleccionados';
  return null;
}

function clearEmptyStates() {
  document.querySelectorAll('.empty-state').forEach(e => e.remove());
  document.querySelectorAll('canvas').forEach(c => c.style.display = 'block');
}

// ---- Alerts (siempre sobre el dataset completo, no filtrado) ----
function buildAlerts() {
  const risk = [...DATA].filter(r => r.norm !== null && (r.norm - PROY.pct) < -20)
    .sort((a, b) => a.norm - b.norm).slice(0, 9);
  document.getElementById('riskAlerts').innerHTML = risk.length ? risk.map(r => `
    <div class="alert-card">
      <div class="alert-cu">${r.area} · ${r.cu}</div>
      <div class="alert-prog">${r.reto}</div>
      <div class="alert-stats">
        <div><div class="alert-stat-val" style="color:var(--danger)">${r.norm.toFixed(1)}%</div><div class="alert-stat-label">Cumplimiento</div></div>
        <div><div class="alert-stat-val" style="color:var(--muted);font-size:13px">${(r.norm - PROY.pct).toFixed(1)} pts</div><div class="alert-stat-label">vs. ritmo esperado</div></div>
      </div>
      <div class="alert-tags">
        <span class="period-badge">${r.periodicidad}</span>
        <span class="period-badge">${r.frenteLabel.split('.')[0]}</span>
      </div>
    </div>`).join('') : '<div class="empty-state">Ninguna acción está significativamente por debajo del ritmo esperado</div>';

  const highlight = [...DATA].filter(r => r.norm !== null && (r.norm - PROY.pct) >= 20)
    .sort((a, b) => b.norm - a.norm).slice(0, 6);
  document.getElementById('highlightAlerts').innerHTML = highlight.length ? highlight.map(r => `
    <div class="alert-card good">
      <div class="alert-cu">${r.area} · ${r.cu}</div>
      <div class="alert-prog">${r.reto}</div>
      <div class="alert-stats">
        <div><div class="alert-stat-val" style="color:var(--teal)">${r.norm.toFixed(1)}%</div><div class="alert-stat-label">Cumplimiento</div></div>
        <div><div class="alert-stat-val" style="color:var(--teal);font-size:13px">+${(r.norm - PROY.pct).toFixed(1)} pts</div><div class="alert-stat-label">vs. ritmo esperado</div></div>
      </div>
      <div class="alert-tags">
        <span class="period-badge">${r.periodicidad}</span>
        <span class="period-badge">${r.frenteLabel.split('.')[0]}</span>
      </div>
    </div>`).join('') : '<div class="empty-state">Ninguna acción está significativamente por encima del ritmo esperado</div>';
}

// ---- Table ----
let sortKey = 'norm';
let sortDir = -1;

function fmtPct(v) {
  return (v === null || v === undefined) ? 'N/A' : v.toFixed(1) + '%';
}
function pctClass(v) {
  const s = paceStatus(v);
  if (s === 'na') return 'pct-na';
  return s === 'good' ? 'pct-high' : (s === 'warn' ? 'pct-mid' : 'pct-low');
}

function buildTable() {
  const rows = filteredData().slice().sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey];
    if (av === null || av === undefined) av = -Infinity;
    if (bv === null || bv === undefined) bv = -Infinity;
    if (typeof av === 'string') return sortDir * av.localeCompare(bv);
    return sortDir * (av > bv ? 1 : av < bv ? -1 : 0);
  });
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = rows.map(r => {
    const isNA = r.norm === null || r.norm === undefined;
    const barW = isNA ? 100 : Math.min(100, Math.max(0, r.norm));
    const barColor = isNA ? '#e4e6e0' : pctColor(r.norm);
    return `<tr>
      <td style="font-size:12px;max-width:170px">${r.area}</td>
      <td style="font-size:12px;max-width:300px">${r.reto}</td>
      <td style="font-size:11.5px;max-width:220px;color:var(--muted)">${r.frenteLabel}</td>
      <td><span class="cu-badge" style="border-color:${CU_COLORS[r.cu]}55;color:${CU_COLORS[r.cu]}">${r.cu}</span></td>
      <td><span class="period-badge">${r.periodicidad}</span></td>
      <td class="pct-cell" style="color:var(--ink)">${fmtPct(r.total)}</td>
      <td>
        <div class="bar-wrap">
          <div class="bar-bg"><div class="bar-fill" style="width:${barW}%;background:${barColor}"></div></div>
          <span class="pct-cell ${pctClass(r.norm)}" title="${isNA ? 'Sin meta asignada a este CU para esta acción — no cuenta en los promedios' : ''}">${fmtPct(r.norm)}</span>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function sortTable(key) {
  if (sortKey === key) sortDir *= -1;
  else { sortKey = key; sortDir = -1; }
  buildTable();
}

// ---- Orchestration ----
function renderAll() {
  clearEmptyStates();
  refreshFilterTabs();
  buildCharts();
  buildTable();
}

buildCorteBadge();
buildKPIs();
buildFilterGroup('filterArea', AREAS, 'area');
buildFilterGroup('filterCU', CUS, 'cu');
buildFilterGroup('filterFrente', FRENTES, 'frente', f => {
  const label = DATA.find(d => d.frente === f).frenteLabel;
  return label.length > 46 ? label.slice(0, 46) + '…' : label;
});
buildFilterGroup('filterPeriod', PERIODS, 'periodicidad');
buildAlerts();
renderAll();