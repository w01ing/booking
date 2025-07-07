/**
 * 服务商控制台功能
 */
class ProviderDashboard {
    constructor() {
        // 当前状态
        this.currentView = 'list';
        this.currentFilter = 'all';
        this.selectedDate = new Date();
        this.calendarNavBound = false; // 防止日历按钮重复绑定
        
        // DOM元素
        this.viewButtons = document.querySelectorAll('.view-btn');
        this.filterButtons = document.querySelectorAll('.filter-btn');
        this.bookingList = document.getElementById('bookingList');
        this.calendarSection = document.querySelector('.booking-calendar-section');
        this.listSection = document.querySelector('.booking-list-section');
        this.appointmentModal = document.getElementById('appointmentModal');
        this.rejectModal = document.getElementById('rejectModal');
        this.rescheduleModal = document.getElementById('rescheduleModal');
        
        // 初始化
        this.initializeEventListeners();
        this.loadBookings();
    }
    
    /**
     * 初始化事件监听
     */
    initializeEventListeners() {
        // 视图切换按钮
        this.viewButtons.forEach(button => {
            button.addEventListener('click', () => {
                const view = button.dataset.view;
                this.switchView(view);
            });
        });
        
        // 筛选按钮
        this.filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                const status = button.dataset.status;
                this.filterBookings(status);
            });
        });
        
        // 侧边栏导航链接
        document.querySelectorAll('.dashboard-nav .nav-item').forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href) {
                    // 如果是账号设置链接，跳转到账号设置页面
                    if (href === 'provider-settings.html') {
                        window.location.href = href;
                    }
                }
            });
        });
        
        // 确认预约按钮
        document.querySelectorAll('.btn-accept').forEach(button => {
            button.addEventListener('click', (e) => {
                const bookingId = e.target.dataset.id;
                this.acceptBooking(bookingId);
            });
        });
        
        // 拒绝预约按钮
        document.querySelectorAll('.btn-reject').forEach(button => {
            button.addEventListener('click', (e) => {
                const bookingId = e.target.dataset.id;
                this.showRejectModal(bookingId);
            });
        });
        
        // 查看详情按钮
        document.querySelectorAll('.btn-detail').forEach(button => {
            button.addEventListener('click', (e) => {
                const bookingId = e.target.dataset.id;
                this.showBookingDetails(bookingId);
            });
        });
        
        // 调整时间按钮
        document.querySelectorAll('.btn-reschedule').forEach(button => {
            button.addEventListener('click', (e) => {
                const bookingId = e.target.dataset.id;
                this.showRescheduleModal(bookingId);
            });
        });
        
        // 模态框关闭按钮
        document.querySelectorAll('.close-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.closeAllModals();
            });
        });
        
        // 点击模态框外部关闭
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeAllModals();
                }
            });
        });
        
        // ESC键关闭模态框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
        
        // 拒绝预约表单提交
        const rejectForm = document.getElementById('rejectForm');
        if (rejectForm) {
            rejectForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const bookingId = rejectForm.dataset.bookingId;
                const reason = document.getElementById('rejectReason').value;
                const message = document.getElementById('rejectMessage').value;
                this.rejectBooking(bookingId, reason, message);
            });
        }
        
        // 取消拒绝按钮
        document.querySelector('.cancel-reject')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.closeAllModals();
        });
        
        // 日历相关事件，只绑定一次
        if (!this.calendarNavBound) {
            const prevBtn = document.getElementById('prevMonth');
            const nextBtn = document.getElementById('nextMonth');
            if (prevBtn) prevBtn.addEventListener('click', () => this.navigateMonth(-1));
            if (nextBtn) nextBtn.addEventListener('click', () => this.navigateMonth(1));
            this.calendarNavBound = true;
        }
        
        // 调整时间弹窗关闭按钮（支持多个rescheduleClose按钮）
        document.querySelectorAll('#rescheduleClose').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.closeRescheduleModal();
            });
        });
        
        // 调整时间表单提交
        const rescheduleForm = document.getElementById('rescheduleForm');
        if (rescheduleForm) {
            rescheduleForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const bookingId = rescheduleForm.dataset.bookingId;
                const newDate = document.getElementById('rescheduleDate').value;
                const newTime = document.getElementById('rescheduleTime').value;
                this.submitReschedule(bookingId, newDate, newTime);
            });
        }
    }
    
    /**
     * 加载预约数据（列表视图和日历视图）
     */
    async loadBookings() {
        console.log('加载预约数据...');
        
        try {
            // 显示加载中状态
            this.bookingList.innerHTML = `
                <div class="loading-state" style="grid-column: 1/-1; text-align: center; padding: 50px 0;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 48px; color: #4a6cf7;"></i>
                    <p style="margin-top: 20px;">正在加载预约数据...</p>
                </div>
            `;
            
            // 获取认证令牌
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('未登录或会话已过期');
            }
            
            console.log('正在从MySQL数据库获取预约数据...');
            
            // 发送API请求获取预约数据
            const response = await fetch('/api/bookings/dashboard', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`获取预约数据失败: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('成功从数据库获取到预约数据:', data);
            
            // 使用预约数据渲染不同视图
            if (this.currentView === 'calendar') {
                // 日历视图
                this.renderCalendar(data);
            } else {
                // 列表视图
                this.renderBookingList(data);
            }
            
            // 更新侧边栏统计数字
            this.updateStatistics();
            
            // 初次加载完成后，应用当前筛选条件
            this.filterBookings(this.currentFilter);
            
        } catch (error) {
            console.error('加载预约数据失败:', error);
            
            // 显示错误信息
            this.bookingList.innerHTML = `
                <div class="error-state" style="grid-column: 1/-1; text-align: center; padding: 50px 0;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #f44336;"></i>
                    <p style="margin-top: 20px;">加载预约数据失败</p>
                    <p style="color: #666;">${error.message}</p>
                    <button class="btn-retry" style="margin-top: 20px; padding: 8px 16px;">重试</button>
                </div>
            `;
            
            // 添加重试按钮事件
            document.querySelector('.btn-retry')?.addEventListener('click', () => {
                this.loadBookings();
            });
        }
        
        // 测试服务数据是否能从MySQL加载
        this.testLoadServices();
    }
    
    /**
     * 测试从MySQL数据库加载服务数据
     */
    async testLoadServices() {
        try {
            console.log('正在测试从MySQL加载服务数据...');
            
            // 获取认证令牌
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('未登录或会话已过期');
            }
            
            // 发送API请求获取服务数据
            const response = await fetch('/api/services/provider', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`获取服务数据失败: ${response.status}`);
            }
            
            const services = await response.json();
            console.log('成功从MySQL获取到服务数据:', services);
            
            // 这里只是测试，不进行实际渲染
            
        } catch (error) {
            console.error('测试加载服务数据失败:', error);
        }
    }
    
    /**
     * 渲染预约列表
     */
    renderBookingList(data) {
        console.log('渲染预约列表:', data);
        
        // 清空容器
        this.bookingList.innerHTML = '';
        
        // 合并待确认和即将到来的预约
        const allBookings = [];
        if (data.pending && Array.isArray(data.pending)) {
            allBookings.push(...data.pending);
        }
        if (data.upcoming && Array.isArray(data.upcoming)) {
            allBookings.push(...data.upcoming);
        }
        if (data.completed && Array.isArray(data.completed)) {
            allBookings.push(...data.completed);
        }
        if (data.cancelled && Array.isArray(data.cancelled)) {
            allBookings.push(...data.cancelled);
        }
        
        // 如果是普通数组，直接使用
        if (Array.isArray(data)) {
            allBookings.push(...data);
        }
        
        // 处理没有预约的情况
        if (allBookings.length === 0) {
            this.bookingList.innerHTML = `
                <div class="no-bookings" style="grid-column: 1/-1; text-align: center; padding: 50px 0;">
                    <i class="fas fa-calendar-times" style="font-size: 48px; color: #ccc; margin-bottom: 20px;"></i>
                    <h3>暂无预约</h3>
                    <p>您当前没有任何预约请求</p>
                </div>
            `;
            return;
        }
        
        // 渲染预约列表
        allBookings.forEach(booking => {
            const bookingItem = this.createBookingItem(booking);
            this.bookingList.appendChild(bookingItem);
        });
    }
    
    /**
     * 获取状态文本
     */
    getStatusText(status) {
        switch (status) {
            case 'pending': return '待确认';
            case 'upcoming': return '即将到来';
            case 'completed': return '已完成';
            case 'rejected': return '已拒绝';
            case 'canceled': return '已取消';
            default: return status;
        }
    }
    
    /**
     * 创建单个预约项
     */
    createBookingItem(booking) {
        console.log('创建预约项:', booking);
        
        // 创建预约元素
        const bookingItem = document.createElement('div');
        bookingItem.className = `booking-item ${booking.status} card`;
        bookingItem.dataset.id = booking.id;
        
        // 格式化日期和时间
        let bookingDate = '';
        try {
            const date = new Date(booking.date);
            bookingDate = `${date.getMonth() + 1}月${date.getDate()}日`;
        } catch (e) {
            console.error('日期格式化错误:', e);
            bookingDate = booking.date || '';
        }
        
        // 获取服务名称和价格
        const serviceName = booking.service?.title || booking.service_name || '未知服务';
        const servicePrice = booking.service?.price || booking.price || '0.00';
        const serviceDuration = booking.service?.duration || '60';
        
        // 获取用户信息
        const customerName = booking.user?.username || booking.user_name || '客户';
        const customerPhone = booking.user?.phone || '无联系方式';
        const customerAvatar = booking.user?.avatar || 'img/avatar-placeholder.jpg';
        
        // 构建HTML内容
        bookingItem.innerHTML = `
            <div class="card-header">
                <div class="booking-time">
                    <div class="date">${bookingDate}</div>
                    <div class="time">${booking.time || ''}</div>
                    <div class="status-badge ${booking.status}">${this.getStatusText(booking.status)}</div>
                </div>
            </div>
            <div class="card-body">
                <div class="booking-info">
                    <div class="customer-info">
                        <img src="${customerAvatar}" alt="客户头像" class="customer-avatar">
                        <div>
                            <div class="customer-name">${customerName}</div>
                            <div class="customer-contact">电话：${customerPhone}</div>
                        </div>
                    </div>
                    <div class="service-info">
                        <div class="service-name">${serviceName}</div>
                        <div class="service-price">¥${servicePrice} / ${serviceDuration}分钟</div>
                    </div>
                </div>
            </div>
            <div class="card-footer">
                <div class="booking-actions">
                    ${this.renderBookingActions(booking)}
                </div>
            </div>
        `;
        
        // 为预约项添加事件监听
        this.bindBookingItemEvents(bookingItem, booking);
        
        return bookingItem;
    }
    
    /**
     * 根据预约状态渲染操作按钮
     * @param {Object} booking - 预约数据
     * @returns {string} - 按钮HTML
     */
    renderBookingActions(booking) {
        const bookingId = booking.id;
        
        if (booking.status === 'pending') {
            return `
                <button class="btn-accept" data-id="${bookingId}">确认预约</button>
                <button class="btn-reject" data-id="${bookingId}">拒绝预约</button>
            `;
        } else if (booking.status === 'confirmed' || booking.status === 'upcoming') {
            return `
                <button class="btn-complete" data-id="${bookingId}">完成服务</button>
                <button class="btn-detail" data-id="${bookingId}">查看详情</button>
                <button class="btn-reschedule" data-id="${bookingId}">调整时间</button>
            `;
        } else {
            return `
                <button class="btn-detail" data-id="${bookingId}">查看详情</button>
            `;
        }
    }
    
    /**
     * 绑定预约项按钮事件
     * @param {HTMLElement} bookingItem - 预约项元素
     * @param {Object} booking - 预约数据
     */
    bindBookingItemEvents(bookingItem, booking) {
        const bookingId = booking.id;
        
        // 确认预约按钮
        const acceptBtn = bookingItem.querySelector(`.btn-accept[data-id="${bookingId}"]`);
        if (acceptBtn) {
            acceptBtn.addEventListener('click', () => this.acceptBooking(bookingId));
        }
        
        // 拒绝预约按钮
        const rejectBtn = bookingItem.querySelector(`.btn-reject[data-id="${bookingId}"]`);
        if (rejectBtn) {
            rejectBtn.addEventListener('click', () => this.showRejectModal(bookingId));
        }
        
        // 查看详情按钮
        const detailBtn = bookingItem.querySelector(`.btn-detail[data-id="${bookingId}"]`);
        if (detailBtn) {
            detailBtn.addEventListener('click', () => this.showBookingDetails(bookingId));
        }
        
        // 调整时间按钮
        const rescheduleBtn = bookingItem.querySelector(`.btn-reschedule[data-id="${bookingId}"]`);
        if (rescheduleBtn) {
            rescheduleBtn.addEventListener('click', () => this.showRescheduleModal(bookingId));
        }
        
        // 完成服务按钮
        const completeBtn = bookingItem.querySelector(`.btn-complete[data-id="${bookingId}"]`);
        if (completeBtn) {
            completeBtn.addEventListener('click', () => this.completeBooking(bookingId));
        }
    }
    
    /**
     * 切换视图（列表/日历）
     */
    switchView(view) {
        this.currentView = view;
        
        // 更新激活的视图按钮
        this.viewButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.view === view);
        });
        
        // 显示/隐藏相应的视图
        if (view === 'list') {
            this.calendarSection.style.display = 'none';
            this.listSection.style.display = 'block';
        } else {
            this.calendarSection.style.display = 'block';
            this.listSection.style.display = 'none';
            this.renderCalendar();
        }
    }
    
    /**
     * 筛选预约
     */
    filterBookings(status) {
        this.currentFilter = status;
        
        // 更新激活的筛选按钮
        this.filterButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.status === status);
        });
        
        // 筛选预约项
        const bookingItems = document.querySelectorAll('.booking-item');
        bookingItems.forEach(item => {
            // 根据类名判断预约状态
            const isPending = item.classList.contains('pending');
            const isUpcoming = item.classList.contains('upcoming');
            const isCompleted = item.classList.contains('completed');
            const isRejected = item.classList.contains('rejected');
            
            // 根据筛选条件显示/隐藏
            if (status === 'all') {
                item.style.display = 'flex';
            } else if (status === 'pending' && isPending) {
                item.style.display = 'flex';
            } else if (status === 'upcoming' && isUpcoming) {
                item.style.display = 'flex';
            } else if (status === 'completed' && isCompleted) {
                item.style.display = 'flex';
            } else if (status === 'rejected' && isRejected) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }
    
    /**
     * 确认预约
     */
    async acceptBooking(bookingId) {
        console.log(`确认预约 ID: ${bookingId}`);
        
        try {
            // 获取确认按钮并显示加载状态
            const acceptButton = document.querySelector(`.btn-accept[data-id="${bookingId}"]`);
            if (acceptButton) {
                acceptButton.disabled = true;
                acceptButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 处理中...';
            }
            
            // 获取认证令牌
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('未登录或会话已过期');
            }
            
            // 发送API请求确认预约
            const response = await fetch(`/api/bookings/${bookingId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    status: 'confirmed'
                })
            });
            
            // 检查响应状态
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '确认预约失败');
            }
            
            // 解析响应数据
            const data = await response.json();
            console.log('预约确认成功:', data);
            
            // 更新UI
            const bookingItem = document.querySelector(`.booking-item .btn-accept[data-id="${bookingId}"]`).closest('.booking-item');
            
            // 更新预约状态
            bookingItem.classList.remove('pending');
            bookingItem.classList.add('upcoming');
            
            // 更新状态标签
            const statusBadge = bookingItem.querySelector('.status-badge');
            if (statusBadge) {
                statusBadge.className = 'status-badge upcoming';
                statusBadge.textContent = '即将到来';
            }
            
            // 第二个API调用，可能是为了通知系统或其他目的
            fetch(`/api/bookings/${bookingId}/accept`, {
                method: 'PUT',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            })
            .then(res => res.json())
            .then(data => {
                if (data && data.message && data.message.indexOf('成功') === -1 && data.message.indexOf('确认') === -1) {
                    this.showNotification(data.message);
                    return;
                }
            });
            
            // 显示成功消息
            this.showNotification('预约已确认', 'success');
            
            // 更新侧边栏统计数字
            this.updateStatistics();
            
        } catch (error) {
            console.error('确认预约失败:', error);
            this.showNotification(`确认预约失败: ${error.message}`, 'error');
            
            // 恢复按钮状态
            const acceptButton = document.querySelector(`.btn-accept[data-id="${bookingId}"]`);
            if (acceptButton) {
                acceptButton.disabled = false;
                acceptButton.textContent = '确认预约';
            }
        }
    }
    
    /**
     * 显示拒绝预约模态框
     */
    showRejectModal(bookingId) {
        const rejectForm = document.getElementById('rejectForm');
        if (rejectForm) {
            rejectForm.dataset.bookingId = bookingId;
            
            // 重置表单
            rejectForm.reset();
            
            // 显示模态框
            this.rejectModal.classList.add('active');
        }
    }
    
    /**
     * 拒绝预约
     */
    async rejectBooking(bookingId, reason, message) {
        console.log(`拒绝预约 ID: ${bookingId}, 原因: ${reason}, 消息: ${message}`);
        
        try {
            // 获取提交按钮并显示加载状态
            const submitBtn = document.querySelector('#rejectForm .btn-confirm');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 处理中...';
            }
            
            // 获取认证令牌
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('未登录或会话已过期');
            }
            
            // 发送API请求拒绝预约
            const response = await fetch(`/api/bookings/${bookingId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    status: 'cancelled',
                    reason: reason,
                    message: message
                })
            });
            
            // 检查响应状态
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '拒绝预约失败');
            }
            
            // 解析响应数据
            const data = await response.json();
            console.log('预约拒绝成功:', data);
            
            // 更新UI
            const bookingItem = document.querySelector(`.booking-item .btn-reject[data-id="${bookingId}"]`).closest('.booking-item');
            
            // 更新预约状态
            bookingItem.classList.remove('pending');
            bookingItem.classList.add('rejected');
            
            // 更新状态标签
            const statusBadge = bookingItem.querySelector('.status-badge');
            if (statusBadge) {
                statusBadge.className = 'status-badge rejected';
                statusBadge.textContent = '已拒绝';
            }
            
            // 第二个API调用，可能是为了通知系统或其他目的
            fetch(`/api/bookings/${bookingId}/reject`, {
                method: 'PUT',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ reason, message })
            })
            .then(res => res.json())
            .then(data => {
                if (data && data.message && data.message.indexOf('成功') === -1 && data.message.indexOf('拒绝') === -1) {
                    this.showNotification(data.message);
                    return;
                }
            });
            
            // 关闭模态框
            this.closeAllModals();
            
            // 显示成功消息
            this.showNotification('预约已拒绝', 'success');
            
            // 更新侧边栏统计数字
            this.updateStatistics();
            
        } catch (error) {
            console.error('拒绝预约失败:', error);
            this.showNotification(`拒绝预约失败: ${error.message}`, 'error');
            
            // 恢复按钮状态
            const submitBtn = document.querySelector('#rejectForm .btn-confirm');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = '确认拒绝';
            }
        }
    }
    
    /**
     * 显示预约详情
     */
    async showBookingDetails(bookingId) {
        console.log(`查看预约详情 ID: ${bookingId}`);
        
        try {
            // 显示加载中状态
            const modalBody = this.appointmentModal.querySelector('.modal-body');
            modalBody.innerHTML = `
                <div class="loading-state" style="text-align: center; padding: 50px 0;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 36px; color: #4a6cf7;"></i>
                    <p style="margin-top: 20px;">正在加载预约详情...</p>
                </div>
            `;
            
            // 显示模态框
            this.appointmentModal.classList.add('active');
            
            // 获取认证令牌
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('未登录或会话已过期');
            }
            
            // 发送API请求获取预约详情
            const response = await fetch(`/api/bookings/${bookingId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`获取预约详情失败: ${response.status}`);
            }
            
            const booking = await response.json();
            console.log('获取到预约详情:', booking);
            
            // 格式化日期和时间
            const bookingDate = new Date(booking.date);
            const formattedDate = `${bookingDate.getFullYear()}年${bookingDate.getMonth() + 1}月${bookingDate.getDate()}日`;
            const formattedTime = booking.time || '';
            
            // 获取状态显示文本
            let statusText = '未知状态';
            let statusClass = '';
            if (booking.status === 'pending') {
                statusText = '待确认';
                statusClass = 'pending';
            } else if (booking.status === 'confirmed' || booking.status === 'upcoming') {
                statusText = '即将到来';
                statusClass = 'upcoming';
            } else if (booking.status === 'completed') {
                statusText = '已完成';
                statusClass = 'completed';
            } else if (booking.status === 'cancelled' || booking.status === 'canceled') {
                statusText = '已拒绝';
                statusClass = 'rejected';
            }
            
            // 获取服务信息
            const serviceName = booking.service?.name || booking.service_name || '服务项目';
            const servicePrice = booking.service?.price || booking.price || '0.00';
            const serviceDuration = booking.service?.duration || booking.duration || '60';
            
            // 获取客户信息
            const userName = booking.user?.username || booking.user_name || '客户';
            const userPhone = booking.user?.phone || booking.phone || '未提供';
            const userEmail = booking.user?.email || booking.email || '未提供';
        
        // 填充详情模态框
        modalBody.innerHTML = `
            <div class="appointment-details">
                <div class="detail-section">
                    <h4>预约信息</h4>
                    <div class="detail-row">
                        <div class="detail-label">预约状态</div>
                            <div class="detail-value"><span class="status-badge ${statusClass}">${statusText}</span></div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">预约日期</div>
                            <div class="detail-value">${formattedDate}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">预约时间</div>
                            <div class="detail-value">${formattedTime}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">服务项目</div>
                        <div class="detail-value">${serviceName}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">服务价格</div>
                            <div class="detail-value">¥${servicePrice} / ${serviceDuration}分钟</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">预约ID</div>
                            <div class="detail-value"><span class="id-code">${booking.id}</span></div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">创建时间</div>
                            <div class="detail-value">${new Date(booking.created_at).toLocaleString()}</div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>客户信息</h4>
                    <div class="detail-row">
                        <div class="detail-label">客户姓名</div>
                            <div class="detail-value">${userName}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">联系方式</div>
                            <div class="detail-value">${userPhone}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">客户邮箱</div>
                            <div class="detail-value">${userEmail}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">备注</div>
                            <div class="detail-value">${booking.remarks || '无特殊要求'}</div>
                    </div>
                </div>
            </div>
        `;
        
        } catch (error) {
            console.error('获取预约详情失败:', error);
            
            // 显示错误信息
            const modalBody = this.appointmentModal.querySelector('.modal-body');
            modalBody.innerHTML = `
                <div class="error-state" style="text-align: center; padding: 50px 0;">
                    <i class="fas fa-exclamation-circle" style="font-size: 36px; color: #ff3b30; margin-bottom: 20px;"></i>
                    <h3>获取预约详情失败</h3>
                    <p>${error.message}</p>
                    <button class="btn-retry" style="margin-top: 20px; padding: 8px 16px; background-color: #4a6cf7; color: white; border: none; border-radius: 4px; cursor: pointer;">重试</button>
                </div>
            `;
            
            // 添加重试按钮的事件监听
            const retryBtn = modalBody.querySelector('.btn-retry');
            if (retryBtn) {
                retryBtn.addEventListener('click', () => {
                    this.showBookingDetails(bookingId);
                });
            }
        }
    }
    
    /**
     * 显示调整时间模态框
     */
    showRescheduleModal(bookingId) {
        // 获取当前预约信息
        const bookingItem = document.querySelector(`.booking-item .btn-reschedule[data-id="${bookingId}"]`).closest('.booking-item');
        const date = bookingItem.querySelector('.date')?.textContent || '';
        const providerId = bookingItem.getAttribute('data-provider-id') || 'prov1';
        const serviceId = bookingItem.getAttribute('data-service-id') || '';
        // 填充表单
        const rescheduleForm = document.getElementById('rescheduleForm');
        if (rescheduleForm) {
            rescheduleForm.dataset.bookingId = bookingId;
            document.getElementById('rescheduleDate').value = date;
            // 获取可用时间段
            this.fetchAvailableTimeslots(providerId, date, serviceId);
            // 监听日期切换，动态刷新时间段
            const dateInput = document.getElementById('rescheduleDate');
            dateInput.onchange = () => {
                this.fetchAvailableTimeslots(providerId, dateInput.value, serviceId);
            };
        }
        this.rescheduleModal.classList.add('active');
    }
    
    fetchAvailableTimeslots(providerId, date, serviceId) {
        const timeSelect = document.getElementById('rescheduleTime');
        if (!providerId || !date) return;
        fetch(`/api/provider/${providerId}/available-timeslots?date=${date}&service_id=${serviceId}`)
            .then(res => res.json())
            .then(data => {
                if (data.available_times && data.available_times.length) {
                    timeSelect.innerHTML = data.available_times.map(t =>
                        `<option value="${t}">${t}</option>`
                    ).join('');
                } else {
                    timeSelect.innerHTML = '<option value="">无可用时间</option>';
                }
            });
    }
    
    /**
     * 关闭所有模态框
     */
    closeAllModals() {
        if (this.appointmentModal) {
            this.appointmentModal.classList.remove('active');
        }
        if (this.rejectModal) {
            this.rejectModal.classList.remove('active');
            const rejectForm = document.getElementById('rejectForm');
            if (rejectForm) {
                rejectForm.reset();
            }
        }
        if (this.rescheduleModal) {
            this.rescheduleModal.classList.remove('active');
        }
    }
    
    /**
     * 显示通知消息
     * @param {string} message - 通知消息
     * @param {string} type - 通知类型（success/error）
     */
    showNotification(message, type = 'success') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // 添加到页面
        document.body.appendChild(notification);
        
        // 显示通知
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // 3秒后移除
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
    
    /**
     * 渲染日历（日历视图）
     */
    renderCalendar() {
        const calendarGrid = document.getElementById('calendarGrid');
        if (!calendarGrid) return;
        
        // 获取当前月份的信息
        const currentYear = this.selectedDate.getFullYear();
        const currentMonth = this.selectedDate.getMonth(); // 0-11
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        
        // 更新月份显示
        const currentMonthElement = document.getElementById('currentMonth');
        if (currentMonthElement) {
            currentMonthElement.textContent = `${currentYear}年${currentMonth + 1}月`;
        }
        
        // 计算API请求的起止日期，月份补零
        const startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
        const endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;

        // 获取token
        const token = localStorage.getItem('token');
        if (!token) {
            calendarGrid.innerHTML = '<div style="padding:2rem;text-align:center;color:#f44336;">请先登录</div>';
            return;
        }

        // 请求后端API获取预约数据
        fetch(`/api/bookings/calendar?start_date=${startDate}&end_date=${endDate}`, {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token
            }
        })
        .then(res => res.json())
        .then(data => {
            this.renderCalendarGrid(data, firstDay, lastDay, currentYear, currentMonth);
        })
        .catch(() => {
            calendarGrid.innerHTML = '<div style="padding:2rem;text-align:center;color:#f44336;">加载预约数据失败</div>';
        });
    }

    /**
     * 渲染日历格子（用真实预约数据）
     */
    renderCalendarGrid(appointmentsByDate, firstDay, lastDay, currentYear, currentMonth) {
        const calendarGrid = document.getElementById('calendarGrid');
        if (!calendarGrid) return;
        const startingDay = firstDay.getDay() || 7;
        const totalDays = lastDay.getDate();
        let calendarHTML = '';
        const prevMonthLastDate = new Date(currentYear, currentMonth, 0).getDate();
        // 上月
        for (let i = 0; i < startingDay - 1; i++) {
            const day = prevMonthLastDate - (startingDay - 2 - i);
            calendarHTML += `
                <div class="calendar-day inactive">
                    <span class="day-number">${day}</span>
                </div>
            `;
        }
        // 当前月
        const today = new Date();
        for (let day = 1; day <= totalDays; day++) {
            const date = new Date(currentYear, currentMonth, day);
            const isToday = date.toDateString() === today.toDateString();
            // 生成YYYY-MM-DD格式，月份和日期都补零
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const appointments = appointmentsByDate[dateStr] || [];
            calendarHTML += `
                <div class="calendar-day ${isToday ? 'today' : ''}" data-date="${dateStr}">
                    <span class="day-number">${day}</span>
                    ${appointments.length > 0 ? `<div class="appointment-count">${appointments.length}</div>` : ''}
                </div>
            `;
        }
        // 下月
        const remainingDays = 42 - ((startingDay - 1) + totalDays);
        for (let day = 1; day <= remainingDays; day++) {
            calendarHTML += `
                <div class="calendar-day inactive">
                    <span class="day-number">${day}</span>
                </div>
            `;
        }
        calendarGrid.innerHTML = calendarHTML;
        // 点击某一天显示预约详情
        calendarGrid.querySelectorAll('.calendar-day').forEach(dayEl => {
            if (!dayEl.classList.contains('inactive')) {
                dayEl.addEventListener('click', () => {
                    const dateStr = dayEl.getAttribute('data-date');
                    const appointments = appointmentsByDate[dateStr] || [];
                    this.showAppointmentsForDate(dateStr, appointments);
                });
            }
        });
    }

    /**
     * 显示某一天的预约详情（用模态框展示，支持多条预约）
     */
    showAppointmentsForDate(dateStr, appointments) {
        if (!appointments || appointments.length === 0) {
            this.showNotification(`${dateStr} 没有预约`);
            return;
        }
        // 构建预约详情内容
        let html = `<h4 style="margin-bottom:1rem;">${dateStr} 预约详情</h4>`;
        appointments.forEach(b => {
            html += `<div style="border-bottom:1px solid #eee;padding:0.5rem 0;">
                <div><b>时间：</b>${b.time}</div>
                <div><b>客户：</b>${b.user ? b.user.username : ''}</div>
                <div><b>服务：</b>${b.service ? b.service.title : ''}</div>
                <div><b>状态：</b><span class="status-badge ${b.status}">${this.getStatusText(b.status)}</span></div>
            </div>`;
        });
        // 用模态框展示
        const modalBody = this.appointmentModal.querySelector('.modal-body');
        modalBody.innerHTML = html;
        this.appointmentModal.classList.add('active');
    }
    
    
    /**
     * 月份导航（日历视图）
     */
    navigateMonth(delta) {
        // 只加减一个月，防止跳两个月
        this.selectedDate.setDate(1);
        this.selectedDate.setMonth(this.selectedDate.getMonth() + delta);
        this.renderCalendar();
    }
    
    /**
     * 更新侧边栏统计数据
     */
    async updateStatistics() {
        try {
            // 检查是否已经有侧边栏管理器初始化
            if (window.sidebarManagerInitialized) {
                console.log('侧边栏管理器已初始化，使用其更新统计数据');
                // 如果侧边栏管理器已初始化，使用其更新统计数据
                if (typeof fetchBookingStatsFromAPI === 'function') {
                    const statsData = await fetchBookingStatsFromAPI();
                    if (statsData && statsData.stats) {
                        window.sidebarBookingStats = statsData.stats;
                        updateSidebarStatsUI();
                    }
                }
                return;
            }
            
            // 获取认证令牌
            const token = localStorage.getItem('token');
            if (!token) {
                console.error('无法更新统计数据: 未登录或会话已过期');
                return;
            }
            
            // 发送API请求获取统计数据
            const response = await fetch('/api/bookings/stats', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`获取统计数据失败: ${response.status}`);
            }
            
            const stats = await response.json();
            console.log('获取到统计数据:', stats);
            
            // 更新侧边栏中的预约统计卡片
            const waitingElement = document.querySelector('.stat-card.waiting .stat-value');
            if (waitingElement) waitingElement.textContent = stats.stats.pending || '0';
            
            const upcomingElement = document.querySelector('.stat-card.upcoming .stat-value');
            if (upcomingElement) upcomingElement.textContent = stats.stats.upcoming || '0';
            
            const completedElement = document.querySelector('.stat-card.completed .stat-value');
            if (completedElement) completedElement.textContent = stats.stats.completed || '0';
            
            const cancelledElement = document.querySelector('.stat-card.cancelled .stat-value');
            if (cancelledElement) cancelledElement.textContent = stats.stats.canceled || '0';
            
        } catch (error) {
            console.error('更新统计数据失败:', error);
        }
    }
    
    /**
     * 完成服务预约
     */
    async completeBooking(bookingId) {
        console.log(`完成预约服务 ID: ${bookingId}`);
        
        try {
            // 获取按钮元素并显示加载状态
            const completeButton = document.querySelector(`.btn-complete[data-id="${bookingId}"]`);
            if (completeButton) {
                completeButton.disabled = true;
                completeButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 处理中...';
            }
            
            // 获取认证令牌
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('未登录或会话已过期');
            }
            
            // 发送API请求完成预约
            const response = await fetch(`/api/bookings/${bookingId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    status: 'completed'
                })
            });
            
            // 检查响应状态
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '标记预约完成失败');
            }
            
            // 解析响应数据
            const data = await response.json();
            console.log('预约完成成功:', data);
            
            // 更新UI
            const bookingItem = completeButton.closest('.booking-item');
            
            // 更新预约状态
            bookingItem.classList.remove('upcoming');
            bookingItem.classList.add('completed');
            
            // 更新状态标签
            const statusBadge = bookingItem.querySelector('.status-badge');
            if (statusBadge) {
                statusBadge.className = 'status-badge completed';
                statusBadge.textContent = '已完成';
            }
            
            // 更新操作按钮
            const actionsContainer = bookingItem.querySelector('.booking-actions');
            if (actionsContainer) {
                actionsContainer.innerHTML = `
                    <button class="btn-detail" data-id="${bookingId}">查看详情</button>
                `;
                
                // 重新绑定事件
                const detailBtn = actionsContainer.querySelector('.btn-detail');
                if (detailBtn) {
                    detailBtn.addEventListener('click', () => this.showBookingDetails(bookingId));
                }
            }
            
            // 显示成功消息
            this.showNotification('预约已标记为完成');
            
            // 更新侧边栏统计数字
            this.updateStatistics();
            
        } catch (error) {
            console.error('标记预约完成失败:', error);
            this.showNotification(`标记预约完成失败: ${error.message}`, 'error');
            
            // 恢复按钮状态
            const completeButton = document.querySelector(`.btn-complete[data-id="${bookingId}"]`);
            if (completeButton) {
                completeButton.disabled = false;
                completeButton.textContent = '完成服务';
            }
        }
    }
}

/**
 * 当DOM加载完成后初始化
 */
document.addEventListener('DOMContentLoaded', () => {
    // 创建服务商控制台实例
    window.providerDashboard = new ProviderDashboard();
    
    // 添加CSS样式 - 通知消息
    const style = document.createElement('style');
    style.textContent = `
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 24px;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 9999;
            transform: translateX(100%);
            opacity: 0;
            transition: all 0.3s ease;
            color: #fff;
        }
        
        .notification.success {
            background-color: rgba(74, 108, 247, 0.95);
        }
        
        .notification.error {
            background-color: rgba(255, 59, 48, 0.95);
        }
        
        .notification.show {
            transform: translateX(0);
            opacity: 1;
        }
        
        .appointment-details {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
        }
        
        .detail-section {
            background: #f9f9f9;
            border-radius: 8px;
            padding: 1.25rem;
        }
        
        .detail-section h4 {
            margin-bottom: 1rem;
            font-size: 1.1rem;
            font-weight: 600;
        }
        
        .detail-row {
            display: flex;
            margin-bottom: 0.75rem;
        }
        
        .detail-label {
            width: 100px;
            font-weight: 500;
            color: #666;
        }
        
        .detail-value {
            flex: 1;
            color: #333;
        }
        
        .modal.active {
            display: flex;
        }
        
        .btn-complete {
            background-color: #28a745;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
            transition: background-color 0.2s ease;
        }
        
        .btn-complete:hover {
            background-color: #218838;
        }
        
        .btn-complete:disabled {
            background-color: #6c757d;
            cursor: not-allowed;
        }
        
        @media (max-width: 768px) {
            .appointment-details {
                flex-direction: column;
            }
            
            .detail-row {
                flex-direction: column;
                margin-bottom: 1rem;
            }
            
            .detail-label {
                width: 100%;
                margin-bottom: 0.25rem;
            }
        }
    `;
    document.head.appendChild(style);
}); 