/**
 * 显示添加地址模态框
 */
function showAddAddressModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>添加新地址</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>地址标签</label>
                    <input type="text" id="address-label" placeholder="如：家、公司、学校等">
                </div>
                <div class="form-group">
                    <label>详细地址</label>
                    <textarea id="address-detail" placeholder="请输入详细地址"></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary modal-close">取消</button>
                <button class="btn-primary btn-confirm">保存</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 显示模态框
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
    
    // 关闭按钮事件
    const closeButtons = modal.querySelectorAll('.modal-close');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        });
    });
    
    // 保存按钮事件
    const confirmButton = modal.querySelector('.btn-confirm');
    confirmButton.addEventListener('click', async () => {
        const labelInput = modal.querySelector('#address-label');
        const detailInput = modal.querySelector('#address-detail');
        
        if (!labelInput.value.trim()) {
            showToast('请输入地址标签', 'error');
            return;
        }
        
        if (!detailInput.value.trim()) {
            showToast('请输入详细地址', 'error');
            return;
        }
        
        try {
            await addAddress(labelInput.value.trim(), detailInput.value.trim());
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        } catch (error) {
            console.error('添加地址失败:', error);
        }
    });
}

/**
 * 显示编辑地址模态框
 * @param {Object} address - 地址对象
 */
function showEditAddressModal(address) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>编辑地址</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>地址标签</label>
                    <input type="text" id="address-label" value="${address.label}" placeholder="如：家、公司、学校等">
                </div>
                <div class="form-group">
                    <label>详细地址</label>
                    <textarea id="address-detail" placeholder="请输入详细地址">${address.address}</textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary modal-close">取消</button>
                <button class="btn-primary btn-confirm">保存</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 显示模态框
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
    
    // 关闭按钮事件
    const closeButtons = modal.querySelectorAll('.modal-close');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        });
    });
    
    // 保存按钮事件
    const confirmButton = modal.querySelector('.btn-confirm');
    confirmButton.addEventListener('click', async () => {
        const labelInput = modal.querySelector('#address-label');
        const detailInput = modal.querySelector('#address-detail');
        
        if (!labelInput.value.trim()) {
            showToast('请输入地址标签', 'error');
            return;
        }
        
        if (!detailInput.value.trim()) {
            showToast('请输入详细地址', 'error');
            return;
        }
        
        try {
            await updateAddress(address.id, labelInput.value.trim(), detailInput.value.trim());
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        } catch (error) {
            console.error('更新地址失败:', error);
        }
    });
}

/**
 * 显示删除地址确认框
 * @param {string} addressId - 地址ID
 * @param {string} addressLabel - 地址标签
 */
function showDeleteAddressConfirmation(addressId, addressLabel) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>删除地址</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <p>确定要删除"${addressLabel}"地址吗？此操作不可恢复。</p>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary modal-close">取消</button>
                <button class="btn-danger btn-confirm">删除</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 显示模态框
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
    
    // 关闭按钮事件
    const closeButtons = modal.querySelectorAll('.modal-close');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        });
    });
    
    // 删除按钮事件
    const confirmButton = modal.querySelector('.btn-confirm');
    confirmButton.addEventListener('click', async () => {
        try {
            await deleteAddress(addressId);
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        } catch (error) {
            console.error('删除地址失败:', error);
        }
    });
}

/**
 * 添加地址
 * @param {string} label - 地址标签
 * @param {string} address - 地址内容
 */
async function addAddress(label, address) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'index.html';
            return;
        }

        // 发送添加地址请求
        const response = await fetch('/api/user/addresses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                label: label,
                address: address
            })
        });

        if (!response.ok) {
            throw new Error(`添加地址失败: ${response.status}`);
        }

        const result = await response.json();
        
        // 添加成功
        showToast('地址添加成功');
        
        // 重新加载地址列表
        await loadUserAddresses();
        
        return true;
    } catch (error) {
        console.error('添加地址失败:', error);
        showToast('添加地址失败，请重试', 'error');
        return false;
    }
}

/**
 * 更新地址
 * @param {string} addressId - 地址ID
 * @param {string} label - 地址标签
 * @param {string} address - 地址内容
 */
async function updateAddress(addressId, label, address) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'index.html';
            return;
        }

        // 发送更新地址请求
        const response = await fetch(`/api/user/addresses/${addressId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                label: label,
                address: address
            })
        });

        if (!response.ok) {
            throw new Error(`更新地址失败: ${response.status}`);
        }

        const result = await response.json();
        
        // 更新成功
        showToast('地址更新成功');
        
        // 重新加载地址列表
        await loadUserAddresses();
        
        return true;
    } catch (error) {
        console.error('更新地址失败:', error);
        showToast('更新地址失败，请重试', 'error');
        return false;
    }
}

/**
 * 删除地址
 * @param {string} addressId - 地址ID
 */
async function deleteAddress(addressId) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'index.html';
            return;
        }

        // 发送删除地址请求
        const response = await fetch(`/api/user/addresses/${addressId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`删除地址失败: ${response.status}`);
        }
        
        // 删除成功
        showToast('地址删除成功');
        
        // 重新加载地址列表
        await loadUserAddresses();
        
        return true;
    } catch (error) {
        console.error('删除地址失败:', error);
        showToast('删除地址失败，请重试', 'error');
        return false;
    }
}

/**
 * 加载用户地址列表
 */
async function loadUserAddresses() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'index.html';
            return;
        }

        // 获取地址列表
        const response = await fetch('/api/user/addresses', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`获取地址列表失败: ${response.status}`);
        }

        const addresses = await response.json();
        
        // 清空地址列表
        const addressList = document.querySelector('.address-list');
        if (addressList) {
            // 保留添加按钮
            const addButton = addressList.querySelector('.btn-add-address');
            addressList.innerHTML = '';
            if (addButton) {
                addressList.appendChild(addButton);
            }
            
            // 添加地址项
            addresses.forEach(address => {
                const addressItem = createAddressItem(address);
                addressList.insertBefore(addressItem, addButton);
            });
        }
    } catch (error) {
        console.error('加载地址列表失败:', error);
        showToast('加载地址列表失败，请重试', 'error');
    }
}

/**
 * 创建地址项元素
 * @param {Object} address - 地址对象
 * @returns {HTMLElement} - 地址项元素
 */
function createAddressItem(address) {
    const addressItem = document.createElement('div');
    addressItem.className = 'address-item';
    addressItem.innerHTML = `
        <div class="address-info">
            <div class="address-label">${address.label}</div>
            <div class="address-text">${address.address}</div>
        </div>
        <div class="address-actions">
            <button class="btn-edit" title="编辑">
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn-delete" title="删除">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    // 添加编辑按钮事件
    const editButton = addressItem.querySelector('.btn-edit');
    if (editButton) {
        editButton.addEventListener('click', () => showEditAddressModal(address));
    }
    
    // 添加删除按钮事件
    const deleteButton = addressItem.querySelector('.btn-delete');
    if (deleteButton) {
        deleteButton.addEventListener('click', () => showDeleteAddressConfirmation(address.id, address.label));
    }
    
    return addressItem;
}

// 页面加载完成后加载用户地址列表
document.addEventListener('DOMContentLoaded', function() {
    // 只有在账号设置页面才加载地址列表
    if (window.location.pathname.includes('account-settings.html')) {
        loadUserAddresses();
    }
});

/**
 * 显示提示消息
 * @param {string} message - 消息内容
 * @param {string} type - 消息类型
 */
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
} 