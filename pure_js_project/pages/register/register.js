/**
 * 密码显示/隐藏切换（与登录页逻辑一致）
 */
function initPasswordToggle() {
  // 密码框切换
  const passwordInput = document.getElementById('password');
  const toggleBtn = document.getElementById('togglePwd');
  const icon = toggleBtn.querySelector('i');
  
  toggleBtn.addEventListener('click', () => togglePwdType(passwordInput, icon));

  // 确认密码框切换
  const confirmPwdInput = document.getElementById('confirmPwd');
  const toggleConfirmBtn = document.getElementById('toggleConfirmPwd');
  const confirmIcon = toggleConfirmBtn.querySelector('i');
  
  toggleConfirmBtn.addEventListener('click', () => togglePwdType(confirmPwdInput, confirmIcon));
}

// 密码显示/隐藏通用函数
function togglePwdType(input, icon) {
  const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
  input.setAttribute('type', type);
  
  if (type === 'text') {
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  } else {
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  }
}

/**
 * 注册表单验证（与登录页提示样式一致）
 */
function initRegister() {
  const usernameInput = document.getElementById('username');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmPwdInput = document.getElementById('confirmPwd');
  const registerBtn = document.getElementById('registerBtn');
  const errorTip = document.getElementById('errorTip');

  registerBtn.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const confirmPwd = confirmPwdInput.value.trim();

    // 表单验证（提示样式与登录页一致）
    if (!username) return showError('Please enter your username');
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return showError('Username must be 3-20 characters (letters/numbers/_)');
    if (!email) return showError('Please enter your email');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showError('Please enter a valid email');
    if (!password) return showError('Please enter your password');
    if (password.length < 6) return showError('Password must be at least 6 characters');
    if (password !== confirmPwd) return showError('Passwords do not match');

    // 发起注册请求（逻辑与登录页一致）
    try {
      registerBtn.disabled = true;
      showError('');

      const response = await axios.post('/register', {
        username,
        email,
        password
      });

      // 注册成功（提示与跳转风格与登录页一致）
      alert('Sign up successful! Redirecting to login page...');
      goToPage('../login/login.html?email=' + encodeURIComponent(email));
    } catch (error) {
      showError(error.message || 'Sign up failed, please try again');
    } finally {
      registerBtn.disabled = false;
    }
  });

  // 错误提示函数（与登录页一致）
  function showError(msg) {
    errorTip.textContent = msg;
  }
}

// 页面加载初始化
window.onload = () => {
  initPasswordToggle();
  initRegister();
};