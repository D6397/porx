// 用户管理视图组件
const UsersView = {
    props: [
        'users', 'userSearch', 'userPagination', 'showUserDialog', 
        'editingUser', 'userForm'
    ],
    emits: [
        'load-users', 'open-user-dialog', 'save-user', 
        'delete-user', 'update:user-search', 'update:show-user-dialog'
    ],
    template: `
        <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0;">用户管理</h3>
                <div>
                    <el-input 
                        :model-value="userSearch"
                        @update:model-value="$emit('update:user-search', $event)"
                        placeholder="搜索用户名" 
                        style="width: 200px; margin-right: 10px;"
                        @input="$emit('load-users')"
                        clearable
                    ></el-input>
                    <el-button type="primary" @click="$emit('open-user-dialog', null)">新增用户</el-button>
                </div>
            </div>
            
            <el-table :data="users" style="width: 100%">
                <el-table-column prop="id" label="ID" width="80"></el-table-column>
                <el-table-column prop="username" label="用户名"></el-table-column>
                <el-table-column prop="status" label="状态">
                    <template #default="scope">
                        <el-tag :type="scope.row.status === 'active' ? 'success' : 'danger'">
                            {{scope.row.status === 'active' ? '活跃' : '禁用'}}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column prop="max_connections" label="最大连接数"></el-table-column>
                <el-table-column prop="expire_date" label="过期时间">
                    <template #default="scope">
                        {{scope.row.expire_date ? new Date(scope.row.expire_date).toLocaleDateString() : '永不过期'}}
                    </template>
                </el-table-column>
                <el-table-column prop="created_at" label="创建时间">
                    <template #default="scope">
                        {{new Date(scope.row.created_at).toLocaleDateString()}}
                    </template>
                </el-table-column>
                <el-table-column label="操作" width="150">
                    <template #default="scope">
                        <el-button size="small" type="primary" @click="$emit('open-user-dialog', scope.row)">编辑</el-button>
                        <el-button size="small" type="danger" @click="$emit('delete-user', scope.row)">删除</el-button>
                    </template>
                </el-table-column>
            </el-table>
            
            <!-- 分页 -->
            <div style="text-align: center; margin-top: 20px;" v-if="userPagination.total > userPagination.limit">
                <el-pagination
                    v-model:current-page="userPagination.page"
                    v-model:page-size="userPagination.limit"
                    :page-sizes="[10, 20, 50, 100]"
                    :total="userPagination.total"
                    layout="total, sizes, prev, pager, next, jumper"
                    @size-change="$emit('load-users')"
                    @current-change="$emit('load-users')"
                />
            </div>
            
            <!-- 用户编辑对话框 -->
            <el-dialog 
                :model-value="showUserDialog"
                @update:model-value="$emit('update:show-user-dialog', $event)"
                :title="editingUser ? '编辑用户' : '新增用户'"
                width="500px"
            >
                <el-form :model="userForm" label-width="100px">
                    <el-form-item label="用户名" required>
                        <el-input v-model="userForm.username" placeholder="请输入用户名"></el-input>
                    </el-form-item>
                    <el-form-item :label="editingUser ? '新密码' : '密码'" :required="!editingUser">
                        <el-input 
                            v-model="userForm.password" 
                            type="password" 
                            :placeholder="editingUser ? '留空则不修改密码' : '请输入密码'"
                        ></el-input>
                    </el-form-item>
                    <el-form-item label="最大连接数">
                        <el-input-number v-model="userForm.max_connections" :min="1" :max="100"></el-input-number>
                    </el-form-item>
                    <el-form-item label="过期时间">
                        <el-date-picker
                            v-model="userForm.expire_date"
                            type="date"
                            placeholder="选择过期时间"
                            format="YYYY-MM-DD"
                            value-format="YYYY-MM-DD"
                            clearable
                        />
                    </el-form-item>
                    <el-form-item label="状态">
                        <el-select v-model="userForm.status">
                            <el-option label="活跃" value="active"></el-option>
                            <el-option label="禁用" value="inactive"></el-option>
                        </el-select>
                    </el-form-item>
                </el-form>
                <template #footer>
                    <span class="dialog-footer">
                        <el-button @click="$emit('update:show-user-dialog', false)">取消</el-button>
                        <el-button type="primary" @click="$emit('save-user')">{{editingUser ? '更新' : '创建'}}</el-button>
                    </span>
                </template>
            </el-dialog>
        </div>
    `
};

window.UsersView = UsersView; 