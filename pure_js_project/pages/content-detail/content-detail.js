let currentUser = null;
let contentId = null;
let commentPage = 1;
const commentPageSize = 10;
let hasMoreComments = true;

document.addEventListener('DOMContentLoaded', async () => {
  // 检查登录
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '../login/login.html';
    return;
  }

  // 获取内容ID
  const params = new URLSearchParams(window.location.search);
  contentId = params.get('id');
  if (!contentId) {
    alert('无效的内容ID');
    window.history.back();
    return;
  }

  await loadCurrentUser();
  await loadContentDetail();
  await loadComments(true);
});

async function loadCurrentUser() {
  try {
    const res = await axios.get('/api/user/info');
    if (res.data.code === 200) {
      currentUser = res.data.data;
      document.getElementById('userAvatar').src = currentUser.avatar || '../../common/images/avatar-default.png';
      document.getElementById('currentUserAvatar').src = currentUser.avatar || '../../common/images/avatar-default.png';
    }
  } catch (err) {
    console.error(err);
    if (err.response?.status === 401) {
      localStorage.clear();
      window.location.href = '../../login/login.html';
    }
  }
}

async function loadContentDetail() {
  try {
    const res = await axios.get(`/api/content/${contentId}`);
    if (res.data.code === 200) {
      const content = res.data.data;
      renderContentDetail(content);
    } else {
      alert('内容不存在或已被删除');
      window.history.back();
    }
  } catch (err) {
    alert('加载内容失败');
    console.error(err);
  }
}

function renderContentDetail(content) {
  const card = document.getElementById('contentDetailCard');

  let mediaHtml = '';
  if (content.type === 'IMAGE' && content.mediaUrls?.length) {
    mediaHtml = content.mediaUrls.map(url =>
      `<div class="media-container"><img src="${url}" alt="图片"></div>`
    ).join('');
  } else if (content.type === 'VIDEO' && content.mediaUrls?.length) {
    mediaHtml = `<div class="media-container"><video controls><source src="${content.mediaUrls[0]}" type="video/mp4"></video></div>`;
  }

  const isOwn = currentUser && content.userId === currentUser.id;
  const actionsHtml = isOwn ? `
    <div style="margin-top:1rem;text-align:right;">
      <button class="delete-btn" data-id="${content.id}">删除</button>
    </div>` : '';

  card.innerHTML = `
    <div class="content-header">
      <img src="${content.avatar || '../../common/images/avatar-default.png'}" alt="头像"
           class="clickable-avatar" data-userid="${content.userId}">
      <div class="user-meta">
        <h3 class="clickable-avatar" data-userid="${content.userId}">${content.nickname || content.username}</h3>
        <p>${formatTime(content.createTime)}</p>
      </div>
    </div>
    <div class="content-body">
      <p class="content-text">${content.text || ''}</p>
      ${mediaHtml}
      <div class="tags">
        ${content.tags?.map(tag => `<span class="tag">${tag}</span>`).join('') || ''}
      </div>
    </div>
    ${actionsHtml}
  `;

  // 点击头像/用户名跳转个人主页
  card.querySelectorAll('.clickable-avatar').forEach(el => {
    el.onclick = () => {
      const userId = el.dataset.userid;
      const url = userId == currentUser?.id ? 'current' : userId;
      window.location.href = `../user-detail/user-detail.html?userId=${url}`;
    };
  });

  // 删除内容
  const deleteBtn = card.querySelector('.delete-btn');
  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      if (confirm('确定删除这条内容吗？')) {
        try {
          await axios.delete(`/api/content/${content.id}`);
          alert('删除成功');
          window.location.href = '../home/home.html';
        } catch (err) {
          alert('删除失败');
        }
      }
    };
  }
}

// 加载评论
async function loadComments(isRefresh = false) {
  if (isRefresh) {
    commentPage = 1;
    hasMoreComments = true;
    document.getElementById('commentsList').innerHTML = '';
  }

  if (!hasMoreComments) return;

  try {
    const res = await axios.get(`/api/comment/list/${contentId}`, {
      params: { page: commentPage, size: commentPageSize }
    });

    if (res.data.code === 200) {
      const { records, total, pages } = res.data.data;
      renderComments(records);
      document.getElementById('commentCount').textContent = total;

      commentPage++;
      hasMoreComments = commentPage <= pages;
      document.getElementById('loadMoreCommentsBtn').style.display = hasMoreComments ? 'block' : 'none';
    }
  } catch (err) {
    console.error(err);
  }
}

function renderComments(comments) {
  const list = document.getElementById('commentsList');

  comments.forEach(comment => {
    const item = document.createElement('div');
    item.className = 'comment-item';
    item.innerHTML = `
      <img src="${comment.avatar || '../../common/images/test.png'}" alt="头像">
      <div class="comment-content">
        <div class="comment-meta">
          <h4>${comment.nickname || comment.username}</h4>
          <span>${formatTime(comment.createTime)}</span>
        </div>
        <div class="comment-text">${comment.content}</div>
        <div class="comment-actions">
          <button class="reply-btn" data-id="${comment.id}">回复</button>
          ${currentUser && comment.userId === currentUser.id ? '<button class="delete-comment-btn" data-id="' + comment.id + '">删除</button>' : ''}
        </div>
      </div>
    `;

    // 删除评论
    const delBtn = item.querySelector('.delete-comment-btn');
    if (delBtn) {
      delBtn.onclick = async () => {
        if (confirm('确定删除这条评论吗？')) {
          try {
            await axios.delete(`/api/comment/${comment.id}`);
            item.remove();
          } catch (err) {
            alert('删除失败');
          }
        }
      };
    }

    list.appendChild(item);
  });
}

// 发布评论
document.getElementById('submitCommentBtn').onclick = async () => {
  const input = document.getElementById('commentInput');
  const content = input.value.trim();
  if (!content) {
    alert('请输入评论内容');
    return;
  }

  try {
    await axios.post('/api/comment', {
      contentId: parseInt(contentId),
      content: content
    });
    input.value = '';
    await loadComments(true); // 刷新评论列表
  } catch (err) {
    alert('评论失败：' + (err.response?.data?.message || ''));
  }
};

// 加载更多评论
document.getElementById('loadMoreCommentsBtn').onclick = () => loadComments();

// 时间格式化（复用 home.js 中的函数）
function formatTime(timeStr) {
  const date = new Date(timeStr);
  const now = new Date();
  const diff = now - date;
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  if (diff < 2592000000) return Math.floor(diff / 86400000) + '天前';
  return date.toLocaleDateString();
}