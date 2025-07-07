/**
 * 服务管理功能
 */
class ServiceManagement {
    constructor() {
        // 检查用户是否已登录
        if (!checkAuth()) {
            console.error('用户未登录，无法访问服务管理页面');
            return;
        }
        
        // 获取用户信息
        this.currentUser = getCurrentUser();
        if (this.currentUser.userType !== 'provider') {
            console.error('非服务商用户无法访问服务管理页面');
            window.location.href = 'index.html';
            return;
        }
        
        // 服务数据
        this.services = [];
        this.currentFilter = 'all';
        this.editingServiceId = null;
        
        // 表单提交状态标志
        this.isFormSubmitting = false;
        
        // 互斥锁和节流控制
        this.locks = {
            create: false,
            update: false,
            delete: false,
            status: false
        };
        
        // 上次请求时间戳
        this.lastRequestTime = {
            create: 0,
            update: 0,
            delete: 0,
            status: 0
        };
        
        // 最小请求间隔(毫秒)
        this.minRequestInterval = 1000; // 1秒
        
        // 调试模式
        this.debug = true;
        
        // DOM元素
        this.serviceGrid = document.querySelector('.service-grid');
        this.filterButtons = document.querySelectorAll('.filter-btn');
        this.serviceModal = document.getElementById('serviceModal');
        this.serviceForm = document.getElementById('serviceForm');
        this.modalTitle = document.getElementById('modalTitle');

        // 验证必要的DOM元素是否存在
        if (!this.serviceModal) {
            console.error('找不到serviceModal元素，模态框可能无法正常工作');
        }
        
        if (!this.modalTitle) {
            console.error('找不到modalTitle元素，模态框标题可能无法正常更新');
        }
        
        if (!this.serviceForm) {
            console.error('找不到serviceForm元素，表单操作可能无法正常工作');
        }
        
        // 检查serviceGrid是否存在
        if (!this.serviceGrid) {
            console.error('找不到serviceGrid元素，服务列表可能无法正常显示');
            this.serviceGrid = document.createElement('div');
            document.body.appendChild(this.serviceGrid);
        }
        
        // 初始化
        this.initializeEventListeners();
        
        // 加载服务数据
        this.loadServices();

        // 强制释放所有锁 - 防止因为JS错误导致锁无法释放
        setInterval(() => {
            // 检查是否有长时间未释放的锁
            const now = Date.now();
            for (const key in this.locks) {
                if (this.locks[key] && now - this.lastRequestTime[key] > 10000) { // 10秒超时
                    console.warn(`🔓 强制释放长时间未释放的锁: ${key}`);
                    this.locks[key] = false;
                }
            }
        }, 5000); // 每5秒检查一次
    }
    
    /**
     * 初始化事件监听
     */
    initializeEventListeners() {
        // 移除已有的事件监听器，防止重复绑定
        this.removeExistingEventListeners();
        
        // 筛选按钮
        this.filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                const status = button.dataset.status;
                this.filterServices(status);
            });
        });
        
        // 创建服务按钮
        const addNewServiceCard = document.getElementById('addNewService');
        if (addNewServiceCard) {
            console.log('为"创建新服务"卡片添加点击事件监听');
            
            // 移除旧的事件监听器（如果有）
            const oldAddNewService = addNewServiceCard.cloneNode(true);
            addNewServiceCard.parentNode.replaceChild(oldAddNewService, addNewServiceCard);
            
            // 添加新的事件监听器
            oldAddNewService.addEventListener('click', () => {
                console.log('点击创建新服务卡片');
                this.showCreateServiceModal();
            });
        } else {
            console.error('找不到创建新服务卡片元素');
        }
        
        document.getElementById('btnCreateService')?.addEventListener('click', () => {
            console.log('点击顶部创建服务按钮');
            this.showCreateServiceModal();
        });
        
        // 模态框关闭按钮
        const closeButtons = document.querySelectorAll('.close-btn');
        if (closeButtons.length > 0) {
            console.log(`找到 ${closeButtons.length} 个模态框关闭按钮，添加事件监听`);
            closeButtons.forEach(button => {
                button.addEventListener('click', (e) => {
                    console.log('模态框关闭按钮被点击');
                    e.preventDefault();
                    e.stopPropagation();
                    this.closeServiceModal();
                });
            });
        } else {
            console.error('未找到模态框关闭按钮');
        }
        
        // 点击模态框外部关闭
        const serviceModal = document.getElementById('serviceModal');
        if (serviceModal) {
            console.log('为模态框背景添加点击事件监听');
            serviceModal.addEventListener('click', (e) => {
                if (e.target === serviceModal) {
                    console.log('点击模态框背景，关闭模态框');
                    this.closeServiceModal();
                }
            });
        } else {
            console.error('未找到模态框元素');
        }
        
        // ESC键关闭模态框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('serviceModal');
                if (modal && modal.style.display === 'flex') {
                    console.log('按下ESC键，关闭模态框');
                    this.closeServiceModal();
                }
            }
        });
        
        // 保存草稿按钮 - 使用原生DOM方法避免jQuery事件冒泡问题
        const saveBtn = document.querySelector('.btn-save-draft');
        if (saveBtn) {
            saveBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation(); // 阻止事件冒泡
                
                console.log('点击保存草稿按钮');
                
                // 设置状态为草稿
                document.getElementById('serviceStatus').checked = false;
                
                // 执行创建或更新操作
                if (this.editingServiceId) {
                    this.updateService(e);
                } else {
                    this.createService(e);
                }
            };
        }
        
        // 发布服务按钮
        const publishBtn = document.querySelector('.btn-publish-service');
        if (publishBtn) {
            publishBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation(); // 阻止事件冒泡
                
                console.log('点击发布服务按钮');
                
                // 设置状态为发布
                document.getElementById('serviceStatus').checked = true;
                
                // 执行创建或更新操作
                if (this.editingServiceId) {
                    this.updateService(e);
                } else {
                    this.createService(e);
                }
            };
        }
        
        // 服务状态切换
        document.getElementById('serviceStatus')?.addEventListener('change', () => {
            const saveBtn = document.querySelector('.btn-save-draft');
            const publishBtn = document.querySelector('.btn-publish-service');
            
            if (document.getElementById('serviceStatus').checked) {
                saveBtn.style.display = 'none';
                publishBtn.style.display = 'block';
            } else {
                saveBtn.style.display = 'block';
                publishBtn.style.display = 'none';
            }
        });
        
        // 取消按钮
        const cancelButton = document.querySelector('.btn-cancel');
        if (cancelButton) {
            console.log('为取消按钮添加事件监听');
            cancelButton.addEventListener('click', (e) => {
                console.log('取消按钮被点击');
                e.preventDefault();
                e.stopPropagation();
                this.closeServiceModal();
            });
        } else {
            console.error('未找到取消按钮');
        }
        
        // 图片上传预览
        document.getElementById('serviceImage')?.addEventListener('change', (e) => {
            this.handleImageUpload(e);
        });
        
        // 移除图片按钮
        document.querySelector('.btn-remove-image')?.addEventListener('click', () => {
            this.removeUploadedImage();
        });
    }
    
    /**
     * 移除已存在的事件监听器
     */
    removeExistingEventListeners() {
        // 保存草稿和发布按钮
        const saveBtn = document.querySelector('.btn-save-draft');
        const publishBtn = document.querySelector('.btn-publish-service');
        
        if (saveBtn) saveBtn.onclick = null;
        if (publishBtn) publishBtn.onclick = null;
        
        // 阻止表单默认提交
        const form = document.getElementById('serviceForm');
        if (form) {
            form.onsubmit = (e) => {
                e.preventDefault();
                console.log('拦截表单默认提交行为');
                return false;
            };
        }
    }
    
    /**
     * 筛选服务
     */
    filterServices(status) {
        this.currentFilter = status;
        
        // 更新激活的筛选按钮
        this.filterButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.status === status);
        });
        
        // 筛选服务卡片
        const serviceCards = document.querySelectorAll('.service-card:not(.add-new)');
        serviceCards.forEach(card => {
            // 根据类名判断服务状态
            const isActive = card.classList.contains('active');
            const isDraft = card.classList.contains('draft');
            const isInactive = card.classList.contains('inactive');
            
            // 根据筛选条件显示/隐藏
            if (status === 'all') {
                card.style.display = 'flex';
            } else if (status === 'active' && isActive) {
                card.style.display = 'flex';
            } else if (status === 'draft' && isDraft) {
                card.style.display = 'flex';
            } else if (status === 'inactive' && isInactive) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
    }
    
    /**
     * 显示创建服务模态框
     */
    showCreateServiceModal() {
        console.log('显示创建服务模态框');
        
        // 清除编辑状态
        this.editingServiceId = null;
        
        // 获取DOM元素
        const modal = document.getElementById('serviceModal');
        const modalTitle = document.getElementById('modalTitle');
        const serviceForm = document.getElementById('serviceForm');
        
        if (!modal) {
            console.error('找不到模态框元素，无法显示');
            alert('系统错误：无法打开创建窗口');
            return;
        }
        
        // 设置标题
        if (modalTitle) {
            modalTitle.textContent = '创建新服务';
        }
        
        // 重置表单
        if (serviceForm) {
            serviceForm.reset();
        }
        
        // 重置图片预览
        this.removeUploadedImage();
        
        // 设置按钮状态
        const saveBtn = document.querySelector('.btn-save-draft');
        const publishBtn = document.querySelector('.btn-publish-service');
        
        if (saveBtn) saveBtn.style.display = 'block';
        if (publishBtn) publishBtn.style.display = 'none';
        
        // 显示模态框：先设置display为flex，再添加active类
        modal.style.display = 'flex';
        
        // 使用setTimeout确保display样式生效后再添加active类
        setTimeout(() => {
            modal.classList.add('active');
        }, 10);
        
        console.log('创建服务模态框已显示');
    }
    
    /**
     * 显示编辑服务模态框
     */
    showEditServiceModal(serviceId) {
        console.log(`执行showEditServiceModal方法，serviceId=${serviceId}`);
        
        // 调试信息：查看模态框元素是否存在
        if (!this.serviceModal) {
            console.error('模态框元素不存在，尝试重新获取');
            this.serviceModal = document.getElementById('serviceModal');
            
            if (!this.serviceModal) {
                console.error('重新获取模态框元素失败！');
                this.showNotification('无法打开编辑窗口，请刷新页面重试', 'error');
                return;
            }
        }
        
        // 检查modalTitle元素
        if (!this.modalTitle) {
            console.error('modalTitle元素不存在，尝试重新获取');
            this.modalTitle = document.getElementById('modalTitle');
            
            if (!this.modalTitle) {
                console.error('重新获取modalTitle元素失败！');
                this.showNotification('无法打开编辑窗口，请刷新页面重试', 'error');
                return;
            }
        }
        
        console.log('模态框元素已找到，设置编辑状态');
        
        this.editingServiceId = serviceId;
        this.modalTitle.textContent = '编辑服务';
        
        // 显示加载状态
        document.getElementById('serviceForm').classList.add('loading');
        
        // 获取认证令牌
        const token = localStorage.getItem('token');
        if (!token) {
            this.showNotification('操作失败，请先登录', 'error');
            return;
        }
        
        // 根据ID从已加载的服务中查找服务详情
        const service = this.services.find(s => s.id === serviceId);
        console.log('查找到的服务数据:', service);
        
        if (!service) {
            this.showNotification('未找到服务信息', 'error');
            document.getElementById('serviceForm').classList.remove('loading');
            return;
        }
        
        // 填充表单
        document.getElementById('serviceName').value = service.title || '';
        document.getElementById('serviceCategory').value = service.categories && service.categories.length > 0 ? service.categories[0] : '';
        document.getElementById('servicePrice').value = service.price || '';
        
        // 处理服务时长/价格单位 - 如果是数字则视为时长，否则视为计价单位
        const priceUnit = service.price_unit || '';
        const duration = service.duration || '60'; // 默认60分钟
        document.getElementById('serviceDuration').value = duration;
        
        document.getElementById('serviceSummary').value = service.summary || '';
        document.getElementById('serviceDescription').value = service.description || '';
        
        // 设置状态
        document.getElementById('serviceStatus').checked = service.status === 'active';
        
        // 设置图片预览
        if (service.image && service.image !== 'img/service-placeholder.jpg') {
            document.querySelector('.upload-placeholder').style.display = 'none';
            document.querySelector('.image-preview').style.display = 'block';
            document.getElementById('imagePreview').src = service.image;
        } else {
            document.querySelector('.upload-placeholder').style.display = 'flex';
            document.querySelector('.image-preview').style.display = 'none';
            document.getElementById('imagePreview').src = '';
        }
        
        // 移除加载状态
        document.getElementById('serviceForm').classList.remove('loading');
        
        // 显示模态框
        console.log('准备显示模态框...');
        
        // 设置按钮状态
        const saveBtn = document.querySelector('.btn-save-draft');
        const publishBtn = document.querySelector('.btn-publish-service');
        
        if (document.getElementById('serviceStatus').checked) {
            saveBtn.style.display = 'none';
            publishBtn.style.display = 'block';
        } else {
            saveBtn.style.display = 'block';
            publishBtn.style.display = 'none';
        }
    }
    
    /**
     * 创建服务（由表单事件调用）
     */
    createService(e) {
        console.log('开始创建服务', e ? '事件对象存在' : '无事件对象');
        
        // 应用互斥锁和节流
        if (this.locks.create) {
            console.log('🔒 创建服务操作被锁定 - 上一个请求正在处理中');
            return; // 如果已经在处理请求，直接返回
        }
        
        // 节流控制
        const now = Date.now();
        if (now - this.lastRequestTime.create < this.minRequestInterval) {
            console.log(`⏱️ 创建服务请求太频繁 - 距上次请求仅 ${now - this.lastRequestTime.create}ms`);
            return; // 如果请求太频繁，直接返回
        }
        
        // 更新时间戳并设置锁
        this.lastRequestTime.create = now;
        this.locks.create = true;
        
        if (this.debug) {
            console.log('🔐 获取互斥锁: create');
        }
        
        // 获取表单数据
        const serviceName = document.getElementById('serviceName')?.value || '';
        const serviceCategory = document.getElementById('serviceCategory')?.value || '';
        const servicePriceElement = document.getElementById('servicePrice');
        const serviceDurationElement = document.getElementById('serviceDuration');
        
        // 安全地解析数值
        let servicePrice = 0;
        let serviceDuration = 60;
        
        try {
            if (servicePriceElement) servicePrice = parseFloat(servicePriceElement.value) || 0;
            if (serviceDurationElement) serviceDuration = parseInt(serviceDurationElement.value) || 60;
        } catch (e) {
            console.error('解析价格或时长失败:', e);
        }
        
        const serviceSummary = document.getElementById('serviceSummary')?.value || '';
        const serviceDescription = document.getElementById('serviceDescription')?.value || '';
        const serviceStatus = document.getElementById('serviceStatus')?.checked ? 'active' : 'draft';
        
        // 获取图片URL（如果已上传）
        const imagePreview = document.getElementById('imagePreview');
        const imageUrl = imagePreview && imagePreview.src ? imagePreview.src : 'img/service-placeholder.jpg';
        
        // 校验必填字段
        if (!serviceName) {
            this.showNotification('请填写服务名称', 'error');
            this.locks.create = false; // 解除锁
            return;
        }
        
        if (!serviceCategory) {
            this.showNotification('请选择服务类别', 'error');
            this.locks.create = false; // 解除锁
            return;
        }
        
        // 构建服务数据
        const serviceData = {
            title: serviceName,
            categories: [serviceCategory],
            price: servicePrice,
            duration: serviceDuration,
            description: serviceDescription || serviceSummary,
            summary: serviceSummary,
            image: imageUrl,
            status: serviceStatus
        };
        
        console.log('准备发送的服务数据:', serviceData);
        
        // 生成临时ID，以便在本地存储和恢复
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const serviceWithTempId = {
            ...serviceData,
            id: tempId,
            created_at: new Date().toISOString(),
            provider_id: this.currentUser.userId
        };
        
        // 将服务数据保存到localStorage，以便在请求失败时恢复
        try {
            localStorage.setItem('pendingServiceCreation', JSON.stringify(serviceWithTempId));
            console.log('服务数据已保存到localStorage:', tempId);
        } catch (e) {
            console.error('保存服务数据到localStorage失败:', e);
        }
        
        // 显示加载状态
        let submitButton = null;
        
        if (e && e.currentTarget) {
            submitButton = e.currentTarget;
        } else {
            // 根据状态选择按钮
            if (serviceStatus === 'active') {
                submitButton = document.querySelector('.btn-publish-service');
            } else {
                submitButton = document.querySelector('.btn-save-draft');
            }
        }
        
        const originalText = submitButton ? submitButton.innerHTML : '';
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 处理中...';
        }
        
        // 生成客户端请求ID，便于调试
        const clientRequestId = `req-client-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
        console.log(`📤 发送创建请求: ${clientRequestId}`);
        
        // 获取认证令牌
        const token = localStorage.getItem('token');
        if (!token) {
            this.showNotification('请先登录', 'error');
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.innerHTML = originalText;
            }
            this.locks.create = false;
            return;
        }
        
        // 发送API请求创建服务
        fetch('/api/services', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-Client-Request-ID': clientRequestId
            },
            body: JSON.stringify(serviceData)
        })
        .then(response => {
            console.log(`📥 收到响应: ${clientRequestId}, 状态: ${response.status}`);
            
            // 即使服务器返回500错误，也尝试解析响应体
            return response.json().then(data => {
                // 将响应状态和数据一起返回
                return { 
                    ok: response.ok, 
                    status: response.status, 
                    data: data 
                };
            }).catch(err => {
                // 如果无法解析JSON，则返回原始响应
                return { 
                    ok: response.ok, 
                    status: response.status, 
                    data: null,
                    parseError: err.message
                };
            });
        })
        .then(result => {
            console.log(`⚙️ 处理响应数据: ${clientRequestId}`, result);
            
            // 检查服务是否已创建（即使状态码是错误的）
            if (result.data && result.data.service) {
                console.log('服务创建成功，即使状态码可能表明有错误:', result.status);
                
                // 关闭模态框
                this.closeServiceModal();
                
                // 清除localStorage中的临时服务数据
                try {
                    localStorage.removeItem('pendingServiceCreation');
                } catch (e) {
                    console.error('清除localStorage中的服务数据失败:', e);
                }
                
                // 显示成功通知
                this.showNotification('服务创建成功', 'success');
                
                // 将新服务添加到本地缓存
                this.services.push(result.data.service);
                
                // 确保清除任何现有的空状态消息
                const emptyState = document.querySelector('.empty-state');
                if (emptyState) {
                    emptyState.remove();
                }
                
                // 渲染新服务卡片
                this.renderServiceCard(result.data.service);
                
                // 应用当前筛选条件
                this.filterServices(this.currentFilter);
                
                return; // 提前返回，不抛出错误
            }
            
            // 如果响应不成功且没有服务数据，则抛出错误
            if (!result.ok) {
                const errorMsg = result.data && result.data.message 
                    ? result.data.message 
                    : `服务器返回错误状态: ${result.status}`;
                throw new Error(errorMsg);
            }
            
            // 处理正常成功响应
            if (result.data.duplicate) {
                console.log(`🔍 检测到重复提交: ${clientRequestId}`, result.data);
            }
        })
        .catch(error => {
            console.error(`❌ 请求失败: ${clientRequestId}`, error);
            
            // 尝试从localStorage中检查是否有新服务
            try {
                const pendingService = localStorage.getItem('pendingServiceCreation');
                if (pendingService) {
                    // 清除存储的服务
                    localStorage.removeItem('pendingServiceCreation');
                    
                    // 解析服务数据
                    const serviceData = JSON.parse(pendingService);
                    console.log('从localStorage恢复服务数据:', serviceData);
                    
                    // 添加到服务列表
                    if (serviceData && serviceData.id) {
                        this.services.push(serviceData);
                        this.renderServiceCard(serviceData);
                        this.filterServices(this.currentFilter);
                        
                        // 关闭模态框
                        this.closeServiceModal();
                        
                        this.showNotification('服务已创建，但遇到了通信问题', 'warning');
                        return;
                    }
                }
                
                // 检查是否是外键约束错误
                const errorMessage = error.message || '';
                if (errorMessage.includes('foreign key constraint') || 
                    errorMessage.includes('IntegrityError') ||
                    errorMessage.includes('CONSTRAINT')) {
                    
                    // 关闭模态框
                    this.closeServiceModal();
                    
                    // 显示特定的通知
                    this.showNotification('服务已创建，但通知发送失败，请刷新页面查看', 'warning');
                    
                    // 2秒后自动刷新页面
                    setTimeout(() => {
                        window.location.reload();
                    }, 2000);
                    
                    return;
                }
                
            } catch (e) {
                console.error('恢复服务数据失败:', e);
            }
            
            this.showNotification('创建服务失败，请重试', 'error');
        })
        .finally(() => {
            // 恢复按钮状态
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.innerHTML = originalText;
            }
            
            // 解除互斥锁
            this.locks.create = false;
            console.log('🔓 释放互斥锁: create');
        });
    }
    
    /**
     * 更新服务信息
     */
    updateService(e) {
        if (!this.editingServiceId) {
            this.showNotification('无法更新服务：缺少服务ID', 'error');
            this.isFormSubmitting = false; // 重置提交状态
            return;
        }
        
        // 获取表单数据
        const serviceName = document.getElementById('serviceName').value;
        const serviceCategory = document.getElementById('serviceCategory').value;
        const servicePrice = parseFloat(document.getElementById('servicePrice').value);
        const serviceDuration = parseInt(document.getElementById('serviceDuration').value);
        const serviceSummary = document.getElementById('serviceSummary').value;
        const serviceDescription = document.getElementById('serviceDescription').value;
        const serviceStatus = document.getElementById('serviceStatus').checked ? 'active' : 'draft';
        
        // 获取图片URL（如果已上传）
        const imagePreview = document.getElementById('imagePreview');
        const imageUrl = imagePreview && imagePreview.src ? imagePreview.src : 'img/service-placeholder.jpg';
        
        // 构建服务数据
        const serviceData = {
            title: serviceName,
            categories: [serviceCategory],
            price: servicePrice,
            price_unit: `${serviceDuration}分钟`,
            description: serviceDescription || serviceSummary,
            summary: serviceSummary,
            image: imageUrl,
            status: serviceStatus,
            duration: serviceDuration
        };
        
        // 显示加载状态
        const submitButton = e.currentTarget; // 使用currentTarget获取触发事件的元素
        const originalText = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 更新中...';
        
        console.log('发送更新服务请求数据:', serviceData);
        
        // 发送API请求更新服务
        apiRequest(`/api/services/${this.editingServiceId}`, 'PUT', serviceData)
            .then(response => {
                if (!response) {
                    throw new Error('更新服务失败');
                }
                
                console.log('服务更新成功', response);
                
                // 关闭模态框
                this.closeServiceModal();
                
                // 显示成功通知
                this.showNotification('服务更新成功', 'success');
                
                // 直接更新本地数据和UI
                if (response.service) {
                    // 更新本地服务数据
                    const index = this.services.findIndex(s => s.id === this.editingServiceId);
                    if (index !== -1) {
                        this.services[index] = response.service;
                        
                        // 更新UI上的服务卡片
                        this.updateServiceCardInUI(response.service);
                    }
                }
            })
            .catch(error => {
                console.error('更新服务失败:', error);
                this.showNotification('更新服务失败，请重试', 'error');
            })
            .finally(() => {
                // 恢复按钮状态
                submitButton.disabled = false;
                submitButton.innerHTML = originalText;
                
                // 重置表单提交状态，允许再次提交
                this.isFormSubmitting = false;
            });
    }
    
    /**
     * 更新UI中的服务卡片
     */
    updateServiceCardInUI(service) {
        const existingCard = document.querySelector(`.service-card[data-id="${service.id}"]`);
        if (existingCard) {
            // 生成新的卡片HTML
            const cardHTML = this.generateCardHTML(service);
            
            // 创建临时容器
            const tempContainer = document.createElement('div');
            tempContainer.innerHTML = cardHTML;
            const newCard = tempContainer.firstElementChild;
            
            // 替换旧卡片
            existingCard.parentNode.replaceChild(newCard, existingCard);
            
            // 重新添加事件监听
            this.attachCardEventListeners(newCard);
        } else {
            // 如果卡片不存在，则添加新卡片
            this.renderServiceCard(service);
        }
    }
    
    /**
     * 为服务卡片添加事件监听
     */
    attachCardEventListeners(card) {
        if (!card) {
            console.error('无法添加事件监听：卡片元素为空');
            return;
        }
        
        const serviceId = card.dataset.id;
        if (!serviceId) {
            console.error('服务卡片缺少data-id属性');
            return;
        }
        
        console.log(`为服务卡片添加事件监听, ID=${serviceId}`);
        
        // 编辑按钮
        const editBtn = card.querySelector('.btn-edit');
        if (editBtn) {
            console.log(`找到编辑按钮，添加点击事件监听器`);
            editBtn.addEventListener('click', (e) => {
                e.preventDefault(); // 防止链接默认行为
                e.stopPropagation(); // 阻止事件冒泡到卡片
                console.log(`编辑按钮被点击, serviceId=${serviceId}`);
                this.editService(serviceId);
            });
        } else {
            console.error(`找不到编辑按钮, serviceId=${serviceId}`);
        }
        
        // 发布按钮
        const publishBtn = card.querySelector('.btn-publish');
        if (publishBtn) {
            publishBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.publishService(serviceId);
            });
        }
        
        // 下线按钮
        const offlineBtn = card.querySelector('.btn-offline');
        if (offlineBtn) {
            offlineBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.takeServiceOffline(serviceId);
            });
        }
        
        // 删除按钮
        const deleteBtn = card.querySelector('.btn-delete');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const serviceName = card.querySelector('.service-title').textContent;
                this.deleteService(serviceId, serviceName);
            });
        }
        
        // 卡片点击跳转到详情页
        card.addEventListener('click', () => {
            window.location.href = `service-detail.html?id=${serviceId}`;
        });
    }
    
    /**
     * 加载服务列表
     */
    loadServices() {
        console.log('开始加载服务列表');
        
        // 显示加载指示器
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.innerHTML = `
            <div class="loading-spinner"></div>
            <p>正在加载服务列表...</p>
        `;
        this.serviceGrid.appendChild(loadingIndicator);
        
        // 确保用户已登录并获取token
        if (!checkAuth()) {
            console.error('用户未登录，无法加载服务');
            if (loadingIndicator) {
                this.serviceGrid.removeChild(loadingIndicator);
            }
            this.showNotification('请先登录后再访问此页面', 'error');
            return;
        }
        
        // 使用apiRequest函数发送API请求
        apiRequest('/api/services/provider')
        .then(services => {
            if (!services) {
                throw new Error('获取服务列表失败');
            }
            
            // 保存服务数据
            this.services = services;
            
            // 移除加载指示器
            if (loadingIndicator) {
                this.serviceGrid.removeChild(loadingIndicator);
            }
            
            // 移除现有的服务卡片（除了"添加新服务"卡片）
            const existingCards = document.querySelectorAll('.service-card:not(#addNewService)');
            existingCards.forEach(card => card.remove());
            
            // 渲染服务卡片
            if (services.length > 0) {
                services.forEach(service => {
                    this.renderServiceCard(service);
                });
            } else {
                // 如果没有服务，显示空状态
                const emptyState = document.createElement('div');
                emptyState.className = 'empty-state';
                emptyState.innerHTML = `
                    <i class="fas fa-clipboard-list"></i>
                    <h3>暂无服务</h3>
                    <p>点击"创建服务"按钮开始添加您的第一个服务</p>
                `;
                this.serviceGrid.appendChild(emptyState);
            }
            
            // 应用当前筛选条件
            this.filterServices(this.currentFilter);
            
            console.log('服务列表加载成功', services);
        })
        .catch(error => {
            console.error('加载服务数据失败:', error);
            this.showNotification('加载服务数据失败，请刷新页面重试', 'error');
            
            // 移除加载指示器
            if (loadingIndicator) {
                this.serviceGrid.removeChild(loadingIndicator);
            }
            
            // 显示错误状态
            const errorState = document.createElement('div');
            errorState.className = 'empty-state error';
            errorState.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i>
                <h3>加载失败</h3>
                <p>无法加载服务列表，请刷新页面重试</p>
                <button class="btn-retry">重试</button>
            `;
            this.serviceGrid.appendChild(errorState);
            
            // 添加重试按钮事件
            errorState.querySelector('.btn-retry').addEventListener('click', () => {
                errorState.remove();
                this.loadServices();
            });
        });
    }
    
    /**
     * 生成服务卡片HTML
     */
    generateCardHTML(service) {
        // 根据服务状态设置不同的UI
        let statusText = '草稿';
        if (service.status === 'active') {
            statusText = '已上线';
        } else if (service.status === 'inactive') {
            statusText = '已下线';
        }
        
        // 构建卡片HTML
        let cardHTML = `
            <div class="service-card ${service.status || 'draft'}" data-id="${service.id}">
                <div class="service-status">
                    <span class="status-indicator ${service.status || 'draft'}"></span>
                    <span class="status-text">${statusText}</span>
                </div>
                <div class="service-image">
                    <img src="${service.image || 'img/service-placeholder.jpg'}" alt="${service.title}">
                </div>
                <div class="service-content">
                    <h3 class="service-title">${service.title}</h3>
                    <div class="service-meta">
                        <div class="service-price">¥${service.price} / ${service.price_unit}</div>
                        <div class="service-rating">
                            <i class="fas fa-star"></i>
                            <span>${service.status === 'active' ? 
                                `${service.rating || '0.0'} (${service.reviews_count || 0}条评价)` : 
                                '未上线'}</span>
                        </div>
                    </div>
                    <div class="service-stats">
                        <div class="stat">
                            <i class="fas fa-${service.status === 'active' ? 'eye' : (service.status === 'inactive' ? 'eye-slash' : 'file-alt')}"></i>
                            <span>${service.status === 'active' ? 
                                `${service.view_count || 0}次浏览` : 
                                (service.status === 'inactive' ? '已下线' : '草稿')}</span>
                        </div>
                        <div class="stat">
                            <i class="fas fa-${service.status === 'active' ? 'calendar-check' : (service.status === 'inactive' ? 'calendar-times' : 'clock')}"></i>
                            <span>${service.status === 'active' ? 
                                `${service.booking_count || 0}次预约` : 
                                (service.status === 'inactive' ? '不可预约' : '未完成')}</span>
                        </div>
                    </div>
                </div>
                <div class="service-actions">
                    <button class="btn-edit" data-id="${service.id}">
                        <i class="fas fa-edit"></i>
                        <span>编辑</span>
                    </button>
                    ${service.status === 'active' ? 
                        `<button class="btn-offline" data-id="${service.id}">
                            <i class="fas fa-times-circle"></i>
                            <span>下线</span>
                        </button>` : 
                        (service.status === 'inactive' || service.status === 'draft' ? 
                            `<button class="btn-publish" data-id="${service.id}">
                                <i class="fas fa-upload"></i>
                                <span>${service.status === 'inactive' ? '重新上线' : '发布'}</span>
                            </button>` : 
                            ''
                        )
                    }
                    ${service.status !== 'active' ? 
                        `<button class="btn-delete" data-id="${service.id}">
                            <i class="fas fa-trash-alt"></i>
                            <span>删除</span>
                        </button>` : 
                        ''
                    }
                </div>
            </div>
        `;
        
        return cardHTML;
    }
    
    /**
     * 渲染单个服务卡片
     */
    renderServiceCard(service) {
        // 使用generateCardHTML方法生成卡片HTML
        const cardHTML = this.generateCardHTML(service);
        
        // 创建DOM元素
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = cardHTML;
        const serviceCard = tempContainer.firstElementChild;
        
        // 将卡片添加到网格中
        const addNewServiceCard = document.getElementById('addNewService');
        if (addNewServiceCard) {
            this.serviceGrid.insertBefore(serviceCard, addNewServiceCard);
        } else {
            this.serviceGrid.appendChild(serviceCard);
        }
        
        // 添加事件监听
        this.attachCardEventListeners(serviceCard);
    }
    
    /**
     * 删除服务
     */
    deleteService(serviceId, serviceName) {
        if (!serviceId) {
            this.showNotification('无法删除服务：缺少服务ID', 'error');
            // 解除锁定
            this.locks.delete = false;
            return;
        }
        
        // 确认删除
        if (!confirm(`确定要删除服务"${serviceName || '未命名服务'}"吗？此操作不可撤销。`)) {
            // 用户取消，解除锁定
            this.locks.delete = false;
            return;
        }
        
        console.log(`开始删除服务: ${serviceId}`);
        
        // 添加删除按钮的加载状态
        const deleteBtn = document.querySelector(`.btn-delete[data-id="${serviceId}"]`);
        if (deleteBtn) {
            const originalText = deleteBtn.innerHTML;
            deleteBtn.disabled = true;
            deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }
        
        // 生成客户端请求ID
        const clientRequestId = `req-del-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
        console.log(`📤 发送删除请求: ${clientRequestId}`);
        
        // 使用原生fetch代替apiRequest，以便更好地控制请求
        fetch(`/api/services/${serviceId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'X-Client-Request-ID': clientRequestId
            }
        })
        .then(response => {
            console.log(`📥 收到删除响应: ${clientRequestId}, 状态: ${response.status}`);
            
            if (response.status >= 200 && response.status < 300) {
                // 删除成功，不管有没有返回JSON
                return { success: true };
            } else {
                // 删除失败
                console.error(`删除服务失败: HTTP ${response.status}`);
                return Promise.reject(new Error(`删除失败: HTTP ${response.status}`));
            }
        })
        .then(response => {
            console.log('服务删除成功');
            
            // 显示成功通知
            this.showNotification('服务删除成功', 'success');
            
            // 从DOM中移除服务卡片
            const serviceCard = document.querySelector(`.service-card[data-id="${serviceId}"]`);
            if (serviceCard) {
                serviceCard.remove();
            }
            
            // 从服务列表中移除
            this.services = this.services.filter(service => service.id !== serviceId);
            
            // 如果没有服务了，显示空状态
            if (this.serviceGrid.querySelectorAll('.service-card').length === 0) {
                const emptyState = document.createElement('div');
                emptyState.className = 'empty-state';
                emptyState.innerHTML = `
                    <i class="fas fa-clipboard-list"></i>
                    <h3>暂无服务</h3>
                    <p>点击"创建服务"按钮开始添加您的第一个服务</p>
                `;
                this.serviceGrid.appendChild(emptyState);
            }
        })
        .catch(error => {
            console.error('删除服务失败:', error);
            this.showNotification('删除服务失败，请重试', 'error');
            
            // 恢复按钮状态
            if (deleteBtn) {
                deleteBtn.disabled = false;
                deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i><span>删除</span>';
            }
        })
        .finally(() => {
            // 解除互斥锁
            this.locks.delete = false;
            if (this.debug) {
                console.log('🔓 释放互斥锁: delete');
            }
        });
    }

    /**
     * 下线服务
     * @param {string} serviceId 服务ID
     */
    takeServiceOffline(serviceId) {
        console.log('尝试下线服务:', serviceId);
        
        // 重置锁以防止卡死
        this.locks.status = false;
        
        // 更新按钮状态
        const offlineBtn = document.querySelector(`.btn-offline[data-id="${serviceId}"]`);
        if (offlineBtn) {
            offlineBtn.disabled = true;
            offlineBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }
        
        // 生成客户端请求ID
        const clientRequestId = `req-offline-${Date.now().toString(36)}`;
        console.log(`📤 发送下线请求: ${clientRequestId}`);
        
        // 更新最近请求时间
        this.lastRequestTime.status = Date.now();
        
        // 发送API请求下线服务
        fetch(`/api/services/${serviceId}/update_status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'X-Client-Request-ID': clientRequestId
            },
            body: JSON.stringify({ status: 'inactive' })
        })
        .then(response => {
            console.log(`📥 收到下线响应: ${clientRequestId}, 状态: ${response.status}`);
            if (response.ok) {
                return response.json();
            }
            throw new Error(`服务器返回错误状态: ${response.status}`);
        })
        .then(data => {
            console.log('服务下线成功', data);
            
            // 显示成功通知
            this.showNotification('服务已成功下线', 'success');
            
            // 直接更新本地数据和UI
            if (data.service) {
                console.log('开始更新UI，收到的服务数据:', data.service);
                
                // 更新本地服务数据
                const index = this.services.findIndex(s => s.id === serviceId);
                console.log('找到服务索引:', index, '服务ID:', serviceId);
                
                if (index !== -1) {
                    // 确保状态被正确更新
                    data.service.status = 'inactive';
                    this.services[index] = data.service;
                    
                    console.log('服务数据已更新:', this.services[index]);
                    
                    // 直接更新DOM - 不依赖updateServiceCardInUI方法
                    const card = document.querySelector(`.service-card[data-id="${serviceId}"]`);
                    if (card) {
                        console.log('找到卡片元素，直接更新DOM');
                        
                        // 更新卡片状态类
                        card.className = 'service-card inactive';
                        
                        // 更新状态文本
                        const statusText = card.querySelector('.status-text');
                        if (statusText) {
                            statusText.textContent = '已下线';
                        }
                        
                        // 更新状态指示器
                        const statusIndicator = card.querySelector('.status-indicator');
                        if (statusIndicator) {
                            statusIndicator.className = 'status-indicator inactive';
                        }
                        
                        // 更新操作按钮
                        const actionsContainer = card.querySelector('.service-actions');
                        if (actionsContainer) {
                            actionsContainer.innerHTML = `
                                <button class="btn-edit" data-id="${serviceId}">
                                    <i class="fas fa-edit"></i>
                                    <span>编辑</span>
                                </button>
                                <button class="btn-publish" data-id="${serviceId}">
                                                                         <i class="fas fa-upload"></i>
                                    <span>重新上线</span>
                                 </button>
                                 <button class="btn-delete" data-id="${serviceId}">
                                     <i class="fas fa-trash-alt"></i>
                                     <span>删除</span>
                                 </button>
                              `;
                                                          
                            // 重新绑定按钮事件
                            this.attachCardEventListeners(card);
                        }
                    }
                }
                
                // 应用当前筛选条件
                this.filterServices(this.currentFilter);
            } else {
                console.warn('服务下线成功，但响应中没有服务数据');
                
                // 尝试直接更新UI
                const card = document.querySelector(`.service-card[data-id="${serviceId}"]`);
                if (card) {
                    card.className = 'service-card inactive';
                    const statusText = card.querySelector('.status-text');
                    if (statusText) statusText.textContent = '已下线';
                    
                    const statusIndicator = card.querySelector('.status-indicator');
                    if (statusIndicator) statusIndicator.className = 'status-indicator inactive';
                }
            }
        })
        .catch(error => {
            console.error('下线服务失败:', error);
            this.showNotification('下线服务失败，请重试', 'error');
            
            // 恢复按钮状态
            if (offlineBtn) {
                offlineBtn.disabled = false;
                offlineBtn.innerHTML = '<i class="fas fa-times-circle"></i><span>下线</span>';
            }
        })
        .finally(() => {
            // 确保互斥锁被释放
            this.locks.status = false;
            console.log('🔓 释放互斥锁: status');
        });
    }

    /**
     * 发布服务
     * @param {string} serviceId 服务ID
     */
    publishService(serviceId) {
        console.log('尝试发布服务:', serviceId);
        
        if (!serviceId) {
            this.showNotification('无法发布服务：缺少服务ID', 'error');
            return;
        }
        
        // 重置锁以防止卡死
        this.locks.status = false;
        
        // 显示加载状态
        const publishBtn = document.querySelector(`.btn-publish[data-id="${serviceId}"]`);
        if (publishBtn) {
            publishBtn.disabled = true;
            publishBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }
        
        // 更新最近请求时间
        this.lastRequestTime.status = Date.now();
        
        // 生成客户端请求ID
        const clientRequestId = `req-publish-${Date.now().toString(36)}`;
        console.log(`📤 发送发布请求: ${clientRequestId}`);
        
        // 发送API请求发布服务
        fetch(`/api/services/${serviceId}/update_status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'X-Client-Request-ID': clientRequestId
            },
            body: JSON.stringify({ status: 'active' })
        })
        .then(response => {
            console.log(`📥 收到发布响应: ${clientRequestId}, 状态: ${response.status}`);
            if (response.ok) {
                return response.json();
            }
            throw new Error(`服务器返回错误状态: ${response.status}`);
        })
        .then(data => {
            console.log('服务发布成功', data);
            
            // 显示成功通知
            this.showNotification('服务已成功上线', 'success');
            
            // 直接更新本地数据和UI
            if (data.service) {
                console.log('开始更新UI，收到的服务数据:', data.service);
                
                // 更新本地服务数据
                const index = this.services.findIndex(s => s.id === serviceId);
                console.log('找到服务索引:', index, '服务ID:', serviceId);
                
                if (index !== -1) {
                    // 确保状态被正确更新
                    data.service.status = 'active';
                    this.services[index] = data.service;
                    
                    console.log('服务数据已更新:', this.services[index]);
                    
                    // 直接更新DOM - 不依赖updateServiceCardInUI方法
                    const card = document.querySelector(`.service-card[data-id="${serviceId}"]`);
                    if (card) {
                        console.log('找到卡片元素，直接更新DOM');
                        
                        // 更新卡片状态类
                        card.className = 'service-card active';
                        
                        // 更新状态文本
                        const statusText = card.querySelector('.status-text');
                        if (statusText) {
                            statusText.textContent = '已上线';
                        }
                        
                        // 更新状态指示器
                        const statusIndicator = card.querySelector('.status-indicator');
                        if (statusIndicator) {
                            statusIndicator.className = 'status-indicator active';
                        }
                        
                        // 更新操作按钮
                        const actionsContainer = card.querySelector('.service-actions');
                        if (actionsContainer) {
                            actionsContainer.innerHTML = `
                                <button class="btn-edit" data-id="${serviceId}">
                                    <i class="fas fa-edit"></i>
                                    <span>编辑</span>
                                </button>
                                <button class="btn-offline" data-id="${serviceId}">
                                    <i class="fas fa-times-circle"></i>
                                    <span>下线</span>
                                </button>
                            `;
                            
                            // 重新绑定按钮事件
                            this.attachCardEventListeners(card);
                        }
                    }
                }
                
                // 应用当前筛选条件
                this.filterServices(this.currentFilter);
            } else {
                console.warn('服务发布成功，但响应中没有服务数据');
                
                // 尝试直接更新UI
                const card = document.querySelector(`.service-card[data-id="${serviceId}"]`);
                if (card) {
                    card.className = 'service-card active';
                    const statusText = card.querySelector('.status-text');
                    if (statusText) statusText.textContent = '已上线';
                    
                    const statusIndicator = card.querySelector('.status-indicator');
                    if (statusIndicator) statusIndicator.className = 'status-indicator active';
                }
            }
        })
        .catch(error => {
            console.error('发布服务失败:', error);
            this.showNotification('发布服务失败，请重试', 'error');
            
            // 恢复按钮状态
            if (publishBtn) {
                publishBtn.disabled = false;
                publishBtn.innerHTML = '<i class="fas fa-upload"></i><span>发布</span>';
            }
        })
        .finally(() => {
            // 确保互斥锁被释放
            this.locks.status = false;
            console.log('🔓 释放互斥锁: status');
        });
    }
    
    /**
     * 关闭服务模态框
     */
    closeServiceModal() {
        console.log('关闭模态框');
        
        // 直接使用DOM API获取模态框元素
        const modal = document.getElementById('serviceModal');
        if (modal) {
            // 移除active类，并设置display为none
            modal.classList.remove('active');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300); // 等待过渡效果完成
        } else {
            console.error('找不到模态框元素，无法关闭');
        }
        
        // 重置编辑状态
        this.editingServiceId = null;
        
        // 重置表单
        const serviceForm = document.getElementById('serviceForm');
        if (serviceForm) {
            serviceForm.reset();
        }
        
        // 重置图片预览
        this.removeUploadedImage();
        
        // 重置表单提交状态
        this.isFormSubmitting = false;
    }
    
    /**
     * 处理图片上传
     */
    handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    fetch('/api/upload-image', {
        method: 'POST',
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if (data && data.url) {
            const imagePreview = document.getElementById('imagePreview');
            imagePreview.src = data.url;
            document.querySelector('.upload-placeholder').style.display = 'none';
            document.querySelector('.image-preview').style.display = 'block';
        } else {
            alert('上传失败，请重试');
        }
    })
    .catch(err => {
        console.error('上传图片失败', err);
        alert('上传失败，请检查网络');
    });
}

    
    /**
     * 移除上传的图片
     */
    removeUploadedImage() {
        document.getElementById('serviceImage').value = '';
        document.querySelector('.upload-placeholder').style.display = 'flex';
        document.querySelector('.image-preview').style.display = 'none';
        document.getElementById('imagePreview').src = '';
    }
    
    /**
     * 显示通知消息
     */
    showNotification(message, type = 'success') {
        // 防止短时间内显示重复的通知
        const notificationKey = `${type}:${message}`;
        
        // 检查是否在短时间内已经显示过相同的通知
        if (this.lastNotification && 
            this.lastNotification.key === notificationKey && 
            Date.now() - this.lastNotification.timestamp < 3000) {
            console.log('抑制重复通知:', message);
            return; // 抑制重复的通知
        }
        
        // 保存当前通知的信息
        this.lastNotification = {
            key: notificationKey,
            timestamp: Date.now()
        };
        
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : (type === 'error' ? 'exclamation-circle' : 'info-circle')}"></i>
                <span>${message}</span>
            </div>
            <button class="close-btn">×</button>
        `;
        
        // 添加到页面
        const notificationContainer = document.querySelector('.notification-container') || (() => {
            const container = document.createElement('div');
            container.className = 'notification-container';
            document.body.appendChild(container);
            return container;
        })();
        
        notificationContainer.appendChild(notification);
        
        // 添加关闭按钮事件
        notification.querySelector('.close-btn').addEventListener('click', () => {
            notificationContainer.removeChild(notification);
        });
        
        // 自动消失
        setTimeout(() => {
            if (notification.parentElement) {
                notification.classList.add('fade-out');
                setTimeout(() => {
                    if (notification.parentElement) {
                        notificationContainer.removeChild(notification);
                    }
                }, 300);
            }
        }, 3000);
    }

    /**
     * 打开编辑服务模态框
     * @param {string} serviceId 服务ID
     */
    editService(serviceId) {
        console.log('editService被调用:', serviceId);
        if (!serviceId) {
            console.error('编辑服务失败：缺少服务ID');
            return;
        }
        
        // 直接使用DOM API获取模态框元素
        const modal = document.getElementById('serviceModal');
        if (!modal) {
            console.error('找不到模态框元素，ID=serviceModal');
            alert('系统错误：找不到编辑窗口');
            return;
        }
        
        // 获取模态框标题
        const modalTitle = document.getElementById('modalTitle');
        if (modalTitle) {
            modalTitle.textContent = '编辑服务';
        }
        
        // 获取服务数据
        const service = this.services.find(s => s.id === serviceId);
        if (!service) {
            console.error(`找不到服务数据, ID=${serviceId}`);
            alert('系统错误：找不到服务数据');
            return;
        }
        
        console.log('找到服务数据:', service);
        
        // 显示加载状态
        const serviceForm = document.getElementById('serviceForm');
        if (serviceForm) {
            serviceForm.classList.add('loading');
        }
        
        // 设置正在编辑的服务ID
        this.editingServiceId = serviceId;
        
        // 填充表单
        document.getElementById('serviceName').value = service.title || '';
        
        // 设置服务类别
        let categoryValue = '';
        if (service.categories) {
            try {
                // 尝试解析JSON字符串
                if (typeof service.categories === 'string') {
                    const categories = JSON.parse(service.categories);
                    categoryValue = categories[0] || '';
                } else if (Array.isArray(service.categories) && service.categories.length > 0) {
                    categoryValue = service.categories[0];
                }
            } catch (e) {
                console.error('解析服务类别失败:', e);
                categoryValue = '';
            }
        }
        
        document.getElementById('serviceCategory').value = categoryValue;
        document.getElementById('servicePrice').value = service.price || '';
        document.getElementById('serviceDuration').value = service.duration || '60';
        document.getElementById('serviceSummary').value = service.summary || '';
        document.getElementById('serviceDescription').value = service.description || '';
        
        // 设置状态
        document.getElementById('serviceStatus').checked = service.status === 'active';
        
        // 设置图片预览
        const uploadPlaceholder = document.querySelector('.upload-placeholder');
        const imagePreview = document.querySelector('.image-preview');
        const imagePreviewEl = document.getElementById('imagePreview');
        
        if (service.image && service.image !== 'img/service-placeholder.jpg') {
            if (uploadPlaceholder) uploadPlaceholder.style.display = 'none';
            if (imagePreview) imagePreview.style.display = 'block';
            if (imagePreviewEl) imagePreviewEl.src = service.image;
        } else {
            if (uploadPlaceholder) uploadPlaceholder.style.display = 'flex';
            if (imagePreview) imagePreview.style.display = 'none';
            if (imagePreviewEl) imagePreviewEl.src = '';
        }
        
        // 设置按钮状态
        const saveBtn = document.querySelector('.btn-save-draft');
        const publishBtn = document.querySelector('.btn-publish-service');
        
        if (document.getElementById('serviceStatus').checked) {
            if (saveBtn) saveBtn.style.display = 'none';
            if (publishBtn) publishBtn.style.display = 'block';
        } else {
            if (saveBtn) saveBtn.style.display = 'block';
            if (publishBtn) publishBtn.style.display = 'none';
        }
        
        // 移除加载状态
        if (serviceForm) {
            serviceForm.classList.remove('loading');
        }
        
        // 显示模态框
        console.log('显示模态框...');
        
        // 先设置display为flex，再添加active类，确保CSS动画正常工作
        modal.style.display = 'flex';
        
        // 使用setTimeout确保display样式生效后再添加active类
        setTimeout(() => {
            modal.classList.add('active');
        }, 10);
    }

    /**
     * 渲染服务数据到页面
     */
    renderServices() {
        // 获取服务列表容器元素
        const serviceGrid = document.getElementById('service-grid');
        if (!serviceGrid) {
            console.error('找不到服务列表容器');
            return;
        }
        
        if (this.services.length === 0) {
            serviceGrid.innerHTML = `
                <div class="empty-state">
                    <img src="img/empty-state.svg" alt="暂无服务" />
                    <h3>您还没有创建任何服务</h3>
                    <p>点击右上角的"创建服务"按钮开始添加您的第一个服务吧！</p>
                </div>
            `;
            return;
        }
        
        // 清空容器
        serviceGrid.innerHTML = '';
        
        // 为每个服务创建卡片
        this.services.forEach(service => {
            const card = this.generateServiceCard(service);
            serviceGrid.appendChild(card);
            
            // 绑定事件
            this.attachCardEventListeners(card);
        });
    }
}

/**
 * 当DOM加载完成后初始化
 */
document.addEventListener('DOMContentLoaded', () => {
    // 创建服务管理实例
    window.serviceManagement = new ServiceManagement();
    
    // 添加CSS样式
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
        }
        
        .notification.success {
            background-color: rgba(74, 108, 247, 0.95);
            color: #fff;
        }
        
        .notification.error {
            background-color: rgba(255, 76, 97, 0.95);
            color: #fff;
        }
        
        .notification.warning {
            background-color: rgba(255, 145, 0, 0.95);
            color: #fff;
        }
        
        .notification.info {
            background-color: rgba(32, 188, 235, 0.95);
            color: #fff;
        }
        
        .notification.show {
            transform: translateX(0);
            opacity: 1;
        }
        
        /* 服务卡片加载状态 */
        .service-card.loading {
            position: relative;
            pointer-events: none;
        }
        
        .service-card.loading::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(255, 255, 255, 0.7);
            z-index: 10;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        
        .service-card.loading::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 30px;
            height: 30px;
            border: 3px solid #f3f3f3;
            border-radius: 50%;
            border-top: 3px solid #4A6CF7;
            z-index: 11;
            animation: spin 1s linear infinite;
        }
        
        /* 表单加载状态 */
        form.loading {
            position: relative;
            pointer-events: none;
        }
        
        form.loading::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(255, 255, 255, 0.7);
            z-index: 10;
        }
        
        form.loading::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 30px;
            height: 30px;
            border: 3px solid #f3f3f3;
            border-radius: 50%;
            border-top: 3px solid #4A6CF7;
            z-index: 11;
            animation: spin 1s linear infinite;
        }
        
        /* 加载指示器 */
        .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px;
            width: 100%;
            background-color: #f9f9f9;
            border-radius: 8px;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
        }
        
        .loading-spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #f3f3f3;
            border-radius: 50%;
            border-top: 4px solid #4A6CF7;
            animation: spin 1s linear infinite;
            margin-bottom: 20px;
        }
        
        /* 空状态 */
        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px;
            width: 100%;
            background-color: #f9f9f9;
            border-radius: 8px;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
            text-align: center;
        }
        
        .empty-state i {
            font-size: 48px;
            color: #c2c6cc;
            margin-bottom: 16px;
        }
        
        .empty-state h3 {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 8px;
            color: #333;
        }
        
        .empty-state p {
            font-size: 14px;
            color: #888;
            margin-bottom: 16px;
        }
        
        .empty-state.error i {
            color: #ff4c61;
        }
        
        .empty-state button {
            background-color: #4A6CF7;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 16px;
            cursor: pointer;
            font-weight: 500;
        }
        
        /* 淡出动画 */
        @keyframes fadeOut {
            0% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-20px); }
        }
        
        @keyframes spin {
            0% { transform: translate(-50%, -50%) rotate(0deg); }
            100% { transform: translate(-50%, -50%) rotate(360deg); }
        }
        
        /* 删除按钮样式 */
        .btn-delete {
            background-color: #ff4c61;
            color: white;
        }
        
        .btn-delete:hover {
            background-color: #e63e51;
        }
    `;
    document.head.appendChild(style);
}); 