// 1. 密码显示/隐藏切换
function initPasswordToggle() {
  const passwordInput = document.getElementById('password');
  const toggleBtn = document.getElementById('togglePwd');
  const icon = toggleBtn.querySelector('i');

  toggleBtn.addEventListener('click', () => {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    
    // 切换图标
    if (type === 'password') {
      icon.classList.remove('fa-eye');
      icon.classList.add('fa-eye-slash');
    } else {
      icon.classList.remove('fa-eye-slash');
      icon.classList.add('fa-eye');
    }
  });
}

// 2. 记住密码功能（本地存储）
function initRememberMe() {
  // 页面加载时读取本地存储，填充表单
  const savedEmail = localStorage.getItem('savedEmail');
  const savedPassword = localStorage.getItem('savedPassword');
  if (savedEmail && savedPassword) {
    document.getElementById('email').value = savedEmail;
    document.getElementById('password').value = savedPassword;
    document.getElementById('rememberMe').checked = true;
  }
}

// 3. 登录逻辑
function initLogin() {
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const rememberMe = document.getElementById('rememberMe');
  const loginBtn = document.getElementById('loginBtn');
  const errorTip = document.getElementById('errorTip');

  loginBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    // 前端校验
    if (!email) {
      return showError('Please enter your email');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return showError('Please enter a valid email');
    }
    if (!password) {
      return showError('Please enter your password');
    }
    if (password.length < 6) {
      return showError('Password must be at least 6 characters');
    }

    // 发起登录请求
    try {
      loginBtn.disabled = true;
      showError('');

      const response = await axios.post('/login', {
        email: email, // 注意：接口若用username，需改为username: email
        password: password
      });

      // 登录成功处理
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('userInfo', JSON.stringify(user));

      // 记住密码（若勾选）
      if (rememberMe.checked) {
        localStorage.setItem('savedEmail', email);
        localStorage.setItem('savedPassword', password);
      } else {
        localStorage.removeItem('savedEmail');
        localStorage.removeItem('savedPassword');
      }

      // 跳转首页
      goToPage('../../index.html');
    } catch (error) {
      showError(error.message || 'Login failed, please try again');
    } finally {
      loginBtn.disabled = false;
    }
  });

  // 错误提示函数
  function showError(msg) {
    errorTip.textContent = msg;
  }
}

// 页面加载完成后初始化
window.onload = () => {
  initPasswordToggle();
  initRememberMe();
  initLogin();
};