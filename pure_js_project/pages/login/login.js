// 根据角色跳转不同页面

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
      // 调用接口：POST /api/login
      const response = await axios.post('/api/login', {
        username: username,
        password: password
      });

      if (response.data.code === 200) {
        const { token, user } = response.data.data;

        // 保存 token 和用户信息
        localStorage.setItem('token', token);
        localStorage.setItem('userInfo', JSON.stringify(user));

        // 判断角色并跳转
        let targetPage;
        if (user.role === 'ADMIN') {
          targetPage = '../admin/admin.html'; // 管理员后台
        } else {
          targetPage = '../home/home.html';   // 普通用户首页
        }

        // 支持 URL 中的 redirect 参数
        const params = new URLSearchParams(window.location.search);
        const redirect = params.get('redirect');
        if (redirect) {
          window.location.href = decodeURIComponent(redirect);
        } else {
          window.location.href = targetPage;
        }

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

// 主题切换功能（浅色 ↔ 深色）
document.addEventListener('DOMContentLoaded', function() {
  const body = document.body;
  const toggleBtn = document.getElementById('themeToggleBtn');
  const icon = toggleBtn.querySelector('i');

  // 从本地存储加载主题
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    body.classList.add('dark-theme');
    icon.classList.remove('fa-moon');
    icon.classList.add('fa-sun');
  } else {
    body.classList.remove('dark-theme');
    icon.classList.remove('fa-sun');
    icon.classList.add('fa-moon');
  }

  // 点击切换
  toggleBtn.addEventListener('click', () => {
    if (body.classList.contains('dark-theme')) {
      body.classList.remove('dark-theme');
      icon.classList.remove('fa-sun');
      icon.classList.add('fa-moon');
      localStorage.setItem('theme', 'light');
    } else {
      body.classList.add('dark-theme');
      icon.classList.remove('fa-moon');
      icon.classList.add('fa-sun');
      localStorage.setItem('theme', 'dark');
    }
  });
});