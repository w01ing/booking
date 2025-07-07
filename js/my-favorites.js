// 初始化页面
document.addEventListener('DOMContentLoaded', async () => {
    // 初始化左侧预约状态卡片点击事件（无论是否登录都要初始化）
    initializeBookingStatCards();
    
    // 检查用户是否已登录
    if (!checkAuth()) return;
    
    // 加载收藏数据
    await loadFavorites();
    
    // 初始化分类标签
    initializeTabs();
    
    // 检查空状态
    checkEmptyState();
});

// 检查用户是否已登录
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        // 未登录，重定向到登录页面
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

// 从API获取收藏数据
async function loadFavorites() {
    console.log('开始加载收藏数据');
    
    try {
        // 获取认证令牌
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未找到认证令牌');
        }
        
        // 从API获取收藏数据
        const response = await fetch('/api/favorites', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
        }
        
        const favorites = await response.json();
        console.log('成功获取收藏数据:', favorites.length, '条');
        console.log('收藏数据示例:', favorites[0]);
        
        // 渲染收藏列表
        renderFavorites(favorites);
        
        return favorites;
    } catch (error) {
        console.error('获取收藏数据失败:', error);
        showToast('获取收藏数据失败，请稍后再试', 'error');
        
        // 显示空状态
        showEmptyState();
        return [];
    }
}

// 渲染收藏列表
function renderFavorites(favorites) {
    console.log('开始渲染收藏列表, 共', favorites.length, '条');
    
    const favoritesList = document.querySelector('.favorites-list');
    
    // 清空列表
    favoritesList.innerHTML = '';
    
    if (!favorites || favorites.length === 0) {
        showEmptyState();
        return;
    }
    
    // 获取所有分类
    const categories = new Set();
    
    // 渲染每个收藏项
    favorites.forEach(favorite => {
        // 获取服务信息
        const service = favorite.service || favorite;
        
        // 确定服务分类
        let category = 'other';
        if (service.categories) {
            let cats = service.categories;
            
            // 如果categories是字符串，尝试解析为JSON
            if (typeof cats === 'string') {
                try {
                    cats = JSON.parse(cats);
                } catch (e) {
                    console.warn('解析分类失败:', cats);
                    cats = [];
                }
            }
            
            if (Array.isArray(cats)) {
                if (cats.some(cat => ['医疗', '保健', '推拿', '按摩'].includes(cat))) {
                    category = 'medical';
                } else if (cats.some(cat => ['美容', '美发', '美甲', '护肤'].includes(cat))) {
                    category = 'beauty';
                } else if (cats.some(cat => ['健身', '运动', '瑜伽', '游泳'].includes(cat))) {
                    category = 'fitness';
                }
            }
        }
        
        // 添加到分类集合
        categories.add(category);
        
        // 创建收藏卡片
        const card = document.createElement('div');
        card.className = 'favorite-card';
        card.dataset.category = category;
        card.dataset.serviceId = service.id;
        
        // 服务图片
        const imageUrl = service.image || 'img/service-placeholder.jpg';
        
        // 评分和评价数
        const rating = service.rating || 0;
        const reviewsCount = service.reviews_count || 0;
        
        // 服务提供商信息
        const providerName = service.provider ? (service.provider.business_name || service.provider.username) : '未知服务商';
        const providerLogo = service.provider && service.provider.avatar ? service.provider.avatar : 'img/avatar-placeholder.jpg';
        
        // 价格信息
        const price = service.price || 0;
        const priceUnit = service.price_unit || '次';
        
        // 生成标签
        let tagsHtml = '';
        if (service.categories) {
            let cats = service.categories;
            
            // 如果categories是字符串，尝试解析为JSON
            if (typeof cats === 'string') {
                try {
                    cats = JSON.parse(cats);
                } catch (e) {
                    cats = [];
                }
            }
            
            if (Array.isArray(cats)) {
                tagsHtml = cats.slice(0, 2).map(tag => 
                    `<span class="tag">${tag}</span>`
                ).join('');
            }
        }
        
        card.innerHTML = `
            <div class="service-image">
                <img src="${imageUrl}" alt="${service.title}" onerror="this.src='img/service-placeholder.jpg'">
                <button class="btn-favorite active" data-service-id="${service.id}" onclick="handleFavoriteClick(event, '${service.id}', '${service.title}')">
                    <i class="fas fa-heart"></i>
                </button>
            </div>
            <div class="service-info">
                <div class="service-header">
                    <div class="service-tags">
                        ${tagsHtml}
                    </div>
                    <div class="service-rating">
                        <i class="fas fa-star"></i>
                        <span>${rating.toFixed(1)}</span>
                        <span class="reviews">(${reviewsCount})</span>
                    </div>
                </div>
                <h3 class="service-name">${service.title}</h3>
                <div class="service-provider">
                    <img src="${providerLogo}" alt="${providerName}" class="provider-logo">
                    <span>${providerName}</span>
                </div>
                <div class="service-footer">
                    <div class="price">¥${price}<span>/${priceUnit}</span></div>
                    <div class="action-buttons">
                        <button class="btn-detail" onclick="window.location.href='service-detail.html?id=${service.id}'">查看详情</button>
                        <button class="btn-book" onclick="window.location.href='service-detail.html?id=${service.id}&book=true'">立即预约</button>
                    </div>
                </div>
            </div>
        `;
        
        favoritesList.appendChild(card);
    });
    
    console.log('渲染完成，初始化收藏按钮');
    
    // 初始化收藏按钮
    initializeFavorites();
    
    // 更新分类标签
    updateCategoryTabs(categories);
}

// 更新分类标签
function updateCategoryTabs(categories) {
    const tabsContainer = document.querySelector('.category-tabs');
    
    // 保留"全部"标签
    tabsContainer.innerHTML = '<button class="tab active" data-category="all">全部</button>';
    
    // 添加分类标签
    if (categories.has('medical')) {
        tabsContainer.innerHTML += '<button class="tab" data-category="medical">医疗保健</button>';
    }
    
    if (categories.has('beauty')) {
        tabsContainer.innerHTML += '<button class="tab" data-category="beauty">美容美发</button>';
    }
    
    if (categories.has('fitness')) {
        tabsContainer.innerHTML += '<button class="tab" data-category="fitness">运动健身</button>';
    }
    
    // 重新初始化标签点击事件
    initializeTabs();
}

// 初始化分类标签
function initializeTabs() {
    const tabs = document.querySelectorAll('.category-tabs .tab');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // 移除所有标签的激活状态
            tabs.forEach(t => t.classList.remove('active'));
            
            // 设置当前标签为激活状态
            this.classList.add('active');
            
            // 筛选收藏列表
            const category = this.getAttribute('data-category');
            filterFavorites(category);
        });
    });
}

// 筛选收藏列表
function filterFavorites(category) {
            const cards = document.querySelectorAll('.favorite-card');
            
            cards.forEach(card => {
                if (category === 'all' || card.dataset.category === category) {
                    card.style.display = '';
            card.style.animation = 'fadeIn 0.3s ease-out';
                } else {
                    card.style.display = 'none';
                }
            });

    // 检查是否需要显示空状态
    checkEmptyState(category);
}

// 初始化收藏按钮
function initializeFavorites() {
    console.log('初始化收藏按钮');
    // 收藏按钮点击事件
    const favoriteButtons = document.querySelectorAll('.favorite-card .btn-favorite');
    console.log('找到收藏按钮数量:', favoriteButtons.length);
    
    favoriteButtons.forEach(button => {
        // 移除已有的事件监听器，避免重复绑定
        button.removeEventListener('click', handleFavoriteButtonClick);
        
        // 添加新的事件监听器
        button.addEventListener('click', handleFavoriteButtonClick);
    });
}

// 全局函数，用于处理收藏按钮点击
function handleFavoriteClick(event, serviceId, serviceName) {
    console.log('收藏按钮被点击 - 内联处理函数');
    event.preventDefault();
    event.stopPropagation();
    
    // 获取按钮和卡片
    const button = event.currentTarget;
    const card = button.closest('.favorite-card');
    
    console.log('服务ID:', serviceId);
    console.log('服务名称:', serviceName);
    
    if (button.classList.contains('active')) {
        console.log('准备取消收藏:', serviceName);
        showUnfavoriteConfirmation(serviceName, serviceId, card);
    }
}

// 检查是否显示空状态
function checkEmptyState(category = 'all') {
    const visibleCards = document.querySelectorAll('.favorite-card:not([style*="display: none"])');
    
    if (visibleCards.length === 0) {
        showEmptyState(category);
    } else {
        hideEmptyState();
    }
}

// 显示空状态
function showEmptyState(category = 'all') {
    let emptyStateElem = document.querySelector('.empty-state');
    
    if (!emptyStateElem) {
        emptyStateElem = document.createElement('div');
        emptyStateElem.className = 'empty-state';
        document.querySelector('.favorites-list').appendChild(emptyStateElem);
    }
    
    let categoryText = '';
    if (category === 'medical') categoryText = '医疗保健类';
    else if (category === 'beauty') categoryText = '美容美发类';
    else if (category === 'fitness') categoryText = '运动健身类';
    
    emptyStateElem.innerHTML = `
            <div class="empty-icon">
            <i class="fas fa-heart-broken"></i>
            </div>
        <h3>暂无${categoryText}收藏</h3>
        <p>浏览服务并添加到收藏，方便下次快速预约</p>
        <a href="search-results.html" class="btn-find">发现服务</a>
        `;
        
    emptyStateElem.style.display = 'flex';
}

// 隐藏空状态
function hideEmptyState() {
    const emptyStateElem = document.querySelector('.empty-state');
    if (emptyStateElem) {
        emptyStateElem.style.display = 'none';
    }
}

// 显示提示信息
function showToast(message, type = 'success') {
    // 检查是否已有Toast
    let toast = document.querySelector('.toast');
    
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    
    // 设置类型和内容
    toast.className = `toast ${type}`;
    
    let icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    else if (type === 'warning') icon = 'exclamation-triangle';
    else if (type === 'info') icon = 'info-circle';
    
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas fa-${icon}"></i>
        </div>
        <div class="toast-content">${message}</div>
    `;

    // 显示Toast
    setTimeout(() => {
        toast.classList.add('active');
    }, 10);

    // 自动隐藏
    setTimeout(() => {
        toast.classList.remove('active');
        setTimeout(() => {
            if (document.body.contains(toast)) {
                toast.remove();
            }
        }, 300);
    }, 3000);
}

// 收藏按钮点击事件处理
async function toggleFavorite(serviceId, button) {
    try {
        // 获取认证令牌
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未找到认证令牌');
        }
        
        if (button.classList.contains('active')) {
            // 已收藏，取消收藏
            const response = await fetch(`/api/favorites/${serviceId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`取消收藏失败: ${response.status}`);
            }
            
            button.classList.remove('active');
            showToast('已取消收藏');
        } else {
            // 未收藏，添加收藏
            const response = await fetch('/api/favorites', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    service_id: serviceId
                })
            });
            
            if (!response.ok) {
                throw new Error(`添加收藏失败: ${response.status}`);
            }
            
            button.classList.add('active');
            showToast('已添加到收藏');
        }
    } catch (error) {
        console.error('操作收藏失败:', error);
        showToast('操作失败，请稍后再试', 'error');
    }
}

// 显示取消收藏确认对话框
function showUnfavoriteConfirmation(serviceName, serviceId, card) {
    console.log('显示取消收藏确认对话框:', serviceName, serviceId);
    
    // 移除可能已存在的模态框
    const existingModal = document.querySelector('.modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // 创建确认对话框
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>取消收藏</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <p>确定要取消收藏"${serviceName}"吗？</p>
            </div>
            <div class="modal-footer">
                <button class="btn-cancel close-modal">取消</button>
                <button class="btn-confirm">确定</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    console.log('模态框已添加到DOM');
    
    // 显示模态框
    setTimeout(() => {
        modal.classList.add('active');
        console.log('模态框已激活');
    }, 10);
    
    // 关闭按钮点击事件
    const closeButtons = modal.querySelectorAll('.close-modal');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            console.log('关闭模态框');
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        });
    });
    
    // 确认按钮点击事件
    const confirmButton = modal.querySelector('.btn-confirm');
    confirmButton.addEventListener('click', async () => {
        console.log('确认取消收藏');
        try {
            // 显示加载状态
            confirmButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 处理中...';
            confirmButton.disabled = true;
            
            // 获取认证令牌
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('未找到认证令牌');
            }
            
            console.log('发送取消收藏请求:', serviceId);
            // 发送取消收藏请求
            const response = await fetch(`/api/favorites/${serviceId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`取消收藏失败: ${response.status}`);
            }
            
            console.log('取消收藏成功');
            
            // 关闭模态框
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
            
            // 移除卡片
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            card.style.transition = 'all 0.3s ease';
            
            setTimeout(() => {
                card.style.height = '0';
                card.style.margin = '0';
                card.style.padding = '0';
                card.style.overflow = 'hidden';
                
                setTimeout(() => {
                    card.remove();
                    checkEmptyState();
                }, 300);
            }, 300);
            
            showToast('已取消收藏');
            
            // 从本地存储中删除此服务ID的收藏状态
            removeFromLocalFavorites(serviceId);
        } catch (error) {
            console.error('取消收藏失败:', error);
            showToast('取消收藏失败，请稍后再试', 'error');
            
            // 关闭模态框
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        }
    });
}

// 从本地存储中删除收藏
function removeFromLocalFavorites(serviceId) {
    try {
        // 获取当前收藏列表
        let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
        
        // 移除特定ID
        favorites = favorites.filter(id => id !== serviceId);
        
        // 保存回本地存储
        localStorage.setItem('favorites', JSON.stringify(favorites));
        
        console.log(`服务 ${serviceId} 已从本地收藏中删除`);
    } catch (error) {
        console.error('从本地存储删除收藏失败:', error);
    }
}

// 添加页面过渡动画
window.addEventListener('pageshow', () => {
    document.body.style.opacity = '1';
});

window.addEventListener('beforeunload', () => {
    document.body.style.opacity = '0';
});

document.addEventListener('DOMContentLoaded', function() {
    // 视图切换
    const viewButtons = document.querySelectorAll('.view-btn');
    const favoritesGrid = document.querySelector('.favorites-grid');

    viewButtons.forEach(button => {
        button.addEventListener('click', () => {
            // 移除所有按钮的激活状态
            viewButtons.forEach(btn => btn.classList.remove('active'));
            // 添加当前按钮的激活状态
            button.classList.add('active');

            const view = button.dataset.view;
            if (view === 'list') {
                favoritesGrid.classList.add('list-view');
            } else {
                favoritesGrid.classList.remove('list-view');
            }

            // 添加过渡动画
            document.querySelectorAll('.favorite-card').forEach((card, index) => {
                card.style.animation = `fadeIn 0.5s ease-out ${index * 0.1}s`;
            });
        });
    });

    // 分类过滤
    const filterButtons = document.querySelectorAll('.filter-btn');
    const favoriteCards = document.querySelectorAll('.favorite-card');

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // 移除所有按钮的激活状态
            filterButtons.forEach(btn => btn.classList.remove('active'));
            // 添加当前按钮的激活状态
            button.classList.add('active');

            const filter = button.textContent.trim();

            // 根据筛选条件显示/隐藏收藏卡片
            favoriteCards.forEach(card => {
                if (filter === '全部') {
                    card.style.display = 'block';
                    // 添加动画效果
                    card.style.animation = 'fadeIn 0.5s ease-out';
                } else if (card.dataset.category === filter) {
                    card.style.display = 'block';
                    card.style.animation = 'fadeIn 0.5s ease-out';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });

    // 收藏按钮交互
    const favoriteButtons = document.querySelectorAll('.btn-favorite');

    favoriteButtons.forEach(button => {
        button.addEventListener('click', () => {
            const card = button.closest('.favorite-card');
            const serviceName = card.querySelector('.service-name').textContent;
            const serviceId = button.dataset.serviceId;

            if (button.classList.contains('active')) {
                showUnfavoriteConfirmation(serviceName, serviceId, card);
            }
        });
    });

    // 加载更多按钮交互
    const loadMoreBtn = document.querySelector('.btn-load-more');
    let isLoading = false;

    loadMoreBtn?.addEventListener('click', () => {
        if (isLoading) return;

        isLoading = true;
        loadMoreBtn.classList.add('loading');

        // 模拟加载更多数据
        setTimeout(() => {
            // 这里添加加载更多收藏的逻辑
            isLoading = false;
            loadMoreBtn.classList.remove('loading');
        }, 1500);
    });

    // 预约和详情按钮交互
    document.querySelectorAll('.btn-book').forEach(button => {
        button.addEventListener('click', () => {
            const card = button.closest('.favorite-card');
            const serviceName = card.querySelector('h3').textContent;
            const serviceProvider = card.querySelector('.service-provider').textContent.trim();
            
            // 这里添加预约逻辑
            showToast(`正在为您预约"${serviceName}"，请稍候...`);
        });
    });

    document.querySelectorAll('.btn-detail').forEach(button => {
        button.addEventListener('click', () => {
            const card = button.closest('.favorite-card');
            const serviceName = card.querySelector('h3').textContent;
            
            // 这里添加查看详情逻辑
            showToast(`正在加载"${serviceName}"的详细信息...`);
        });
    });
});

// 加载用户预约统计信息
async function loadBookingStats() {
    try {
        console.log('开始加载用户预约统计');
        
        // 获取认证令牌
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未找到认证令牌');
        }
        
        // 从API获取预约数据
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
        
        const bookings = await response.json();
        console.log('成功获取预约数据:', bookings.length, '条');
        
        // 计算不同状态的预约数量
        const stats = {
            waiting: 0,
            upcoming: 0,
            completed: 0,
            canceled: 0
        };
        
        bookings.forEach(booking => {
            if (booking.status === 'pending' || booking.status === 'waiting') stats.waiting++;
            else if (booking.status === 'confirmed' || booking.status === 'upcoming') stats.upcoming++;
            else if (booking.status === 'completed') stats.completed++;
            else if (booking.status === 'canceled' || booking.status === 'cancelled') stats.canceled++;
        });
        
        // 更新侧边栏统计数字
        updateSidebarStats(stats);
    } catch (error) {
        console.error('加载预约统计信息失败:', error);
    }
}

// 更新侧边栏统计
function updateSidebarStats(stats) {
    // 更新侧边栏中的预约统计卡片
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

    // 更新左侧导航栏预约数据徽章
    updateNavbarStats(stats);
}

// 更新导航栏统计信息
function updateNavbarStats(stats) {
    // // 更新左侧导航栏预约通知徽章
    // const dashboardBadge = document.querySelector('.nav-item[href="dashboard.html"] .item-badge');
    // if (dashboardBadge) {
    //     const totalUnprocessed = stats.waiting + stats.upcoming;
    //     dashboardBadge.textContent = totalUnprocessed > 0 ? totalUnprocessed : '';
    //     dashboardBadge.style.display = totalUnprocessed > 0 ? 'flex' : 'none';
    // }
    
    // 更新顶部通知徽章
    const notificationBadge = document.querySelector('.notification-badge');
    if (notificationBadge) {
        const totalNotifications = stats.waiting + stats.upcoming;
        notificationBadge.textContent = totalNotifications > 0 ? totalNotifications : '';
        notificationBadge.style.display = totalNotifications > 0 ? 'flex' : 'none';
    }
}

/**
 * 初始化预约状态卡片点击事件
 */
function initializeBookingStatCards() {
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach(card => {
        card.addEventListener('click', () => {
            const status = card.classList[1]; // 获取状态类名（waiting, upcoming, completed, cancelled）
            if (status) {
                // 如果用户已登录，跳转到预约历史页面并传递状态参数
                if (checkAuth()) {
                    window.location.href = `booking-history.html?status=${status}`;
                } else {
                    // 未登录则提示用户登录
                    showToast('请先登录后查看预约信息', 'info');
                }
            }
        });
    });
}
