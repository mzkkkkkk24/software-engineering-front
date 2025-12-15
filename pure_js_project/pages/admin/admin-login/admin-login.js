// admin-login.js - 管理员登录逻辑

document.addEventListener('DOMContentLoaded', function() {
  const emailInput = document.getElementById('adminEmail');
  const passwordInput = document.getElementById('adminPassword');
  const loginBtn = document.getElementById('adminLoginBtn');
  const errorTip = document.getElementById('errorTip');
  const togglePwdBtn = document.getElementById('togglePwd');
  const rememberMe = document.getElementById('rememberMe');

  // 密码显示/隐藏切换
  togglePwdBtn.addEventListener('click', () => {
    const type = passwordInput.type === 'password' ? 'text' : 'password';
    passwordInput.type = type;
    togglePwdBtn.querySelector('i').classList.toggle('fa-eye-slash', type === 'password');
    togglePwdBtn.querySelector('i').classList.toggle('fa-eye', type === 'text');
  });

  // 显示错误提示
  function showError(message) {
    errorTip.textContent = message;
  }

  // 清空错误提示
  function clearError() {
    errorTip.textContent = '';
  }

  // 登录处理
  async function handleAdminLogin() {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    clearError();

    if (!email) {
      return showError('请输入管理员邮箱');
    }
    if (!password) {
      return showError('请输入密码');
    }

    loginBtn.disabled = true;
    loginBtn.textContent = '登录中...';

    try {
      // 实际项目中调用管理员专用登录接口
      const response = await axios.post('/api/admin/login', {
        email: email,
        password: password,
        rememberMe: rememberMe.checked
      });

      if (response.data.code === 200 || response.data.success) {
        // 保存管理员 token（可与普通用户区分存储）
        localStorage.setItem('adminToken', response.data.data.token);
        localStorage.setItem('adminInfo', JSON.stringify(response.data.data.user));

        alert('管理员登录成功！');
        window.location.href = '../admin/admin.html'; // 跳转到管理后台
      } else {
        showError(response.data.message || '登录失败');
      }
    } catch (error) {
      const msg = error.response?.data?.message || '网络错误，请稍后重试';
      showError(msg);
      console.error('管理员登录错误:', error);
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = '立即登录';
    }
  }

  // 绑定事件
  loginBtn.addEventListener('click', handleAdminLogin);

  // 回车登录
  passwordInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      handleAdminLogin();
    }
  });
});