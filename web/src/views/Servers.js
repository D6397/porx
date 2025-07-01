// 服务器管理视图组件
const ServersView = {
    props: ['servers'],
    emits: ['toggle-server', 'refresh-servers'],
    data() {
        return {
            showServerDialog: false,
            editingServer: null,
            serverForm: {
                name: '',
                http_port: 8082,
                https_port: 8083,
                domain: '',
                ssl_enabled: false
            },
            loading: false,
            statusTimer: null,
            // SSL证书上传相关
            showSslDialog: false,
            sslUploadServer: null,
            certFile: null,
            keyFile: null,
            uploadLoading: false
        };
    },
    methods: {
        // 打开服务器编辑对话框
        openServerDialog(server = null) {
            this.editingServer = server;
            if (server) {
                // 编辑模式
                this.serverForm = {
                    name: server.name,
                    http_port: server.http_port,
                    https_port: server.https_port || '',
                    domain: server.domain || '',
                    ssl_enabled: server.ssl_enabled || false
                };
            } else {
                // 新增模式
                this.serverForm = {
                    name: '',
                    http_port: 8082,
                    https_port: 8083,
                    domain: '',
                    ssl_enabled: false
                };
            }
            this.showServerDialog = true;
        },

        // 保存服务器
        async saveServer() {
            try {
                this.loading = true;
                
                if (!this.serverForm.name || !this.serverForm.http_port) {
                    this.$message.error('请填写必填项');
                    return;
                }

                const url = this.editingServer 
                    ? `/proxy/servers/${this.editingServer.id}` 
                    : '/proxy/servers';
                const method = this.editingServer ? 'put' : 'post';

                await window.api[method](url, this.serverForm);
                
                this.$message.success(this.editingServer ? '服务器更新成功' : '服务器创建成功');
                this.showServerDialog = false;
                this.$emit('refresh-servers');
            } catch (error) {
                this.$message.error(error.response?.data?.error || '操作失败');
            } finally {
                this.loading = false;
            }
        },

        // 删除服务器
        async deleteServer(server) {
            try {
                await this.$confirm(`确定要删除服务器 "${server.name}" 吗？`, '确认删除', {
                    confirmButtonText: '确定',
                    cancelButtonText: '取消',
                    type: 'warning'
                });

                await window.api.delete(`/proxy/servers/${server.id}`);
                this.$message.success('服务器删除成功');
                this.$emit('refresh-servers');
            } catch (error) {
                if (error !== 'cancel') {
                    this.$message.error(error.response?.data?.error || '删除失败');
                }
            }
        },

        // 获取服务器状态标签类型
        getStatusType(status) {
            return status === 'running' ? 'success' : 'info';
        },

        // 获取服务器状态文本
        getStatusText(status) {
            return status === 'running' ? '运行中' : '已停止';
        },

        // 启动状态监控
        startStatusMonitoring() {
            if (this.statusTimer) {
                clearInterval(this.statusTimer);
            }
            
            this.statusTimer = setInterval(() => {
                this.$emit('refresh-servers');
            }, 10000); // 每10秒刷新一次状态
        },

        // 停止状态监控
        stopStatusMonitoring() {
            if (this.statusTimer) {
                clearInterval(this.statusTimer);
                this.statusTimer = null;
            }
        },

        // 打开SSL证书上传对话框
        openSslDialog(server) {
            this.sslUploadServer = server;
            this.certFile = null;
            this.keyFile = null;
            this.showSslDialog = true;
        },

        // 处理证书文件选择
        handleCertFileChange(file) {
            this.certFile = file;
        },

        // 处理密钥文件选择
        handleKeyFileChange(file) {
            this.keyFile = file;
        },

        // 上传SSL证书
        async uploadSslCertificates() {
            if (!this.certFile && !this.keyFile) {
                this.$message.error('请至少选择一个文件');
                return;
            }

            const formData = new FormData();
            if (this.certFile) {
                formData.append('cert', this.certFile.raw);
            }
            if (this.keyFile) {
                formData.append('key', this.keyFile.raw);
            }

            try {
                this.uploadLoading = true;
                
                await window.api.post(`/proxy/servers/${this.sslUploadServer.id}/ssl-upload`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                });

                this.$message.success('SSL证书上传成功');
                this.showSslDialog = false;
                this.$emit('refresh-servers');
            } catch (error) {
                this.$message.error(error.response?.data?.error || 'SSL证书上传失败');
            } finally {
                this.uploadLoading = false;
            }
        },

        // 删除SSL证书
        async deleteSslCertificate(server) {
            try {
                await this.$confirm(`确定要删除服务器 "${server.name}" 的SSL证书吗？`, '确认删除', {
                    confirmButtonText: '确定',
                    cancelButtonText: '取消',
                    type: 'warning'
                });

                await window.api.delete(`/proxy/servers/${server.id}/ssl`);
                this.$message.success('SSL证书删除成功');
                this.$emit('refresh-servers');
            } catch (error) {
                if (error !== 'cancel') {
                    this.$message.error(error.response?.data?.error || '删除SSL证书失败');
                }
            }
        },

        // 检查是否有SSL证书
        hasSslCertificate(server) {
            return server.cert_file_name || server.key_file_name;
        },

        // 获取SSL证书信息
        getSslInfo(server) {
            const info = [];
            if (server.cert_file_name) {
                info.push(`证书: ${server.cert_file_name}`);
            }
            if (server.key_file_name) {
                info.push(`密钥: ${server.key_file_name}`);
            }
            if (server.cert_uploaded_at) {
                info.push(`上传: ${new Date(server.cert_uploaded_at).toLocaleString()}`);
            }
            return info.join('\n');
        }
    },

    mounted() {
        this.startStatusMonitoring();
    },

    beforeUnmount() {
        this.stopStatusMonitoring();
    },
    template: `
        <div>
            <div class="server-header">
                <h3>代理服务器管理</h3>
                <el-button type="primary" @click="openServerDialog()">
                    <i class="el-icon-plus"></i> 添加服务器
                </el-button>
            </div>

            <el-table :data="servers" class="server-table" style="width: 100%" v-loading="loading">
                <el-table-column prop="name" label="服务器名称" min-width="120">
                    <template #default="scope">
                        <strong>{{ scope.row.name }}</strong>
                    </template>
                </el-table-column>
                
                <el-table-column prop="domain" label="域名" min-width="150">
                    <template #default="scope">
                        <span v-if="scope.row.domain">{{ scope.row.domain }}</span>
                        <span v-else style="color: #999;">-</span>
                    </template>
                </el-table-column>
                
                <el-table-column label="端口配置" min-width="120">
                    <template #default="scope">
                        <div>
                            <div>HTTP: {{ scope.row.http_port }}</div>
                            <div v-if="scope.row.https_port">HTTPS: {{ scope.row.https_port }}</div>
                        </div>
                    </template>
                </el-table-column>
                
                <el-table-column prop="ssl_enabled" label="SSL状态" width="120">
                    <template #default="scope">
                        <div>
                            <el-tag :type="scope.row.ssl_enabled ? 'success' : 'info'" size="small">
                                {{ scope.row.ssl_enabled ? '启用' : '禁用' }}
                            </el-tag>
                            <br v-if="hasSslCertificate(scope.row)">
                            <el-tooltip v-if="hasSslCertificate(scope.row)" 
                                :content="getSslInfo(scope.row)" 
                                placement="top"
                            >
                                <el-tag type="warning" size="small" style="margin-top: 2px;">
                                    <i class="el-icon-document"></i> 已上传
                                </el-tag>
                            </el-tooltip>
                        </div>
                    </template>
                </el-table-column>
                
                <el-table-column prop="status" label="运行状态" width="100">
                    <template #default="scope">
                        <el-tag :type="getStatusType(scope.row.status)" size="small">
                            {{ getStatusText(scope.row.status) }}
                        </el-tag>
                    </template>
                </el-table-column>
                
                <el-table-column prop="created_at" label="创建时间" width="180">
                    <template #default="scope">
                        {{ new Date(scope.row.created_at).toLocaleString() }}
                    </template>
                </el-table-column>
                
                <el-table-column label="操作" width="300" fixed="right">
                    <template #default="scope">
                        <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                            <el-button 
                                size="small" 
                                :type="scope.row.status === 'running' ? 'danger' : 'success'"
                                @click="$emit('toggle-server', scope.row.id, scope.row.status === 'running' ? 'stop' : 'start')"
                                :disabled="loading"
                            >
                                {{ scope.row.status === 'running' ? '停止' : '启动' }}
                            </el-button>
                            
                            <el-button 
                                size="small" 
                                type="primary" 
                                @click="openServerDialog(scope.row)"
                                :disabled="loading"
                            >
                                编辑
                            </el-button>
                            
                            <el-dropdown :disabled="scope.row.status === 'running' || loading">
                                <el-button size="small" type="warning">
                                    SSL <i class="el-icon-arrow-down el-icon--right"></i>
                                </el-button>
                                <template #dropdown>
                                    <el-dropdown-menu>
                                        <el-dropdown-item @click="openSslDialog(scope.row)">
                                            <i class="el-icon-upload"></i> 上传证书
                                        </el-dropdown-item>
                                        <el-dropdown-item 
                                            v-if="hasSslCertificate(scope.row)"
                                            @click="deleteSslCertificate(scope.row)"
                                        >
                                            <i class="el-icon-delete"></i> 删除证书
                                        </el-dropdown-item>
                                    </el-dropdown-menu>
                                </template>
                            </el-dropdown>
                            
                            <el-button 
                                size="small" 
                                type="danger" 
                                @click="deleteServer(scope.row)"
                                :disabled="scope.row.status === 'running' || loading"
                            >
                                删除
                            </el-button>
                        </div>
                    </template>
                </el-table-column>
            </el-table>

            <!-- 服务器编辑对话框 -->
            <el-dialog 
                :title="editingServer ? '编辑服务器' : '添加服务器'"
                v-model="showServerDialog"
                width="500px"
                :close-on-click-modal="false"
            >
                <el-form :model="serverForm" label-width="120px">
                    <el-form-item label="服务器名称" required>
                        <el-input 
                            v-model="serverForm.name" 
                            placeholder="请输入服务器名称"
                            maxlength="100"
                            show-word-limit
                        />
                    </el-form-item>
                    
                    <el-form-item label="HTTP端口" required>
                        <el-input-number 
                            v-model="serverForm.http_port" 
                            :min="1"
                            :max="65535"
                            placeholder="HTTP端口"
                            style="width: 100%"
                        />
                    </el-form-item>
                    
                    <el-form-item label="HTTPS端口">
                        <el-input-number 
                            v-model="serverForm.https_port" 
                            :min="1"
                            :max="65535"
                            placeholder="HTTPS端口（可选）"
                            style="width: 100%"
                        />
                    </el-form-item>
                    
                    <el-form-item label="域名">
                        <el-input 
                            v-model="serverForm.domain" 
                            placeholder="请输入域名（可选）"
                            maxlength="255"
                        />
                    </el-form-item>
                    
                    <el-form-item label="启用SSL">
                        <el-switch 
                            v-model="serverForm.ssl_enabled"
                            active-text="启用"
                            inactive-text="禁用"
                        />
                    </el-form-item>
                </el-form>
                
                <template #footer>
                    <div class="dialog-footer">
                        <el-button @click="showServerDialog = false">取消</el-button>
                        <el-button type="primary" @click="saveServer" :loading="loading">
                            {{ editingServer ? '更新' : '创建' }}
                        </el-button>
                    </div>
                </template>
            </el-dialog>

            <!-- SSL证书上传对话框 -->
            <el-dialog 
                title="SSL证书上传"
                v-model="showSslDialog"
                width="500px"
                :close-on-click-modal="false"
                v-if="sslUploadServer"
            >
                <div style="margin-bottom: 20px;">
                    <p><strong>服务器:</strong> {{ sslUploadServer.name }}</p>
                    <p><strong>域名:</strong> {{ sslUploadServer.domain || '未设置' }}</p>
                </div>

                <el-form label-width="100px">
                    <el-form-item label="SSL证书">
                        <el-upload
                            ref="certUpload"
                            :auto-upload="false"
                            :show-file-list="true"
                            :limit="1"
                            accept=".pem,.crt,.cer"
                            :on-change="handleCertFileChange"
                        >
                            <el-button size="small" type="primary">选择证书文件</el-button>
                            <template #tip>
                                <div class="el-upload__tip">支持.pem, .crt, .cer格式的证书文件</div>
                            </template>
                        </el-upload>
                    </el-form-item>
                    
                    <el-form-item label="私钥文件">
                        <el-upload
                            ref="keyUpload"
                            :auto-upload="false"
                            :show-file-list="true"
                            :limit="1"
                            accept=".key,.pem,.txt"
                            :on-change="handleKeyFileChange"
                        >
                            <el-button size="small" type="primary">选择私钥文件</el-button>
                            <template #tip>
                                <div class="el-upload__tip">支持.key, .pem, .txt格式的私钥文件</div>
                            </template>
                        </el-upload>
                    </el-form-item>
                </el-form>

                <el-alert 
                    title="提示" 
                    type="info" 
                    :closable="false"
                    style="margin-bottom: 20px;"
                >
                    <p>• 可以单独上传证书或私钥文件，也可以同时上传</p>
                    <p>• 上传的文件会覆盖现有的同类型文件</p>
                    <p>• 服务器运行时无法上传或删除SSL证书</p>
                </el-alert>
                
                <template #footer>
                    <div class="dialog-footer">
                        <el-button @click="showSslDialog = false">取消</el-button>
                        <el-button 
                            type="primary" 
                            @click="uploadSslCertificates" 
                            :loading="uploadLoading"
                            :disabled="!certFile && !keyFile"
                        >
                            上传
                        </el-button>
                    </div>
                </template>
            </el-dialog>
        </div>
    `
};

window.ServersView = ServersView; 