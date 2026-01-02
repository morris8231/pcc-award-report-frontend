// 動態決定 API_BASE：GitHub Pages 時使用 Render 的後端，否則用同源
const isGithubPages = location.hostname.endsWith('github.io');
const API_BASE = isGithubPages ? 'https://pcc-award-report-backend.onrender.com' : '';

// DOM 參考
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const btnGenerate = document.getElementById('btnGenerate');
const progressSection = document.getElementById('progressSection');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const historyList = document.getElementById('historyList');

// 初始化日期（預設過去一個月）
(function initDates() {
  const now = new Date();
  const endDateStr = now.toISOString().split('T')[0];
  const prior = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  const startDateStr = prior.toISOString().split('T')[0];
  startDateInput.value = startDateStr;
  endDateInput.value = endDateStr;
})();

// 取得歷史報表
async function loadHistory() {
  historyList.innerHTML = '';
  try {
    const res = await fetch(`${API_BASE}/history`);
    const items = await res.json();
    items.forEach(item => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `${API_BASE}/download/${encodeURIComponent(item.file)}`;
      a.textContent = item.file;
      li.textContent = `${item.file} (Summary ${item.summaryCount} / Raw ${item.rawCount}) `;
      li.appendChild(a);
      historyList.appendChild(li);
    });
  } catch {
    const li = document.createElement('li');
    li.textContent = '載入歷史報表失敗。';
    historyList.appendChild(li);
  }
}
loadHistory();

// SSE 監聽進度
let evtSource;
function startListeningProgress() {
  if (evtSource) {
    evtSource.close();
  }
  evtSource = new EventSource(`${API_BASE}/progress`);
  evtSource.onmessage = function(event) {
    const data = JSON.parse(event.data);
    // 更新進度條與文字
    progressBar.style.width = `${data.percent}%`;
    progressText.textContent = `已處理 ${data.current} / ${data.total} 份資料（${data.percent}%）` +
      (data.complete ? `（完成：${data.reportFile}）` : '');
    // 更新長條圖
    if (window.progressChart) {
      progressChart.data.labels = data.labels;
      progressChart.data.datasets[0].data = data.counts;
      progressChart.update();
    }
    if (data.complete) {
      evtSource.close();
      loadHistory();
    }
  };
  evtSource.onerror = function () {
    evtSource.close();
  };
}

// 初始化圖表
let progressChart;
function initChart() {
  const ctx = document.getElementById('progressChart').getContext('2d');
  progressChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        label: '各檔案讀取筆數',
        data: [],
        backgroundColor: '#3798e4'
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}
initChart();

// 點擊產生報表
btnGenerate.addEventListener('click', async () => {
  const startDate = startDateInput.value;
  const endDate = endDateInput.value;
  if (!startDate || !endDate) return alert('請填寫日期');
  // 重置進度 UI
  progressSection.classList.remove('hidden');
  progressBar.style.width = '0%';
  progressText.textContent = '開始處理…';
  progressChart.data.labels = [];
  progressChart.data.datasets[0].data = [];
  progressChart.update();
  try {
    await fetch(`${API_BASE}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate, endDate })
    });
    startListeningProgress();
  } catch {
    alert('產生報表失敗');
  }
});
