// 头部组件
const HeaderComponent = {
    props: ['user'],
    emits: ['logout'],
    template: `
        <div class="header">
            <div>
                <h2 style="margin: 0;">🚇 隧道代理管理系统</h2>
            </div>
            <div>
                <span>欢迎, {{user?.username}}</span>
                <el-button @click="handleLogout" type="text" style="color: white; margin-left: 10px;">退出</el-button>
            </div>
        </div>
    `,
    methods: {
        handleLogout() {
            this.$emit('logout');
        }
    }
};

window.HeaderComponent = HeaderComponent; 