/**
 * notifications.js - 处理通知页面的功能
 */
document.addEventListener('DOMContentLoaded', function() {
    // 初始化通知页面
    initNotificationsPage();
});

/**
 * 初始化通知页面
 */
async function initNotificationsPage() {
    try {
        // 初始化左侧预约状态卡片点击事件（无论是否登录都要初始化）
        initializeBookingStatCards();
        
        // 检查用户登录状态
        if (!isLoggedIn()) {
            window.location.href = 'index.html';
            return;
        }
        
        // 获取用户信息并更新侧边栏
        await updateUserSidebar();
        
        // 获取通知数据
        const notifications = await fetchNotifications();
        
        // 更新通知计数
        updateNotificationCounts(notifications);
        
        // 显示通知列表
        displayNotifications(notifications);
        
        // 设置事件监听器
        setupEventListeners(notifications);
    } catch (error) {
        console.error('初始化通知页面失败:', error);
        showToast('加载通知失败，请刷新页面重试', 'error');
    }
}

/**
 * 检查用户是否已登录
 * @returns {boolean} 是否已登录
 */
function isLoggedIn() {
    return localStorage.getItem('token') !== null;
}

/**
 * 更新用户侧边栏信息
 */
async function updateUserSidebar() {
    try {
        // 获取用户信息
        const userInfo = await fetchUserInfo();
        
        // 更新用户名称
        const profileName = document.querySelector('.profile-name');
        if (profileName && userInfo.username) {
            profileName.textContent = userInfo.username;
        }
        
        const userNameNav = document.querySelector('.user-menu .user-name');
        if (userNameNav && userInfo.username) {
            userNameNav.textContent = userInfo.username;
        }
        
        // 获取预约统计数据
        const bookingStats = await fetchBookingStats();
        
        // 更新预约统计
        updateBookingStats(bookingStats);
    } catch (error) {
        console.error('更新用户侧边栏失败:', error);
    }
}

/**
 * 获取用户信息
 * @returns {Object} 用户信息
 */
async function fetchUserInfo() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            return {};
        }
        
        const response = await fetch('/api/user', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`获取用户信息失败: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('获取用户信息失败:', error);
        return {};
    }
}

/**
 * 获取预约统计数据
 * @returns {Object} 预约统计数据
 */
async function fetchBookingStats() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            return {};
        }
        
        const response = await fetch('/api/bookings', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`获取预约数据失败: ${response.status}`);
        }
        
        const bookings = await response.json();
        
        // 计算不同状态的预约数量
        const stats = {
            waiting: 0,
            upcoming: 0,
            completed: 0,
            canceled: 0
        };
        
        bookings.forEach(booking => {
            switch (booking.status) {
                case 'waiting':
                    stats.waiting++;
                    break;
                case 'upcoming':
                    stats.upcoming++;
                    break;
                case 'completed':
                    stats.completed++;
                    break;
                case 'canceled':
                    stats.canceled++;
                    break;
            }
        });
        
        return stats;
    } catch (error) {
        console.error('获取预约统计数据失败:', error);
        return {
            waiting: 0,
            upcoming: 0,
            completed: 0,
            canceled: 0
        };
    }
}

/**
 * 更新预约统计显示
 * @param {Object} stats 预约统计数据
 */
async function updateBookingStats(stats) {
    // 更新待确认预约数量
    const waitingValue = document.querySelector('.stat-card[data-status="waiting"] .stat-value');
    if (waitingValue) {
        waitingValue.textContent = stats.waiting || 0;
    }
    
    // 更新即将到来的预约数量
    const upcomingValue = document.querySelector('.stat-card[data-status="upcoming"] .stat-value');
    if (upcomingValue) {
        upcomingValue.textContent = stats.upcoming || 0;
    }
    
    // 更新已完成预约数量
    const completedValue = document.querySelector('.stat-card[data-status="done"] .stat-value');
    if (completedValue) {
        completedValue.textContent = stats.completed || 0;
    }
    
    // 更新已取消预约数量 (注意：HTML使用"cancelled"，而后端使用"canceled")
    const canceledValue = document.querySelector('.stat-card[data-status="cancelled"] .stat-value');
    if (canceledValue) {
        canceledValue.textContent = stats.canceled || 0;
    }
    
    // 更新预约历史徽章 - 移除徽章显示
    const bookingHistoryBadge = document.querySelector('a[href="booking-history.html"] .item-badge');
    if (bookingHistoryBadge) {
        bookingHistoryBadge.textContent = '';
            bookingHistoryBadge.style.display = 'none';
    }
    // 更新顶部导航栏中的通知数字
    const notificationBadge = document.querySelector('.notification-btn .badge');
    if (notificationBadge) {
        // 计算未读通知数量
        const notifications = await fetchNotifications();
        const unreadCount = notifications.filter(notif => !notif.is_read).length;
        
        notificationBadge.textContent = unreadCount;
        
        // 如果有未读通知，显示徽章，否则隐藏
        if (unreadCount > 0) {
            notificationBadge.style.display = 'block';
        } else {
            notificationBadge.style.display = 'none';
        }
    }
}

/**
 * 获取通知数据
 * @returns {Array} 通知列表
 */
async function fetchNotifications() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.log('未找到token，返回空通知列表');
            return [];
        }
        
        const response = await fetch('/api/user/notifications', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`获取通知失败: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('获取通知失败:', error);
        showToast('加载通知失败，请稍后再试', 'error');
        return [];
    }
}

/**
 * 更新通知计数
 * @param {Array} notifications 通知列表
 */
function updateNotificationCounts(notifications) {
    // 计算不同类型的通知数量
    const counts = {
        all: notifications.length,
        unread: notifications.filter(n => !n.is_read).length,
        booking: notifications.filter(n => n.type === 'booking').length,
        review: notifications.filter(n => n.type === 'review').length,
        system: notifications.filter(n => n.type === 'system').length
    };
    
    // 更新全部通知数量
    const allTab = document.querySelector('.notification-tab[data-type="all"] .badge');
    if (allTab) {
        allTab.textContent = counts.all;
    }
    
    // 更新未读通知数量
    const unreadTab = document.querySelector('.notification-tab[data-type="unread"] .badge');
    if (unreadTab) {
        unreadTab.textContent = counts.unread;
    }
    
    // 更新预约通知数量
    const bookingTab = document.querySelector('.notification-tab[data-type="booking"] .badge');
    if (bookingTab) {
        bookingTab.textContent = counts.booking;
    }
    
    // 更新评价通知数量
    const reviewTab = document.querySelector('.notification-tab[data-type="review"] .badge');
    if (reviewTab) {
        reviewTab.textContent = counts.review;
    }
    
    // 更新系统通知数量
    const systemTab = document.querySelector('.notification-tab[data-type="system"] .badge');
    if (systemTab) {
        systemTab.textContent = counts.system;
    }
    
    // 更新导航栏通知徽章
    const navBadge = document.querySelector('.notification-btn .badge');
    if (navBadge) {
        if (counts.unread > 0) {
            navBadge.textContent = counts.unread;
            navBadge.style.display = 'flex';
        } else {
            navBadge.style.display = 'none';
        }
    }
}

/**
 * 显示通知列表
 * @param {Array} notifications 通知列表
 */
function displayNotifications(notifications) {
    const notificationsContainer = document.querySelector('.notifications-list');
    if (!notificationsContainer) {
        return;
    }
    
    // 清空容器
    notificationsContainer.innerHTML = '';
    
    if (notifications.length === 0) {
        // 显示空状态
        notificationsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash"></i>
                <p>暂无通知</p>
            </div>
        `;
        return;
    }
    
    // 按时间倒序排序通知
    const sortedNotifications = [...notifications].sort((a, b) => {
        return new Date(b.created_at) - new Date(a.created_at);
    });
    
    // 添加通知到容器
    sortedNotifications.forEach(notification => {
        const notificationElement = createNotificationElement(notification);
        notificationsContainer.appendChild(notificationElement);
    });
}

/**
 * 创建通知元素
 * @param {Object} notification 通知数据
 * @returns {HTMLElement} 通知元素
 */
function createNotificationElement(notification) {
    const notificationItem = document.createElement('div');
    notificationItem.className = `notification-item${notification.is_read ? '' : ' unread'}`;
    notificationItem.setAttribute('data-type', notification.type);
    notificationItem.setAttribute('data-id', notification.id);
    
    // 获取通知图标
    const iconClass = getNotificationIconClass(notification);
    
    // 获取通知时间
    const timeString = formatNotificationTime(notification.created_at);
    
    // 构建通知HTML
    notificationItem.innerHTML = `
        ${notification.is_read ? '' : '<div class="notification-unread-indicator"></div>'}
        <div class="notification-icon">
            <i class="${iconClass}"></i>
        </div>
        <div class="notification-content">
            <h3>${notification.title}</h3>
            <p>${notification.content}</p>
            <div class="notification-meta">
                <span class="notification-time">${timeString}</span>
                <div class="notification-actions">
                    ${getNotificationActions(notification)}
                </div>
            </div>
        </div>
    `;
    
    return notificationItem;
}

/**
 * 获取通知图标类名
 * @param {Object} notification 通知数据
 * @returns {string} 图标类名
 */
function getNotificationIconClass(notification) {
    switch (notification.type) {
        case 'booking':
            switch (notification.subtype) {
                case 'confirmation':
                    return 'fas fa-calendar-check';
                case 'reminder':
                    return 'fas fa-clock';
                case 'cancellation':
                    return 'fas fa-times-circle';
                case 'reschedule':
                    return 'fas fa-calendar-alt';
                default:
                    return 'fas fa-calendar-alt';
            }
        case 'review':
            return notification.subtype === 'reply' ? 'fas fa-comment-alt' : 'fas fa-star';
        case 'system':
            return 'fas fa-bullhorn';
        default:
            return 'fas fa-bell';
    }
}

/**
 * 格式化通知时间
 * @param {string} dateString ISO格式的日期字符串
 * @returns {string} 格式化后的时间字符串
 */
function formatNotificationTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffMin < 1) {
        return '刚刚';
    } else if (diffMin < 60) {
        return `${diffMin}分钟前`;
    } else if (diffHour < 24) {
        return `${diffHour}小时前`;
    } else if (diffDay < 7) {
        return `${diffDay}天前`;
    } else {
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    }
}

/**
 * 获取通知操作按钮HTML
 * @param {Object} notification 通知数据
 * @returns {string} 操作按钮HTML
 */
function getNotificationActions(notification) {
    let actions = '';
    
    // 根据通知类型添加不同的操作按钮
    if (notification.type === 'booking' && notification.related_entity) {
        actions += `<button class="notification-action-btn view-detail" data-booking-id="${notification.related_id}">查看详情</button>`;
    } else if (notification.type === 'review' && notification.related_entity) {
        actions += `<button class="notification-action-btn view-review" data-review-id="${notification.related_id}">查看评价</button>`;
    }
    
    // 未读通知添加"标记为已读"按钮
    if (!notification.is_read) {
        actions += `<button class="notification-action-btn mark-read" data-notification-id="${notification.id}">标记为已读</button>`;
    }
    
    // 添加删除按钮，所有通知都可以删除
    actions += `<button class="notification-action-btn delete-notification" data-notification-id="${notification.id}">删除</button>`;
    
    return actions;
}

/**
 * 设置事件监听器
 * @param {Array} notifications 通知列表
 */
function setupEventListeners(notifications) {
    // 标签切换事件
    const tabs = document.querySelectorAll('.notification-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // 移除所有标签的active类
            tabs.forEach(t => t.classList.remove('active'));
            // 添加当前标签的active类
            tab.classList.add('active');
            
            // 根据标签类型过滤通知
            const type = tab.getAttribute('data-type');
            filterNotifications(notifications, type);
        });
    });
    
    // 全部标记为已读按钮
    const markAllReadBtn = document.querySelector('.btn-mark-all-read');
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', async () => {
            await markAllNotificationsAsRead();
            // 重新加载通知
            const updatedNotifications = await fetchNotifications();
            updateNotificationCounts(updatedNotifications);
            displayNotifications(updatedNotifications);
        });
    }
    
    // 委托事件监听器处理通知操作
    const notificationsList = document.querySelector('.notifications-list');
    if (notificationsList) {
        notificationsList.addEventListener('click', async (event) => {
            // 处理"标记为已读"按钮
            if (event.target.classList.contains('mark-read')) {
                const notificationId = event.target.getAttribute('data-notification-id');
                if (notificationId) {
                    await markNotificationAsRead(notificationId);
                    // 重新加载通知
                    const updatedNotifications = await fetchNotifications();
                    updateNotificationCounts(updatedNotifications);
                    displayNotifications(updatedNotifications);
                }
            }
            
            // 处理"删除通知"按钮
            if (event.target.classList.contains('delete-notification')) {
                const notificationId = event.target.getAttribute('data-notification-id');
                if (notificationId) {
                    // 确认是否删除
                    if (confirm('确定要删除这条通知吗？')) {
                        const success = await deleteNotification(notificationId);
                        if (success) {
                            // 重新加载通知
                            const updatedNotifications = await fetchNotifications();
                            updateNotificationCounts(updatedNotifications);
                            displayNotifications(updatedNotifications);
                        }
                    }
                }
            }
            
            // 处理"查看详情"按钮
            if (event.target.classList.contains('view-detail')) {
                const bookingId = event.target.getAttribute('data-booking-id');
                if (bookingId) {
                    window.location.href = `appointment-detail.html?id=${bookingId}`;
                }
            }
            
            // 处理"查看评价"按钮
            if (event.target.classList.contains('view-review')) {
                const reviewId = event.target.getAttribute('data-review-id');
                if (reviewId) {
                    window.location.href = `my-reviews.html?review=${reviewId}`;
                }
            }
        });
    }
}

/**
 * 根据类型过滤通知
 * @param {Array} notifications 通知列表
 * @param {string} type 通知类型
 */
function filterNotifications(notifications, type) {
    let filteredNotifications;
    
    switch (type) {
        case 'unread':
            filteredNotifications = notifications.filter(n => !n.is_read);
            break;
        case 'booking':
        case 'review':
        case 'system':
            filteredNotifications = notifications.filter(n => n.type === type);
            break;
        case 'all':
        default:
            filteredNotifications = notifications;
            break;
    }
    
    displayNotifications(filteredNotifications);
}

/**
 * 标记通知为已读
 * @param {string} notificationId 通知ID
 */
async function markNotificationAsRead(notificationId) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            return false;
        }
        
        const response = await fetch(`/api/user/notifications/${notificationId}/read`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`标记通知失败: ${response.status}`);
        }
        
        // 更新UI
        const notificationItem = document.querySelector(`.notification-item[data-id="${notificationId}"]`);
        if (notificationItem) {
            notificationItem.classList.remove('unread');
            const indicator = notificationItem.querySelector('.notification-unread-indicator');
            if (indicator) {
                indicator.remove();
            }
            
            // 移除"标记为已读"按钮
            const markReadBtn = notificationItem.querySelector('.mark-read');
            if (markReadBtn) {
                markReadBtn.remove();
            }
        }
        
        // 显示成功提示
        showToast('已读', 'success');
        
        return true;
    } catch (error) {
        console.error('标记通知失败:', error);
        showToast('操作失败', 'error');
        return false;
    }
}

/**
 * 标记所有通知为已读
 */
async function markAllNotificationsAsRead() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            return false;
        }
        
        const response = await fetch('/api/user/notifications/read-all', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`标记所有通知失败: ${response.status}`);
        }
        
        // 更新UI
        document.querySelectorAll('.notification-item.unread').forEach(item => {
            item.classList.remove('unread');
            item.querySelector('.notification-unread-indicator')?.remove();
            item.querySelector('.mark-read')?.remove();
        });
        
        // 更新通知计数
        const tabs = document.querySelectorAll('.notification-tab .badge');
        tabs.forEach(badge => {
            if (badge.closest('.notification-tab').getAttribute('data-type') === 'unread') {
                badge.textContent = '0';
            }
        });
        
        // 显示成功提示
        showToast('已读', 'success');
        
        return true;
    } catch (error) {
        console.error('标记所有通知失败:', error);
        showToast('操作失败，请重试', 'error');
        return false;
    }
}

/**
 * 显示提示消息
 * @param {string} message 消息内容
 * @param {string} type 消息类型
 */
function showToast(message, type = 'info') {
    // 移除已存在的toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        document.body.removeChild(existingToast);
    }
    
    // 创建toast元素
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    // 添加到页面
    document.body.appendChild(toast);
    
    // 显示toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // 缩短显示时间至800毫秒
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 200);
    }, 800);
}

/**
 * 删除通知
 * @param {string} notificationId 通知ID
 */
async function deleteNotification(notificationId) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            return false;
        }
        
        const response = await fetch(`/api/user/notifications/${notificationId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`删除通知失败: ${response.status}`);
        }
        
        return true;
    } catch (error) {
        console.error('删除通知失败:', error);
        return false;
    }
}

/**
 * 初始化预约状态卡片点击事件
 */
function initializeBookingStatCards() {
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach(card => {
        card.addEventListener('click', () => {
            const status = card.classList[1]; // 获取状态类名（waiting, upcoming, completed, cancelled）
            if (status) {
                // 如果用户已登录，跳转到预约历史页面并传递状态参数
                if (checkAuth()) {
                    window.location.href = `booking-history.html?status=${status}`;
                } else {
                    // 未登录则提示用户登录
                    showToast('请先登录后查看预约信息', 'info');
                }
            }
        });
    });
}