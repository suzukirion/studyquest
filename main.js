function updateClock() {
  const d = new Date();
  const Y = String(d.getFullYear());
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');

  const el = document.getElementById('now');
  if (el) el.textContent = `${Y}/${M}/${D}　${h}:${m}:${s}`;
}

/***** ====== タイマー====== *****/
let timer = null;
let seconds = 0;
let isRunning = false;

function updateDisplay() {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  const el = document.getElementById('display');
  if (el) el.textContent = `${h}h${m}m${s}s`;
}

document.getElementById('start')?.addEventListener('click', () => {
  if (isRunning) return;
  isRunning = true;
  timer = setInterval(() => { seconds++; updateDisplay(); }, 1000);
});

document.getElementById('stop')?.addEventListener('click', () => {
  clearInterval(timer);
  isRunning = false;
});

document.getElementById('reset')?.addEventListener('click', () => {
  clearInterval(timer);
  isRunning = false;
  seconds = 0;
  updateDisplay();
});

/***** ====== ストレージ共通 ====== *****/
const STORAGE_KEY = 'records';

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
}
function ymd(date) {
  return `${date.getFullYear()}/${String(date.getMonth()+1).padStart(2,'0')}/${String(date.getDate()).padStart(2,'0')}`;
}
function normalizeSubject(v){ return (v ?? '').toString().trim(); }

/***** ====== 色（科目→色） ====== *****/
const SUBJECT_COLORS = ['#7363ff','#52ab2e','#ff6c5b','#4bc0c0','#9966ff','#ff9f40'];
const subjectColorMap = new Map();
function getColorForSubject(sub) {
  if (!subjectColorMap.has(sub)) {
    subjectColorMap.set(sub, SUBJECT_COLORS[subjectColorMap.size % SUBJECT_COLORS.length]);
  }
  return subjectColorMap.get(sub);
}

/***** ====== 保存：レコード追加 → 各グラフ更新 ====== *****/
document.getElementById('save')?.addEventListener('click', () => {
  const subject = normalizeSubject(document.getElementById('subject')?.value);
  if (!subject) return alert('科目を入れてね！');

  const rec = { date: getToday(), subject, time: seconds };
  const records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  records.push(rec);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));

  // 画面更新
  updateDonutChart();
  updateWeeklyBarChart();
  updateMonthViewIfOn();

  // 軽いフィードバック
  alert('保存しました！おつかれさま！');
});

/***** ====== 円グラフ（今日） ====== *****/
let donutChart;

function initDonutChart() {
  const ctx = document.getElementById('chartDonut')?.getContext('2d');
  if (!ctx) return;
  donutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ["未分類"],
      datasets: [{ data: [1], backgroundColor: ['rgba(255,255,255,0.4)'], borderWidth: 0 }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { enabled: false } }
    }
  });
}

function updateDonutChart() {
  if (!donutChart) return;
  const records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const today = getToday();
  const todayRecs = records.filter(r => r.date === today);

  if (todayRecs.length === 0) {
    donutChart.data.labels = ['未分類'];
    donutChart.data.datasets[0].data = [1];
    donutChart.data.datasets[0].backgroundColor = ['rgba(255,255,255,0.4)'];
    donutChart.update();
    return;
  }

  const bySub = {};
  todayRecs.forEach(r => bySub[r.subject] = (bySub[r.subject] || 0) + r.time);

  const labels = Object.keys(bySub);
  const mins   = Object.values(bySub).map(sec => Math.round(sec/60));
  const colors = labels.map(getColorForSubject);

  donutChart.data.labels = labels;
  donutChart.data.datasets[0].data = mins;
  donutChart.data.datasets[0].backgroundColor = colors;
  donutChart.update();

  const msgEl = document.getElementById('donutMessage');

  if (todayRecs.length === 0) {
  if (msgEl) msgEl.style.display = 'block';
  return;}
  else {
  if (msgEl) msgEl.style.display = 'none';
  }
}


/***** ====== 週グラフ（直近7日・積み上げ） ====== *****/
let barChart;

function buildWeeklyStackData() {
  const records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

  // ラベル（直近7日）
  const labels = [];
  const days = [];
  for (let i=6; i>=0; i--){
    const d = new Date(); d.setDate(d.getDate()-i);
    labels.push(`${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`);
    days.push(ymd(d));
  }

  // 科目一覧
  const subjects = Array.from(new Set(records.map(r => r.subject)));

  const datasets = subjects.map(sub => {
    const data = days.map(day => {
      const totalSec = records
        .filter(r => r.date === day && r.subject === sub)
        .reduce((a,b)=>a+b.time, 0);
      return Math.round(totalSec/60);
    });
    return {
      label: sub,
      data,
      backgroundColor: getColorForSubject(sub),
      borderWidth: 0,
      stack: 'time'
    };
  });

  return { labels, datasets };
}

function initWeeklyBarChart() {
  const ctx = document.getElementById('chartBars')?.getContext('2d');
  if (!ctx) return;
  const { labels, datasets } = buildWeeklyStackData();
  barChart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            footer: (items) => {
              const sum = items.reduce((a,b)=> a + b.parsed.y, 0);
              const h = Math.floor(sum/60), m = sum%60;
              return `合計: ${h}h ${m}m`;
            }
          }
        }
      },
      scales: {
        x: { stacked: true },
        y: { stacked: true, title: { display: true, text: '分' } }
      }
    }
  });
}

function updateWeeklyBarChart() {
  if (!barChart) return;
  const { labels, datasets } = buildWeeklyStackData();
  barChart.data.labels = labels;
  barChart.data.datasets = datasets;
  barChart.update();
}

/***** ====== 月カレンダー ====== *****/
let currentMonth = new Date(); // 表示中の月

function calcMonthMap(dateAnyInMonth = currentMonth) {
  const records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const y = dateAnyInMonth.getFullYear();
  const m = dateAnyInMonth.getMonth();

  const first = new Date(y, m, 1);
  const last  = new Date(y, m+1, 0);
  const dim   = last.getDate();

  const map = {};
  for (let d=1; d<=dim; d++){
    const key = `${y}/${String(m+1).padStart(2,'0')}/${String(d).padStart(2,'0')}`;
    map[key] = { total: 0, bySubject: {} };
  }

  records.forEach(r => {
    // 対象月だけ集計
    const [yy,mm] = r.date.split('/').map(Number);
    if (yy !== y || mm !== (m+1)) return;
    const mins = Math.round(r.time/60);
    const ent = map[r.date];
    if (!ent) return;
    ent.total += mins;
    ent.bySubject[r.subject] = (ent.bySubject[r.subject] || 0) + mins;
  });

  return map;
}

function renderCalendar() {
  console.log('renderCalendar called');
  const monthView = document.getElementById('monthView');
  if (!monthView) return;

  const y = currentMonth.getFullYear();
  const m = currentMonth.getMonth();
  const titleEl = document.getElementById('calTitle');
  if (titleEl) titleEl.textContent = `${y}年 ${m + 1}月`;
  // document.getElementById('calTitle')?.textContent = `${y}年 ${m+1}月`;

  const map = calcMonthMap();
  const grid = document.getElementById('calGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const first = new Date(y, m, 1);
  const last  = new Date(y, m+1, 0);
  const dim   = last.getDate();
  const padL  = (first.getDay()+6)%7;
  const totalCells = padL + dim;
  const padR  = (7 - (totalCells % 7)) % 7;

  // 頭の空白
  for (let i=0; i<padL; i++){
    const cell = document.createElement('div');
    cell.className = 'cal-cell is-dim';
    grid.appendChild(cell);
  }

  // 日付セル
  for (let d=1; d<=dim; d++){
    const key = `${y}/${String(m+1).padStart(2,'0')}/${String(d).padStart(2,'0')}`;
    const info = map[key] || { total:0, bySubject:{} };

    const cell = document.createElement('div');
    cell.className = 'cal-cell';
    cell.innerHTML = `<span class="date">${d}</span>`;

    // 背景の濃さ（簡易ヒートマップ）
    const maxMin = Math.max(...Object.values(map).map(v=>v.total), 0);
    if (maxMin > 0 && info.total > 0) {
      const light = 0.15 + 0.85*(info.total/maxMin);
      cell.style.backgroundColor = `rgba(255,165,0,${light.toFixed(2)})`;
    }

    // ホバー/クリックで内訳表示（ツールチップ簡易）
    cell.addEventListener('click', () => {
      const tip = document.createElement('div');
      tip.className = 'cal-tip';
      const lines = Object.entries(info.bySubject)
        .sort((a,b)=>b[1]-a[1])
        .map(([s,v]) => `${s}: ${Math.floor(v/60)}h ${v%60}m`);
      const totalTxt = `合計: ${Math.floor(info.total/60)}h ${info.total%60}m`;
      tip.innerHTML = `<b>${key}</b><br>${totalTxt}<br>${lines.join('<br>')}`;
      cell.appendChild(tip);
    });

    grid.appendChild(cell);
  }

  // 末尾の空白
  for (let i=0; i<padR; i++){
    const cell = document.createElement('div');
    cell.className = 'cal-cell is-dim';
    grid.appendChild(cell);
  }
}

/***** ====== 週／月トグル ====== *****/
function setupToggle() {
  const segWeek = document.getElementById('segWeek');
  const segMonth = document.getElementById('segMonth');
  const cvsWeek = document.getElementById('chartBars'); 
  const monthView = document.getElementById('monthView'); 
  const metricsCard = document.getElementById('metricsCard'); 

  if (!segWeek || !segMonth || !cvsWeek || !monthView) {
    console.warn('toggle elements not found', { segWeek, segMonth, cvsWeek, monthView });
    return;
  }

  const showWeek = () => {
    segWeek.classList.add('is-active');
    segMonth.classList.remove('is-active');

    // 表示
    cvsWeek.style.display = 'block';
    monthView.style.display = 'none';

    // （任意）カードに状態クラス付けたいなら
    if (metricsCard) metricsCard.classList.remove('is-month');
  };

  const showMonth = () => {
    segMonth.classList.add('is-active');
    segWeek.classList.remove('is-active');

    // 表示
    cvsWeek.style.display = 'none';
    monthView.style.display = 'block';

    if (metricsCard) metricsCard.classList.add('is-month');

    // 月表示に切り替えた瞬間に描画（これ大事）
    renderCalendar();
  };

  // 初期状態（週表示から開始）
  showWeek();

  segWeek.addEventListener('click', showWeek);
  segMonth.addEventListener('click', showMonth);
}


// 月表示中に保存したら再描画
function updateMonthViewIfOn() {
  const monthvw = document.getElementById('monthView');
  if (monthvw && !monthvw.hidden) renderCalendar();
}

/***** ====== 月移動ボタン ====== *****/
document.getElementById('prevMonth')?.addEventListener('click', () => {
  currentMonth.setMonth(currentMonth.getMonth()-1);
  renderCalendar();
});
document.getElementById('nextMonth')?.addEventListener('click', () => {
  currentMonth.setMonth(currentMonth.getMonth()+1);
  renderCalendar();
});

/***** ====== 起動順（超重要） ====== *****/
window.addEventListener('DOMContentLoaded', () => {
  // 1) 円グラフ
  initDonutChart();
  updateDonutChart();

  // 2) 週グラフ
  initWeeklyBarChart();
  updateWeeklyBarChart();

  // 3) 月カレンダー
  renderCalendar();

  // 4) 週／月トグル
  setupToggle();

  // 5) タイマ表示初期化
  updateDisplay();

  // 日付＆時刻を表示して毎秒更新
  updateClock();
  setInterval(updateClock, 1000);

  setupLogin();
  setupLogoutButton();

  renderAuthUI();

  renderLoginPage();

  showFlashMessage();

  applyCustomSettings();
  setupCustomizePage();
});



// コンタクトフォーム
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contactForm");
  if (!form) return;

  const ok = document.getElementById("formOk");

  function setError(id, msg) {
    const el = document.querySelector(`[data-error-for="${id}"]`);
    if (el) el.textContent = msg || "";
  }

  form.addEventListener("submit", (e) => {

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const message = document.getElementById("message").value.trim();

    let hasError = false;
    setError("name", "");
    setError("email", "");
    setError("message", "");

    if (!name) { setError("name", "お名前を入力してください"); hasError = true; }
    if (!email) { setError("email", "メールを入力してください"); hasError = true; }
    if (!message) { setError("message", "内容を入力してください"); hasError = true; }

    if (hasError) return;

    // ✅ デモ送信完了表示（最短で“動いた感”を出す）
    ok.hidden = false;
    form.reset();

    // 3秒後にメッセージ消す（好みで）
    setTimeout(() => { ok.hidden = true; }, 3000);
  });
});

// ログインフォーム
var AUTH_KEY = "sq_isLoggedIn";

// ログイン判定
function isLoggedIn() {
  return sessionStorage.getItem(AUTH_KEY) === "1";
}

// ログイン状態セット
function setLoggedIn() {
  sessionStorage.setItem(AUTH_KEY, "1");
}

// ログアウト
function logout() {
  sessionStorage.removeItem(AUTH_KEY);
  sessionStorage.setItem("flashMessage", "logout");
  location.href = "index.html";
}

function setupLogoutButton() {
  document.addEventListener("click", (e) => {
    if (e.target && e.target.id === "logoutBtn") {
      logout();
    }
  });
}

function showFlashMessage() {
  const flash = sessionStorage.getItem("flashMessage");
  if (flash !== "logout") return;

  const box = document.createElement("div");
  box.className = "flash-message";
  box.textContent = "ログアウトしました！";
  document.body.appendChild(box);

  sessionStorage.removeItem("flashMessage");

  setTimeout(() => {
    box.remove();
  }, 2000);
}

// login.html用：擬似ログイン
function setupLogin() {
  const form = document.getElementById("loginForm");
  if (!form) return;

  const idEl = document.getElementById("loginId");
  const pwEl = document.getElementById("loginPw");
  const okEl = document.getElementById("loginOk");

  // すでにログイン済みなら飛ばす
  if (isLoggedIn()) {
    location.replace = "customize.html";
    return;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const id = idEl.value.trim();
    const pw = pwEl.value.trim();

    // デモ用の固定ID/PW
    const DEMO_ID = "demo";
    const DEMO_PW = "1234";

    if (id !== DEMO_ID || pw !== DEMO_PW) {
      alert("IDまたはパスワードが違います（デモ用）");
      return;
    }

    setLoggedIn();
    okEl.hidden = false;

    setTimeout(() => {
      location.href = "index.html";
    }, 800);
  });
}

// ログイン後表示
function renderAuthUI(){
  const area = document.getElementById("authArea");
  if(!area) return;

  if (isLoggedIn()) {
    area.innerHTML = `
      <span class="status">ログイン中</span>
      <button class="logout-btn" id="logoutBtn" type="button">Logout</button>
    `;
  } else {
    area.innerHTML = "";
  }
}

// ログイン後のログイン画面
function renderLoginPage() {
  const formArea = document.getElementById("loginFormArea");
  const loggedInArea = document.getElementById("loggedInArea");

  if (!formArea || !loggedInArea) return;

  if (isLoggedIn()) {
    formArea.hidden = true;
    loggedInArea.hidden = false;
  } else {
    formArea.hidden = false;
    loggedInArea.hidden = true;
  }
}

// カスタマイズ

const THEME_KEY = "sq_theme";
const CLOCK_KEY = "sq_clock";

function applyCustomSettings() {
  const savedTheme = localStorage.getItem(THEME_KEY) || "blue";
  const savedClock = localStorage.getItem(CLOCK_KEY) || "white";

  document.body.classList.remove("theme-blue", "theme-green", "theme-purple");
  document.body.classList.add(`theme-${savedTheme}`);

  document.body.classList.remove("clock-white", "clock-gold");
  document.body.classList.add(`clock-${savedClock}`);

}

function setupCustomizePage() {
  const themeBtns = document.querySelectorAll(".theme-btn");
  const clockBtns = document.querySelectorAll(".clock-btn");

  if (!themeBtns.length && !clockBtns.length) return;

  themeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const theme = btn.dataset.theme;
      localStorage.setItem(THEME_KEY, theme);
      applyCustomSettings();
      updateSelectedButtons();
    });
  });

  clockBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const clock = btn.dataset.clock;
      localStorage.setItem(CLOCK_KEY, clock);
      applyCustomSettings();
      updateSelectedButtons();
    });
  });

  updateSelectedButtons();
}

function updateSelectedButtons() {
  const savedTheme = localStorage.getItem(THEME_KEY) || "blue";
  const savedClock = localStorage.getItem(CLOCK_KEY) || "white";

  document.querySelectorAll(".theme-btn").forEach((btn) => {
    btn.classList.toggle("is-selected", btn.dataset.theme === savedTheme);
  });

  document.querySelectorAll(".clock-btn").forEach((btn) => {
    btn.classList.toggle("is-selected", btn.dataset.clock === savedClock);
  });
}

