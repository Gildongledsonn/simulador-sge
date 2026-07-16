/* =========================================================
   SGE — Simulador — lógica geral
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initClock();
  safeInit('Painel geral', initDashboard);
  safeInit('Caso 1 (fator de potência)', initCaso1);
  safeInit('Caso 2 (demanda contratada)', initCaso2);
});

/* Executa um módulo isoladamente: se algo falhar (ex.: Chart.js não
   carregou por falta de internet/bloqueio de rede), os demais módulos
   continuam funcionando normalmente. */
function safeInit(label, fn) {
  try {
    fn();
  } catch (err) {
    console.error(`[SGE] Falha ao iniciar módulo "${label}":`, err);
  }
}

/* true se a biblioteca Chart.js carregou com sucesso via CDN */
function chartLibAvailable() {
  return typeof Chart !== 'undefined';
}

function showChartUnavailable(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const msg = document.createElement('p');
  msg.className = 'hint';
  msg.textContent = 'Gráfico indisponível: não foi possível carregar a biblioteca Chart.js (verifique a conexão com a internet).';
  canvas.replaceWith(msg);
}

/* ---------------------------------------------------------
   Navegação por abas
   --------------------------------------------------------- */
function initTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  const views = document.querySelectorAll('.view');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      views.forEach(v => v.classList.remove('active'));

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });
}

/* ---------------------------------------------------------
   Relógio simulado (acelerado)
   --------------------------------------------------------- */
let simMinutes = 8 * 60; // começa às 08:00

function initClock() {
  tickClock();
  setInterval(tickClock, 2500);
}

function tickClock() {
  simMinutes = (simMinutes + 6) % (24 * 60);
  const h = String(Math.floor(simMinutes / 60)).padStart(2, '0');
  const m = String(simMinutes % 60).padStart(2, '0');
  document.getElementById('simClock').textContent = `${h}:${m}`;
}

function formatClock() {
  const h = String(Math.floor(simMinutes / 60)).padStart(2, '0');
  const m = String(simMinutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/* ---------------------------------------------------------
   Painel geral — leitura simulada do medidor
   --------------------------------------------------------- */
let liveChart;
let liveFP = 0.90;
let lastCapStages = -1;
const liveHistory = [];
const contractedRefDemand = 480; // kW — referência da instalação genérica do painel geral

function initDashboard() {
  if (chartLibAvailable()) {
    const ctx = document.getElementById('chartLive').getContext('2d');
    liveChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Potência ativa (kW)',
          data: [],
          borderColor: '#2FD9C6',
          backgroundColor: 'rgba(47,217,198,0.12)',
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2
        }]
      },
      options: chartBaseOptions('kW')
    });
  } else {
    showChartUnavailable('chartLive');
  }

  updateDashboard();
  setInterval(updateDashboard, 2500);

  const capToggle = document.getElementById('autoCapBank');
  if (capToggle) {
    capToggle.addEventListener('change', function () {
      const stateEl = document.getElementById('autoCapBankState');
      if (stateEl) stateEl.textContent = this.checked ? 'Ligado' : 'Desligado';
      logEvent(this.checked
        ? 'Banco de capacitores automático ativado'
        : 'Banco de capacitores automático desativado');
      updateDashboard();
    });
  }
}

function updateDashboard() {
  // tensão com pequena oscilação
  const voltage = 220 + (Math.random() * 6 - 3);

  // fator de potência bruto (sem compensação): passeio aleatório lento,
  // simulando motores subcarregados como no estudo de caso 1
  liveFP += (Math.random() * 0.02 - 0.01);
  liveFP = Math.min(0.95, Math.max(0.78, liveFP));

  // banco de capacitores automático: se ligado, aciona estágios de +0,03
  // até atingir o mínimo da ANEEL (0,92) ou esgotar os 5 estágios
  const capCheckbox = document.getElementById('autoCapBank');
  const capOn = capCheckbox ? capCheckbox.checked : false;
  let stages = 0;
  let effectiveFP = liveFP;
  if (capOn) {
    while (effectiveFP < ANEEL_MIN_FP && stages < 5) {
      stages++;
      effectiveFP = Math.min(0.98, liveFP + stages * 0.03);
    }
  }
  const rawEl = document.getElementById('rawFPReadout');
  if (rawEl) rawEl.textContent = liveFP.toFixed(2);
  const stagesEl = document.getElementById('capBankStages');
  if (stagesEl) stagesEl.textContent = `${stages} / 5`;
  if (stages !== lastCapStages) {
    if (capOn && stages > 0) logEvent(`Banco de capacitores: ${stages} estágio(s) acionado(s) — f.p. corrigido para ${effectiveFP.toFixed(2)}`);
    lastCapStages = stages;
  }

  // potência ativa com variação suave ao longo do "dia"
  const hourFactor = 0.6 + 0.4 * Math.sin((simMinutes / (24 * 60)) * Math.PI);
  const activePower = 320 * hourFactor + (Math.random() * 20 - 10);

  const apparent = activePower / effectiveFP;
  const reactive = Math.sqrt(Math.max(apparent ** 2 - activePower ** 2, 0));
  const current = (apparent * 1000) / (Math.sqrt(3) * 380);

  document.getElementById('gVoltage').textContent = voltage.toFixed(1);
  document.getElementById('gCurrent').textContent = current.toFixed(1);
  document.getElementById('gActive').textContent = activePower.toFixed(1);
  document.getElementById('gReactive').textContent = reactive.toFixed(1);
  document.getElementById('gApparent').textContent = apparent.toFixed(1);
  document.getElementById('gFP').textContent = effectiveFP.toFixed(2);

  // LEDs de alerta
  setLed('ledFP', effectiveFP < 0.85 ? 'critical' : effectiveFP < 0.92 ? 'warn' : 'ok',
    'Fator de potência', effectiveFP < 0.92 ? `f.p. ${effectiveFP.toFixed(2)} abaixo do mínimo ANEEL (0,92)` : 'dentro do limite regulatório');

  setLed('ledDemanda',
    activePower > contractedRefDemand ? 'critical' : activePower > contractedRefDemand * 0.9 ? 'warn' : 'ok',
    'Demanda', activePower > contractedRefDemand * 0.9 ? `demanda em ${activePower.toFixed(0)} kW, próxima do limite de ${contractedRefDemand} kW` : 'demanda controlada');

  setLed('ledTensao',
    Math.abs(voltage - 220) > 5 ? 'warn' : 'ok',
    'Qualidade de tensão', Math.abs(voltage - 220) > 5 ? `tensão fora da faixa nominal (${voltage.toFixed(1)} V)` : 'tensão dentro da faixa nominal');

  // gráfico
  liveHistory.push(activePower);
  if (liveHistory.length > 30) liveHistory.shift();
  if (liveChart) {
    liveChart.data.labels = liveHistory.map((_, i) => i);
    liveChart.data.datasets[0].data = liveHistory;
    liveChart.update('none');
  }
}

/* controla os LEDs e opcionalmente registra evento no log quando muda de estado */
const ledState = {};
function setLed(id, level, label, detail) {
  const el = document.getElementById(id);
  const prev = ledState[id];
  el.classList.remove('ok', 'warn', 'critical');
  el.classList.add(level);
  el.querySelector('.led-dot') || null;
  el.innerHTML = `<span class="led-dot"></span> ${label}`;

  if (prev !== level && (level === 'warn' || level === 'critical')) {
    logEvent(`${label}: ${detail}`, level);
  }
  ledState[id] = level;
}

function logEvent(message, level = '') {
  const list = document.getElementById('eventLog');
  const li = document.createElement('li');
  if (level) li.classList.add(level);
  li.innerHTML = `<span class="t">${formatClock()}</span><span>${message}</span>`;
  list.prepend(li);
  while (list.children.length > 25) list.removeChild(list.lastChild);
}

/* opções compartilhadas dos gráficos Chart.js */
function chartBaseOptions(unit) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    plugins: {
      legend: { labels: { color: '#7E8B99', font: { family: 'JetBrains Mono', size: 11 } } },
      tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.formattedValue} ${unit}` } }
    },
    scales: {
      x: { ticks: { color: '#4E5A66', font: { size: 10 } }, grid: { color: '#1C2733' } },
      y: { ticks: { color: '#4E5A66', font: { size: 10 } }, grid: { color: '#1C2733' } }
    }
  };
}

/* ---------------------------------------------------------
   Caso 1 — Fator de potência
   --------------------------------------------------------- */
const CASE1_ACTIVE_POWER = 500; // kW — indústria de médio porte
const ANEEL_MIN_FP = 0.92;
const TARIFF_REACTIVE = 0.42; // R$/kvarh — valor ilustrativo
const HOURS_MONTH = 220; // regime de operação considerado

let fpChart;

function initCaso1() {
  const motorLoad = document.getElementById('motorLoad');
  const capStages = document.getElementById('capStages');

  buildDial();
  buildFPChart();

  [motorLoad, capStages].forEach(el => el.addEventListener('input', updateCaso1));
  updateCaso1();
}

function updateCaso1() {
  const motorLoad = Number(document.getElementById('motorLoad').value);
  const capStages = Number(document.getElementById('capStages').value);

  document.getElementById('motorLoadVal').textContent = motorLoad;
  document.getElementById('capStagesVal').textContent = capStages;

  const baseFP = 0.95 - (motorLoad / 100) * 0.14; // até 0,81 no pior caso, como no TCC
  const fp = Math.min(0.98, baseFP + capStages * 0.03);

  const P = CASE1_ACTIVE_POWER;
  const S = P / fp;
  const Q = Math.sqrt(Math.max(S ** 2 - P ** 2, 0));

  const S0 = P / baseFP;
  const Q0 = Math.sqrt(Math.max(S0 ** 2 - P ** 2, 0));
  const compensated = Q0 - Q;

  let cost = 0;
  if (fp < ANEEL_MIN_FP) {
    const tanFp = Math.tan(Math.acos(fp));
    const tanRef = Math.tan(Math.acos(ANEEL_MIN_FP));
    const reactiveExcess = P * (tanFp - tanRef) * HOURS_MONTH;
    cost = reactiveExcess * TARIFF_REACTIVE;
  }

  document.getElementById('c1Active').textContent = `${P.toFixed(0)} kW`;
  document.getElementById('c1Reactive').textContent = `${Q.toFixed(0)} kvar`;
  document.getElementById('c1Apparent').textContent = `${S.toFixed(0)} kVA`;
  document.getElementById('c1Compensated').textContent = `${compensated.toFixed(0)} kvar`;
  document.getElementById('c1Cost').textContent = cost > 0
    ? `≈ R$ ${cost.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} / mês`
    : 'R$ 0 (dentro do limite)';

  document.getElementById('c1Hint').textContent = fp < ANEEL_MIN_FP
    ? 'Fator de potência abaixo do mínimo regulatório — o SGE recomenda ativar mais estágios do banco de capacitores automático.'
    : 'Fator de potência dentro do limite da ANEEL. Instalação sem cobrança por excedente reativo.';

  updateDial(fp);
  updateFPChart(fp);
}

function buildDial() {
  const svg = document.getElementById('fpDial');
  const cx = 120, cy = 130, r = 100;

  const zones = [
    { from: 0.5, to: 0.85, color: '#E5535A' },
    { from: 0.85, to: 0.92, color: '#F2A83B' },
    { from: 0.92, to: 1.0, color: '#2FD9C6' }
  ];

  const toAngle = (fp) => 180 - ((fp - 0.5) / 0.5) * 180;
  const point = (angleDeg, radius) => {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy - radius * Math.sin(rad) };
  };

  let arcsHTML = '';
  zones.forEach(z => {
    const p1 = point(toAngle(z.from), r);
    const p2 = point(toAngle(z.to), r);
    arcsHTML += `<path d="M ${p1.x} ${p1.y} A ${r} ${r} 0 0 1 ${p2.x} ${p2.y}" stroke="${z.color}" stroke-width="14" fill="none" stroke-linecap="butt" opacity="0.85"/>`;
  });

  svg.innerHTML = `
    ${arcsHTML}
    <line id="dialNeedle" x1="${cx}" y1="${cy}" x2="${cx - r * 0.8}" y2="${cy}" stroke="#E7EDF3" stroke-width="3" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="7" fill="#E7EDF3"/>
    <text x="${cx - r}" y="${cy + 22}" fill="#4E5A66" font-size="11" font-family="JetBrains Mono">0,50</text>
    <text x="${cx + r - 24}" y="${cy + 22}" fill="#4E5A66" font-size="11" font-family="JetBrains Mono">1,00</text>
  `;
}

function updateDial(fp) {
  const cx = 120, cy = 130, r = 100;
  const angle = 180 - ((Math.max(0.5, Math.min(1, fp)) - 0.5) / 0.5) * 180;
  const rad = (angle * Math.PI) / 180;
  const x2 = cx + r * 0.8 * Math.cos(rad);
  const y2 = cy - r * 0.8 * Math.sin(rad);
  const needle = document.getElementById('dialNeedle');
  needle.setAttribute('x2', x2);
  needle.setAttribute('y2', y2);

  const status = document.getElementById('fpStatus');
  status.textContent = `${fp.toFixed(2)} — ${fp < ANEEL_MIN_FP ? 'abaixo do limite ANEEL' : 'dentro do limite ANEEL'}`;
  status.classList.remove('ok', 'warn');
  status.classList.add(fp < ANEEL_MIN_FP ? 'warn' : 'ok');
}

function buildFPChart() {
  if (!chartLibAvailable()) { showChartUnavailable('chartFP'); return; }
  const ctx = document.getElementById('chartFP').getContext('2d');
  fpChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Fator de potência atual', 'Mínimo ANEEL', 'Alvo do banco de capacitores'],
      datasets: [{
        label: 'cos φ',
        data: [0.81, ANEEL_MIN_FP, 0.95],
        backgroundColor: ['#E5535A', '#F2A83B', '#2FD9C6'],
        borderRadius: 6
      }]
    },
    options: { ...chartBaseOptions('cos φ'), indexAxis: 'y', scales: { x: { min: 0.5, max: 1, ticks: { color: '#4E5A66' }, grid: { color: '#1C2733' } }, y: { ticks: { color: '#7E8B99' }, grid: { display: false } } } }
  });
}

function updateFPChart(fp) {
  if (!fpChart) return;
  fpChart.data.datasets[0].data[0] = Number(fp.toFixed(3));
  fpChart.data.datasets[0].backgroundColor[0] = fp < ANEEL_MIN_FP ? '#E5535A' : '#2FD9C6';
  fpChart.update('none');
}

/* ---------------------------------------------------------
   Caso 2 — Demanda contratada
   --------------------------------------------------------- */
// Curva-base de demanda de um supermercado (kW) ao longo de 24h,
// com pico no horário de ponta (18h–21h), conforme o TCC.
const BASE_DEMAND_CURVE = [
  70, 65, 62, 60, 60, 65,     // 00h-05h
  80, 100, 120, 130, 135, 140, // 06h-11h
  145, 150, 155, 150, 145, 150, // 12h-17h
  175, 185, 180, 165, 120, 90   // 18h-23h
];
const PENALTY_TARIFF = 41; // R$/kW de ultrapassagem — valor ilustrativo

let demandChart;
let playTimer = null;

function initCaso2() {
  const contractedInput = document.getElementById('contractedDemand');
  const autoManage = document.getElementById('autoManage');
  const playBtn = document.getElementById('playDay');

  buildDemandChart();

  contractedInput.addEventListener('input', () => {
    document.getElementById('contractedDemandVal').textContent = contractedInput.value;
    updateCaso2();
  });
  autoManage.addEventListener('change', () => {
    document.getElementById('autoManageState').textContent = autoManage.checked ? 'Ligado' : 'Desligado';
    updateCaso2();
  });
  playBtn.addEventListener('click', playDaySimulation);

  updateCaso2();
}

function computeEffectiveCurve(contracted, autoOn) {
  return BASE_DEMAND_CURVE.map(v => {
    if (autoOn && v > contracted) {
      return contracted - (1 + Math.random() * 3);
    }
    return v;
  });
}

function updateCaso2(revealUpTo = 24) {
  const contracted = Number(document.getElementById('contractedDemand').value);
  const autoOn = document.getElementById('autoManage').checked;
  const curve = computeEffectiveCurve(contracted, autoOn);

  const visibleCurve = curve.map((v, i) => (i < revealUpTo ? v : null));

  let peak = -Infinity, peakHour = 0, hoursOver = 0;
  curve.forEach((v, i) => {
    if (i < revealUpTo) {
      if (v > peak) { peak = v; peakHour = i; }
      if (v > contracted) hoursOver++;
    }
  });

  const penalty = hoursOver > 0 ? (peak - contracted) * PENALTY_TARIFF : 0;

  const hourLabel = document.getElementById('c2CurrentHour');
  hourLabel.textContent = revealUpTo >= 24
    ? '24h (dia completo)'
    : `${String(revealUpTo).padStart(2, '0')}:00`;

  document.getElementById('c2Peak').textContent = `${peak.toFixed(0)} kW`;
  document.getElementById('c2PeakHour').textContent = `${String(peakHour).padStart(2, '0')}:00`;
  document.getElementById('c2HoursOver').textContent = `${hoursOver} h`;
  document.getElementById('c2Cost').textContent = penalty > 0
    ? `≈ R$ ${penalty.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
    : 'R$ 0 (sem ultrapassagem)';

  document.getElementById('c2Hint').textContent = autoOn
    ? 'Gerenciamento preditivo ativo: o SGE antecipa o crescimento da carga e aciona alívio de demanda antes da ultrapassagem contratual.'
    : hoursOver > 0
      ? 'Sem gerenciamento automático, a instalação ultrapassa a demanda contratada nos horários de ponta, gerando penalidade.'
      : 'Demanda contratada compatível com o perfil de consumo atual — sem ultrapassagem.';

  if (demandChart) {
    demandChart.data.datasets[0].data = visibleCurve;
    demandChart.data.datasets[0].pointBackgroundColor = curve.map(v => v > contracted ? '#E5535A' : '#2FD9C6');
    demandChart.data.datasets[1].data = BASE_DEMAND_CURVE.map(() => contracted);
    demandChart.update('none');
  }
}

function buildDemandChart() {
  if (!chartLibAvailable()) { showChartUnavailable('chartDemand'); return; }
  const ctx = document.getElementById('chartDemand').getContext('2d');
  demandChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: BASE_DEMAND_CURVE.map((_, i) => `${String(i).padStart(2, '0')}h`),
      datasets: [
        {
          label: 'Demanda real (kW)',
          data: [],
          borderColor: '#2FD9C6',
          backgroundColor: 'rgba(47,217,198,0.10)',
          pointBackgroundColor: '#2FD9C6',
          pointRadius: 3,
          fill: true,
          tension: 0.3,
          borderWidth: 2
        },
        {
          label: 'Demanda contratada (kW)',
          data: [],
          borderColor: '#F2A83B',
          borderDash: [6, 4],
          pointRadius: 0,
          borderWidth: 2,
          fill: false
        }
      ]
    },
    options: chartBaseOptions('kW')
  });
}

function playDaySimulation() {
  if (playTimer) return;
  const btn = document.getElementById('playDay');
  btn.disabled = true;
  btn.textContent = '▶ Reproduzindo…';

  let hour = 0;
  updateCaso2(0);
  playTimer = setInterval(() => {
    hour++;
    updateCaso2(hour);
    if (hour >= 24) {
      clearInterval(playTimer);
      playTimer = null;
      btn.disabled = false;
      btn.textContent = '▶ Reproduzir dia (24h)';
    }
  }, 220);
}
