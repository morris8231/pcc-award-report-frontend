// main.js
// 放置在 pcc-award-report-frontend 專案中，與 index.html 同目錄

const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const btnGenerate = document.getElementById('btnGenerate');
const progressSection = document.getElementById('progressSection');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const historyList = document.getElementById('historyList');

// 請將此網址改成你的 Render 後端網址
const API_BASE = 'https://pcc-award-report-backend.onrender.com';

let chart = null;
let eventSource = null;

window.addEventListener('DOMContentLoaded', () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  startDateInput.max = todayStr;
  endDateInput.max = todayStr;
  if (!endDateInput.value) endDateInput.value = todayStr;

  fetchHistory();
});

btnGenerate.addEventListener('click', async () => {
  const startDate = startDateInput.value;
  const endDate = endDateInput.value;

  if (!startDate || !endDate) return alert('請選擇開始與結束日期');
  if (new Date(startDate) > new Date(endDate)) return alert('開始日期不可晚於結束日期');

  btnGenerate.disabled = true;
  progressSection.classList.remove('hidden');
  progressBar.style.width = '0%';
  progressText.textContent = '準備開始…';

  if (chart) chart.destroy();
  const ctx = document.getElementById('progressChart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'bar',
    data: { labels: [], datasets: [{ label: '各檔案讀取筆數', data: [] }] },
    options: { responsive: true, scales: { y: { beginAtZero: true } } }
  });

  startListeningProgress();

  try {
    const res = await fetch(`${API_BASE}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate, endDate })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || '產生報表失敗');
  } catch (e) {
    stopListeningProgress();
    btnGenerate.disabled = false;
    alert(e.message || '產生報表失敗');
  }
});

function startListeningProgress() {
  stopListeningProgress();
  eventSource = new EventSource(`${API_BASE}/progress`);
  eventSource.onmessage = (e) => {
    const data = JSON.parse(e.data);

    const percent = Number.isFinite(data.percent) ? data.percent : 0;
    progressBar.style.width = `${percent}%`;

    const msg = data.message ? `（${data.message}）` : '';
    progressText.textContent = `已處理 ${data.current} / ${data.total} 份資料（${percent}%）${msg}`;

    if (chart) {
      chart.data.labels = data.labels || [];
      chart.data.datasets[0].data = data.counts || [];
      chart.update();
    }

    if (data.complete) {
      stopListeningProgress();
      btnGenerate.disabled = false;
      fetchHistory();
    }
  };
  eventSource.onerror = () => {
    stopListeningProgress();
    btnGenerate.disabled = false;
    progressText.textContent = 'SSE 連線中斷，請重試。';
  };
}

function stopListeningProgress() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}

async function fetchHistory() {
  historyList.innerHTML = '';
  try {
    const res = await fetch(`${API_BASE}/history`);
    const history = await res.json();
    if (!Array.isArray(history) || history.length === 0) {
      historyList.innerHTML = '<li>暫無歷史報表</li>';
      return;
    }
    history.forEach(item => {
      const li = document.createElement('li');
      const a1 = document.createElement('a');
      a1.href = `${API_BASE}/download/${encodeURIComponent(item.file)}`;
      a1.textContent = `${item.file}（Summary ${item.summaryCount} / Raw ${item.rawCount}）`;
      li.appendChild(a1);
      historyList.appendChild(li);
    });
  } catch {
    historyList.innerHTML = '<li>載入失敗</li>';
  }
}
