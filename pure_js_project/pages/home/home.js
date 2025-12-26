const aiClient = axios.create({
  baseURL: 'http://172.31.233.184:8000',
  withCredentials: false, // 不带 cookie
  timeout: 15000,
});
// OPFS 相关
const OPFS_PREFIX = 'opfs://';  // 我们自定义的前缀标识

async function getOPFSRoot() {
  return await navigator.storage.getDirectory();
}

async function saveFileToOPFS(file) {
  try {
    const root = await getOPFSRoot();
    const mediaDir = await root.getDirectoryHandle('media', { create: true });

    // 生成唯一文件名（用户名 + 时间戳 + 随机）
    const timestamp = Date.now();
    const username = currentUser?.username || 'user';
    const ext = file.name.split('.').pop() || '';
    const fileName = `${username}_${timestamp}_${Math.random().toString(36).substr(2, 8)}.${ext}`;

    const fileHandle = await mediaDir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();

    return `${OPFS_PREFIX}${fileName}`;
  } catch (err) {
    console.error('保存到 OPFS 失败', err);
    showToast('媒体文件保存失败', 'error');
    return null;
  }
}

async function getFileUrlFromOPFS(opfsPath) {

  if (!opfsPath || typeof opfsPath !== 'string') {
    return '../../common/images/test.png';  // 直接返回默认头像
  }
  if (!opfsPath.startsWith(OPFS_PREFIX)) return opfsPath; // 兼容旧服务器URL

  try {
    const root = await getOPFSRoot();
    const mediaDir = await root.getDirectoryHandle('media');
    const fileName = opfsPath.replace(OPFS_PREFIX, '');
    const fileHandle = await mediaDir.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return URL.createObjectURL(file);
  } catch (err) {
    console.error('读取 OPFS 文件失败', err);
    return '../../common/images/placeholder.png'; // 丢失时显示占位图
  }
}
let currentPage = 1;
const pageSize = 10;
let hasMore = true;
let currentUser = null; // 当前登录用户

document.addEventListener('DOMContentLoaded', async function() {
  // 检查登录状态
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '../login/login.html';
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
      const avatarUrl = await getFileUrlFromOPFS(currentUser.avatar);
      document.querySelector('#userMenuBtn img').src = avatarUrl;
      document.getElementById('postBoxAvatar').src = avatarUrl;
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
      await renderContentList(records);

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
async function renderContentList(contents) {
  const list = document.getElementById('contentList');

  for (const content of contents) {
    const item = await createContentElement(content); // 必须 await
    list.appendChild(item);
  }
}

async function createContentElement(content) {

  // === OPFS 头像处理 ===
  // 帖子作者头像
  const authorAvatarUrl = await getFileUrlFromOPFS(content.avatar || content.userAvatar || '');

  // 当前登录用户头像（用于评论输入框）
  const currentUserAvatarUrl = await getFileUrlFromOPFS(currentUser?.avatar || '');

  // 评论列表中每条评论的头像（如果后端返回 comments 数组且有 avatar）
  const commentsWithAvatar = (content.comments || []).map(comment => ({
    ...comment,
    commentAvatarUrl: '' // 默认空
  }));
  // 批量处理评论头像
  for (let i = 0; i < commentsWithAvatar.length; i++) {
    commentsWithAvatar[i].commentAvatarUrl = await getFileUrlFromOPFS(commentsWithAvatar[i].avatar || '');
  }
  const item = document.createElement('div');
  item.className = 'content-item';
  item.dataset.id = content.id;

  const isOwn = currentUser && content.userId === currentUser.id;

  // ===== 媒体部分：异步获取 URL =====
  let mediaHtml = '';
  const mediaUrl = content.fileUrl || (content.mediaUrls && content.mediaUrls[0]);

  if ((content.type === 'IMAGE' || content.type === 'VIDEO') && mediaUrl) {
    const src = await getFileUrlFromOPFS(mediaUrl);

    if (content.type === 'IMAGE') {
      mediaHtml = `<div class="media-container">
        <img src="${src}" alt="图片" loading="lazy" style="max-width:100%; border-radius:12px;">
      </div>`;
    } else if (content.type === 'VIDEO') {
      mediaHtml = `<div class="media-container video-container">
        <video controls preload="metadata" style="width:100%; border-radius:12px;">
          <source src="${src}" type="video/mp4">
          你的浏览器不支持视频播放。
        </video>
      </div>`;
    }
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

  const userAvatarUrl = await getFileUrlFromOPFS(content.avatar);

// ===== 文本内容：支持展开/收起 =====
const fullTextRaw = content.description || content.title || content.text || '(无文本)';
const fullText = fullTextRaw.trim().replace(/\n/g, '<br>'); // 支持换行显示
const maxLength = 200;

let textHtml = '';

if (fullTextRaw.length > maxLength) {
  const shortTextRaw = fullTextRaw.substring(0, maxLength);
  const shortText = shortTextRaw.replace(/\n/g, '<br>');
  
  textHtml = `
    <div class="content-text-wrapper" data-id="${content.id}">
      <p class="content-text content-text-short">
        ${shortText}<span class="ellipsis">...</span>
        <span class="expand-btn" style="color:#3b82f6;cursor:pointer;margin-left:4px;font-weight:500;">展开</span>
      </p>
      <p class="content-text content-text-full" style="display:none;">
        ${fullText}
        <span class="collapse-btn" style="color:#3b82f6;cursor:pointer;margin-left:8px;font-weight:500;">收起</span>
      </p>
    </div>
  `;
} else if (fullTextRaw) {
  textHtml = `<p class="content-text">${fullText}</p>`;
}

  item.innerHTML = `
    <div class="content-header">
      <img src="${authorAvatarUrl}" alt="用户头像" class="avatar clickable-avatar" data-userid="${content.userId}">
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
      ${Array.isArray(content.tags) && content.tags.length > 0 ? `
        <div class="content-tags">
          ${content.tags.map(tag => `<span class="content-tag">#${tag.trim()}</span>`).join('')}
        </div>
      ` : ''}
      ${textHtml}
      ${mediaHtml}
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
        ${content.type === 'IMAGE' ? `
        <button class="interact-btn image-search-btn" data-id="${content.id}" title="以图搜图">
          <i class="fas fa-camera"></i> 以图搜图
        </button>` : ''}
        <button class="interact-btn comment-btn" data-id="${content.id}">
          <i class="fas fa-comment"></i> 评论 (${content.viewCount || 0})
        </button>
      </div>
    </div>

   <!-- ===== 评论区 ===== -->
<div class="comments-section" id="commentsSection-${content.id}" style="display:none;">
  <div class="comments-list" id="commentsList-${content.id}"></div>
  
  <div class="comment-form" style="margin-top:1rem;display:flex;gap:0.5rem;align-items:start;padding-bottom:1rem;">
   <img src="${currentUserAvatarUrl}" alt="我的头像" style="width:40px;height:40px;border-radius:50%;flex-shrink:0;">
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
    let viewCount = content.viewCount || 0;
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
          viewCount++;
          commentBtn.innerHTML = `<i class="fas fa-comment"></i> 评论 (${viewCount })`;
          content.commentCount = viewCount ;
        } catch (err) {
          showToast('评论失败：' + (err.response?.data?.message || '未知错误'));
        }
      };
    }
  }

  // ===== 以图搜图按钮（仅图片类型显示）=====
  const imageSearchBtn = item.querySelector('.image-search-btn');
  if (imageSearchBtn) {
    imageSearchBtn.onclick = async () => {
      const id = Number(imageSearchBtn.dataset.id);
      if (Number.isFinite(id)) {
        await window.performImageSearchByContentId?.(id);
      } else {
        showToast('内容ID无效', 'error');
      }
    };
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

          // 更新平均分和静态星星
         try {
           const detailRes = await axios.get(`/api/content/${content.id}`);
           if (detailRes.data.code === 200) {
             const updatedContent = detailRes.data.data;
             const newAvgRating = updatedContent.avgRating || 0;

             // 更新数字
             const scoreEl = document.getElementById(`score-${content.id}`);
             if (scoreEl) {
               scoreEl.textContent = newAvgRating.toFixed(1);
             }

             // 更新静态星星
             const starsContainer = item.querySelector('.content-header .stars');
             if (starsContainer) {
               starsContainer.innerHTML = generateStars(newAvgRating);
             }
           }
         } catch (err) {
           console.error('更新平均分失败', err);
         }
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

  // ===== 为当前卡片绑定展开/收起事件 =====
const wrapper = item.querySelector('.content-text-wrapper');
if (wrapper) {
  const shortP = wrapper.querySelector('.content-text-short');
  const fullP = wrapper.querySelector('.content-text-full');
  const expandBtn = wrapper.querySelector('.expand-btn');
  const collapseBtn = wrapper.querySelector('.collapse-btn');

  expandBtn.onclick = (e) => {
    e.stopPropagation(); // 防止触发卡片点击跳转
    shortP.style.display = 'none';
    fullP.style.display = 'block';
  };

  collapseBtn.onclick = (e) => {
    e.stopPropagation();
    fullP.style.display = 'none';
    shortP.style.display = 'block';
  };
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

      // 使用 Promise.all 批量处理所有头像
  const commentAvatarUrls = await Promise.all(
    comments.map(c => getFileUrlFromOPFS(c.avatar || ''))
  );

    comments.forEach((comment, index) => {
    const commentEl = document.createElement('div');
    commentEl.className = 'comment-item';

    commentEl.innerHTML = `
      <img src="${commentAvatarUrls[index]}" alt="评论者头像">
      <div class="comment-info">
        <strong>${comment.nickname || comment.username || '匿名'}</strong>
        <p>${comment.content || comment.text || ''}</p>
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
  const uploadImageInput = document.getElementById('uploadImage');   // 支持 multiple
  const uploadVideoInput = document.getElementById('uploadVideo');
  const submitBtn = document.getElementById('submitPost');

  const title = postTitleInput.value.trim();
  const description = postTextInput.value.trim();
  const tagsStr = postTagsInput.value.trim();

  if (!title) {
    showToast('标题不能为空！');
    return;
  }

  const tags = tagsStr
    ? tagsStr.split(',').map(t => t.trim()).filter(t => t.length > 0)
    : [];

  const imageFiles = Array.from(uploadImageInput.files);   // 多图
  const videoFile = uploadVideoInput.files[0] || null;

  let type = 'TEXT';
  if (videoFile) type = 'VIDEO';
  else if (imageFiles.length > 0) type = 'IMAGE';

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = '发布中...';

    let mediaUrls = null;

    // 保存图片/视频到 OPFS
const imageFiles = Array.from(document.getElementById('uploadImage').files);
const videoFile = document.getElementById('uploadVideo').files[0];

const filesToSave = videoFile ? [videoFile] : imageFiles;
for (const file of filesToSave) {
  const opfsPath = await saveFileToOPFS(file);
  if (opfsPath) {
    mediaUrls = opfsPath;
  }
}
    // ========== 调用后端发布接口 ==========
    const res = await axios.post('/api/content', {
      title,
      description,
      tags,
      type,
      fileUrl: mediaUrls   
    });

    if (res.data.code === 200) {
      showToast('发布成功！');
      // 清空表单
      postTitleInput.value = '';
      postTextInput.value = '';
      postTagsInput.value = '';
      uploadImageInput.value = '';
      uploadVideoInput.value = '';
      document.getElementById('imagePreview').innerHTML = '';

      // 关闭模态框
      document.getElementById('postModal').classList.remove('show');

      // 刷新列表（放在最前面）
      loadContentList(true);
    }

  } catch (err) {
    console.error('发布失败', err);
    showToast('发布失败：' + (err.response?.data?.message || '未知错误'), 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '发布';
  }
}

async function saveFileToLocalDisk(file) {
  if (!dataDirectoryHandle) return null;

  try {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const username = currentUser?.username || 'anonymous';
    const ext = file.name.split('.').pop().toLowerCase();
    const newFileName = `${username}_${timestamp}_${Math.random().toString(36).substr(2, 5)}.${ext}`;

    // 创建用户子文件夹
    const userDirHandle = await dataDirectoryHandle.getDirectoryHandle(username, { create: true });

    // 创建文件
    const fileHandle = await userDirHandle.getFileHandle(newFileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();

    const localPath = `${LOCAL_PREFIX}${username}/${newFileName}`;
    return localPath;
  } catch (err) {
    console.error('保存文件到本地失败', err);
    showToast('保存媒体文件失败', 'error');
    return null;
  }
}

// 独立的文件上传函数
async function uploadSingleFile(file) {
  const formData = new FormData();
  formData.append('file', file);  
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
let currentSort = 0;     // 默认最新

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

  if (friends.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:2rem 0; color:#94a3b8;">暂无好友</div>';
    document.querySelector('.friend-count').textContent = `(0)`;
    return;
  }

  friends.forEach(friend => {
    const item = document.createElement('div');
    item.className = 'user-item';
    item.innerHTML = `
      <img src="${friend.avatar || '../../common/images/test.png'}" alt="头像">
      <div class="info">
        <h4>${friend.nickname || friend.username}</h4>
        <p>已添加</p>
      </div>
      <div class="friend-actions">
        <button class="more-btn" aria-label="更多操作">
          <i class="fas fa-ellipsis-v"></i>
        </button>
        <!-- 注意：这里故意不加 show 类，确保默认隐藏 -->
        <div class="friend-dropdown-menu">
          <div class="friend-dropdown-item" data-action="profile" data-userid="${friend.id}">
            <i class="fas fa-user"></i> 查看详情
          </div>
          <div class="friend-dropdown-item danger" data-action="delete" data-friendid="${friend.id}">
            <i class="fas fa-user-times"></i> 删除好友
          </div>
        </div>
      </div>
    `;
    container.appendChild(item);
  });

  document.querySelector('.friend-count').textContent = `(${friends.length})`;

  document.querySelectorAll('.friend-dropdown-menu').forEach(menu => {
    menu.classList.remove('show');
  });

  // ========== 下拉菜单交互逻辑 ==========
  const moreButtons = document.querySelectorAll('.friend-actions .more-btn');

  moreButtons.forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();

      const menu = btn.nextElementSibling;
      const isShown = menu.classList.contains('show');

      // 先关闭所有菜单
      document.querySelectorAll('.friend-dropdown-menu').forEach(m => m.classList.remove('show'));

      // 如果之前没打开，才打开当前这个
      if (!isShown) {
        menu.classList.add('show');
      }
    };
  });

  // 菜单项点击
  document.querySelectorAll('.friend-dropdown-item').forEach(item => {
    item.onclick = async (e) => {
      e.stopPropagation();

      const action = item.dataset.action;
      const menu = item.closest('.friend-dropdown-menu');

      if (action === 'profile') {
        const userId = item.dataset.userid;
        const url = userId == currentUser?.id ? 'current' : userId;
        window.location.href = `../user-detail/user-detail.html?userId=${url}`;
      } else if (action === 'delete') {
        const friendId = item.dataset.friendid;
        if (confirm('确定要删除该好友吗？此操作不可恢复。')) {
          try {
            await axios.post(`/api/friend/delete/${friendId}`);
            showToast('已删除好友', 'success');
            await loadFriendsList();  
            await loadFriendRequests();
          } catch (err) {
            const msg = err.response?.data?.message || '删除失败';
            showToast(msg, 'error');
          }
        }
      }

      menu.classList.remove('show');
    };
  });

  // 点击页面空白处关闭所有菜单（只绑定一次）
  document.removeEventListener('click', closeAllFriendMenus);
  document.addEventListener('click', closeAllFriendMenus);
}

function closeAllFriendMenus() {
  document.querySelectorAll('.friend-dropdown-menu.show').forEach(menu => {
    menu.classList.remove('show');
  });
}

// 处理好友请求
window.handleFriendAction = async (action, friendId) => {
  try {
    const url = action === 'accept' ? `/api/friend/accept/${friendId}` : `/api/friend/reject/${friendId}`;
    await axios.post(url);
    showToast(action === 'accept' ? '已添加好友' : '已拒绝');
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

// ==================== 顶部搜索功能：多模态检索（文本搜图 / 以图搜图） ====================

// AI 搜索服务（FastAPI）
// 部署： http://172.31.233.184:8000  （内网）
// 认证：开放接口，无需 JWT Token


// 根据内容ID数组批量拉取详情（复用已有 /api/content/{id}）
async function fetchContentsByIds(ids) {
  const tasks = (ids || []).map(async (id) => {
    try {
      const res = await axios.get(`/api/content/${id}`);
      if (res.data && res.data.code === 200) return res.data.data;
    } catch (e) {}
    return null;
  });
  const results = await Promise.all(tasks);
  return results.filter(Boolean);
}

function clearListForSearch() {
  const contentList = document.getElementById('contentList');
  if (!contentList) return;
  contentList.innerHTML = `
    <div style="text-align:center; padding:3.5rem 1rem; color:#64748b;">
      <i class="fas fa-spinner fa-spin" style="margin-right:0.6rem;"></i>
      搜索中...
    </div>
  `;
  hasMore = false; // 搜索结果不启用“加载更多”
  document.getElementById('loadingMore').style.display = 'none';
  document.getElementById('noMore').style.display = 'none';
}

function renderSearchTip(modeLabel, keyword, count) {
  const tip = document.createElement('div');
  tip.style = 'display:flex; align-items:center; justify-content:space-between; gap:1rem; text-align:left; padding:1rem 1.2rem; color:#64748b; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; margin-bottom:1.2rem;';
  tip.innerHTML = `
    <div style="line-height:1.6;">
      <div style="font-weight:600; color:#334155;">${modeLabel}结果：<strong>${count}</strong> 条</div>
      <div style="font-size:0.95rem;">关键词：<strong>${keyword}</strong> <span style="color:#94a3b8;">（清空输入可恢复推荐流）</span></div>
    </div>
    <button class="clear-search-btn" style="white-space:nowrap; padding:0.6rem 1rem; background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; cursor:pointer; color:#334155;">
      返回推荐
    </button>
  `;
  tip.querySelector('.clear-search-btn').onclick = async () => {
    const input = document.getElementById('searchInput');
    if (input) input.value = '';
    hasMore = true;
    await loadContentList(true);
  };
  return tip;
}

// ==================== 普通内容检索（关键词 / 标签） ====================
async function runContentSearch(keyword, page = 1, size = 10) {
  const res = await axios.get('/api/content/search', {
    params: { keyword, page, size }
  });

  if (res.data && res.data.code === 200) {
    return res.data.data || {};
  }
  throw new Error(res.data?.message || '内容检索失败');
}

async function renderSearchByRecords(records, modeLabel, keyword) {
  const contentList = document.getElementById('contentList');
  contentList.innerHTML = '';
  contentList.appendChild(renderSearchTip(modeLabel, keyword, (records || []).length));

  if (!records || records.length === 0) {
    contentList.insertAdjacentHTML('beforeend', `
      <div style="text-align:center; padding:5rem 2rem; color:#94a3b8;">
        <i class="fas fa-search fa-3x" style="margin-bottom:1rem; opacity:0.6;"></i>
        <p style="font-size:1.1rem; margin-bottom:0.5rem;">未找到匹配内容</p>
        <p style="font-size:0.95rem; color:#64748b;">换个关键词/标签试试～</p>
      </div>
    `);
    return;
  }

  await renderContentList(records);
}

async function runTextSearch(keyword, size = 10) {
  const res = await aiClient.post('http://172.31.233.184:8000/ai/search/text', { query: keyword, size });
  if (res.data && res.data.code === 200) return res.data.data || [];
  throw new Error(res.data?.message || '文本搜图失败');
}

async function runImageSearch(contentId, size = 10) {
  const res = await aiClient.post('http://172.31.233.184:8000/ai/search/image', { contentId, size });
  if (res.data && res.data.code === 200) return res.data.data || [];
  throw new Error(res.data?.message || '以图搜图失败');
}

async function renderSearchByIds(ids, modeLabel, keyword) {
  const contentList = document.getElementById('contentList');
  contentList.innerHTML = '';
  const tip = renderSearchTip(modeLabel, keyword, (ids || []).length);
  contentList.appendChild(tip);

  if (!ids || ids.length === 0) {
    contentList.insertAdjacentHTML('beforeend', `
      <div style="text-align:center; padding:5rem 2rem; color:#94a3b8;">
        <i class="fas fa-search fa-3x" style="margin-bottom:1rem; opacity:0.6;"></i>
        <p style="font-size:1.1rem; margin-bottom:0.5rem;">
          未找到匹配内容
        </p>
        <p style="font-size:0.95rem; color:#64748b;">
          你可以换个描述/关键词，或在图片卡片上点击“以图搜图”～
        </p>
      </div>
    `);
    return;
  }

  const contents = await fetchContentsByIds(ids);

  // 有些ID可能已被删除/无权限，过滤后为空则提示
  if (!contents || contents.length === 0) {
    contentList.insertAdjacentHTML('beforeend', `
      <div style="text-align:center; padding:5rem 2rem; color:#94a3b8;">
        <p style="font-size:1.05rem;">结果ID已返回，但未拉取到内容详情（可能已删除或无权限）。</p>
      </div>
    `);
    return;
  }

  await renderContentList(contents);
}

async function performMultimodalSearch(mode, keyword) {
  clearListForSearch();

  try {
    // 1) 内容检索（关键词/标签）
    if (mode === 'content') {
      const data = await runContentSearch(keyword, 1, 10);
      const records = Array.isArray(data) ? data : (data.records || []);
      await renderSearchByRecords(records, '内容检索', keyword);
      return;
    }

    // 2) 以图搜图（输入 contentId）
    if (mode === 'image') {
      const contentId = Number(keyword);
      if (!Number.isFinite(contentId)) {
        document.getElementById('contentList').innerHTML = '';
        showToast('以图搜图需要输入数字内容ID，或在图片卡片上点“以图搜图”', 'error');
        return;
      }
      const ids = await runImageSearch(contentId, 10);
      await renderSearchByIds(ids, '以图搜图', String(contentId));
      return;
    }

    // 3) 以文搜图（AI 文本搜图，保留原逻辑）
    const ids = await runTextSearch(keyword, 10);
    await renderSearchByIds(ids, '以文搜图', keyword);

  } catch (err) {
    console.error('搜索失败', err);
    const contentList = document.getElementById('contentList');
    contentList.innerHTML = `
      <div style="text-align:center; padding:4rem; color:#ef4444;">
        <p>搜索失败：${err?.message || '未知错误'}</p>
        <p style="margin-top:0.5rem; font-size:0.95rem; color:#64748b;">
          若是 AI 搜索失败，可能是 AI 服务不可达或跨域未放行。
        </p>
      </div>
    `;
    showToast('搜索失败，请稍后再试', 'error');
  }
}


// 暴露给内容卡片上的“以图搜图”按钮使用
window.performImageSearchByContentId = async function(contentId) {
  const input = document.getElementById('searchInput');
  const mode = document.getElementById('searchMode');
  if (mode) mode.value = 'image';
  if (input) input.value = String(contentId);
  await performMultimodalSearch('image', String(contentId));
};

function initTopSearch() {
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const modeSelect = document.getElementById('searchMode');

  if (!searchInput || !searchBtn || !modeSelect) return;

  const syncPlaceholder = () => {
     if (modeSelect.value === 'image') {
      searchInput.placeholder = '输入内容ID进行以图搜图...（或在图片卡片上点“以图搜图”）';
    } else if (modeSelect.value === 'content') {
      searchInput.placeholder = '输入关键词/标签进行内容检索...（如：风景 / 旅行 / 美食）';
    } else {
      searchInput.placeholder = '输入描述词进行以文搜图...（如：开心的狗）';
    }
  };
  syncPlaceholder();
  modeSelect.addEventListener('change', syncPlaceholder);

  const doSearch = async () => {
    const keyword = searchInput.value.trim();

    // 空输入：恢复默认内容流
    if (!keyword) {
      hasMore = true;
      document.getElementById('noMore').style.display = 'none';
      await loadContentList(true);
      return;
    }

    await performMultimodalSearch(modeSelect.value, keyword);
  };

  // 绑定事件
  searchBtn.onclick = doSearch;
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') doSearch();
  });

  // 输入框获得焦点时选中内容
  searchInput.addEventListener('focus', () => {
    searchInput.select();
  });
}

// ==================== AI 聊天机器人逻辑 ====================

const chatBotFab = document.getElementById('chatBotFab');
const chatBotWindow = document.getElementById('chatBotWindow');
const closeChatBot = document.getElementById('closeChatBot');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');

// 打开/关闭窗口
chatBotFab.onclick = () => {
  chatBotWindow.classList.toggle('show');
  if (chatBotWindow.classList.contains('show')) {
    chatInput.focus();
    // 清掉新消息红点
    document.getElementById('chatNewMsgBadge').style.display = 'none';
  }
};

closeChatBot.onclick = () => {
  chatBotWindow.classList.remove('show');
};

// 发送消息函数
async function sendMessage() {
  const question = chatInput.value.trim();
  if (!question) return;

  // 添加用户消息
  appendMessage(question, 'user');
  chatInput.value = '';
  chatInput.style.height = 'auto'; // 重置高度

  // 添加正在思考的提示
  const thinkingMsg = appendMessage('思考中...', 'bot');
  sendChatBtn.disabled = true;

  try {
    const res = await axios.post('/api/chat/answer', {
      question: question
    });

    // 移除“思考中”
    thinkingMsg.remove();

    if (res.data.code === 200) {
      const answer = res.data.data || res.data.message || '（无回复）';
      appendMessage(answer, 'bot');
    } else {
      appendMessage('抱歉，出错了：' + (res.data.message || '未知错误'), 'bot');
    }
  } catch (err) {
    thinkingMsg.remove();
    const errMsg = err.response?.data?.message || err.message || '网络错误';
    appendMessage('请求失败：' + errMsg, 'bot');
    console.error('AI聊天错误:', err);
  } finally {
    sendChatBtn.disabled = false;
    chatInput.focus();
  }

  // 滚动到底部
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 添加消息到聊天区
function appendMessage(text, sender) {  // sender: 'user' 或 'bot'
  const div = document.createElement('div');
  div.className = `message ${sender}`;
  div.innerHTML = text.replace(/\n/g, '<br>'); // 支持换行
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

// 发送按钮点击
sendChatBtn.onclick = sendMessage;

// Enter 发送，Shift+Enter 换行
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// 自适应 textarea 高度
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = chatInput.scrollHeight + 'px';
});

// ==================== 双击图片打开大图查看 ====================
document.addEventListener('click', (e) => {
  // 点击关闭模态框（背景或关闭按钮）
  const modal = document.getElementById('imageModal');
  if (e.target === modal || e.target.closest('#closeImageModal')) {
    modal.classList.remove('show');
    document.body.style.overflow = ''; // 恢复滚动
  }
});

// 双击媒体容器中的图片/视频
document.addEventListener('dblclick', (e) => {
  const img = e.target.closest('.media-container img');
  const video = e.target.closest('.media-container video');

  if (img || video) {
    const src = img ? img.src : video.querySelector('source')?.src || '';
    if (src && src.startsWith('blob:')) {  // 只处理本地 blob 图（OPFS 生成的）
      const modal = document.getElementById('imageModal');
      const modalImg = document.getElementById('modalImage');

      // 视频也用 img 显示第一帧（或直接用 video 标签也行，这里统一用 img）
      modalImg.src = src;
      modal.classList.add('show');
      document.body.style.overflow = 'hidden'; // 禁止背景滚动
    }
  }
});

// ESC 键关闭
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('imageModal')?.classList.remove('show');
    document.body.style.overflow = '';
  }
});

// ==================== 右键图片 -> 分析图片（调用 /ai/analyze） ====================

// 把 dataURL 转成 base64
function stripDataUrlPrefix(dataUrl) {
  if (!dataUrl) return '';
  return dataUrl;
}

// 将 img.src 转换为 dataURL
async function srcToDataUrl(src) {
  // 已经是 dataURL
  if (src.startsWith('data:')) return src;

  // blob: / http(s): 都用 fetch 拉取再转
  const resp = await fetch(src);
  const blob = await resp.blob();

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
// 3) 弹窗控制器（核心：确保 show 生效 + 防滚动 + 防冲突）
function createAnalyzeModalController() {
  const modal = document.getElementById('analyzeModal');
  const overlay = document.getElementById('analyzeOverlay');
  const closeBtn = document.getElementById('closeAnalyzeModal');
  const cancelBtn = document.getElementById('cancelAnalyzeBtn');
  const body = document.getElementById('analyzeBody');
  const content = modal ? modal.querySelector('.modal-content') : null;

  if (!modal || !overlay || !body || !content) {
    console.error('[AnalyzeModal] 关键节点缺失：', { modal, overlay, body, content });
    return null;
  }

  // 强制兜底样式（防止被其他 CSS 覆盖导致看不见）
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.zIndex = '99999';        // 兜底：压过页面所有元素
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';

  function open(htmlLoading = true) {
    // 先插入内容，再显示（避免显示空白/闪烁）
    if (htmlLoading) {
      body.innerHTML = `
        <div style="text-align:center; padding:2.2rem 1rem; color:#64748b;">
          <i class="fas fa-spinner fa-spin" style="margin-right:0.6rem;"></i>
          分析中...
        </div>
      `;
    }
    modal.classList.add('show');

    // 禁止背景滚动
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }

  function close() {
    modal.classList.remove('show');
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  }

  // 关闭逻辑：只在点击“遮罩层”时关闭，不要让内容区冒泡误关
  overlay.addEventListener('click', close);
  closeBtn && closeBtn.addEventListener('click', close);
  cancelBtn && cancelBtn.addEventListener('click', close);

  // 内容区阻止冒泡（关键）
  content.addEventListener('click', (e) => e.stopPropagation());
  // 点击 modal 背景（非内容）也关闭
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  // ESC 关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  return { modal, body, open, close };
}

// 4) 主功能：右键图片显示菜单，点菜单“分析图片”打开弹窗并请求
function initImageRightClickAnalyze_REWRITE() {
  const menu = document.getElementById('imgContextMenu');
  const menuAnalyze = document.getElementById('menuAnalyzeImage');
  const modalCtl = createAnalyzeModalController();

  if (!menu || !menuAnalyze || !modalCtl) {
    console.error('[Analyze] 缺少右键菜单或弹窗节点');
    return;
  }

  let last = { contentId: null, imgSrc: null };

  const hideMenu = () => { menu.style.display = 'none'; };

  // 右键图片：弹出菜单
  document.addEventListener('contextmenu', (e) => {
    const img = e.target.closest('.media-container img');
    if (!img) return;

    const card = img.closest('.content-item');
    const contentId = card?.dataset?.id;
    if (!contentId) return;

    e.preventDefault();

    last = { contentId, imgSrc: img.src };

    // 定位菜单
    const w = 180, h = 54;
    const left = Math.min(e.clientX, window.innerWidth - w - 10);
    const top = Math.min(e.clientY, window.innerHeight - h - 10);
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    menu.style.display = 'block';
  });

  function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

  // 点击任意位置关闭菜单
  document.addEventListener('click', hideMenu);
  window.addEventListener('scroll', hideMenu);
  window.addEventListener('resize', hideMenu);

  // 点击“分析图片”
  menuAnalyze.addEventListener('click', async (e) => {
    e.stopPropagation();
    hideMenu();

    const { contentId, imgSrc } = last;
    if (!contentId || !imgSrc) return;

    // 先强制打开弹窗（确保可见）
    modalCtl.open(true);

    try {
      const dataUrl = await srcToDataUrl(imgSrc);

      // 调用 AI 接口（沿用你现有 aiClient）
      const res = await aiClient.post('/ai/analyze', {
        contentId: Number(contentId),
        imageUrl: dataUrl   // 你原来 stripDataUrlPrefix 其实没去掉前缀，这里直接传 dataUrl
      });

      const payload = res?.data || {};
      if (payload.code !== 200) throw new Error(payload.message || '分析失败');

      const d = payload.data || {};
      const tags = Array.isArray(d.tags) ? d.tags : [];

      modalCtl.body.innerHTML = `
        <div class="analyze-result">
          <div class="analyze-preview">
            <img src="${dataUrl}" alt="预览">
          </div>

          <div class="analyze-kv">
            <div class="row"><span class="label">内容ID：</span><span>${escapeHtml(contentId)}</span></div>
            <div class="row"><span class="label">描述：</span><span>${escapeHtml(d.caption ?? '-')}</span></div>
            <div class="row" style="align-items:flex-start;">
              <span class="label">标签：</span>
              <div class="analyze-tags">
                ${
                  tags.length
                    ? tags.map(t => `<span class="analyze-tag">#${escapeHtml(String(t).trim())}</span>`).join('')
                    : `<span style="color:#94a3b8;">(无)</span>`
                }
              </div>
            </div>
            <div class="row">
              <span class="label">安全：</span>
              <span style="font-weight:700; color:${d.isSafe ? '#10b981' : '#ef4444'};">
                ${d.isSafe ? '安全' : '存在风险'}
              </span>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      console.error('[Analyze] 失败：', err);
      modalCtl.body.innerHTML = `
        <div style="padding:1.2rem; color:#ef4444;">
          <div style="font-weight:700; margin-bottom:0.4rem;">分析失败</div>
          <div style="color:#64748b;">${escapeHtml(err?.message || '未知错误')}</div>
        </div>
      `;
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initImageRightClickAnalyze_REWRITE();
});
