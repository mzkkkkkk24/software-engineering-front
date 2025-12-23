// ===== OPFS 支持（用于管理员查看详情时读取本地视频/图片）=====
const OPFS_PREFIX = 'opfs://';

async function getOPFSRoot() {
  return await navigator.storage.getDirectory();
}

async function getFileUrlFromOPFS(opfsPath) {
  if (!opfsPath || !opfsPath.startsWith(OPFS_PREFIX)) {
    return opfsPath || '../../common/images/placeholder.png';
  }

  try {
    const root = await getOPFSRoot();
    const mediaDir = await root.getDirectoryHandle('media');
    const fileName = opfsPath.replace(OPFS_PREFIX, '');
    const fileHandle = await mediaDir.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return URL.createObjectURL(file);
  } catch (err) {
    console.error('OPFS 读取失败:', err);
    return '../../common/images/placeholder.png';
  }
}

let userPage = 1;
let contentPage = 1;
const pageSize = 10;

function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 3000);
}

document.addEventListener('DOMContentLoaded', async () => {
  // 检查管理员权限
  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  if (!userInfo || userInfo.role !== 'ADMIN') {
    showToast('权限不足，请使用管理员账号登录', 'error');
    setTimeout(() => window.location.href = '../login/login.html', 1500);
    return;
  }


  // 退出登录
  document.getElementById('logoutBtn').onclick = () => {
    if (confirm('确定退出登录？')) {
      localStorage.clear();
      window.location.href = '../login/login.html';
    }
  };

  // 侧边栏切换
  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      document.getElementById(item.dataset.tab + '-tab').classList.add('active');

      if (item.dataset.tab === 'users') {
        userPage = 1;
        loadUsers();
      } else if (item.dataset.tab === 'contents') {
        contentPage = 1;
        loadContents();
      }
      else if (item.dataset.tab === 'stats') {
        loadStats();
      }
    });
  });

  // 默认加载用户管理
  loadUsers();

  // 搜索功能
  const debounce = (fn, delay) => {
    let timer;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(), delay);
    };
  };

  document.getElementById('userSearch').addEventListener('input', debounce(() => { userPage = 1; loadUsers(); }, 500));
  document.getElementById('contentSearch').addEventListener('input', debounce(() => { contentPage = 1; loadContents(); }, 500));

  document.getElementById('userSearchBtn').addEventListener('click', () => { userPage = 1; loadUsers(); });
  document.getElementById('contentSearchBtn').addEventListener('click', () => { contentPage = 1; loadContents(); });
});

// 加载用户列表
async function loadUsers() {
  const keyword = document.getElementById('userSearch').value.trim();
  const tbody = document.querySelector('#usersTable tbody');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;">加载中...</td></tr>';

  try {
    const res = await axios.get('/api/admin/users', {
      params: { page: userPage, size: pageSize, keyword }
    });

    if (res.data.code === 200) {
      const { records, pages } = res.data.data;
      renderUsers(records);
      renderPagination('usersPagination', userPage, pages, p => { userPage = p; loadUsers(); });
    } else {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;">暂无数据</td></tr>';
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:red;">加载失败</td></tr>';
    console.error(err);
  }
}

function renderUsers(users) {
  const tbody = document.querySelector('#usersTable tbody');
  tbody.innerHTML = '';

  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;">暂无用户</td></tr>';
    return;
  }

  users.forEach(user => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="cursor:pointer;" onclick="window.location.href='../user-detail/user-detail.html?userId=${user.id}'">
        <img src="${user.avatar || '../../common/images/test.png'}" alt="头像" style="width:40px;height:40px;border-radius:50%;">
      </td>
      <td>${user.username}</td>
      <td>${user.nickname || '-'}</td>
      <td>${new Date(user.createTime).toLocaleString()}</td>
      <td>${user.postCount || 0}</td>
      <td><button class="delete-btn" data-id="${user.id}">删除用户</button></td>
    `;
    tbody.appendChild(tr);
  });

  // 删除用户
  document.querySelectorAll('#usersTable .delete-btn').forEach(btn => {
    btn.onclick = async () => {
      if (confirm('确定删除该用户吗？此操作不可恢复！')) {
        try {
          await axios.delete(`/api/admin/user/${btn.dataset.id}`);
          showToast('用户已删除', 'success');
          loadUsers();
        } catch (err) {
          showToast(err.response?.data?.message || '删除失败', 'error');
        }
      }
    };
  });
}

let activeUsersChart;
let dailyPostsChart;

async function loadStats() {
  try {
    // 假设后端提供统计/api/admin/stats
    const res = await axios.get('/api/admin/user/active');

    if (res.data.code === 200) {
      const data = res.data.data;

      // 填充卡片
      document.getElementById('totalUsers').textContent = data.totalUsers || 0;
      document.getElementById('todayActive').textContent = data.todayActive || 0;
      document.getElementById('weekActive').textContent = data.weekActive || 0;
      document.getElementById('totalPosts').textContent = data.totalPosts || 0;

      // 渲染图表（销毁旧图表防止重复）
      if (activeUsersChart) activeUsersChart.destroy();
      if (dailyPostsChart) dailyPostsChart.destroy();

      const ctx1 = document.getElementById('activeUsersChart').getContext('2d');
      activeUsersChart = new Chart(ctx1, {
        type: 'line',
        data: {
          labels: data.dailyActive.labels,  // e.g. ['12-15', '12-16', ..., '12-21']
          datasets: [{
            label: '活跃用户数',
            data: data.dailyActive.values,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          scales: { y: { beginAtZero: true } }
        }
      });

      const ctx2 = document.getElementById('dailyPostsChart').getContext('2d');
      dailyPostsChart = new Chart(ctx2, {
        type: 'bar',
        data: {
          labels: data.dailyPosts.labels,
          datasets: [{
            label: '新发布内容数',
            data: data.dailyPosts.values,
            backgroundColor: '#10b981'
          }]
        },
        options: {
          responsive: true,
          scales: { y: { beginAtZero: true } }
        }
      });
    } else {
      showToast('加载统计数据失败', 'error');
    }
  } catch (err) {
    showToast('网络错误，无法加载统计', 'error');
    console.error(err);
  }
}

// 加载内容列表（分页）
async function loadContents() {
  const keyword = document.getElementById('contentSearch').value.trim();
  const tbody = document.querySelector('#contentsTable tbody');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem;">加载中...</td></tr>';

  try {
    const res = await axios.get('/api/content/search', {
      params: {
        keyword,
        page: contentPage,
        size: pageSize,
      }
    });

    if (res.data.code === 200) {
      const { records, pages } = res.data.data;

      renderPagination('contentsPagination', contentPage, pages, p => {
        contentPage = p;
        loadContents();
      });

      if (!records || records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem;">暂无数据</td></tr>';
        return;
      }

      tbody.innerHTML = '';
      records.forEach(content => {

        let mediaTypeText = '文本';  // 默认文本
        if (content.type === 'IMAGE') {
          mediaTypeText = '图片';
        } else if (content.type === 'VIDEO') {
          mediaTypeText = '视频';
        }
        // 文本截断（前30字符）
        const fullText = content.description || content.title || content.text || '(无文本)';
        const shortText = fullText.length > 30 ? fullText.substring(0, 30) + '...' : fullText;

        // 媒体类型文字
        let mediaType = '文本';
        if (content.type === 'IMAGE') mediaType = '图片';
        else if (content.type === 'VIDEO') mediaType = '视频';

        let mediaFileUrl = content.fileUrl || null;

// 不在这里生成 preview HTML，而是存原始路径
let mediaPreview = '<p style="color:#94a3b8;">无媒体</p>';
if (mediaFileUrl) {
  // 仅生成占位，真实内容在打开模态框时异步加载
  if (content.type === 'IMAGE') {
    mediaPreview = `<img src="${mediaFileUrl}" style="max-width:100%; max-height:600px; border-radius:12px;">`; // 图片可直接用（OPFS路径浏览器不认，但后面会替换）
  } else if (content.type === 'VIDEO') {
    mediaPreview = '<div style="width:100%; max-height:600px; background:#000; border-radius:12px; display:flex; align-items:center; justify-content:center; color:#fff;">视频加载中...</div>';
  }
}

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="display:flex; align-items:center; gap:10px;">
            <img src="${content.avatar || '../../common/images/test.png'}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
            <div>
              <strong>${content.nickname || content.username}</strong><br>
              <small style="color:#64748b;">ID: ${content.userId}</small>
            </div>
          </td>
          <td style="max-width:300px;" title="${fullText}">${shortText}</td>
          <td>
            <span style="padding:4px 12px; background:#e0e7ff; color:#4338ca; border-radius:20px; font-size:0.85rem;">
              ${mediaType}
            </span>
          </td>
          <td>${new Date(content.createTime).toLocaleString()}</td>
          <td style="white-space:nowrap;">
            <button class="view-detail-btn" style="margin-right:8px;">查看详情</button>
            <button class="delete-btn" data-id="${content.id}">删除内容</button>
          </td>
        `;

        // 存储数据到按钮
        const viewBtn = tr.querySelector('.view-detail-btn');
        viewBtn.dataset.content = JSON.stringify(content);
        viewBtn.dataset.mediaPreview = mediaPreview;
        viewBtn.dataset.mediaType = mediaTypeText;

        tbody.appendChild(tr);
      });

      // 绑定查看详情事件
      document.querySelectorAll('.view-detail-btn').forEach(btn => {
        btn.onclick = () => {
          const content = JSON.parse(btn.dataset.content);
          const mediaPreview = btn.dataset.mediaPreview;

          document.getElementById('detailAvatar').src = content.avatar || '../../common/images/test.png';
          document.getElementById('detailUsername').textContent = content.nickname || content.username;
          document.getElementById('detailTime').textContent = new Date(content.createTime).toLocaleString();
          document.getElementById('detailText').textContent = content.description || content.title || content.text || '(无文本)';
          document.getElementById('detailId').textContent = content.id;
          document.getElementById('detailType').textContent = mediaType;

          document.getElementById('detailMedia').innerHTML = mediaPreview;

          document.getElementById('contentDetailModal').classList.add('show');
        };
      });

      // 删除按钮事件（保持你原来的逻辑）
      document.querySelectorAll('#contentsTable .delete-btn').forEach(btn => {
        btn.onclick = async () => {
          if (confirm('确定删除这条内容吗？此操作不可恢复！')) {
            try {
              await axios.delete(`/api/admin/content/${btn.dataset.id}`);
              showToast('内容已删除', 'success');
              loadContents();  // 刷新当前页
            } catch (err) {
              showToast(err.response?.data?.message || '删除失败', 'error');
            }
          }
        };
      });

    } else {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem;">暂无数据</td></tr>';
    }
  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem; color:red;">加载失败</td></tr>';
    showToast('加载失败', 'error');
  }
}

function renderContents(contents) {
  const tbody = document.querySelector('#contentsTable tbody');
  tbody.innerHTML = '';

  if (contents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;">暂无内容</td></tr>';
    return;
  }

  contents.forEach(content => {
    const mediaHtml = content.type === 'IMAGE' 
      ? (content.mediaUrls || []).map(url => `<img src="${url}" style="width:80px;height:80px;object-fit:cover;margin:5px;border-radius:8px;">`).join('')
      : content.type === 'VIDEO' 
        ? `<video src="${content.mediaUrls?.[0] || ''}" style="width:150px;height:100px;object-fit:cover;" controls></video>`
        : '无媒体';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="display:flex;align-items:center;gap:10px;">
        <img src="${content.avatar || '../../common/images/test.png'}" style="width:40px;height:40px;border-radius:50%;">
        <div>
          <strong>${content.nickname || content.username}</strong><br>
          <small>ID: ${content.userId}</small>
        </div>
      </td>
      <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;">${content.text || '(无文本)'}</td>
      <td>${mediaHtml}</td>
      <td>${new Date(content.createTime).toLocaleString()}</td>
      <td><button class="delete-btn" data-id="${content.id}">删除内容</button></td>
    `;
    tbody.appendChild(tr);
  });

  // 删除内容（绑定事件）
  document.querySelectorAll('#contentsTable .delete-btn').forEach(btn => {
    btn.onclick = async () => {
      if (confirm('确定删除这条内容吗？此操作不可恢复！')) {
        try {
          await axios.delete(`/api/admin/content/${btn.dataset.id}`);
          showToast('内容已删除', 'success');
          loadContents();  // 刷新当前页
        } catch (err) {
          showToast(err.response?.data?.message || '删除失败', 'error');
        }
      }
    };
  });
}

// 分页组件
function renderPagination(containerId, currentPage, totalPages, onPageChange) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  if (totalPages <= 1) return;

  const prev = document.createElement('button');
  prev.textContent = '上一页';
  prev.disabled = currentPage === 1;
  prev.onclick = () => onPageChange(currentPage - 1);
  container.appendChild(prev);

  const start = Math.max(1, currentPage - 3);
  const end = Math.min(totalPages, currentPage + 3);

  for (let i = start; i <= end; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    btn.classList.toggle('active', i === currentPage);
    btn.onclick = () => onPageChange(i);
    container.appendChild(btn);
  }

  const next = document.createElement('button');
  next.textContent = '下一页';
  next.disabled = currentPage === totalPages;
  next.onclick = () => onPageChange(currentPage + 1);
  container.appendChild(next);
}

// 关闭模态框函数
function closeContentModal() {
  document.getElementById('contentDetailModal').classList.remove('show');
}

// 点击遮罩层关闭
document.getElementById('closeDetailModal')?.addEventListener('click', closeContentModal);

// 点击关闭按钮关闭
document.getElementById('closeDetailModalBtn')?.addEventListener('click', closeContentModal);

// ESC 键关闭（可选，提升体验）
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.getElementById('contentDetailModal').classList.contains('show')) {
    closeContentModal();
  }
});

document.addEventListener('click', async (e) => {  // ← 注意加 async
  const btn = e.target.closest('.view-detail-btn');
  if (!btn) return;

  if (!btn.dataset.content) {
    showToast('内容数据未加载', 'error');
    return;
  }

  const content = JSON.parse(btn.dataset.content);
  const mediaFileUrl = content.fileUrl;
  const mediaTypeText = btn.dataset.mediaType || '文本';

  // 同步填充其他信息
  document.getElementById('detailAvatar').src = content.avatar || '../../common/images/test.png';
  document.getElementById('detailUsername').textContent = content.nickname || content.username;
  document.getElementById('detailTime').textContent = new Date(content.createTime).toLocaleString();
  document.getElementById('detailTitle').textContent = content.title || '(无标题)';
  document.getElementById('detailText').textContent = content.description || '(无正文)';
  document.getElementById('detailId').textContent = content.id;
  document.getElementById('detailType').textContent = mediaTypeText;

  // 异步加载媒体
  const mediaContainer = document.getElementById('detailMedia');
  mediaContainer.innerHTML = '<p style="color:#94a3b8;">媒体加载中...</p>';

  if (mediaFileUrl) {
    const blobUrl = await getFileUrlFromOPFS(mediaFileUrl);

    if (content.type === 'IMAGE') {
      mediaContainer.innerHTML = `<img src="${blobUrl}" style="max-width:100%; max-height:600px; border-radius:12px; object-fit:contain; background:#000;">`;
    } else if (content.type === 'VIDEO') {
      mediaContainer.innerHTML = `
        <video controls preload="metadata" style="max-width:100%; max-height:600px; border-radius:12px; background:#000;">
          <source src="${blobUrl}" type="video/mp4">
          您的浏览器不支持视频播放。
        </video>
      `;
    }
  } else {
    mediaContainer.innerHTML = '<p style="color:#94a3b8;">无媒体文件</p>';
  }

  // 打开模态框
  document.getElementById('contentDetailModal').classList.add('show');
});