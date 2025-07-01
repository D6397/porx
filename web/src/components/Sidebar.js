// 侧边栏组件
const SidebarComponent = {
    props: ['currentView'],
    emits: ['menu-select'],
    template: `
        <div class="sidebar">
            <el-menu :default-active="currentView" @select="handleMenuSelect">
                <el-menu-item index="dashboard">
                    <span>📊 仪表盘</span>
                </el-menu-item>
                <el-menu-item index="users">
                    <span>👥 用户管理</span>
                </el-menu-item>
                <el-menu-item index="servers">
                    <span>🖥️ 服务器管理</span>
                </el-menu-item>
                <el-menu-item index="logs">
                    <span>📋 日志查看</span>
                </el-menu-item>
            </el-menu>
        </div>
    `,
    methods: {
        handleMenuSelect(key) {
            this.$emit('menu-select', key);
        }
    }
};

window.SidebarComponent = SidebarComponent; 