
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
  const res = await axios.get(`/api/content/user/${userId}`, {
    params: { page, size }
  });
  if (res.data.code === 200) {
    return res.data.data.records || [];
  }
  return [];
}

function renderProfile(user, posts, isCurrentUser) {
  document.getElementById('profileAvatar').src = user.avatar || '../../common/images/avatar-default.png';
  document.getElementById('profileUsername').textContent = user.nickname || user.username;
  document.getElementById('profileBio').textContent = user.bio || '这家伙很懒，什么都没写～';
  document.getElementById('postCount').textContent = posts.length;
  // 粉丝/关注数（接口未明确，暂用模拟或后端返回）
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

  item.innerHTML = `
    <div class="content-header">
      <img src="${post.avatar || '../../common/images/avatar-default.png'}" alt="头像">
      <div class="user-meta">
        <h3 class="username">${post.nickname || post.username}</h3>
        <p class="post-time">${formatTime(post.createTime)}</p>
      </div>
    </div>
    <div class="content-body">
      <p class="content-text">${post.text || ''}</p>
      ${mediaHtml}
    </div>
    <div class="content-footer">
      <div class="rating">
        <span class="score">${post.score || '0.0'}</span>
        <div class="stars">${generateStars(post.score || 0)}</div>
      </div>
      <div class="interaction">
        <button class="interact-btn comment-btn">
          <i class="fas fa-comment"></i> 评论 (${post.commentCount || 0})
        </button>
      </div>
    </div>
  `;
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

// 编辑资料功能（完整对接）
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

  // 保存资料（真实接口）
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

        const uploadRes = await axios.post('/api/user/avatar', formData, {
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
      const updateRes = await axios.put('/api/user/profile', {
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