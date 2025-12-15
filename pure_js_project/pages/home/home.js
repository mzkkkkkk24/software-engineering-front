// home.js - 纯前端模拟版本（用于调试和美化预览）

const mockContents = [
  {
    id: 1,
    type: 'image',
    username: '张小明',
    avatar: '../../common/images/avatar-1.png',
    time: '今天 09:24',
    text: '周末去了湖边露营，风景真的太美了！推荐给大家～ #旅行 #风景',
    mediaUrl: '../../common/images/post-1.jpg',
    score: 4.8,
    comments: 8,
    tags: ['旅行', '风景'],
    isOwn: false
  },
  {
    id: 2,
    type: 'video',
    username: '王美食',
    avatar: '../../common/images/avatar-3.png',
    time: '昨天 18:36',
    text: '今天尝试做了红烧肉，第一次做居然成功了！做法放在最后～ #美食',
    mediaUrl: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4', // 示例视频
    coverUrl: '../../common/images/video-cover.jpg',
    score: 4.9,
    comments: 24,
    tags: ['美食'],
    isOwn: false
  },
  {
    id: 3,
    type: 'text',
    username: '我',
    avatar: '../../common/images/avatar-default.png',
    time: '3天前',
    text: '最近读完了《人类简史》，感触很深。书中对人类发展历程的解读角度很独特，尤其是关于认知革命和农业革命的部分，完全颠覆了我之前的认知。强烈推荐给喜欢历史和哲学的朋友～ #生活 #阅读',
    score: 4.7,
    comments: 5,
    tags: ['生活', '阅读'],
    isOwn: true
  }
];

document.addEventListener('DOMContentLoaded', function() {
  initAnimatedBackground();
  renderContentList(mockContents);
  initInteractions();
});

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

function renderContentList(contents) {
  const list = document.querySelector('.content-list');
  list.innerHTML = '';
  contents.forEach(content => {
    list.appendChild(createContentElement(content));
  });
}

function createContentElement(content) {
  const item = document.createElement('div');
  item.className = 'content-item';
  item.dataset.type = content.type;
  item.dataset.tags = content.tags.join(',');

  let mediaHtml = '';
  if (content.type === 'image') {
    mediaHtml = `<div class="media-container"><img src="${content.mediaUrl}" alt="图片"></div>`;
  } else if (content.type === 'video') {
    mediaHtml = `<div class="media-container video-container">
      <video controls poster="${content.coverUrl || ''}">
        <source src="${content.mediaUrl}" type="video/mp4">
      </video>
    </div>`;
  }

  const actionsHtml = content.isOwn ?
    `<div class="content-actions own-actions">
      <button class="edit-btn"><i class="fas fa-edit"></i> 编辑</button>
      <button class="delete-btn"><i class="fas fa-trash"></i> 删除</button>
    </div>` :
    `<div class="content-actions"><button class="more-btn"><i class="fas fa-ellipsis-h"></i></button></div>`;

  item.innerHTML = `
    <div class="content-header">
      <img src="${content.avatar}" alt="头像">
      <div class="user-meta">
        <h3 class="username">${content.username}</h3>
        <p class="post-time">${content.time}</p>
      </div>
      ${actionsHtml}
    </div>
    <div class="content-body">
      <p class="content-text">${content.text}</p>
      ${mediaHtml}
    </div>
    <div class="content-footer">
      <div class="rating">
        <span class="score">${content.score}</span>
        <div class="stars">${generateStars(content.score)}</div>
        <button class="rate-btn">评分</button>
      </div>
      <div class="interaction">
        <button class="interact-btn comment-btn"><i class="fas fa-comment"></i> 评论 (${content.comments})</button>
        <button class="interact-btn"><i class="fas fa-share"></i> 分享</button>
      </div>
    </div>
    <div class="comments collapsed">
      <div class="add-comment">
        <input type="text" placeholder="添加评论...">
        <button><i class="fas fa-paper-plane"></i></button>
      </div>
    </div>
  `;
  return item;
}

function generateStars(score) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= score) html += '<i class="fas fa-star"></i>';
    else if (i - 0.5 <= score) html += '<i class="fas fa-star-half-alt"></i>';
    else html += '<i class="far fa-star"></i>';
  }
  return html;
}

function initInteractions() {
  // 发布模态框
  const modal = document.getElementById('postModal');
  document.getElementById('createPostBtn').onclick = () => modal.classList.add('show');
  document.querySelectorAll('#closeModal, #cancelPost, .modal-overlay').forEach(el => {
    el.onclick = () => modal.classList.remove('show');
  });

  // 模拟发布
  document.getElementById('submitPost').onclick = () => {
    const text = modal.querySelector('textarea').value.trim();
    if (text) {
      alert('发布成功（模拟）');
      modal.classList.remove('show');
      modal.querySelector('textarea').value = '';
    }
  };

  // 评论展开
  document.querySelectorAll('.comment-btn').forEach(btn => {
    btn.onclick = () => {
      const comments = btn.closest('.content-item').querySelector('.comments');
      comments.classList.toggle('collapsed');
    };
  });

  // 筛选（模拟）
  document.querySelectorAll('.tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    };
  });

  document.querySelectorAll('.tag').forEach(tag => {
    tag.onclick = () => {
      document.querySelectorAll('.tag').forEach(t => t.classList.remove('active'));
      tag.classList.add('active');
    };
  });
  // 好友功能模拟数据
const mockFriendRequests = [
  { id: 1, username: '李华', avatar: '../../common/images/avatar-2.png' },
  { id: 2, username: '赵小厨', avatar: '../../common/images/avatar-4.png' }
];

const mockFriends = [
  { id: 3, username: '张小明', avatar: '../../common/images/avatar-1.png' },
  { id: 4, username: '王美食', avatar: '../../common/images/avatar-3.png' },
  // ... 可继续添加
];

const mockSearchUsers = [
  { id: 5, username: '陈设计', avatar: '../../common/images/avatar-default.png', isFriend: false },
  { id: 6, username: '刘摄影', avatar: '../../common/images/avatar-1.png', isFriend: true },
];

// 打开/关闭侧边栏
const friendsBtn = document.getElementById('friendsBtn');
const sidebar = document.getElementById('friendsSidebar');
const overlay = document.getElementById('sidebarOverlay');
const closeSidebar = document.getElementById('closeFriendsSidebar');

friendsBtn.onclick = () => {
  sidebar.classList.add('show');
  overlay.classList.add('show');
  renderFriendRequests();
  renderFriendsList();
};
 
[closeSidebar, overlay].forEach(el => {
  el.onclick = () => {
    sidebar.classList.remove('show');
    overlay.classList.remove('show');
  };
});

// 渲染好友请求
function renderFriendRequests() {
  const container = document.getElementById('friendRequests');
  container.innerHTML = '';
  mockFriendRequests.forEach(req => {
    const item = document.createElement('div');
    item.className = 'user-item';
    item.innerHTML = `
      <img src="${req.avatar}" alt="${req.username}">
      <div class="info">
        <h4>${req.username}</h4>
        <p>请求添加你为好友</p>
      </div>
      <div>
        <button>接受</button>
        <button class="reject">拒绝</button>
      </div>
    `;
    // 模拟接受
    item.querySelector('button:not(.reject)').onclick = () => {
      alert(`已接受 ${req.username} 的好友请求（模拟）`);
      mockFriends.push(req);
      mockFriendRequests = mockFriendRequests.filter(r => r.id !== req.id);
      renderFriendRequests();
      renderFriendsList();
    };
    container.appendChild(item);
  });
  document.querySelector('.request-count').textContent = `(${mockFriendRequests.length})`;
}

// 渲染好友列表
function renderFriendsList() {
  const container = document.getElementById('friendsList');
  container.innerHTML = '';
  mockFriends.forEach(friend => {
    const item = document.createElement('div');
    item.className = 'user-item';
    item.innerHTML = `
      <img src="${friend.avatar}" alt="${friend.username}">
      <div class="info">
        <h4>${friend.username}</h4>
        <p>已添加</p>
      </div>
    `;
    container.appendChild(item);
  });
  document.querySelector('.friend-count').textContent = `(${mockFriends.length})`;
}

// 搜索用户
document.getElementById('searchUserBtn').onclick = () => {
  const keyword = document.getElementById('searchUserInput').value.trim().toLowerCase();
  const resultsContainer = document.getElementById('searchResults');
  resultsContainer.innerHTML = '';
  
  const filtered = mockSearchUsers.filter(u => u.username.toLowerCase().includes(keyword) || keyword === '');
  
  if (filtered.length === 0) {
    resultsContainer.innerHTML = '<p style="text-align:center;color:#94a3b8;">未找到用户</p>';
    return;
  }
  
  filtered.forEach(user => {
    const item = document.createElement('div');
    item.className = 'user-item';
    item.innerHTML = `
      <img src="${user.avatar}" alt="${user.username}">
      <div class="info">
        <h4>${user.username}</h4>
      </div>
      <button class="${user.isFriend ? 'added' : ''}">
        ${user.isFriend ? '已添加' : '添加好友'}
      </button>
    `;
    // 模拟添加
    if (!user.isFriend) {
      item.querySelector('button').onclick = () => {
        alert(`已发送好友请求给 ${user.username}（模拟）`);
        item.querySelector('button').textContent = '请求已发送';
        item.querySelector('button').disabled = true;
      };
    }
    resultsContainer.appendChild(item);
  });
};

// 点击右上角头像跳转到个人主页
document.getElementById('userMenuBtn').onclick = () => {
  window.location.href = '../user-detail/user-detail.html'; // 自己的主页
};

// 点击内容中的用户头像，也可跳转（示例）
document.querySelectorAll('.content-item').forEach(item => {
  const avatar = item.querySelector('.content-header img');
  const usernameEl = item.querySelector('.user-meta h3');
  const username = usernameEl.textContent.trim();

  [avatar, usernameEl].forEach(el => {
    el.style.cursor = 'pointer';
    el.onclick = () => {
      if (username === '我') {
        window.location.href = 'user-detail.html?userId=current';
      } else {
        // 实际项目中应传入真实 userId
        window.location.href = `user-detail.html?userId=${encodeURIComponent(username)}`;
      }
    };
  });
});

}