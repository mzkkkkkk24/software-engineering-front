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

// 加载内容列表（分页）
async function loadContents() {
  const keyword = document.getElementById('contentSearch').value.trim();
  const tbody = document.querySelector('#contentsTable tbody');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;">加载中...</td></tr>';

  try {
    const res = await axios.get('/api/admin/contents', {
      params: { page: contentPage, size: pageSize, keyword }
    });

    if (res.data.code === 200) {
      const { records, pages } = res.data.data;
      renderContents(records);
      renderPagination('contentsPagination', contentPage, pages, p => { contentPage = p; loadContents(); });
    } else {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;">暂无数据</td></tr>';
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:red;">加载失败</td></tr>';
    console.error(err);
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