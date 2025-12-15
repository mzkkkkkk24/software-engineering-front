
// 加载公共导航栏
function loadHeader() {
  fetch('../../common/components/header.html')
    .then(res => res.text())
    .then(html => {
      document.getElementById('header-container').innerHTML = html;
    })
    .catch(err => console.error('加载导航栏失败：', err));
}

//登录核心逻辑
function initLogin() {
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('loginBtn');
  const errorTip = document.getElementById('errorTip');

  const togglePwdBtn = document.getElementById('togglePwd');
  const pwdIcon = togglePwdBtn.querySelector('i');
  
  togglePwdBtn.addEventListener('click', () => {
    // 切换输入框类型（password ↔ text）
    const isHidden = passwordInput.type === 'password';
    passwordInput.type = isHidden ? 'text' : 'password';
    // 切换图标（fa-eye-slash ↔ fa-eye）
    pwdIcon.classList.toggle('fa-eye-slash', !isHidden);
    pwdIcon.classList.toggle('fa-eye', isHidden);
  });

  // 防抖处理：防止快速重复点击
  const handleLogin = debounce(async () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    //前端参数校验
    if (!username) {
      return showError('Please enter your username');
    }
    if (!isUsernameValid(username)) {
      return showError('Invalid Username');
    }
    if (!password) {
      return showError('Please enter your password');
    }
    if (password.length < 6 || password.length > 20) {
      return showError('Invalid Password Length');
    }

    //发起登录请求
    try {
      loginBtn.disabled = true;
      showError('');

      // 调用登录接口
      const response = await axios.post('/login', {
        email: username, // 后端接收邮箱参数名为email，需对应
        password: password,
        rememberMe: remember // 传递"记住我"状态，用于后端设置token过期时间
      });

     //登录成功处理（根据后端返回结构调整）
      // 后端返回格式：{ code: 200, data: { token, user }, message: "success" }
      if (response.data.code === 200) {
        const { token, user } = response.data.data;
        localStorage.setItem('token', token);
        localStorage.setItem('userInfo', JSON.stringify(user));

        // 跳转逻辑
        const urlParams = new URLSearchParams(window.location.search);
        const redirectUrl = urlParams.get('redirect') || '../../home.html';
        goToPage(decodeURIComponent(redirectUrl));
      } else {
        showError(response.data.message || '登录失败');
      }
    } catch (error) {
      // 6. 处理失败（网络错误或后端异常）
      showError(error.response?.data?.message || '登录失败，请检查网络或账号密码');
    } finally {
      loginBtn.disabled = false;
    }
  });

  // 绑定点击事件
  loginBtn.addEventListener('click', handleLogin);

  // 绑定回车事件（输入密码后按回车登录）
  passwordInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') handleLogin();
  });

  // 错误提示显示函数
  function showError(msg) {
    errorTip.textContent = msg;
  }
}

// 新增邮箱格式校验函数
function isEmailValid(email) {
  const reg = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return reg.test(email);
}

// 页面加载完成后执行
window.onload = () => {
  loadHeader();
  initLogin();
  // 自动填充注册页跳转过来的用户名
  fillUsernameFromUrl();
};

// 从URL参数中获取用户名并填充
function fillUsernameFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const username = urlParams.get('username');
  if (username) {
    document.getElementById('username').value = decodeURIComponent(username);
  }
}