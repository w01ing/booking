/**
 * 时间段管理功能
 */
class TimeSlotManagement {
    constructor() {
        this.currentWeekStart = this.getStartOfWeek(new Date());
        this.timeslots = [];
        this.initialized = false;
        this.selectedTimeslots = []; // 用于存储选中的时间段
        
        // 初始化
        this.init();
    }
    
    /**
     * 初始化时间段管理
     */
    async init() {
        if (this.initialized) return;
        
        try {
            console.log('初始化时间段管理...');
            
            // 显示认证信息
            const token = localStorage.getItem('token');
            const userId = localStorage.getItem('userId');
            const userType = localStorage.getItem('userType');
            console.log('认证信息:', {
                tokenExists: !!token,
                tokenLength: token ? token.length : 0,
                userId,
                userType
            });
            
            // 检查是否已登录
            if (!token) {
                console.error('未找到认证令牌，请先登录');
                alert('请先登录后再访问此页面');
                window.location.href = 'test_login.html';
                return;
            }
            
            // 检查用户类型
            if (userType !== 'provider') {
                console.warn('当前用户不是服务提供商，可能无法访问时间段数据');
            }
            
            // 绑定事件监听器
            this.bindEventListeners();
            
            // 显示加载中提示
            const loadingMessage = document.createElement('div');
            loadingMessage.className = 'loading-message';
            loadingMessage.textContent = '正在加载时间段数据，请稍候...';
            document.body.appendChild(loadingMessage);
            
            try {
            // 加载时间段数据
            console.log('开始加载时间段数据...');
            await this.loadTimeslots();
                console.log('时间段数据加载成功');
            
            // 渲染当前周的时间段
            console.log('开始渲染当前周时间段...');
            this.renderWeek();
            
            this.initialized = true;
            console.log('时间段管理初始化完成');
            } finally {
                // 移除加载中提示
                if (loadingMessage && loadingMessage.parentNode) {
                    loadingMessage.parentNode.removeChild(loadingMessage);
                }
            }
        } catch (error) {
            console.error('初始化时间段管理失败:', error);
            alert(`初始化时间段管理失败: ${error.message}`);
        }
    }
    
    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        // 上一周按钮
        document.getElementById('prevWeek').addEventListener('click', () => {
            this.navigateWeek(-1);
        });
        
        // 下一周按钮
        document.getElementById('nextWeek').addEventListener('click', () => {
            this.navigateWeek(1);
        });
        
        // 今天按钮
        document.getElementById('todayButton').addEventListener('click', () => {
            this.goToCurrentWeek();
        });
        
        // 工作模式选择
        document.getElementById('workingPattern').addEventListener('change', (e) => {
            this.applyWorkingPattern(e.target.value);
        });
        
        // 添加时间段按钮
        document.getElementById('btnAddTimeSlots').addEventListener('click', () => {
            this.showAddTimeSlotsModal();
        });
        
        // 为所有时间段按钮添加事件委托
        document.querySelector('.timeslot-table').addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;
            
            const timeslot = target.closest('.timeslot');
            if (!timeslot) return;
            
            const date = timeslot.dataset.date;
            const time = timeslot.dataset.time;
            
            if (target.classList.contains('btn-slot-edit')) {
                this.showEditTimeSlotModal(date, time);
            } else if (target.classList.contains('btn-slot-block')) {
                this.blockTimeSlot(date, time);
            } else if (target.classList.contains('btn-slot-enable')) {
                this.enableTimeSlot(date, time);
            } else if (target.classList.contains('btn-slot-view')) {
                this.viewBookingDetails(date, time);
            }
        });
        
        // 保存添加时间段的表单
        document.getElementById('saveTimeSlotsBtn').addEventListener('click', () => {
            this.saveTimeSlots();
        });
        
        // 保存工作模式的表单
        document.getElementById('savePatternBtn').addEventListener('click', () => {
            this.saveWorkingPattern();
        });

        // 批量禁用按钮
        document.getElementById('batchDisableBtn').addEventListener('click', () => {
            this.showBatchDisableModal();
        });
        
        // 批量启用按钮
        document.getElementById('batchEnableBtn').addEventListener('click', () => {
            this.showBatchEnableModal();
        });

        // 添加关闭弹窗事件
        this.setupModalCloseEvents();
    }
    
    /**
     * 设置弹窗关闭事件
     */
    setupModalCloseEvents() {
        // 获取所有弹窗
        const modals = document.querySelectorAll('.modal');
        
        // 为每个弹窗添加关闭事件
        modals.forEach(modal => {
            // 关闭按钮点击事件
            const closeBtn = modal.querySelector('.close-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    modal.style.display = 'none';
                });
            }
            
            // 取消按钮点击事件
            const cancelBtns = modal.querySelectorAll('.btn-cancel');
            cancelBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    modal.style.display = 'none';
                });
            });
            
            // 点击弹窗外部关闭
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });
        
        // ESC键关闭弹窗
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                modals.forEach(modal => {
                    if (modal.style.display === 'block') {
                        modal.style.display = 'none';
                    }
                });
            }
        });
    }
    
    /**
     * 加载时间段数据
     */
    async loadTimeslots() {
        try {
            console.log('加载时间段数据...');
            
            // 获取认证令牌
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('未登录或会话已过期');
            }
            
            // 检查用户类型
            const userType = localStorage.getItem('userType');
            console.log('当前用户类型:', userType);
            if (userType !== 'provider') {
                console.warn('当前用户不是服务提供商，可能无法访问时间段数据');
            }
            
            // 计算一周的开始和结束日期
            const startDate = this.formatDate(this.currentWeekStart);
            const endDate = this.formatDate(this.addDays(this.currentWeekStart, 6));
            console.log('查询日期范围:', startDate, '至', endDate);
            console.log('当前周开始日期对象:', this.currentWeekStart);
            console.log('当前周结束日期对象:', this.addDays(this.currentWeekStart, 6));
            
            // 从MySQL数据库API获取时间段数据
            console.log(`发送请求到MySQL数据库API: GET /api/timeslots?start_date=${startDate}&end_date=${endDate}`);
            const response = await fetch(`/api/timeslots?start_date=${startDate}&end_date=${endDate}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                // 添加缓存控制，确保获取最新数据
                cache: 'no-cache'
            });
            
            console.log('MySQL API响应状态码:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('从MySQL数据库获取时间段数据失败:', errorText);
                throw new Error(`获取时间段数据失败: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('成功从MySQL数据库加载时间段数据:', data);
            console.log('时间段数量:', data.length);
            
            // 调试日期格式
            if (data.length > 0) {
                console.log('样本时间段数据:');
                data.slice(0, 3).forEach((slot, index) => {
                    console.log(`样本 ${index + 1}:`, slot);
                    
                    // 确保日期格式一致 (MySQL返回的日期可能是ISO格式)
                    if (typeof slot.date === 'string' && slot.date.includes('T')) {
                        // 如果日期包含时间部分，去除时间部分
                        slot.date = slot.date.split('T')[0];
                    }
                    
                    const weekDates = [];
                    for (let i = 0; i < 7; i++) {
                        const date = this.addDays(this.currentWeekStart, i);
                        const formattedDate = this.formatDate(date);
                        weekDates.push(formattedDate);
                    }
                    console.log('当前周日期:', weekDates);
                    console.log('时间段日期是否在当前周:', weekDates.includes(slot.date));
                });
            }
            
            // 检查是否有时间段数据
            else if (data.length === 0) {
                console.warn('MySQL数据库中没有找到时间段数据，将尝试初始化');
                await this.initializeTimeSlots();
                return; // 初始化后会重新调用loadTimeslots，所以这里直接返回
            }
            
            // 处理MySQL返回的数据格式
            this.timeslots = data.map(slot => {
                // 确保日期格式一致
                if (typeof slot.date === 'string' && slot.date.includes('T')) {
                    // 如果日期包含时间部分，去除时间部分
                    slot.date = slot.date.split('T')[0];
                }
                
                // 初始化预约相关字段，但不尝试加载预约数据（避免404错误）
                return {
                    ...slot,
                    has_booking: false, // 默认为false，不尝试加载预约数据
                    booking: null
                };
            });
            
            console.log('处理后的时间段数据:', this.timeslots);
            
            // 检查是否需要初始化时间段数据
            if (this.shouldInitializeTimeSlots()) {
                console.log('检测到部分日期没有时间段数据，需要初始化');
                await this.initializeTimeSlots();
            }
            
            // 强制重新渲染表格
            this.renderWeek();
            
            // 调试：检查加载的时间段状态
            console.log('时间段可用状态统计:');
            const availableCount = this.timeslots.filter(slot => slot.is_available).length;
            const unavailableCount = this.timeslots.filter(slot => !slot.is_available).length;
            console.log(`总数: ${this.timeslots.length}, 可用: ${availableCount}, 不可用: ${unavailableCount}`);
            
        } catch (error) {
            console.error('加载时间段数据失败:', error);
            
            if (error.message.includes('404') || this.timeslots.length === 0) {
                console.log('尝试初始化时间段数据...');
                await this.initializeTimeSlots();
            } else {
            alert(`加载时间段数据失败: ${error.message}`);
            this.timeslots = [];
            }
        }
    }
    
    /**
     * 渲染当前周的时间段
     */
    renderWeek() {
        try {
            console.log('渲染周视图...');
            
            // 更新当前周的显示
            const startDateStr = this.formatDateLocale(this.currentWeekStart);
            const endDateStr = this.formatDateLocale(this.addDays(this.currentWeekStart, 6));
            document.getElementById('currentWeek').textContent = `${startDateStr} - ${endDateStr}`;
            
            // 更新表头的日期显示
            const headerRow = document.querySelector('.timeslot-table thead tr');
            if (headerRow) {
                const headers = headerRow.querySelectorAll('th');
                if (headers.length >= 8) {  // 第一列是时间标签，后面7列是周一到周日
                    // 定义星期几的中文名称
                    const weekdayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
                    
                    for (let i = 0; i < 7; i++) {
                        const date = this.addDays(this.currentWeekStart, i);
                        const dayOfWeek = weekdayNames[i]; // 直接使用索引获取星期名称
                        
                        // 获取日期部分（日）
                        const day = date.getDate();
                        const month = date.getMonth() + 1;
                        
                        // 设置表头文本
                        headers[i + 1].textContent = `${dayOfWeek} (${month}月${day}日)`;
                        
                        // 调试信息
                        console.log(`设置表头 ${i + 1}: ${dayOfWeek} (${month}月${day}日)`);
                    }
                }
            }
            
            // 生成时间段表格内容
            this.renderTimeslotTable();
            
        } catch (error) {
            console.error('渲染周视图失败:', error);
        }
    }
    
    /**
     * 渲染时间段表格
     */
    renderTimeslotTable() {
        console.log('开始渲染时间段表格...');
        console.log('可用的时间段数据:', this.timeslots);
        
        // 获取表格主体
        const tableBody = document.querySelector('.timeslot-table tbody');
        if (!tableBody) {
            console.error('未找到表格主体元素');
            return;
        }
        
        // 清空表格内容
        tableBody.innerHTML = '';
        
        // 定义时间段范围（9:00-18:00，每30分钟一个时间段）
        const timeSlots = [];
        for (let hour = 9; hour <= 18; hour++) {
            for (let minute of [0, 30]) {
                if (hour === 18 && minute === 30) continue; // 跳过18:30
                timeSlots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
            }
        }
        
        console.log('生成的时间段列表:', timeSlots);
        
        // 为每个时间段创建行
        timeSlots.forEach((timeSlot, index) => {
            // 计算结束时间（当前时间段 + 30分钟）
            let endTimeSlot;
            if (index < timeSlots.length - 1) {
                endTimeSlot = timeSlots[index + 1];
            } else {
                // 最后一个时间段特殊处理
                const [hour, minute] = timeSlot.split(':').map(Number);
                const endHour = hour + (minute + 30) / 60 | 0;
                const endMinute = (minute + 30) % 60;
                endTimeSlot = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
            }
            
            // 显示格式：开始时间-结束时间
            const displayTimeSlot = `${timeSlot}-${endTimeSlot}`;
            
            const row = document.createElement('tr');
            
            // 添加时间标签列
            const timeCell = document.createElement('td');
            timeCell.textContent = displayTimeSlot;
            timeCell.className = 'time-label';
            row.appendChild(timeCell);
            
            // 添加每天的时间段单元格
            for (let i = 0; i < 7; i++) {
                const date = this.addDays(this.currentWeekStart, i);
                const dateStr = this.formatDate(date);
                
                const cell = document.createElement('td');
                
                // 查找该日期和时间的时间段数据
                let timeslot = this.findTimeslotByDateAndTime(dateStr, timeSlot);
                
                // 如果没有找到对应的时间段数据，创建一个默认的时间段对象
                if (!timeslot) {
                    timeslot = {
                        date: dateStr,
                        time: timeSlot,
                        is_available: true, // 默认可用
                        has_booking: false
                    };
                        
                    // 将新创建的时间段添加到时间段列表中
                    this.timeslots.push(timeslot);
                    console.log(`为 ${dateStr} ${timeSlot} 创建默认时间段`);
                }
                
                // 创建时间段元素
                const timeslotElement = document.createElement('div');
                
                // 确定时间段状态类型
                let statusClass = 'unavailable';
                let statusText = '不可用';
                
                if (timeslot) {
                    if (timeslot.has_booking) {
                        statusClass = 'booked';
                        statusText = '已预约';
                    } else if (timeslot.is_available) {
                        statusClass = 'available';
                        statusText = '可预约';
                    }
                }
                
                timeslotElement.className = `timeslot ${statusClass}`;
                timeslotElement.dataset.date = dateStr;
                timeslotElement.dataset.time = timeSlot;
                timeslotElement.dataset.available = timeslot && timeslot.is_available ? 'true' : 'false';
                
                // 添加状态标签
                const statusElement = document.createElement('div');
                statusElement.className = 'slot-status';
                statusElement.textContent = statusText;
                timeslotElement.appendChild(statusElement);
                
                // 如果有预约，显示客户信息
                if (timeslot && timeslot.has_booking && timeslot.booking && timeslot.booking.user) {
                    const bookingInfoElement = document.createElement('div');
                    bookingInfoElement.className = 'booking-info';
                    bookingInfoElement.innerHTML = `
                        <i class="fas fa-user"></i> ${timeslot.booking.user.username || '客户'}
                    `;
                    timeslotElement.appendChild(bookingInfoElement);
                    
                    // 添加点击事件查看预约详情
                    timeslotElement.addEventListener('click', (e) => {
                        if (e.target.closest('button')) return;
                        this.viewBookingDetails(dateStr, timeSlot);
                    });
                }
                
                // 添加操作按钮
                const actionsElement = document.createElement('div');
                actionsElement.className = 'slot-actions';
                
                if (timeslot && timeslot.is_available) {
                    // 可预约的时间段
                    actionsElement.innerHTML = `
                        <button class="btn-slot-block" title="禁用"><i class="fas fa-ban"></i></button>
                    `;
                } else {
                    // 不可用的时间段
                    actionsElement.innerHTML = `
                        <button class="btn-slot-enable" title="启用"><i class="fas fa-check"></i></button>
                    `;
                }
                
                timeslotElement.appendChild(actionsElement);
                
                cell.appendChild(timeslotElement);
                row.appendChild(cell);
            }
            
            tableBody.appendChild(row);
        });
        
        console.log('时间段表格渲染完成');
        
        // 添加CSS样式
        this.addCustomStyles();
    }
    
    /**
     * 添加自定义样式
     */
    addCustomStyles() {
        // 检查是否已存在样式
        if (document.getElementById('timeslot-custom-styles')) {
            return;
        }
        
        // 创建样式元素
        const styleElement = document.createElement('style');
        styleElement.id = 'timeslot-custom-styles';
        styleElement.textContent = `
            .loading-message {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(0, 0, 0, 0.5);
                color: white;
                display: flex;
                justify-content: center;
                align-items: center;
                font-size: 18px;
                z-index: 9999;
            }
            
            .timeslot.available {
                background-color: #e6f7e6;
                border: 1px solid #28a745;
            }
            
            .timeslot.unavailable {
                background-color: #f8d7da;
                border: 1px solid #dc3545;
            }
            
            .timeslot .slot-status {
                font-weight: bold;
                text-align: center;
                padding: 5px;
            }
            
            .timeslot.available .slot-status {
                color: #28a745;
            }
            
            .timeslot.unavailable .slot-status {
                color: #dc3545;
            }
        `;
        
        // 添加到文档头部
        document.head.appendChild(styleElement);
    }
    
    /**
     * 检查是否需要初始化时间段
     * @returns {boolean} 是否需要初始化
     */
    shouldInitializeTimeSlots() {
        // 检查当前周是否有时间段数据
        const startDate = this.formatDate(this.currentWeekStart);
        const endDate = this.formatDate(this.addDays(this.currentWeekStart, 6));
        
        // 检查每一天是否有时间段
        for (let i = 0; i < 7; i++) {
            const date = this.formatDate(this.addDays(this.currentWeekStart, i));
            const hasTimeslots = this.timeslots.some(slot => {
                const slotDate = typeof slot.date === 'string' ? 
                    (slot.date.includes('T') ? slot.date.split('T')[0] : slot.date) : 
                    this.formatDate(new Date(slot.date));
                return slotDate === date;
            });
            
            if (!hasTimeslots) {
                console.log(`日期 ${date} 没有时间段数据，需要初始化`);
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * 初始化时间段数据
     */
    async initializeTimeSlots() {
        try {
            console.log('开始初始化时间段数据...');
            
            // 获取认证令牌
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('未登录或会话已过期');
            }
            
            // 准备初始化数据
            const timeSlotsToCreate = [];
            
            // 为当前周的每一天创建时间段
            for (let i = 0; i < 7; i++) {
                const date = this.addDays(this.currentWeekStart, i);
                const dateStr = this.formatDate(date);
                
                // 工作日(1-5)创建9:00-18:00的时间段，周末(6-7)创建10:00-16:00的时间段
                const dayOfWeek = date.getDay(); // 0是周日，1-6是周一到周六
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                
                const startHour = isWeekend ? 10 : 9;
                const endHour = isWeekend ? 16 : 18;
                
                // 生成时间段
                for (let hour = startHour; hour <= endHour; hour++) {
                    for (let minute of [0, 30]) {
                        if (hour === endHour && minute === 30) continue; // 跳过最后半小时
                        
                        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                        
                        // 检查该时间段是否已存在
                        const exists = this.timeslots.some(slot => {
                            const slotDate = typeof slot.date === 'string' ? 
                                (slot.date.includes('T') ? slot.date.split('T')[0] : slot.date) : 
                                this.formatDate(new Date(slot.date));
                            return slotDate === dateStr && slot.time === time;
                        });
                        
                        if (!exists) {
                            timeSlotsToCreate.push({
                                date: dateStr,
                                time: time,
                                is_available: true
                            });
                        }
                    }
                }
            }
            
            // 如果没有需要创建的时间段，直接返回
            if (timeSlotsToCreate.length === 0) {
                console.log('没有需要初始化的时间段');
                return;
            }
            
            console.log(`需要初始化 ${timeSlotsToCreate.length} 个时间段:`, timeSlotsToCreate);
            
            // 发送API请求创建时间段（确保保存到MySQL数据库）
            console.log('发送请求到MySQL数据库API: POST /api/timeslots');
            const response = await fetch('/api/timeslots', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(timeSlotsToCreate)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('初始化时间段失败:', errorText);
                throw new Error(`初始化时间段失败: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('成功初始化时间段到MySQL数据库:', result);
            
            // 记录详细的创建和更新信息
            if (result.created && result.created.length > 0) {
                console.log('新创建的时间段:', result.created);
            }
            
            if (result.updated && result.updated.length > 0) {
                console.log('更新的时间段:', result.updated);
            }
            
            // 重新加载时间段数据
            await this.loadTimeslots();
            
            // 显示成功消息
            const createdCount = result.created ? result.created.length : 0;
            const updatedCount = result.updated ? result.updated.length : 0;
            
            if (createdCount > 0 || updatedCount > 0) {
                alert(`成功初始化时间段数据：创建了 ${createdCount} 个时间段，更新了 ${updatedCount} 个时间段`);
            }
            
            console.log(`成功初始化 ${createdCount} 个时间段，更新 ${updatedCount} 个时间段`);
            
        } catch (error) {
            console.error('初始化时间段失败:', error);
            alert(`初始化时间段失败: ${error.message}`);
        }
    }
    
    /**
     * 导航到上一周或下一周
     * @param {number} delta - 周数变化量，-1表示上一周，1表示下一周
     */
    navigateWeek(delta) {
        this.currentWeekStart = this.addDays(this.currentWeekStart, delta * 7);
        this.loadTimeslots().then(() => {
            this.renderWeek();
        });
    }
    
    /**
     * 跳转到当前周
     */
    goToCurrentWeek() {
        this.currentWeekStart = this.getStartOfWeek(new Date());
        this.loadTimeslots().then(() => {
            this.renderWeek();
        });
    }
    
    /**
     * 应用工作模式
     * @param {string} pattern - 工作模式，如'weekdays', 'everyday', 'weekends', 'custom'
     */
    applyWorkingPattern(pattern) {
        console.log(`应用工作模式: ${pattern}`);
        
        // 显示工作模式设置模态框
        const modal = document.getElementById('patternModal');
        if (!modal) return;
        
        // 设置工作模式
        document.getElementById('patternType').value = pattern;
        
        // 根据工作模式显示或隐藏自定义日期选择
        const customDaysContainer = document.getElementById('customDaysContainer');
        if (customDaysContainer) {
            customDaysContainer.style.display = pattern === 'custom' ? 'block' : 'none';
        }
        
        // 根据选择的模式设置默认的开始和结束周几
        const startDayRadios = document.querySelectorAll('input[name="startDay"]');
        const endDayRadios = document.querySelectorAll('input[name="endDay"]');
        
        // 重置所有选择
        startDayRadios.forEach(radio => radio.checked = false);
        endDayRadios.forEach(radio => radio.checked = false);
        
        // 根据模式设置默认值
        if (pattern === 'weekdays') {
            // 周一到周五
            this.setRadioByValue(startDayRadios, '1'); // 周一
            this.setRadioByValue(endDayRadios, '5');   // 周五
        } else if (pattern === 'weekends') {
            // 周六到周日
            this.setRadioByValue(startDayRadios, '6'); // 周六
            this.setRadioByValue(endDayRadios, '0');   // 周日
        } else if (pattern === 'everyday') {
            // 每天（周一到周日）
            this.setRadioByValue(startDayRadios, '1'); // 周一
            this.setRadioByValue(endDayRadios, '0');   // 周日
        } else {
            // 自定义，默认选择周一到周五
            this.setRadioByValue(startDayRadios, '1'); // 周一
            this.setRadioByValue(endDayRadios, '5');   // 周五
        }
        
        // 设置默认时间
        document.getElementById('patternStartTime').value = '09:00';
        document.getElementById('patternEndTime').value = '18:30';
        
        // 显示模态框
        modal.style.display = 'block';
    }
    
    /**
     * 根据值设置单选按钮
     * @param {NodeList} radios - 单选按钮列表
     * @param {string} value - 要设置的值
     */
    setRadioByValue(radios, value) {
        for (const radio of radios) {
            if (radio.value === value) {
                radio.checked = true;
                break;
            }
        }
    }
    
    /**
     * 保存工作模式设置
     */
    async saveWorkingPattern() {
        try {
            const pattern = document.getElementById('patternType').value;
            const startTime = document.getElementById('patternStartTime').value;
            const endTime = document.getElementById('patternEndTime').value;
            const interval = parseInt(document.getElementById('patternInterval').value) || 30;
            
            // 获取选中的开始和结束周几
            const startDayRadios = document.querySelectorAll('input[name="startDay"]');
            const endDayRadios = document.querySelectorAll('input[name="endDay"]');
            
            let startDay = '1'; // 默认周一
            let endDay = '5';   // 默认周五
            
            for (const radio of startDayRadios) {
                if (radio.checked) {
                    startDay = radio.value;
                    break;
                }
            }
            
            for (const radio of endDayRadios) {
                if (radio.checked) {
                    endDay = radio.value;
                    break;
                }
            }
            
            console.log(`选择的开始日: ${startDay}, 结束日: ${endDay}`);
            
            // 使用当前周的日期范围，而不是计算未来的日期
            // 这样可以确保应用到当前显示的周
            const startDate = new Date(this.currentWeekStart);
            const endDate = new Date(this.currentWeekStart);
            endDate.setDate(startDate.getDate() + 6); // 当前周的结束日期（+6天）
            
            // 格式化日期为YYYY-MM-DD
            const formatDate = (date) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };
            
            const formattedStartDate = formatDate(startDate);
            const formattedEndDate = formatDate(endDate);
            
            console.log(`当前周开始日期: ${formattedStartDate}, 结束日期: ${formattedEndDate}`);
            
            // 更新隐藏的日期输入字段（以便后端处理）
            document.getElementById('patternStartDate').value = formattedStartDate;
            document.getElementById('patternEndDate').value = formattedEndDate;
            
            // 验证输入
            if (!pattern || !startTime || !endTime) {
                alert('请填写所有必填字段');
                return;
            }
            
            // 生成工作时间内的时间段
            const workingTimeSlots = this.generateTimeSlots(startTime, endTime, interval);
            console.log('工作时间内的时间段:', workingTimeSlots);
            
            // 生成所有可能的时间段
            const allTimeSlots = this.generateAllTimeSlots();
            console.log('所有可能的时间段:', allTimeSlots);
            
            // 找出工作时间外的时间段（所有时间段减去工作时间内的时间段）
            const nonWorkingTimeSlots = allTimeSlots.filter(time => !workingTimeSlots.includes(time));
            console.log('工作时间外的时间段:', nonWorkingTimeSlots);
            
            // 准备请求数据
            const requestData = {
                pattern,
                start_date: formattedStartDate,
                end_date: formattedEndDate,
                time_slots: workingTimeSlots,
                non_working_time_slots: nonWorkingTimeSlots
            };
            
            // 如果是自定义模式，添加选中的日期
            if (pattern === 'custom') {
                const days = [];
                const dayCheckboxes = document.querySelectorAll('.custom-day:checked');
                dayCheckboxes.forEach(checkbox => {
                    days.push(checkbox.value);
                });
                
                if (days.length === 0) {
                    alert('请至少选择一天');
                    return;
                }
                
                requestData.days = days;
            }
            
            // 获取认证令牌
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('未登录或会话已过期');
            }

            console.log('应用工作模式请求数据:', requestData);
            console.log('使用的认证令牌:', token.substring(0, 10) + '...');
            
            // 显示加载中提示
            const loadingMessage = document.createElement('div');
            loadingMessage.className = 'loading-message';
            loadingMessage.textContent = '正在应用工作模式，请稍候...';
            document.body.appendChild(loadingMessage);
            
            try {
            // 发送API请求
            const response = await fetch('/api/timeslots/pattern', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                    body: JSON.stringify(requestData),
                    cache: 'no-cache'
            });
            
            console.log('应用工作模式响应状态:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('应用工作模式错误响应:', errorText);
                try {
                    const errorData = JSON.parse(errorText);
                    throw new Error(errorData.message || `应用工作模式失败: ${response.status}`);
                } catch (jsonError) {
                    throw new Error(`应用工作模式失败: ${response.status} - ${errorText}`);
                }
            }
            
            const result = await response.json();
            console.log('成功应用工作模式:', result);
            
            // 关闭模态框
            document.getElementById('patternModal').style.display = 'none';
            
                // 从响应中提取创建、更新和禁用的数量
                let createdCount = 0;
                let updatedCount = 0;
                let disabledCount = 0;
                
                // 尝试从 message 中提取数量
                const message = result.message || '';
                const createdMatch = message.match(/创建\s+(\d+)\s+个/);
                const updatedMatch = message.match(/更新\s+(\d+)\s+个/);
                const disabledMatch = message.match(/禁用\s+(\d+)\s+个/);
                
                if (createdMatch && createdMatch[1]) {
                    createdCount = parseInt(createdMatch[1]);
                }
                
                if (updatedMatch && updatedMatch[1]) {
                    updatedCount = parseInt(updatedMatch[1]);
                }
                
                if (disabledMatch && disabledMatch[1]) {
                    disabledCount = parseInt(disabledMatch[1]);
                }
                
                // 如果 message 中没有找到，尝试直接从响应中获取
                if (isNaN(createdCount)) {
                    createdCount = result.created_count || 0;
                }
                
                if (isNaN(updatedCount)) {
                    updatedCount = result.updated_count || 0;
                }
                
                if (isNaN(disabledCount)) {
                    disabledCount = result.disabled_count || 0;
                }
                
                // 清空当前时间段数据，强制重新加载
                this.timeslots = [];
                
                // 等待一秒，确保后端数据已更新
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // 重新加载时间段数据并渲染
            await this.loadTimeslots();
                
                // 显示成功消息
                let successMessage = `成功应用工作模式，创建了 ${createdCount} 个时间段，更新了 ${updatedCount} 个时间段`;
                if (disabledCount > 0) {
                    successMessage += `，禁用了 ${disabledCount} 个时间段`;
                }
                alert(successMessage);
            } finally {
                // 移除加载中提示
                if (loadingMessage && loadingMessage.parentNode) {
                    loadingMessage.parentNode.removeChild(loadingMessage);
                }
            }
            
        } catch (error) {
            console.error('应用工作模式失败:', error);
            alert(`应用工作模式失败: ${error.message}`);
        }
    }
    
    /**
     * 生成时间段数组
     * @param {string} startTime - 开始时间，格式为HH:MM
     * @param {string} endTime - 结束时间，格式为HH:MM
     * @param {number} interval - 时间间隔，单位为分钟
     * @returns {Array} 时间段数组
     */
    generateTimeSlots(startTime, endTime, interval) {
        const timeSlots = [];
        
        // 解析开始和结束时间
        const [startHour, startMinute] = startTime.split(':').map(Number);
        const [endHour, endMinute] = endTime.split(':').map(Number);
        
        // 转换为分钟
        let currentMinutes = startHour * 60 + startMinute;
        const endMinutes = endHour * 60 + endMinute;
        
        // 生成时间段
        while (currentMinutes < endMinutes) {
            const hour = Math.floor(currentMinutes / 60);
            const minute = currentMinutes % 60;
            timeSlots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
            currentMinutes += interval;
        }
        
        return timeSlots;
    }
    
    /**
     * 生成所有可能的时间段数组（9:00-18:30）
     * @returns {Array} 所有可能的时间段数组
     */
    generateAllTimeSlots() {
        const timeSlots = [];
        
        // 从9:00到18:30，每30分钟一个时间段
        for (let hour = 9; hour <= 18; hour++) {
            for (let minute of [0, 30]) {
                // 跳过18:30
                if (hour === 18 && minute === 30) continue;
                timeSlots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
            }
        }
        
        return timeSlots;
    }
    
    /**
     * 显示添加时间段模态框
     */
    showAddTimeSlotsModal() {
        console.log('显示添加时间段模态框');
        
        // 显示模态框
        const modal = document.getElementById('addTimeSlotsModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }
    
    /**
     * 保存添加的时间段
     */
    async saveTimeSlots() {
        try {
            // 获取表单数据
            const date = document.getElementById('addDate').value;
            const startTime = document.getElementById('addStartTime').value;
            const endTime = document.getElementById('addEndTime').value;
            const interval = parseInt(document.getElementById('addInterval').value) || 30;
            
            // 验证输入
            if (!date || !startTime || !endTime) {
                alert('请填写所有必填字段');
                return;
            }
            
            // 确保日期格式正确 (YYYY-MM-DD)
            const dateObj = new Date(date);
            if (isNaN(dateObj.getTime())) {
                alert('日期格式无效，请使用YYYY-MM-DD格式');
                return;
            }
            
            // 格式化日期为YYYY-MM-DD，确保与MySQL兼容
            const formattedDate = this.formatDate(dateObj);
            console.log('格式化后的日期:', formattedDate);
            
            // 生成时间段
            const timeSlots = this.generateTimeSlots(startTime, endTime, interval);
            console.log('生成的时间段:', timeSlots);
            
            // 准备请求数据
            const requestData = timeSlots.map(time => ({
                date: formattedDate,
                time,
                is_available: true
            }));
            
            // 获取认证令牌
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('未登录或会话已过期');
            }

            console.log('添加时间段请求数据:', requestData);
            console.log('使用的认证令牌:', token.substring(0, 10) + '...');
            
            // 发送API请求
            const response = await fetch('/api/timeslots', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(requestData)
            });
            
            console.log('添加时间段响应状态:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('添加时间段错误响应:', errorText);
                try {
                    const errorData = JSON.parse(errorText);
                    throw new Error(errorData.message || `添加时间段失败: ${response.status}`);
                } catch (jsonError) {
                    throw new Error(`添加时间段失败: ${response.status} - ${errorText}`);
                }
            }
            
            const result = await response.json();
            console.log('成功添加时间段:', result);
            
            // 关闭模态框
            document.getElementById('addTimeSlotsModal').style.display = 'none';
            
            // 重新加载时间段数据
            await this.loadTimeslots();
            this.renderWeek();
            
            // 显示成功消息，确保显示正确的创建和更新数量
            const createdCount = result.created ? result.created.length : 0;
            const updatedCount = result.updated ? result.updated.length : 0;
            alert(`成功添加 ${createdCount} 个时间段，更新 ${updatedCount} 个时间段`);
            
        } catch (error) {
            console.error('添加时间段失败:', error);
            alert(`添加时间段失败: ${error.message}`);
        }
    }
    
    /**
     * 显示编辑时间段模态框
     * @param {string} date - 日期
     * @param {string} time - 时间段
     */
    showEditTimeSlotModal(date, time) {
        console.log(`显示编辑时间段模态框: ${date} ${time}`);
        // TODO: 实现编辑时间段的模态框显示逻辑
    }
    
    /**
     * 禁用时间段
     * @param {string} date - 日期
     * @param {string} time - 时间段
     */
    async blockTimeSlot(date, time) {
        try {
            console.log(`禁用时间段: ${date} ${time}`);
            
            // 获取认证令牌
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('未登录或会话已过期');
            }
            
            // 确保日期格式正确 (YYYY-MM-DD)
            let formattedDate = date;
            if (date.includes('/') || date.includes('T')) {
                const dateObj = new Date(date);
                if (!isNaN(dateObj.getTime())) {
                    formattedDate = this.formatDate(dateObj);
                }
            }
            console.log(`格式化后的日期: ${formattedDate}`);
            
            // 发送API请求禁用时间段
            const response = await fetch(`/api/timeslots/${formattedDate}/${time}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    is_available: false
                })
            });
            
            if (!response.ok) {
                throw new Error(`禁用时间段失败: ${response.status}`);
            }
            
            // 获取响应数据
            const result = await response.json();
            console.log('禁用时间段响应:', result);
            
            // 重新加载数据以确保与数据库同步
            await this.loadTimeslots();
            this.renderWeek();
            
            // 显示成功消息
            alert(`成功禁用时间段: ${formattedDate} ${time}`);
            
        } catch (error) {
            console.error('禁用时间段失败:', error);
            alert(`禁用时间段失败: ${error.message}`);
        }
    }
    
    /**
     * 启用时间段
     * @param {string} date - 日期
     * @param {string} time - 时间段
     */
    async enableTimeSlot(date, time) {
        try {
            console.log(`启用时间段: ${date} ${time}`);
            
            // 获取认证令牌
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('未登录或会话已过期');
            }
            
            // 确保日期格式正确 (YYYY-MM-DD)
            let formattedDate = date;
            if (date.includes('/') || date.includes('T')) {
                const dateObj = new Date(date);
                if (!isNaN(dateObj.getTime())) {
                    formattedDate = this.formatDate(dateObj);
                }
            }
            console.log(`格式化后的日期: ${formattedDate}`);
            
            // 发送API请求启用时间段
            const response = await fetch(`/api/timeslots/${formattedDate}/${time}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    is_available: true
                })
            });
            
            if (!response.ok) {
                throw new Error(`启用时间段失败: ${response.status}`);
            }
            
            // 获取响应数据
            const result = await response.json();
            console.log('启用时间段响应:', result);
            
            // 重新加载数据以确保与数据库同步
            await this.loadTimeslots();
            this.renderWeek();
            
            // 显示成功消息
            alert(`成功启用时间段: ${formattedDate} ${time}`);
            
        } catch (error) {
            console.error('启用时间段失败:', error);
            alert(`启用时间段失败: ${error.message}`);
        }
    }
    
    /**
     * 查看预约详情
     * @param {string} date - 日期
     * @param {string} time - 时间段
     */
    async viewBookingDetails(date, time) {
        try {
        console.log(`查看预约详情: ${date} ${time}`);
            
            // 获取认证令牌
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('未登录或会话已过期');
            }
            
            // 确保日期格式正确 (YYYY-MM-DD)
            let formattedDate = date;
            if (date.includes('/') || date.includes('T')) {
                const dateObj = new Date(date);
                if (!isNaN(dateObj.getTime())) {
                    formattedDate = this.formatDate(dateObj);
                }
            }
            console.log(`格式化后的日期: ${formattedDate}`);
            
            // 发送API请求获取预约详情
            const response = await fetch(`/api/bookings/${formattedDate}/${time}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('获取预约详情失败:', errorText);
                throw new Error(`获取预约详情失败: ${response.status}`);
            }
            
            const booking = await response.json();
            console.log('预约详情:', booking);
            
            // 显示预约详情模态框
            const modal = document.getElementById('bookingDetailsModal');
            if (modal) {
                modal.style.display = 'block';
            
                // 填充模态框内容
                document.getElementById('bookingDate').textContent = booking.date;
                document.getElementById('bookingTime').textContent = booking.time;
                document.getElementById('bookingUser').textContent = booking.user ? booking.user.username : '未知客户';
                document.getElementById('bookingStatus').textContent = booking.status;
                document.getElementById('bookingNotes').textContent = booking.notes || '无备注';
                
                // 格式化日期和时间
                document.getElementById('bookingDate').textContent = this.formatDateLocale(new Date(booking.date));
                document.getElementById('bookingTime').textContent = booking.time;
                
                // 添加关闭按钮事件
                const closeBtn = modal.querySelector('.close-btn');
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => {
                        modal.style.display = 'none';
                    });
                }
            }
            
        } catch (error) {
            console.error('查看预约详情失败:', error);
            alert(`查看预约详情失败: ${error.message}`);
        }
    }
    
    /**
     * 批量禁用时间段
     */
    async showBatchDisableModal() {
        try {
            console.log('显示批量禁用模态框');
        
            // 显示确认对话框
            const confirmed = confirm('确定要批量禁用当前周的可用时间段吗？');
            if (!confirmed) {
                console.log('用户取消了批量禁用操作');
                return;
    }
    
            // 调用批量禁用方法
            await this.batchDisableTimeslots();
            
        } catch (error) {
            console.error('批量禁用时间段失败:', error);
            alert(`批量禁用时间段失败: ${error.message}`);
        }
    }
    
    /**
     * 批量禁用时间段
     */
    async batchDisableTimeslots() {
        try {
            console.log('开始批量禁用时间段...');
            
            // 获取认证令牌
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('未登录或会话已过期');
    }
    
            // 获取当前周的开始和结束日期（确保格式为YYYY-MM-DD）
            const startDate = this.formatDate(this.currentWeekStart);
            const endDate = this.formatDate(this.addDays(this.currentWeekStart, 6));
            console.log(`批量禁用日期范围: ${startDate} 至 ${endDate}`);
        
            // 获取可用的时间段
            const availableTimeslots = this.timeslots.filter(slot => slot.is_available);
            
        if (availableTimeslots.length === 0) {
            alert('没有可禁用的时间段');
            return;
        }
        
            console.log(`将禁用 ${availableTimeslots.length} 个时间段`);
        
            // 准备时间段数据
            const timeslotsData = availableTimeslots.map(slot => {
                // 确保日期格式为 YYYY-MM-DD
                let dateStr = slot.date;
                if (typeof dateStr === 'string' && dateStr.includes('T')) {
                    dateStr = dateStr.split('T')[0];
                } else if (dateStr instanceof Date) {
                    dateStr = this.formatDate(dateStr);
                }
                
                return {
                    date: dateStr,
                    time: slot.time
                };
            });
            
            console.log('准备发送的时间段数据:', timeslotsData);
        
            // 准备请求数据 - 按照后端API要求提供 timeslots 和 is_available 参数
            const requestData = {
                timeslots: timeslotsData,
                is_available: false // 禁用时间段
            };
        
            // 发送API请求批量禁用时间段
            console.log('发送请求到MySQL数据库API: PUT /api/timeslots/batch');
            console.log('请求数据:', JSON.stringify(requestData));
            
            const response = await fetch('/api/timeslots/batch', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(requestData),
                // 添加缓存控制，确保请求不被缓存
                cache: 'no-cache'
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('批量禁用时间段失败:', errorText);
                throw new Error(`批量禁用时间段失败: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('批量禁用时间段成功:', result);
            
            // 等待一秒，确保后端数据已更新
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 重新加载时间段数据
            await this.loadTimeslots();
            this.renderWeek();
            
            // 显示成功消息
            const updatedCount = result.updated || 0;
            const createdCount = result.created || 0;
            alert(`成功批量禁用时间段：更新 ${updatedCount} 个，创建 ${createdCount} 个`);
            
        } catch (error) {
            console.error('批量禁用时间段失败:', error);
            alert(`批量禁用时间段失败: ${error.message}`);
        }
    }
    
    /**
     * 批量启用时间段
     */
    async showBatchEnableModal() {
        try {
            console.log('显示批量启用模态框');
            
            // 显示确认对话框
            const confirmed = confirm('确定要批量启用当前周的不可用时间段吗？');
            if (!confirmed) {
                console.log('用户取消了批量启用操作');
                return;
            }
            
            // 调用批量启用方法
            await this.batchEnableTimeslots();
            
        } catch (error) {
            console.error('批量启用时间段失败:', error);
            alert(`批量启用时间段失败: ${error.message}`);
        }
    }
    
    /**
     * 批量启用时间段
     */
    async batchEnableTimeslots() {
        try {
            console.log('开始批量启用时间段...');
            
            // 获取认证令牌
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('未登录或会话已过期');
            }
            
            // 获取当前周的开始和结束日期（确保格式为YYYY-MM-DD）
            const startDate = this.formatDate(this.currentWeekStart);
            const endDate = this.formatDate(this.addDays(this.currentWeekStart, 6));
            console.log(`批量启用日期范围: ${startDate} 至 ${endDate}`);
            
            // 获取不可用的时间段
            const unavailableTimeslots = this.timeslots.filter(slot => !slot.is_available);
            
            if (unavailableTimeslots.length === 0) {
                alert('没有可启用的时间段');
                return;
            }
            
            console.log(`将启用 ${unavailableTimeslots.length} 个时间段`);
            
            // 准备时间段数据
            const timeslotsData = unavailableTimeslots.map(slot => {
                // 确保日期格式为 YYYY-MM-DD
                let dateStr = slot.date;
                if (typeof dateStr === 'string' && dateStr.includes('T')) {
                    dateStr = dateStr.split('T')[0];
                } else if (dateStr instanceof Date) {
                    dateStr = this.formatDate(dateStr);
                }
                
                return {
                    date: dateStr,
                    time: slot.time
                };
            });
            
            console.log('准备发送的时间段数据:', timeslotsData);
            
            // 准备请求数据 - 按照后端API要求提供 timeslots 和 is_available 参数
            const requestData = {
                timeslots: timeslotsData,
                is_available: true // 启用时间段
            };
            
            // 发送API请求批量启用时间段
            console.log('发送请求到MySQL数据库API: PUT /api/timeslots/batch');
            console.log('请求数据:', JSON.stringify(requestData));
            
            const response = await fetch('/api/timeslots/batch', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(requestData),
                // 添加缓存控制，确保请求不被缓存
                cache: 'no-cache'
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('批量启用时间段失败:', errorText);
                throw new Error(`批量启用时间段失败: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('批量启用时间段成功:', result);
            
            // 等待一秒，确保后端数据已更新
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 重新加载时间段数据
            await this.loadTimeslots();
            this.renderWeek();
            
            // 显示成功消息
            const updatedCount = result.updated || 0;
            const createdCount = result.created || 0;
            alert(`成功批量启用时间段：更新 ${updatedCount} 个，创建 ${createdCount} 个`);
            
            // 移除对不存在方法的调用
            // await this.debugTimeslots();
            
        } catch (error) {
            console.error('批量启用时间段失败:', error);
            alert(`批量启用时间段失败: ${error.message}`);
        }
    }
    
    /**
     * 查找特定日期和时间的时间段
     * @param {string} dateStr - 日期字符串，格式为YYYY-MM-DD
     * @param {string} timeSlot - 时间字符串，格式为HH:MM
     * @returns {Object|null} 找到的时间段对象，如果没找到则返回null
     */
    findTimeslotByDateAndTime(dateStr, timeSlot) {
        console.log(`查找时间段: 日期=${dateStr}, 时间=${timeSlot}`);
        
        // 确保时间段数据已加载
        if (!this.timeslots || this.timeslots.length === 0) {
            console.warn('时间段数据为空，无法查找');
            return null;
        }
        
        // 标准化日期格式
        const normalizedDateStr = dateStr && dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
        
        // 查找匹配的时间段
        const result = this.timeslots.find(slot => {
            // 标准化时间段日期格式
            let slotDate = '';
            
            if (!slot.date) {
                console.warn('时间段没有日期属性:', slot);
                return false;
            }
            
            if (typeof slot.date === 'string') {
                // 如果是字符串，确保格式为YYYY-MM-DD
                slotDate = slot.date.includes('T') ? slot.date.split('T')[0] : slot.date;
            } else if (slot.date instanceof Date) {
                // 如果是Date对象，转换为YYYY-MM-DD格式
                try {
                    slotDate = this.formatDate(slot.date);
                } catch (e) {
                    console.error('无法格式化日期对象:', slot.date, e);
                    return false;
                }
            } else {
                // 其他情况，尝试转换为Date对象再格式化
                try {
                    slotDate = this.formatDate(new Date(slot.date));
                } catch (e) {
                    console.error('无法解析日期:', slot.date, e);
                    return false;
                }
            }
            
            // 比较日期和时间
            const isMatch = slotDate === normalizedDateStr && slot.time === timeSlot;
            
            if (isMatch) {
                console.log('找到匹配的时间段:', slot);
            }
            
            return isMatch;
        });
        
        if (!result) {
            console.log(`未找到匹配的时间段: 日期=${normalizedDateStr}, 时间=${timeSlot}`);
        }
        
        return result;
    }
    
    /**
     * 格式化日期为YYYY-MM-DD
     * @param {Date} date - 日期对象
     * @returns {string} 格式化后的日期字符串
     */
    formatDate(date) {
        if (!date) {
            console.warn('尝试格式化空日期');
            return '';
        }
        
        try {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch (error) {
            console.error('日期格式化失败:', error, date);
            return '';
        }
    }
    
    /**
     * 格式化日期为本地化字符串 (YYYY-MM-DD)
     * @param {Date} date - 日期对象
     * @returns {string} 本地化日期字符串
     */
    formatDateLocale(date) {
        if (!date) {
            console.warn('尝试格式化空日期');
            return '';
        }
        
        try {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch (error) {
            console.error('日期本地化格式化失败:', error, date);
            return '';
        }
    }
    
    /**
     * 获取一周的开始日期 (周一)
     * @param {Date} date - 当前日期
     * @returns {Date} 一周的开始日期
     */
    getStartOfWeek(date) {
        const day = date.getDay(); // 0是周日，1是周一，6是周六
        const diff = day === 0 ? 6 : day - 1; // 如果是周日，则向前推6天；否则向前推1天
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - diff);
        return startOfWeek;
    }
    
    /**
     * 添加天数到日期
     * @param {Date} date - 基准日期
     * @param {number} days - 要添加的天数
     * @returns {Date} 新的日期
     */
    addDays(date, days) {
        const result = new Date(date);
        result.setDate(date.getDate() + days);
        return result;
    }
    
    /**
     * 获取当前日期是星期几 (1-7)
     * @param {Date} date - 日期对象
     * @returns {number} 星期几 (1-7)
     */
    getDayOfWeek(date) {
        const day = date.getDay(); // 0是周日，1是周一，6是周六
        return day === 0 ? 7 : day; // 将周日转换为7
    }
    
    /**
     * 调试时间段状态
     */
    // async debugTimeslots() {
    //     try {
    //         console.log('调试时间段状态...');
            
    //         // 获取认证令牌
    //         const token = localStorage.getItem('token');
    //         if (!token) {
    //             throw new Error('未登录或会话已过期');
    //         }
            
    //         // 计算当前周的开始和结束日期
    //         const startDate = this.formatDate(this.currentWeekStart);
    //         const endDate = this.formatDate(this.addDays(this.currentWeekStart, 6));
            
    //         // 发送调试请求
    //         const response = await fetch(`/api/debug/timeslots?start_date=${startDate}&end_date=${endDate}`, {
    //             method: 'GET',
    //             headers: {
    //                 'Authorization': `Bearer ${token}`
    //             }
    //         });
            
    //         if (!response.ok) {
    //             throw new Error(`调试请求失败: ${response.status}`);
    //         }
            
    //         const result = await response.json();
    //         console.log('调试结果:', result);
            
    //         // 检查每天的时间段状态
    //         const dateKeys = Object.keys(result.timeslots_by_date || {});
    //         console.log(`找到 ${dateKeys.length} 天的时间段数据`);
            
    //         for (const date of dateKeys) {
    //             const slots = result.timeslots_by_date[date];
    //             const availableCount = slots.filter(slot => slot.is_available).length;
    //             const unavailableCount = slots.filter(slot => !slot.is_available).length;
                
    //             console.log(`日期 ${date}: 共 ${slots.length} 个时间段，可用 ${availableCount} 个，不可用 ${unavailableCount} 个`);
    //         }
            
    //         return result;
    //     } catch (error) {
    //         console.error('调试时间段失败:', error);
    //         return null;
    //     }
    // }
}

// 确保DOM加载完成后再初始化
document.addEventListener('DOMContentLoaded', () => {
    new TimeSlotManagement();
});
