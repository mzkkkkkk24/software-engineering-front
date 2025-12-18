// admin.js - 本地测试版：直接使用代码内定义的数据（无任何网络请求）

// 强制模拟管理员登录（直接打开就能进后台）
localStorage.setItem('token', 'mock-admin-token');
localStorage.setItem('userInfo', JSON.stringify({
  id: 1,
  username: 'admin',
  nickname: '超级管理员',
  role: 'ADMIN',
  avatar: ''
}));

// 你原来的模拟用户数据（保持不变）
const mockUsers = [
  { id: 1, username: 'admin', nickname: '超级管理员', avatar: '', createTime: '2025-01-01T00:00:00', postCount: 15 },
  { id: 2, username: 'zhang3', nickname: '张三', avatar: '', createTime: '2025-03-15T12:00:00', postCount: 42 },
  { id: 3, username: 'lisi', nickname: '李四', avatar: '', createTime: '2025-05-20T08:00:00', postCount: 8 },
  { id: 4, username: 'wangwu', nickname: null, avatar: '', createTime: '2025-07-10T15:00:00', postCount: 23 },
  { id: 5, username: 'zhao6', nickname: '赵六', avatar: '', createTime: '2025-09-01T09:00:00', postCount: 67 },
  ...Array.from({ length: 45 }, (_, i) => ({
    id: 6 + i,
    username: `user${6 + i}`,
    nickname: `用户${6 + i}`,
    avatar: '',
    createTime: `2025-10-${String((i % 30) + 1).padStart(2, '0')}T12:00:00`,
    postCount: Math.floor(Math.random() * 100)
  }))
];

// 你原来的模拟内容数据（保持不变）
const mockContents = [
  { id: 101, userId: 2, username: 'zhang3', nickname: '张三', avatar: '', text: '今天天气真好～', type: 'TEXT', mediaUrls: [], createTime: '2025-12-17T14:30:00' },
  { id: 102, userId: 3, username: 'lisi', nickname: '李四', avatar: '', text: '分享几张海边照片', type: 'IMAGE', mediaUrls: [
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
    'https://images.unsplash.com/photo-1519046906213-6a031ca82812?w=800'
  ], createTime: '2025-12-16T10:20:00' },
  { id: 103, userId: 5, username: 'zhao6', nickname: '赵六', avatar: '', text: '周末自驾游小视频', type: 'VIDEO', mediaUrls: [
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
  ], createTime: '2025-12-15T18:45:00' },
  ...Array.from({ length: 67 }, (_, i) => ({
    id: 104 + i,
    userId: 1 + (i % 5),
    username: `user${1 + (i % 5)}`,
    nickname: `用户${1 + (i % 5)}`,
    avatar: '',
    text: `测试内容 ${104 + i}`,
    type: ['TEXT', 'IMAGE', 'VIDEO'][i % 3],
    mediaUrls: i % 3 === 1 ? ['https://images.unsplash.com/photo-1682695796799-2df95c99c0f9?w=800'] :
               i % 3 === 2 ? ['https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4'] : [],
    createTime: `2025-12-${String(14 - (i % 14)).padStart(2, '0')}T12:00:00`
  }))
];

// Toast 提示（你原来的中央弹窗）
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

let userPage = 1;
let contentPage = 1;
const pageSize = 10;

document.addEventListener('DOMContentLoaded', async () => {
  // 权限检查（已强制登录，一定通过）
  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  if (userInfo.role !== 'ADMIN') {
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
    });
  });

  // 默认加载用户管理
  loadUsers();

  // 搜索（实时输入 + 按钮点击）
  document.getElementById('userSearch').addEventListener('input', debounce(() => { userPage = 1; loadUsers(); }, 500));
  document.getElementById('contentSearch').addEventListener('input', debounce(() => { contentPage = 1; loadContents(); }, 500));

  document.getElementById('userSearchBtn').addEventListener('click', () => { userPage = 1; loadUsers(); });
  document.getElementById('contentSearchBtn').addEventListener('click', () => { contentPage = 1; loadContents(); });
});

function debounce(fn, delay) {
  let timer;
  return function () {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, arguments), delay);
  };
}

// ================ 直接使用本地数据加载用户（不再发请求） ================
function loadUsers() {
  const keyword = document.getElementById('userSearch').value.trim().toLowerCase();
  const tbody = document.querySelector('#usersTable tbody');
  tbody.innerHTML = '<tr><td colspan="6">加载中...</td></tr>';

  // 过滤
  let filtered = mockUsers.filter(u =>
    u.username.toLowerCase().includes(keyword) ||
    (u.nickname && u.nickname.toLowerCase().includes(keyword))
  );

  const total = filtered.length;
  const pages = Math.ceil(total / pageSize);
  const records = filtered.slice((userPage - 1) * pageSize, userPage * pageSize);

  renderUsers(records);
  renderPagination('usersPagination', userPage, pages, (p) => { userPage = p; loadUsers(); });
}

// ================ 直接使用本地数据加载内容 ================
function loadContents() {
  const keyword = document.getElementById('contentSearch').value.trim().toLowerCase();
  const container = document.getElementById('contentsList');
  container.innerHTML = '<div style="text-align:center;padding:3rem;">加载中...</div>';

  let filtered = mockContents.filter(c =>
    c.text.toLowerCase().includes(keyword) ||
    c.username.toLowerCase().includes(keyword) ||
    (c.nickname && c.nickname.toLowerCase().includes(keyword))
  );

  const total = filtered.length;
  const pages = Math.ceil(total / pageSize);
  const records = filtered.slice((contentPage - 1) * pageSize, contentPage * pageSize);

  renderContents(records);
  renderPagination('contentsPagination', contentPage, pages, (p) => { contentPage = p; loadContents(); });
}

function renderUsers(users) {
  const tbody = document.querySelector('#usersTable tbody');
  tbody.innerHTML = '';

  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6">暂无数据</td></tr>';
    return;
  }

  users.forEach(user => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <!-- 可点击头像，跳转到个人主页 -->
      <td style="cursor: pointer;" onclick="window.location.href='../user-detail/user-detail.html?userId=${user.id}'">
        <img src="${user.avatar || '../../common/images/avatar-default.png'}" alt="头像" style="width:40px;height:40px;border-radius:50%;">
      </td>
      <td>${user.username}</td>
      <td>${user.nickname || '-'}</td>
      <td>${new Date(user.createTime).toLocaleString()}</td>
      <td>${user.postCount || 0}</td>
      <td><button class="delete-btn" data-id="${user.id}">删除用户</button></td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll('#usersTable .delete-btn').forEach(btn => {
    btn.onclick = () => {
      if (confirm('确定删除该用户吗？')) {
        showToast('本地测试：删除成功（数据未真实删除）', 'success');
        loadUsers(); // 刷新显示
      }
    };
  });
}

function renderContents(contents) {
  const container = document.getElementById('contentsList');
  container.innerHTML = '';

  if (contents.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:3rem;">暂无内容</div>';
    return;
  }

  contents.forEach(c => {
    const card = document.createElement('div');
    card.className = 'content-card';
    card.innerHTML = `
      <div class="header">
        <img src="${c.avatar || '../../common/images/avatar-default.png'}" alt="${c.username}">
        <div>
          <strong>${c.nickname || c.username}</strong><br>
          <small>${new Date(c.createTime).toLocaleString()}</small>
        </div>
      </div>
      <div class="body">
        <p>${c.text || ''}</p>
        ${c.type === 'IMAGE' ? (c.mediaUrls || []).map(url => `<img src="${url}" class="media">`).join('') : ''}
        ${c.type === 'VIDEO' ? `<video src="${c.mediaUrls?.[0] || ''}" controls class="media"></video>` : ''}
      </div>
      <div class="footer">
        <span>ID: ${c.id}</span>
        <button class="delete-btn" data-id="${c.id}">删除内容</button>
      </div>
    `;
    container.appendChild(card);
  });

  document.querySelectorAll('#contentsList .delete-btn').forEach(btn => {
    btn.onclick = () => {
      if (confirm('确定删除该内容吗？')) {
        showToast('本地测试：删除成功（数据未真实删除）', 'success');
        loadContents();
      }
    };
  });
}

function renderPagination(containerId, current, total, onPageChange) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  if (total <= 1) return;

  const prev = document.createElement('button');
  prev.textContent = '上一页';
  prev.disabled = current === 1;
  prev.onclick = () => onPageChange(current - 1);
  container.appendChild(prev);

  const start = Math.max(1, current - 3);
  const end = Math.min(total, current + 3);

  for (let i = start; i <= end; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    btn.classList.toggle('active', i === current);
    btn.onclick = () => onPageChange(i);
    container.appendChild(btn);
  }

  const next = document.createElement('button');
  next.textContent = '下一页';
  next.disabled = current === total;
  next.onclick = () => onPageChange(current + 1);
  container.appendChild(next);
}