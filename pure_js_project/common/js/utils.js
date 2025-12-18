// 添加 Toast 通知函数
/**
 * 显示 Toast 通知
 * @param {string} message - 消息内容
 * @param {string} type - 类型：'success' | 'error' | 'info'（默认 info）
 * @param {number} duration - 显示时长（毫秒，默认 3000）
 */
function showToast(message, type = 'info', duration = 3000) {
  // 创建容器（如果不存在）
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  // 创建 toast 元素
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  // 根据类型添加图标
  let icon = '';
  if (type === 'success') icon = '<i class="fas fa-check-circle"></i>';
  else if (type === 'error') icon = '<i class="fas fa-exclamation-circle"></i>';
  else icon = '<i class="fas fa-info-circle"></i>';

  toast.innerHTML = `${icon}<span>${message}</span>`;

  container.appendChild(toast);

  // 触发显示动画
  requestAnimationFrame(() => toast.classList.add('show'));

  // 自动消失
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => {
      if (toast.parentElement) toast.parentElement.removeChild(toast);
    });
  }, duration);
}