// 允许跨域请求携带cookie
axios.defaults.withCredentials = true;
// 配置axios默认基础路径（后端服务地址）
axios.defaults.baseURL = 'http://localhost:8080'; 

axios.defaults.baseURL = ''; // 根据实际部署调整

axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axios.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.clear();
      window.location.href = '../../login/login.html';
    }
    return Promise.reject(err);
  }
);