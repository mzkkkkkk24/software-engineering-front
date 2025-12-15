
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
      ${content.type === 'video' ? `<div class="media-container video-container"><video controls><source src="${content.mediaUrl}"></video></div>` : ''}
    </div>
    <div class="content-footer">
      <div class="rating">
        <span class="score">${content.score || '0.0'}</span>
        <div class="stars">${generateStars(content.score || 0)}</div>
      </div>
    </div>
  `;
  return item;
}