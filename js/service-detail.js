// 数据检查和格式化辅助函数
function ensureString(value) {
    if (value === undefined || value === null) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

// 确保ID总是字符串类型
function formatId(id) {
    return ensureString(id);
}

// 获取URL参数
function getUrlParams() {
    const params = {};
    const queryString = window.location.search.substring(1);
    const pairs = queryString.split('&');
    
    for (let pair of pairs) {
        if (pair === '') continue;
        const [key, value] = pair.split('=');
        params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    }
    
    return params;
}

// 显示提示消息
function showToast(message, type = 'success') {
    // 移除已有的toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    // 创建新toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    // 添加样式 - 更小更简洁的样式
    toast.style.cssText = `
        position: fixed;
        bottom: 3%;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'error' ? 'rgba(220, 53, 69, 0.65)' : 
                    type === 'warning' ? 'rgba(255, 193, 7, 0.65)' : 
                    'rgba(40, 167, 69, 0.65)'};
        color: white;
        padding: 0.25rem 0.5rem;
        border-radius: 6px;
        font-size: 0.7rem;
        z-index: 1001;
        opacity: 0;
        transition: opacity 0.3s ease;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        max-width: 40%;
        text-align: center;
    `;
    
    document.body.appendChild(toast);
    
    // 显示动画
    setTimeout(() => {
        toast.style.opacity = '1';
    }, 10);
    
    // 自动隐藏 - 减少显示时间到1秒
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 200);
    }, 1000);
}

// 创建预约
async function createBooking(bookingData) {
    try {
        // 验证和记录请求数据
        console.log('创建预约请求数据:', JSON.stringify(bookingData));
        
        if (!bookingData.service_id || !bookingData.provider_id || !bookingData.date || !bookingData.time) {
            console.error('预约数据不完整:', bookingData);
            const missingFields = [];
            if (!bookingData.service_id) missingFields.push('服务ID');
            if (!bookingData.provider_id) missingFields.push('提供商ID');
            if (!bookingData.date) missingFields.push('日期');
            if (!bookingData.time) missingFields.push('时间');
            throw new Error('预约数据不完整: ' + missingFields.join(', '));
        }
        
        // 获取认证令牌
        const token = localStorage.getItem('token');
        if (!token) {
            alert('请先登录');
            window.location.href = 'index.html';
            return;
        }
        
        // 发送请求
        const response = await fetch('/api/bookings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(bookingData)
        });
        
        const data = await response.json();
        console.log('预约API响应:', data);
        
        if (!response.ok) {
            throw new Error(data.message || '预约失败');
        }

        // 显示成功提示
        window.hideBookingModal();
        showToast('预约成功！');

        // 保存新预约数据到localStorage，以便预约详情页面使用
        if (data.booking) {
            // 获取服务和提供商详情
            const serviceId = bookingData.service_id;
            
            try {
                // 使用API端点获取服务详情
                const serviceResponse = await fetch(`/api/services/public/${serviceId}`, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                if (!serviceResponse.ok) {
                    throw new Error('获取服务详情失败');
                }
                
                const serviceData = await serviceResponse.json();
                console.log('预约成功后获取的服务详情:', serviceData);
                
                // 处理日期格式 - 数据库返回的日期格式为 YYYY-MM-DD
                let bookingDate = data.booking.date;
                if (typeof bookingDate === 'string' && bookingDate.includes('T')) {
                    bookingDate = bookingDate.split('T')[0];
                }
                
                // 合并数据
                const newBooking = {
                    ...data.booking,
                    date: bookingDate,
                    service: serviceData
                };
                
                // 服务提供商信息应该包含在serviceData对象中
                if (serviceData && serviceData.provider) {
                    newBooking.provider = serviceData.provider;
                }
                
                console.log('保存到localStorage的预约数据:', newBooking);
                
                // 保存到localStorage
                localStorage.setItem('newBooking', JSON.stringify(newBooking));
            } catch (error) {
                console.error('获取服务或提供商详情失败:', error);
            }
        }

        // 延迟跳转到预约详情页
        setTimeout(() => {
            window.location.href = 'appointment-detail.html?id=' + (data.booking ? data.booking.id : 'new');
        }, 1500);
    } catch (error) {
        console.error('创建预约失败:', error);
        alert('预约失败: ' + error.message);
    }
}

// 预约弹窗相关函数 - 确保全局可访问
// showBookingModal函数用于显示预约弹窗
window.showBookingModal = function() {
    console.log('显示预约弹窗');
    const modal = document.getElementById('bookingModal');
    if (!modal) {
        console.error('找不到预约弹窗元素');
        return;
    }
    
    document.body.style.overflow = 'hidden';
    modal.classList.add('active');
    
    // 自动选择第一个日期选项
    setTimeout(() => {
        const firstDateOption = document.querySelector('.date-option');
        if (firstDateOption) {
            firstDateOption.click(); // 触发点击事件，会自动加载时间段
        }
    }, 100);
};

// hideBookingModal函数用于隐藏预约弹窗
window.hideBookingModal = function() {
    console.log('隐藏预约弹窗');
    const modal = document.getElementById('bookingModal');
    if (!modal) {
        console.error('找不到预约弹窗元素');
        return;
    }
    
    document.body.style.overflow = '';
    modal.classList.remove('active');
};

// confirmBooking函数用于确认预约
window.confirmBooking = function() {
    console.log('确认预约');
    const selectedDateElement = document.querySelector('.date-option.selected');
    const selectedTimeElement = document.querySelector('.time-option.selected');
    const notesElement = document.querySelector('.booking-notes textarea');
    
    const selectedDate = selectedDateElement ? selectedDateElement.dataset.date : null;
    const selectedTime = selectedTimeElement ? selectedTimeElement.dataset.time : null;
    const notes = notesElement ? notesElement.value : '';

    if (!selectedDate || !selectedTime) {
        alert('请选择预约日期和时间');
        return;
    }

    // 从预约按钮获取服务ID和提供商ID
    const bookButton = document.querySelector('.btn-book');
    let serviceId = '';
    let providerId = '';

    if (bookButton) {
        serviceId = formatId(bookButton.dataset.serviceId);
        providerId = formatId(bookButton.dataset.providerId);
    }

    // 如果按钮上没有，再尝试从URL参数获取
    if (!serviceId || !providerId) {
        const params = getUrlParams();
        if (!serviceId) serviceId = formatId(params.id);
        if (!providerId) providerId = formatId(params.provider);
    }

    // 如果还是没有providerId，尝试从全局变量获取
    if (!providerId && window.currentService && window.currentService.provider) {
        providerId = formatId(window.currentService.provider.id);
    }
    
    console.log('预约信息:', {
        serviceId,
        providerId,
        selectedDate,
        selectedTime,
        notes
    });

    // 验证必要字段
    if (!serviceId) {
        alert('无法获取服务ID，请刷新页面重试');
        return;
    }
    
    if (!providerId) {
        alert('无法获取服务提供商ID，请刷新页面重试');
        return;
    }
    
    // 禁用确认按钮，防止重复提交
    const confirmButton = document.querySelector('.btn-confirm');
    if (confirmButton) {
        confirmButton.disabled = true;
        confirmButton.textContent = '预约中...';
    }
    
    // 创建预约数据
    const bookingData = {
        service_id: serviceId,
        provider_id: providerId,
        date: selectedDate,
        time: selectedTime,
        notes: notes || ''
    };
    
    // 调用API创建预约
    createBooking(bookingData).finally(() => {
        // 无论成功或失败，恢复按钮状态
        if (confirmButton) {
            confirmButton.disabled = false;
            confirmButton.textContent = '确认预约';
        }
    });
};

class ServiceDetail {
    constructor() {
        try {
            console.log('初始化ServiceDetail组件');
            
            // 检查必要的DOM元素是否存在
            if (!document.querySelector('.gallery-container')) {
                console.warn('图库容器不存在，跳过图库初始化');
            } else {
                this.initializeGallery();
            }
            
            if (!document.querySelector('.date-list') && !document.querySelector('.time-list')) {
                console.warn('预约日期/时间列表不存在，跳过预约初始化');
            } else {
                this.initializeBooking();
            }
            
            if (!document.querySelector('.animate-in')) {
                console.warn('动画元素不存在，跳过动画初始化');
            } else {
                this.initializeAnimations();
            }
            
            this.initializeEventListeners();
            console.log('ServiceDetail组件初始化完成');
        } catch (error) {
            console.error('ServiceDetail初始化失败:', error);
        }
    }

    initializeGallery() {
        try {
            console.log('初始化图库');
            
            this.currentSlide = 0;
            this.slides = document.querySelectorAll('.gallery-container img');
            this.dots = document.querySelectorAll('.gallery-dots .dot');
            
            console.log(`找到${this.slides.length}张图片和${this.dots.length}个导航点`);
            
            // 检查图片和导航点是否存在
            if (!this.slides || this.slides.length === 0) {
                console.warn('图库中没有找到图片');
                return;
            }
            
            if (!this.dots || this.dots.length === 0) {
                console.warn('图库中没有找到导航点');
            }
            
            // 确保至少有一张图片是激活状态
            let hasActiveSlide = false;
            this.slides.forEach(slide => {
                if (slide.classList.contains('active')) {
                    hasActiveSlide = true;
                }
            });
            
            if (!hasActiveSlide && this.slides.length > 0) {
                console.log('没有找到激活的图片，设置第一张为激活');
                this.slides[0].classList.add('active');
            }
            
            // 自动轮播（只有多于一张图片时才启用）
            if (this.slides.length > 1) {
                setInterval(() => this.nextSlide(), 5000);
            }

            // 添加触摸滑动支持
            const gallery = document.querySelector('.service-gallery');
            if (!gallery) {
                console.warn('没有找到.service-gallery元素，跳过触摸滑动功能');
                return;
            }
            
            let startX, moveX;

            gallery.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
            });

            gallery.addEventListener('touchmove', (e) => {
                moveX = e.touches[0].clientX;
            });

            gallery.addEventListener('touchend', () => {
                if (!startX || !moveX) return;
                
                if (startX - moveX > 50) { // 向左滑动
                    this.nextSlide();
                } else if (moveX - startX > 50) { // 向右滑动
                    this.prevSlide();
                }
            });
            
            console.log('图库初始化完成');
        } catch (error) {
            console.error('初始化图库失败:', error);
        }
    }

    nextSlide() {
        if (!this.slides.length) return;
        this.showSlide(this.currentSlide + 1);
    }

    prevSlide() {
        if (!this.slides.length) return;
        this.showSlide(this.currentSlide - 1);
    }

    showSlide(index) {
        if (!this.slides.length) return;
        
        // 处理循环
        if (index >= this.slides.length) index = 0;
        if (index < 0) index = this.slides.length - 1;

        // 更新当前索引
        this.currentSlide = index;

        // 更新图片显示
        this.slides.forEach((slide, i) => {
            slide.style.transform = `translateX(${100 * (i - index)}%)`;
        });

        // 更新圆点状态
        this.dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });
    }

    initializeBooking() {
        // 生成日期选项
        const dateList = document.querySelector('.date-list');
        if (dateList) {
            const dates = this.generateDates();
            dateList.innerHTML = dates.map(date => `
                <div class="date-option" data-date="${date.value}">
                    <div class="day">${date.day}</div>
                    <div class="date">${date.date}</div>
                </div>
            `).join('');
            
            // 添加日期选择事件监听
            document.querySelectorAll('.date-option').forEach(option => {
                option.addEventListener('click', async () => {
                    document.querySelectorAll('.date-option').forEach(opt => 
                        opt.classList.remove('selected'));
                    option.classList.add('selected');
                    
                    // 获取选中的日期
                    const selectedDate = option.dataset.date;
                    if (!selectedDate) return;
                    
                    try {
                        // 显示加载状态
                        const timeList = document.querySelector('.time-list');
                        if (timeList) {
                            timeList.innerHTML = '<div class="loading-times">加载中...</div>';
                        }
                        
                        // 获取该日期的可用时间段
                        const providerId = window.currentService?.provider?.id;
                        const serviceId = window.currentService?.id;
                        
                        if (!providerId) {
                            throw new Error('无法获取提供商ID');
                        }
                        
                        // 从API获取可用时间段
                        const response = await fetch(`/api/provider/${providerId}/available-timeslots?date=${selectedDate}&service_id=${serviceId || ''}`, {
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            cache: 'no-cache' // 确保获取最新数据
                        });
                        
                        if (!response.ok) {
                            throw new Error(`获取时间段失败: ${response.status}`);
                        }
                        
                        const data = await response.json();
                        console.log('API返回的可用时间段数据:', data);
                        
                        // 更新时间选项
                        if (timeList) {
                            if (!data.available_times || data.available_times.length === 0) {
                                timeList.innerHTML = '<div class="no-times">当日无可用时间段</div>';
                            } else {
                                timeList.innerHTML = data.available_times.map(time => `
                                    <div class="time-option" data-time="${time}">
                                        ${time}
                                    </div>
                                `).join('');
                                
                                // 重新绑定时间选择事件
                                document.querySelectorAll('.time-option').forEach(opt => {
                                    opt.addEventListener('click', () => {
                                        document.querySelectorAll('.time-option').forEach(o => 
                                            o.classList.remove('selected'));
                                        opt.classList.add('selected');
                                    });
                                });
                            }
                        }
                    } catch (error) {
                        console.error('获取时间段失败:', error);
                        const timeList = document.querySelector('.time-list');
                        if (timeList) {
                            timeList.innerHTML = '<div class="error-times">获取时间段失败，请重试</div>';
                        }
                    }
                });
            });
        }

        // 生成时间选项
        const timeList = document.querySelector('.time-list');
        if (timeList) {
            this.generateTimeSlots().then(times => {
                timeList.innerHTML = times.map(time => `
                    <div class="time-option" data-time="${time.value}">
                        ${time.label}
                    </div>
                `).join('');
            });
        }
    }

    generateTimeSlots(selectedDate) {
        try {
            // 如果没有选择日期，使用默认时间段
            if (!selectedDate) {
                const times = [];
                const startHour = 9;
                const endHour = 18;

                for (let hour = startHour; hour <= endHour; hour++) {
                    for (let minute of ['00', '30']) {
                        const time = `${hour.toString().padStart(2, '0')}:${minute}`;
                        times.push({
                            value: time,
                            label: time
                        });
                    }
                }
                return Promise.resolve(times);
            }
            
            // 获取当前服务的提供商ID
            const providerId = window.currentService?.provider?.id;
            if (!providerId) {
                console.error('无法获取提供商ID');
                // 无法获取提供商ID时，返回默认时间段而不是抛出错误
                return Promise.resolve(this.generateDefaultTimeSlots(selectedDate));
            }
            
            // 获取当前服务ID
            const serviceId = window.currentService?.id;
            
            // 从API获取可用时间段
            console.log(`获取提供商 ${providerId} 在 ${selectedDate} 的可用时间段`);
            
            // 直接使用主应用的API，避免跨域问题
            return fetch(`/api/provider/${providerId}/available-timeslots?date=${selectedDate}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                cache: 'no-cache' // 确保获取最新数据
            })
            .then(response => {
                if (!response.ok) {
                    console.warn(`获取时间段失败: ${response.status}，将使用默认时间段`);
                    // 如果API返回错误，使用默认时间段
                    return this.generateDefaultTimeSlots(selectedDate);
                }
                return response.json();
            })
            .then(data => {
                console.log('API返回的可用时间段数据:', data);
                
                // 转换API返回的数据格式
                if (data.available_times && Array.isArray(data.available_times)) {
                    if (data.available_times.length === 0) {
                        console.log('该日期没有可用时间段，使用默认时间段');
                        return this.generateDefaultTimeSlots(selectedDate);
                    }
                    return data.available_times.map(time => ({
                        value: time,
                        label: time
                    }));
                } else {
                    console.warn('API返回的数据格式不正确:', data);
                    return this.generateDefaultTimeSlots(selectedDate);
                }
            })
            .catch(error => {
                console.error('API请求失败:', error);
                return this.generateDefaultTimeSlots(selectedDate);
            });
        } catch (error) {
            console.error('获取时间段失败:', error);
            // 出错时返回默认时间段
            return Promise.resolve(this.generateDefaultTimeSlots(selectedDate));
        }
    }
    
    // 生成默认时间段
    generateDefaultTimeSlots(selectedDate) {
            const times = [];
            const startHour = 9;
        const endHour = 17;
        
        // 检查是否是今天或过去的日期
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selectedDateObj = new Date(selectedDate);
        selectedDateObj.setHours(0, 0, 0, 0);
        
        // 如果是过去的日期，返回空数组
        if (selectedDateObj < today) {
            return [];
        }
        
        // 如果是今天，只返回当前时间之后的时间段
        const isToday = selectedDateObj.getTime() === today.getTime();
        const currentHour = new Date().getHours();
        const currentMinute = new Date().getMinutes();

            for (let hour = startHour; hour <= endHour; hour++) {
            for (let minute of [0, 30]) {
                // 如果是今天，跳过已经过去的时间段
                if (isToday && (hour < currentHour || (hour === currentHour && minute <= currentMinute))) {
                    continue;
                }
                
                const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                    times.push({
                    value: timeStr,
                    label: timeStr
                    });
                }
            }
        
            return times;
    }

    generateDates() {
        const dates = [];
        const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const today = new Date();

        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            
            dates.push({
                value: date.toISOString().split('T')[0],
                day: days[date.getDay()],
                date: `${date.getMonth() + 1}/${date.getDate()}`
            });
        }

        return dates;
    }

    initializeAnimations() {
        // 添加滚动动画
        const animateItems = document.querySelectorAll('.animate-in');
        if (!animateItems.length) return;
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.animationDelay = '0.2s';
                    entry.target.style.animationPlayState = 'running';
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1
        });

        animateItems.forEach(item => {
            item.style.animationPlayState = 'paused';
            observer.observe(item);
        });
    }

    initializeEventListeners() {
        // 收藏按钮
        const favoriteBtn = document.querySelector('.btn-favorite');
        if (favoriteBtn) {
            favoriteBtn.addEventListener('click', async () => {
                try {
                    // 检查用户是否已登录
                    const token = localStorage.getItem('token');
                    if (!token) {
                        showToast('请先登录后再收藏', 'warning');
                        return;
                    }
                    
                const icon = favoriteBtn.querySelector('i');
                    const serviceId = favoriteBtn.dataset.serviceId;
                    
                    if (!serviceId) {
                        showToast('无法获取服务ID', 'error');
                        return;
                    }
                    
                    // 禁用按钮，防止重复点击
                    favoriteBtn.disabled = true;
                    
                    if (icon.classList.contains('far')) {
                        // 添加收藏
                        const response = await fetch('/api/favorites', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ service_id: serviceId })
                        });
                        
                        if (response.ok) {
                            // 更新图标
                            icon.classList.remove('far');
                            icon.classList.add('fas');
                            icon.style.color = '#ff4d4f';
                            showToast('收藏成功', 'success');
                        } else {
                            throw new Error('添加收藏失败');
                        }
                    } else {
                        // 取消收藏
                        const response = await fetch(`/api/favorites/${serviceId}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });
                        
                        if (response.ok) {
                            // 更新图标
                            icon.classList.remove('fas');
                            icon.classList.add('far');
                            icon.style.color = '#666';
                            showToast('已取消收藏', 'success');
                        } else {
                            throw new Error('取消收藏失败');
                        }
                    }
                } catch (error) {
                    console.error('收藏操作失败:', error);
                    showToast('操作失败，请稍后再试', 'error');
                } finally {
                    // 恢复按钮
                    favoriteBtn.disabled = false;
                }
            });
        }

        // 日期选择
        document.querySelector('.date-list')?.addEventListener('click', async (e) => {
            const dateOption = e.target.closest('.date-option');
            if (dateOption) {
                // 更新选中状态
                document.querySelectorAll('.date-option').forEach(opt => 
                    opt.classList.remove('selected'));
                dateOption.classList.add('selected');
                
                // 获取选中的日期
                const selectedDate = dateOption.dataset.date;
                if (!selectedDate) return;
                
                try {
                    // 显示加载状态
                    const timeList = document.querySelector('.time-list');
                    if (timeList) {
                        timeList.innerHTML = '<div class="loading-times">加载中...</div>';
                    }
                    
                    // 获取该日期的可用时间段
                    const times = await this.generateTimeSlots(selectedDate);
                    
                    // 更新时间选项
                    if (timeList) {
                        if (times.length === 0) {
                            timeList.innerHTML = '<div class="no-times">当日无可用时间段</div>';
                        } else {
                            timeList.innerHTML = times.map(time => `
                                <div class="time-option" data-time="${time.value}">
                                    ${time.label}
                                </div>
                            `).join('');
                            
                            // 重新绑定时间选择事件
                            document.querySelectorAll('.time-option').forEach(opt => {
                                opt.addEventListener('click', () => {
                                    document.querySelectorAll('.time-option').forEach(o => 
                                        o.classList.remove('selected'));
                                    opt.classList.add('selected');
                                });
                            });
                        }
                    }
                } catch (error) {
                    console.error('获取时间段失败:', error);
                    const timeList = document.querySelector('.time-list');
                    if (timeList) {
                        timeList.innerHTML = '<div class="error-times">获取时间段失败，请重试</div>';
                    }
                }
            }
        });

        // 时间选择
        document.querySelector('.time-list')?.addEventListener('click', (e) => {
            const timeOption = e.target.closest('.time-option');
            if (timeOption) {
                document.querySelectorAll('.time-option').forEach(opt => 
                    opt.classList.remove('selected'));
                timeOption.classList.add('selected');
            }
        });
    }
}

// 显示服务不存在页面
function showServiceNotFound(message = "抱歉，您查找的服务不存在或已被删除。") {
    // 更新页面内容
    document.querySelector('.detail-container').innerHTML = `
        <div class="service-not-found">
            <h2>服务不存在</h2>
            <p>${message}</p>
            <button class="btn-primary" onclick="window.location.href='search.html'">返回服务列表</button>
        </div>
    `;
    
    // 隐藏底部预约按钮
    const bookingBar = document.querySelector('.booking-bar');
    if (bookingBar) {
        bookingBar.style.display = 'none';
    }
    
    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
        .service-not-found {
            text-align: center;
            padding: 50px 20px;
            margin: 20px auto;
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .service-not-found h2 {
            color: #333;
            margin-bottom: 20px;
        }
        .service-not-found p {
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

// 从服务器获取服务详情
async function fetchServiceDetails(serviceId, providerId) {
    try {
        // 确保ID是字符串格式
        serviceId = formatId(serviceId);
        providerId = providerId ? formatId(providerId) : null;
        
        console.log('获取服务详情, 格式化后的ID:', {serviceId, providerId});
        
        // 构建API URL
        let apiUrl = `/api/services/public/${serviceId}`;
        
        console.log('请求URL:', apiUrl);
        
        // 发起API请求获取服务详情
        const serviceResponse = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            // 避免使用缓存
            cache: 'no-store'
        });
        
        console.log('API响应状态:', serviceResponse.status);
        
        if (!serviceResponse.ok) {
            if (serviceResponse.status === 404) {
                console.error('服务不存在，状态码:', serviceResponse.status);
                showServiceNotFound();
                return null;
            }
            
            const errorText = await serviceResponse.text();
            console.error('API错误:', serviceResponse.status, errorText);
            throw new Error(`获取服务详情失败: ${serviceResponse.status} ${errorText}`);
        }
        
        // 解析服务数据
        const serviceData = await serviceResponse.json();
        console.log('API返回的服务数据:', serviceData);
        
        if (!serviceData || (Array.isArray(serviceData) && serviceData.length === 0)) {
            console.error('未找到服务数据');
            showServiceNotFound();
            return null;
        }
        
        // 处理服务数据，确保数据结构正确
        const service = Array.isArray(serviceData) ? serviceData[0] : serviceData;
        
        // 检查服务数据的完整性
        if (!service.title) {
            console.warn('服务数据缺少标题');
            service.title = '未知服务';
        }
        
        // 如果服务对象中没有提供商信息，显示警告
        if (!service.provider) {
            console.warn('服务对象中缺少提供商信息');
        }
        
        return service;
    } catch (error) {
        console.error('获取服务详情失败:', error);
        showServiceNotFound("获取服务详情时出错: " + error.message);
        return null;
    }
}

// 更新服务详情
async function updateServiceDetail(service) {
    if (!service) {
        console.error('服务数据为空，无法更新页面');
        return;
    }
    
    // 将当前服务保存为全局变量，便于其他函数使用
    window.currentService = service;
    console.log('正在更新服务详情页面:', service);

    // 更新页面标题
    document.title = `${service.title} - 在线预约平台`;

    // 更新服务名称
    const titleElement = document.querySelector('.service-header h1');
    if (titleElement) {
        titleElement.textContent = service.title || '未知服务';
    }
    
    // 更新服务提供者信息
    const providerNameElement = document.querySelector('.provider-details h2');
    if (providerNameElement && service.provider) {
        providerNameElement.textContent = service.provider.business_name || 
                                         service.provider.username || 
                                         '未知服务商';
    }
    
    // 更新评分
    const ratingElement = document.querySelector('.rating span');
    if (ratingElement) {
        ratingElement.textContent = service.rating ? parseFloat(service.rating).toFixed(1) : '0.0';
    }
    
    // 更新评价数量
    const reviewsElement = document.querySelector('.reviews');
    if (reviewsElement) {
        reviewsElement.textContent = `(${service.reviews_count || 0}条评价)`;
    }
    
    // 更新价格
    const priceElement = document.querySelector('.price');
    if (priceElement) {
        priceElement.innerHTML = `¥${service.price || 0}<span>/${service.price_unit || '次'}</span>`;
    }
    
    // 更新底部预约栏中的价格信息
    const currentPriceElement = document.querySelector('.current-price');
    if (currentPriceElement) {
        currentPriceElement.textContent = `¥${service.price || 0}`;
    }
    
    const priceUnitElement = document.querySelector('.price-unit');
    if (priceUnitElement) {
        priceUnitElement.textContent = `/${service.price_unit || '次'}`;
    }
    
    // 更新服务时长
    const durationElement = document.querySelector('.detail-item:nth-child(1) .item-info p');
    if (durationElement) {
        durationElement.textContent = `${service.duration || 60}分钟`;
    }
    
    // 更新服务介绍
    const descriptionContentElement = document.querySelector('.description-content p');
    if (descriptionContentElement) {
        descriptionContentElement.textContent = service.description || '暂无介绍';
    }
    
    // 更新图库
    const galleryContainer = document.querySelector('.gallery-container');
    if (galleryContainer) {
        // 处理服务图片
        let serviceImages = [];
        
        // 首先尝试使用service.images属性
        if (service.images) {
            if (typeof service.images === 'string') {
                // 尝试解析JSON字符串
                try {
                    serviceImages = JSON.parse(service.images);
                } catch (e) {
                    // 如果解析失败，假设它是单个图片URL
                    serviceImages = [service.images];
                }
            } else if (Array.isArray(service.images)) {
                serviceImages = service.images;
            }
        } 
        // 如果没有images属性，使用image属性
        else if (service.image) {
            serviceImages = [service.image];
        }
        
        // 如果没有任何图片，使用默认图片
        if (!serviceImages.length) {
            serviceImages = ['img/service-placeholder.jpg'];
        }
        
        // 更新图库HTML
        galleryContainer.innerHTML = serviceImages.map((image, index) => 
            `<img src="${image}" alt="${service.title}" class="${index === 0 ? 'active' : ''}" onerror="this.src='img/service-placeholder.jpg'">`
        ).join('');
        
        // 更新圆点导航
        const dotsContainer = document.querySelector('.gallery-dots');
        if (dotsContainer) {
            dotsContainer.innerHTML = serviceImages.map((_, i) => 
                `<span class="dot ${i === 0 ? 'active' : ''}"></span>`
            ).join('');
        }
        
        // 重新初始化图库
        const serviceDetail = new ServiceDetail();
    }
    
    // 更新预约按钮数据
    const bookButton = document.querySelector('.btn-book');
    if (bookButton) {
        bookButton.dataset.serviceId = formatId(service.id);
        
        if (service.provider && service.provider.id) {
            bookButton.dataset.providerId = formatId(service.provider.id);
        } else {
            console.warn('服务提供商信息不完整');
        }
    }
    
    // 如果有服务评价，更新评价区域
    if (service.reviews && service.reviews.length > 0) {
        const reviewsList = document.querySelector('.reviews-list');
        if (reviewsList) {
            reviewsList.innerHTML = service.reviews.slice(0, 3).map(review => `
                <div class="review-item">
                    <div class="reviewer-info">
                        <img src="${review.user?.avatar || 'img/avatar-placeholder.jpg'}" alt="用户头像" class="reviewer-avatar">
                        <div class="reviewer-details">
                            <h4>${review.user?.username || '匿名用户'}</h4>
                            <div class="review-stars">
                                ${Array(Math.floor(review.rating || 0)).fill('<i class="fas fa-star"></i>').join('')}
                                ${review.rating % 1 >= 0.5 ? '<i class="fas fa-star-half-alt"></i>' : ''}
                                ${Array(5 - Math.ceil(review.rating || 0)).fill('<i class="far fa-star"></i>').join('')}
                            </div>
                        </div>
                        <div class="review-date">${review.created_at ? new Date(review.created_at).toLocaleDateString() : '未知日期'}</div>
                    </div>
                    <p class="review-content">${review.content || '未提供评价内容'}</p>
                </div>
            `).join('');
        }
    }
}

// 初始化页面
async function initializePage() {
    try {
        // 获取URL参数
        const params = getUrlParams();
        const serviceId = params.id;
        const providerId = params.provider;
        const isRebook = params.rebook === 'true';
        
        console.log('初始化服务详情页面，URL参数:', params);
        
        // 检查必需的服务ID
        if (!serviceId) {
            console.error('URL中缺少服务ID参数');
            showServiceNotFound("未提供服务ID");
            return;
        }
        
        // 显示加载状态
        const container = document.querySelector('.detail-container');
        if (container) {
            container.classList.add('loading');
        }
        
        // 获取服务详情
        console.log('正在获取服务详情, serviceId:', serviceId, 'providerId:', providerId);
        const service = await fetchServiceDetails(serviceId, providerId);
        
        // 隐藏加载状态
        if (container) {
            container.classList.remove('loading');
        }
        
        if (!service) {
            console.error('未能获取服务详情');
            showServiceNotFound();
            return;
        }
        
        console.log('服务详情获取成功:', service);
        
        if (service.provider) {
            console.log('服务提供商信息:', service.provider);
        } else {
            console.warn('服务中缺少提供商信息');
        }
        
        // 更新页面内容
        await updateServiceDetail(service);
        
        // 如果是重新预约，自动打开预约弹窗
        if (isRebook) {
            setTimeout(() => {
                const bookButton = document.querySelector('.btn-book');
                if (bookButton) {
                    bookButton.click();
                }
            }, 1000);
        }
        
        // 初始化页面事件监听
        if (document.querySelector('.gallery-container')) {
            const serviceDetail = new ServiceDetail();
        }
        
    } catch (error) {
        console.error('页面初始化失败:', error);
        const container = document.querySelector('.detail-container');
        if (container) {
            container.classList.remove('loading');
        }
        showServiceNotFound("页面加载失败: " + error.message);
    }
}
    
// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('页面加载完成，开始初始化');
        
        // 初始化页面数据和内容
        initializePage().catch(err => {
            console.error('页面初始化出错:', err);
            showServiceNotFound("页面初始化失败: " + err.message);
        });
        
        // 不再在这里创建ServiceDetail实例，避免重复
        // 实例将在initializePage成功后创建
        
        // 显示用户名
        showUserName().catch(err => {
            console.error('获取用户名失败:', err);
        });
    } catch (error) {
        console.error('页面初始化过程中发生错误:', error);
    }
});

// 获取并显示用户名
async function showUserName() {
    const token = localStorage.getItem('token');
    if (!token) return;
    const res = await fetch('/api/user', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
        const user = await res.json();
        document.querySelectorAll('.user-name, .profile-name').forEach(el => {
            el.textContent = user.username;
        });
    }
}
showUserName(); 
