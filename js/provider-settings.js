/**
 * 服务商账号设置功能
 */
// API请求函数，支持重试和更好的错误处理
async function apiRequest(endpoint, method = 'GET', data = null, retries = 3) {
    try {
        // 去除URL中可能的查询参数（避免与服务器端路由匹配出问题）
        let cleanEndpoint = endpoint.split('?')[0];
        
        const token = localStorage.getItem('token');
        if (!token && cleanEndpoint !== '/api/login' && cleanEndpoint !== '/api/register') {
            throw new Error('未登录');
        }
        
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : '',
                'X-Requested-With': 'XMLHttpRequest'
            }
        };
        
        if (data) {
            // 过滤掉undefined值，但保留null值（因为null可能是有意义的）
            const cleanData = Object.fromEntries(
                Object.entries(data).filter(([_, v]) => v !== undefined)
            );
            options.body = JSON.stringify(cleanData);
        }
        
        console.log(`发送${method}请求到: ${cleanEndpoint}`);
        if (data) console.log('请求数据:', data);
        
        const response = await fetch(cleanEndpoint, options);
        
        // 检查响应状态
        if (!response.ok) {
            console.error(`API请求失败: ${response.status} ${response.statusText}`);
            
            // 尝试获取响应内容，无论是JSON还是文本
            let errorData;
            const contentType = response.headers.get('content-type');
            let responseText = '';
            
            try {
                responseText = await response.text();
                
                // 检查是否是HTML错误页面
                if (responseText.includes('<!DOCTYPE html>') || 
                    responseText.includes('<html>') || 
                    responseText.includes('<body>')) {
                    console.error('收到HTML错误响应:', responseText.substring(0, 200));
                    errorData = { 
                        message: `服务器返回了HTML错误页面 (${response.status}): ${response.statusText}`,
                        isHtml: true
                    };
                } else if (contentType && contentType.includes('application/json')) {
                    // 尝试解析JSON
                    try {
                        errorData = JSON.parse(responseText);
                    } catch (e) {
                        console.error('解析JSON错误响应失败:', e);
                        errorData = { message: `无法解析JSON错误响应: ${e.message}` };
                    }
                } else {
                    console.error('非JSON错误响应:', responseText);
                    errorData = { message: `服务器返回了非JSON响应 (${response.status}): ${responseText.substring(0, 100)}...` };
                }
            } catch (e) {
                console.error('读取错误响应失败:', e);
                errorData = { message: `无法读取错误响应: ${e.message}` };
            }
            
            // 对于特定的错误码，可以进行重试
            if (retries > 0 && [405, 408, 429, 500, 502, 503, 504].includes(response.status)) {
                console.log(`请求失败 (${response.status})，将在1秒后重试，剩余重试次数: ${retries-1}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                return apiRequest(endpoint, method, data, retries - 1);
            }
            
            throw new Error(errorData.message || `请求失败: ${response.status}`);
        }
        
        // 检查响应内容类型
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const jsonData = await response.json();
            console.log('API响应数据:', jsonData);
            return jsonData;
        } else {
            const text = await response.text();
            console.warn('收到非JSON响应:', text.substring(0, 100));
            
            // 检查是否是HTML错误页面
            if (text.includes('<!DOCTYPE html>') || 
                text.includes('<html>') || 
                text.includes('<body>')) {
                console.error('收到HTML响应:', text.substring(0, 200));
                throw new Error(`服务器返回了HTML页面而不是JSON数据 (${response.status})`);
            }
            
            // 尝试解析为JSON
            try {
                const jsonData = JSON.parse(text);
                console.log('API响应数据(解析自文本):', jsonData);
                return jsonData;
            } catch (e) {
                console.error('响应不是有效的JSON:', e);
                throw new Error('服务器返回了非JSON格式的数据');
            }
        }
    } catch (error) {
        console.error('API请求出错:', error);
        throw error;
    }
}

/**
 * 加载服务商账号信息
 */
async function loadProviderInfo() {
    try {
        showLoading('正在加载账号信息...');
        
        // 添加随机参数，避免缓存
        const timestamp = new Date().getTime();
        const response = await apiRequest(`/api/user?_=${timestamp}`);
        
        if (response && response.user) {
            const user = response.user;
            console.log('获取到的用户信息:', user);
            
            // 定义字段映射，将API返回的字段名映射到表单元素ID
            const fieldMappings = {
                'username': 'username',
                'nickname': 'nickname',
                'gender': 'gender',
                'bio': 'bio',
                'phone': 'phone',
                'email': 'email',
                'service_phone': 'servicePhone'
            };
            
            // 设置表单值，添加更好的 null 值处理
            Object.entries(fieldMappings).forEach(([apiField, elementId]) => {
                const value = user[apiField];
                const defaultValue = '';
                
                console.log(`设置用户字段 ${apiField} -> ${elementId}: ${value} (默认值: ${defaultValue})`);
                safeSetFormValue(elementId, value, defaultValue);
            });
            
            // 设置头像
            const avatarPreview = document.querySelector('.avatar-upload img');
            if (avatarPreview) {
                if (user.avatar_url && user.avatar_url !== 'null' && user.avatar_url !== 'undefined') {
                    avatarPreview.src = user.avatar_url;
                } else {
                    // 使用默认头像
                    avatarPreview.src = 'img/avatar-placeholder.jpg';
                }
            }
            
            // 设置侧边栏用户名
            const sidebarUsername = document.getElementById('sidebar-username');
            if (sidebarUsername) {
                const displayName = user.nickname || user.username || '服务商';
                sidebarUsername.textContent = displayName !== 'null' ? displayName : '服务商';
            }
            
            showNotification('账号信息加载成功', 'success');
        } else {
            console.error('加载账号信息失败:', response);
            showNotification('加载账号信息失败', 'error');
        }
    } catch (error) {
        console.error('加载账号信息出错:', error);
        showNotification(`加载账号信息出错: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// 填充商家信息表单
async function loadBusinessInfo() {
    const businessForm = document.getElementById('business-form');
    if (!businessForm) return;
    
    try {
        showLoading('正在加载商家信息...');
        
        // 添加随机参数，避免缓存
        const timestamp = new Date().getTime();
        const response = await apiRequest(`/api/provider/business?_=${timestamp}`);
        
        if (response && response.business_info) {
            const info = response.business_info;
            console.log('获取到的商家信息:', info);
            
            // 定义字段映射，将API返回的字段名映射到表单元素ID
            const fieldMappings = {
                'business_name': 'merchantName',
                'business_description': 'merchantIntro',
                'business_type': 'businessType',
                'license_no': 'licenseNo',
                'province': 'province',
                'city': 'city',
                'district': 'district',
                'detail_address': 'detailAddress',
                'holiday_desc': 'holidayDesc',
                'phone': 'contact-phone',
                'service_phone': 'contact-service-phone'
            };
            
            // 填充表单字段，处理null值
            Object.entries(fieldMappings).forEach(([apiField, elementId]) => {
                const value = info[apiField];
                const defaultValue = apiField.includes('time') ? 
                    (apiField === 'open_time' ? '08:00' : '21:00') : '';
                
                console.log(`设置字段 ${apiField} -> ${elementId}: ${value} (默认值: ${defaultValue})`);
                safeSetFormValue(elementId, value, defaultValue);
            });
            
            // 单独设置营业时间，因为它们有特殊处理
            safeSetFormValue('openTime', info.open_time, '08:00');
            safeSetFormValue('closeTime', info.close_time, '21:00');
            
            showNotification('商家信息加载成功', 'success');
        } else {
            console.error('加载商家信息失败:', response);
            showNotification('加载商家信息失败', 'error');
        }
    } catch (error) {
        console.error('加载商家信息出错:', error);
        showNotification(`加载商家信息出错: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// 通过值设置select元素的选中项
function setSelectByValue(selectElement, value) {
    if (!selectElement || !selectElement.options) return;
    
    // 先检查是否有完全匹配的选项
    for (let i = 0; i < selectElement.options.length; i++) {
        if (selectElement.options[i].value === value) {
            selectElement.selectedIndex = i;
            return;
        }
    }
    
    // 如果没有完全匹配，尝试找最接近的选项
    if (selectElement.options.length > 0) {
        let bestMatchIndex = 0;
        let bestMatchDiff = Infinity;
        
        // 对于时间选择器，尝试找最接近的时间
        if (value.includes(':')) {
            const [hour, minute] = value.split(':').map(Number);
            const valueMinutes = hour * 60 + minute;
            
            for (let i = 0; i < selectElement.options.length; i++) {
                const optionValue = selectElement.options[i].value;
                if (optionValue.includes(':')) {
                    const [optHour, optMinute] = optionValue.split(':').map(Number);
                    const optMinutes = optHour * 60 + optMinute;
                    const diff = Math.abs(valueMinutes - optMinutes);
                    
                    if (diff < bestMatchDiff) {
                        bestMatchDiff = diff;
                        bestMatchIndex = i;
                    }
                }
            }
        }
        
        selectElement.selectedIndex = bestMatchIndex;
    }
}

// 页面加载完成后执行初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('页面加载完成，初始化设置页面...');
    
    // 初始化时间选择器
    initTimeSelectors();
    
    // 加载服务商信息
    loadProviderInfo();
    
    // 加载商家信息
    loadBusinessInfo();
    
    // 初始化支付功能（如果有）
    if (typeof initPaymentFunctions === 'function') {
        initPaymentFunctions();
    }
    
    // 初始化密码修改功能
    initPasswordChangeFeature();
    
    // 设置选项卡切换
    const tabButtons = document.querySelectorAll('.tab-btn');
    const settingsPanels = document.querySelectorAll('.settings-panel');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            
            // 移除所有活动状态
            tabButtons.forEach(btn => btn.classList.remove('active'));
            settingsPanels.forEach(panel => panel.classList.remove('active'));
            
            // 设置当前活动状态
            this.classList.add('active');
            document.getElementById(targetTab)?.classList.add('active');
        });
    });
    
    // 设置保存按钮事件
    const saveButtons = document.querySelectorAll('.btn-save');
    saveButtons.forEach(button => {
        button.addEventListener('click', async function() {
            const panel = this.closest('.settings-panel');
            if (panel) {
                const panelId = panel.id;
                try {
                    showLoading('正在保存...');
                    await saveSettings(panelId);
                    showNotification('保存成功', 'success');
                } catch (error) {
                    console.error('保存失败:', error);
                    showNotification(`保存失败: ${error.message}`, 'error');
                } finally {
                    hideLoading();
                }
            }
        });
    });

    // 头像上传预览
    const avatarInput = document.getElementById('avatar-input');
    const avatarPreview = document.getElementById('avatar-preview');
    const avatarOverlay = document.querySelector('.avatar-overlay');

    if (avatarOverlay) {
        avatarOverlay.addEventListener('click', () => {
            avatarInput.click();
        });
    }

    if (avatarInput) {
        avatarInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                const reader = new FileReader();
                
                reader.onload = function(e) {
                    avatarPreview.src = e.target.result;
                };
                
                reader.readAsDataURL(this.files[0]);
            }
        });
    }

    // 取消按钮点击事件
    const cancelButtons = document.querySelectorAll('.btn-cancel');
    cancelButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            // 刷新页面或重置表单
            if (confirm('确定要取消更改吗？所有未保存的修改将丢失。')) {
                location.reload();
            }
        });
    });

    // 修改按钮点击事件
    const modifyButtons = document.querySelectorAll('.btn-modify');
    modifyButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            // 获取相邻的输入框
            const inputField = this.parentElement.querySelector('input');
            if (inputField) {
                // 如果输入框是禁用状态，则启用它
                if (inputField.disabled) {
                    inputField.disabled = false;
                    inputField.focus();
                    this.textContent = '确认';
                } else {
                    // 否则，提交更改并禁用输入框
                    inputField.disabled = true;
                    this.textContent = '修改';
                    // 立即同步到表单（不依赖input的disabled状态）
                    // 不做AJAX，统一由"保存更改"按钮提交
                    showNotification('已修改，点击保存更改生效');
                }
            } else {
                // 如果是其他类型的修改按钮（如密码修改），可以显示相应的模态框
                const securityItem = this.closest('.security-item');
                if (securityItem) {
                    const securityType = securityItem.querySelector('h3').textContent;
                    if (securityType === '登录密码') {
                        const changePasswordModal = document.getElementById('changePasswordModal');
                        if (changePasswordModal) {
                            changePasswordModal.classList.add('active');
                        }
                    } else {
                        alert(`请修改您的${securityType}`);
                        // 实际项目中应该显示相应的模态框
                    }
                }
            }
        });
    });

    // 支付方式相关功能
    initPaymentFunctions();

    // 关闭修改登录密码模态框按钮
    const closeChangePasswordModalButtons = document.querySelectorAll('#changePasswordModal .close-btn, #changePasswordModal .cancel-modal');
    closeChangePasswordModalButtons.forEach(button => {
        button.addEventListener('click', function() {
            const changePasswordModal = document.getElementById('changePasswordModal');
            if (changePasswordModal) {
                changePasswordModal.classList.remove('active');
            }
        });
    });

    // 点击修改登录密码模态框外部关闭
    window.addEventListener('click', function(e) {
        const changePasswordModal = document.getElementById('changePasswordModal');
        if (changePasswordModal && e.target === changePasswordModal) {
            changePasswordModal.classList.remove('active');
        }
    });

    // 修改登录密码表单提交事件
    const changePasswordForm = document.getElementById('changePasswordForm');
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const oldPassword = document.getElementById('oldPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            // 这里可以添加密码验证逻辑
            if (newPassword === confirmPassword) {
                // 发送 AJAX 请求来保存新密码
                // 示例：
                // fetch('/api/change-password', {
                //     method: 'POST',
                //     headers: {
                //         'Content-Type': 'application/json'
                //     },
                //     body: JSON.stringify({
                //         oldPassword: oldPassword,
                //         newPassword: newPassword
                //     })
                // })
                // .then(response => response.json())
                // .then(data => {
                //     if (data.success) {
                //         const changePasswordModal = document.getElementById('changePasswordModal');
                //         if (changePasswordModal) {
                //             changePasswordModal.classList.remove('active');
                //         }
                //         showNotification('密码修改成功');
                //     } else {
                //         showNotification('密码修改失败：' + data.message);
                //     }
                // })
                // .catch(error => {
                //     showNotification('密码修改失败：网络错误');
                // });
                alert('密码修改成功（模拟）');
                const changePasswordModal = document.getElementById('changePasswordModal');
                if (changePasswordModal) {
                    changePasswordModal.classList.remove('active');
                }
            } else {
                showNotification('新密码和确认密码不一致');
            }
        });
    }
    // 联系方式保存按钮
    const contactForm = document.querySelector('#profile .settings-section:nth-child(2) .settings-form');
    const contactSaveBtn = document.querySelector('#profile .settings-section:nth-child(2) ~ .form-actions .btn-save') || document.querySelector('#profile .form-actions .btn-save');
    if (contactForm && contactSaveBtn) {
        contactSaveBtn.addEventListener('click', async function(e) {
            // 只保存联系方式
            if (!contactForm.contains(e.target)) return;
            e.preventDefault();
            const dataToUpdate = {
                phone: document.getElementById('contact-phone')?.value || '',
                email: document.getElementById('contact-email')?.value || '',
                service_phone: document.getElementById('contact-service-phone')?.value || ''
            };
            try {
                await apiRequest('/api/user', 'PUT', dataToUpdate);
                showNotification('联系方式已保存');
                loadProviderInfo();
            } catch (err) {}
        });
    }
});

/**
 * 初始化支付方式相关功能
 */
function initPaymentFunctions() {
    // 获取模态框元素
    const paymentEditModal = document.getElementById('paymentEditModal');
    const paymentAddModal = document.getElementById('paymentAddModal');
    
    // 编辑按钮点击事件
    const editButtons = document.querySelectorAll('.payment-actions .btn-edit');
    editButtons.forEach(button => {
        button.addEventListener('click', function() {
            const paymentItem = this.closest('.payment-item');
            const paymentInfo = paymentItem.querySelector('.payment-info');
            const paymentType = paymentInfo.querySelector('h3').textContent;
            const paymentDetails = paymentInfo.querySelector('p').textContent;
            
            // 设置表单值
            document.getElementById('paymentId').value = Math.random().toString(36).substr(2, 9); // 模拟ID
            
            if (paymentType === '银行卡') {
                document.getElementById('paymentType').value = 'bank';
                // 显示银行卡表单项，隐藏其他
                document.querySelectorAll('.payment-type-bank').forEach(el => el.style.display = 'block');
                document.querySelectorAll('.payment-type-alipay').forEach(el => el.style.display = 'none');
                
                // 从详情中提取银行名称和卡号
                const bankMatch = paymentDetails.match(/(.*?)\s*\((.*?)\)/);
                if (bankMatch) {
                    // 设置银行选择框
                    const bankSelect = document.getElementById('bankName');
                    for (let i = 0; i < bankSelect.options.length; i++) {
                        if (bankSelect.options[i].text === bankMatch[1]) {
                            bankSelect.selectedIndex = i;
                            break;
                        }
                    }
                    
                    // 设置卡号（这里使用模拟数据）
                    document.getElementById('cardNumber').value = '6222021234567890123';
                    document.getElementById('cardHolder').value = '李服务';
                }
            } else if (paymentType === '支付宝') {
                document.getElementById('paymentType').value = 'alipay';
                // 显示支付宝表单项，隐藏其他
                document.querySelectorAll('.payment-type-bank').forEach(el => el.style.display = 'none');
                document.querySelectorAll('.payment-type-alipay').forEach(el => el.style.display = 'block');
                
                // 从详情中提取支付宝账号
                const alipayMatch = paymentDetails.match(/已绑定\s*\((.*?)\)/);
                if (alipayMatch) {
                    document.getElementById('alipayAccount').value = '13912345678';
                    document.getElementById('alipayName').value = '李服务';
                }
            }
            
            // 显示模态框
            paymentEditModal.classList.add('active');
        });
    });
    
    // 删除按钮点击事件
    const deleteButtons = document.querySelectorAll('.payment-actions .btn-delete');
    deleteButtons.forEach(button => {
        button.addEventListener('click', function() {
            const paymentItem = this.closest('.payment-item');
            const paymentInfo = paymentItem.querySelector('.payment-info');
            const paymentType = paymentInfo.querySelector('h3').textContent;
            const paymentDetails = paymentInfo.querySelector('p').textContent;
            
            // 确认删除
            if (confirm(`确定要删除此${paymentType}收款方式吗？`)) {
                // 模拟删除操作
                paymentItem.style.opacity = '0';
                setTimeout(() => {
                    paymentItem.remove();
                    showNotification(`${paymentType}收款方式已删除`);
                }, 300);
            }
        });
    });
    
    // 添加支付方式按钮点击事件
    const addPaymentButton = document.querySelector('.btn-add-payment');
    if (addPaymentButton) {
        addPaymentButton.addEventListener('click', function() {
            // 重置表单
            document.querySelectorAll('.payment-form').forEach(form => {
                form.classList.remove('active');
                form.style.display = 'none';
            });
            document.querySelectorAll('.payment-type-option').forEach(option => {
                option.classList.remove('active');
            });
            document.getElementById('paymentAddForm').style.display = 'none';
            
            // 显示模态框
            paymentAddModal.classList.add('active');
        });
    }
    
    // 支付方式选择
    const paymentTypeOptions = document.querySelectorAll('.payment-type-option');
    paymentTypeOptions.forEach(option => {
        option.addEventListener('click', function() {
            const paymentType = this.dataset.type;
            
            // 更新选中状态
            paymentTypeOptions.forEach(opt => opt.classList.remove('active'));
            this.classList.add('active');
            
            // 显示对应表单
            document.getElementById('newPaymentType').value = paymentType;
            document.getElementById('paymentAddForm').style.display = 'block';
            
            // 隐藏所有表单，然后显示选中的表单
            document.querySelectorAll('.payment-form').forEach(form => {
                form.classList.remove('active');
                form.style.display = 'none';
            });
            
            const selectedForm = document.getElementById(`${paymentType}Form`);
            if (selectedForm) {
                selectedForm.classList.add('active');
                selectedForm.style.display = 'block';
            }
        });
    });
    
    // 表单提交事件
    const paymentEditForm = document.getElementById('paymentEditForm');
    if (paymentEditForm) {
        paymentEditForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const paymentType = document.getElementById('paymentType').value;
            
            // 模拟保存操作
            setTimeout(() => {
                // 关闭模态框
                paymentEditModal.classList.remove('active');
                
                // 显示成功通知
                showNotification('收款方式已更新');
                
                // 实际项目中应该刷新列表
                updatePaymentItemDisplay(paymentType);
            }, 500);
        });
    }
    
    const paymentAddForm = document.getElementById('paymentAddForm');
    if (paymentAddForm) {
        paymentAddForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const paymentType = document.getElementById('newPaymentType').value;
            
            // 模拟添加操作
            setTimeout(() => {
                // 关闭模态框
                paymentAddModal.classList.remove('active');
                
                // 显示成功通知
                showNotification('新的收款方式已添加');
                
                // 添加新的支付方式到列表
                addNewPaymentItem(paymentType);
            }, 500);
        });
    }
    
    // 关闭模态框按钮
    const closeButtons = document.querySelectorAll('.close-btn, .cancel-modal');
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            paymentEditModal.classList.remove('active');
            paymentAddModal.classList.remove('active');
        });
    });
    
    // 点击模态框外部关闭
    window.addEventListener('click', function(e) {
        if (e.target === paymentEditModal) {
            paymentEditModal.classList.remove('active');
        }
        if (e.target === paymentAddModal) {
            paymentAddModal.classList.remove('active');
        }
    });
}

/**
 * 更新支付方式显示
 */
function updatePaymentItemDisplay(paymentType) {
    const paymentItems = document.querySelectorAll('.payment-item');
    
    paymentItems.forEach(item => {
        const itemType = item.querySelector('h3').textContent;
        
        if ((paymentType === 'bank' && itemType === '银行卡') || 
            (paymentType === 'alipay' && itemType === '支付宝')) {
            
            // 添加更新效果
            item.style.backgroundColor = '#f5f8ff';
            setTimeout(() => {
                item.style.backgroundColor = '';
            }, 1000);
        }
    });
}

/**
 * 添加新的支付方式到列表
 */
function addNewPaymentItem(paymentType) {
    const paymentMethods = document.querySelector('.payment-methods');
    const addButton = document.querySelector('.btn-add-payment');
    
    if (!paymentMethods || !addButton) return;
    
    let newItem = document.createElement('div');
    newItem.className = 'payment-item';
    newItem.style.opacity = '0';
    
    let html = '';
    
    if (paymentType === 'bank') {
        const bankName = document.getElementById('newBankName');
        const selectedBank = bankName.options[bankName.selectedIndex].text;
        
        html = `
            <div class="payment-info">
                <h3>银行卡</h3>
                <p>${selectedBank} (****6789)</p>
            </div>
            <div class="payment-actions">
                <button class="btn-edit">编辑</button>
                <button class="btn-delete">删除</button>
            </div>
        `;
    } else if (paymentType === 'alipay') {
        html = `
            <div class="payment-info">
                <h3>支付宝</h3>
                <p>已绑定 (139****5678)</p>
            </div>
            <div class="payment-actions">
                <button class="btn-edit">编辑</button>
                <button class="btn-delete">删除</button>
            </div>
        `;
    } else if (paymentType === 'wechat') {
        html = `
            <div class="payment-info">
                <h3>微信支付</h3>
                <p>已绑定 (微信用户)</p>
            </div>
            <div class="payment-actions">
                <button class="btn-edit">编辑</button>
                <button class="btn-delete">删除</button>
            </div>
        `;
    }
    
    newItem.innerHTML = html;
    
    // 插入到添加按钮前面
    paymentMethods.insertBefore(newItem, addButton);
    
    // 添加淡入效果
    setTimeout(() => {
        newItem.style.opacity = '1';
    }, 10);
    
    // 为新添加的按钮绑定事件
    const editBtn = newItem.querySelector('.btn-edit');
    const deleteBtn = newItem.querySelector('.btn-delete');
    
    if (editBtn) {
        editBtn.addEventListener('click', function() {
            alert('编辑功能将在下一版本实现');
        });
    }
    
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function() {
            if (confirm('确定要删除此收款方式吗？')) {
                newItem.style.opacity = '0';
                setTimeout(() => {
                    newItem.remove();
                    showNotification('收款方式已删除');
                }, 300);
            }
        });
    }
}

/**
 * 显示加载指示器
 * @param {string} message - 加载提示信息
 */
function showLoading(message = '加载中...') {
    // 检查是否已存在加载指示器
    let loader = document.getElementById('global-loader');
    
    // 如果不存在，创建一个
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'global-loader';
        loader.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        `;
        
        const loaderContent = document.createElement('div');
        loaderContent.style.cssText = `
            background-color: white;
            padding: 20px;
            border-radius: 5px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
            text-align: center;
        `;
        
        const spinner = document.createElement('div');
        spinner.style.cssText = `
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            margin: 0 auto 10px;
            animation: spin 1s linear infinite;
        `;
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        
        const messageElement = document.createElement('div');
        messageElement.id = 'loader-message';
        messageElement.textContent = message;
        
        loaderContent.appendChild(spinner);
        loaderContent.appendChild(messageElement);
        loader.appendChild(loaderContent);
        document.head.appendChild(style);
        document.body.appendChild(loader);
    } else {
        // 如果已存在，更新消息
        const messageElement = document.getElementById('loader-message');
        if (messageElement) {
            messageElement.textContent = message;
        }
        
        // 确保显示
        loader.style.display = 'flex';
    }
}

/**
 * 隐藏加载指示器
 */
function hideLoading() {
    const loader = document.getElementById('global-loader');
    if (loader) {
        loader.style.display = 'none';
    }
}

/**
 * 显示通知消息
 * @param {string} message - 通知消息
 * @param {string} type - 通知类型 (success, error, warning, info)
 * @param {number} duration - 显示时长（毫秒）
 */
function showNotification(message, type = 'info', duration = 3000) {
    // 创建通知容器（如果不存在）
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
        `;
        document.body.appendChild(container);
    }
    
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        margin-bottom: 10px;
        padding: 15px 20px;
        border-radius: 4px;
        box-shadow: 0 3px 6px rgba(0, 0, 0, 0.16);
        color: white;
        font-size: 14px;
        max-width: 300px;
        word-break: break-word;
        transition: all 0.3s ease;
        opacity: 0;
        transform: translateX(50px);
    `;
    
    // 根据类型设置背景色
    switch (type) {
        case 'success':
            notification.style.backgroundColor = '#4CAF50';
            break;
        case 'error':
            notification.style.backgroundColor = '#F44336';
            break;
        case 'warning':
            notification.style.backgroundColor = '#FFC107';
            notification.style.color = '#333';
            break;
        case 'info':
        default:
            notification.style.backgroundColor = '#2196F3';
            break;
    }
    
    // 设置消息内容
    notification.textContent = message;
    
    // 添加到容器
    container.appendChild(notification);
    
    // 显示通知（使用setTimeout以确保CSS过渡效果生效）
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 10);
    
    // 自动关闭
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(50px)';
        
        // 移除元素
        setTimeout(() => {
            if (container.contains(notification)) {
                container.removeChild(notification);
            }
        }, 300);
    }, duration);
}

/**
 * 保存设置
 * @param {string} panelId - 面板ID
 */
async function saveSettings(panelId) {
    try {
        showLoading('正在保存设置...');
        
        console.log('保存设置，面板ID:', panelId);
        
        switch (panelId) {
            case 'business':
                await saveBusinessInfo();
                break;
            case 'profile':  // 修正：从 'account' 改为 'profile'
                await saveAccountInfo();
                break;
            case 'security':
                await saveSecuritySettings();
                break;
            case 'notification':
                await saveNotificationSettings();
                break;
            case 'payment':
                // 支付设置保存逻辑（如果有）
                console.log('保存支付设置');
                break;
            default:
                console.error('未知的面板ID:', panelId);
                showNotification('未知的设置类型', 'error');
                return;
        }
        
        showNotification('设置已保存', 'success');
    } catch (error) {
        console.error('保存设置失败:', error);
        showNotification(`保存失败: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

/**
 * 保存商家信息
 */
async function saveBusinessInfo() {
    try {
        // 收集表单数据，使用安全的方式获取表单值
        const formData = {
            business_name: document.getElementById('merchantName')?.value?.trim(),
            business_description: document.getElementById('merchantIntro')?.value?.trim(),
            business_type: document.getElementById('businessType')?.value?.trim(),
            license_no: document.getElementById('licenseNo')?.value?.trim(),
            province: document.getElementById('province')?.value?.trim(),
            city: document.getElementById('city')?.value?.trim(),
            district: document.getElementById('district')?.value?.trim(),
            detail_address: document.getElementById('detailAddress')?.value?.trim(),
            open_time: document.getElementById('openTime')?.value,
            close_time: document.getElementById('closeTime')?.value,
            holiday_desc: document.getElementById('holidayDesc')?.value?.trim(),
            phone: document.getElementById('contact-phone')?.value?.trim(),
            service_phone: document.getElementById('contact-service-phone')?.value?.trim()
        };
        
        // 验证必填字段
        if (!formData.business_name) {
            throw new Error('商家名称不能为空');
        }
        
        // 验证营业时间
        if (formData.open_time && formData.close_time && formData.open_time >= formData.close_time) {
            throw new Error('营业时间设置错误：结束时间必须晚于开始时间');
        }
        
        // 发送请求
        console.log('保存商家信息:', formData);
        const response = await apiRequest('/api/provider/business', 'PUT', formData);
        
        if (response && response.message) {
            showNotification(response.message, 'success');
        } else {
            showNotification('商家信息保存成功', 'success');
        }
        
        // 如果响应中包含更新后的信息，可以更新表单
        if (response && response.business_info) {
            // 重新加载商家信息以确保表单显示最新数据
            await loadBusinessInfo();
        }
        
        return response;
    } catch (error) {
        console.error('保存商家信息失败:', error);
        showNotification(`保存失败: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * 保存账号信息
 */
async function saveAccountInfo() {
    try {
        // 收集表单数据，使用更安全的方式
        const formData = {
            username: document.getElementById('username')?.value?.trim() || '',
            nickname: document.getElementById('nickname')?.value?.trim() || '',
            gender: document.getElementById('gender')?.value || '',
            bio: document.getElementById('bio')?.value?.trim() || '',
            phone: document.getElementById('phone')?.value?.trim() || '',
            email: document.getElementById('email')?.value?.trim() || '',
            service_phone: document.getElementById('servicePhone')?.value?.trim() || ''
        };
        
        // 验证必填字段
        if (!formData.username) {
            throw new Error('用户名不能为空');
        }
        
        if (!formData.phone) {
            throw new Error('电话号码不能为空');
        }
        
        // 如果有头像上传
        const avatarInput = document.getElementById('avatarFile');
        if (avatarInput && avatarInput.files && avatarInput.files.length > 0) {
            // 这里应该有头像处理逻辑，可以使用 FormData 上传
            // 由于头像上传需要单独的接口，这里只是占位
            console.log('需要上传头像');
            
            try {
                // 创建FormData对象上传文件
                const formData = new FormData();
                formData.append('avatar', avatarInput.files[0]);
                
                // 发送头像上传请求
                const avatarResponse = await fetch('/api/user/avatar', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: formData
                });
                
                if (!avatarResponse.ok) {
                    console.error('头像上传失败:', avatarResponse.statusText);
                    // 继续保存其他信息，但显示头像上传失败的提示
                    showNotification('头像上传失败，但其他信息将继续保存', 'warning');
                } else {
                    const result = await avatarResponse.json();
                    console.log('头像上传成功:', result);
                    
                    // 如果API返回了新的头像URL，更新预览
                    if (result && result.avatar_url) {
                        const avatarPreview = document.querySelector('.avatar-upload img');
                        if (avatarPreview) {
                            avatarPreview.src = result.avatar_url;
                        }
                    }
                }
            } catch (error) {
                console.error('头像上传出错:', error);
                // 继续保存其他信息，但显示头像上传失败的提示
                showNotification(`头像上传失败: ${error.message}，但其他信息将继续保存`, 'warning');
            }
        }
        
        // 发送请求保存账号信息
        console.log('保存账号信息:', formData);
        const response = await apiRequest('/api/user', 'PUT', formData);
        
        if (response && response.message) {
            showNotification(response.message, 'success');
        } else {
            showNotification('账号信息保存成功', 'success');
        }
        
        // 如果响应中包含更新后的用户信息，可以更新表单
        if (response && response.user) {
            // 重新加载用户信息以确保表单显示最新数据
            await loadProviderInfo();
        }
        
        return response;
    } catch (error) {
        console.error('保存账号信息失败:', error);
        showNotification(`保存失败: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * 保存安全设置（密码修改）
 */
async function saveSecuritySettings() {
    // 收集表单数据
    const currentPassword = document.getElementById('currentPassword')?.value || '';
    const newPassword = document.getElementById('newPassword')?.value || '';
    const confirmPassword = document.getElementById('confirmPassword')?.value || '';
    
    // 验证必填字段
    if (!currentPassword) {
        throw new Error('请输入当前密码');
    }
    
    if (!newPassword) {
        throw new Error('请输入新密码');
    }
    
    if (!confirmPassword) {
        throw new Error('请确认新密码');
    }
    
    // 验证两次密码输入是否一致
    if (newPassword !== confirmPassword) {
        throw new Error('两次输入的密码不一致');
    }
    
    // 验证密码强度
    const strengthScore = document.getElementById('strengthScore')?.textContent;
    if (strengthScore === '弱') {
        throw new Error('密码强度太弱，请使用更强的密码');
    }
    
    // 构建请求数据
    const data = {
        current_password: currentPassword,
        new_password: newPassword
    };
    
    // 发送请求
    console.log('保存密码设置');
    const response = await apiRequest('/api/user/password', 'PUT', data);
    
    if (response && response.message) {
        showNotification(response.message, 'success');
    } else {
        showNotification('密码修改成功', 'success');
    }
    
    // 清空密码输入框
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    
    // 重置密码强度指示器
    const strengthBar = document.getElementById('strengthBar');
    if (strengthBar) {
        strengthBar.className = 'h-full password-strength-bar bg-danger w-0 rounded-full';
    }
    
    const strengthTextElement = document.getElementById('strengthScore');
    if (strengthTextElement) {
        strengthTextElement.textContent = '弱';
        strengthTextElement.className = 'text-danger';
    }
    
    // 重置密码检查图标
    ['lengthCheck', 'upperCheck', 'numberCheck', 'specialCheck'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.className = 'fa fa-times text-danger mr-1';
        }
    });
    
    return response;
}

/**
 * 保存通知设置
 */
async function saveNotificationSettings() {
    // 收集表单数据
    const bookingNotify = document.getElementById('booking-notify')?.checked || false;
    const reviewNotify = document.getElementById('review-notify')?.checked || false;
    const systemNotify = document.getElementById('system-notify')?.checked || false;
    const marketingNotify = document.getElementById('marketing-notify')?.checked || false;
    
    // 构建请求数据
    const data = {
        notification_settings: {
            types: {
                booking: {
                    enabled: bookingNotify
                },
                review: {
                    enabled: reviewNotify
                },
                system: {
                    enabled: systemNotify
                },
                marketing: {
                    enabled: marketingNotify
                }
            }
        }
    };
    
    // 发送请求
    console.log('保存通知设置:', data);
    const response = await apiRequest('/api/user/notification-settings', 'PUT', data);
    
    if (response && response.message) {
        showNotification(response.message, 'success');
    } else {
        showNotification('通知设置保存成功', 'success');
    }
    
    return response;
}

/**
 * 初始化时间选择器
 */
function initTimeSelectors() {
    const openTime = document.getElementById('openTime');
    const closeTime = document.getElementById('closeTime');
    
    if (!openTime || !closeTime) {
        console.warn("时间选择器元素不存在");
        return;
    }
    
    // 清空现有选项
    openTime.innerHTML = '';
    closeTime.innerHTML = '';
    
    // 生成时间选项 (00:00 - 23:30，每30分钟)
    for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
            const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            
            const openOption = document.createElement('option');
            openOption.value = timeString;
            openOption.textContent = timeString;
            openTime.appendChild(openOption);
            
            const closeOption = document.createElement('option');
            closeOption.value = timeString;
            closeOption.textContent = timeString;
            closeTime.appendChild(closeOption);
        }
    }
    
    // 添加最后一个23:59选项
    const lastOption = document.createElement('option');
    lastOption.value = '23:59';
    lastOption.textContent = '23:59';
    closeTime.appendChild(lastOption.cloneNode(true));
    
    // 设置默认值
    try {
        openTime.value = '08:00';
        closeTime.value = '21:00';
    } catch (e) {
        console.error("设置默认时间失败:", e);
    }
    
    // 添加事件监听，确保结束时间不能早于开始时间
    openTime.addEventListener('change', function() {
        const openTimeValue = this.value;
        const closeTimeValue = closeTime.value;
        
        if (openTimeValue >= closeTimeValue) {
            // 如果开始时间晚于或等于结束时间，自动调整结束时间
            let found = false;
            
            // 寻找下一个可用时间
            for (let i = 0; i < closeTime.options.length; i++) {
                if (closeTime.options[i].value > openTimeValue) {
                    closeTime.selectedIndex = i;
                    found = true;
                    break;
                }
            }
            
            // 如果没找到，设为最后一个时间
            if (!found && closeTime.options.length > 0) {
                closeTime.selectedIndex = closeTime.options.length - 1;
            }
        }
    });
    
    closeTime.addEventListener('change', function() {
        const openTimeValue = openTime.value;
        const closeTimeValue = this.value;
        
        if (closeTimeValue <= openTimeValue) {
            // 如果结束时间早于或等于开始时间，自动调整开始时间
            let found = false;
            
            // 寻找前一个可用时间
            for (let i = openTime.options.length - 1; i >= 0; i--) {
                if (openTime.options[i].value < closeTimeValue) {
                    openTime.selectedIndex = i;
                    found = true;
                    break;
                }
            }
            
            // 如果没找到，设为第一个时间
            if (!found && openTime.options.length > 0) {
                openTime.selectedIndex = 0;
            }
        }
    });
}

/**
 * 安全设置表单元素的值，处理null和undefined
 * @param {string} elementId - 元素ID
 * @param {*} value - 要设置的值
 * @param {string} defaultValue - 默认值，当value为null或undefined时使用
 * @returns {boolean} - 是否成功设置
 */
function safeSetFormValue(elementId, value, defaultValue = '') {
    const element = document.getElementById(elementId);
    if (!element) {
        console.warn(`元素 ${elementId} 不存在`);
        return false;
    }
    
    // 处理null和undefined以及字符串形式的'null'和'undefined'
    const valueToSet = (value === null || value === undefined || 
                        value === 'null' || value === 'undefined' || 
                        value === '') ? defaultValue : value;
    
    try {
        if (element.tagName === 'SELECT') {
            // 对于SELECT元素，先尝试直接设置值
            try {
                // 如果值为空，尝试选择第一个选项
                if (!valueToSet && element.options.length > 0) {
                    element.selectedIndex = 0;
                } else {
                    element.value = valueToSet;
                }
                
                // 如果设置失败（没有匹配的选项），尝试通过setSelectByValue
                if (element.value !== valueToSet && typeof setSelectByValue === 'function') {
                    setSelectByValue(element, valueToSet);
                }
            } catch (e) {
                console.error(`设置选择框 ${elementId} 的值失败:`, e);
                // 如果直接设置失败，尝试通过setSelectByValue
                if (typeof setSelectByValue === 'function') {
                    setSelectByValue(element, valueToSet);
                }
            }
        } else if (element.type === 'checkbox') {
            // 对于复选框，转换为布尔值
            element.checked = Boolean(valueToSet) && valueToSet !== 'false';
        } else {
            // 对于其他输入元素
            element.value = valueToSet;
        }
        return true;
    } catch (e) {
        console.error(`设置元素 ${elementId} 的值失败:`, e);
        return false;
    }
}

/**
 * 初始化密码修改功能
 */
function initPasswordChangeFeature() {
    // DOM 元素
    const currentPasswordInput = document.getElementById('currentPassword');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const strengthBar = document.getElementById('strengthBar');
    const strengthText = document.getElementById('strengthText');
    const strengthScore = document.getElementById('strengthScore');
    const lengthCheck = document.getElementById('lengthCheck');
    const upperCheck = document.getElementById('upperCheck');
    const numberCheck = document.getElementById('numberCheck');
    const specialCheck = document.getElementById('specialCheck');
    const confirmMessage = document.getElementById('confirmMessage');
    const saveBtn = document.getElementById('saveBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const successModal = document.getElementById('successModal');
    const closeModal = document.getElementById('closeModal');

    if (!currentPasswordInput || !newPasswordInput || !confirmPasswordInput) {
        console.warn('密码修改相关DOM元素未找到，跳过初始化密码修改功能');
        return;
    }

    // 密码显示切换
    document.querySelectorAll('input[type="password"]').forEach(input => {
        const toggleBtn = input.nextElementSibling;
        if (!toggleBtn) return;

        toggleBtn.addEventListener('click', () => {
            const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
            input.setAttribute('type', type);

            // 切换图标
            const icon = toggleBtn.querySelector('i');
            if (icon) {
                if (type === 'password') {
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                } else {
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            }
        });
    });

    // 密码强度检测
    if (newPasswordInput) {
        newPasswordInput.addEventListener('input', function() {
            const password = this.value;

            // 重置所有检查项
            if (lengthCheck) lengthCheck.className = 'fa fa-times text-danger mr-1';
            if (upperCheck) upperCheck.className = 'fa fa-times text-danger mr-1';
            if (numberCheck) numberCheck.className = 'fa fa-times text-danger mr-1';
            if (specialCheck) specialCheck.className = 'fa fa-times text-danger mr-1';

            // 检查密码长度
            if (password.length >= 8 && lengthCheck) {
                lengthCheck.className = 'fa fa-check text-success mr-1';
            }

            // 检查大写字母
            if (/[A-Z]/.test(password) && upperCheck) {
                upperCheck.className = 'fa fa-check text-success mr-1';
            }

            // 检查数字
            if (/[0-9]/.test(password) && numberCheck) {
                numberCheck.className = 'fa fa-check text-success mr-1';
            }

            // 检查特殊字符
            if (/[^A-Za-z0-9]/.test(password) && specialCheck) {
                specialCheck.className = 'fa fa-check text-success mr-1';
            }

            // 计算密码强度
            let strength = 0;
            if (password.length >= 8) strength++;
            if (/[A-Z]/.test(password)) strength++;
            if (/[0-9]/.test(password)) strength++;
            if (/[^A-Za-z0-9]/.test(password)) strength++;

            // 更新强度指示器
            if (strengthBar && strengthScore) {
                if (password.length === 0) {
                    strengthBar.className = 'h-full password-strength-bar bg-danger w-0 rounded-full';
                    strengthScore.textContent = '弱';
                    strengthScore.className = 'text-danger';
                } else if (strength <= 1) {
                    strengthBar.className = 'h-full password-strength-bar bg-danger w-1/4 rounded-full';
                    strengthScore.textContent = '弱';
                    strengthScore.className = 'text-danger';
                } else if (strength === 2) {
                    strengthBar.className = 'h-full password-strength-bar bg-warning w-1/2 rounded-full';
                    strengthScore.textContent = '中';
                    strengthScore.className = 'text-warning';
                } else if (strength === 3) {
                    strengthBar.className = 'h-full password-strength-bar bg-info w-3/4 rounded-full';
                    strengthScore.textContent = '强';
                    strengthScore.className = 'text-info';
                } else {
                    strengthBar.className = 'h-full password-strength-bar bg-success w-full rounded-full';
                    strengthScore.textContent = '非常强';
                    strengthScore.className = 'text-success';
                }
            }

            // 检查确认密码
            checkPasswordMatch();
        });
    }

    // 确认密码检查
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', checkPasswordMatch);
    }

    function checkPasswordMatch() {
        if (!newPasswordInput || !confirmPasswordInput || !confirmMessage) return;

        if (newPasswordInput.value !== confirmPasswordInput.value) {
            confirmMessage.classList.remove('hidden');
            confirmPasswordInput.classList.add('border-danger');
            confirmPasswordInput.classList.remove('border-gray-300');
        } else {
            confirmMessage.classList.add('hidden');
            confirmPasswordInput.classList.remove('border-danger');
            confirmPasswordInput.classList.add('border-gray-300');
        }
    }

    // 保存按钮点击事件
    if (saveBtn) {
        saveBtn.addEventListener('click', async function() {
            // 验证原密码
            if (!currentPasswordInput.value) {
                showError(currentPasswordInput, '请输入原密码');
                return;
            }

            // 验证新密码
            if (!newPasswordInput.value) {
                showError(newPasswordInput, '请输入新密码');
                return;
            }

            // 验证确认密码
            if (!confirmPasswordInput.value) {
                showError(confirmPasswordInput, '请确认新密码');
                return;
            }

            // 验证密码匹配
            if (newPasswordInput.value !== confirmPasswordInput.value) {
                showError(confirmPasswordInput, '两次输入的密码不一致');
                return;
            }

            // 验证密码强度（至少中等强度）
            if (strengthScore && strengthScore.textContent === '弱') {
                showError(newPasswordInput, '密码强度太弱，请使用更强的密码');
                return;
            }

            // 设置按钮状态为处理中
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fa fa-spinner fa-spin mr-2"></i> 处理中...';

            try {
                // 调用保存设置函数
                await saveSettings('security');
                
                // 显示成功提示
                if (successModal) {
                    successModal.classList.remove('opacity-0', 'pointer-events-none');
                    const modalContent = successModal.querySelector('div');
                    if (modalContent) {
                        modalContent.classList.remove('scale-95');
                        modalContent.classList.add('scale-100');
                    }
                }
            } catch (error) {
                // 显示错误信息
                showError(null, error.message || '密码修改失败，请稍后重试');
            } finally {
                // 重置按钮状态
                saveBtn.disabled = false;
                saveBtn.innerHTML = '保存更改';
            }
        });
    }

    // 取消按钮点击事件
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            if (confirm('确定要取消修改吗？所有未保存的更改将丢失。')) {
                // 重置表单
                currentPasswordInput.value = '';
                newPasswordInput.value = '';
                confirmPasswordInput.value = '';
                
                if (confirmMessage) {
                    confirmMessage.classList.add('hidden');
                }
                
                confirmPasswordInput.classList.remove('border-danger');
                confirmPasswordInput.classList.add('border-gray-300');

                // 重置密码强度指示器
                if (strengthBar) {
                    strengthBar.className = 'h-full password-strength-bar bg-danger w-0 rounded-full';
                }
                
                if (strengthScore) {
                    strengthScore.textContent = '弱';
                    strengthScore.className = 'text-danger';
                }
                
                if (lengthCheck) lengthCheck.className = 'fa fa-times text-danger mr-1';
                if (upperCheck) upperCheck.className = 'fa fa-times text-danger mr-1';
                if (numberCheck) numberCheck.className = 'fa fa-times text-danger mr-1';
                if (specialCheck) specialCheck.className = 'fa fa-times text-danger mr-1';
            }
        });
    }

    // 关闭模态框
    if (closeModal && successModal) {
        closeModal.addEventListener('click', function() {
            successModal.classList.add('opacity-0', 'pointer-events-none');
            const modalContent = successModal.querySelector('div');
            if (modalContent) {
                modalContent.classList.remove('scale-100');
                modalContent.classList.add('scale-95');
            }
        });
    }
}
