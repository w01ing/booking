/**
 * 搜索结果页面功能模块
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('搜索结果页面初始化');
    
    // 获取URL参数
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('query') || '';
    const category = urlParams.get('category') || '';
    const sortBy = urlParams.get('sort_by') || '';
    
    console.log(`URL参数: query=${query}, category=${category}, sort_by=${sortBy}`);
    
    // 设置页面标题
    document.title = query ? `"${query}" 的搜索结果 - 预约平台` : '全部服务 - 预约平台';
    
    // 设置搜索输入框的值
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = query;
    }
    
    // 设置搜索结果标题
    const searchTitle = document.getElementById('search-title');
    if (searchTitle) {
        searchTitle.textContent = query ? `"${query}" 的搜索结果` : '全部服务';
    }
    
    // 设置搜索结果描述
    const searchDescription = document.getElementById('search-description');
    if (searchDescription) {
        searchDescription.textContent = query ? '为您找到相关服务' : '浏览所有可用服务';
    }
    
    // 加载搜索结果
    loadSearchResults(query, category, sortBy);
    
    // 设置分类标签点击事件
    setupCategoryTabs();
    
    // 设置排序选项点击事件
    setupSortOptions();
    
    // 设置视图切换事件
    setupViewToggle();
    
    // 设置搜索表单提交事件
    setupSearchForm();
});

/**
 * 加载搜索结果
 * @param {string} query 搜索关键词
 * @param {string} category 分类
 * @param {string} sortBy 排序方式
 */
async function loadSearchResults(query, category, sortBy) {
    try {
        console.log(`加载搜索结果: query=${query}, category=${category}, sort_by=${sortBy}`);
        
        // 构建查询参数
        const params = new URLSearchParams();
        if (query) params.append('query', query);
        if (category && category !== '全部') params.append('category', category);
        if (sortBy) params.append('sort_by', sortBy);
        
        // 显示加载状态
        const resultsContainer = document.getElementById('search-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = '<div class="loading" style="grid-column: 1/-1; text-align: center; padding: 50px 0;"><i class="fas fa-spinner fa-spin" style="font-size: 48px; color: #4a6cf7;"></i><p style="margin-top: 20px;">正在加载搜索结果...</p></div>';
        }
        
        // 从API获取搜索结果
        const response = await fetch(`/api/services/public?${params.toString()}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API请求失败:', response.status, errorText);
            throw new Error(`API请求失败: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API返回的数据:', data);
        
        // 显示搜索结果
        if (data && data.services) {
            console.log(`获取到 ${data.services.length} 条搜索结果`);
            
            // 确保不重复渲染
            if (resultsContainer.querySelector('.loading')) {
                displaySearchResults(data.services);
                
                // 更新结果数量
                updateResultCount(data.total);
                
                // 更新加载更多按钮状态
                const loadMoreBtn = document.getElementById('load-more-btn');
                if (loadMoreBtn) {
                    if (data.has_more) {
                        loadMoreBtn.style.display = 'inline-block';
                        loadMoreBtn.setAttribute('data-offset', data.offset + data.services.length);
                    } else {
                        loadMoreBtn.style.display = 'none';
                    }
                }
            } else {
                console.log('搜索结果容器已经有内容，跳过渲染');
            }
        } else {
            console.error('API返回的数据格式不正确:', data);
            throw new Error('API返回的数据格式不正确');
        }
        
        // 更新分类标签激活状态
        if (category) {
            const categoryFilters = document.querySelectorAll('#category-filters .filter-option');
            categoryFilters.forEach(filter => {
                const filterCategory = filter.getAttribute('data-category');
                if ((filterCategory === 'all' && !category) || 
                    (filterCategory !== 'all' && filterCategory === category)) {
                    filter.classList.add('active');
                } else {
                    filter.classList.remove('active');
                }
            });
        }
        
        // 更新排序选项激活状态
        if (sortBy) {
            const sortFilters = document.querySelectorAll('#sort-filters .filter-option');
            sortFilters.forEach(filter => {
                const filterSort = filter.getAttribute('data-sort');
                const apiSortBy = sortBy.replace('_', '-');
                if ((filterSort === 'default' && !sortBy) || 
                    (filterSort !== 'default' && filterSort === apiSortBy)) {
                    filter.classList.add('active');
                } else {
                    filter.classList.remove('active');
                }
            });
        }
    } catch (error) {
        console.error('加载搜索结果失败:', error);
        
        // 显示错误信息
        const resultsContainer = document.getElementById('search-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div class="error" style="grid-column: 1/-1; text-align: center; padding: 50px 0;">
                    <i class="fas fa-exclamation-circle" style="font-size: 48px; color: #ff3b30; margin-bottom: 20px;"></i>
                    <h3>加载搜索结果失败</h3>
                    <p>请稍后再试或刷新页面</p>
                    <p class="error-details" style="color: #666; margin-top: 10px;">${error.message}</p>
                </div>
            `;
        }
    }
}

/**
 * 显示搜索结果
 * @param {Array} services 服务数组
 */
async function displaySearchResults(services) {
    console.log('开始显示搜索结果:', services);
    
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) {
        console.error('未找到结果容器');
        return;
    }
    
    // 清空容器
    resultsContainer.innerHTML = '';
    
    // 如果没有结果，显示无结果提示
    if (!services || services.length === 0) {
        console.log('没有搜索结果');
        resultsContainer.innerHTML = `
            <div class="no-results" style="grid-column: 1/-1; text-align: center; padding: 50px 0;">
                <i class="fas fa-search" style="font-size: 48px; color: #ddd; margin-bottom: 20px;"></i>
                <h3>未找到相关服务</h3>
                <p>请尝试使用其他关键词，或者浏览我们的推荐服务</p>
            </div>
        `;
        return;
    }
    
    // 获取用户收藏列表
    let favorites = [];
    try {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                console.log('获取用户收藏列表...');
                const response = await fetch('/api/favorites', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (response.ok) {
                    const favoritesData = await response.json();
                    // 确保收藏列表是服务ID的字符串数组
                    favorites = favoritesData.map(fav => {
                        // 支持不同的数据格式
                        if (typeof fav === 'string') return fav;
                        if (fav.service_id) return String(fav.service_id);
                        if (fav.id) return String(fav.id);
                        return '';
                    }).filter(id => id); // 过滤掉空ID
                    
                    console.log('获取到用户收藏列表:', favorites);
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    console.warn('获取收藏列表失败，状态码:', response.status, errorData.message || '');
                }
            } catch (error) {
                console.warn('获取收藏列表API调用失败:', error);
            }
        } else {
            console.log('用户未登录，不获取收藏列表');
        }
    } catch (error) {
        console.error('获取收藏列表失败:', error);
    }
    
    console.log(`开始创建 ${services.length} 个服务卡片`);
    
    // 创建服务卡片
    services.forEach((service, index) => {
        try {
            console.log(`创建服务卡片 ${index + 1}/${services.length}:`, service);
            
            // 确保ID是字符串类型
            const serviceId = String(service.id);
            
            // 创建服务卡片元素
        const serviceCard = document.createElement('div');
        serviceCard.className = 'service-card';
            serviceCard.setAttribute('data-id', serviceId);
            
            // 检查是否已收藏
            const isFavorite = favorites.includes(serviceId);
            console.log(`服务 ${serviceId} ${isFavorite ? '已收藏' : '未收藏'}`);
            
            // 获取分类（处理不同的数据格式）
            let categoryDisplay = '其他';
            if (service.categories) {
                if (typeof service.categories === 'string') {
                    try {
                        // 尝试解析JSON字符串
                        const categoriesArray = JSON.parse(service.categories);
                        if (Array.isArray(categoriesArray) && categoriesArray.length > 0) {
                            categoryDisplay = categoriesArray[0];
                        }
                    } catch (e) {
                        // 如果解析失败，直接使用字符串
                        categoryDisplay = service.categories;
                    }
                } else if (Array.isArray(service.categories) && service.categories.length > 0) {
                    categoryDisplay = service.categories[0];
                }
            }
            
            // 获取服务提供商名称
            const providerName = service.provider || 
                                (service.provider_id ? '服务商' : '未知服务商');
            
            // 设置卡片内容
        serviceCard.innerHTML = `
            <div class="service-image">
                    <img src="${service.image || 'img/placeholder.jpg'}" alt="${service.title}" onerror="this.src='img/placeholder.jpg'">
                    <button class="favorite-btn ${isFavorite ? 'active' : ''}">
                        <i class="${isFavorite ? 'fas' : 'far'} fa-heart"></i>
                    </button>
            </div>
            <div class="service-content">
                    <div class="service-category">${categoryDisplay}</div>
                <h3 class="service-title">${service.title}</h3>
                    <div class="service-provider">
                        <span>${providerName}</span>
                    </div>
                <div class="service-meta">
                    <div class="rating">
                        <i class="fas fa-star"></i>
                            <span>${(service.rating || 0).toFixed(1)}</span>
                            <span class="reviews">(${service.reviews_count || 0})</span>
                    </div>
                </div>
                <div class="service-price">¥${service.price}</div>
            </div>
        `;
        
        // 添加点击事件
            serviceCard.addEventListener('click', function() {
                window.location.href = `service-detail.html?id=${serviceId}`;
        });
        
            // 收藏按钮点击事件
        const favoriteBtn = serviceCard.querySelector('.favorite-btn');
            favoriteBtn.addEventListener('click', async function(e) {
                e.stopPropagation(); // 阻止冒泡，避免触发卡片点击事件
                
                // 检查用户是否已登录
                const token = localStorage.getItem('token');
                if (!token) {
                    showToast('请先登录后再收藏服务', 'info');
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 1500);
                    return;
                }
                
                const icon = this.querySelector('i');
                const isCurrentlyFavorite = icon.classList.contains('fas');
                
                // 防止重复点击
                if (this.hasAttribute('data-processing')) {
                    console.log('操作进行中，请稍后再试');
                    return;
                }
                
                // 设置处理中状态
                this.setAttribute('data-processing', 'true');
                
                try {
                    if (!isCurrentlyFavorite) {
                        // 添加收藏
                        console.log(`尝试添加收藏服务 ID: ${serviceId}`);
                        
                        // 先更新UI，提供即时反馈
                        icon.classList.replace('far', 'fas');
                        this.classList.add('active');
                        showToast('添加收藏中...');
                        
                        const response = await fetch('/api/favorites', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ service_id: serviceId })
                        });
                        
                        const responseData = await response.json();
                        
                        if (response.ok) {
                            console.log('收藏成功:', responseData);
                            showToast('已添加到收藏', 'success');
            } else {
                            console.error('收藏失败:', responseData);
                            // 如果请求失败，回退UI更改
                            icon.classList.replace('fas', 'far');
                            this.classList.remove('active');
                            showToast(`收藏失败: ${responseData.message || '未知错误'}`, 'error');
                        }
                    } else {
                        // 取消收藏
                        console.log(`尝试取消收藏服务 ID: ${serviceId}`);
                        
                        // 先更新UI，提供即时反馈
                        icon.classList.replace('fas', 'far');
                        this.classList.remove('active');
                        showToast('取消收藏中...');
                        
                        const response = await fetch(`/api/favorites/${serviceId}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });
                        
                        if (response.ok) {
                            console.log('取消收藏成功');
                            showToast('已从收藏中移除', 'success');
                        } else {
                            const errorData = await response.json().catch(() => ({}));
                            console.error('取消收藏失败:', errorData);
                            // 如果请求失败，回退UI更改
                            icon.classList.replace('far', 'fas');
                            this.classList.add('active');
                            showToast(`取消收藏失败: ${errorData.message || '未知错误'}`, 'error');
                        }
                    }
                } catch (error) {
                    console.error('收藏操作失败:', error);
                    // 发生异常时回退到原始状态
                    if (!isCurrentlyFavorite) {
                        icon.classList.replace('fas', 'far');
                        this.classList.remove('active');
                    } else {
                        icon.classList.replace('far', 'fas');
                        this.classList.add('active');
                    }
                    showToast('操作失败，请稍后再试', 'error');
                } finally {
                    // 移除处理中状态
                    this.removeAttribute('data-processing');
                }
            });
            
            // 添加到容器
            resultsContainer.appendChild(serviceCard);
        } catch (cardError) {
            console.error(`创建服务卡片 ${index + 1} 失败:`, cardError);
        }
    });
    
    console.log('搜索结果显示完成');
}

/**
 * 设置分类标签点击事件
 */
function setupCategoryTabs() {
    const categoryFilters = document.querySelectorAll('#category-filters .filter-option');
    
    categoryFilters.forEach(filter => {
        filter.addEventListener('click', function() {
            // 获取当前URL参数
            const urlParams = new URLSearchParams(window.location.search);
            const query = urlParams.get('query') || '';
            const sortBy = urlParams.get('sort_by') || '';
            
            // 获取选中的分类
            const category = this.getAttribute('data-category');
            
            // 更新分类标签激活状态
            categoryFilters.forEach(f => f.classList.remove('active'));
            this.classList.add('active');
            
            // 如果是"all"分类，则不传递category参数
            const categoryParam = category !== 'all' ? category : '';
            
            // 加载搜索结果
            loadSearchResults(query, categoryParam, sortBy);
            
            // 更新URL参数（不刷新页面）
            const newUrlParams = new URLSearchParams();
            if (query) newUrlParams.append('query', query);
            if (categoryParam) newUrlParams.append('category', categoryParam);
            if (sortBy) newUrlParams.append('sort_by', sortBy);
            
            const newUrl = `${window.location.pathname}?${newUrlParams.toString()}`;
            history.pushState(null, '', newUrl);
        });
    });
}

/**
 * 设置排序选项点击事件
 */
function setupSortOptions() {
    const sortFilters = document.querySelectorAll('#sort-filters .filter-option');
    
    sortFilters.forEach(filter => {
        filter.addEventListener('click', function() {
            // 获取当前URL参数
            const urlParams = new URLSearchParams(window.location.search);
            const query = urlParams.get('query') || '';
            const category = urlParams.get('category') || '';
            
            // 获取选中的排序方式
            const sortValue = this.getAttribute('data-sort');
            
            // 更新排序选项激活状态
            sortFilters.forEach(f => f.classList.remove('active'));
            this.classList.add('active');
            
            // 转换排序值为API参数
            let sortByParam = '';
            if (sortValue === 'price-asc') {
                sortByParam = 'price_asc';
            } else if (sortValue === 'price-desc') {
                sortByParam = 'price_desc';
            } else if (sortValue === 'rating') {
                sortByParam = 'rating';
            }
            
            // 加载搜索结果
            loadSearchResults(query, category, sortByParam);
            
            // 更新URL参数（不刷新页面）
            const newUrlParams = new URLSearchParams();
            if (query) newUrlParams.append('query', query);
            if (category) newUrlParams.append('category', category);
            if (sortByParam) newUrlParams.append('sort_by', sortByParam);
            
            const newUrl = `${window.location.pathname}?${newUrlParams.toString()}`;
            history.pushState(null, '', newUrl);
        });
    });
}

/**
 * 设置视图切换事件
 */
function setupViewToggle() {
    // 在当前HTML中没有视图切换功能，可以在将来添加
    console.log('视图切换功能未实现');
}

/**
 * 更新结果计数
 * @param {number} count 结果总数
 */
function updateResultCount(count) {
    const searchDescription = document.getElementById('search-description');
    if (searchDescription) {
        const query = new URLSearchParams(window.location.search).get('query') || '';
        if (query) {
            searchDescription.textContent = `为您找到 ${count} 个相关服务`;
        } else {
            searchDescription.textContent = `共有 ${count} 个服务`;
        }
    }
}

/**
 * 设置加载更多按钮事件
 */
function setupLoadMoreButton() {
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (!loadMoreBtn) return;
    
    loadMoreBtn.addEventListener('click', async function() {
        // 获取当前URL参数
        const urlParams = new URLSearchParams(window.location.search);
        const query = urlParams.get('query') || '';
        const category = urlParams.get('category') || '';
        const sortBy = urlParams.get('sort_by') || '';
        
        // 获取当前偏移量
        const offset = parseInt(this.getAttribute('data-offset') || '0');
        
        // 显示加载状态
        this.disabled = true;
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 加载中...';
        
        try {
            // 构建查询参数
            const params = new URLSearchParams();
            if (query) params.append('query', query);
            if (category && category !== '全部') params.append('category', category);
            if (sortBy) params.append('sort_by', sortBy);
            params.append('offset', offset);
            
            // 从API获取更多结果
            const response = await fetch(`/api/services/public?${params.toString()}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`API请求失败: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data && data.services && data.services.length > 0) {
                // 追加显示更多结果
                await appendSearchResults(data.services);
                
                // 更新按钮状态
                if (data.has_more) {
                    this.disabled = false;
                    this.innerHTML = '加载更多';
                    this.setAttribute('data-offset', offset + data.services.length);
                } else {
                    this.style.display = 'none';
                }
            } else {
                // 没有更多结果
                this.style.display = 'none';
                showToast('已加载全部内容');
            }
        } catch (error) {
            console.error('加载更多结果失败:', error);
            this.disabled = false;
            this.innerHTML = '加载更多';
            showToast('加载更多结果失败，请稍后再试', 'error');
        }
    });
}

/**
 * 追加显示搜索结果
 * @param {Array} services 服务数组
 */
async function appendSearchResults(services) {
    // 复用displaySearchResults的逻辑，但不清空容器
    console.log('追加显示搜索结果:', services);
    
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) {
        console.error('未找到结果容器');
        return;
    }
    
    // 获取用户收藏列表
    let favorites = [];
    try {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const response = await fetch('/api/favorites', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (response.ok) {
                    const favoritesData = await response.json();
                    favorites = favoritesData.map(fav => String(fav.service_id));
                } else {
                    console.warn('获取收藏列表失败，状态码:', response.status);
                }
            } catch (error) {
                console.warn('获取收藏列表API调用失败:', error);
            }
        }
    } catch (error) {
        console.error('获取收藏列表失败:', error);
    }
    
    // 创建服务卡片
    services.forEach((service, index) => {
        try {
            // 确保ID是字符串类型
            const serviceId = String(service.id);
            
            // 创建服务卡片元素
            const serviceCard = document.createElement('div');
            serviceCard.className = 'service-card';
            serviceCard.setAttribute('data-id', serviceId);
            
            // 检查是否已收藏
            const isFavorite = favorites.includes(serviceId);
            
            // 获取分类（处理不同的数据格式）
            let categoryDisplay = '其他';
            if (service.categories) {
                if (typeof service.categories === 'string') {
                    try {
                        // 尝试解析JSON字符串
                        const categoriesArray = JSON.parse(service.categories);
                        if (Array.isArray(categoriesArray) && categoriesArray.length > 0) {
                            categoryDisplay = categoriesArray[0];
                        }
                    } catch (e) {
                        // 如果解析失败，直接使用字符串
                        categoryDisplay = service.categories;
                    }
                } else if (Array.isArray(service.categories) && service.categories.length > 0) {
                    categoryDisplay = service.categories[0];
                }
            }
            
            // 获取服务提供商名称
            const providerName = service.provider || 
                                (service.provider_id ? '服务商' : '未知服务商');
            
            // 设置卡片内容
            serviceCard.innerHTML = `
                <div class="service-image">
                    <img src="${service.image || 'img/placeholder.jpg'}" alt="${service.title}" onerror="this.src='img/placeholder.jpg'">
                    <button class="favorite-btn ${isFavorite ? 'active' : ''}">
                        <i class="${isFavorite ? 'fas' : 'far'} fa-heart"></i>
                    </button>
                </div>
                <div class="service-content">
                    <div class="service-category">${categoryDisplay}</div>
                    <h3 class="service-title">${service.title}</h3>
                    <div class="service-provider">
                        <span>${providerName}</span>
                    </div>
                    <div class="service-meta">
                        <div class="rating">
                            <i class="fas fa-star"></i>
                            <span>${(service.rating || 0).toFixed(1)}</span>
                            <span class="reviews">(${service.reviews_count || 0})</span>
                        </div>
                    </div>
                    <div class="service-price">¥${service.price}</div>
                </div>
            `;
            
            // 添加点击事件
            serviceCard.addEventListener('click', function() {
                window.location.href = `service-detail.html?id=${serviceId}`;
            });
            
            // 收藏按钮点击事件
            const favoriteBtn = serviceCard.querySelector('.favorite-btn');
            favoriteBtn.addEventListener('click', async function(e) {
                e.stopPropagation(); // 阻止冒泡，避免触发卡片点击事件
                
                // 检查用户是否已登录
                const token = localStorage.getItem('token');
                if (!token) {
                    showToast('请先登录后再收藏服务', 'info');
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 1500);
                    return;
                }
                
                const icon = this.querySelector('i');
                const isCurrentlyFavorite = icon.classList.contains('fas');
                
                // 防止重复点击
                if (this.hasAttribute('data-processing')) {
                    console.log('操作进行中，请稍后再试');
                    return;
                }
                
                // 设置处理中状态
                this.setAttribute('data-processing', 'true');
                
                try {
                    if (!isCurrentlyFavorite) {
                        // 添加收藏
                        console.log(`尝试添加收藏服务 ID: ${serviceId}`);
                        
                        // 先更新UI，提供即时反馈
                        icon.classList.replace('far', 'fas');
                        this.classList.add('active');
                        showToast('添加收藏中...');
                        
                        const response = await fetch('/api/favorites', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ service_id: serviceId })
                        });
                        
                        const responseData = await response.json();
                        
                        if (response.ok) {
                            console.log('收藏成功:', responseData);
                            showToast('已添加到收藏', 'success');
                        } else {
                            console.error('收藏失败:', responseData);
                            // 如果请求失败，回退UI更改
                            icon.classList.replace('fas', 'far');
                            this.classList.remove('active');
                            showToast(`收藏失败: ${responseData.message || '未知错误'}`, 'error');
                        }
                    } else {
                        // 取消收藏
                        console.log(`尝试取消收藏服务 ID: ${serviceId}`);
                        
                        // 先更新UI，提供即时反馈
                        icon.classList.replace('fas', 'far');
                        this.classList.remove('active');
                        showToast('取消收藏中...');
                        
                        const response = await fetch(`/api/favorites/${serviceId}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });
                        
                        if (response.ok) {
                            console.log('取消收藏成功');
                            showToast('已从收藏中移除', 'success');
                        } else {
                            const errorData = await response.json().catch(() => ({}));
                            console.error('取消收藏失败:', errorData);
                            // 如果请求失败，回退UI更改
                            icon.classList.replace('far', 'fas');
                            this.classList.add('active');
                            showToast(`取消收藏失败: ${errorData.message || '未知错误'}`, 'error');
                        }
                    }
                } catch (error) {
                    console.error('收藏操作失败:', error);
                    // 发生异常时回退到原始状态
                    if (!isCurrentlyFavorite) {
                        icon.classList.replace('fas', 'far');
                        this.classList.remove('active');
                    } else {
                        icon.classList.replace('far', 'fas');
                        this.classList.add('active');
                    }
                    showToast('操作失败，请稍后再试', 'error');
                } finally {
                    // 移除处理中状态
                    this.removeAttribute('data-processing');
                }
            });
            
            // 添加到容器
            resultsContainer.appendChild(serviceCard);
        } catch (cardError) {
            console.error(`创建服务卡片 ${index + 1} 失败:`, cardError);
        }
    });
}

/**
 * 显示提示信息
 * @param {string} message 提示内容
 * @param {string} type 提示类型：success, error, info, warning
 */
function showToast(message, type = 'info') {
    console.log(`显示提示: ${message} (${type})`);
    
    // 检查是否已有Toast
    let toast = document.querySelector('.toast');
    
    if (!toast) {
    toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    
    // 清除之前的计时器
    if (toast.timeout) {
        clearTimeout(toast.timeout);
    }
    
    // 设置类型和内容
    toast.className = `toast ${type}`;
    
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    else if (type === 'error') icon = 'exclamation-circle';
    else if (type === 'warning') icon = 'exclamation-triangle';
    
    toast.innerHTML = `
        <div class="toast-icon">
        <i class="fas fa-${icon}"></i>
        </div>
        <div class="toast-content">${message}</div>
        <button class="toast-close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // 添加关闭按钮事件
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.remove(), 300);
    });
    
    // 显示Toast
    setTimeout(() => {
        toast.classList.add('toast-visible');
    }, 10);
    
    // 自动隐藏
    toast.timeout = setTimeout(() => {
        toast.classList.remove('toast-visible');
    setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

/**
 * 设置搜索表单提交事件
 */
function setupSearchForm() {
    const searchForm = document.getElementById('search-form');
    if (!searchForm) {
        console.log('未找到搜索表单');
        return;
    }
    
    console.log('设置搜索表单提交事件');
    
    // 移除可能存在的旧事件监听器
    const oldSearchForm = searchForm.cloneNode(true);
    searchForm.parentNode.replaceChild(oldSearchForm, searchForm);
    
    const searchInput = document.getElementById('search-input');
    if (!searchInput) {
        console.log('未找到搜索输入框');
        return;
    }
    
    // 表单提交事件
    oldSearchForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        console.log('搜索表单提交');
        
        const query = searchInput.value.trim();
        if (query) {
            // 更新URL
            const url = new URL(window.location);
            url.searchParams.set('query', query);
            window.history.pushState({}, '', url);
            
            // 执行搜索
            loadSearchResults(query, '', '');
        }
    });
} 