// register.js - 完整对接 /api/register 接口

document.addEventListener('DOMContentLoaded', function () {
  const usernameInput = document.getElementById('username');
  const nicknameInput = document.getElementById('nickname');
  const emailInput = document.getElementById('email');
  const phoneInput = document.getElementById('phone');
  const passwordInput = document.getElementById('password');
  const confirmInput = document.getElementById('confirmPwd');
  const agreeTerms = document.getElementById('agreeTerms');
  const signupBtn = document.getElementById('signupBtn');
  const globalError = document.getElementById('globalError');

  // 密码显示/隐藏
  function initPasswordToggle() {
    const togglePwd = document.getElementById('togglePwd');
    const toggleConfirm = document.getElementById('toggleConfirmPwd');

    const toggle = (input, btn) => {
      const type = input.type === 'password' ? 'text' : 'password';
      input.type = type;
      const icon = btn.querySelector('i');
      icon.classList.toggle('fa-eye-slash', type === 'password');
      icon.classList.toggle('fa-eye', type === 'text');
    };

    togglePwd.addEventListener('click', () => toggle(passwordInput, togglePwd));
    toggleConfirm.addEventListener('click', () => toggle(confirmInput, toggleConfirm));
  }

  // 密码一致性实时校验
  function initPasswordValidation() {
    const matchTip = document.getElementById('matchTip');

    const checkMatch = () => {
      const pwd = passwordInput.value;
      const confirm = confirmInput.value;

      if (confirm && pwd !== confirm) {
        matchTip.classList.add('show');
        signupBtn.disabled = true;
      } else {
        matchTip.classList.remove('show');
        signupBtn.disabled = false;
      }
    };

    passwordInput.addEventListener('input', checkMatch);
    confirmInput.addEventListener('input', checkMatch);
  }

  // 注册提交
  async function handleSignup() {
    globalError.textContent = '';

    const username = usernameInput.value.trim();
    const nickname = nicknameInput.value.trim();
    const email = emailInput.value.trim();
    const phone = phoneInput.value.trim();
    const password = passwordInput.value;
    const confirmPwd = confirmInput.value;

    // 必填校验
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
    if (password !== confirmPwd) {
      return showError('两次输入的密码不一致');
    }
    if (!agreeTerms.checked) {
      return showError('请同意服务条款和隐私政策');
    }

    signupBtn.disabled = true;
    signupBtn.textContent = '注册中...';

    try {
      // 调用真实接口 POST /api/register
      const response = await axios.post('/api/register', {
        username: username,
        password: password,
        nickname: nickname || null,  // 空字符串传 null 更安全
        email: email || null,
        phone: phone || null
      });

      if (response.data.code === 200) {
        alert('注册成功！请登录');
        // 跳转到登录页，并传递用户名方便自动填充
        window.location.href = `../login/login.html?username=${encodeURIComponent(username)}`;
      } else {
        showError(response.data.message || '注册失败');
      }
    } catch (err) {
      const msg = err.response?.data?.message || '注册失败，请检查网络或稍后重试';
      showError(msg);
      console.error('注册错误:', err);
    } finally {
      signupBtn.disabled = false;
      signupBtn.textContent = '立即注册';
    }
  }

  function showError(msg) {
    globalError.textContent = msg;
  }

  // 绑定事件
  signupBtn.addEventListener('click', handleSignup);

  // 回车提交（在确认密码框按回车）
  confirmInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      handleSignup();
    }
  });

  // 初始化
  initPasswordToggle();
  initPasswordValidation();
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

// 点击产生涟漪波纹 + 鼠标跟随光点
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