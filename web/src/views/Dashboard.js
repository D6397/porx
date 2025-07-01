// 仪表盘视图组件
const DashboardView = {
    props: ['stats', 'users'],
    template: `
        <div>
            <h3>系统概览</h3>
            <el-row :gutter="20">
                <el-col :span="8">
                    <el-card>
                        <div style="text-align: center;">
                            <div style="font-size: 24px; color: #409EFF;">{{stats.totalUsers}}</div>
                            <div>总用户数</div>
                        </div>
                    </el-card>
                </el-col>
                <el-col :span="8">
                    <el-card>
                        <div style="text-align: center;">
                            <div style="font-size: 24px; color: #67C23A;">{{stats.activeConnections}}</div>
                            <div>活跃连接</div>
                        </div>
                    </el-card>
                </el-col>
                <el-col :span="8">
                    <el-card>
                        <div style="text-align: center;">
                            <div style="font-size: 24px; color: #E6A23C;">{{stats.totalServers}}</div>
                            <div>代理服务器</div>
                        </div>
                    </el-card>
                </el-col>
            </el-row>
            
            <h3 style="margin-top: 30px;">最近用户</h3>
            <el-table :data="users.slice(0, 5)" style="width: 100%">
                <el-table-column prop="username" label="用户名"></el-table-column>
                <el-table-column prop="status" label="状态">
                    <template #default="scope">
                        <el-tag :type="scope.row.status === 'active' ? 'success' : 'danger'">
                            {{scope.row.status === 'active' ? '活跃' : '禁用'}}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column prop="created_at" label="创建时间">
                    <template #default="scope">
                        {{new Date(scope.row.created_at).toLocaleDateString()}}
                    </template>
                </el-table-column>
            </el-table>
        </div>
    `
};

window.DashboardView = DashboardView; 