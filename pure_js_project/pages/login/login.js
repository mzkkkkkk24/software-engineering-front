// login.js - 完整对接 /api/login 接口

document.addEventListener('DOMContentLoaded', function () {
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('loginBtn');
  const errorTip = document.getElementById('errorTip');
  const togglePwdBtn = document.getElementById('togglePwd');

  // 密码显示/隐藏
  togglePwdBtn.addEventListener('click', () => {
    const type = passwordInput.type === 'password' ? 'text' : 'password';
    passwordInput.type = type;
    togglePwdBtn.querySelector('i').classList.toggle('fa-eye-slash', type === 'password');
    togglePwdBtn.querySelector('i').classList.toggle('fa-eye', type === 'text');
  });

  // 显示错误
  function showError(msg) {
    errorTip.textContent = msg;
  }

  // 清空错误
  function clearError() {
    errorTip.textContent = '';
  }

  // 登录处理
  async function handleLogin() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    clearError();

    if (!username) {
      return showError('请输入用户名');
    }
    if (username.length < 3 || username.length > 20) {
      return showError('用户名应为3-20个字符');
    }
    if (!password) {
      return showError('请输入密码');
    }
    if (password.length < 6 || password.length > 20) {
      return showError('密码应为6-20个字符');
    }

    loginBtn.disabled = true;
    loginBtn.textContent = '登录中...';

    try {
      // 调用真实接口：POST /api/login
      const response = await axios.post('/api/login', {
        username: username,
        password: password
      });

      // 文档中成功返回 code === 200
      if (response.data.code === 200) {
        const { token, user } = response.data.data;

        // 保存 token 和用户信息
        localStorage.setItem('token', token);
        localStorage.setItem('userInfo', JSON.stringify(user));

        // 可选：保存角色用于后续判断是否管理员
        if (user.role === 'ADMIN') {
          localStorage.setItem('isAdmin', 'true');
        } else {
          localStorage.removeItem('isAdmin');
        }

        alert('登录成功！');
        
        // 跳转：优先使用 URL 中的 redirect，否则跳转首页
        const params = new URLSearchParams(window.location.search);
        const redirect = params.get('redirect');
        window.location.href = redirect ? decodeURIComponent(redirect) : '../../home/home.html';

      } else {
        showError(response.data.message || '登录失败');
      }
    } catch (err) {
      const msg = err.response?.data?.message || '网络错误，请检查服务器或网络连接';
      showError(msg);
      console.error('登录失败:', err);
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = '立即登录';
    }
  }

  // 绑定事件
  loginBtn.addEventListener('click', handleLogin);

  // 回车登录
  passwordInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  });

  // 从注册页跳转过来自动填充用户名
  const urlParams = new URLSearchParams(window.location.search);
  const preUsername = urlParams.get('username');
  if (preUsername) {
    usernameInput.value = decodeURIComponent(preUsername);
    passwordInput.focus();
  }
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

// 新增：点击产生涟漪波纹 + 鼠标跟随光点
document.addEventListener('DOMContentLoaded', function() {
  const bg = document.querySelector('.dynamic-bg');
  const glow = document.querySelector('.mouse-glow');

  // 鼠标跟随光点
  if (glow) {
    document.addEventListener('mousemove', (e) => {
      glow.style.left = `${e.clientX}px`;
      glow.style.top = `${e.clientY}px`;
    });
  }

  // 点击产生涟漪
  document.addEventListener('click', (e) => {
    const ripple = document.createElement('div');
    ripple.classList.add('ripple');
    ripple.style.left = `${e.clientX}px`;
    ripple.style.top = `${e.clientY}px`;
    ripple.style.width = '50px';
    ripple.style.height = '50px';
    ripple.style.marginLeft = '-25px';
    ripple.style.marginTop = '-25px';

    bg.appendChild(ripple);

    // 动画结束后移除元素，避免堆积
    ripple.addEventListener('animationend', () => {
      ripple.remove();
    });
  });
});