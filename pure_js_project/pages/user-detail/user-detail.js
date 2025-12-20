
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
    const userPosts = await fetchUserPosts(targetUser.id);

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

// 获取用户内容列表（分页）
async function fetchUserPosts(userId, page = 1, size = 20) {
  const res = await axios.get(`/api/content/user`, {
    params: { page, size }
  });
  if (res.data.code === 200) {
    return res.data.data.records || [];
  }
  return [];
}

function renderProfile(user, posts, isCurrentUser) {
  document.getElementById('profileAvatar').src = user.avatar || '../../common/images/test.png';
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

  posts.forEach(post => {
    const item = createContentElement(post);
    list.appendChild(item);
  });
}

function createContentElement(post) {
  const item = document.createElement('div');
  item.className = 'content-item';
  item.dataset.id = post.id;

  // 当前查看的用户是否是内容发布者（用于以后扩展编辑/删除按钮，目前用户主页不需要）
  // const isOwn = currentUserId && post.userId === currentUserId;

  let mediaHtml = '';
  if (post.type === 'IMAGE' && post.mediaUrls?.length) {
    mediaHtml = post.mediaUrls.map(url => 
      `<div class="media-container"><img src="${url}" alt="图片"></div>`
    ).join('');
  } else if (post.type === 'VIDEO' && post.mediaUrls?.length) {
    mediaHtml = `<div class="media-container video-container">
      <video controls><source src="${post.mediaUrls[0]}" type="video/mp4"></video>
    </div>`;
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

  item.innerHTML = `
    <div class="content-header">
      <img src="${post.avatar || '../../common/images/avatar-default.png'}" alt="头像" class="clickable-avatar" data-userid="${post.userId}">
      <div class="user-meta">
        <h3 class="username clickable-avatar" data-userid="${post.userId}">${post.nickname || post.username}</h3>
        <p class="post-time">${formatTime(post.createTime)}</p>
      </div>
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

      <p class="content-text">${post.text || post.description || ''}</p>
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
          <i class="fas fa-comment"></i> 评论 (${post.commentCount || 0})
        </button>
      </div>
    </div>

    <!-- 评论区-->
    <div class="comments-section" id="commentsSection-${post.id}" style="display:none;">
      <div class="comments-list" id="commentsList-${post.id}"></div>
      <div class="comment-form" style="margin-top:1rem;display:flex;gap:0.5rem;align-items:start;">
        <img src="${localStorage.getItem('avatar') || '../../common/images/test.png'}" style="width:40px;height:40px;border-radius:50%;flex-shrink:0;">
        <textarea class="comment-textarea" placeholder="写下你的评论..." style="flex:1;padding:0.8rem;border:1px solid #e2e8f0;border-radius:12px;resize:none;height:80px;"></textarea>
        <button class="submit-comment-btn" data-contentid="${post.id}" style="align-self:end;padding:0.8rem 1.2rem;background:#3b82f6;color:white;border:none;border-radius:12px;cursor:pointer;">发送</button>
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

  // 可选：如果后续要在用户主页也支持点击星星打分，可以在这里添加事件（与 home.js 一致）
  // 示例代码（需后端接口支持）：
  /*
  item.querySelectorAll('.rating-stars.interactive i').forEach(star => {
    star.onclick = async () => {
      const score = parseInt(star.dataset.score);
      const contentId = star.parentElement.dataset.contentid;
      try {
        await axios.post(`/api/content/${contentId}/rate`, { score });
        // 成功后可刷新平均分等（需后端返回最新数据）
        showToast('评分成功', 'success');
      } catch (err) {
        showToast('评分失败', 'error');
      }
    };
  });
  */

  // 可选：评论按钮点击展开评论区（与首页一致）
  const commentBtn = item.querySelector('.comment-btn');
  if (commentBtn) {
    commentBtn.onclick = () => {
      const section = item.querySelector('.comments-section');
      section.style.display = section.style.display === 'none' ? 'block' : 'none';
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

  editBtn.onclick = () => {
    modal.classList.add('show');

    // 填充当前数据
    document.getElementById('currentAvatarPreview').src = document.getElementById('profileAvatar').src;
    document.getElementById('editUsername').value = document.getElementById('profileUsername').textContent.trim();
    document.getElementById('editBio').value = document.getElementById('profileBio').textContent.trim();

    document.getElementById('newAvatarPreview').style.display = 'none';
    document.getElementById('currentAvatarPreview').style.display = 'block';
    tempAvatarFile = null;
    document.getElementById('newAvatarInput').value = '';
  };

  // 关闭模态框
  const closeModal = () => modal.classList.remove('show');
  document.getElementById('closeEditModal').onclick = closeModal;
  document.getElementById('cancelEdit').onclick = closeModal;
  document.querySelector('.modal-overlay').onclick = closeModal;

  // 头像预览
  document.getElementById('newAvatarInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      document.getElementById('previewImg').src = ev.target.result;
      document.getElementById('newAvatarPreview').style.display = 'block';
      document.getElementById('currentAvatarPreview').style.display = 'none';
      tempAvatarFile = file;
    };
    reader.readAsDataURL(file);
  });

  // 移除预览
  document.getElementById('removeAvatar').onclick = () => {
    document.getElementById('newAvatarPreview').style.display = 'none';
    document.getElementById('currentAvatarPreview').style.display = 'block';
    tempAvatarFile = null;
    document.getElementById('newAvatarInput').value = '';
  };

  // 保存资料（
  document.getElementById('saveProfile').onclick = async () => {
    const newUsername = document.getElementById('editUsername').value.trim();
    const newBio = document.getElementById('editBio').value.trim();

    if (!newUsername) {
      alert('用户名不能为空');
      return;
    }

    try {
      let newAvatarUrl = document.getElementById('profileAvatar').src;

      // 如果更换了头像，先上传
      if (tempAvatarFile) {
        const formData = new FormData();
        formData.append('avatar', tempAvatarFile);

        const uploadRes = await axios.put ('/api/user/info', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (uploadRes.data.code === 200) {
          newAvatarUrl = uploadRes.data.data.avatarUrl;
        } else {
          alert('头像上传失败');
          return;
        }
      }

      // 更新资料
      const updateRes = await axios.put('/api/user/info', {
        nickname: newUsername,
        bio: newBio,
        avatar: newAvatarUrl
      });

      if (updateRes.data.code === 200) {
        // 更新页面
        document.getElementById('profileUsername').textContent = newUsername;
        document.getElementById('profileBio').textContent = newBio || '这家伙很懒，什么都没写～';
        document.getElementById('profileAvatar').src = newAvatarUrl;

        // 更新本地用户信息
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        userInfo.nickname = newUsername;
        userInfo.bio = newBio;
        userInfo.avatar = newAvatarUrl;
        localStorage.setItem('userInfo', JSON.stringify(userInfo));

        modal.classList.remove('show');
        alert('资料更新成功！');
      }
    } catch (err) {
      alert('更新失败：' + (err.response?.data?.message || '未知错误'));
    }
  };
}