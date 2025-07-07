// 全局变量，存储用户和统计数据
let sidebarUserInfo = {};
let sidebarBookingStats = { pending: 0, upcoming: 0, completed: 0, canceled: 0 };
// 全局标记，用于标记侧边栏管理器是否已初始化
window.sidebarManagerInitialized = false;

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 检查用户是否已登录
    if (!checkAuth()) return;
    
    // 延迟短暂时间确保覆盖其他可能的更新
    setTimeout(() => {
        // 初始化侧边栏数据
        initSidebarManager();
        
        // 监听DOM变动，确保统计数据不被覆盖
        setupDOMMonitoring();
    }, 50);
});

// 设置DOM监视，确保统计卡片值不被其他脚本覆盖
function setupDOMMonitoring() {
    // 如果浏览器支持MutationObserver
    if (window.MutationObserver) {
        // 定义我们想监控的元素类型
        const targetNodes = document.querySelectorAll('.stat-card .stat-value, a.stat-card .stat-value');
        
        // 创建观察者实例
        const observer = new MutationObserver((mutations) => {
            // 检测到变更时
            mutations.forEach((mutation) => {
                if (mutation.type === 'characterData' || mutation.type === 'childList') {
                    console.log('检测到统计卡片被其他脚本修改，重新应用正确的数值');
                    // 重新应用我们的统计数据
                    updateSidebarStatsUI();
                }
            });
        });
        
        // 配置观察选项
        const config = { 
            childList: true,     // 观察目标子节点的变化
            characterData: true, // 观察元素内容变化
            subtree: true        // 观察所有后代节点
        };
        
        // 对每个目标节点应用观察
        targetNodes.forEach((node) => {
            if (node) {
                observer.observe(node, config);
            }
        });
        
        console.log('已设置DOM监控，确保统计卡片不被覆盖');
    }
}

// 初始化侧边栏数据
async function initSidebarManager() {
    if (window.sidebarManagerInitialized) {
        console.log('侧边栏管理器已初始化，跳过');
        return;
    }
    
    try {
        console.log('开始初始化侧边栏管理器...');
        window.sidebarManagerInitialized = true;
        
        // 首先从localStorage中获取默认值
        const username = localStorage.getItem('username') || '用户';
        
        // 设置默认值
        sidebarUserInfo = {
            name: username,
            role: '普通用户'
        };
        
        // 更新界面显示默认值
        await updateUserInfoUI();
        
        // 更新通知徽章
        await updateNotificationBadgeUI();
        
        // 尝试从API获取最新数据
        try {
            const statsData = await fetchBookingStatsFromAPI();
            
            // 如果成功获取数据，更新全局变量
            if (statsData && statsData.stats) {
                sidebarBookingStats = statsData.stats;
                console.log('获取到的预约统计数据:', sidebarBookingStats);
            }
            
            if (statsData && statsData.user) {
                sidebarUserInfo = statsData.user;
            }
            
            // 用API获取的新数据更新界面
            await updateUserInfoUI();
            updateSidebarStatsUI();
            
            // 保存最新的统计数据
            window.lastSidebarStats = {...sidebarBookingStats};
        } catch (apiError) {
            console.warn('获取API数据失败，使用备用方法', apiError);
            
            // 如果API获取失败，尝试使用备用方法获取数据
            try {
                // 尝试直接获取预约数据
                const response = await fetch('/api/bookings', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                
                if (response.ok) {
                    const bookings = await response.json();
                    console.log('备用方法：直接从预约API获取数据', bookings);
                    
                    // 手动计算统计数据
                    const stats = {
                        pending: 0,
                        upcoming: 0,
                        completed: 0,
                        canceled: 0
                    };
                    
                    bookings.forEach(booking => {
                        if (booking.status === 'pending') stats.pending++;
                        else if (booking.status === 'upcoming') stats.upcoming++;
                        else if (booking.status === 'completed') stats.completed++;
                        else if (booking.status === 'canceled') stats.canceled++;
                    });
                    
                    sidebarBookingStats = stats;
                    console.log('手动计算的统计数据:', sidebarBookingStats);
                    updateSidebarStatsUI();
                    
                    // 保存最新的统计数据
                    window.lastSidebarStats = {...sidebarBookingStats};
                }
            } catch (backupError) {
                console.error('备用数据获取方法也失败', backupError);
            }
        }
        
        // 高亮当前页面对应的导航项
        highlightCurrentPageNav();
        
        console.log('侧边栏初始化完成');
        
        // 每10秒检查一次统计数据是否被覆盖
        setInterval(checkAndRestoreStats, 10000);
    } catch (error) {
        console.error('初始化侧边栏失败:', error);
    }
}

// 检查并恢复统计数据，防止被其他脚本覆盖
function checkAndRestoreStats() {
    if (!window.lastSidebarStats) return;
    
    // 检查当前显示的值是否与我们最后设置的值不同
    const waitingElement = document.querySelector('.stat-card.waiting .stat-value, a.stat-card.waiting .stat-value');
    if (waitingElement && waitingElement.textContent != window.lastSidebarStats.pending) {
        console.log('检测到统计数据被覆盖，恢复数据');
        updateSidebarStatsUI();
    }
}

// 获取预约统计数据
async function fetchBookingStatsFromAPI() {
    console.log('开始从API获取预约统计数据');
    
    // 获取认证令牌
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('未找到认证令牌');
        throw new Error('未找到认证令牌');
    }
    
    // 从API获取统计数据
    const response = await fetch('/api/bookings/stats', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    });
    
    if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('成功获取预约统计数据:', data);
    return data;
}

// 更新用户信息UI
async function updateUserInfoUI() {
    try {
        console.log('更新用户信息UI:', sidebarUserInfo);
        
        // 更新顶部导航栏中的用户名
        const userNameElements = document.querySelectorAll('.user-name');
        userNameElements.forEach(element => {
            element.textContent = sidebarUserInfo.name || '用户';
        });
        
        // 更新侧边栏的用户名和角色
        const profileName = document.querySelector('.profile-name');
        if (profileName) {
            profileName.textContent = sidebarUserInfo.name || '用户';
        }
        
        const profileRole = document.querySelector('.profile-role');
        if (profileRole) {
            profileRole.textContent = sidebarUserInfo.role || '普通用户';
        }
        
        // 更新顶部导航栏中的通知数字
        await updateNotificationBadgeUI();
    } catch (error) {
        console.error('更新用户信息UI失败:', error);
    }
}

// 更新通知徽章
async function updateNotificationBadgeUI() {
    try {
        const notificationBadge = document.querySelector('.notification-btn .badge');
        if (notificationBadge) {
            // 获取未读通知数量
            let unreadCount = 0;
            
            try {
                // 从API获取通知
                const token = localStorage.getItem('token');
                if (token) {
                    const response = await fetch('/api/user/notifications', {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    
                    if (response.ok) {
                        const notifications = await response.json();
                        // 计算未读通知数量
                        unreadCount = notifications.filter(notif => !notif.is_read).length;
                        console.log('未读通知数量:', unreadCount);
                    }
                }
            } catch (error) {
                console.error('获取通知数据失败:', error);
            }
            
            notificationBadge.textContent = unreadCount;
            
            // 如果有未读通知，显示徽章，否则隐藏
            if (unreadCount > 0) {
                notificationBadge.textContent = unreadCount;
                notificationBadge.style.display = 'flex';
                console.log('显示通知徽章，未读数量:', unreadCount);
            } else {
                notificationBadge.style.display = 'none';
                console.log('隐藏通知徽章，没有未读通知');
            }
        } else {
            console.warn('未找到通知徽章元素');
        }
    } catch (error) {
        console.error('更新通知徽章失败:', error);
    }
}

// 更新侧边栏统计数据UI
function updateSidebarStatsUI() {
    try {
        console.log('开始更新侧边栏统计数据UI');
        
        // 确保所有值都是数字类型
        const stats = {
            pending: Number(sidebarBookingStats.pending || 0),
            upcoming: Number(sidebarBookingStats.upcoming || 0),
            completed: Number(sidebarBookingStats.completed || 0),
            canceled: Number(sidebarBookingStats.canceled || 0)
        };
        
        console.log('统计数据:', stats);
        
        // 获取所有页面中的等待预约数量元素
        updateStatValueUI('waiting', stats.pending);
        
        // 更新即将到来的预约数量
        updateStatValueUI('upcoming', stats.upcoming);
        
        // 更新已完成的预约数量
        updateStatValueUI('completed', stats.completed);
        
        // 更新已取消的预约数量
        updateStatValueUI('cancelled', stats.canceled);
        
    } catch (error) {
        console.error('更新侧边栏统计数据UI失败:', error);
    }
}

// 更新统计值
function updateStatValueUI(className, value) {
    try {
        console.log(`尝试更新${className}统计值为:`, value);
        
        // 查找所有可能的结构
        const selectors = [
            `.stat-card.${className} .stat-value`,  // 普通页面的结构
            `a.stat-card.${className} .stat-value`, // dashboard的结构
            `.stat-card[data-status="${className}"] .stat-value`, // 使用data-status属性的结构
            `.stat-card[data-status="${className === 'completed' ? 'done' : className}"] .stat-value` // 另一种data-status结构
        ];
        
        // 特殊情况处理 - 针对waiting/pending命名差异
        if (className === 'waiting') {
            selectors.push(`.stat-card.pending .stat-value`);
            selectors.push(`a.stat-card.pending .stat-value`);
        } else if (className === 'cancelled') {
            // 处理canceled/cancelled拼写差异
            selectors.push(`.stat-card.canceled .stat-value`);
            selectors.push(`a.stat-card.canceled .stat-value`);
        }
        
        let found = false;
        
        // 尝试所有可能的选择器
        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            if (elements && elements.length > 0) {
                console.log(`找到${elements.length}个${className}统计元素:`, selector);
                elements.forEach(element => {
                    element.textContent = value;
                });
                found = true;
                // 不要立即返回，因为可能有多种选择器都能找到元素
            }
        }
        
        if (!found) {
            console.warn(`未找到${className}统计元素，尝试手动更新所有可能的元素`);
            
            // 强制更新 - 当前页面是dashboard的情况
            if (window.location.pathname.includes('dashboard')) {
                console.log('检测到当前是dashboard页面，使用直接选择器更新统计卡片');
                
                // 侧边栏中的所有统计卡片值，按照顺序是：等待确认、即将到来、已完成、已取消
                const statValues = document.querySelectorAll('.stat-card .stat-value, a.stat-card .stat-value');
                
                if (statValues && statValues.length >= 4) {
                    if (className === 'waiting' || className === 'pending') {
                        statValues[0].textContent = value;
                        console.log('直接更新了第1个统计卡片(待确认预约):', value);
                    } else if (className === 'upcoming') {
                        statValues[1].textContent = value;
                        console.log('直接更新了第2个统计卡片(即将到来):', value);
                    } else if (className === 'completed') {
                        statValues[2].textContent = value;
                        console.log('直接更新了第3个统计卡片(已完成):', value);
                    } else if (className === 'cancelled' || className === 'canceled') {
                        statValues[3].textContent = value;
                        console.log('直接更新了第4个统计卡片(已取消):', value);
                    }
                } else {
                    console.warn('找不到足够的统计卡片元素:', statValues ? statValues.length : 0);
                }
            }
            // 其他页面的情况
            else {
                // 针对dashboard.html的硬编码结构特殊处理
                if (className === 'waiting' || className === 'pending') {
                    const pendingElements = document.querySelectorAll('.stat-card .stat-value');
                    if (pendingElements && pendingElements.length >= 1) {
                        pendingElements[0].textContent = value;
                        console.log('手动更新了待确认预约数量');
                    }
                } else if (className === 'upcoming') {
                    const upcomingElements = document.querySelectorAll('.stat-card .stat-value');
                    if (upcomingElements && upcomingElements.length >= 2) {
                        upcomingElements[1].textContent = value;
                        console.log('手动更新了即将到来预约数量');
                    }
                } else if (className === 'completed') {
                    const completedElements = document.querySelectorAll('.stat-card .stat-value');
                    if (completedElements && completedElements.length >= 3) {
                        completedElements[2].textContent = value;
                        console.log('手动更新了已完成预约数量');
                    }
                } else if (className === 'cancelled' || className === 'canceled') {
                    const canceledElements = document.querySelectorAll('.stat-card .stat-value');
                    if (canceledElements && canceledElements.length >= 4) {
                        canceledElements[3].textContent = value;
                        console.log('手动更新了已取消预约数量');
                    }
                }
            }
        }
    } catch (error) {
        console.error(`更新${className}统计值失败:`, error);
    }
}

// 高亮当前页面对应的导航项
function highlightCurrentPageNav() {
    try {
        // 获取当前页面URL
        const currentUrl = window.location.pathname;
        const pageName = currentUrl.split('/').pop() || 'index.html';
        
        console.log('当前页面:', pageName);
        
        // 清除所有导航项的激活状态
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // 根据页面名称查找对应的导航项
        const navItem = document.querySelector(`.nav-item[href="${pageName}"]`) || 
                         document.querySelector(`.nav-item[href*="${pageName}"]`);
        
        if (navItem) {
            navItem.classList.add('active');
        } else {
            // 根据当前URL高亮对应的导航项
            if (pageName.includes('dashboard') || pageName === '') {
                document.querySelector('a[href="dashboard.html"]')?.classList.add('active');
            } else if (pageName.includes('booking-history')) {
                document.querySelector('a[href="booking-history.html"]')?.classList.add('active');
            } else if (pageName.includes('my-reviews')) {
                document.querySelector('a[href="my-reviews.html"]')?.classList.add('active');
            } else if (pageName.includes('my-favorites')) {
                document.querySelector('a[href="my-favorites.html"]')?.classList.add('active');
            } else if (pageName.includes('notifications')) {
                document.querySelector('a[href="notifications.html"]')?.classList.add('active');
            } else if (pageName.includes('account-settings')) {
                document.querySelector('a[href="account-settings.html"]')?.classList.add('active');
            }
        }
    } catch (error) {
        console.error('高亮当前页面导航失败:', error);
    }
}

// 检查用户是否已登录
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return false;
    }
    return true;
} 