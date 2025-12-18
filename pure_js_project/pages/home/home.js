
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
  initTopSearch();  
  
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
      window.location.href = '../login/login.html';
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
    const params = {
      page: currentPage,
      size: pageSize,
      sort: currentSort
    };

    if (currentFilterType !== 'all') {
      params.type = currentFilterType;
    }

    const res = await axios.get('/api/content/list', { params });

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

  // ===== 新增：生成静态星星（平均分显示）=====
  function generateStaticStars(score) {
    let html = '';
    const full = Math.floor(score);
    const hasHalf = score - full >= 0.5;
    for (let i = 1; i <= 5; i++) {
      if (i <= full) {
        html += '<i class="fas fa-star"></i>';
      } else if (i === full + 1 && hasHalf) {
        html += '<i class="fas fa-star-half-alt"></i>';
      } else {
        html += '<i class="far fa-star"></i>';
      }
    }
    return html;
  }

  // ===== 新增：生成可交互星星（用户打分）=====
  function generateInteractiveStars(userScore) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
      if (i <= userScore) {
        html += `<i class="fas fa-star rated" data-score="${i}"></i>`;
      } else {
        html += `<i class="far fa-star" data-score="${i}"></i>`;
      }
    }
    return html;
  }

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

    <!-- ===== 内容底部：平均分 + 评论按钮 ===== -->
    <div class="content-footer">
      <div class="rating">
        <span class="score" id="score-${content.id}">${(content.score || 0).toFixed(1)}</span>
        <div class="stars" id="stars-${content.id}">
          ${generateStaticStars(content.score || 0)}
        </div>
      </div>
      <div class="interaction">
        <button class="interact-btn comment-btn" data-id="${content.id}">
          <i class="fas fa-comment"></i> 评论 (${content.commentCount || 0})
        </button>
      </div>
    </div>

    <!-- ===== 用户个人评分区域（仅登录用户显示） ===== -->
    ${currentUser ? `
    <div class="user-rating" id="userRating-${content.id}">
      <span style="font-size:0.9rem;color:#64748b;margin-right:0.8rem;">你的评分：</span>
      <div class="rating-stars interactive" data-contentid="${content.id}">
        ${generateInteractiveStars(content.userScore || 0)}  <!-- 如果后端返回了 userScore 就用，没有就默认 0 -->
      </div>
    </div>
    ` : ''}

    <!-- ===== 评论区 ===== -->
    <div class="comments-section" id="commentsSection-${content.id}" style="display:none;">
      <div class="comments-list" id="commentsList-${content.id}"></div>
      
      <div class="comment-form" style="margin-top:1rem;display:flex;gap:0.5rem;align-items:start;">
        <img src="${currentUser?.avatar || '../../common/images/test.png'}" style="width:40px;height:40px;border-radius:50%;flex-shrink:0;">
        <textarea class="comment-textarea" placeholder="写下你的评论..." style="flex:1;padding:0.8rem;border:1px solid #e2e8f0;border-radius:12px;resize:none;height:80px;"></textarea>
        <button class="submit-comment-btn" data-contentid="${content.id}" style="align-self:end;padding:0.8rem 1.2rem;background:#3b82f6;color:white;border:none;border-radius:12px;cursor:pointer;">发送</button>
      </div>
    </div>
  `;

  // ===== 头像点击跳转 =====
  item.querySelectorAll('.clickable-avatar').forEach(el => {
    el.onclick = () => {
      const userId = el.dataset.userid;
      const url = userId == currentUser?.id ? 'current' : userId;
      window.location.href = `../user-detail/user-detail.html?userId=${url}`;
    };
  });

  // ===== 删除按钮 =====
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

  // ===== 评论按钮展开/收起 + 加载评论 =====
  const commentBtn = item.querySelector('.comment-btn');
  const commentsSection = item.querySelector(`#commentsSection-${content.id}`);
  if (commentBtn && commentsSection) {
    commentBtn.onclick = async () => {
      if (commentsSection.style.display === 'block') {
        commentsSection.style.display = 'none';
      } else {
        commentsSection.style.display = 'block';
        await loadComments(content.id);
      }
    };

    // 发送评论
    const submitBtn = item.querySelector('.submit-comment-btn');
    const textarea = item.querySelector('.comment-textarea');
    if (submitBtn && textarea) {
      submitBtn.onclick = async () => {
        const text = textarea.value.trim();
        if (!text) {
          alert('评论内容不能为空');
          return;
        }
        try {
          await axios.post('/api/comment', {
            contentId: content.id,
            content: text,      
            parentId: null
          });
          textarea.value = '';
          await loadComments(content.id);
          commentBtn.innerHTML = `<i class="fas fa-comment"></i> 评论 (${(content.commentCount || 0) + 1})`;
          content.commentCount = (content.commentCount || 0) + 1;
        } catch (err) {
          alert('评论失败：' + (err.response?.data?.message || '未知错误'));
        }
      };
    }
  }

  // ===== 评分交互逻辑 =====
  const userRatingEl = item.querySelector(`#userRating-${content.id}`);
  if (userRatingEl) {
    const starsContainer = userRatingEl.querySelector('.rating-stars');

    // 鼠标悬停高亮
    starsContainer.querySelectorAll('i').forEach(star => {
      star.onmouseenter = () => {
        const hoverScore = parseInt(star.dataset.score);
        starsContainer.querySelectorAll('i').forEach((s, idx) => {
          s.className = idx + 1 <= hoverScore ? 'fas fa-star rated' : 'far fa-star';
        });
      };
    });

    // 离开恢复原状
    starsContainer.onmouseleave = () => {
      const currentScore = starsContainer.querySelectorAll('.rated').length;
      starsContainer.innerHTML = generateInteractiveStars(currentScore);
    };

    // 点击打分
    starsContainer.onclick = async (e) => {
      if (e.target.tagName === 'I') {
        const score = parseInt(e.target.dataset.score);
        try {
          await axios.post('/api/rating', {
            contentId: content.id,
            score: score
          });
          starsContainer.innerHTML = generateInteractiveStars(score);
          alert('感谢你的评分！');

          // 更新平均分（简单方式：重新获取内容详情）
          try {
            const res = await axios.get(`/api/rating/user/${contentId}`);
            if (res.data.code === 200) {
              const newScore = res.data.data.score || 0;
              document.getElementById(`score-${content.id}`).textContent = newScore.toFixed(1);
              document.getElementById(`stars-${content.id}`).innerHTML = generateStaticStars(newScore);
            }
          } catch (err) {}
        } catch (err) {
          alert('打分失败：' + (err.response?.data?.message || '未知错误'));
        }
      }
    };

    // 页面加载时获取用户已有评分
    (async () => {
      try {
        const res = await axios.get(`/api/rating/user/${content.id}`);
        if (res.data.code === 200 && res.data.data?.score > 0) {
          const userScore = res.data.data.score;
          starsContainer.innerHTML = generateInteractiveStars(userScore);
        }
      } catch (err) {
        // 404 表示未评分，无需处理
      }
    })();
  }

  return item;
}

// 加载评论
async function loadComments(contentId) {
  const listEl = document.getElementById(`commentsList-${contentId}`);
  if (!listEl) return;

  try {
    const res = await axios.get(`/api/comment/${contentId}`);
    if (res.data.code === 200) {
      listEl.innerHTML = '';
      const comments = res.data.data || [];

      if (comments.length === 0) {
        listEl.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:1rem;">暂无评论，快来抢沙发~</p>';
        return;
      }

      comments.forEach(c => {
        const commentEl = document.createElement('div');
        commentEl.style = 'display:flex;gap:1rem;padding:0.8rem 0;border-bottom:1px solid #f1f5f9;';
        commentEl.innerHTML = `
          <img src="${c.avatar || '../../common/images/avatar-default.png'}" style="width:36px;height:36px;border-radius:50%;">
          <div style="flex:1;">
            <div style="font-weight:600;font-size:0.95rem;">${c.nickname || c.username}</div>
            <div style="color:#64748b;font-size:0.9rem;margin:0.3rem 0;">${formatTime(c.createTime)}</div>
            <div>${c.text}</div>
          </div>
        `;
        listEl.appendChild(commentEl);
      });
    }
  } catch (err) {
    listEl.innerHTML = '<p style="color:#ef4444;text-align:center;">加载评论失败</p>';
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
  const titleInput = document.getElementById('postTitle');
  const textarea = document.querySelector('.post-modal textarea');
  const tagInput = document.getElementById('postTags');

  const title = titleInput.value.trim();
  const description = textarea.value.trim();
  const tags = tagInput.value.split(',').map(t => t.trim()).filter(Boolean);

  // 校验：标题必填
  if (!title) {
    alert('请填写标题！');
    titleInput.focus();
    return;
  }

  if (selectedFiles.length === 0 && !description) {
    alert('请填写内容或上传图片/视频！');
    textarea.focus();
    return;
  }

  const formData = new FormData();
  formData.append('title', title);                    // 必填
  formData.append('description', description); 
  formData.append('type', selectedFiles.length > 0 
    ? (selectedFiles[0].type.startsWith('video') ? 'VIDEO' : 'IMAGE') 
    : 'TEXT');
  
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
    console.error('发布失败', err);
    alert('发布失败：' + (err.response?.data?.message || '未知错误'));
  }
}

let selectedFiles = [];

function initFilters() {
  // 类型筛选（全部/图片/视频/文字）
  document.querySelectorAll('.filter-tabs .tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.filter-tabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      currentFilterType = tab.dataset.filter; // 'all', 'IMAGE', 'VIDEO', 'TEXT'
      loadContentList(true);
    };
  });

  // 排序下拉框
  document.getElementById('sortSelect').onchange = (e) => {
    currentSort = e.target.value; // 'latest', 'oldest', 'popular'
    loadContentList(true);
  };
}

let currentFilterType = 'all'; // 默认全部
let currentSort = 'latest';     // 默认最新

// 初始化交互
function initInteractions() {
  initFilters();
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

  // ========== 直接通过用户名添加好友 ==========
document.getElementById('addFriendBtn').onclick = async () => {
  const input = document.getElementById('addFriendInput');
  const resultDiv = document.getElementById('addFriendResult');
  const username = input.value.trim();

  if (!username) {
    resultDiv.innerHTML = '<span style="color:#ef4444;">请输入用户名</span>';
    return;
  }

  // 防止添加自己
  if (username === currentUser?.username) {
    resultDiv.innerHTML = '<span style="color:#ef4444;">不能添加自己为好友</span>';
    return;
  }

  try {
    await axios.post('/api/friend', { username });
    resultDiv.innerHTML = '<span style="color:#10b981;">好友请求已发送！</span>';
    input.value = '';
  } catch (err) {
    const msg = err.response?.data?.message || '发送失败';
    let displayMsg = msg;
    if (msg.includes('不存在')) displayMsg = '用户不存在';
    if (msg.includes('已存在') || msg.includes('已是好友')) displayMsg = '已是好友或已发送请求';
    resultDiv.innerHTML = `<span style="color:#ef4444;">${displayMsg}</span>`;
  }

  setTimeout(() => { resultDiv.innerHTML = ''; }, 3000);
};

  // 支持回车发送
  document.getElementById('addFriendInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('addFriendBtn').click();
    }
  });
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
      <img src="${req.avatar || '../../common/images/test.png'}">
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

// ==================== 顶部搜索功能：仅按标签检索 ====================

function initTopSearch() {
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');

  const performTagSearch = async () => {
    const keyword = searchInput.value.trim();

    // 清空当前列表，准备显示搜索结果
    const contentList = document.getElementById('contentList');
    contentList.innerHTML = '';
    document.getElementById('loadMoreBtn').style.display = 'none';
    hasMore = false; // 搜索结果不启用“加载更多”

    if (!keyword) {
      // 空输入：恢复默认内容流
      loadContentList(true);
      return;
    }

    try {
      // 调用按标签搜索接口（支持单个标签）
      const res = await axios.get('/api/content/tags', {
        params: {
          tags: keyword,   // 后端支持 ?tags=xxx
          page: 1,
          size: 20         // 搜索结果一次加载较多，避免分页麻烦
        }
      });

      if (res.data.code === 200) {
        const records = res.data.data?.records || [];

        if (records.length > 0) {
          // 显示搜索结果提示
          const tip = document.createElement('div');
          tip.style = 'text-align:center; padding:1.5rem 1rem; color:#64748b; background:#f8fafc; border-radius:12px; margin-bottom:1.5rem;';
          tip.innerHTML = `找到 <strong>${records.length}</strong> 条包含标签 “<strong>${keyword}</strong>” 的内容`;
          contentList.appendChild(tip);

          // 渲染内容
          renderContentList(records);
        } else {
          // 无结果提示
          contentList.innerHTML = `
            <div style="text-align:center; padding:5rem 2rem; color:#94a3b8;">
              <i class="fas fa-search fa-3x" style="margin-bottom:1rem; opacity:0.6;"></i>
              <p style="font-size:1.1rem; margin-bottom:0.5rem;">
                未找到包含标签 “<strong>${keyword}</strong>” 的内容
              </p>
              <p style="font-size:0.95rem; color:#64748b;">
                试试其他标签，比如“旅行”、“美食”、“摄影”等～
              </p>
            </div>
          `;
        }
      }
    } catch (err) {
      console.error('标签搜索失败', err);
      contentList.innerHTML = `
        <div style="text-align:center; padding:4rem; color:#ef4444;">
          <p>搜索失败，请检查网络后重试</p>
        </div>
      `;
      // 可选：出错后恢复默认列表
      // loadContentList(true);
    }
  };

  // 绑定事件
  searchBtn.onclick = performTagSearch;

  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      performTagSearch();
    }
  });

  // 可选：输入框获得焦点时选中内容
  searchInput.addEventListener('focus', () => {
    searchInput.select();
  });
}
