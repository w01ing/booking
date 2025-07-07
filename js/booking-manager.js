// booking-manager.js - 处理预约管理

// 获取用户的所有预约
async function fetchUserBookings() {
    try {
        console.log('开始从API获取用户预约数据');
        
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('未找到认证令牌');
            return [];
        }
        
        const response = await fetch('/api/bookings', {
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
        console.log('成功获取预约数据:', data.length, '条');
        return data;
    } catch (error) {
        console.error('获取用户预约数据失败:', error);
        return [];
    }
}

// 创建新预约
async function createBooking(bookingData) {
    try {
        console.log('开始创建新预约:', bookingData);
        
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('未找到认证令牌');
            throw new Error('未找到认证令牌');
        }
        
        const response = await fetch('/api/bookings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(bookingData)
        });
        
        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('成功创建预约:', data);
        return data;
    } catch (error) {
        console.error('创建预约失败:', error);
        throw error;
    }
}

// 修改预约
async function updateBooking(bookingId, updateData) {
    try {
        console.log(`开始更新预约 ${bookingId}:`, updateData);
        
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('未找到认证令牌');
            throw new Error('未找到认证令牌');
        }
        
        const response = await fetch(`/api/bookings/${bookingId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updateData)
        });
        
        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('成功更新预约:', data);
        return data;
    } catch (error) {
        console.error('更新预约失败:', error);
        throw error;
    }
}

// 取消预约
async function cancelBooking(bookingId) {
    try {
        console.log(`开始取消预约 ${bookingId}`);
        
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('未找到认证令牌');
            throw new Error('未找到认证令牌');
        }
        
        const response = await fetch(`/api/bookings/${bookingId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('成功取消预约:', data);
        return data;
    } catch (error) {
        console.error('取消预约失败:', error);
        throw error;
    }
}

// 更新预约状态统计
function updateBookingStats(bookings) {
    // 计算不同状态的预约数量
    const stats = {
        waiting: 0,
        upcoming: 0,
        completed: 0,
        canceled: 0,
        expired: 0
    };
    
    const now = new Date();
    
    bookings.forEach(booking => {
        // 检查预约是否已过期
        const bookingDate = new Date(`${booking.date} ${booking.time}`);
        if (booking.status === 'upcoming' && bookingDate < now) {
            stats.expired++;
        } else if (booking.status === 'waiting') {
            stats.waiting++;
        } else if (booking.status === 'upcoming') {
            stats.upcoming++;
        } else if (booking.status === 'completed') {
            stats.completed++;
        } else if (booking.status === 'canceled') {
            stats.canceled++;
        }
    });
    
    // 更新侧边栏统计数字
    const waitingElement = document.querySelector('.stat-card.waiting .stat-value');
    if (waitingElement) waitingElement.textContent = stats.waiting;
    
    const upcomingElement = document.querySelector('.stat-card.upcoming .stat-value');
    if (upcomingElement) upcomingElement.textContent = stats.upcoming;
    
    const completedElement = document.querySelector('.stat-card.completed .stat-value');
    if (completedElement) completedElement.textContent = stats.completed;
    
    const cancelledElement = document.querySelector('.stat-card.cancelled .stat-value');
    if (cancelledElement) cancelledElement.textContent = stats.canceled;
    
    // 更新预约历史徽章 - 移除徽章显示
    const historyBadge = document.querySelector('.nav-item[href="booking-history.html"] .item-badge');
    if (historyBadge) {
        historyBadge.textContent = '';
        historyBadge.style.display = 'none';
    }
    
    // 更新导航栏中的数字
    updateNavbarStats(stats);
}

// 更新导航栏中的预约统计数字
function updateNavbarStats(stats) {
    // 更新左侧导航栏中的数字
    const waitingNavBadge = document.querySelector('.nav-item[href="dashboard.html"] .item-badge');
    if (waitingNavBadge) {
        waitingNavBadge.textContent = stats.upcoming + stats.waiting;
    }
    
    // 不再在这里更新通知徽章，改为使用app.js中的updateNotificationBadge函数
    
    // 更新左侧卡片中的数字
    const waitingCard = document.querySelector('.stat-card:nth-child(1) .stat-value');
    if (waitingCard) waitingCard.textContent = stats.waiting;
    
    const upcomingCard = document.querySelector('.stat-card:nth-child(2) .stat-value');
    if (upcomingCard) upcomingCard.textContent = stats.upcoming;
    
    const completedCard = document.querySelector('.stat-card:nth-child(3) .stat-value');
    if (completedCard) completedCard.textContent = stats.completed;
    
    const canceledCard = document.querySelector('.stat-card:nth-child(4) .stat-value');
    if (canceledCard) canceledCard.textContent = stats.canceled;
}

// 渲染预约列表
function renderBookingList(bookings, selectedDate = null, filterStatus = 'all') {
    const bookingList = document.getElementById('bookingList');
    if (!bookingList) return;
    
    // 清空列表
    bookingList.innerHTML = '';
    
    // 检查并更新过期预约的状态
    const now = new Date();
    const updatedBookings = bookings.map(booking => {
        const bookingDate = new Date(`${booking.date} ${booking.time}`);
        if (booking.status === 'upcoming' && bookingDate < now) {
            return { ...booking, status: 'expired' };
        }
        return booking;
    });
    
    // 根据日期和状态过滤预约
    let filteredBookings = updatedBookings;
    
    if (selectedDate) {
        filteredBookings = filteredBookings.filter(booking => booking.date === selectedDate);
    }
    
    if (filterStatus !== 'all') {
        filteredBookings = filteredBookings.filter(booking => booking.status === filterStatus);
    }
    
    // 如果没有预约，显示提示信息
    if (filteredBookings.length === 0) {
        bookingList.innerHTML = '<div class="no-appointment">没有找到预约</div>';
        return;
    }
    
    // 按日期排序，时间近的排在上面
    filteredBookings.sort((a, b) => {
        // 将日期和时间字符串转换为Date对象
        const dateA = new Date(`${a.date} ${a.time}`);
        const dateB = new Date(`${b.date} ${b.time}`);
        const now = new Date();
        
        // 首先按状态排序：即将到来 > 待确认 > 已过期 > 已完成 > 已取消
        const statusOrder = {
            'upcoming': 1,
            'waiting': 2,
            'expired': 3,
            'completed': 4,
            'canceled': 5
        };
        
        if (statusOrder[a.status] !== statusOrder[b.status]) {
            return statusOrder[a.status] - statusOrder[b.status];
        }
        
        // 对于即将到来的预约，按时间从近到远排序
        if (a.status === 'upcoming' && b.status === 'upcoming') {
            return dateA - dateB;
        }
        
        // 对于已过期的预约，按时间从近到远排序（最近过期的排在前面）
        if (a.status === 'expired' && b.status === 'expired') {
            return dateB - dateA;
        }
        
        // 对于已完成和已取消的预约，按时间从近到远排序
        if ((a.status === 'completed' || a.status === 'canceled') && 
            (b.status === 'completed' || b.status === 'canceled')) {
            return dateB - dateA;
        }
        
        // 如果状态和时间关系都相同，按照创建时间排序，保证新创建的预约在正确的位置
        if (a.created_at && b.created_at) {
            return new Date(b.created_at) - new Date(a.created_at);
        }
        
        return 0;
    });
    
    // 渲染每个预约项
    filteredBookings.forEach(booking => {
        const bookingElement = document.createElement('div');
        bookingElement.className = 'booking-item';
        bookingElement.dataset.id = booking.id;
        
        // 格式化日期和时间
        const [year, month, day] = booking.date.split('-');
        const formattedDate = `${month}月${day}日`;
        
        // 状态文本
        let statusText = '';
        switch(booking.status) {
            case 'waiting':
                statusText = '待确认';
                break;
            case 'upcoming':
                statusText = '即将到来';
                break;
            case 'completed':
                statusText = '已完成';
                break;
            case 'canceled':
                statusText = '已取消';
                break;
            case 'expired':
                statusText = '已过期';
                break;
            default:
                statusText = booking.status;
        }
        
        bookingElement.innerHTML = `
            <div class="booking-time">
                <div class="date">${formattedDate}</div>
                <div class="time">${booking.time}</div>
            </div>
            <div class="booking-info">
                <div class="service-name">${booking.service ? booking.service.title : '未知服务'}</div>
                <div class="service-provider">${booking.provider ? booking.provider.business_name || booking.provider.username : '未知服务商'}</div>
                <div class="service-location">${booking.service && booking.service.location ? booking.service.location : '地址未提供'}</div>
            </div>
            <div class="booking-status">
                <span class="status-badge ${booking.status}">${statusText}</span>
                ${renderBookingActions(booking)}
            </div>
        `;
        
        // 添加预约项点击事件
        bookingElement.addEventListener('click', () => {
            showBookingDetails(booking);
        });
        
        // 添加到列表
        bookingList.appendChild(bookingElement);
        
        // 添加操作按钮事件
        const actionButtons = bookingElement.querySelectorAll('.booking-action');
        actionButtons.forEach(button => {
            // 移除旧的事件监听器（如果有的话）
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            
            // 添加新的事件监听器
            newButton.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止冒泡，避免触发预约项点击事件
                const action = newButton.dataset.action;
                const bookingId = booking.id;
                
                console.log('按钮点击:', action, bookingId, booking); // 调试日志
                
                switch(action) {
                    case 'cancel':
                        confirmCancelBooking(bookingId);
                        break;
                    case 'reschedule':
                        showRescheduleModal(booking);
                        break;
                    case 'rebook':
                        showRebookModal(booking);
                        break;
                    case 'review':
                        window.location.href = `my-reviews.html?booking=${bookingId}`;
                        break;
                }
            });
        });
    });
}

// 渲染预约操作按钮
function renderBookingActions(booking) {
    let actions = '';
    
    switch(booking.status) {
        case 'waiting':
        case 'upcoming':
            actions = `
                <button class="btn btn-cancel booking-action" data-action="cancel">取消</button>
                <button class="btn btn-primary booking-action" data-action="reschedule">改期</button>
            `;
            break;
        case 'expired':
            actions = `
                <button class="btn btn-primary booking-action" data-action="rebook">重新预约</button>
            `;
            break;
        case 'completed':
            // 检查是否需要评价
            if (booking.review_needed) {
            actions = `
                <button class="btn btn-primary booking-action" data-action="review">评价</button>
                <button class="btn btn-primary booking-action" data-action="rebook">再次预约</button>
            `;
            } else {
                actions = `
                    <button class="btn btn-primary booking-action" data-action="rebook">再次预约</button>
                `;
            }
            break;
        case 'canceled':
            actions = `
                <button class="btn btn-primary booking-action" data-action="rebook">重新预约</button>
            `;
            break;
    }
    
    return `<div class="booking-actions">${actions}</div>`;
}

// 显示预约详情
function showBookingDetails(booking) {
    try {
        // 跳转到预约详情页面，传递预约ID
        window.location.href = `appointment-detail.html?id=${booking.id}`;
    } catch (error) {
        console.error('跳转到预约详情页面时出错:', error);
        // 如果跳转失败，显示简单的提示信息
        console.log('预约详情:', booking);
    }
}

// 确认取消预约
function confirmCancelBooking(bookingId) {
    // 显示确认对话框
    if (confirm('确定要取消此预约吗？')) {
        // 显示加载状态
        document.querySelector(`[data-id="${bookingId}"] .booking-status`).innerHTML = '<span class="status-badge processing">处理中...</span>';
        
        // 调用取消预约API
        cancelBooking(bookingId)
            .then(response => {
                if (response) {
                    // 重新加载预约数据
                    loadBookings();
                    
                    // 显示成功消息
                    alert('预约已成功取消');
                } else {
                    // 显示错误消息
                    alert('取消预约失败，请稍后再试');
                    
                    // 恢复原状态
                    loadBookings();
                }
            })
            .catch(error => {
                console.error('取消预约失败:', error);
                alert('取消预约失败，请稍后再试');
                
                // 恢复原状态
                loadBookings();
            });
    }
}

// 显示改期模态框
function showRescheduleModal(booking) {
    // 获取模态框元素
    const modal = document.getElementById('rescheduleModal');
    if (!modal) {
        // 如果模态框不存在，创建一个
        createRescheduleModal();
        showRescheduleModal(booking);
        return;
    }
    
    // 填充模态框内容
    const serviceTitle = modal.querySelector('#rescheduleServiceTitle');
    if (serviceTitle) {
        serviceTitle.textContent = booking.service ? booking.service.title : '未知服务';
    }
    
    // 存储当前预约ID
    modal.dataset.bookingId = booking.id;
    
    // 显示模态框
    modal.style.display = 'flex';
    
    // 添加关闭按钮事件
    const closeBtn = modal.querySelector('.close-btn');
    if (closeBtn) {
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
    
    // 添加取消按钮事件
    const cancelBtn = modal.querySelector('.btn-cancel');
    if (cancelBtn) {
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        newCancelBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
    
    // 添加确认按钮事件
    const confirmBtn = modal.querySelector('.confirm-btn');
    if (confirmBtn) {
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        newConfirmBtn.addEventListener('click', async () => {
            const newDate = modal.querySelector('#newDate').value;
            const newTime = modal.querySelector('#newTime').value;
            
            if (!newDate || !newTime) {
                alert('请选择新的日期和时间');
                return;
            }
            
            try {
                // 显示加载状态
                newConfirmBtn.disabled = true;
                newConfirmBtn.textContent = '处理中...';
                
                // 调用API更新预约
                const response = await updateBooking(booking.id, {
                    date: newDate,
                    time: newTime
                });
                
                if (response) {
                    // 关闭模态框
                    modal.style.display = 'none';
                    
                    // 重新加载预约数据
                    await loadBookings();
                    
                    // 显示成功消息
                    alert('预约已成功改期');
                } else {
                    alert('改期预约失败，请稍后再试');
                }
            } catch (error) {
                console.error('改期预约失败:', error);
                alert('改期预约失败，请稍后再试');
            } finally {
                // 恢复按钮状态
                newConfirmBtn.disabled = false;
                newConfirmBtn.textContent = '确认修改';
            }
        });
    }
}

// 创建改期模态框
function createRescheduleModal() {
    const modal = document.createElement('div');
    modal.id = 'rescheduleModal';
    modal.className = 'modal';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>修改预约时间</h3>
                <button class="close-btn">&times;</button>
            </div>
            <div class="modal-body">
                <p>您正在修改 "<span id="rescheduleServiceTitle"></span>" 的预约时间</p>
                <div class="form-group">
                    <label for="newDate">新日期</label>
                    <input type="date" id="newDate" class="form-control" required>
                </div>
                <div class="form-group">
                    <label for="newTime">新时间</label>
                    <input type="time" id="newTime" class="form-control" required>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-cancel">取消</button>
                <button class="btn btn-primary confirm-btn">确认修改</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// 显示再次预约模态框
function showRebookModal(booking) {
    // 获取模态框元素
    const modal = document.getElementById('rebookModal');
    if (!modal) return;
    
    console.log('显示重新预约模态框:', booking); // 调试日志
    
    // 填充模态框内容
    const serviceTitle = modal.querySelector('#serviceTitle');
    if (serviceTitle) {
        serviceTitle.textContent = booking.service ? booking.service.title : '未知服务';
    }
    
    // 清除之前的事件监听器
    const oldConfirmBtn = modal.querySelector('.confirm-btn');
    if (oldConfirmBtn) {
        const newConfirmBtn = oldConfirmBtn.cloneNode(true);
        oldConfirmBtn.parentNode.replaceChild(newConfirmBtn, oldConfirmBtn);
    }
    
    // 存储服务和提供商ID
    const serviceId = booking.service_id || (booking.service ? booking.service.id : null);
    const providerId = booking.provider_id || (booking.provider ? booking.provider.id : null);
    
    // 显示模态框
    modal.style.display = 'flex';
    
    // 添加关闭按钮事件
    const closeBtn = modal.querySelector('.close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
    
    // 添加取消按钮事件
    const cancelBtn = modal.querySelector('.btn-cancel');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
    
    // 添加确认按钮事件
    const confirmBtn = modal.querySelector('.confirm-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            console.log('确认重新预约:', serviceId, providerId); // 调试日志
            
            // 重定向到服务详情页进行预约
            if (serviceId && providerId) {
                // 保存原始预约信息到localStorage，以便在服务详情页面使用
                try {
                    localStorage.setItem('originalBooking', JSON.stringify({
                        id: booking.id,
                        service_id: serviceId,
                        provider_id: providerId,
                        service: booking.service,
                        provider: booking.provider
                    }));
                } catch (error) {
                    console.error('保存预约信息失败:', error);
                }
                
                window.location.href = `service-detail.html?id=${serviceId}&provider=${providerId}&rebook=true`;
            } else {
                alert('无法获取服务或提供商信息，请稍后再试');
            }
        });
    }
}

// 更新日历上的预约指示器
function updateCalendarAppointments(bookings) {
    // 获取所有日历日期元素
    const calendarDays = document.querySelectorAll('.calendar-day');
    if (!calendarDays.length) return;
    
    // 清除所有预约指示器
    calendarDays.forEach(day => {
        const indicator = day.querySelector('.appointment-indicator');
        if (indicator) {
            day.removeChild(indicator);
        }
    });
    
    // 为有预约的日期添加指示器
    bookings.forEach(booking => {
        if (booking.status === 'canceled') return; // 忽略已取消的预约
        
        const [year, month, day] = booking.date.split('-');
        const dayNumber = parseInt(day, 10);
        
        // 查找对应的日历日期元素
        calendarDays.forEach(dayElement => {
            const dayNumberElement = dayElement.querySelector('.calendar-day-number');
            if (dayNumberElement && parseInt(dayNumberElement.textContent, 10) === dayNumber) {
                // 检查是否是当前月的日期（不是上个月或下个月的日期）
                if (!dayElement.classList.contains('prev-month') && !dayElement.classList.contains('next-month')) {
                    // 添加预约指示器
                    if (!dayElement.querySelector('.appointment-indicator')) {
                        const indicator = document.createElement('div');
                        indicator.className = 'appointment-indicator';
                        dayElement.appendChild(indicator);
                    }
                }
            }
        });
    });
}

// 加载用户预约并更新UI
async function loadBookings() {
    // 检查用户是否已登录
    if (!checkAuth()) return;
    
    // 获取用户预约
    const bookings = await fetchUserBookings();
    
    // 检查并更新过期预约的状态
    const now = new Date();
    const updatedBookings = bookings.map(booking => {
        const bookingDate = new Date(`${booking.date} ${booking.time}`);
        if (booking.status === 'upcoming' && bookingDate < now) {
            return { ...booking, status: 'expired' };
        }
        return booking;
    });
    
    // 更新预约统计
    updateBookingStats(updatedBookings);
    
    // 更新日历上的预约指示器
    updateCalendarAppointments(updatedBookings);
    
    // 渲染预约列表
    renderBookingList(updatedBookings);
    
    // 返回预约数据，以便其他函数使用
    return updatedBookings;
}

// 初始化预约过滤器
function initializeBookingFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    if (!filterButtons.length) return;
    
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // 移除所有按钮的活动状态
            filterButtons.forEach(btn => btn.classList.remove('active'));
            
            // 添加当前按钮的活动状态
            button.classList.add('active');
            
            // 获取过滤状态
            const filterStatus = button.dataset.status;
            
            // 重新加载预约列表
            loadBookings().then(bookings => {
                renderBookingList(bookings, null, filterStatus);
            });
        });
    });
}

// 初始化日历日期点击事件
function initializeCalendarDayClick() {
    const calendarDays = document.querySelectorAll('.calendar-day');
    if (!calendarDays.length) return;
    
    calendarDays.forEach(day => {
        day.addEventListener('click', () => {
            // 移除所有日期的选中状态
            calendarDays.forEach(d => d.classList.remove('selected'));
            
            // 添加当前日期的选中状态
            day.classList.add('selected');
            
            // 获取选中的日期
            const dayNumber = day.querySelector('.calendar-day-number').textContent;
            const month = 6; // 假设当前是6月，实际应该从日历标题或其他地方获取
            const year = 2025; // 假设当前是2025年，实际应该从日历标题或其他地方获取
            
            const selectedDate = `2025-06-${dayNumber.padStart(2, '0')}`;
            
            // 重新加载预约列表，只显示选中日期的预约
            loadBookings().then(bookings => {
                // 获取当前选中的过滤状态
                const activeFilterBtn = document.querySelector('.filter-btn.active');
                const filterStatus = activeFilterBtn ? activeFilterBtn.dataset.status : 'all';
                
                renderBookingList(bookings, selectedDate, filterStatus);
            });
        });
    });
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    // 检查用户是否已登录
    if (checkAuth()) {
        // 加载用户预约
        loadBookings();
        
        // 初始化预约过滤器
        initializeBookingFilters();
        
        // 初始化日历日期点击事件
        initializeCalendarDayClick();
    }
}); 