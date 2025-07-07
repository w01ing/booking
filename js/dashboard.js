// 农历数据（简化版，仅用于演示）
const lunarData = {
    '2025-06-01': '初六',
    '2025-06-02': '初七',
    '2025-06-03': '初八',
    '2025-06-04': '初九',
    '2025-06-05': '初十',
    '2025-06-06': '十一',
    '2025-06-07': '十二',
    '2025-06-08': '十三',
    '2025-06-09': '十四',
    '2025-06-10': '十五',
    '2025-06-11': '十六',
    '2025-06-12': '十七',
    '2025-06-13': '十八',
    '2025-06-14': '十九',
    '2025-06-15': '二十',
    '2025-06-16': '廿一',
    '2025-06-17': '廿二',
    '2025-06-18': '廿三',
    '2025-06-19': '廿四',
    '2025-06-20': '廿五',
    '2025-06-21': '廿六',
    '2025-06-22': '廿七',
    '2025-06-23': '廿八',
    '2025-06-24': '廿九',
    '2025-06-25': '六月',
    '2025-06-26': '初二',
    '2025-06-27': '初三',
    '2025-06-28': '初四',
    '2025-06-29': '初五',
    '2025-06-30': '初六'
};

// 休息日数据
const holidayData = ['2025-06-01', '2025-06-02'];

// 全局变量，存储预约数据
let allBookings = [];
let pendingBookings = [];
let upcomingBookings = [];
let bookingStats = { pending: 0, upcoming: 0, completed: 0, canceled: 0 };
let userInfo = {};

// 添加轮询监控预约状态变化的功能
let pollingInterval = null;
const POLLING_INTERVAL_MS = 5000; // 5秒钟轮询一次

// 启动预约状态监控
function startBookingStatusMonitor() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }
    
    // 创建轮询
    pollingInterval = setInterval(async () => {
        try {
            if (document.hidden) {
                // 如果页面不可见，不执行轮询
                return;
            }
            
            // 获取最新数据
            const dashboardData = await fetchDashboardBookings();
            const newPendingBookings = dashboardData.pending || [];
            const newUpcomingBookings = dashboardData.upcoming || [];
            const newAllBookings = [...newPendingBookings, ...newUpcomingBookings];
            
            // 检查是否有变化
            const hasChanges = checkBookingsChanges(
                [...pendingBookings, ...upcomingBookings], 
                newAllBookings
            );
            
            // 如果有变化，更新UI
            if (hasChanges) {
                console.log('检测到预约状态变化，更新UI');
                pendingBookings = newPendingBookings;
                upcomingBookings = newUpcomingBookings;
                allBookings = newAllBookings;
                
                // 更新UI
                generateCalendar(allBookings);
                renderDashboardBookings();
                
                // 更新统计数据
                const statsData = await fetchBookingStats();
                bookingStats = statsData.stats || { pending: 0, upcoming: 0, completed: 0, canceled: 0 };
                updateBookingStats();
            }
        } catch (error) {
            console.error('轮询预约状态时出错:', error);
            // 出错时不停止轮询，但记录错误
        }
    }, POLLING_INTERVAL_MS);
    
    // 当页面不可见时暂停轮询，可见时恢复
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            console.log('页面不可见，暂停轮询');
        } else {
            console.log('页面可见，恢复轮询');
            // 立即执行一次轮询
            fetchDashboardBookings().then(dashboardData => {
                pendingBookings = dashboardData.pending || [];
                upcomingBookings = dashboardData.upcoming || [];
                allBookings = [...pendingBookings, ...upcomingBookings];
                
                // 更新UI
                generateCalendar(allBookings);
                renderDashboardBookings();
            }).catch(error => {
                console.error('恢复轮询时出错:', error);
            });
        }
    });
}

// 停止预约状态监控
function stopBookingStatusMonitor() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

// 检查预约是否有变化
function checkBookingsChanges(oldBookings, newBookings) {
    // 简单比较两个数组长度
    if (oldBookings.length !== newBookings.length) {
        return true;
    }
    
    // 创建旧预约的映射，方便查找
    const oldBookingsMap = {};
    oldBookings.forEach(booking => {
        oldBookingsMap[booking.id] = booking;
    });
    
    // 检查每个新预约
    for (const newBooking of newBookings) {
        const oldBooking = oldBookingsMap[newBooking.id];
        
        // 如果旧预约中没有这个ID，或者状态不同，表示有变化
        if (!oldBooking || oldBooking.status !== newBooking.status) {
            return true;
        }
    }
    
    // 没有检测到变化
    return false;
}

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', async function() {
    // 初始化左侧预约状态卡片点击事件（无论是否登录都要初始化）
    initializeBookingStatCards();
    
    // 检查用户是否已登录
    if (!checkAuth()) return;

    try {
        // 获取统计数据
        const statsData = await fetchBookingStats();
        
        // 更新全局统计数据
        bookingStats = statsData.stats || { pending: 0, upcoming: 0, completed: 0, canceled: 0 };
        userInfo = statsData.user || {};
        
        // 更新用户信息
        updateUserInfo();
        
        // 更新左侧导航栏的预约统计
        updateBookingStats();
        
        // 获取仪表盘预约数据
        const dashboardData = await fetchDashboardBookings();
        
        // 更新全局变量
        pendingBookings = dashboardData.pending || [];
        upcomingBookings = dashboardData.upcoming || [];
        allBookings = [...pendingBookings, ...upcomingBookings];
        
        // 生成日历
        generateCalendar(allBookings);
        
        // 渲染预约列表
        renderDashboardBookings();
        
        // 启动预约状态监控
        startBookingStatusMonitor();
    } catch (error) {
        console.error('初始化仪表盘失败:', error);
        showError('加载仪表盘数据失败，请刷新页面重试');
    }
});

// 页面卸载时停止监控
window.addEventListener('beforeunload', () => {
    stopBookingStatusMonitor();
});

// 获取当前日期
function getCurrentDate() {
    // 使用实际当前日期，而非演示日期
    return new Date();
}

// 获取预约统计数据
async function fetchBookingStats() {
    try {
        console.log('开始从API获取预约统计数据');
        
        // 获取认证令牌
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('未找到认证令牌');
            return { stats: { pending: 0, upcoming: 0, completed: 0, canceled: 0 }, user: null };
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
    } catch (error) {
        console.error('获取预约统计数据失败:', error);
        // 返回默认数据
        return { 
            stats: { pending: 0, upcoming: 0, completed: 0, canceled: 0 },
            user: null
        };
    }
}

// 获取所有服务数据
async function fetchAllServices() {
    console.log('开始获取所有服务数据');
    
    try {
        // 从API获取服务数据
        console.log('使用API获取服务数据');
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('未找到认证令牌');
            throw new Error('未找到认证令牌');
        }
        
        const response = await fetch('/api/services', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
        }
        
        const services = await response.json();
        console.log('成功从API获取服务数据:', services.length, '条');
        return services;
    } catch (error) {
        console.error('获取服务数据失败:', error);
        return [];
    }
}

// 获取所有服务提供商数据
async function fetchAllProviders() {
    console.log('开始获取所有服务提供商数据');
    
    try {
        // 从API获取服务提供商数据
        console.log('使用API获取服务提供商数据');
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('未找到认证令牌');
            throw new Error('未找到认证令牌');
        }
        
        const response = await fetch('/api/providers', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
        }
        
        const providers = await response.json();
        console.log('成功从API获取服务提供商数据:', providers.length, '条');
        return providers;
    } catch (error) {
        console.error('获取服务提供商数据失败:', error);
        return [];
    }
}

// 从后端API获取仪表盘预约数据
async function fetchDashboardBookings() {
    try {
        console.log('开始从API获取仪表盘预约数据');
        
        // 获取认证令牌
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('未找到认证令牌');
            return { pending: [], upcoming: [] };
        }
        
        // 从新的仪表盘API获取预约数据
        const response = await fetch('/api/bookings/dashboard', {
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
        console.log('成功获取仪表盘预约数据:', 
                    '待确认:', data.pending?.length || 0, '条, ',
                    '即将到来:', data.upcoming?.length || 0, '条');
        return data;
    } catch (error) {
        console.error('获取仪表盘预约数据失败:', error);
        // 返回空对象
        return { pending: [], upcoming: [] };
    }
}

// 更新预约统计信息
function updateBookingStats() {
    // 使用从API获取的统计数据更新UI
    
    // 更新待确认预约数量
    const waitingElement = document.querySelector('.stat-card.waiting .stat-value');
    if (waitingElement) waitingElement.textContent = bookingStats.pending;
    
    // 更新即将到来的预约数量
    const upcomingElement = document.querySelector('.stat-card.upcoming .stat-value');
    if (upcomingElement) upcomingElement.textContent = bookingStats.upcoming;
    
    // 更新已完成预约数量
    const completedElement = document.querySelector('.stat-card.completed .stat-value');
    if (completedElement) completedElement.textContent = bookingStats.completed;
    
    // 更新已取消预约数量
    const cancelledElement = document.querySelector('.stat-card.cancelled .stat-value');
    if (cancelledElement) cancelledElement.textContent = bookingStats.canceled;
    
   
}

// 生成预约日历
function generateCalendar(bookings = []) {
    const calendarGrid = document.getElementById('calendarGrid');
    if (!calendarGrid) return;
    
    // 清空日历
    calendarGrid.innerHTML = '';
    
    // 获取当前日期信息
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    
    // 设置月份标题
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    const monthTitle = document.getElementById('currentMonthTitle');
    if (monthTitle) {
        monthTitle.textContent = `${currentYear}年 ${monthNames[currentMonth]}`;
    }
    
    // 计算当月第一天是星期几
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const firstDayWeekday = firstDayOfMonth.getDay(); // 0表示周日，1表示周一，以此类推
    
    // 计算当月有多少天
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    // 计算上个月的最后几天（用于填充日历开始）
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
    
    // 生成上个月的最后几天
    for (let i = 0; i < firstDayWeekday; i++) {
        const dayNumber = prevMonthDays - firstDayWeekday + i + 1;
        const dayDiv = createCalendarDay(dayNumber, 'prev-month');
        calendarGrid.appendChild(dayDiv);
    }
    
    // 生成当月的天数
    for (let i = 1; i <= daysInMonth; i++) {
        const isToday = i === today.getDate();
        const dayDiv = createCalendarDay(i, isToday ? 'today' : '');
        
        // 检查这一天是否有预约
        const dateStr = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
        const dayBookings = bookings.filter(booking => {
            const bookingDate = new Date(booking.date);
            return bookingDate.getFullYear() === currentYear && 
                   bookingDate.getMonth() === currentMonth && 
                   bookingDate.getDate() === i;
        });
        
        if (dayBookings.length > 0) {
            const indicator = document.createElement('div');
            indicator.className = 'appointment-indicator';
            dayDiv.appendChild(indicator);
        }
        
        calendarGrid.appendChild(dayDiv);
    }
    
    // 计算还需要多少天来填满日历（显示下个月的前几天）
    const totalCells = 42; // 6行7列
    const remainingCells = totalCells - (firstDayWeekday + daysInMonth);
    
    // 生成下个月的前几天
    for (let i = 1; i <= remainingCells; i++) {
        const dayDiv = createCalendarDay(i, 'next-month');
        calendarGrid.appendChild(dayDiv);
    }
}

// 创建日历天数单元格
function createCalendarDay(dayNumber, className = '') {
    const dayDiv = document.createElement('div');
    dayDiv.className = `calendar-day ${className}`;
    
    const dayNumberSpan = document.createElement('div');
    dayNumberSpan.className = 'calendar-day-number';
    dayNumberSpan.textContent = dayNumber;
    dayDiv.appendChild(dayNumberSpan);
    
    return dayDiv;
}

// 渲染预约（待确认和即将到来）
function renderDashboardBookings() {
    // 渲染待确认的预约
    renderPendingBookings();
    
    // 渲染即将到来的预约
    renderUpcomingBookings();
}

// 渲染待确认的预约
function renderPendingBookings() {
    const pendingContainer = document.getElementById('pendingBookings');
    if (!pendingContainer) return;
    
    // 清空容器
    pendingContainer.innerHTML = '';
    
    // 如果没有待确认的预约，显示空状态
    if (pendingBookings.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
            <div class="icon"><i class="fas fa-calendar-times"></i></div>
            <h3>暂无待确认的预约</h3>
            <p>当您预约新服务后，需要等待服务商确认</p>
        `;
        pendingContainer.appendChild(emptyState);
        return;
    }
    
    // 渲染每个待确认的预约
    pendingBookings.forEach(booking => {
        const bookingItem = createBookingItem(booking);
        pendingContainer.appendChild(bookingItem);
    });
}

// 渲染即将到来的预约
function renderUpcomingBookings() {
    const upcomingContainer = document.getElementById('upcomingBookings');
    if (!upcomingContainer) return;
    
    // 清空容器
    upcomingContainer.innerHTML = '';
    
    // 如果没有即将到来的预约，显示空状态
    if (upcomingBookings.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
            <div class="icon"><i class="fas fa-calendar-day"></i></div>
            <h3>暂无即将到来的预约</h3>
            <p>您的已确认预约将显示在这里</p>
        `;
        upcomingContainer.appendChild(emptyState);
            return;
        }
        
    // 渲染每个即将到来的预约
    upcomingBookings.forEach(booking => {
        const bookingItem = createBookingItem(booking);
        upcomingContainer.appendChild(bookingItem);
    });
}

// 创建预约项
function createBookingItem(booking) {
    // 获取服务名称和图片
    let serviceName = '未知服务';
    let serviceImage = 'img/service-placeholder.jpg';
    let providerName = '未知服务商';
    
    // 如果存在服务信息，使用服务信息
    if (booking.service) {
        serviceName = booking.service.title || '未知服务';
        serviceImage = booking.service.image || 'img/service-placeholder.jpg';
        
        // 如果存在提供商信息，获取提供商名称
        if (booking.provider) {
            providerName = booking.provider.business_name || booking.provider.username || '未知服务商';
        }
    }
    
    // 创建预约项元素
    const bookingItem = document.createElement('div');
    bookingItem.className = 'booking-item';
    bookingItem.dataset.id = booking.id;
    
    // 格式化日期为人类可读格式
    let formattedDate = '';
    if (booking.date) {
        const dateObj = new Date(booking.date);
        formattedDate = dateObj.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
    }
    
    // 构建预约项内容
    bookingItem.innerHTML = `
                    <div class="booking-time">
                        <div class="date">${formattedDate}</div>
                    <div class="time">${booking.time || ''}</div>
                    </div>
                    <div class="booking-info">
            <div class="service-name">${serviceName}</div>
                    <div class="service-provider"><i class="fas fa-store"></i> ${providerName}</div>
                    </div>
                    <div class="booking-status">
            <div class="status-badge status-${booking.status}">${getStatusText(booking.status)}</div>
            <div class="booking-actions">
                <button class="btn-detail" data-id="${booking.id}">查看详情</button>
                ${(booking.status === 'pending' || booking.status === 'confirmed') ? 
                    `<button class="btn-cancel" data-id="${booking.id}">取消预约</button>` : ''}
            </div>
                    </div>
                `;
                
    // 为查看详情按钮添加点击事件
    const detailBtn = bookingItem.querySelector('.btn-detail');
    if (detailBtn) {
        detailBtn.addEventListener('click', () => {
            window.location.href = `appointment-detail.html?id=${booking.id}`;
        });
    }

    // 为取消预约按钮添加点击事件
    const cancelBtn = bookingItem.querySelector('.btn-cancel');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log(`点击取消预约按钮: ID=${booking.id}, 服务=${serviceName}`);
            
            // 确保能找到模态框
            if (!document.getElementById('rebookModal')) {
                console.error('无法找到模态框元素，无法显示确认对话框');
                showError('系统错误：无法显示确认对话框');
                return;
            }
            
            showCancelConfirmation(booking.id, serviceName);
        });
    }
    
    return bookingItem;
}

// 获取状态文本
function getStatusText(status) {
    const statusMap = {
        'pending': '待确认',
        'confirmed': '已确认',
        'completed': '已完成',
        'canceled': '已取消'
    };
    return statusMap[status] || status;
}

// 显示错误提示
function showError(message) {
    // 如果页面上没有错误消息容器，创建一个
    let errorContainer = document.getElementById('errorContainer');
    if (!errorContainer) {
        errorContainer = document.createElement('div');
        errorContainer.id = 'errorContainer';
        errorContainer.style.position = 'fixed';
        errorContainer.style.top = '20px';
        errorContainer.style.right = '20px';
        errorContainer.style.zIndex = '1000';
        document.body.appendChild(errorContainer);
    }
    
    // 创建错误消息元素
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.innerHTML = `
        <div style="background-color: #f44336; color: white; padding: 15px; border-radius: 4px; margin-bottom: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); display: flex; align-items: center;">
            <i class="fas fa-exclamation-circle" style="margin-right: 10px;"></i>
            <span>${message}</span>
            <button style="margin-left: 10px; background: none; border: none; color: white; cursor: pointer; font-size: 16px;">&times;</button>
        </div>
    `;
    
    // 添加关闭按钮功能
    const closeButton = errorElement.querySelector('button');
    closeButton.addEventListener('click', () => {
        errorElement.style.opacity = '0';
        errorElement.style.transition = 'opacity 0.5s';
        setTimeout(() => {
            if (errorContainer.contains(errorElement)) {
                errorContainer.removeChild(errorElement);
            }
        }, 500);
    });
    
    // 添加到容器
    errorContainer.appendChild(errorElement);
    
    // 5秒后自动移除
    setTimeout(() => {
        if (errorElement.parentNode === errorContainer) {
            errorElement.style.opacity = '0';
            errorElement.style.transition = 'opacity 0.5s';
            setTimeout(() => {
                if (errorContainer.contains(errorElement)) {
                    errorContainer.removeChild(errorElement);
                }
            }, 500);
        }
    }, 5000);
    
    // 记录到控制台
    console.error(message);
}
    
    // 更新用户信息
function updateUserInfo() {
    // 使用从API获取的用户信息更新UI
    if (!userInfo) {
        console.warn('未获取到用户信息');
        return;
    }
    
    // 更新页面上的用户名
    const userNameElements = document.querySelectorAll('.user-name');
    userNameElements.forEach(element => {
        element.textContent = userInfo.name || '用户';
    });
    
    // 更新侧边栏的用户名和角色
    const profileName = document.querySelector('.profile-name');
    if (profileName) profileName.textContent = userInfo.name || '用户';
    
    const profileRole = document.querySelector('.profile-role');
    if (profileRole) profileRole.textContent = userInfo.role || '普通用户';
}

// 显示取消预约确认对话框
function showCancelConfirmation(bookingId, serviceName) {
    console.log(`显示取消预约确认对话框: ID=${bookingId}, 服务=${serviceName}`);
    
    // 获取确认模态框元素
    const cancelModal = document.getElementById('rebookModal');
    if (!cancelModal) {
        console.error('找不到模态框元素 #rebookModal');
        return;
    }
    
    // 查找对应的预约对象以获取更多信息
    const booking = [...pendingBookings, ...upcomingBookings].find(b => b.id === bookingId);
    if (!booking) {
        console.error('未找到对应的预约信息:', bookingId);
        return;
    }
    
    // 移除所有现有的事件监听器
    const oldModal = cancelModal.cloneNode(true);
    cancelModal.parentNode.replaceChild(oldModal, cancelModal);
    
    // 使用新模态框的引用
    const newModal = oldModal;
    
    // 更新模态框标题和内容
    const modalTitle = newModal.querySelector('.modal-header h3');
    if (modalTitle) modalTitle.textContent = '取消预约确认';
    
    const serviceTitle = newModal.querySelector('#serviceTitle');
    if (serviceTitle) serviceTitle.textContent = serviceName;
    
    const modalBody = newModal.querySelector('.modal-body p');
    if (modalBody) {
        const dateFormatted = booking.date ? new Date(booking.date).toLocaleDateString('zh-CN') : '未知日期';
        modalBody.innerHTML = `
            <p>您确定要取消以下预约吗？</p>
            <div style="margin: 15px 0; padding: 10px; background-color: #f8f9fa; border-radius: 4px; border-left: 4px solid #007bff;">
                <p style="margin: 5px 0"><strong>服务：</strong>${serviceName}</p>
                <p style="margin: 5px 0"><strong>日期：</strong>${dateFormatted}</p>
                <p style="margin: 5px 0"><strong>时间：</strong>${booking.time || '未知时间'}</p>
            </div>
            <p style="color: #dc3545; font-size: 0.9em;">提示：取消预约后无法恢复，需要重新预约。</p>
        `;
    }
    
    // 更新按钮文本
    const confirmBtn = newModal.querySelector('.btn-primary');
    if (confirmBtn) {
        confirmBtn.textContent = '确认取消';
        confirmBtn.className = 'btn btn-danger';
        
        // 添加新的事件监听器
        confirmBtn.addEventListener('click', () => {
            console.log(`点击确认取消按钮: ${bookingId}`);
            cancelBooking(bookingId);
            newModal.style.display = 'none';
        });
    } else {
        console.error('找不到确认按钮');
    }
    
    // 为关闭按钮添加事件监听器
    const closeButtons = newModal.querySelectorAll('.close-btn, .btn-cancel');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            console.log('点击关闭按钮');
            newModal.style.display = 'none';
        });
    });
    
    // 点击模态框外部时关闭
    newModal.addEventListener('click', (event) => {
        if (event.target === newModal) {
            console.log('点击模态框外部');
            newModal.style.display = 'none';
        }
    });
    
    // 添加ESC键关闭
    document.addEventListener('keydown', function escKeyHandler(event) {
        if (event.key === 'Escape' && newModal.style.display === 'flex') {
            console.log('按下ESC键');
            newModal.style.display = 'none';
            document.removeEventListener('keydown', escKeyHandler);
        }
    });
    
    // 显示模态框 - 既设置display:flex又添加active类以确保正常显示
    newModal.style.display = 'flex';
    newModal.classList.add('active');
    console.log('模态框已显示');
}

// 取消预约
async function cancelBooking(bookingId) {
    // 显示加载覆盖层，防止用户重复点击
    const loadingOverlay = document.createElement('div');
    loadingOverlay.style.position = 'fixed';
    loadingOverlay.style.top = '0';
    loadingOverlay.style.left = '0';
    loadingOverlay.style.width = '100%';
    loadingOverlay.style.height = '100%';
    loadingOverlay.style.background = 'rgba(0, 0, 0, 0.1)';
    loadingOverlay.style.zIndex = '9000';
    loadingOverlay.id = 'loading-overlay';
    document.body.appendChild(loadingOverlay);
    
    try {
        // 获取取消按钮，添加加载状态
        const cancelButtons = document.querySelectorAll(`.btn-cancel[data-id="${bookingId}"]`);
        cancelButtons.forEach(btn => {
            btn.disabled = true;
            btn.textContent = '取消中...';
            btn.classList.add('loading');
        });

        const token = localStorage.getItem('token');
        if (!token) {
            showError('未登录或登录已过期');
            return;
        }
        
        console.log(`正在发送取消预约请求: ${bookingId}`);
        
        // 使用 try-catch 包装 fetch 请求
        let response;
        try {
            response = await fetch(`/api/bookings/${bookingId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        } catch (fetchError) {
            console.error('网络请求失败:', fetchError);
            throw new Error('网络连接失败，请检查您的网络连接');
        }
        
        console.log(`收到响应: ${response.status}`);
        
        // 尝试解析响应JSON
        let responseData;
        try {
            responseData = await response.json();
            console.log('响应数据:', responseData);
        } catch (jsonError) {
            console.error('解析响应JSON失败:', jsonError);
            responseData = {};
        }
        
        // 检查响应状态
        if (!response.ok) {
            throw new Error(responseData.message || `取消预约失败: ${response.status}`);
        }
        
        // 关闭模态框
        const cancelModal = document.getElementById('rebookModal');
        if (cancelModal) {
            cancelModal.style.display = 'none';
            cancelModal.classList.remove('active');
        }
        
        // 延迟刷新数据，确保后端数据已更新
        setTimeout(async () => {
            try {
                console.log('正在刷新预约数据...');
        const statsData = await fetchBookingStats();
        bookingStats = statsData.stats || { pending: 0, upcoming: 0, completed: 0, canceled: 0 };
        updateBookingStats();
        
        const dashboardData = await fetchDashboardBookings();
        pendingBookings = dashboardData.pending || [];
        upcomingBookings = dashboardData.upcoming || [];
        allBookings = [...pendingBookings, ...upcomingBookings];
        
                // 更新UI
        generateCalendar(allBookings);
        renderDashboardBookings();
        
        // 显示成功消息
                showSuccessMessage('预约已成功取消');
            } catch (refreshError) {
                console.error('刷新数据失败:', refreshError);
                // 即使刷新失败，也不影响取消预约操作
                showSuccessMessage('预约已取消，但页面数据刷新失败，请手动刷新页面');
            }
        }, 500);
    } catch (error) {
        console.error('取消预约失败:', error);
        showError(error.message || '取消预约失败，请稍后重试');
    } finally {
        // 移除加载覆盖层
        const overlay = document.getElementById('loading-overlay');
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
        
        // 恢复按钮状态
        const cancelButtons = document.querySelectorAll(`.btn-cancel[data-id="${bookingId}"]`);
        cancelButtons.forEach(btn => {
            btn.disabled = false;
            btn.textContent = '取消预约';
            btn.classList.remove('loading');
        });
    }
}

// 显示成功消息
function showSuccessMessage(message) {
    // 如果页面上没有消息容器，创建一个
    let messageContainer = document.getElementById('messageContainer');
    if (!messageContainer) {
        messageContainer = document.createElement('div');
        messageContainer.id = 'messageContainer';
        messageContainer.style.position = 'fixed';
        messageContainer.style.top = '20px';
        messageContainer.style.right = '20px';
        messageContainer.style.zIndex = '1000';
        document.body.appendChild(messageContainer);
    }
    
    // 创建消息元素
    const messageElement = document.createElement('div');
    messageElement.className = 'success-message';
    messageElement.innerHTML = `
        <div style="background-color: #4CAF50; color: white; padding: 15px; border-radius: 4px; margin-bottom: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); display: flex; align-items: center;">
            <i class="fas fa-check-circle" style="margin-right: 10px;"></i>
            <span>${message}</span>
        </div>
    `;
    
    // 添加到容器
    messageContainer.appendChild(messageElement);
    
    // 3秒后自动移除
    setTimeout(() => {
        messageElement.style.opacity = '0';
        messageElement.style.transition = 'opacity 0.5s';
        setTimeout(() => {
            messageContainer.removeChild(messageElement);
        }, 500);
    }, 3000);
} 

// 月份切换按钮事件
function setupMonthSwitch() {
    const prevBtn = document.getElementById('prevMonth');
    const nextBtn = document.getElementById('nextMonth');
    prevBtn && prevBtn.addEventListener('click', async () => {
        calendarMonth--;
        if (calendarMonth < 0) {
            calendarMonth = 11;
            calendarYear--;
        }
        const bookings = await fetchDashboardBookings();
        generateCalendar(bookings, calendarYear, calendarMonth);
    });
    nextBtn && nextBtn.addEventListener('click', async () => {
        calendarMonth++;
        if (calendarMonth > 11) {
            calendarMonth = 0;
            calendarYear++;
        }
        const bookings = await fetchDashboardBookings();
        generateCalendar(bookings, calendarYear, calendarMonth);
    });
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

