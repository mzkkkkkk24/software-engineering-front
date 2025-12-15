// user-detail.js（修正版 - 编辑资料按钮可点击）

let tempAvatarFile = null;

document.addEventListener('DOMContentLoaded', async function() {
  const urlParams = new URLSearchParams(window.location.search);
  const userId = urlParams.get('userId') || 'current';

  try {
    const userInfo = await fetchUserInfo(userId);
    const userPosts = await fetchUserPosts(userId);

    renderProfile(userInfo, userPosts, userId === 'current');
  } catch (error) {
    console.error('加载失败', error);
    document.getElementById('profileContentList').innerHTML = '<div class="no-content-profile">加载失败，请刷新重试</div>';
  }
});

// 模拟数据（实际项目中替换为真实接口）
async function fetchUserInfo(userId) {
  if (userId === 'current') {
    return {
      username: '我',
      avatar: '../../common/images/avatar-default.png',
      bio: '热爱生活，记录美好瞬间～',
      followers: 128,
      following: 86
    };
  } else {
    return {
      username: '张小明',
      avatar: '../../common/images/avatar-1.png',
      bio: '摄影爱好者 | 旅行达人 | 分享沿途风景',
      followers: 342,
      following: 156
    };
  }
}

async function fetchUserPosts(userId) {
  return [
    {
      type: 'image',
      text: '周末去了湖边露营，风景真的太美了！推荐给大家～',
      mediaUrl: '../../common/images/post-1.jpg',
      score: 4.8,
      comments: 8,
      time: '今天 09:24'
    },
    {
      type: 'video',
      text: '今天尝试做了红烧肉，第一次成功！',
      mediaUrl: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
      score: 4.9,
      comments: 24,
      time: '昨天 18:36'
    }
  ];
}

function renderProfile(user, posts, isCurrentUser) {
  // 更新基本信息
  document.getElementById('profileAvatar').src = user.avatar;
  document.getElementById('profileUsername').textContent = user.username;
  document.getElementById('profileBio').textContent = user.bio || '这家伙很懒，什么都没写～';
  document.getElementById('postCount').textContent = posts.length;
  document.getElementById('followerCount').textContent = user.followers;
  document.getElementById('followingCount').textContent = user.following;

  // 渲染操作按钮
  const actions = document.getElementById('profileActions');
  if (isCurrentUser) {
    actions.innerHTML = '<button class="edit-profile-btn">编辑资料</button>';
    // 在按钮渲染完成后立即绑定事件
    initEditProfile();
  } else {
    actions.innerHTML = '<button class="follow-btn">+ 关注</button>';
  }

  // 渲染内容列表
  const list = document.getElementById('profileContentList');
  list.innerHTML = '';

  if (posts.length === 0) {
    document.querySelector('.no-content-profile').style.display = 'block';
    return;
  }

  posts.forEach(post => {
    const item = createContentElement({
      ...post,
      username: user.username,
      avatar: user.avatar,
      isOwn: isCurrentUser
    });
    list.appendChild(item);
  });
}

function createContentElement(content) {
  const item = document.createElement('div');
  item.className = 'content-item';
  item.innerHTML = `
    <div class="content-header">
      <img src="${content.avatar}" alt="头像">
      <div class="user-meta">
        <h3 class="username">${content.username}</h3>
        <p class="post-time">${content.time || '刚刚'}</p>
      </div>
    </div>
    <div class="content-body">
      <p class="content-text">${content.text}</p>
      ${content.type === 'image' ? `<div class="media-container"><img src="${content.mediaUrl}" alt="图片"></div>` : ''}
      ${content.type === 'video' ? `<div class="media-container video-container"><video controls><source src="${content.mediaUrl}" type="video/mp4"></video></div>` : ''}
    </div>
    <div class="content-footer">
      <div class="rating">
        <span class="score">${content.score || '0.0'}</span>
        <div class="stars">${generateStars(content.score || 0)}</div>
      </div>
      <div class="interaction">
        <button class="interact-btn comment-btn"><i class="fas fa-comment"></i> 评论 (${content.comments || 0})</button>
      </div>
    </div>
  `;
  return item;
}

function generateStars(score) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(score)) html += '<i class="fas fa-star"></i>';
    else if (i - 0.5 <= score) html += '<i class="fas fa-star-half-alt"></i>';
    else html += '<i class="far fa-star"></i>';
  }
  return html;
}

// 编辑资料功能（关键：独立函数，确保按钮存在后再绑定）
function initEditProfile() {
  const editBtn = document.querySelector('.edit-profile-btn');
  const modal = document.getElementById('editModal');

  if (!editBtn) return; // 保险

  editBtn.onclick = () => {
    modal.classList.add('show');

    // 填充当前数据
    document.getElementById('currentAvatarPreview').src = document.getElementById('profileAvatar').src;
    document.getElementById('editUsername').value = document.getElementById('profileUsername').textContent.trim();
    document.getElementById('editBio').value = document.getElementById('profileBio').textContent.trim();

    // 重置头像预览
    document.getElementById('newAvatarPreview').style.display = 'none';
    document.getElementById('currentAvatarPreview').style.display = 'block';
    tempAvatarFile = null;
    document.getElementById('newAvatarInput').value = '';
  };

  // 关闭模态框（多个方式）
  const closeModal = () => modal.classList.remove('show');
  document.getElementById('closeEditModal').onclick = closeModal;
  document.getElementById('cancelEdit').onclick = closeModal;
  document.querySelector('.modal-overlay').onclick = closeModal;

  // 更换头像预览
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

  // 删除新头像
  document.getElementById('removeAvatar').onclick = () => {
    document.getElementById('newAvatarPreview').style.display = 'none';
    document.getElementById('currentAvatarPreview').style.display = 'block';
    tempAvatarFile = null;
    document.getElementById('newAvatarInput').value = '';
  };

  // 保存更改
  document.getElementById('saveProfile').onclick = () => {
    const newUsername = document.getElementById('editUsername').value.trim();
    const newBio = document.getElementById('editBio').value.trim();

    if (!newUsername) {
      alert('用户名不能为空！');
      return;
    }

    // 更新头像（使用预览图或原图）
    const newAvatarUrl = tempAvatarFile 
      ? document.getElementById('previewImg').src 
      : document.getElementById('profileAvatar').src;

    // 更新页面显示
    document.getElementById('profileUsername').textContent = newUsername;
    document.getElementById('profileBio').textContent = newBio || '这家伙很懒，什么都没写～';
    document.getElementById('profileAvatar').src = newAvatarUrl;

    modal.classList.remove('show');
    alert('资料修改成功！（前端已更新，实际项目需调用后端接口保存）');
  };
}