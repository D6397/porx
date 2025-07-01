// 日志查看视图组件
const LogsView = {
    props: [
        'logs', 'logStats', 'logsLoading', 'logFilters', 'logPagination'
    ],
    emits: [
        'load-logs', 'export-logs', 'clear-logs', 'handle-log-type-change'
    ],
    methods: {
        formatDate(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.toLocaleString('zh-CN');
        },
        getLevelType(level) {
            const typeMap = {
                'error': 'danger',
                'warn': 'warning',
                'info': 'success',
                'debug': 'info',
                'auth_failed': 'danger',
                'auth_success': 'success',
                'connect': 'primary',
                'disconnect': 'info'
            };
            return typeMap[level] || 'info';
        }
    },
    template: `
        <div>
            <h3>系统日志</h3>
            
            <!-- 日志筛选 -->
            <el-card style="margin-bottom: 20px;">
                <el-form inline>
                    <el-form-item label="日志类型">
                        <el-select v-model="logFilters.type" @change="$emit('handle-log-type-change')" style="width: 120px;">
                            <el-option label="连接日志" value="connection"></el-option>
                            <el-option label="系统日志" value="system"></el-option>
                            <el-option label="错误日志" value="error"></el-option>
                            <el-option label="访问日志" value="access"></el-option>
                        </el-select>
                    </el-form-item>
                    <el-form-item label="日志级别">
                        <el-select v-model="logFilters.level" @change="$emit('handle-log-type-change')" style="width: 100px;">
                            <el-option label="全部" value="all"></el-option>
                            <el-option label="信息" value="info"></el-option>
                            <el-option label="警告" value="warn"></el-option>
                            <el-option label="错误" value="error"></el-option>
                        </el-select>
                    </el-form-item>
                    <el-form-item label="显示条数">
                        <el-select v-model="logFilters.lines" @change="$emit('handle-log-type-change')" style="width: 100px;">
                            <el-option label="50" :value="50"></el-option>
                            <el-option label="100" :value="100"></el-option>
                            <el-option label="200" :value="200"></el-option>
                            <el-option label="500" :value="500"></el-option>
                        </el-select>
                    </el-form-item>
                    <el-form-item>
                        <el-button @click="$emit('load-logs')" type="primary">刷新</el-button>
                        <el-button @click="$emit('export-logs')" type="success">导出</el-button>
                        <el-button @click="$emit('clear-logs')" type="danger">清理</el-button>
                    </el-form-item>
                </el-form>
            </el-card>
            
            <!-- 日志统计 -->
            <el-row :gutter="20" style="margin-bottom: 20px;" v-if="logStats">
                <el-col :span="6">
                    <el-card>
                        <div style="text-align: center;">
                            <div style="font-size: 20px; color: #409EFF;">{{logStats.today?.total || 0}}</div>
                            <div>今日总日志</div>
                        </div>
                    </el-card>
                </el-col>
                <el-col :span="6">
                    <el-card>
                        <div style="text-align: center;">
                            <div style="font-size: 20px; color: #67C23A;">{{logStats.today?.connections || 0}}</div>
                            <div>连接数</div>
                        </div>
                    </el-card>
                </el-col>
                <el-col :span="6">
                    <el-card>
                        <div style="text-align: center;">
                            <div style="font-size: 20px; color: #E6A23C;">{{logStats.today?.successful_auths || 0}}</div>
                            <div>成功认证</div>
                        </div>
                    </el-card>
                </el-col>
                <el-col :span="6">
                    <el-card>
                        <div style="text-align: center;">
                            <div style="font-size: 20px; color: #F56C6C;">{{logStats.today?.errors || 0}}</div>
                            <div>错误数</div>
                        </div>
                    </el-card>
                </el-col>
            </el-row>
            
            <!-- 日志表格 -->
            <el-table :data="logs" style="width: 100%" v-loading="logsLoading" max-height="600">
                <el-table-column prop="timestamp" label="时间" width="180">
                    <template #default="scope">
                        {{formatDate(scope.row.timestamp || scope.row.created_at)}}
                    </template>
                </el-table-column>
                <el-table-column prop="level" label="级别" width="80">
                    <template #default="scope">
                        <el-tag 
                            :type="getLevelType(scope.row.level || scope.row.action)"
                            size="small"
                        >
                            {{scope.row.level || scope.row.action}}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column prop="username" label="用户" width="120"></el-table-column>
                <el-table-column prop="client_ip" label="IP地址" width="120"></el-table-column>
                <el-table-column prop="message" label="消息" min-width="200">
                    <template #default="scope">
                        {{scope.row.message || scope.row.target_host}}
                    </template>
                </el-table-column>
                <el-table-column prop="session_id" label="会话ID" width="120" show-overflow-tooltip></el-table-column>
            </el-table>
            
            <!-- 分页 -->
            <div style="text-align: center; margin-top: 20px;" v-if="logFilters.type === 'connection'">
                <el-pagination
                    v-model:current-page="logPagination.page"
                    v-model:page-size="logPagination.limit"
                    :page-sizes="[10, 20, 50, 100]"
                    :total="logPagination.total"
                    layout="total, sizes, prev, pager, next, jumper"
                    @size-change="$emit('load-logs')"
                    @current-change="$emit('load-logs')"
                />
            </div>
        </div>
    `
};

window.LogsView = LogsView; 