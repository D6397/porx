// API配置
const api = axios.create({
    baseURL: '/api'
});

// 请求拦截器
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// 响应拦截器
api.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401) {
            // 检查是否是关键认证接口失败
            const isAuthEndpoint = error.config?.url?.includes('/auth/me');
            const isLoginEndpoint = error.config?.url?.includes('/auth/login');
            
            if (isAuthEndpoint || isLoginEndpoint) {
                localStorage.removeItem('token');
                location.reload();
            } else {
                // 非关键接口失败时只显示错误消息，不跳转登录页面
                console.warn('API认证失败:', error.config?.url);
            }
        }
        return Promise.reject(error);
    }
);

// 导出API实例
window.api = api; 