/**
 * 密码显示/隐藏切换
 */
function initPasswordToggle() {
  // 密码框切换
  const pwdInput = document.getElementById('password');
  const pwdToggle = document.getElementById('togglePwd');
  // 确认密码框切换
  const confirmInput = document.getElementById('confirmPwd');
  const confirmToggle = document.getElementById('toggleConfirmPwd');

  // 通用切换函数
  const togglePwdType = (input, btn) => {
    const currentType = input.getAttribute('type');
    const newType = currentType === 'password' ? 'text' : 'password';
    input.setAttribute('type', newType);
    
    // 切换图标
    const icon = btn.querySelector('i');
    if (newType === 'text') {
      icon.classList.remove('fa-eye-slash');
      icon.classList.add('fa-eye');
    } else {
      icon.classList.remove('fa-eye');
      icon.classList.add('fa-eye-slash');
    }
  };

  pwdToggle.addEventListener('click', () => togglePwdType(pwdInput, pwdToggle));
  confirmToggle.addEventListener('click', () => togglePwdType(confirmInput, confirmToggle));
}

/**
 * 密码一致性实时校验
 */
function initPasswordValidation() {
  const passwordInput = document.getElementById('password');
  const confirmInput = document.getElementById('confirmPwd');
  const matchTip = document.getElementById('matchTip');
  const signupBtn = document.getElementById('signupBtn');

  // 实时校验函数
  const checkMatch = () => {
    const pwd = passwordInput.value.trim();
    const confirmPwd = confirmInput.value.trim();

    // 有值且不一致时显示提示
    if (pwd && confirmPwd && pwd !== confirmPwd) {
      matchTip.classList.add('show');
      confirmInput.style.borderColor = '#ef4444'; // 红色边框强调
      signupBtn.disabled = true; // 禁用注册按钮
    } else {
      matchTip.classList.remove('show');
      confirmInput.style.borderColor = ''; // 恢复默认边框
      signupBtn.disabled = false; // 启用注册按钮
    }
  };

  // 绑定输入事件（实时触发校验）
  passwordInput.addEventListener('input', checkMatch);
  confirmInput.addEventListener('input', checkMatch);
}

/**
 * 注册表单提交逻辑
 */
function initSignupSubmit() {
  const fullnameInput = document.getElementById('fullname');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmInput = document.getElementById('confirmPwd');
  const agreeTerms = document.getElementById('agreeTerms');
  const signupBtn = document.getElementById('signupBtn');
  const globalError = document.getElementById('globalError');

  signupBtn.addEventListener('click', async () => {
    // 清空全局错误提示
    globalError.textContent = '';

    // 基础字段校验
    const fullname = fullnameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const confirmPwd = confirmInput.value.trim();

    // 姓名校验
    if (!fullname) {
      globalError.textContent = 'Please enter your full name';
      return;
    }

    // 邮箱校验
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      globalError.textContent = 'Please enter a valid email';
      return;
    }

    // 密码长度校验
    if (password.length < 20) {
      globalError.textContent = 'Password must be at least 6 characters';
      return;
    }

    // 密码一致性最终校验
    if (password !== confirmPwd) {
      globalError.textContent = 'Passwords do not match';
      return;
    }

    // 条款同意校验
    if (!agreeTerms.checked) {
      globalError.textContent = 'Please agree to Terms & Privacy Policy';
      return;
    }

    // 提交请求（防止重复提交）
    signupBtn.disabled = true;
    signupBtn.textContent = 'Signing up...';

    try {
      // 调用注册接口
      const response = await axios.post('/api/register', {
        fullname,
        email,
        password
      });

      // 注册成功：跳转到登录页
      if (response.data.success) {
        alert('Registration successful! Please log in.');
        window.location.href = '../login/login.html';
      }
    } catch (error) {
      // 错误处理
      const errorMsg = error.response?.data?.message || 'Registration failed. Please try again.';
      globalError.textContent = errorMsg;
    } finally {
      // 恢复按钮状态
      signupBtn.disabled = false;
      signupBtn.textContent = 'Sign up';
    }
  });
}

/**
 * 页面初始化
 */
window.onload = () => {
  initPasswordToggle();
  initPasswordValidation();
  initSignupSubmit();
};