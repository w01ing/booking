// auth.js - 处理用户认证和会话管理

// 检查用户是否已登录
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        // 如果没有token，重定向到登录页面
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

// 获取当前登录用户信息
function getCurrentUser() {
    return {
        id: localStorage.getItem('userId'),
        username: localStorage.getItem('username'),
        userType: localStorage.getItem('userType'),
        token: localStorage.getItem('token')
    };
}

// 更新页面上的用户信息显示
function updateUserInfo() {
    const user = getCurrentUser();
    if (!user.username) return;

    // 如果侧边栏管理器已加载，则不在此处更新用户信息
    if (window.sidebarManagerInitialized) {
        console.log('检测到侧边栏管理器已初始化，跳过auth.js中的用户信息更新');
        return;
    }

    // 更新导航栏用户名
    const userNameElements = document.querySelectorAll('.user-name');
    userNameElements.forEach(element => {
        element.textContent = user.username;
    });

    // 更新侧边栏用户名和角色
    const profileNameElements = document.querySelectorAll('.profile-name');
    profileNameElements.forEach(element => {
        element.textContent = user.username;
    });

    const profileRoleElements = document.querySelectorAll('.profile-role');
    profileRoleElements.forEach(element => {
        element.textContent = user.userType === 'provider' ? '服务商' : '普通用户';
    });
    
    // 加载并更新导航栏预约统计信息
    loadNavbarBookingStats();
}

// 加载并更新导航栏预约统计
async function loadNavbarBookingStats() {
    // 如果侧边栏管理器已加载，则不重复加载统计数据
    if (window.sidebarManagerInitialized) {
        console.log('检测到侧边栏管理器已初始化，跳过auth.js中的统计数据加载');
        return;
    }
    
    try {
        // 检查是否已登录
        if (!checkAuth()) return;
        
        console.log('开始加载导航栏预约统计');
        
        // 尝试从API获取预约数据
        let bookings;
        try {
            bookings = await apiRequest('/api/bookings');
            if (!bookings || !Array.isArray(bookings)) {
                throw new Error('API返回的数据不是预期的数组格式');
            }
        } catch (apiError) {
            console.log('从API获取预约数据失败，尝试从本地文件获取', apiError);
            
            // 从本地JSON文件获取数据（仅用于演示）
            try {
                const response = await fetch('/data/bookings.json');
                if (!response.ok) {
                    throw new Error(`获取预约数据失败：HTTP错误 ${response.status}`);
                }
                bookings = await response.json();
                console.log('从本地文件获取到预约数据:', bookings.length);
            } catch (fetchError) {
                console.error('加载预约数据失败:', fetchError);
                return;
            }
        }
        
        // 计算不同状态的预约数量
        const stats = {
            waiting: 0,
            upcoming: 0,
            completed: 0,
            canceled: 0
        };
        
        bookings.forEach(booking => {
            if (booking.status === 'waiting') stats.waiting++;
            else if (booking.status === 'upcoming') stats.upcoming++;
            else if (booking.status === 'completed') stats.completed++;
            else if (booking.status === 'canceled') stats.canceled++;
        });
        
        console.log('预约统计:', stats);
        
        // 更新侧边栏统计卡片
        updateNavbarStats(stats);
    } catch (error) {
        console.error('加载导航栏预约统计失败:', error);
    }
}

// 更新导航栏统计数字
function updateNavbarStats(stats) {
    // 更新预约历史徽章 - 移除徽章显示
    const historyBadge = document.querySelector('.nav-item[href="booking-history.html"] .item-badge');
    if (historyBadge) {
        historyBadge.textContent = '';
        historyBadge.style.display = 'none';
    }
    
    // 更新左侧导航栏中的数字
    const dashboardBadge = document.querySelector('.nav-item[href="dashboard.html"] .item-badge');
    if (dashboardBadge) {
        const totalUnprocessed = stats.waiting + stats.upcoming;
        dashboardBadge.textContent = totalUnprocessed > 0 ? totalUnprocessed : '';
        dashboardBadge.style.display = totalUnprocessed > 0 ? 'flex' : 'none';
    }
    
    // 不再在这里更新通知徽章，改为使用app.js中的updateNotificationBadge函数
    
    // 更新左侧统计卡片
    const waitingElement = document.querySelector('.stat-card.waiting .stat-value');
    if (waitingElement) waitingElement.textContent = stats.waiting;
    
    const upcomingElement = document.querySelector('.stat-card.upcoming .stat-value');
    if (upcomingElement) upcomingElement.textContent = stats.upcoming;
    
    const completedElement = document.querySelector('.stat-card.completed .stat-value');
    if (completedElement) completedElement.textContent = stats.completed;
    
    const canceledElement = document.querySelector('.stat-card.cancelled .stat-value');
    if (canceledElement) canceledElement.textContent = stats.canceled;
}

// 登出函数
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    localStorage.removeItem('userType');
    localStorage.removeItem('userEmail');
    window.location.href = 'index.html';
}

// 发送API请求的通用函数
async function apiRequest(url, method = 'GET', data = null) {
    const token = localStorage.getItem('token');
    
    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${token}`
        }
    };
    
    // 只有在有数据的情况下才添加Content-Type头和请求体
    if (data && (method === 'POST' || method === 'PUT')) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(data);
    }
    
    try {
        const response = await fetch(url, options);
        
        // 如果返回401未授权，则清除token并重定向到登录页面
        if (response.status === 401) {
            logout();
            return null;
        }
        
        // 对于DELETE请求，某些情况下可能没有返回体，直接返回状态
        if (method === 'DELETE' && response.status >= 200 && response.status < 300) {
            try {
                return await response.json();
            } catch (jsonError) {
                // 如果解析JSON失败，但请求成功，返回成功状态对象
                console.log('DELETE请求成功，但无JSON返回');
                return { success: true, status: response.status };
            }
        }
        
        return await response.json();
    } catch (error) {
        console.error('API请求错误:', error);
        return null;
    }
}

// 登录成功后的处理
function handleLoginSuccess(data) {
    // 保存用户信息到本地存储
    localStorage.setItem('token', data.token);
    localStorage.setItem('userId', data.userId);
    localStorage.setItem('username', data.username);
    localStorage.setItem('userType', data.userType);
    localStorage.setItem('userEmail', data.email); // 保存用户邮箱
    localStorage.setItem('isNewUser', data.isNewUser ? 'true' : 'false');
    
    // 重定向到指定页面
    window.location.href = data.redirect || 'dashboard.html';
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    // 检查用户是否已登录
    if (checkAuth()) {
        // 更新用户信息显示
        updateUserInfo();
        
        // 添加登出事件监听器
        const userMenus = document.querySelectorAll('.user-menu');
        userMenus.forEach(menu => {
            menu.addEventListener('click', () => {
                // 创建下拉菜单
                const dropdown = document.createElement('div');
                dropdown.className = 'user-dropdown';
                dropdown.innerHTML = `
                    <div class="dropdown-item">
                        <a href="account-settings.html">
                            <i class="fas fa-cog"></i> 账号设置
                        </a>
                    </div>
                    <div class="dropdown-item logout-btn">
                        <a href="#">
                            <i class="fas fa-sign-out-alt"></i> 退出登录
                        </a>
                    </div>
                `;
                
                // 添加到页面
                document.body.appendChild(dropdown);
                
                // 定位下拉菜单
                const rect = menu.getBoundingClientRect();
                dropdown.style.position = 'absolute';
                dropdown.style.top = rect.bottom + 'px';
                dropdown.style.right = (window.innerWidth - rect.right) + 'px';
                dropdown.style.minWidth = '150px';
                dropdown.style.backgroundColor = '#fff';
                dropdown.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
                dropdown.style.borderRadius = '4px';
                dropdown.style.zIndex = '1000';
                dropdown.style.overflow = 'hidden';
                
                // 添加下拉菜单项样式
                const dropdownItems = dropdown.querySelectorAll('.dropdown-item');
                dropdownItems.forEach(item => {
                    item.style.padding = '10px 15px';
                    item.style.borderBottom = '1px solid #eee';
                });
                
                // 添加链接样式
                const links = dropdown.querySelectorAll('a');
                links.forEach(link => {
                    link.style.color = '#333';
                    link.style.textDecoration = 'none';
                    link.style.display = 'block';
                });
                
                // 添加登出按钮点击事件
                const logoutBtn = dropdown.querySelector('.logout-btn');
                if (logoutBtn) {
                    logoutBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        logout();
                    });
                }
                
                // 点击其他区域关闭下拉菜单
                function closeDropdown(e) {
                    if (!menu.contains(e.target) && !dropdown.contains(e.target)) {
                        document.body.removeChild(dropdown);
                        document.removeEventListener('click', closeDropdown);
                    }
                }
                
                // 延迟添加事件监听，避免立即触发
                setTimeout(() => {
                    document.addEventListener('click', closeDropdown);
                }, 100);
            });
        });
    }
});

function togglePassword() {
    const pwd = document.getElementById('password');
    pwd.type = pwd.type === 'password' ? 'text' : 'password';
} 