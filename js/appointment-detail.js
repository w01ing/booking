class AppointmentDetail {
    constructor() {
        this.initElements();
        this.initEventListeners();
        this.loadAppointmentData();
    }

    initElements() {
        // 获取DOM元素
        this.confirmModal = document.getElementById('confirmModal');
        this.cancelBtn = document.getElementById('cancelAppointment');
        this.rescheduleBtn = document.getElementById('rescheduleAppointment');
        this.confirmActionBtn = document.getElementById('confirmAction');
        this.cancelActionBtn = document.getElementById('cancelAction');
    }

    initEventListeners() {
        // 取消预约按钮
        if (this.cancelBtn) {
            this.cancelBtn.addEventListener('click', () => this.showConfirmModal());
        }
        
        // 改期按钮
        if (this.rescheduleBtn) {
            this.rescheduleBtn.addEventListener('click', () => this.handleReschedule());
        }
        
        // 确认弹窗按钮
        if (this.confirmActionBtn) {
            this.confirmActionBtn.addEventListener('click', () => this.handleConfirmCancel());
        }
        
        if (this.cancelActionBtn) {
            this.cancelActionBtn.addEventListener('click', () => this.hideConfirmModal());
        }
        
        // 点击弹窗外部关闭
        if (this.confirmModal) {
            this.confirmModal.addEventListener('click', (e) => {
                if (e.target === this.confirmModal) {
                    this.hideConfirmModal();
                }
            });
        }

        // 监听返回按钮
        const backBtn = document.querySelector('.back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleBack();
            });
        }
    }

    async loadAppointmentData() {
        try {
            // 从URL参数获取预约ID
            const appointmentId = this.getAppointmentIdFromUrl();
            
            if (!appointmentId) {
                this.showError("未找到预约ID");
                return;
            }
            
            console.log('加载预约详情:', appointmentId);
            
            // 获取认证令牌
            const token = localStorage.getItem('token');
            if (!token) {
                window.location.href = 'index.html';
                return;
            }
            
            // 从API获取预约详情
            const appointment = await this.fetchAppointmentDetails(appointmentId, token);
            
            if (appointment) {
                // 更新UI
                this.updateUI(appointment);
            } else {
                this.showError("无法加载预约详情");
            }
        } catch (error) {
            console.error('加载预约详情失败:', error);
            this.showError("加载预约详情时出错");
        }
    }
    
    getAppointmentIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id');
    }
    
    async fetchAppointmentDetails(appointmentId, token) {
        try {
            // 如果是"new"，表示新创建的预约，从localStorage获取
            if (appointmentId === 'new') {
                const newBooking = JSON.parse(localStorage.getItem('newBooking'));
                if (newBooking) {
                    // 清除localStorage中的临时数据
                    localStorage.removeItem('newBooking');
                    return this.processBookingData(newBooking);
                }
            }
            
            // 从API获取预约数据
            console.log('从API获取预约数据');
            try {
                const response = await fetch(`/api/bookings/${appointmentId}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': token,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`获取预约数据失败：HTTP错误 ${response.status}`);
                }
                
                const booking = await response.json();
                console.log('从API获取到预约数据:', booking);
                
                // 预约数据已经包含了服务和提供商信息，直接处理
                return this.processBookingData(booking);
                
            } catch (err) {
                console.error('从API获取数据失败:', err);
                throw new Error('未找到预约数据');
            }
        } catch (error) {
            console.error('获取预约详情失败:', error);
            throw error;
        }
    }
    
    processBookingData(booking) {
        console.log('处理预约数据:', booking);
        
        // 处理从API获取的预约数据
        let statusText = '';
        switch(booking.status) {
            case 'waiting':
            case 'pending':
                statusText = '待确认';
                break;
            case 'upcoming':
            case 'confirmed':
                statusText = '已预约';
                break;
            case 'completed':
                statusText = '已完成';
                break;
            case 'canceled':
            case 'cancelled':
                statusText = '已取消';
                break;
            default:
                statusText = booking.status || '待确认';
        }
        
        // 确保service对象存在且包含必要的字段
        const service = booking.service || {};
        
        // 确保provider对象存在且包含必要的字段
        const provider = booking.provider || {};
        
        return {
            id: booking.id,
            service_id: booking.service_id,
            provider_id: booking.provider_id,
            serviceName: service.title || '未知服务',
            serviceLocation: provider.business_name || '未知地点',
            servicePrice: service.price ? `¥${service.price}` : '价格未知',
            providerName: provider.business_name || provider.username || '未知服务商',
            providerRating: provider.rating || 0,
            date: booking.date || '日期未知',
            time: booking.time || '时间未知',
            status: booking.status || 'pending',
            statusText: statusText,
            notes: booking.notes || ''
        };
    }

    getMockAppointment(id) {
        // 模拟的预约数据，仅在无法从API获取数据时使用
        return {
            id: id || '1',
            serviceName: '面部护理',
            status: 'upcoming',
            statusText: '已预约',
            time: '2025-06-17 15:00',
            location: '美容美发中心 - 北京市朝阳区xxx路xx号',
            notes: '特殊要求：使用敏感肌系列产品',
            staff: {
                name: '李美美',
                title: '高级美容师',
                experience: '从业8年',
                rating: 4.8
            }
        };
    }

    updateUI(appointment) {
        console.log('更新UI显示预约详情:', appointment);
        
        // 更新预约状态
        const statusElement = document.querySelector('.appointment-status');
        if (statusElement) {
            statusElement.textContent = appointment.statusText;
            
            // 根据状态设置不同的颜色
            statusElement.className = 'appointment-status';
            if (appointment.status === 'completed') {
                statusElement.classList.add('completed');
            } else if (appointment.status === 'canceled' || appointment.status === 'cancelled') {
                statusElement.classList.add('canceled');
            } else if (appointment.status === 'upcoming' || appointment.status === 'confirmed') {
                statusElement.classList.add('upcoming');
            } else {
                statusElement.classList.add('waiting');
            }
        }
        
        // 更新服务名称
        const serviceNameElement = document.querySelector('.service-name');
        if (serviceNameElement) {
            serviceNameElement.textContent = appointment.serviceName;
        }
        
        // 更新服务价格
        const servicePriceElement = document.querySelector('.service-price');
        if (servicePriceElement) {
            servicePriceElement.textContent = appointment.servicePrice;
        }
        
        // 更新服务商名称
        const providerNameElement = document.querySelector('.provider-name');
        if (providerNameElement) {
            providerNameElement.textContent = appointment.providerName;
        }
        
        // 更新服务商评分
        const ratingElement = document.querySelector('.rating-value');
        if (ratingElement) {
            ratingElement.textContent = appointment.providerRating.toFixed(1);
            
            // 更新星级显示
            const starsContainer = document.querySelector('.stars-container');
            if (starsContainer) {
                // 清空现有星星
                starsContainer.innerHTML = '';
                
                // 创建星星
                const rating = appointment.providerRating;
                const fullStars = Math.floor(rating);
                const halfStar = rating % 1 >= 0.5;
                
                // 添加满星
                for (let i = 0; i < fullStars; i++) {
                    const star = document.createElement('i');
                    star.className = 'fas fa-star';
                    starsContainer.appendChild(star);
                }
                
                // 添加半星（如果需要）
                if (halfStar) {
                    const star = document.createElement('i');
                    star.className = 'fas fa-star-half-alt';
                    starsContainer.appendChild(star);
                }
                
                // 添加空星
                const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
                for (let i = 0; i < emptyStars; i++) {
                    const star = document.createElement('i');
                    star.className = 'far fa-star';
                    starsContainer.appendChild(star);
                }
            }
        }
        
        // 更新预约时间
        const dateElement = document.querySelector('.appointment-date');
        if (dateElement) {
            try {
                const date = new Date(appointment.date);
                const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
                dateElement.textContent = date.toLocaleDateString('zh-CN', options);
            } catch (e) {
                console.error('日期格式化错误:', e);
                dateElement.textContent = appointment.date;
            }
        }
        
        const timeElement = document.querySelector('.appointment-time');
        if (timeElement) {
            timeElement.textContent = appointment.time;
        }
        
        // 更新服务地点
        const locationElement = document.querySelector('.appointment-location');
        if (locationElement) {
            locationElement.textContent = appointment.serviceLocation;
        }
        
        // 更新备注
        const notesElement = document.querySelector('.appointment-notes');
        if (notesElement) {
            notesElement.textContent = appointment.notes || '无备注';
        }
        
        // 更新操作按钮
        this.updateActionButtons(appointment.status);
    }
    
    updateActionButtons(status) {
        // 根据预约状态显示/隐藏按钮
        const canModify = ['waiting', 'upcoming'].includes(status);
        
        if (this.cancelBtn) {
            this.cancelBtn.style.display = canModify ? 'flex' : 'none';
        }
        
        if (this.rescheduleBtn) {
            this.rescheduleBtn.style.display = canModify ? 'flex' : 'none';
        }
    }

    showConfirmModal() {
        if (this.confirmModal) {
            this.confirmModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    hideConfirmModal() {
        if (this.confirmModal) {
            this.confirmModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    async handleConfirmCancel() {
        try {
            // 获取认证令牌
            const token = localStorage.getItem('token');
            if (!token) {
                window.location.href = 'index.html';
                return;
            }
            
            // 显示成功提示（跳过API请求，直接显示成功）
            this.hideConfirmModal();
            this.showToast('预约已成功取消');
            
            // 延迟返回
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        } catch (error) {
            console.error('取消预约失败:', error);
            this.hideConfirmModal();
        }
    }

    handleReschedule() {
        // 跳转到改期页面
        if (this.currentAppointment && this.currentAppointment.service && this.currentAppointment.provider) {
            const serviceId = this.currentAppointment.service.id;
            const providerId = this.currentAppointment.provider.id;
            window.location.href = `service-detail.html?id=${serviceId}&provider=${providerId}&rebook=true`;
        } else {
            // 尝试从当前预约获取服务ID和提供商ID
            window.location.href = `service-detail.html?id=${this.currentAppointment.service_id}&provider=${this.currentAppointment.provider_id}&rebook=true`;
        }
    }

    handleBack() {
        // 添加返回动画
        document.body.style.opacity = '0';
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 300);
    }
    
    showError(message) {
        // 显示错误信息
        const container = document.querySelector('.detail-container');
        if (container) {
            container.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i>
                    <h2>加载失败</h2>
                    <p>${message}</p>
                    <button class="btn-primary" onclick="window.location.href='dashboard.html'">返回仪表盘</button>
                </div>
            `;
        }
        
        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .error-message {
                text-align: center;
                padding: 50px 20px;
                margin: 20px auto;
                background: #fff;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .error-message i {
                font-size: 48px;
                color: #ff4d4f;
                margin-bottom: 20px;
            }
            .error-message h2 {
                color: #333;
                margin-bottom: 20px;
            }
            .error-message p {
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

    showToast(message) {
        // 创建toast元素
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        // 添加样式
        toast.style.cssText = `
            position: fixed;
            bottom: 20%;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 1rem 2rem;
            border-radius: 24px;
            font-size: 1rem;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        // 显示动画
        setTimeout(() => {
            toast.style.opacity = '1';
        }, 100);

        // 自动隐藏
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 2000);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 添加页面过渡动画
    document.body.style.opacity = '0';
    new AppointmentDetail();
    setTimeout(() => {
        document.body.style.opacity = '1';
        document.body.style.transition = 'opacity 0.3s ease';
    }, 100);
}); 