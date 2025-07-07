// notification-manager.js - 处理通知管理和显示

/**
 * 通知管理器 - 负责处理所有与通知相关的功能
 */
class NotificationManager {
    constructor() {
        this.notifications = [];
        this.unreadCount = 0;
        this.initialized = false;
    }
    /**
     * 初始化通知管理器
     */
    async init() {
        if (this.initialized) return;
        try {
            // 检查用户是否已登录
            if (!localStorage.getItem('token')) {
                return;
            }
            
            // 尝试从服务器加载通知
            await this.loadNotifications();
            
            // 更新UI上的通知计数
            this.updateNotificationBadges();
            
            // 添加通知相关的事件监听器
            this.setupEventListeners();
            
            this.initialized = true;
        } catch (error) {
            console.error('初始化通知管理器失败:', error);
        }
    }

    /**
     * 从服务器加载通知
     */
    async loadNotifications() {
        try {
            // 检查用户是否已登录
            if (!localStorage.getItem('token')) {
                return;
            }
            
            // 获取用户的通知设置
            const userSettings = await this.getUserNotificationSettings();
            
            // 检查用户是否启用了通知
            if (userSettings && userSettings.types) {
                // 检查是否所有类型的通知都被禁用
                const allDisabled = Object.values(userSettings.types).every(type => !type.enabled);
                if (allDisabled) {
                    return; // 如果所有通知类型都被禁用，则不加载通知
                }
            }
            
            // 从API获取通知
            const token = localStorage.getItem('token');
            const response = await fetch('/api/user/notifications', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`获取通知失败: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (Array.isArray(data)) {
                this.notifications = data;
                this.unreadCount = data.filter(notif => !notif.is_read).length;
            }
        } catch (error) {
            console.error('加载通知失败:', error);
            this.notifications = [];
            this.unreadCount = 0;
        }
    }

    /**
     * 获取用户的通知设置
     */
    async getUserNotificationSettings() {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                return null;
            }
            
            const response = await fetch('/api/user', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`获取用户信息失败: ${response.status}`);
            }
            
            const userInfo = await response.json();
            return userInfo?.notification_settings || null;
        } catch (error) {
            console.error('获取用户通知设置失败:', error);
            return null;
        }
    }

    /**
     * 更新UI上的通知徽章计数
     */
    updateNotificationBadges() {
        console.log('更新通知徽章，未读数量:', this.unreadCount);
        
        // 更新所有页面的顶部导航栏通知徽章
        const navBadges = document.querySelectorAll('.notification-btn .badge');
        navBadges.forEach(badge => {
            badge.textContent = this.unreadCount;
            if (this.unreadCount > 0) {
                badge.textContent = this.unreadCount;
                badge.style.display = 'flex'; // 使用flex确保正确显示
            } else {
                badge.style.display = 'none';
            }
        });
        
        // 更新通知页面的未读标签徽章
        const unreadTabBadge = document.querySelector('.notification-tab[data-type="unread"] .badge');
        if (unreadTabBadge) {
            unreadTabBadge.textContent = this.unreadCount;
        }
        
        // 更新通知页面的未读数量显示
        const unreadCountElement = document.querySelector('.unread-count');
        if (unreadCountElement) {
            unreadCountElement.textContent = this.unreadCount;
        }
        
        console.log('通知徽章已更新完成，未读数量:', this.unreadCount);
    }

    /**
     * 设置通知相关的事件监听器
     */
    setupEventListeners() {
        // 点击通知按钮显示通知下拉菜单
        const notificationBtn = document.querySelector('.notification-btn');
        if (notificationBtn) {
            notificationBtn.addEventListener('click', this.toggleNotificationDropdown.bind(this));
        }
        
        // 点击页面其他地方关闭通知下拉菜单
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.notification-btn') && !e.target.closest('.notification-dropdown')) {
                this.closeNotificationDropdown();
            }
        });
    }

    /**
     * 切换通知下拉菜单的显示状态
     */
    toggleNotificationDropdown(e) {
        e.stopPropagation();
        
        // 检查是否已有下拉菜单
        let dropdown = document.querySelector('.notification-dropdown');
        
        if (dropdown) {
            // 如果已存在，则关闭
            this.closeNotificationDropdown();
        } else {
            // 如果不存在，则创建并显示
            this.showNotificationDropdown();
        }
    }

    /**
     * 显示通知下拉菜单
     */
    showNotificationDropdown() {
        // 创建下拉菜单元素
        const dropdown = document.createElement('div');
        dropdown.className = 'notification-dropdown';
        
        // 添加下拉菜单头部
        dropdown.innerHTML = `
            <div class="dropdown-header">
                <h3>通知</h3>
                <a href="notifications.html" class="view-all">查看全部</a>
            </div>
            <div class="dropdown-content">
                ${this.renderNotificationItems()}
            </div>
        `;
        
        // 添加样式
        dropdown.style.position = 'absolute';
        dropdown.style.top = '60px';
        dropdown.style.right = '80px';
        dropdown.style.width = '350px';
        dropdown.style.backgroundColor = '#fff';
        dropdown.style.borderRadius = '8px';
        dropdown.style.boxShadow = '0 5px 15px rgba(0,0,0,0.1)';
        dropdown.style.zIndex = '1000';
        dropdown.style.overflow = 'hidden';
        
        // 添加头部样式
        const header = dropdown.querySelector('.dropdown-header');
        if (header) {
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.padding = '15px';
            header.style.borderBottom = '1px solid #eee';
        }
        
        const title = dropdown.querySelector('.dropdown-header h3');
        if (title) {
            title.style.margin = '0';
            title.style.fontSize = '16px';
            title.style.color = '#333';
        }
        
        const viewAll = dropdown.querySelector('.view-all');
        if (viewAll) {
            viewAll.style.fontSize = '14px';
            viewAll.style.color = '#4a6cf7';
            viewAll.style.textDecoration = 'none';
        }
        
        // 将下拉菜单添加到页面
        document.body.appendChild(dropdown);
        
        // 绑定通知项的点击事件
        this.bindNotificationEvents();
    }

    /**
     * 渲染通知项目
     */
    renderNotificationItems() {
        if (!this.notifications || this.notifications.length === 0) {
            return `
                <div class="empty-notifications">
                    <i class="fas fa-bell-slash"></i>
                    <p>暂无通知</p>
                </div>
            `;
        }
        
        // 最多显示5条通知
        const displayNotifications = this.notifications.slice(0, 5);
        
        return displayNotifications.map(notification => {
            let iconClass = '';
            
            // 根据通知类型设置图标
            switch (notification.type) {
                case 'booking':
                    iconClass = notification.subtype === 'confirmation' ? 'fa-calendar-check' : 
                                notification.subtype === 'reminder' ? 'fa-clock' : 
                                notification.subtype === 'cancellation' ? 'fa-times-circle' : 'fa-calendar-alt';
                    break;
                case 'review':
                    iconClass = notification.subtype === 'reply' ? 'fa-comment-alt' : 'fa-star';
                    break;
                case 'system':
                    iconClass = notification.subtype === 'maintenance' ? 'fa-wrench' : 
                                notification.subtype === 'security' ? 'fa-shield-alt' : 
                                notification.subtype === 'promotion' ? 'fa-gift' : 'fa-bullhorn';
                    break;
                default:
                    iconClass = 'fa-bell';
            }
            
            // 格式化时间
            const timeStr = this.formatNotificationTime(notification.created_at);
            
            return `
                <div class="notification-item ${notification.is_read ? '' : 'unread'}" data-id="${notification.id}" data-type="${notification.type}">
                    ${notification.is_read ? '' : '<div class="unread-indicator"></div>'}
                    <div class="notification-icon">
                        <i class="fas ${iconClass}"></i>
                    </div>
                    <div class="notification-content">
                        <h4>${notification.title}</h4>
                        <p>${notification.content}</p>
                        <div class="notification-meta">
                            <span class="notification-time">${timeStr}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * 绑定通知项的点击事件
     */
    bindNotificationEvents() {
        const notificationItems = document.querySelectorAll('.notification-dropdown .notification-item');
        
        notificationItems.forEach(item => {
            item.addEventListener('click', async (e) => {
                e.stopPropagation();
                
                const notificationId = item.getAttribute('data-id');
                const notificationType = item.getAttribute('data-type');
                
                // 标记为已读
                await this.markAsRead(notificationId);
                
                // 根据通知类型跳转到相应页面
                this.navigateByNotificationType(notificationType, notificationId);
            });
        });
    }

    /**
     * 根据通知类型导航到相应页面
     */
    navigateByNotificationType(type, id) {
        // 关闭通知下拉菜单
        this.closeNotificationDropdown();
        
        // 根据类型跳转
        switch (type) {
            case 'booking':
                window.location.href = 'appointment-detail.html?id=' + id;
                break;
            case 'review':
                window.location.href = 'my-reviews.html';
                break;
            case 'system':
                window.location.href = 'notifications.html';
                break;
            default:
                window.location.href = 'notifications.html';
        }
    }

    /**
     * 标记通知为已读
     * @param {string} notificationId 通知ID
     */
    async markAsRead(notificationId) {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                return false;
            }
            
            // 发送标记为已读的请求
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
            
            // 更新本地通知状态
            const notification = this.notifications.find(n => n.id === notificationId);
            if (notification) {
                notification.is_read = true;
                this.unreadCount = Math.max(0, this.unreadCount - 1);
                this.updateNotificationBadges();
            }
            
            return true;
        } catch (error) {
            console.error('标记通知为已读失败:', error);
            return false;
        }
    }

    /**
     * 标记所有通知为已读
     */
    async markAllAsRead() {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                return false;
            }
            
            // 发送标记所有为已读的请求
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
            
            // 更新本地通知状态
            this.notifications.forEach(notification => {
                notification.is_read = true;
            });
            
            this.unreadCount = 0;
            this.updateNotificationBadges();
            
            return true;
        } catch (error) {
            console.error('标记所有通知为已读失败:', error);
            return false;
        }
    }

    /**
     * 关闭通知下拉菜单
     */
    closeNotificationDropdown() {
        const dropdown = document.querySelector('.notification-dropdown');
        if (dropdown) {
            dropdown.remove();
        }
    }

    /**
     * 格式化通知时间
     */
    formatNotificationTime(dateString) {
        if (!dateString) return '';
        
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
            return date.toLocaleDateString();
        }
    }
    
    /**
     * 创建新通知
     * @param {Object} notificationData 通知数据
     */
    async createNotification(notificationData) {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                return null;
            }
            
            // 发送创建通知的请求
            const response = await fetch('/api/notifications', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(notificationData)
            });
            
            if (!response.ok) {
                throw new Error(`创建通知失败: ${response.status}`);
            }
            
            const result = await response.json();
            
            // 如果创建成功，添加到本地通知列表
            if (result && result.notification) {
                this.notifications.unshift(result.notification);
                if (!result.notification.is_read) {
                    this.unreadCount++;
                    this.updateNotificationBadges();
                }
                return result.notification;
            }
            
            return null;
        } catch (error) {
            console.error('创建通知失败:', error);
            return null;
        }
    }
    
    /**
     * 删除通知
     * @param {string} notificationId 通知ID
     */
    async deleteNotification(notificationId) {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                return false;
            }
            
            // 发送删除通知的请求
            const response = await fetch(`/api/user/notifications/${notificationId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`删除通知失败: ${response.status}`);
            }
            
            // 从本地通知列表中移除
            const index = this.notifications.findIndex(n => n.id === notificationId);
            if (index !== -1) {
                const notification = this.notifications[index];
                this.notifications.splice(index, 1);
                
                // 如果是未读通知，减少未读计数
                if (!notification.is_read) {
                    this.unreadCount = Math.max(0, this.unreadCount - 1);
                    this.updateNotificationBadges();
                }
            }
            
            return true;
        } catch (error) {
            console.error('删除通知失败:', error);
            return false;
        }
    }
}

// 创建通知管理器实例
const notificationManager = new NotificationManager();

// 将通知管理器暴露到全局作用域，以便其他脚本可以访问
window.notificationManager = notificationManager;

// 当页面加载完成后初始化通知管理器
document.addEventListener('DOMContentLoaded', () => {
    // 检查用户是否已登录
    if (localStorage.getItem('token')) {
        notificationManager.init();
    }
}); 