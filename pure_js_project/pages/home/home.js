
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

  //无限滚动
  let loading = false; // 防止重复触发

  const scrollHandler = async () => {
    if (loading || !hasMore) return;

    // 距离底部 300px 以内时触发加载
    const nearBottom = 
      window.innerHeight + window.scrollY >= document.body.offsetHeight - 300;

    if (nearBottom) {
      loading = true;
      document.getElementById('loadingMore').style.display = 'block';

      await loadContentList(); // 加载下一页（不刷新）

      loading = false;
    }
  };

  // 滚动事件（防抖优化）
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        scrollHandler();
        ticking = false;
      });
    }
    ticking = true;
  });

  // 页面初次加载完成后也检查一次（防止内容少不需要滚动）
  setTimeout(scrollHandler, 500);
  
});

async function loadCurrentUser() {
  try {
    const res = await axios.get('/api/user/info');
    if (res.data.code === 200) {
      currentUser = res.data.data;
      // 更新头像
      document.querySelector('#userMenuBtn img').src = currentUser.avatar || '../../common/images/test.png';
    }
  } catch (err) {
    console.error('获取用户信息失败', err);
    if (err.response?.status === 401) {
      localStorage.clear();
      window.location.href = '../login/login.html';
    }
  }
}

// 加载内容列表
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

      // 隐藏加载中提示
      document.getElementById('loadingMore').style.display = 'none';

      // 显示“没有更多”提示
      if (!hasMore) {
        document.getElementById('noMore').style.display = 'block';
      }
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


      // 生成静态星星
  function generateStars(score) {
    let html = '';
    const full = Math.floor(score || 0);
    const half = (score || 0) - full >= 0.5;
    for (let i = 0; i < 5; i++) {
      if (i < full) html += '<i class="fas fa-star"></i>';
      else if (i === full && half) html += '<i class="fas fa-star-half-alt"></i>';
      else html += '<i class="far fa-star"></i>';
    }
    return html;
  }

  // ===== 生成可交互星星（用户打分）=====
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
      <img src="${content.avatar || '../../common/images/test.png'}" alt="头像" class="clickable-avatar" data-userid="${content.userId}">
      <div class="user-meta">
        <h3 class="username clickable-avatar" data-userid="${content.userId}">${content.nickname || content.username}</h3>
        <p class="post-time">${formatTime(content.createTime)}</p>
      </div>
      <div class="rating">
        <span class="score" id="score-${content.id}">${(content.avgRating || 0).toFixed(1)}</span>
         <div class="stars">${generateStars(content.avgRating || 0)}</div>
      </div>
    </div>
    <div class="content-body">
          <h3 class="content-title" style="margin-bottom: 0.8rem; font-size: 1.2rem; font-weight: 600; color: #1e293b;">
        ${content.title || ''}
      </h3>

     <!-- 新增：标签显示 -->
    ${Array.isArray(content.tags) && content.tags.length > 0 ? `
      <div class="content-tags">
        ${content.tags.map(tag => `<span class="content-tag">#${tag.trim()}</span>`).join('')}
      </div>
    ` : ''}

    ${content.description ? `<p class="content-text">${content.description}</p>` : ''}
    ${mediaHtml}
    </div>
  </div>

    <!-- ===== 内容底部：评论按钮 ===== -->
    <div class="content-footer">
    <!-- ===== 用户个人评分区域 ===== -->
    ${currentUser ? `
    <div class="user-rating" id="userRating-${content.id}">
      <span style="font-size:0.9rem;color:#64748b;margin-right:0.8rem;">你的评分：</span>
      <div class="rating-stars interactive" data-contentid="${content.id}">
        ${generateInteractiveStars(content.userScore || 0)}  <!-- 默认 0 -->
      </div>
    </div>
    ` : ''}
      <div class="interaction">
        <button class="interact-btn comment-btn" data-id="${content.id}">
          <i class="fas fa-comment"></i> 评论 (${content.viewCount || 0})
        </button>
      </div>
    </div>

   <!-- ===== 评论区 ===== -->
<div class="comments-section" id="commentsSection-${content.id}" style="display:none;">
  <div class="comments-list" id="commentsList-${content.id}"></div>
  
  <div class="comment-form" style="margin-top:1rem;display:flex;gap:0.5rem;align-items:start;padding-bottom:1rem;">
    <img src="${currentUser?.avatar || '../../common/images/test.png'}" style="width:40px;height:40px;border-radius:50%;flex-shrink:0;">
    <textarea class="comment-textarea" placeholder="写下你的评论..." style="flex:1;padding:0.8rem;border:1px solid #e2e8f0;border-radius:12px;resize:none;height:60px;"></textarea>
<button class="submit-comment-btn" data-contentid="${content.id}" style="align-self:end;padding:0.8rem 1.2rem;margin-right:0.5rem;background:#3b82f6;color:white;border:none;border-radius:12px;cursor:pointer;">发送</button>  </div>
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
          showToast('删除成功');
        } catch (err) {
          showToast('删除失败：' + (err.response?.data?.message || '未知错误'));
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
        await loadComments(content.id, commentsSection);
      }
    };

    // 发送评论
    const submitBtn = item.querySelector('.submit-comment-btn');
    const textarea = item.querySelector('.comment-textarea');
    if (submitBtn && textarea) {
      submitBtn.onclick = async () => {
        const text = textarea.value.trim();
        if (!text) {
          showToast('评论内容不能为空');
          return;
        }
        try {
          await axios.post('/api/comment', {
            contentId: content.id,
            content: text,      
            parentId: null
          });
          textarea.value = '';
          await loadComments(content.id, commentsSection);
          commentBtn.innerHTML = `<i class="fas fa-comment"></i> 评论 (${(content.viewCount || 0) + 1})`;
          content.commentCount = (content.viewCount || 0) + 1;
        } catch (err) {
          showToast('评论失败：' + (err.response?.data?.message || '未知错误'));
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
          showToast('感谢你的评分！');

          // 更新平均分（重新获取内容详情）
          try {
            const detailRes = await axios.get(`/api/content/${content.id}`);
          if (detailRes.data.code === 200) {
            const newAvgRating = detailRes.data.data.avgRating || 0;
            document.getElementById(`score-${content.id}`).textContent = newAvgRating.toFixed(1);
          }
          } catch (err) {}
        } catch (err) {
          showToast('打分失败：' + (err.response?.data?.message || '未知错误'));
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

// 加载评论函数（接收 contentId 和目标容器）
async function loadComments(contentId, container) {
  try {
    const res = await axios.get(`/api/comment/${contentId}`); 

    if (res.data.code === 200) {
      const comments = res.data.data || [];
      const commentsList = container.querySelector('.comments-list');
      commentsList.innerHTML = ''; // 清空

      if (comments.length === 0) {
        commentsList.innerHTML = '<div style="text-align:center; padding:1rem; color:#64748b;">暂无评论</div>';
        return;
      }

      comments.forEach(comment => {
        const commentEl = document.createElement('div');
        commentEl.className = 'comment-item';
        commentEl.innerHTML = `
          <img src="${comment.avatar || '../../common/images/test.png'}" alt="头像">
          <div class="comment-info">
            <strong>${comment.nickname || comment.username}</strong>
            <p>${comment.content || comment.text}</p>
            <span class="comment-time">${formatTime(comment.createTime)}</span>
          </div>
        `;
        commentsList.appendChild(commentEl);
      });
    }
  } catch (err) {
    console.error('加载评论失败', err);
    container.querySelector('.comments-list').innerHTML = 
      '<div style="text-align:center; padding:1rem; color:#ef4444;">加载评论失败</div>';
  }
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
  const postTitleInput = document.getElementById('postTitle');
  const postTextInput = document.getElementById('postText');
  const postTagsInput = document.getElementById('postTags');
  const uploadImageInput = document.getElementById('uploadImage');
  const uploadVideoInput = document.getElementById('uploadVideo');
  const imagePreview = document.getElementById('imagePreview');
  const submitBtn = document.getElementById('submitPost');

  const title = postTitleInput.value.trim();
  const description = postTextInput.value.trim();
  const tagsStr = postTagsInput.value.trim();

  if (!title) {
    showToast('标题不能为空！');
    return;
  }

  // 处理标签
  const tags = tagsStr
    ? tagsStr.split(',').map(t => t.trim()).filter(t => t.length > 0)
    : [];

  // 获取选择的文件（图片多选取第一张，视频单选）
  const imageFile = uploadImageInput.files[0] || null;
  const videoFile = uploadVideoInput.files[0] || null;

  // 判断内容类型
  let type = 'TEXT';
  let fileToUpload = null;

  if (videoFile) {
    type = 'VIDEO';
    fileToUpload = videoFile;
  } else if (imageFile) {
    type = 'IMAGE';
    fileToUpload = imageFile;
  }

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = '发布中...';

    let fileUrl = null;
    let thumbnailUrl = null;

    // 如果有媒体文件，先上传获取路径
    if (fileToUpload) {
      const uploadRes = await uploadSingleFile(fileToUpload);
      fileUrl = uploadRes.fileUrl;         
      thumbnailUrl = uploadRes.thumbnailUrl || null;  // 如果有缩略图（视频可能有）
    }

    // 构造符合后端要求的 JSON
    const payload = {
      title: title,
      description: description || null,
      type: type,
      fileUrl: fileUrl,          // 单个字符串或 null
      thumbnailUrl: thumbnailUrl, // 可选，视频时可能需要
      tags: tags                 // 数组，如 ["旅行", "美食"]
    };

    // 发送纯 JSON 请求
    const res = await axios.post('/api/content', payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (res.data.code === 200) {
      showToast('发布成功！');
      document.getElementById('postModal').classList.remove('show');
      clearPostForm();
      loadContentList(true);  // 刷新列表
    } else {
      showToast('发布失败：' + (res.data.message || '未知错误'));
    }
  } catch (err) {
    console.error('发布失败', err);
    showToast('操作失败：' + (err.response?.data?.message || err.message || '网络错误'));
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '发布';
  }

  // 清空表单
  function clearPostForm() {
    postTitleInput.value = '';
    postTextInput.value = '';
    postTagsInput.value = '';
    uploadImageInput.value = '';
    uploadVideoInput.value = '';
    imagePreview.innerHTML = '';
  }
}

// 独立的文件上传函数
async function uploadSingleFile(file) {
  const formData = new FormData();
  formData.append('file', file);  // 后端参数名根据实际情况调整

  const res = await axios.post('/api/content', formData);  
  if (res.data.code === 200) {
    return {
      fileUrl: res.data.data?.fileUrl || res.data.fileUrl,
      thumbnailUrl: res.data.data?.thumbnailUrl || res.data.thumbnailUrl || null
    };
  } else {
    throw new Error(res.data.message || '文件上传失败');
  }
}

let selectedFiles = [];



let currentFilterType = 'all'; // 默认全部
let currentSort = 'latest';     // 默认最新

// 初始化交互
function initInteractions() {

  // ==================== 通知铃铛悬停下拉 ====================
async function initNotificationDropdown() {
  const notificationBtn = document.getElementById('notificationBtn');
  const dropdown = document.getElementById('notificationDropdown');
  const badge = document.getElementById('requestCountBadge');
  const list = document.getElementById('notificationList');

  if (!notificationBtn || !dropdown) return;

  let timeout;

  // 鼠标进入按钮：延迟显示（避免误触）
  notificationBtn.addEventListener('mouseenter', async () => {
    clearTimeout(timeout);
    dropdown.classList.add('show');
    await loadPendingRequestsForDropdown();
  });

  // 鼠标进入下拉面板：保持显示
  dropdown.addEventListener('mouseenter', () => {
    clearTimeout(timeout);
  });

  // 鼠标离开（按钮或面板）：延迟隐藏
  notificationBtn.addEventListener('mouseleave', () => {
    timeout = setTimeout(() => {
      dropdown.classList.remove('show');
    }, 300);
  });

  dropdown.addEventListener('mouseleave', () => {
    timeout = setTimeout(() => {
      dropdown.classList.remove('show');
    }, 300);
  });

  // 加载好友请求到下拉面板
  async function loadPendingRequestsForDropdown() {
    try {
      const res = await axios.get('/api/friend/pending');
      if (res.data.code === 200) {
        const requests = res.data.data || [];
        badge.textContent = requests.length;

        if (requests.length === 0) {
          list.innerHTML = `
            <div class="no-requests" style="text-align:center; padding:1.5rem; color:#64748b;">
              暂无好友请求
            </div>`;
          return;
        }

        list.innerHTML = '';
        requests.forEach(req => {
          const item = document.createElement('div');
          item.className = 'notification-item';
          item.innerHTML = `
            <img src="${req.avatar || '../../common/images/test.png'}" alt="头像">
            <div class="info">
              <strong>${req.nickname || req.username}</strong>
              <small>请求添加你为好友</small>
            </div>
            <div class="actions">
              <button class="accept" onclick="handleFriendAction('accept', ${req.id}); this.closest('.notification-item').remove(); updateBadge();">
                接受
              </button>
              <button class="reject" onclick="handleFriendAction('reject', ${req.id}); this.closest('.notification-item').remove(); updateBadge();">
                拒绝
              </button>
            </div>
          `;
          list.appendChild(item);
        });
      }
    } catch (err) {
      list.innerHTML = '<div style="text-align:center; padding:1rem; color:#ef4444;">加载失败</div>';
    }
  }

  // 更新徽标数字（操作后）
  window.updateBadge = async () => {
    try {
      const res = await axios.get('/api/friend/pending');
      const count = res.data.data?.length || 0;
      badge.textContent = count;
      // 同时更新侧边栏的计数（如果打开了）
      const sidebarCount = document.querySelector('.request-count');
      if (sidebarCount) sidebarCount.textContent = `(${count})`;
    } catch (err) {}
  };

  // 页面加载时也更新一次徽标（红点）
  updateBadge();
}

// 在 initInteractions() 中调用
initNotificationDropdown();

// ==================== 筛选按钮弹出模态框 ====================
function initFilterModal() {
  const filterBtn = document.getElementById('filterBtn');
  const modal = document.getElementById('filterModal');
  const overlay = document.getElementById('filterOverlay');
  const closeBtn = document.getElementById('closeFilterModal');
  const cancelBtn = document.getElementById('cancelFilterBtn');
  const applyBtn = document.getElementById('applyFilterBtn');

  if (!filterBtn || !modal) return;

  // 点击筛选按钮打开模态框，并同步当前筛选状态
  filterBtn.onclick = () => {
    // 同步类型tab
    document.querySelectorAll('#filterModal .filter-tabs .tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.filter === currentFilterType);
    });
    // 同步排序
    document.getElementById('sortSelect').value = currentSort;

    modal.classList.add('show');
  };

  // 关闭方式
  [closeBtn, overlay, cancelBtn].forEach(el => {
    if (el) {
      el.onclick = () => modal.classList.remove('show');
    }
  });

  // 模态框内类型tab切换（只切换active，不立即加载）
  document.querySelectorAll('#filterModal .filter-tabs .tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('#filterModal .filter-tabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    };
  });

  // 应用筛选
  applyBtn.onclick = () => {
    const activeTab = document.querySelector('#filterModal .filter-tabs .tab.active');
    currentFilterType = activeTab ? activeTab.dataset.filter : 'all';
    currentSort = document.getElementById('sortSelect').value;

    modal.classList.remove('show');
    loadContentList(true); // 刷新内容列表
  };
}


initFilterModal();

// ==================== 用户头像下拉菜单 ====================
function initUserDropdown() {
  const userMenuBtn = document.getElementById('userMenuBtn');
  const dropdownMenu = document.getElementById('dropdownMenu');
  const logoutBtn = document.getElementById('logoutBtn');

  if (!userMenuBtn || !dropdownMenu) return;

  let timeout;

  // 鼠标进入头像按钮：延迟显示下拉
  userMenuBtn.addEventListener('mouseenter', () => {
    clearTimeout(timeout);
    dropdownMenu.classList.add('show');
  });

  // 鼠标进入下拉菜单：保持显示
  dropdownMenu.addEventListener('mouseenter', () => {
    clearTimeout(timeout);
  });

  // 鼠标离开：延迟隐藏
  userMenuBtn.addEventListener('mouseleave', () => {
    timeout = setTimeout(() => {
      dropdownMenu.classList.remove('show');
    }, 300);
  });

  dropdownMenu.addEventListener('mouseleave', () => {
    timeout = setTimeout(() => {
      dropdownMenu.classList.remove('show');
    }, 300);
  });

  // 点击退出登录
  logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('确定要退出登录吗？')) {
      localStorage.removeItem('token');
      localStorage.clear(); // 可选：清空所有本地数据
      window.location.href = '../login/login.html';
    }
  });

  // 点击页面其他区域也关闭（可选增强）
  document.addEventListener('click', (e) => {
    if (!userMenuBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
      dropdownMenu.classList.remove('show');
    }
  });
}


initUserDropdown();
  
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

  // 好友侧边栏
  initFriendsSidebar();

  // ==================== 修改密码功能 ====================
const changePasswordBtn = document.getElementById('changePasswordBtn');
const changePasswordModal = document.getElementById('changePasswordModal');
const closePasswordModal = document.getElementById('closePasswordModal');
const cancelPasswordBtn = document.getElementById('cancelPasswordBtn');
const submitPasswordBtn = document.getElementById('submitPasswordBtn');

if (changePasswordBtn) {
  changePasswordBtn.onclick = () => {
    changePasswordModal.classList.add('show');
    document.getElementById('passwordForm').reset();
  };
}

// 关闭模态框
[closePasswordModal, cancelPasswordBtn, changePasswordModal.querySelector('.modal-overlay')].forEach(el => {
  if (el) {
    el.onclick = () => {
      changePasswordModal.classList.remove('show');
    };
  }
});

// 提交修改密码
if (submitPasswordBtn) {
  submitPasswordBtn.onclick = async () => {
    const oldPassword = document.getElementById('oldPassword').value.trim();
    const newPassword = document.getElementById('newPassword').value.trim();
    const confirmPassword = document.getElementById('confirmPassword').value.trim();

    if (!oldPassword || !newPassword || !confirmPassword) {
      showToast('请填写完整信息', 'error');
      return;
    }

    if (newPassword.length < 6) {
      showToast('新密码至少6位', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('两次输入的新密码不一致', 'error');
      return;
    }

    try {
      const res = await axios.put('/api/user/password', {
        oldPassword,
        newPassword
      });

      if (res.data.code === 200) {
        showToast('密码修改成功，请重新登录', 'success');
        changePasswordModal.classList.remove('show');

        // 3秒后自动退出登录
        setTimeout(() => {
          localStorage.clear();
          window.location.href = '../login/login.html';
        }, 2000);
      }
    } catch (err) {
      const msg = err.response?.data?.message || '修改失败';
      let displayMsg = msg;
      if (msg.includes('旧密码错误') || msg.includes('incorrect')) {
        displayMsg = '当前密码不正确';
      }
      showToast(displayMsg, 'error');
    }
  };
}
}

// 好友侧边栏（完整对接）
async function initFriendsSidebar() {
  const sidebar = document.getElementById('friendsSidebar');
  const overlay = document.getElementById('sidebarOverlay');

  // ==================== 折叠面板交互 ====================
document.querySelectorAll('.accordion-header').forEach(header => {
  header.addEventListener('click', () => {
    const section = header.parentElement;
    section.classList.toggle('active');
  });
});

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
      <img src="${friend.avatar || '../../common/images/test.png'}">
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
    ashowToast(action === 'accept' ? '已添加好友' : '已拒绝');
    loadFriendRequests();
    loadFriendsList();
  } catch (err) {
    showToast('操作失败');
  }
};

window.addFriend = async (username) => {
  try {
    await axios.post('/api/friend', { username });
    showToast('好友请求已发送');
  } catch (err) {
    ashowToast('发送失败：' + (err.response?.data?.message || ''));
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
    hasMore = false; // 搜索结果不启用“加载更多”

    if (!keyword) {
      // 空输入：恢复默认内容流
      loadContentList(true);
      return;
    }

    try {
      // 调用按标签搜索接口
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
      // 出错后恢复默认列表
      // loadContentList(true);
    }
  };

  // ==================== Toast 弹窗提示函数 ====================

function showToast(message, type = 'success', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';

  toast.innerHTML = `
    <i class="fas ${icon} toast-icon"></i>
    <div class="toast-message">${message} </div>
    <button class="close-toast" onclick="this.parentElement.remove()">&times;</button>
  `;

  container.appendChild(toast);

  // 触发显示动画
  setTimeout(() => toast.classList.add('show'), 100);

  // 自动消失
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

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

/*et dataDirectoryHandle; // 用户选择的文件夹句柄

// 让用户选择数据存储文件夹（只需一次）
async function chooseDataFolder() {
  try {
    dataDirectoryHandle = await window.showDirectoryPicker();
    localStorage.setItem('dataFolderChosen', 'true');
    showToast('数据文件夹已选择，所有内容将保存到本地磁盘');
  } catch (err) {
    console.log('用户取消选择');
  }
}

// 在页面加载时检查是否已选择文件夹
if (!localStorage.getItem('dataFolderChosen')) {
  setTimeout(() => {
    if (confirm('首次使用需要选择一个本地文件夹来保存图片和视频，是否现在选择？')) {
      chooseDataFolder();
    }
  }, 1000);
}

// 修改上传保存逻辑
async function saveFileToLocal(file) {
  if (!dataDirectoryHandle) {
    showToast('请先选择数据存储文件夹', 'error');
    return null;
  }

  const now = new Date();
  const timestamp = now.toISOString().slice(0,19).replace(/[-:T]/g, '').slice(0,14);
  const username = currentUser?.username || 'user';
  const ext = file.name.split('.').pop();
  const newFileName = `${username}_${timestamp}.${ext}`;

  // 创建 user 子文件夹
  let userDirHandle;
  try {
    userDirHandle = await dataDirectoryHandle.getDirectoryHandle(username, { create: true });
  } catch {
    userDirHandle = await dataDirectoryHandle.getDirectoryHandle(username, { create: true });
  }

  // 保存文件
  const fileHandle = await userDirHandle.getFileHandle(newFileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(file);
  await writable.close();

  // 返回本地相对路径（用于显示）
  return `local://${username}/${newFileName}`;
}*/