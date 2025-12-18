// admin-login.js - 使用普通登录接口 + 权限判断

document.addEventListener('DOMContentLoaded', function() {
  const emailInput = document.getElementById('adminEmail');
  const passwordInput = document.getElementById('adminPassword');
  const loginBtn = document.getElementById('adminLoginBtn');
  const errorTip = document.getElementById('errorTip');
  const togglePwdBtn = document.getElementById('togglePwd');

  // 密码显示/隐藏
  togglePwdBtn.addEventListener('click', () => {
    const type = passwordInput.type === 'password' ? 'text' : 'password';
    passwordInput.type = type;
    togglePwdBtn.querySelector('i').classList.toggle('fa-eye-slash', type === 'password');
    togglePwdBtn.querySelector('i').classList.toggle('fa-eye', type === 'text');
  });

  function showError(message) {
    errorTip.textContent = message;
  }

  function clearError() {
    errorTip.textContent = '';
  }

  async function handleAdminLogin() {
    const username = emailInput.value.trim(); // 文档中登录用 username，可用邮箱作为用户名
    const password = passwordInput.value.trim();

    clearError();

    if (!username) return showError('请输入用户名/邮箱');
    if (!password) return showError('请输入密码');

    loginBtn.disabled = true;
    loginBtn.textContent = '登录中...';

    try {
      // 使用普通登录接口
      const response = await axios.post('/api/login', {
        username: username,
        password: password
      });

      if (response.data.code === 200) {
        const { token, user } = response.data.data;

        // 判断是否为管理员
        if (user.role !== 'ADMIN') {
          showError('权限不足：您不是管理员');
          loginBtn.disabled = false;
          loginBtn.textContent = '立即登录';
          return;
        }

        // 保存 token 和管理员信息
        localStorage.setItem('token', token);
        localStorage.setItem('userInfo', JSON.stringify(user));
        localStorage.setItem('isAdmin', 'true');

        alert('管理员登录成功！');
        window.location.href = 'admin.html';
      } else {
        showError(response.data.message || '登录失败');
      }
    } catch (error) {
      const msg = error.response?.data?.message || '网络错误，请检查账号密码';
      showError(msg);
      console.error('管理员登录失败:', error);
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = '立即登录';
    }
  }

  loginBtn.addEventListener('click', handleAdminLogin);

  passwordInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') handleAdminLogin();
  });
});

// 鼠标跟随光点效果
document.addEventListener('DOMContentLoaded', function() {
  const glow = document.querySelector('.mouse-glow');

  if (glow) {
    document.addEventListener('mousemove', (e) => {
      glow.style.left = e.clientX + 'px';
      glow.style.top = e.clientY + 'px';
    });

    // 鼠标离开页面时隐藏光点
    document.addEventListener('mouseleave', () => {
      glow.style.opacity = '0';
    });

    document.addEventListener('mouseenter', () => {
      glow.style.opacity = '0.6';
    });
  }
});