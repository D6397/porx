// 登录组件
const LoginComponent = {
    props: ['loginForm'],
    emits: ['login'],
    template: `
        <div class="login-container">
            <div class="login-box">
                <div class="logo">
                    <h1>🚇 隧道代理管理系统</h1>
                    <p>请登录管理控制台</p>
                </div>
                <el-form @submit.prevent="handleLogin">
                    <el-form-item>
                        <el-input v-model="loginForm.username" placeholder="用户名" prefix-icon="User" size="large"></el-input>
                    </el-form-item>
                    <el-form-item>
                        <el-input v-model="loginForm.password" type="password" placeholder="密码" prefix-icon="Lock" size="large" @keyup.enter="handleLogin"></el-input>
                    </el-form-item>
                    <el-form-item>
                        <el-button type="primary" @click="handleLogin" style="width: 100%" size="large">登录</el-button>
                    </el-form-item>
                </el-form>
                <div style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
                    默认账号: admin / admin123
                </div>
            </div>
        </div>
    `,
    methods: {
        handleLogin() {
            this.$emit('login');
        }
    }
};

window.LoginComponent = LoginComponent; 