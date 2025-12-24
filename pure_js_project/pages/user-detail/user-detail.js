// ===== OPFS 支持=====
const OPFS_PREFIX = 'opfs://';

// ===== OPFS 保存文件 =====
async function saveFileToOPFS(file) {
  if (!file) return null;

  try {
    const root = await getOPFSRoot();
    const mediaDir = await root.getDirectoryHandle('media', { create: true });

    // 生成唯一文件名：用户ID_时间戳_随机.后缀
    const timestamp = Date.now();
    const userId = currentUserId || 'user';
    const random = Math.random().toString(36).substr(2, 8);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const fileName = `avatar_${userId}_${timestamp}_${random}.${ext}`;

    const fileHandle = await mediaDir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();

    return `${OPFS_PREFIX}${fileName}`;
  } catch (err) {
    console.error('保存头像到 OPFS 失败', err);
    showToast('头像保存失败，请重试', 'error');
    return null;
  }
}

async function getOPFSRoot() {
  return await navigator.storage.getDirectory();
}

async function getFileUrlFromOPFS(opfsPath) {
 if (!opfsPath || typeof opfsPath !== 'string') {
    return '../../common/images/test.png';  // 直接返回默认头像
  }
  if (!opfsPath.startsWith(OPFS_PREFIX)) {
    return opfsPath; // 兼容旧服务器URL
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
    return '../../common/images/tests.png';
  }
}
let tempAvatarFile = null;
let currentUserId = null; // 当前查看的用户ID
let isCurrentUser = false; // 是否是自己的主页



document.addEventListener('DOMContentLoaded', async function() {
  const urlParams = new URLSearchParams(window.location.search);
  const userIdParam = urlParams.get('userId') || 'current';

  // 检查登录
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '../login/login.html';
    return;
  }

  try {
    // 获取要查看的用户信息
    const targetUser = await fetchTargetUser(userIdParam);
    const userPosts = await fetchUserPosts(targetUser.id,userIdParam);

    currentUserId = targetUser.id;
    isCurrentUser = userIdParam === 'current';

    renderProfile(targetUser, userPosts, isCurrentUser);
  } catch (error) {
    console.error('加载用户资料失败', error);
    document.getElementById('profileContentList').innerHTML = '<div class="no-content-profile">加载失败，请刷新重试</div>';
  }
});

// 获取目标用户信息（current 表示自己）
async function fetchTargetUser(userIdParam) {
  if (userIdParam === 'current') {
    const res = await axios.get('/api/user/info');
    if (res.data.code === 200) return res.data.data;
  } else {
    const res = await axios.get(`/api/user/${userIdParam}`);
    if (res.data.code === 200) return res.data.data;
  }
  throw new Error('获取用户信息失败');
}


async function fetchUserPosts(userId, userIdParam, page = 1, size = 20) {
  let url;
  let params = { page, size };

  if (userIdParam === 'current' || isCurrentUser) {
    // 访问自己的主页
    url = '/api/content/user';
  } else {
    // 访问他人主页
    url = `/api/content/${userId}`;
  }
  try {
    const res = await axios.get(url, { params });
    if (res.data.code === 200) {
      // 关键修改：兼容两种返回结构
      if (res.data.data.records) {
        // 自己的分页结构
        return res.data.data.records || [];
      } else if (Array.isArray(res.data.data)) {
        // 他人返回直接是数组
        return res.data.data || [];
      } else if (res.data.data && typeof res.data.data === 'object') {
        // 可能返回单个对象或列表对象，统一转成数组
        return res.data.data.list || [res.data.data] || [];
      }
      return [];
    }
    return [];
  } catch (err) {
    console.error('获取内容列表失败', err);
    return [];
  }
}

async function renderProfile(user, posts, isCurrentUser) {
 const avatarUrl = await getFileUrlFromOPFS(user.avatar);
 document.getElementById('profileAvatar').src = avatarUrl;
  document.getElementById('profileUsername').textContent = user.nickname || user.username;
  document.getElementById('profileBio').textContent = user.bio || '这家伙很懒，什么都没写～';
  document.getElementById('postCount').textContent = posts.length;
  // 粉丝/关注数
  document.getElementById('followerCount').textContent = user.followers || 0;
  document.getElementById('followingCount').textContent = user.following || 0;

  // 操作按钮
  const actions = document.getElementById('profileActions');
  if (isCurrentUser) {
    actions.innerHTML = '<button class="edit-profile-btn">编辑资料</button>';
    initEditProfile(user); // 传入当前用户数据
  } else {
    actions.innerHTML = '<button class="follow-btn">+ 关注</button>';
    // TODO: 关注功能可后续添加 /api/follow
  }

  // 渲染内容
  const list = document.getElementById('profileContentList');
list.innerHTML = '';

if (posts.length === 0) {
  document.querySelector('.no-content-profile').style.display = 'block';
  return;
}

document.querySelector('.no-content-profile').style.display = 'none';

for (const post of posts) {
  const item = await createContentElement(post);  // 必须 await
  list.appendChild(item);
}
}

async function createContentElement(post) {
   const postAvatarUrl = await getFileUrlFromOPFS(post.avatar || post.userAvatar || '');
  const item = document.createElement('div');
  item.className = 'content-item';
  item.dataset.id = post.id;

  // 判断是否是自己的内容（显示编辑/删除按钮）
  const isOwn = isCurrentUser && post.userId === currentUserId;

  // ===== 媒体处理：异步获取 blob URL =====
  let mediaHtml = '';
  if ((post.type === 'IMAGE' || post.type === 'VIDEO') && post.fileUrl) {
    const src = await getFileUrlFromOPFS(post.fileUrl);

    if (post.type === 'IMAGE') {
      mediaHtml = `
        <div class="media-container">
          <img src="${src}" alt="图片" loading="lazy">
        </div>
      `;
    } else if (post.type === 'VIDEO') {
      mediaHtml = `
        <div class="media-container video-container">
          <video controls preload="metadata">
            <source src="${src}" type="video/mp4">
            你的浏览器不支持视频播放。
          </video>
        </div>
      `;
    }
  }

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

  // 生成可交互的个人评分星星
  function generateInteractiveStars(userScore = 0) {
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
 
  

  // 平均分
  const avgScore = (post.avgRating || 0).toFixed(1);

  let textHtml = '';
const fullTextRaw = (post.text || post.description || '').trim();
const fullText = fullTextRaw.trim().replace(/\n/g, '<br>'); // 支持换行显示
const maxLength = 200;
if (fullTextRaw.length > maxLength) {
  const shortTextRaw = fullTextRaw.substring(0, maxLength);
  const shortText = shortTextRaw.replace(/\n/g, '<br>');
  
  textHtml = `
    <div class="content-text-wrapper" data-id="${post.id}">
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
}else if (fullTextRaw) {
  textHtml = `<p class="content-text">${fullText}</p>`;
}

  item.innerHTML = `
    <div class="content-header">
      <img src="${postAvatarUrl}" alt="头像" class="clickable-avatar" data-userid="${post.userId}">
      <div class="user-meta">
        <h3 class="username clickable-avatar" data-userid="${post.userId}">${post.nickname || post.username}</h3>
        <p class="post-time">${formatTime(post.createTime)}</p>
      </div>

      <!-- 只有自己的内容才显示操作菜单 -->
    ${isOwn ? `
      <div class="content-menu-toggle">
        <button class="menu-btn" aria-label="更多操作">
          <i class="fas fa-ellipsis-v"></i>
        </button>
        <div class="content-menu-dropdown" style="display:none;">
          <div class="menu-item edit-item" data-id="${post.id}">
            <i class="fas fa-edit"></i> 修改
          </div>
          <div class="menu-item delete-item" data-id="${post.id}">
            <i class="fas fa-trash-alt"></i> 删除
          </div>
        </div>
      </div>
    ` : ''}

      <div class="rating">
        <span class="score" id="score-${post.id}">${avgScore}</span>
        <div class="stars">${generateStars(post.score || post.avgRating || 0)}</div>
      </div>
    </div>

    <div class="content-body">
      ${post.title ? `<h3 class="content-title">${post.title}</h3>` : ''}

      ${Array.isArray(post.tags) && post.tags.length > 0 ? `
        <div class="content-tags">
          ${post.tags.map(tag => `<span class="content-tag">#${tag.trim()}</span>`).join('')}
        </div>
      ` : ''}

      ${textHtml}
      ${mediaHtml}
    </div>

    <div class="content-footer">
      <div class="user-rating" id="userRating-${post.id}">
        <span>你的评分：</span>
        <div class="rating-stars interactive" data-contentid="${post.id}">
          ${generateInteractiveStars(post.userScore || 0)}
        </div>
      </div>
      <div class="interaction">
        <button class="interact-btn comment-btn" data-id="${post.id}">
          <i class="fas fa-comment"></i> 评论 (${post.viewCount || 0})
        </button>
      </div>
    </div>

    <!-- 评论区-->
    <div class="comments-section" id="commentsSection-${post.id}" style="display:none;">
      <div class="comments-list" id="commentsList-${post.id}"></div>
      <div class="comment-form">
        <img src="${postAvatarUrl}" alt="头像" class="clickable-avatar" data-userid="${post.userId}">
        <textarea class="comment-textarea" placeholder="写下你的评论..."></textarea>
        <button class="submit-comment-btn" data-contentid="${post.id}">发送</button>
      </div>
    </div>
  `;

  
  // 头像/用户名点击跳转到对应用户主页
  item.querySelectorAll('.clickable-avatar').forEach(el => {
    el.onclick = () => {
      const userId = el.dataset.userid;
      // 如果是当前查看的用户，跳转到自己的主页（current），否则带上具体ID
      const targetId = userId == currentUserId ? 'current' : userId;
      window.location.href = `user-detail.html?userId=${targetId}`;
    };
  });

  // 评论按钮点击展开评论区（与首页一致）
  const commentBtn = item.querySelector('.comment-btn');
  if (commentBtn) {
    commentBtn.onclick = () => {
      const section = item.querySelector('.comments-section');
      section.style.display = section.style.display === 'none' ? 'block' : 'none';
    };
  }

    // === 加载评论列表 ===
  const commentsSection = item.querySelector(`#commentsSection-${post.id}`);
  const commentsList = item.querySelector(`#commentsList-${post.id}`);

  // 展开时自动加载评论
  let commentsLoaded = false;
  commentBtn.onclick = () => {
    const isHidden = commentsSection.style.display === 'none' || !commentsSection.style.display;
    if (isHidden) {
      commentsSection.style.display = 'block';
      if (!commentsLoaded) {
        loadComments(post.id);
        commentsLoaded = true;
      }
    } else {
      commentsSection.style.display = 'none';
    }
  };

  // 加载评论函数
  async function loadComments(contentId) {
    commentsList.innerHTML = '<div style="text-align:center;padding:1rem;color:#94a3b8;">加载评论中...</div>';
    try {
      const res = await axios.get(`/api/comment/${contentId}`); 
      if (res.data.code === 200) {
        const comments = res.data.data || [];
        if (comments.length === 0) {
          commentsList.innerHTML = '<div style="text-align:center;padding:1rem;color:#94a3b8;">暂无评论，快来抢沙发~</div>';
          return;
        }
        commentsList.innerHTML = '';
        comments.forEach(cmt => {
          const cmtEl = document.createElement('div');
          cmtEl.style = 'display:flex;gap:1rem;padding:0.8rem 0;border-bottom:1px solid #f1f5f9;';
          cmtEl.innerHTML = `
            <img src="${postAvatarUrl}" alt="头像" class="clickable-avatar" data-userid="${post.userId}" style="width:36px;height:36px;border-radius:50%;flex-shrink:0;">
            <div style="flex:1;">
              <div style="font-weight:600;font-size:0.95rem;">${cmt.nickname || cmt.username}</div>
              <div style="color:#64748b;margin:0.4rem 0;">${cmt.content}</div>
              <div style="color:#94a3b8;font-size:0.85rem;">${formatTime(cmt.createTime)}</div>
            </div>
          `;
          // 点击用户名跳转
          cmtEl.querySelector('div > div:first-child').classList.add('clickable-avatar');
          cmtEl.querySelector('div > div:first-child').dataset.userid = cmt.userId;
          cmtEl.querySelector('div > div:first-child').onclick = () => {
            const targetId = cmt.userId == currentUserId ? 'current' : cmt.userId;
            window.location.href = `user-detail.html?userId=${targetId}`;
          };
          commentsList.appendChild(cmtEl);
        });
      } else {
        commentsList.innerHTML = '<div style="text-align:center;padding:1rem;color:#94a3b8;">加载失败</div>';
      }
    } catch (err) {
      commentsList.innerHTML = '<div style="text-align:center;padding:1rem;color:#94a3b8;">加载失败，请重试</div>';
    }
  }

  // === 发送评论 ===
  const submitBtn = item.querySelector('.submit-comment-btn');
  const textarea = item.querySelector('.comment-textarea');

  submitBtn.onclick = async () => {
    const content = textarea.value.trim();
    if (!content) {
      showToast('评论不能为空');
      return;
    }
    if (content.length > 500) {
      showToast('评论最多500字');
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = '发送中...';

      const res = await axios.post('/api/comment', {
        contentId: post.id,
        content: content
      }); 

      if (res.data.code === 200) {
        textarea.value = '';
        // 重新加载评论列表
        commentsLoaded = false;
        loadComments(post.id);
        // 更新评论数
        const countBtn = item.querySelector('.comment-btn');
        const currentCount = parseInt(countBtn.textContent.match(/\d+/)?.[0] || 0);
        countBtn.innerHTML = `<i class="fas fa-comment"></i> 评论 (${currentCount + 1})`;
      } else {
        showToast(res.data.message || '发送失败');
      }
    } catch (err) {
      showToast('网络错误');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '发送';
    }
  };

  // === 交互评分功能 ===
  const ratingStarsContainer = item.querySelector(`.rating-stars.interactive[data-contentid="${post.id}"]`);
  if (ratingStarsContainer) {
    const stars = ratingStarsContainer.querySelectorAll('i');

    // 鼠标悬停效果：高亮前面的星星
    stars.forEach((star, index) => {
      star.addEventListener('mouseover', () => {
        stars.forEach((s, i) => {
          if (i <= index) {
            s.classList.remove('far');
            s.classList.add('fas', 'rated');
          } else {
            s.classList.remove('fas', 'rated');
            s.classList.add('far');
          }
        });
      });
    });

    // 鼠标离开容器时恢复当前用户评分状态
    ratingStarsContainer.addEventListener('mouseleave', () => {
      updateStarsDisplay(post.userScore || 0);
    });

    // 点击评分
    stars.forEach((star, index) => {
      star.addEventListener('click', async () => {
        const newScore = index + 1;

        try {
          // 调用后端评分接口
          const res = await axios.post('/api/rating', {
            contentId: post.id,
            score: newScore
          });

          if (res.data.code === 200) {
           // 更新前端显示：个人评分星星
           post.userScore = newScore;
           updateStarsDisplay(newScore);
           try {
            const detailRes = await axios.get(`/api/content/${post.id}`);
             if (detailRes.data.code === 200) {
               const updatedContent = detailRes.data.data;

               // 更新平均分显示
               const avgScore = (updatedContent.avgRating || updatedContent.averageRating || 0).toFixed(1);
               item.querySelector(`#score-${post.id}`).textContent = avgScore;

               // 更新静态星星
               const staticStars = item.querySelector('.content-header .stars');
               if (staticStars) {
                 staticStars.innerHTML = generateStars(updatedContent.avgRating || updatedContent.averageRating || 0);
               }

               
               post.avgRating = updatedContent.avgRating || updatedContent.averageRating;
             }
           } catch (err) {
             console.error('获取最新平均分失败', err);
             // 即使失败也不影响评分成功提示
  }

  showToast('评分成功！');
} else {
            showToast(res.data.message || '评分失败');
          }
        } catch (err) {
          console.error(err);
          showToast('网络错误，评分失败');
        }
      });
    });

    // 辅助函数：根据分数更新星星显示
    function updateStarsDisplay(score) {
      stars.forEach((s, i) => {
        if (i < score) {
          s.classList.remove('far');
          s.classList.add('fas', 'rated');
        } else {
          s.classList.remove('fas', 'rated');
          s.classList.add('far');
        }
      });
    }

    // 初始显示用户已有评分
    updateStarsDisplay(post.userScore || 0);
  }

  // === 内容操作菜单（仅自己内容）===
if (isOwn) {
  const menuToggle = item.querySelector('.content-menu-toggle .menu-btn');
  const menuDropdown = item.querySelector('.content-menu-dropdown');

  menuToggle.onclick = (e) => {
    e.stopPropagation();
    // 关闭其他打开的菜单
    document.querySelectorAll('.content-menu-dropdown').forEach(d => {
      if (d !== menuDropdown) d.style.display = 'none';
    });
    // 切换当前菜单
    menuDropdown.style.display = menuDropdown.style.display === 'block' ? 'none' : 'block';
  };

 // 点击修改 - 打开模态框编辑
item.querySelector('.edit-item').onclick = () => {
  menuDropdown.style.display = 'none';
  
  const modal = document.getElementById('editContentModal');
  const currentPost = post; // 闭包捕获当前 post

  // 填充数据
  document.getElementById('editContentTitle').value = post.title || '';
  document.getElementById('editContentText').value = post.description || '';
  document.getElementById('editContentTags').value = Array.isArray(post.tags) ? post.tags.join(' ') : '';

  // 显示当前媒体
  const mediaContainer = document.getElementById('currentMediaContainer');
  mediaContainer.innerHTML = '';
  if (post.type === 'IMAGE' && post.mediaUrls?.length) {
    post.mediaUrls.forEach(url => {
      const img = document.createElement('img');
      img.src = url;
      mediaContainer.appendChild(img);
    });
  } else if (post.type === 'VIDEO' && post.mediaUrls?.length) {
    const video = document.createElement('video');
    video.src = post.mediaUrls[0];
    video.controls = true;
    mediaContainer.appendChild(video);
  }

  // 清空新媒体预览
  document.getElementById('newMediaPreview').innerHTML = '';
  document.getElementById('newMediaPreview').style.display = 'none';
  document.getElementById('newMediaInput').value = '';

  let newMediaFile = null;

  // 新媒体预览
  document.getElementById('newMediaInput').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    newMediaFile = file;

    const preview = document.getElementById('newMediaPreview');
    preview.innerHTML = '';
    preview.style.display = 'block';

    if (file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      preview.appendChild(img);
    } else if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.controls = true;
      preview.appendChild(video);
    }
  };

  // 保存修改
  document.getElementById('saveContent').onclick = async () => {
    const title = document.getElementById('editContentTitle').value.trim();
    const text = document.getElementById('editContentText').value.trim();
    const tagsInput = document.getElementById('editContentTags').value.trim();
    const tags = tagsInput ? tagsInput.split(/\s+/).filter(t => t) : [];

    if (!text && !newMediaFile && !post.mediaUrls?.length) {
      showToast('正文和媒体不能同时为空');
      return;
    }

    try {
      document.getElementById('saveContent').disabled = true;
      document.getElementById('saveContent').textContent = '保存中...';

      let mediaUrls = post.mediaUrls;

      /*// 如果更换了媒体，先上传
      if (newMediaFile) {
        const formData = new FormData();
        formData.append('file', newMediaFile);

        const uploadRes = await axios.post('/api/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (uploadRes.data.code === 200) {
          mediaUrls = [uploadRes.data.data.url];
        } else {
          showToast('媒体上传失败');
          return;
        }
      }*/

      // 更新内容
      const updateRes = await axios.put(`/api/content/${post.id}`, {
        title: title || null,
        description: text,
        tags: tags,
        mediaUrls: mediaUrls,
        type: newMediaFile ? (newMediaFile.type.startsWith('video/') ? 'VIDEO' : 'IMAGE') : post.type
      });

      if (updateRes.data.code === 200) {
        showToast('修改成功！');
        modal.classList.remove('show');

        // 刷新页面或局部更新卡片（推荐局部更新更流畅）
        location.reload(); // 简单方式：刷新页面
      } else {
        showToast(updateRes.data.message || '修改失败');
      }
    } catch (err) {
      console.error(err);
      showToast('网络错误：' + (err.response?.data?.message || '未知错误'));
    } finally {
      document.getElementById('saveContent').disabled = false;
      document.getElementById('saveContent').textContent = '保存修改';
    }
  };

  // 关闭模态框
  const closeModal = () => modal.classList.remove('show');
  document.getElementById('closeEditContentModal').onclick = closeModal;
  document.getElementById('cancelEditContent').onclick = closeModal;
  document.querySelector('#editContentModal .modal-overlay').onclick = closeModal;

  // 显示模态框
  modal.classList.add('show');
};

  // 点击删除
  item.querySelector('.delete-item').onclick = async () => {
    if (!confirm('确定要删除这条内容吗？删除后不可恢复！')) {
      return;
    }

    try {
      const res = await axios.delete(`/api/content/${post.id}`);
      if (res.data.code === 200) {
        showToast('删除成功');
        item.remove(); // 从DOM移除

        // 更新帖子数量
        const countEl = document.getElementById('postCount');
        countEl.textContent = parseInt(countEl.textContent) - 1;

        // 如果删光了，显示无内容提示
        if (document.getElementById('profileContentList').children.length === 0) {
          document.querySelector('.no-content-profile').style.display = 'block';
        }
      } else {
        showToast(res.data.message || '删除失败');
      }
    } catch (err) {
      showToast('网络错误');
      console.error(err);
    } finally {
      menuDropdown.style.display = 'none';
    }
  };

  // 点击页面其他地方关闭菜单
  document.addEventListener('click', () => {
    menuDropdown.style.display = 'none';
  });
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
  const date = new Date(timeStr);
  const now = new Date();
  const diff = now - date;
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  return date.toLocaleString();
}

// 编辑资料功能
function initEditProfile(currentUserData) {
  const modal = document.getElementById('editModal');
  const editBtn = document.querySelector('.edit-profile-btn');

  if (!editBtn) return;

  // 临时变量
  let tempAvatarFile = null;       // 原始文件对象（仅用于预览和保存）
  let tempAvatarOpfsPath = null;   // 生成的 opfs:// 路径（最终传给后端）

  editBtn.onclick = async () => {
    modal.classList.add('show');

    // 填充当前数据（头像从 OPFS 读取）
    const currentAvatarUrl = await getFileUrlFromOPFS(document.getElementById('profileAvatar').dataset.opfsPath || '');
    document.getElementById('currentAvatarPreview').src = currentAvatarUrl || document.getElementById('profileAvatar').src;

    document.getElementById('editUsername').value = document.getElementById('profileUsername').textContent.trim();
    document.getElementById('editBio').value = document.getElementById('profileBio').textContent.trim();

    document.getElementById('newAvatarPreview').style.display = 'none';
    document.getElementById('currentAvatarPreview').style.display = 'block';
    tempAvatarFile = null;
    tempAvatarOpfsPath = null;
    document.getElementById('newAvatarInput').value = '';
  };

  // 关闭模态框
  const closeModal = () => modal.classList.remove('show');
  document.getElementById('closeEditModal').onclick = closeModal;
  document.getElementById('cancelEdit').onclick = closeModal;
  document.querySelector('.modal-overlay').onclick = closeModal;

  // 头像选择与预览 + 保存到 OPFS
  document.getElementById('newAvatarInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 简单校验
    if (!file.type.startsWith('image/')) {
      showToast('请选择图片格式文件');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('图片不能超过 10MB');
      return;
    }

    // 预览
    const reader = new FileReader();
    reader.onload = async (ev) => {
      document.getElementById('previewImg').src = ev.target.result;
      document.getElementById('newAvatarPreview').style.display = 'block';
      document.getElementById('currentAvatarPreview').style.display = 'none';
    };
    reader.readAsDataURL(file);

    // 立即保存到本地 OPFS，生成路径
    const opfsPath = await saveFileToOPFS(file);
    if (opfsPath) {
      tempAvatarFile = file;
      tempAvatarOpfsPath = opfsPath;

      // 即时更新预览为 OPFS blob URL（更真实）
      const blobUrl = await getFileUrlFromOPFS(opfsPath);
      document.getElementById('previewImg').src = blobUrl;
    }
  });

  // 移除新头像预览
  document.getElementById('removeAvatar').onclick = () => {
    document.getElementById('newAvatarPreview').style.display = 'none';
    document.getElementById('currentAvatarPreview').style.display = 'block';
    tempAvatarFile = null;
    tempAvatarOpfsPath = null;
    document.getElementById('newAvatarInput').value = '';
  };

  // 保存资料
  document.getElementById('saveProfile').onclick = async () => {
    const newUsername = document.getElementById('editUsername').value.trim();
    const newBio = document.getElementById('editBio').value.trim();

    if (!newUsername) {
      showToast('用户名不能为空');
      return;
    }

    try {
      let finalAvatarPath = document.getElementById('profileAvatar').dataset.opfsPath || null;

      // 如果换了新头像，使用 OPFS 生成的路径
      if (tempAvatarOpfsPath) {
        finalAvatarPath = tempAvatarOpfsPath;

        // 即时更新页面大头像
        const newBlobUrl = await getFileUrlFromOPFS(finalAvatarPath);
        document.getElementById('profileAvatar').src = newBlobUrl;
        // 可选：保存路径到 data 属性，方便下次打开编辑框
        document.getElementById('profileAvatar').dataset.opfsPath = finalAvatarPath;
      }

      // 调用后端接口，只传字符串路径
      const updateRes = await axios.put('/api/user/modify', {
        nickname: newUsername,
        bio: newBio,
        avatar: finalAvatarPath  // 传 opfs://xxx 或 null（如果想清除头像）
      });

      if (updateRes.data.code === 200) {
        // 更新页面文字
        document.getElementById('profileUsername').textContent = newUsername;
        document.getElementById('profileBio').textContent = newBio || '这家伙很懒，什么都没写～';

        // 更新本地缓存（如果你们有存 userInfo）
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        userInfo.nickname = newUsername;
        userInfo.bio = newBio;
        userInfo.avatar = finalAvatarPath;
        localStorage.setItem('userInfo', JSON.stringify(userInfo));

        modal.classList.remove('show');
        showToast('资料更新成功！');
      } else {
        showToast(updateRes.data.message || '更新失败');
      }
    } catch (err) {
      console.error('资料更新错误', err);
      showToast('更新失败：' + (err.response?.data?.message || '网络错误'));
    }
  };
}