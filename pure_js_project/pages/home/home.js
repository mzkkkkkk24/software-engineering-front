let currentPage = 1;
const pageSize = 10;
let hasMore = true;
let currentUser = null; // 当前登录用户

document.addEventListener('DOMContentLoaded', async function() {
  // 检查登录状态
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '../../login/login.html';
    return;
  }

  // 加载用户信息
  await loadCurrentUser();

  // 初始化
  initAnimatedBackground();
  initInteractions();
  loadContentList(true); // 初次加载
});

async function loadCurrentUser() {
  try {
    const res = await axios.get('/api/user/info');
    if (res.data.code === 200) {
      currentUser = res.data.data;
      // 更新头像
      document.querySelector('#userMenuBtn img').src = currentUser.avatar || '../../common/images/avatar-default.png';
    }
  } catch (err) {
    console.error('获取用户信息失败', err);
    if (err.response?.status === 401) {
      localStorage.clear();
      window.location.href = '../../login/login.html';
    }
  }
}

// 加载内容列表（支持分页）
async function loadContentList(isRefresh = false) {
  if (isRefresh) {
    currentPage = 1;
    hasMore = true;
    document.getElementById('contentList').innerHTML = '';
  }

  if (!hasMore) return;

  try {
    const res = await axios.get('/api/content/list', {
      params: { page: currentPage, size: pageSize }
    });

    if (res.data.code === 200) {
      const { records, total, pages } = res.data.data;
      renderContentList(records);

      currentPage++;
      hasMore = currentPage <= pages;
      document.getElementById('loadMoreBtn').style.display = hasMore ? 'block' : 'none';
    }
  } catch (err) {
    console.error('加载内容失败', err);
  }
}

// 渲染内容
function renderContentList(contents) {
  const list = document.getElementById('contentList');

  contents.forEach(content => {
    const item = createContentElement(content);
    list.appendChild(item);
  });
}

function createContentElement(content) {
  const item = document.createElement('div');
  item.className = 'content-item';
  item.dataset.id = content.id;

  const isOwn = currentUser && content.userId === currentUser.id;

  let mediaHtml = '';
  if (content.type === 'IMAGE' && content.mediaUrls?.length) {
    mediaHtml = content.mediaUrls.map(url => 
      `<div class="media-container"><img src="${url}" alt="图片"></div>`
    ).join('');
  } else if (content.type === 'VIDEO' && content.mediaUrls?.length) {
    mediaHtml = `<div class="media-container video-container">
      <video controls><source src="${content.mediaUrls[0]}" type="video/mp4"></video>
    </div>`;
  }

  const actionsHtml = isOwn ? `
    <div class="content-actions own-actions">
      <button class="edit-btn"><i class="fas fa-edit"></i> 编辑</button>
      <button class="delete-btn" data-id="${content.id}"><i class="fas fa-trash"></i> 删除</button>
    </div>` : '';

  item.innerHTML = `
    <div class="content-header">
      <img src="${content.avatar || '../../common/images/avatar-default.png'}" alt="头像" class="clickable-avatar" data-userid="${content.userId}">
      <div class="user-meta">
        <h3 class="username clickable-avatar" data-userid="${content.userId}">${content.nickname || content.username}</h3>
        <p class="post-time">${formatTime(content.createTime)}</p>
      </div>
      ${actionsHtml}
    </div>
    <div class="content-body">
      <p class="content-text">${content.text || ''}</p>
      ${mediaHtml}
      <div class="tags">
        ${content.tags?.map(tag => `<span class="tag">${tag}</span>`).join('') || ''}
      </div>
    </div>
    <div class="content-footer">
      <div class="rating">
        <span class="score">${content.score || '0.0'}</span>
        <div class="stars">${generateStars(content.score || 0)}</div>
      </div>
      <div class="interaction">
        <button class="interact-btn comment-btn">
          <i class="fas fa-comment"></i> 评论 (${content.commentCount || 0})
        </button>
      </div>
    </div>
  `;

  // 点击头像跳转个人主页
  item.querySelectorAll('.clickable-avatar').forEach(el => {
    el.onclick = () => {
      const userId = el.dataset.userid;
      const url = userId == currentUser?.id ? 'current' : userId;
      window.location.href = `../user-detail/user-detail.html?userId=${url}`;
    };
  });

  // 删除内容
  const deleteBtn = item.querySelector('.delete-btn');
  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      if (confirm('确定删除这条内容吗？')) {
        try {
          await axios.delete(`/api/content/${content.id}`);
          item.remove();
          alert('删除成功');
        } catch (err) {
          alert('删除失败：' + (err.response?.data?.message || '未知错误'));
        }
      }
    };
  }

  return item;
}

function generateStars(score) {
  let html = '';
  const full = Math.floor(score);
  const half = score - full >= 0.5;
  for (let i = 0; i < 5; i++) {
    if (i < full) html += '<i class="fas fa-star"></i>';
    else if (i === full && half) html += '<i class="fas fa-star-half-alt"></i>';
    else html += '<i class="far fa-star"></i>';
  }
  return html;
}

function formatTime(timeStr) {
  // 简单格式化，后续可用 dayjs
  const date = new Date(timeStr);
  const now = new Date();
  const diff = now - date;
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  return date.toLocaleDateString();
}

// 发布内容（支持多图上传）
async function handlePostSubmit() {
  const textarea = document.querySelector('.post-modal textarea');
  const tagInput = document.querySelector('.tags-input input');
  const text = textarea.value.trim();
  const tags = tagInput.value.split(',').map(t => t.trim()).filter(Boolean);

  if (!text && selectedFiles.length === 0) {
    alert('请填写内容或上传媒体');
    return;
  }

  const formData = new FormData();
  formData.append('text', text);
  formData.append('type', selectedFiles.length > 0 ? (selectedFiles[0].type.startsWith('video') ? 'VIDEO' : 'IMAGE') : 'TEXT');
  tags.forEach(tag => formData.append('tags', tag));
  selectedFiles.forEach(file => formData.append('files', file));

  try {
    const res = await axios.post('/api/content', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    if (res.data.code === 200) {
      alert('发布成功！');
      closePostModal();
      loadContentList(true); // 刷新列表
    }
  } catch (err) {
    alert('发布失败：' + (err.response?.data?.message || '未知错误'));
  }
}

let selectedFiles = [];

// 初始化交互
function initInteractions() {
  // 发布模态框
  document.getElementById('createPostBtn').onclick = () => {
    document.getElementById('postModal').classList.add('show');
  };

  const closeModal = () => {
    document.getElementById('postModal').classList.remove('show');
    document.querySelector('.post-modal textarea').value = '';
    document.querySelector('.tags-input input').value = '';
    selectedFiles = [];
    document.getElementById('imagePreview').innerHTML = '';
  };

  document.querySelectorAll('#closeModal, #cancelPost, .modal-overlay').forEach(el => {
    el.onclick = closeModal;
  });

  // 上传图片/视频预览（支持多选）
  document.querySelectorAll('.upload-btn input[type="file"]').forEach(input => {
    input.onchange = (e) => {
      selectedFiles = [...selectedFiles, ...Array.from(e.target.files)];
      const preview = document.getElementById('imagePreview');
      Array.from(e.target.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = ev => {
          const div = document.createElement('div');
          div.className = 'preview-item';
          div.innerHTML = `
            <img src="${ev.target.result}">
            <button type="button" class="remove">×</button>
          `;
          div.querySelector('.remove').onclick = () => {
            selectedFiles = selectedFiles.filter(f => f.name !== file.name);
            div.remove();
          };
          preview.appendChild(div);
        };
        reader.readAsDataURL(file);
      });
    };
  });

  document.getElementById('submitPost').onclick = handlePostSubmit;

  // 加载更多
  document.getElementById('loadMoreBtn').onclick = () => loadContentList();

  // 好友侧边栏
  initFriendsSidebar();
}

// 好友侧边栏（完整对接）
async function initFriendsSidebar() {
  const sidebar = document.getElementById('friendsSidebar');
  const overlay = document.getElementById('sidebarOverlay');

  document.getElementById('friendsBtn').onclick = async () => {
    sidebar.classList.add('show');
    overlay.classList.add('show');
    await loadFriendRequests();
    await loadFriendsList();
  };

  [document.getElementById('closeFriendsSidebar'), overlay].forEach(el => {
    el.onclick = () => {
      sidebar.classList.remove('show');
      overlay.classList.remove('show');
    };
  });

  // 搜索用户 + 添加好友
  document.getElementById('searchUserBtn').onclick = async () => {
    const keyword = document.getElementById('searchUserInput').value.trim();
    if (!keyword) return;

    try {
      const res = await axios.get('/api/user/search', { params: { keyword } });
      renderSearchResults(res.data.data || []);
    } catch (err) {
      alert('搜索失败');
    }
  };
}

async function loadFriendRequests() {
  try {
    const res = await axios.get('/api/friend/pending');
    if (res.data.code === 200) {
      renderFriendRequests(res.data.data);
    }
  } catch (err) {
    console.error('加载好友请求失败', err);
  }
}

function renderFriendRequests(requests) {
  const container = document.getElementById('friendRequests');
  container.innerHTML = '';
  requests.forEach(req => {
    const item = document.createElement('div');
    item.className = 'user-item';
    item.innerHTML = `
      <img src="${req.avatar || '../../common/images/avatar-default.png'}">
      <div class="info">
        <h4>${req.nickname || req.username}</h4>
        <p>请求添加好友</p>
      </div>
      <div>
        <button onclick="handleFriendAction('accept', ${req.id})">接受</button>
        <button class="reject" onclick="handleFriendAction('reject', ${req.id})">拒绝</button>
      </div>
    `;
    container.appendChild(item);
  });
  document.querySelector('.request-count').textContent = `(${requests.length})`;
}

async function loadFriendsList() {
  try {
    const res = await axios.get('/api/friend/list');
    if (res.data.code === 200) {
      renderFriendsList(res.data.data);
    }
  } catch (err) {
    console.error('加载好友列表失败', err);
  }
}

function renderFriendsList(friends) {
  const container = document.getElementById('friendsList');
  container.innerHTML = '';
  friends.forEach(friend => {
    const item = document.createElement('div');
    item.className = 'user-item';
    item.innerHTML = `
      <img src="${friend.avatar || '../../common/images/avatar-default.png'}">
      <div class="info">
        <h4>${friend.nickname || friend.username}</h4>
        <p>已添加</p>
      </div>
    `;
    container.appendChild(item);
  });
  document.querySelector('.friend-count').textContent = `(${friends.length})`;
}

// 处理好友请求
window.handleFriendAction = async (action, friendId) => {
  try {
    const url = action === 'accept' ? `/api/friend/accept/${friendId}` : `/api/friend/reject/${friendId}`;
    await axios.post(url);
    alert(action === 'accept' ? '已添加好友' : '已拒绝');
    loadFriendRequests();
    loadFriendsList();
  } catch (err) {
    alert('操作失败');
  }
};

// 搜索用户结果
function renderSearchResults(users) {
  const container = document.getElementById('searchResults');
  container.innerHTML = '';
  users.forEach(user => {
    const item = document.createElement('div');
    item.className = 'user-item';
    item.innerHTML = `
      <img src="${user.avatar || '../../common/images/avatar-default.png'}">
      <div class="info"><h4>${user.nickname || user.username}</h4></div>
      <button onclick="addFriend(${user.id})">添加好友</button>
    `;
    container.appendChild(item);
  });
}

window.addFriend = async (friendId) => {
  try {
    await axios.post('/api/friend', { friendId });
    alert('好友请求已发送');
  } catch (err) {
    alert('发送失败：' + (err.response?.data?.message || ''));
  }
};

// 动画背景
function initAnimatedBackground() {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  document.querySelectorAll('.rect').forEach((rect, i) => {
    const size = 200 + Math.random() * 300;
    rect.style.width = rect.style.height = `${size}px`;
    rect.style.backgroundColor = colors[i % colors.length];
    rect.style.left = `${Math.random() * 100}vw`;
    rect.style.top = `${Math.random() * 100}vh`;
    rect.style.animationDelay = `${Math.random() * 10}s`;
  });
}