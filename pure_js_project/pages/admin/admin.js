// admin.js

// 模拟数据
const mockUsers = [
  { id: 1, username: '张小明', avatar: '../../common/images/avatar-1.png', registerTime: '2024-05-12', postCount: 48 },
  { id: 2, username: '李华', avatar: '../../common/images/avatar-2.png', registerTime: '2024-06-20', postCount: 23 },
  { id: 3, username: '王美食', avatar: '../../common/images/avatar-3.png', registerTime: '2024-03-15', postCount: 89 },
  { id: 4, username: '赵小厨', avatar: '../../common/images/avatar-4.png', registerTime: '2024-08-01', postCount: 12 },
  // 可继续添加
];

const mockContents = [
  { id: 101, userId: 1, username: '张小明', avatar: '../../common/images/avatar-1.png', text: '周末去了湖边露营，风景真的太美了！', mediaUrl: '../../common/images/post-1.jpg', mediaType: 'image', time: '2025-12-10 09:24' },
  { id: 102, userId: 3, username: '王美食', avatar: '../../common/images/avatar-3.png', text: '红烧肉成功！', mediaUrl: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4', mediaType: 'video', time: '2025-12-09 18:36' },
  // 可继续添加
];

let currentUserPage = 1;
let currentContentPage = 1;
const pageSize = 10;

document.addEventListener('DOMContentLoaded', () => {
  // 侧边栏切换
  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      document.getElementById(item.dataset.tab + '-tab').classList.add('active');
      
      if (item.dataset.tab === 'users') renderUsers();
      if (item.dataset.tab === 'contents') renderContents();
    });
  });

  // 默认加载用户管理
  renderUsers();

  // 搜索功能（简单前端过滤）
  document.getElementById('userSearch').addEventListener('input', renderUsers);
  document.getElementById('contentSearch').addEventListener('input', renderContents);
});

// 渲染用户列表
function renderUsers() {
  const keyword = document.getElementById('userSearch').value.toLowerCase();
  const filtered = mockUsers.filter(u => u.username.toLowerCase().includes(keyword));
  
  const tbody = document.querySelector('#usersTable tbody');
  tbody.innerHTML = '';
  
  filtered.forEach(user => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><img src="${user.avatar}" alt="${user.username}"></td>
      <td>${user.username}</td>
      <td>${user.registerTime}</td>
      <td>${user.postCount}</td>
      <td><button class="delete-btn" data-id="${user.id}">删除用户</button></td>
    `;
    tbody.appendChild(tr);
  });

  // 删除用户
  document.querySelectorAll('#usersTable .delete-btn').forEach(btn => {
    btn.onclick = () => {
      if (confirm('确定要删除该用户及其所有内容吗？此操作不可恢复！')) {
        const id = btn.dataset.id;
        // 实际项目：axios.delete(`/api/admin/user/${id}`)
        mockUsers = mockUsers.filter(u => u.id != id);
        mockContents = mockContents.filter(c => c.userId != id);
        alert('用户已删除（模拟）');
        renderUsers();
        renderContents();
      }
    };
  });
}

// 渲染内容列表
function renderContents() {
  const keyword = document.getElementById('contentSearch').value.toLowerCase();
  const filtered = mockContents.filter(c => 
    c.text.toLowerCase().includes(keyword) || 
    c.username.toLowerCase().includes(keyword)
  );

  const container = document.getElementById('contentsList');
  container.innerHTML = '';

  filtered.forEach(content => {
    const card = document.createElement('div');
    card.className = 'content-card';
    card.innerHTML = `
      <div class="header">
        <img src="${content.avatar}" alt="${content.username}">
        <div>
          <strong>${content.username}</strong><br>
          <small>${content.time}</small>
        </div>
      </div>
      <div class="body">
        <p>${content.text}</p>
        ${content.mediaType === 'image' ? `<img src="${content.mediaUrl}" class="media">` : ''}
        ${content.mediaType === 'video' ? `<video src="${content.mediaUrl}" controls class="media"></video>` : ''}
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
    btn.onclick = () => {
      if (confirm('确定要删除这条内容吗？')) {
        const id = btn.dataset.id;
        // 实际项目：axios.delete(`/api/admin/content/${id}`)
        mockContents = mockContents.filter(c => c.id != id);
        alert('内容已删除（模拟）');
        renderContents();
      }
    };
  });
}