/* script.js - localStorage based backup demo */

const STORAGE_KEY = 'cloud_backup_demo_files_v1';
const fileInput = document.getElementById('fileInput');
const fileListTbody = document.getElementById('fileList');
const clearAllBtn = document.getElementById('clearAll');
let files = []; // in-memory array
let chart; // Chart.js instance

// Helpers
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024, sizes = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
function getExt(name) {
  const m = name.split('.'); return m.length>1 ? m.pop().toLowerCase() : '';
}

// Storage
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    files = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to parse storage', e);
    files = [];
  }
}
function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
  } catch (e) {
    alert('Không thể lưu vào localStorage (có thể vượt quá giới hạn). Xem console.');
    console.error(e);
  }
}

// File read -> store as dataURL (base64). NOTE: base64 lớn, dùng cho demo/nhỏ
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

// Upload handler
async function handleFiles(fileList) {
  for (const file of Array.from(fileList)) {
    // small check
    if (file.size > 5 * 1024 * 1024) {
      // warn but still allow
      if (!confirm(`${file.name} ~ ${formatBytes(file.size)} - lớn hơn 5MB. Tiếp tục lưu vào demo localStorage?`)) continue;
    }
    const dataUrl = await readFileAsDataURL(file);
    const obj = {
      id: uid(),
      name: file.name,
      type: file.type || getExt(file.name),
      size: file.size,
      dataUrl,
      uploadedAt: new Date().toISOString()
    };
    files.unshift(obj);
    saveToStorage();
    renderList();
    updateChart();
  }
}

// Render list
function renderList() {
  fileListTbody.innerHTML = '';
  for (const f of files) {
    const tr = document.createElement('tr');
    const uploaded = new Date(f.uploadedAt).toLocaleString();
    tr.innerHTML = `
      <td>${f.name}</td>
      <td>${f.type}</td>
      <td>${formatBytes(f.size)}</td>
      <td>${uploaded}</td>
      <td>
        <button data-id="${f.id}" class="download">Download</button>
        <button data-id="${f.id}" class="delete">Delete</button>
      </td>`;
    fileListTbody.appendChild(tr);
  }
}

// Download by triggering anchor with dataUrl
function downloadFile(id) {
  const f = files.find(x => x.id === id);
  if (!f) return;
  const a = document.createElement('a');
  a.href = f.dataUrl;
  a.download = f.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Delete
function deleteFile(id) {
  files = files.filter(x => x.id !== id);
  saveToStorage();
  renderList();
  updateChart();
}

// Clear all
function clearAll() {
  if (!confirm('Xóa toàn bộ file trong demo localStorage?')) return;
  files = [];
  saveToStorage();
  renderList();
  updateChart();
}

// Chart.js: stats by extension
// Gom nhóm theo loại file và tính tổng dung lượng
function buildStats() {
  const map = {};
  for (const f of files) {
    const ext = getExt(f.name) || (f.type ? f.type.split('/')[0] : 'unknown');
    map[ext] = (map[ext] || 0) + f.size; // cộng dồn dung lượng thay vì đếm số lượng
  }
  return { labels: Object.keys(map), data: Object.values(map) };
}

function initChart() {
  const ctx = document.getElementById('typeChart').getContext('2d');

  // Nếu đã có chart thì hủy trước
  if (chart) {
    chart.destroy();
  }

  const stats = buildStats();

  chart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: stats.labels,
      datasets: [{
        data: stats.data,
        backgroundColor: [
          '#ff6384',
          '#36a2eb',
          '#cc65fe',
          '#ffce56',
          '#2ecc71',
          '#e67e22'
        ],
        borderColor: 'black',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom'
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              let value = context.raw;
              let sizeMB = (value / (1024 * 1024)).toFixed(2);
              return `${context.label}: ${sizeMB} MB`;
            }
          }
        }
      }
    }
  });
}

function updateChart() {
  if (!chart) return;
  const s = buildStats();
  chart.data.labels = s.labels;
  chart.data.datasets[0].data = s.data;
  chart.update();
}

// Setup events
document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  initChart();
  renderList();
  updateChart();

  fileInput.addEventListener('change', e => {
    handleFiles(e.target.files).catch(console.error);
    fileInput.value = ''; // reset
  });

  fileListTbody.addEventListener('click', e => {
    if (e.target.matches('.download')) {
      const id = e.target.dataset.id;
      downloadFile(id);
    } else if (e.target.matches('.delete')) {
      const id = e.target.dataset.id;
      deleteFile(id);
    }
  });

  clearAllBtn.addEventListener('click', clearAll);
});
