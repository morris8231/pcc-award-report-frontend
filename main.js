/* main.js
 * 這份前端腳本負責選取日期、呼叫後端產生報表、即時監聽進度條，以及載入歷史報表列表並提供下載。
 * 修改重點：
 * - 新增 API_BASE 常數，指向部署在 Render 的後端服務。
 * - 所有 fetch/EventSource 路徑改為 `${API_BASE}/xxx`。
 */

const API_BASE = 'https://pcc-award-report-backend.onrender.com';

const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const btnGenerate = document.getElementById('btnGenerate');
const progressSection = document.getElementById('progressSection');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const historyList = document.getElementById('historyList');

let eventSource = null;

/**
 * 初始化進度區域並監聽後端 SSE
 */
function startListeningProgress() {
  // 若已有連線，先關閉
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  // 建立 EventSource 至後端 progress
  eventSource = new EventSource(`${API_BASE}/progress`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (!data) return;

      // 更新進度文字
      progressText.textContent = data.message || `${data.percent}%`;
      // 更新進度條寬度
      progressBar.style.width = `${data.percent}%`;

      // 若已完成，關閉 SSE 連線並更新歷史清單
      if (data.complete) {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        // 加載最新歷史報表
        fetchHistory();
      }
    } catch (e) {
      console.error('解析 progress 資料錯誤：', e);
    }
  };

  eventSource.onerror = (err) => {
    console.error('SSE 連線發生錯誤：', err);
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };
}

/**
 * 從後端取得歷史報表，並建立清單顯示
 */
async function fetchHistory() {
  historyList.innerHTML = '';
  try {
    const res = await fetch(`${API_BASE}/history`);
    if (!res.ok) throw new Error('無法取得歷史紀錄');

    const history = await res.json();
    if (Array.isArray(history) && history.length > 0) {
      history.forEach(item => {
        const listItem = document.createElement('li');
        listItem.className = 'history-item';

        const link = document.createElement('a');
        link.href = '#';
        link.textContent = `${item.file}（Summary ${item.summaryCount} / Raw ${item.rawCount}）`;
        link.addEventListener('click', (e) => {
          e.preventDefault();
          // 開新視窗下載報表
          window.open(`${API_BASE}/download/${encodeURIComponent(item.file)}`, '_blank');
        });

        listItem.appendChild(link);
        historyList.appendChild(listItem);
      });
    } else {
      const empty = document.createElement('li');
      empty.textContent = '尚無歷史報表';
      historyList.appendChild(empty);
    }
  } catch (err) {
    console.error(err);
    const errorItem = document.createElement('li');
    errorItem.textContent = '載入歷史報表失敗';
    historyList.appendChild(errorItem);
  }
}

/**
 * 產生新報表：取日期並呼叫後端 /generate，並顯示進度
 */
async function generateReport() {
  const startDate = startDateInput.value;
  const endDate = endDateInput.value;
  if (!startDate || !endDate) {
    alert('請輸入開始日期和結束日期');
    return;
  }

  // 顯示進度區域
  progressSection.style.display = 'block';
  progressBar.style.width = '0%';
  progressText.textContent = '準備開始…';

  // 監聽後端即時進度
  startListeningProgress();

  try {
    const response = await fetch(`${API_BASE}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate, endDate })
    });

    if (!response.ok) {
      throw new Error(`後端回應錯誤：${response.status}`);
    }
    // 後端在產生中，進度由 SSE 更新，不需要再處理 response body
  } catch (err) {
    console.error(err);
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    progressText.textContent = '產生報表失敗';
    alert('產生報表失敗，請稍後再試');
  }
}

// 綁定按鈕事件與載入初始歷史資料
btnGenerate.addEventListener('click', generateReport);
fetchHistory();
