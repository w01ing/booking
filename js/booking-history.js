document.addEventListener('DOMContentLoaded', async function() {
    console.log('booking-history.js 加载完成');
    
    // 初始化预约状态卡片点击事件（在检查登录之前）
    initializeBookingStatCards();
    
    // 检查用户是否已登录
    if (!checkAuth()) return;
    
    // 更新用户信息
    updateUserInfo();
    
    // 加载预约数据并排序 - 只显示已完成的预约
    await loadCompletedBookings();
    
    // 过滤按钮交互
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    // 默认激活"已完成"按钮，其他按钮隐藏
    filterButtons.forEach(button => {
        const status = button.getAttribute('data-status');
        if (status === 'completed') {
            button.classList.add('active');
                } else {
            button.style.display = 'none';
                }
    });
    
    // 如果有URL状态参数，自动选择对应的过滤按钮
    const urlParams = new URLSearchParams(window.location.search);
    const statusParam = urlParams.get('status');
    
    if (statusParam) {
        const targetButton = document.querySelector(`.filter-btn[data-status="${statusParam}"]`);
        if (targetButton) {
            console.log('自动选择过滤按钮:', statusParam);
            // 移除所有按钮的激活状态
            filterButtons.forEach(btn => btn.classList.remove('active'));
            // 添加目标按钮的激活状态
            targetButton.classList.add('active');
            // 应用过滤
            applyFilter(statusParam);
        }
    }

    // 预约操作按钮交互
    initializeBookingButtons();
});

// 应用筛选条件
function applyFilter(filter) {
    const timelineItems = document.querySelectorAll('.timeline-item');
    timelineItems.forEach(item => {
        const status = item.getAttribute('data-status');
        
        if (filter === 'all' || status === filter) {
            item.style.display = 'block';
            item.style.animation = 'slideIn 0.5s ease-out';
        } else {
            item.style.display = 'none';
        }
    });
}

// 初始化预约历史页面按钮事件
function initializeHistoryPageButtons() {
    // 改期按钮事件
    document.querySelectorAll('.btn-reschedule').forEach(button => {
        button.addEventListener('click', async function() {
            const bookingId = this.closest('.timeline-item').getAttribute('data-booking-id');
            console.log('改期按钮被点击，预约ID:', bookingId);
             try {
                // 获取预约详情
                const bookingData = await fetchSingleBooking(bookingId);
                if (!bookingData) {
                    showToast('获取预约信息失败', 'error');
                    return;
                }
                
                // 打开改期模态框
                openRescheduleModal(bookingData);
            } catch (error) {
                console.error('获取预约详情出错:', error);
                showToast('获取预约详情失败', 'error');
            }
        });
    });


    // 取消预约按钮事件
    document.querySelectorAll('.btn-cancel').forEach(button => {
        button.addEventListener('click', async function() {
            const bookingId = this.closest('.timeline-item').getAttribute('data-booking-id');
            const bookingDate = this.closest('.timeline-item').querySelector('.booking-date').textContent;
            const bookingTime = this.closest('.timeline-item').querySelector('.booking-time').textContent;
            
            if (confirm(`确定要取消${bookingDate} ${bookingTime}的预约吗？`)) {
                try {
                    // 调用取消预约API
                    const response = await cancelBooking(bookingId);
                    
                    if (response.success) {
                        // 显示成功消息
                        showToast('预约已取消', 'success');
                        
                        // 更新UI：从DOM中移除该预约项或更新状态
                        const bookingItem = this.closest('.timeline-item');
                        
                        // 添加淡出动画
                        bookingItem.style.opacity = '0';
                        bookingItem.style.transform = 'translateX(20px)';
                        bookingItem.style.transition = 'opacity 0.3s, transform 0.3s';
                        
                        // 从DOM中移除
                        setTimeout(async () => {
                            // 重新加载预约数据
                            await loadAndSortBookings();
                            
                            // 应用当前筛选条件
                            const activeFilter = document.querySelector('.filter-btn.active').getAttribute('data-status');
                            applyFilter(activeFilter);
                        }, 300);
                    } else {
                        showToast(response.message || '取消预约失败', 'error');
                    }
                } catch (error) {
                    console.error('取消预约出错:', error);
                    showToast('取消预约失败，请稍后再试', 'error');
                }
            }
        });
    });

    // 改期模态框 - 保存按钮
    const saveRescheduleBtn = document.getElementById('save-reschedule');
    if (saveRescheduleBtn) {
        saveRescheduleBtn.addEventListener('click', async function() {
            const bookingId = document.getElementById('reschedule-booking-id').value;
            const newDate = document.getElementById('reschedule-date').value;
            const newTime = document.getElementById('reschedule-time').value;
            
            if (!newDate || !newTime) {
                showToast('请选择日期和时间', 'error');
                return;
            }
            
            try {
                // 调用改期API
                const response = await rescheduleBooking(bookingId, newDate, newTime);
                
                if (response.success) {
                    // 显示成功消息
                    showToast('预约时间已更新', 'success');
                    
                    // 关闭模态框
                    const rescheduleModal = document.getElementById('reschedule-modal');
                    if (rescheduleModal) {
                        rescheduleModal.style.display = 'none';
                    }
                    
                    // 更新UI：更新DOM中的日期和时间
                    const bookingItem = document.querySelector(`.timeline-item[data-booking-id="${bookingId}"]`);
                    if (bookingItem) {
                        // 更新日期和时间显示
                        const formattedDate = formatDateForDisplay(newDate);
                        const bookingDateElem = bookingItem.querySelector('.booking-date');
                        if (bookingDateElem) bookingDateElem.textContent = formattedDate;
                        
                        const bookingTimeElem = bookingItem.querySelector('.booking-time');
                        if (bookingTimeElem) bookingTimeElem.textContent = newTime;
                        
                        // 添加更新动画
                        bookingItem.style.backgroundColor = '#e8f5e9';
                        setTimeout(() => {
                            bookingItem.style.backgroundColor = '';
                        }, 1000);
                    } else {
                        // 如果找不到DOM元素，重新加载整个列表
                        await loadAndSortBookings();
                    }
                } else {
                    showToast(response.message || '改期失败', 'error');
                }
            } catch (error) {
                console.error('改期出错:', error);
                showToast('改期失败，请稍后再试', 'error');
            }
        });
    }
    
    // 改期模态框 - 取消按钮
    const cancelRescheduleBtn = document.getElementById('cancel-reschedule');
    if (cancelRescheduleBtn) {
        cancelRescheduleBtn.addEventListener('click', function() {
            const rescheduleModal = document.getElementById('reschedule-modal');
            if (rescheduleModal) {
                rescheduleModal.style.display = 'none';
            }
        });
    }
}

// 应用筛选条件
function applyFilter(filter) {
    const timelineItems = document.querySelectorAll('.timeline-item');
    timelineItems.forEach(item => {
        const status = item.getAttribute('data-status');
        
        if (filter === 'all' || status === filter) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

// 调试函数
function debug(message, data) {
    console.log(`[DEBUG] ${message}`, data);
}

// 加载已完成的预约数据
async function loadCompletedBookings() {
    try {
        debug('开始加载已完成的预约数据', '');
        // 检查用户是否已登录
        if (!checkAuth()) return;
        
        // 获取已完成的用户预约
        const bookings = await fetchCompletedBookings();
        debug('获取到的已完成预约数据', bookings);
        
        if (bookings && bookings.length > 0) {
            // 更新左侧导航栏的预约统计
            updateBookingStats(bookings);
            
            // 按日期分组
            const groupedBookings = groupBookingsByDate(bookings);
            debug('分组后的预约数据', groupedBookings);
            
            // 渲染预约列表
            renderBookingTimeline(groupedBookings);
            
            // 重新初始化按钮事件
            setTimeout(() => {
                console.log('重新初始化预约按钮');
                initializeHistoryPageButtons();
            }, 500);
        } else {
            debug('没有已完成的预约数据，显示空状态', '');
            showEmptyState();
        }
    } catch (error) {
        console.error('加载预约数据失败:', error);
        showError('加载预约数据失败，请稍后再试');
    }
}

// 辅助函数：获取单个预约详情
async function fetchSingleBooking(bookingId) {
    try {
        const response = await fetch(`/api/bookings/${bookingId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('获取预约详情失败');
        }
        
        const data = await response.json();
        return data.data;
    } catch (error) {
        console.error('获取单个预约失败:', error);
        showToast('获取预约信息失败', 'error');
        return null;
    }
}

// 辅助函数：取消预约
async function cancelBooking(bookingId) {
    try {
        const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('取消预约失败');
        }
        
        return await response.json();
    } catch (error) {
        console.error('取消预约失败:', error);
        throw error;
    }
}

// 辅助函数：改期预约
async function rescheduleBooking(bookingId, newDate, newTime) {
    try {
        const response = await fetch(`/api/bookings/${bookingId}/reschedule`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                date: newDate,
                time: newTime
            })
        });
        
        if (!response.ok) {
            throw new Error('改期预约失败');
        }
        
        return await response.json();
    } catch (error) {
        console.error('改期预约失败:', error);
        throw error;
    }
}

// 辅助函数：格式化日期为输入框格式
function formatDateForInput(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
}

// 辅助函数：格式化日期为显示格式
function formatDateForDisplay(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}


// 更新预约统计信息
function updateBookingStats(bookings) {
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
    
    // 更新顶部导航栏中的通知数字
    const notificationBadge = document.querySelector('.notification-btn .badge');
    if (notificationBadge) {
        notificationBadge.textContent = stats.upcoming + stats.waiting;
    }
    
    // 更新左侧卡片中的数字
    const waitingCard = document.querySelector('.stat-card:nth-child(1) .stat-value');
    if (waitingCard) waitingCard.textContent = stats.waiting;
    
    const upcomingCard = document.querySelector('.stat-card:nth-child(2) .stat-value');
    if (upcomingCard) upcomingCard.textContent = stats.upcoming;
    
    const completedCard = document.querySelector('.stat-card:nth-child(3) .stat-value');
    if (completedCard) completedCard.textContent = stats.completed;
    
    const canceledCard = document.querySelector('.stat-card:nth-child(4) .stat-value');
    if (canceledCard) canceledCard.textContent = stats.canceled;
    
    // 更新我的收藏页面上的预约历史徽章 - 移除徽章显示
    const favoritesHistoryBadge = document.querySelector('.nav-item[href="booking-history.html"] .item-badge');
    if (favoritesHistoryBadge) {
        favoritesHistoryBadge.textContent = '';
        favoritesHistoryBadge.style.display = 'none';
    }
}

// 从API获取预约数据
async function fetchBookings() {
    debug('开始获取预约数据', '');
    try {
        // 使用通用的apiRequest函数获取预约数据
        const response = await apiRequest('/api/bookings');
        if (response && Array.isArray(response)) {
            debug('成功从API获取预约数据', response);
            return response;
        } else {
            throw new Error('API返回的数据不是数组');
        }
    } catch (error) {
        console.error('获取预约数据失败:', error);
        
        // 显示错误信息
        showError('获取预约数据失败，请稍后再试');
        
        // 返回空数组，避免页面崩溃
        return [];
    }
}

// 从API获取已完成的预约数据
async function fetchCompletedBookings() {
    debug('开始获取已完成的预约数据', '');
    try {
        // 使用通用的apiRequest函数获取已完成的预约数据
        const response = await apiRequest('/api/bookings?completed_only=true');
        if (response && Array.isArray(response)) {
            debug('成功从API获取已完成预约数据', response);
            return response;
        } else {
            throw new Error('API返回的数据不是数组');
        }
    } catch (error) {
        console.error('获取已完成预约数据失败:', error);
        
        // 显示错误信息
        showError('获取已完成预约数据失败，请稍后再试');
        
        // 返回空数组，避免页面崩溃
        return [];
    }
}

// 按日期分组预约
function groupBookingsByDate(bookings) {
    const groups = {};
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // 获取昨天的日期
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    // 获取本周的开始日期
    const startOfWeek = new Date(now);
    startOfWeek.setDate(startOfWeek.getDate() - now.getDay());
    const startOfWeekStr = startOfWeek.toISOString().split('T')[0];
    
    // 获取本月的开始日期
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthStr = startOfMonth.toISOString().split('T')[0];
    
    bookings.forEach(booking => {
        let groupName;
        
        if (booking.date === today) {
            groupName = '今天';
        } else if (booking.date === yesterdayStr) {
            groupName = '昨天';
        } else if (new Date(booking.date) >= startOfWeek && new Date(booking.date) < now) {
            groupName = '本周';
        } else if (new Date(booking.date) >= startOfMonth && new Date(booking.date) < startOfWeek) {
            groupName = '本月';
        } else if (new Date(booking.date) > now) {
            groupName = '即将到来';
        } else {
            groupName = '更早';
        }
        
        if (!groups[groupName]) {
            groups[groupName] = [];
        }
        
        groups[groupName].push(booking);
    });
    
    return groups;
}

// 渲染预约时间线
function renderBookingTimeline(groupedBookings) {
    const timelineContainer = document.querySelector('.timeline-container');
    debug('渲染预约时间线', { container: timelineContainer, groupedBookings });
    
    if (!timelineContainer) {
        console.error('找不到时间线容器元素 .timeline-container');
        return;
    }
    
    // 清空容器
    timelineContainer.innerHTML = '';
    
    // 获取日期分组并按时间排序
    const sortedDates = Object.keys(groupedBookings);
    debug('分组日期', sortedDates);
    
    // 如果没有预约，显示空状态
    if (sortedDates.length === 0) {
        debug('没有预约数据，显示空状态', '');
        showEmptyState();
        return;
    }
    
    // 渲染每个日期组
    sortedDates.forEach(date => {
        const bookings = groupedBookings[date];
        debug(`渲染日期组 ${date}`, bookings);
        
        // 创建日期组元素
        const dateGroup = document.createElement('div');
        dateGroup.className = 'timeline-date-group';
        
        // 格式化日期
        const formattedDate = formatDate(date);
        debug(`格式化日期 ${date} -> ${formattedDate}`, '');
        
        // 添加日期标题
        dateGroup.innerHTML = `<div class="timeline-date">${formattedDate}</div>`;
        
        // 添加该日期的预约项
        bookings.forEach(booking => {
            const timelineItem = document.createElement('div');
            timelineItem.className = 'timeline-item';
            timelineItem.dataset.id = booking.id;
            timelineItem.dataset.status = booking.status;
            
            // 创建预约卡片
            const bookingElement = createBookingElement(booking);
            
            // 添加到时间线项
            timelineItem.appendChild(bookingElement);
            
            // 添加到日期组
            dateGroup.appendChild(timelineItem);
        });
        
        // 添加日期组到时间线容器
        timelineContainer.appendChild(dateGroup);
    });
    
    // 确保DOM已完全渲染后再初始化按钮
    setTimeout(() => {
        console.log('初始化预约操作按钮');
        initializeHistoryPageButtons();
        // 重新初始化预约状态卡片点击事件
        initializeBookingStatCards();
    }, 100);
}

// 创建预约卡片元素
function createBookingElement(booking) {
    // 创建预约卡片元素
    const bookingCard = document.createElement('div');
    bookingCard.className = 'booking-card';
    bookingCard.setAttribute('data-id', booking.id);
    bookingCard.setAttribute('data-status', booking.status);
    bookingCard.setAttribute('data-booking-id', booking.id);
    
    // 获取服务信息
    const service = booking.service || {};
    
    // 获取服务商信息
    const provider = booking.provider || {};
    
    // 格式化日期和时间
    let formattedDate = '未知日期';
    let formattedTime = '';
    
    if (booking.date) {
        formattedDate = formatDate(booking.date);
    }
    
    if (booking.time) {
        formattedTime = booking.time;
    }
    
    // 创建预约卡片内容
    bookingCard.innerHTML = `
        <div class="timeline-icon ${booking.status}">
            <i class="fas fa-${getBookingIcon(booking.status)}"></i>
        </div>
        <div class="timeline-content">
            <div class="booking-header">
                <div class="service-image">
                    <img src="${service.image || 'img/service-placeholder.jpg'}" alt="${service.title || '服务'}">
                </div>
                <div class="booking-details">
                    <h3 class="service-title">${service.title || '未知服务'}</h3>
                    <div class="provider-name">
                        <span>${provider.business_name || provider.username || '未知服务商'}</span>
                        ${provider.verified ? '<i class="fas fa-check-circle verified-icon"></i>' : ''}
                    </div>
                    <div class="booking-time">
                        <i class="fas fa-calendar"></i> <span class="booking-date">${formattedDate}</span> <span class="booking-time">${formattedTime}</span>
                    </div>
                </div>
            </div>
            <div class="booking-actions">
                <!-- 删除按钮 -->
                <button class="btn btn-danger delete-booking-btn" data-id="${booking.id}">
                    <i class="fas fa-trash-alt"></i> 删除记录
                </button>
            </div>
        </div>
    `;
    
    // 确保删除按钮点击事件生效
    const deleteButton = bookingCard.querySelector('.delete-booking-btn');
    if (deleteButton) {
        deleteButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            
            const bookingId = deleteButton.getAttribute('data-id');
            const serviceTitle = service.title || '未知服务';
            const bookingDateTime = `${formattedDate} ${formattedTime}`;
            
            // 显示确认删除模态框
            showDeleteConfirmModal(serviceTitle, bookingDateTime, bookingId);
        });
    }
    
    return bookingCard;
}

// 根据预约状态获取图标
function getBookingIcon(status) {
    switch (status) {
        case 'waiting':
            return 'clock';
        case 'upcoming':
            return 'calendar-check';
        case 'completed':
            return 'check-circle';
        case 'canceled':
            return 'times-circle';
        default:
            return 'question-circle';
    }
}

// 渲染预约操作按钮
function renderBookingActions(booking) {
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'booking-actions';
    
    // 由于只显示已完成的预约，所以只需要添加删除按钮
    if (booking.status === 'completed') {
        const deleteButton = document.createElement('button');
        deleteButton.className = 'btn btn-danger delete-booking-btn';
        deleteButton.setAttribute('data-id', booking.id);
        deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i> 删除记录';
        actionsDiv.appendChild(deleteButton);
    }
    
    return actionsDiv;
}

// 初始化预约按钮事件
function initializeBookingButtons() {
    debug('初始化预约按钮事件');
    
    // 清除现有事件监听器
    document.removeEventListener('click', handleDeleteButtonClick);
    
    // 为所有删除按钮添加事件监听器
    document.addEventListener('click', handleDeleteButtonClick);
    
    debug('预约按钮事件初始化完成');
}

// 删除按钮点击处理函数
function handleDeleteButtonClick(event) {
    // 检查点击的是否为删除按钮或其内部元素
            const button = event.target.closest('.delete-booking-btn');
    if (!button) return;
    
    // 获取预约ID
            const bookingId = button.getAttribute('data-id');
    if (!bookingId) {
        console.error('删除按钮没有指定预约ID');
        return;
    }
    
    console.log('点击删除按钮:', bookingId);
            
            // 查找预约卡片以获取更多信息
            const bookingCard = document.querySelector(`.booking-card[data-id="${bookingId}"]`);
            if (bookingCard) {
        const serviceTitle = bookingCard.querySelector('.service-title')?.textContent || '未知服务';
        const bookingTime = bookingCard.querySelector('.booking-time')?.textContent || '';
                
                // 显示确认删除模态框
                showDeleteConfirmModal(serviceTitle, bookingTime, bookingId);
    } else {
        console.error('未找到对应的预约卡片:', bookingId);
        showToast('操作失败：找不到预约信息', 'error');
            }
    }
    
// 显示确认删除模态框
function showDeleteConfirmModal(serviceName, bookingTime, bookingId) {
    console.log('显示确认删除模态框:', serviceName, bookingTime, bookingId);
    
    // 如果已有模态框，先移除
    const existingModal = document.getElementById('deleteModal');
    if (existingModal) {
        document.body.removeChild(existingModal);
    }
    
    // 创建模态框
    const modalHtml = `
    <div id="deleteModal" class="modal">
            <div class="modal-content">
            <div class="modal-header">
            <h3>确认删除</h3>
                <span class="close">&times;</span>
            </div>
            <div class="modal-body">
                <p>确定要删除此预约记录吗？</p>
            <div class="booking-info">
                <p><strong>服务：</strong>${serviceName}</p>
                <p><strong>时间：</strong>${bookingTime}</p>
                </div>
                <p class="warning" style="color: #dc3545; margin-top: 10px;">
                    <i class="fas fa-exclamation-triangle"></i> 此操作无法恢复
                </p>
            </div>
            <div class="modal-footer">
                <button id="cancelDelete" class="btn btn-secondary">取消</button>
                <button id="confirmDelete" class="btn btn-danger">删除</button>
                    </div>
                </div>
    </div>`;
        
    // 添加模态框到页面
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modal = document.getElementById('deleteModal');
    const closeButton = modal.querySelector('.close');
    const cancelButton = document.getElementById('cancelDelete');
    const confirmButton = document.getElementById('confirmDelete');
    
    // 显示模态框
    modal.style.display = 'flex';
    modal.classList.add('active');
    
    // 确保弹窗在视口居中
    setTimeout(() => {
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.style.opacity = '1';
            modalContent.style.transform = 'translateY(0)';
        }
    }, 5);
    
    // 关闭模态框的事件
    const closeModal = () => {
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.style.opacity = '0';
            modalContent.style.transform = 'translateY(20px)';
        }
        
        setTimeout(() => {
        modal.style.display = 'none';
            modal.classList.remove('active');
            
            // 延迟移除DOM元素，避免可能的引用错误
            setTimeout(() => {
                if (modal && modal.parentNode) {
        document.body.removeChild(modal);
                }
            }, 50);
        }, 150);
    };
    
    // 添加事件监听器
    closeButton.addEventListener('click', closeModal);
    cancelButton.addEventListener('click', closeModal);
    confirmButton.addEventListener('click', async () => {
        console.log('点击删除按钮:', bookingId);
        
        // 禁用按钮防止重复点击
        confirmButton.disabled = true;
        confirmButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 删除';
        cancelButton.disabled = true;
        
        try {
        // 调用删除API
            await deleteBookingPermanently(bookingId);
        closeModal();
        } catch (error) {
            console.error('删除操作失败:', error);
            
            // 恢复按钮状态
            confirmButton.disabled = false;
            confirmButton.innerHTML = '删除';
            cancelButton.disabled = false;
            
            // 显示错误消息
            showToast(error.message || '删除失败，请稍后再试', 'error');
        }
    });
    
    // 点击模态框外部关闭
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });
    
    // 按ESC键关闭模态框
    const handleEscKey = (event) => {
        if (event.key === 'Escape') {
            closeModal();
            window.removeEventListener('keydown', handleEscKey);
        }
    };
    window.addEventListener('keydown', handleEscKey);
}

// 通用API请求辅助函数
async function apiRequest(url, method = 'GET', body = null) {
    try {
        // 获取认证令牌
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('未找到认证令牌');
            throw new Error('未找到认证令牌');
        }
        
        // 构建请求配置
        const config = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };
        
        // 如果有请求体，添加到配置中
        if (body) {
            config.body = JSON.stringify(body);
        }
        
        // 发起请求
        console.log(`发起API请求: ${method} ${url}`);
        const response = await fetch(url, config);
        
        // 检查响应状态
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error(`API请求失败: ${response.status}`, errorData);
            throw new Error(errorData.message || `API请求失败: ${response.status}`);
        }
        
        // 解析并返回响应数据
        const data = await response.json();
        console.log(`API请求成功: ${url}`, data);
        return data;
    } catch (error) {
        console.error(`API请求错误 (${url}):`, error);
        throw error;
    }
}

// 永久删除预约历史记录
async function deleteBookingPermanently(bookingId) {
    try {
        // 显示加载中提示
        showToast('正在删除记录...', 'info');
        
        // 获取令牌
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('未找到认证令牌');
            showToast('认证已过期，请重新登录', 'error');
            return;
        }
        
        console.log(`开始删除预约记录: ID=${bookingId}`);
        
        // 直接使用fetch调用API，避免潜在的apiRequest函数问题
        const response = await fetch(`/api/bookings/${bookingId}/permanent`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        // 解析响应JSON
        const data = await response.json();
        
        // 检查响应状态
        if (!response.ok) {
            throw new Error(data.message || `删除失败: 服务器返回 ${response.status}`);
        }
        
        console.log('删除预约成功:', data);
        
            // 显示成功提示
        showToast(data.message || '记录已成功删除', 'success');
            
            // 从DOM中删除预约卡片
            const bookingCard = document.querySelector(`.booking-card[data-id="${bookingId}"]`);
            if (bookingCard) {
                const timelineItem = bookingCard.closest('.timeline-item');
                if (timelineItem) {
                    const timelineGroup = timelineItem.parentElement;
                
                // 添加淡出动画
                timelineItem.style.opacity = '0';
                timelineItem.style.transform = 'translateX(20px)';
                timelineItem.style.transition = 'opacity 0.3s, transform 0.3s';
                
                // 延迟删除DOM元素，等待动画完成
                setTimeout(() => {
                    timelineItem.remove();
                    
                    // 如果组内没有其他预约，删除整个组
                    if (timelineGroup && timelineGroup.querySelectorAll('.timeline-item').length === 0) {
                        timelineGroup.remove();
                }
                
                // 如果没有任何预约，显示空状态
                if (document.querySelectorAll('.timeline-item').length === 0) {
                    showEmptyState();
                }
                }, 300);
            }
            } else {
            console.warn(`未找到预约卡片元素: ID=${bookingId}`);
            // 刷新整个列表
            await loadCompletedBookings();
        }
    } catch (error) {
        console.error('删除预约记录失败:', error);
        showToast(error.message || '删除记录失败，请稍后再试', 'error');
    }
}

// 显示提示消息
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'warning') icon = 'exclamation-triangle';
    if (type === 'error') icon = 'times-circle';
    
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas fa-${icon}"></i>
            <span>${message}</span>
        </div>
    `;

    document.body.appendChild(toast);

    // 添加样式
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    toast.style.zIndex = '1000';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '8px';
    
    if (type === 'success') {
        toast.style.backgroundColor = '#d4edda';
        toast.style.color = '#155724';
    } else if (type === 'warning') {
        toast.style.backgroundColor = '#fff3cd';
        toast.style.color = '#856404';
    } else if (type === 'error') {
        toast.style.backgroundColor = '#f8d7da';
        toast.style.color = '#721c24';
    } else {
        toast.style.backgroundColor = '#e1e5f9';
        toast.style.color = '#4a6cf7';
    }
    
    toast.style.opacity = '0';
    toast.style.transition = 'all 0.3s ease';

    // 添加动画类
    setTimeout(() => {
        toast.style.opacity = '1';
    }, 10);

    // 3秒后自动消失
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// 格式化日期辅助函数
function formatDate(date) {
    // 如果传入的是字符串，先转换为Date对象
    if (typeof date === 'string') {
        // 检查是否是特殊的分组名称
        if (['今天', '昨天', '本周', '本月', '即将到来', '更早'].includes(date)) {
            return date;
        }
        // 尝试转换为日期对象
        try {
            date = new Date(date);
        } catch (error) {
            console.error('日期格式化错误:', error);
            return date; // 返回原始字符串
        }
    }
    
    // 格式化日期
    try {
        const options = { month: 'long', day: 'numeric' };
        return date.toLocaleDateString('zh-CN', options);
    } catch (error) {
        console.error('日期格式化错误:', error);
        return String(date); // 转换为字符串返回
    }
}

// 添加CSS样式
const style = document.createElement('style');
style.textContent = `
    .time-slots {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 8px;
    }
    
    .time-slot-btn {
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: #f9f9f9;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .time-slot-btn:hover {
        border-color: #4a6cf7;
        background: #f0f3ff;
    }
    
    .time-slot-btn.active {
        background: #4a6cf7;
        color: white;
        border-color: #4a6cf7;
    }
    
    .form-group {
        margin-bottom: 16px;
    }
    
    .form-group label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
    }
    
    .form-group input,
    .form-group select,
    .form-group textarea {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
    }
    
    .cancel-details,
    .reschedule-details,
    .rebook-details {
        background: #f9f9f9;
        border-left: 3px solid #4a6cf7;
        padding: 12px;
        margin: 16px 0;
        border-radius: 4px;
    }
    
    .rating-text {
        margin-left: 10px;
        font-size: 14px;
        color: #666;
    }
    
    .reviewed-label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        background: #f0f0f0;
        border-radius: 20px;
        color: #28a745;
        font-size: 14px;
    }
`;
document.head.appendChild(style);

// 显示空状态
function showEmptyState() {
    const timelineContainer = document.querySelector('.timeline-container');
    if (!timelineContainer) return;
    
    timelineContainer.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-calendar-times"></i>
            <h3>暂无预约</h3>
            <p>您当前没有任何预约记录</p>
            <a href="search-results.html" class="btn-primary">浏览服务</a>
        </div>
    `;
    
    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
        .empty-state {
            text-align: center;
            padding: 50px 20px;
            margin: 20px auto;
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .empty-state i {
            font-size: 48px;
            color: #ccc;
            margin-bottom: 20px;
        }
        .empty-state h3 {
            color: #333;
            margin-bottom: 10px;
        }
        .empty-state p {
            color: #666;
            margin-bottom: 30px;
        }
        .btn-primary {
            background: #2c7be5;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            font-size: 16px;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
        }
    `;
    document.head.appendChild(style);
}

// 显示错误信息
function showError(message) {
    const timelineContainer = document.querySelector('.timeline-container');
    if (!timelineContainer) return;
    
    timelineContainer.innerHTML = `
        <div class="error-state">
            <i class="fas fa-exclamation-circle"></i>
            <h3>加载失败</h3>
            <p>${message}</p>
            <button class="btn-primary" onclick="loadCompletedBookings()">重试</button>
        </div>
    `;
    
    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
        .error-state {
            text-align: center;
            padding: 50px 20px;
            margin: 20px auto;
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .error-state i {
            font-size: 48px;
            color: #ff4d4f;
            margin-bottom: 20px;
        }
        .error-state h3 {
            color: #333;
            margin-bottom: 10px;
        }
        .error-state p {
            color: #666;
            margin-bottom: 30px;
        }
        .btn-primary {
            background: #2c7be5;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            font-size: 16px;
            cursor: pointer;
        }
    `;
    document.head.appendChild(style);
}

// 初始化预约操作按钮（改期、取消等）
function initBookingActions() {
    // 取消预约按钮事件
    document.querySelectorAll('.btn-cancel-booking').forEach(button => {
        button.addEventListener('click', function() {
            const bookingId = this.closest('.booking-item').dataset.bookingId;
            const serviceName = this.closest('.booking-item').querySelector('.service-name').textContent;
            const bookingDate = this.closest('.booking-item').querySelector('.booking-date').textContent;
            
            showCancelModal(bookingId, serviceName, bookingDate);
        });
    });

    // 改期按钮事件
    document.querySelectorAll('.btn-reschedule').forEach(button => {
        button.addEventListener('click', function() {
            const bookingId = this.closest('.booking-item').dataset.bookingId;
            const serviceName = this.closest('.booking-item').querySelector('.service-name').textContent;
            const currentDate = this.closest('.booking-item').querySelector('.booking-date').textContent;
            
            showRescheduleModal(bookingId, serviceName, currentDate);
        });
    });
}

// 显示取消预约模态框
function showCancelModal(bookingId, serviceName, bookingDate) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>取消预约</h3>
                <span class="close-modal">&times;</span>
            </div>
            <div class="modal-body">
                <p>您确定要取消 "${serviceName}" 的预约吗？</p>
                <p class="text-muted">预约时间：${bookingDate}</p>
                <div class="form-group">
                    <label for="cancel-reason">取消原因</label>
                    <select id="cancel-reason" class="form-control">
                        <option value="schedule_conflict">时间冲突</option>
                        <option value="service_change">服务变更</option>
                        <option value="no_longer_needed">不再需要</option>
                        <option value="other">其他原因</option>
                    </select>
                </div>
                <div id="other-reason-container" style="display:none;">
                    <div class="form-group">
                        <label for="other-reason">请说明原因</label>
                        <textarea id="other-reason" class="form-control" rows="3"></textarea>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary close-modal">取消</button>
                <button class="btn btn-danger confirm-cancel" data-booking-id="${bookingId}">确认取消</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);

    // 监听原因选择
    const reasonSelect = modal.querySelector('#cancel-reason');
    const otherReasonContainer = modal.querySelector('#other-reason-container');
    
    reasonSelect.addEventListener('change', function() {
        otherReasonContainer.style.display = this.value === 'other' ? 'block' : 'none';
    });

    // 关闭模态框
    modal.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        });
    });

    // 确认取消
    modal.querySelector('.confirm-cancel').addEventListener('click', async function() {
        const bookingId = this.dataset.bookingId;
        const reason = reasonSelect.value;
        const otherReason = reasonSelect.value === 'other' 
            ? modal.querySelector('#other-reason').value 
            : '';

        try {
            // 显示加载状态
            this.disabled = true;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 处理中...';

            // 调用取消预约API
            const result = await cancelBooking(bookingId, {
                reason: reason,
                otherReason: otherReason
            });

            if (result.success) {
                showToast('预约已成功取消', 'success');
                // 移除对应的预约项
                document.querySelector(`.booking-item[data-booking-id="${bookingId}"]`).remove();
            } else {
                showToast(result.message || '取消预约失败', 'error');
            }
        } catch (error) {
            console.error('取消预约出错:', error);
            showToast('取消预约出错，请重试', 'error');
        } finally {
            // 关闭模态框
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        }
    });
}

// 显示改期模态框
function showRescheduleModal(bookingId, serviceName, currentDate) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>改期预约</h3>
                <span class="close-modal">&times;</span>
            </div>
            <div class="modal-body">
                <p>修改 "${serviceName}" 的预约时间</p>
                <p class="text-muted">当前预约时间：${currentDate}</p>
                
                <div class="form-group">
                    <label for="new-date">新预约日期</label>
                    <input type="date" id="new-date" class="form-control" min="${new Date().toISOString().split('T')[0]}">
                </div>
                
                <div class="form-group">
                    <label for="new-time">新预约时间</label>
                    <select id="new-time" class="form-control">
                        <option value="">请选择时间</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="reschedule-reason">改期原因</label>
                    <select id="reschedule-reason" class="form-control">
                        <option value="schedule_conflict">时间冲突</option>
                        <option value="need_earlier">需要更早时间</option>
                        <option value="need_later">需要更晚时间</option>
                        <option value="other">其他原因</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary close-modal">取消</button>
                <button class="btn btn-primary confirm-reschedule" data-booking-id="${bookingId}">确认改期</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);

    // 日期变更时加载可用时间
    const dateInput = modal.querySelector('#new-date');
    const timeSelect = modal.querySelector('#new-time');
    
    dateInput.addEventListener('change', function() {
        if (this.value) {
            // 模拟加载可用时间
            loadAvailableTimes(this.value, timeSelect);
        } else {
            timeSelect.innerHTML = '<option value="">请选择时间</option>';
        }
    });

    // 关闭模态框
    modal.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        });
    });

    // 确认改期
    modal.querySelector('.confirm-reschedule').addEventListener('click', async function() {
        const bookingId = this.dataset.bookingId;
        const newDate = modal.querySelector('#new-date').value;
        const newTime = modal.querySelector('#new-time').value;
        const reason = modal.querySelector('#reschedule-reason').value;

        if (!newDate || !newTime) {
            showToast('请选择新的日期和时间', 'warning');
            return;
        }

        try {
            // 显示加载状态
            this.disabled = true;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 处理中...';

            // 调用改期API
            const result = await rescheduleBooking(bookingId, {
                newDate: newDate,
                newTime: newTime,
                reason: reason
            });

            if (result.success) {
                showToast('预约时间已更新', 'success');
                // 更新UI中的预约时间
                const bookingItem = document.querySelector(`.booking-item[data-booking-id="${bookingId}"]`);
                if (bookingItem) {
                    bookingItem.querySelector('.booking-date').textContent = `${newDate} ${newTime}`;
                }
            } else {
                showToast(result.message || '改期失败', 'error');
            }
        } catch (error) {
            console.error('改期出错:', error);
            showToast('改期出错，请重试', 'error');
        } finally {
            // 关闭模态框
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        }
    });
}

// 模拟加载可用时间
function loadAvailableTimes(date, timeSelect) {
    // 清空现有选项
    timeSelect.innerHTML = '<option value="">加载中...</option>';
    
    // 模拟API请求延迟
    setTimeout(() => {
        // 实际项目中应从API获取可用时间
        const availableTimes = [
            '09:00', '10:00', '11:00', 
            '14:00', '15:00', '16:00', '17:00'
        ];
        
        timeSelect.innerHTML = '<option value="">请选择时间</option>';
        availableTimes.forEach(time => {
            const option = document.createElement('option');
            option.value = time;
            option.textContent = time;
            timeSelect.appendChild(option);
        });
    }, 500);
}

// 调用API取消预约
async function cancelBooking(bookingId, reason) {
    try {
        // 实际项目中应替换为真实API调用
        console.log('取消预约:', bookingId, reason);
        
        // 模拟API响应
        return new Promise(resolve => {
            setTimeout(() => {
                resolve({ success: true });
            }, 800);
        });
    } catch (error) {
        console.error('取消预约API错误:', error);
        throw error;
    }
}

// 调用API改期预约
async function rescheduleBooking(bookingId, updateData) {
    try {
        // 实际项目中应替换为真实API调用
        console.log('改期预约:', bookingId, updateData);
        
        // 模拟API响应
        return new Promise(resolve => {
            setTimeout(() => {
                resolve({ success: true });
            }, 800);
        });
    } catch (error) {
        console.error('改期预约API错误:', error);
        throw error;
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initBookingActions();
});

// 初始化左侧预约状态卡片点击事件
function initializeBookingStatCards() {
    console.log('开始初始化预约状态卡片点击事件');
    const statCards = document.querySelectorAll('.booking-stats .stat-card');
    console.log('找到预约状态卡片数量:', statCards.length);
    
    if (!statCards || statCards.length === 0) {
        console.log('未找到预约状态卡片，退出初始化');
        return;
    }
    
    statCards.forEach((card, index) => {
        if (!card) return; // Skip null elements
        
        const status = card.dataset?.status;
        console.log(`初始化第${index + 1}个卡片，状态:`, status);
        
        if (card && typeof card.addEventListener === 'function') {
            card.addEventListener('click', () => {
                console.log('点击预约状态卡片:', status);
                
                // 跳转到预约历史页面，并传递状态参数
                const url = `booking-history.html?status=${status}`;
                console.log('跳转到:', url);
                window.location.href = url;
            });
            
            // 添加鼠标悬停效果
            card.style.cursor = 'pointer';
            console.log(`第${index + 1}个卡片初始化完成`);
        } else {
            console.error(`第${index + 1}个卡片不是有效的DOM元素或没有addEventListener方法`);
        }
    });
    
    console.log('预约状态卡片点击事件初始化完成');
}
