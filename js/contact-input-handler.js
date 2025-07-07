/**
 * 启用或禁用输入框
 * @param {string} inputId - 输入框ID
 * @param {Event} event - 事件对象
 */
function enableInput(inputId, event) {
    if (event) {
        event.preventDefault();
    }
    
    const inputField = document.getElementById(inputId);
    if (!inputField) return;
    
    // 切换输入框的禁用状态
    inputField.disabled = !inputField.disabled;
    
    // 获取修改按钮
    const modifyButton = inputField.nextElementSibling;
    if (modifyButton && modifyButton.classList.contains('btn-modify')) {
        // 切换按钮文本
        modifyButton.textContent = inputField.disabled ? '修改' : '确认';
        
        // 如果启用了输入框，则聚焦
        if (!inputField.disabled) {
            inputField.focus();
        } else {
            // 如果禁用了输入框，则保存更改
            saveContactInfo(inputId, inputField.value);
        }
    }
}

/**
 * 保存联系方式信息
 * @param {string} fieldType - 字段类型（phone或email）
 * @param {string} value - 字段值
 */
async function saveContactInfo(fieldType, value) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'index.html';
            return;
        }
        
        // 创建要更新的数据对象
        const data = {};
        data[fieldType] = value;
        
        // 发送更新请求
        const response = await fetch('/api/user', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error(`更新${fieldType === 'phone' ? '手机号码' : '邮箱地址'}失败: ${response.status}`);
        }
        
        // 显示成功消息
        showToast(`${fieldType === 'phone' ? '手机号码' : '邮箱地址'}更新成功`);
        
    } catch (error) {
        console.error(`保存${fieldType}失败:`, error);
        showToast(`保存${fieldType === 'phone' ? '手机号码' : '邮箱地址'}失败，请重试`, 'error');
        
        // 如果保存失败，重新加载用户数据
        await loadUserData();
    }
} 