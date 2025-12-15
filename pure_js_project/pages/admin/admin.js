// admin.js - 完整对接管理员接口

let userPage = 1;
let contentPage = 1;
const pageSize = 10;
let userHasMore = true;
let contentHasMore = true;

document.addEventListener('DOMContentLoaded', async () => {
  // 检查管理员权限
  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  if (!userInfo || userInfo.role !== 'ADMIN') {
    alert('权限不足，请使用管理员账号登录');
    window.location.href = '../login/login.html';
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
    item.addEventListener('click', async () => {
      document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      document.getElementById(item.dataset.tab + '-tab').classList.add('active');

      if (item.dataset.tab === 'users') {
        userPage = 1;
        userHasMore = true;
        await loadUsers();
      } else if (item.dataset.tab === 'contents') {
        contentPage = 1;
        contentHasMore = true;
        await loadContents();
      }
    });
  });

  // 默认加载用户管理
  await loadUsers();

  // 搜索
  document.getElementById('userSearch').addEventListener('input', () => { userPage = 1; loadUsers(); });
  document.getElementById('contentSearch').addEventListener('input', () => { contentPage = 1; loadContents(); });
});

// 加载用户列表
async function loadUsers() {
  const keyword = document.getElementById('userSearch').value.trim();
  const tbody = document.querySelector('#usersTable tbody');
  tbody.innerHTML = '<tr><td colspan="5">加载中...</td></tr>';

  try {
    const res = await axios.get('/api/admin/users', {
      params: { page: userPage, size: pageSize, keyword }
    });

    if (res.data.code === 200) {
      const { records, pages } = res.data.data;
      renderUsers(records);
      userHasMore = userPage < pages;
      userPage++;
      renderPagination('usersPagination', userPage - 1, pages, loadUsers);
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5">加载失败</td></tr>';
    console.error(err);
  }
}

function renderUsers(users) {
  const tbody = document.querySelector('#usersTable tbody');
  tbody.innerHTML = '';

  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">暂无用户</td></tr>';
    return;
  }

  users.forEach(user => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><img src="${user.avatar || '../../common/images/avatar-default.png'}" alt="${user.username}"></td>
      <td>${user.username}</td>
      <td>${user.registerTime || user.createTime}</td>
      <td>${user.postCount || 0}</td>
      <td><button class="delete-btn" data-id="${user.id}">删除用户</button></td>
    `;
    tbody.appendChild(tr);
  });

  // 删除用户
  document.querySelectorAll('#usersTable .delete-btn').forEach(btn => {
    btn.onclick = async () => {
      if (confirm('确定删除该用户及其所有内容？此操作不可恢复！')) {
        try {
          await axios.delete(`/api/admin/user/${btn.dataset.id}`);
          alert('用户已删除');
          loadUsers();
        } catch (err) {
          alert('删除失败：' + (err.response?.data?.message || '未知错误'));
        }
      }
    };
  });
}

// 加载内容列表
async function loadContents() {
  const keyword = document.getElementById('contentSearch').value.trim();
  const container = document.getElementById('contentsList');
  container.innerHTML = '<p style="grid-column:1/-1;text-align:center;">加载中...</p>';

  try {
    const res = await axios.get('/api/admin/contents', {
      params: { page: contentPage, size: pageSize, keyword }
    });

    if (res.data.code === 200) {
      const { records, pages } = res.data.data;
      renderContents(records);
      contentHasMore = contentPage < pages;
      contentPage++;
      renderPagination('contentsPagination', contentPage - 1, pages, loadContents);
    }
  } catch (err) {
    container.innerHTML = '<p style="grid-column:1/-1;text-align:center;">加载失败</p>';
    console.error(err);
  }
}

function renderContents(contents) {
  const container = document.getElementById('contentsList');
  container.innerHTML = '';

  if (contents.length === 0) {
    container.innerHTML = '<p style="grid-column:1/-1;text-align:center;">暂无内容</p>';
    return;
  }

  contents.forEach(content => {
    const card = document.createElement('div');
    card.className = 'content-card';
    card.innerHTML = `
      <div class="header">
        <img src="${content.avatar || '../../common/images/avatar-default.png'}" alt="${content.username}">
        <div>
          <strong>${content.username}</strong><br>
          <small>${content.createTime || content.time}</small>
        </div>
      </div>
      <div class="body">
        <p>${content.text || ''}</p>
        ${content.type === 'IMAGE' ? content.mediaUrls?.map(url => `<img src="${url}" class="media">`).join('') || '' : ''}
        ${content.type === 'VIDEO' ? `<video src="${content.mediaUrls?.[0] || ''}" controls class="media"></video>` : ''}
      </div>
      <div class="footer">
        <span>ID: ${content.id}</span>
        <button class="delete-btn" data-id="${content.id}">删除内容</button>
      </div>
    `;
    container.appendChild(card);
  });

  // 删除内容
  document.querySelectorAll('#contentsList .delete-btn').forEach(btn => {
    btn.onclick = async () => {
      if (confirm('确定删除这条内容吗？')) {
        try {
          await axios.delete(`/api/admin/content/${btn.dataset.id}`);
          alert('内容已删除');
          loadContents();
        } catch (err) {
          alert('删除失败：' + (err.response?.data?.message || '未知错误'));
        }
      }
    };
  });
}

// 简单分页渲染
function renderPagination(containerId, current, total, loadFn) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  if (total <= 1) return;

  const prev = document.createElement('button');
  prev.textContent = '上一页';
  prev.disabled = current === 1;
  prev.onclick = () => { /* 重新加载上一页 */ loadFn(); };
  container.appendChild(prev);

  for (let i = 1; i <= total; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    btn.classList.toggle('active', i === current);
    btn.onclick = () => { /* 跳转指定页 */ };
    container.appendChild(btn);
  }

  const next = document.createElement('button');
  next.textContent = '下一页';
  next.disabled = current === total;
  next.onclick = loadFn;
  container.appendChild(next);
}