/**
 * 搜索页面功能模块
 */

/**
 * 返回上一页功能
 */
function goBack() {
    // 检查是否有历史记录
    if (window.history.length > 1) {
        window.history.back();
    } else {
        // 如果没有历史记录，默认返回到主页
        window.location.href = 'dashboard.html';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    try {
        console.log('搜索页面DOMContentLoaded事件触发');
        console.log('当前页面URL:', window.location.href);
        console.log('当前页面路径:', window.location.pathname);
        
        // 检查是否在搜索页面
        const isSearchPage = window.location.pathname.includes('search.html');
        
        // 检查是否在search.html页面
        if (isSearchPage) {
            console.log('当前在搜索页面，初始化分类标签');
            
            // 检查分类标签是否存在
            const categoryTabs = document.querySelectorAll('.category-tab');
            console.log(`找到 ${categoryTabs.length} 个分类标签:`, Array.from(categoryTabs).map(tab => tab.textContent.trim()));
            
            // 检查服务容器是否存在
            const servicesContainer = document.querySelector('.services-grid');
            console.log('服务容器存在:', !!servicesContainer);
            
            // 检查结果计数元素是否存在
            const resultCountElement = document.querySelector('.result-count');
            console.log('结果计数元素存在:', !!resultCountElement);
        } else {
            console.log('当前不在搜索页面，仅初始化基本搜索功能');
        }
        
        // 先验证令牌，再初始化页面
        validateToken().then(isValid => {
            console.log('Token验证结果:', isValid ? '有效' : '无效');
            
            // 不管令牌是否有效，继续加载页面
            return initSearchPage();
        }).catch(error => {
            console.error('初始化搜索页面失败:', error);
            // 不在搜索页面时不显示错误提示
            if (isSearchPage) {
                showToast('加载页面时出错，请刷新重试', 'error');
            }
        });
    } catch (error) {
        console.error('页面初始化过程中发生未捕获错误:', error);
        // 只在搜索页面显示错误提示
        if (window.location.pathname.includes('search.html')) {
            alert('初始化页面失败，请刷新页面重试');
        }
    }
});

/**
 * 验证本地存储的token是否有效
 * @returns {boolean} token是否有效
 */
async function validateToken() {
    const token = localStorage.getItem('token');
    console.log('验证token: ', token ? token.substring(0, 15) + '...' : 'token不存在');
    
    if (!token) return false;
    
    try {
        console.log('验证token有效性: 开始验证');
        const response = await fetch('/api/user', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('验证token有效性: 服务器返回 status=', response.status);
        
        if (!response.ok) {
            const errorMessage = await handleApiError(response);
            console.error('Token验证失败:', errorMessage);
            
            // token无效或过期，清除本地存储
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            localStorage.removeItem('username');
            localStorage.removeItem('userType');
            
            // 使用showToast而不是alert
            try {
                showToast(`身份验证失败: ${errorMessage}`, 'error');
            } catch (e) {
                console.error('无法显示Toast消息:', e);
            }
            
            return false;
        }
        
        const userData = await response.json();
        console.log('Token验证成功, 用户信息:', userData);
        return true;
    } catch (error) {
        console.error('验证token时出错:', error);
        return false;
    }
}

/**
 * 初始化搜索页面
 */
async function initSearchPage() {
    console.log('初始化搜索页面');
    
    // 检查当前是否在搜索页面
    const isSearchPage = window.location.pathname.includes('search.html');
    console.log('是否在搜索页面:', isSearchPage);
    
    // 获取并处理URL查询参数
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('query');
    console.log('搜索查询:', query);
    
    // 更新搜索头部
    updateSearchHeader(query);
    
    // 设置搜索表单
    setupSearchForm();
    
    // 如果在搜索页面
    if (isSearchPage) {
        // 如果有查询参数，执行搜索
        if (query) {
            await performSearch(query);
        } else {
            // 没有查询参数时，显示所有服务
            await performSearch('');
        }
        
        // 设置类别标签
        setupCategoryTabs();
        
        // 设置排序选项
        setupSortOptions();
        
        // 设置视图切换事件
        setupViewToggle();
    }
    
    console.log('搜索页面初始化完成');
}

/**
 * 更新搜索头部信息
 * @param {string} query 搜索查询
 */
function updateSearchHeader(query) {
    const searchTitle = document.getElementById('search-title');
    const searchDescription = document.getElementById('search-description');
    
    // 更新页面标题
    if (query) {
        document.title = `"${query}" 的搜索结果 - 预约平台`;
    } else {
        document.title = `全部服务 - 预约平台`;
    }
    
    // 仅在元素存在时更新内容
    if (searchTitle) {
        searchTitle.textContent = query ? `"${query}" 的搜索结果` : `全部服务`;
    }
    
    if (searchDescription) {
        searchDescription.textContent = query ? `为您找到相关服务` : `浏览所有可用服务`;
    }
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
    
    const searchInput = document.getElementById('search-input');
    if (!searchInput) {
        console.log('未找到搜索输入框');
        return;
    }
    
    const searchIcon = document.getElementById('search-icon');
    
    // 表单提交事件
    searchForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query) {
            // 检查当前是否在搜索页面
            const isSearchPage = window.location.pathname.includes('search.html') || 
                                window.location.pathname.includes('search-results.html');
            
            if (isSearchPage) {
                // 在搜索页面，更新URL并执行搜索
                updateUrlQuery(query);
                await performSearch(query);
            } else {
                // 不在搜索页面，跳转到搜索结果页面
                window.location.href = `search-results.html?query=${encodeURIComponent(query)}`;
            }
        }
    });
    
    // 搜索图标点击事件
    if (searchIcon) {
        searchIcon.addEventListener('click', function() {
            searchForm.dispatchEvent(new Event('submit'));
        });
    }
}

/**
 * 更新URL查询参数但不刷新页面
 * @param {string} query 搜索查询
 */
function updateUrlQuery(query) {
    const url = new URL(window.location);
    url.searchParams.set('query', query);
    window.history.pushState({}, '', url);
}

/**
 * 执行搜索并展示结果
 * @param {string} query 搜索查询
 */
async function performSearch(query) {
    console.log('执行搜索:', query);
    
    // 更新搜索头部
    updateSearchHeader(query);
    
    // 获取搜索结果
    const results = await searchServices(query);
    console.log(`搜索到 ${results.length} 个结果`);
    
    // 获取搜索结果容器 - 同时支持search.html和search-results.html
    const searchResultsContainer = document.querySelector('#search-results') || document.querySelector('.services-grid');
    if (!searchResultsContainer) {
        console.log('未找到搜索结果容器，可能不在搜索页面');
        return;
    }
    
    // 显示结果
    await displaySearchResults(results);
    
    // 更新结果数量显示
    updateResultCount(results.length);
    
    // 显示加载更多按钮（如果有结果）
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.style.display = results.length > 0 ? 'inline-block' : 'none';
    }
}

/**
 * 搜索服务
 * @param {string} query 搜索关键词
 * @returns {Array} 搜索结果数组
 */
async function searchServices(query) {
    console.log('执行搜索服务, 查询:', query);
    
    try {
        // 获取当前选中的分类（如果在搜索页面）
        let category = '';
        const activeTab = document.querySelector('.category-tab.active');
        if (activeTab && activeTab.textContent.trim() !== '全部') {
            category = activeTab.textContent.trim();
        }
        
        // 获取当前排序方式（如果在搜索页面）
        let sortBy = '';
        const activeSort = document.querySelector('.sort-option.active');
        if (activeSort) {
            sortBy = activeSort.getAttribute('data-sort');
        }
        
        // 构建查询参数
        const params = new URLSearchParams();
        if (query) params.append('query', query);
        if (category) params.append('category', category);
        if (sortBy) {
            // 转换前端排序值为后端排序值
            if (sortBy === 'price-asc') params.append('sort_by', 'price_asc');
            else if (sortBy === 'price-desc') params.append('sort_by', 'price_desc');
            else if (sortBy === 'rating') params.append('sort_by', 'rating');
            else params.append('sort_by', 'relevance');
        }
        
        // 从后端API获取所有公开服务
        const response = await fetch(`/api/services/public?${params.toString()}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            console.error('获取服务列表失败:', response.status);
            return [];
        }
        
        const data = await response.json();
        let services = data.services || [];
        
        console.log('从后端获取服务数据:', services.length, '条');
        
        // 确保所有服务都有正确的category属性
        services = services.map(service => {
            if (!service.category && service.categories && service.categories.length > 0) {
                service.category = service.categories[0];
            } else if (!service.category) {
                service.category = '其他';
            }
            
            // 确保服务有provider字段
            if (!service.provider && service.provider_id) {
                service.provider = service.business_name || '未知服务商';
            }
            
            // 确保每个服务都有tags数组
            if (!service.tags && service.categories) {
                service.tags = service.categories;
            } else if (!service.tags) {
                service.tags = [];
            }
            
            return service;
        });
        
        console.log('处理后的服务数据:', services.length, '条');
        console.log('服务类别列表:', [...new Set(services.map(service => service.category))]);
        
        return services;
    } catch (error) {
        console.error('获取服务列表时出错:', error);
        return [];
    }
}

/**
 * 显示搜索结果
 * @param {Array} results 搜索结果数组
 */
async function displaySearchResults(results) {
    // 同时支持search.html和search-results.html
    const servicesContainer = document.querySelector('#search-results') || document.querySelector('.services-grid');
    if (!servicesContainer) {
        console.log('未找到服务容器元素，可能不在搜索页面');
        return;
    }
    
    console.log(`显示 ${results.length} 个搜索结果`);
    
    // 检查当前页面是否为search-results.html
    const isSearchResultsPage = window.location.pathname.includes('search-results.html');
    
    // 如果是search-results.html页面，不执行渲染，因为search-results.js已经处理了
    if (isSearchResultsPage) {
        console.log('当前在search-results.html页面，跳过渲染搜索结果');
        return;
    }
    
    // 清空现有结果
    servicesContainer.innerHTML = '';
    
    // 如果没有结果，显示无结果提示
    if (results.length === 0) {
        servicesContainer.innerHTML = `
            <div class="no-results" style="grid-column: 1/-1; text-align: center; padding: 50px 0;">
                <i class="fas fa-search" style="font-size: 48px; color: #ccc; margin-bottom: 20px;"></i>
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
            const response = await fetch('/api/favorites', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                favorites = data.map(item => item.service_id);
            }
        }
    } catch (error) {
        console.error('获取收藏列表失败:', error);
    }
    
    // 创建服务卡片
    results.forEach(service => {
        // 创建服务卡片元素
        const serviceCard = document.createElement('div');
        serviceCard.className = 'service-card';
        
        // 检查是否已收藏
        const isFavorite = favorites.includes(service.id);
        
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
        } else if (service.category) {
            categoryDisplay = service.category;
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
        serviceCard.addEventListener('click', function(e) {
            if (!e.target.closest('.favorite-btn')) {
                window.location.href = `service-detail.html?id=${service.id}`;
            }
        });
        
        // 收藏按钮点击事件
        const favoriteBtn = serviceCard.querySelector('.favorite-btn');
        if (favoriteBtn) {
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
                
                try {
                    if (!isCurrentlyFavorite) {
                        // 添加收藏
                        const response = await fetch('/api/favorites', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ service_id: service.id })
                        });
                        
                        if (response.ok) {
                            icon.classList.replace('far', 'fas');
                            this.classList.add('active');
                            showToast('已添加到收藏');
                        } else {
                            const errorData = await response.json();
                            showToast(`收藏失败: ${errorData.message || '未知错误'}`, 'error');
                        }
                    } else {
                        // 取消收藏
                        const response = await fetch(`/api/favorites/${service.id}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });
                        
                        if (response.ok) {
                            icon.classList.replace('fas', 'far');
                            this.classList.remove('active');
                            showToast('已从收藏中移除');
                        } else {
                            const errorData = await response.json();
                            showToast(`取消收藏失败: ${errorData.message || '未知错误'}`, 'error');
                        }
                    }
                } catch (error) {
                    console.error('收藏操作失败:', error);
                    showToast('操作失败，请稍后再试', 'error');
                }
            });
        }
        
        // 添加到容器
        servicesContainer.appendChild(serviceCard);
    });
}

/**
 * 设置分类标签切换事件
 */
function setupCategoryTabs() {
    console.log('设置分类标签切换事件');
    const categoryTabs = document.querySelectorAll('.category-tab');
    
    if (!categoryTabs.length) {
        console.log('未找到分类标签');
        return;
    }
    
    console.log(`找到 ${categoryTabs.length} 个分类标签`);
    
    categoryTabs.forEach(tab => {
        tab.addEventListener('click', async function() {
            const category = this.textContent.trim();
            console.log(`点击分类标签: ${category}`);
            
            // 更新激活状态
            categoryTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // 获取当前搜索查询
            const query = new URLSearchParams(window.location.search).get('query') || '';
            
            // 获取当前排序方式
            let sortBy = '';
            const activeSort = document.querySelector('.sort-option.active');
            if (activeSort) {
                sortBy = activeSort.getAttribute('data-sort');
            }
            
            // 直接从API获取筛选后的结果
            const results = await searchServices(query);
            console.log(`搜索结果数量: ${results.length}`);
            
            // 更新显示
            await displaySearchResults(results);
            
            // 更新结果数量显示
            updateResultCount(results.length);
        });
    });
}

/**
 * 设置排序选项事件
 */
function setupSortOptions() {
    const sortOptions = document.querySelectorAll('.sort-option');
    
    sortOptions.forEach(option => {
        option.addEventListener('click', async function() {
            // 更新激活状态
            sortOptions.forEach(o => o.classList.remove('active'));
            this.classList.add('active');
            
            // 获取排序类型
            const sortType = this.getAttribute('data-sort');
            console.log(`选择排序方式: ${sortType}`);
            
            // 获取当前选中的分类
            const selectedCategory = document.querySelector('.category-tab.active').textContent.trim();
            
            // 获取当前搜索查询
            const query = new URLSearchParams(window.location.search).get('query') || '';
            
            // 直接从API获取已排序的结果
            const results = await searchServices(query);
            
            // 更新显示
            await displaySearchResults(results);
            
            // 更新结果数量显示
            updateResultCount(results.length);
        });
    });
}

/**
 * 设置视图切换事件
 */
function setupViewToggle() {
    const gridViewBtn = document.getElementById('grid-view');
    const listViewBtn = document.getElementById('list-view');
    const resultsContainer = document.getElementById('search-results');
    
    if (gridViewBtn && listViewBtn && resultsContainer) {
        // 网格视图按钮
        gridViewBtn.addEventListener('click', function() {
            gridViewBtn.classList.add('active');
            listViewBtn.classList.remove('active');
            resultsContainer.className = 'services-grid';
        });
        
        // 列表视图按钮
        listViewBtn.addEventListener('click', function() {
            listViewBtn.classList.add('active');
            gridViewBtn.classList.remove('active');
            resultsContainer.className = 'services-list';
        });
    }
}

/**
 * 显示提示消息
 * @param {string} message 提示消息
 * @param {string} type 提示类型 (success, error, info)
 */
function showToast(message, type = 'success') {
    // 检查是否已存在Toast
    let toast = document.querySelector('.search-toast');
    
    // 如果已存在则移除
    if (toast) {
        document.body.removeChild(toast);
    }
    
    // 创建新的Toast
    toast = document.createElement('div');
    toast.className = `search-toast ${type}`;
    
    // 设置图标
    let icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    else if (type === 'info') icon = 'info-circle';
    
    // 设置内容
    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;
    
    // 添加到文档
    document.body.appendChild(toast);
    
    // 设置样式
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8';
    toast.style.color = '#fff';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '4px';
    toast.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '8px';
    toast.style.zIndex = '9999';
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    
    // 显示Toast
    setTimeout(() => {
        toast.style.opacity = '1';
    }, 10);
    
    // 3秒后隐藏
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

/**
 * 处理API错误响应
 * @param {Response} response API响应对象
 * @returns {string} 错误消息
 */
async function handleApiError(response) {
    let errorMessage = '操作失败，请稍后再试';
    
    try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.message || '服务器返回错误，但未提供详细信息';
        } else {
            errorMessage = await response.text() || `HTTP错误: ${response.status}`;
        }
    } catch (e) {
        errorMessage = `解析错误响应失败: ${e.message}`;
    }
    
    return errorMessage;
}

/**
 * 检查用户登录状态
 * @returns {boolean} 是否已登录
 */
function checkLoginStatus() {
    const token = localStorage.getItem('token');
    if (!token) {
        console.log('用户未登录');
        return false;
    }
    
    const userId = localStorage.getItem('userId');
    const username = localStorage.getItem('username');
    
    if (!userId || !username) {
        console.log('登录信息不完整');
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        localStorage.removeItem('userType');
        return false;
    }
    
    return true;
}

// 全局搜索功能
console.log("加载search.js");

// 全局服务数据，用于搜索结果展示
window.serviceData = [
    {
        id: "1",
        title: "专业中医推拿",
        provider: "康复理疗中心",
        price: 298,
        image: "img/service1.jpg",
        category: "健康",
        tags: ["中医", "理疗", "推拿"],
        location: "北京市朝阳区"
    },
    {
        id: "2",
        title: "瑜伽私教课",
        provider: "轻体健身中心",
        price: 198,
        image: "img/service2.jpg",
        category: "健身",
        tags: ["瑜伽", "私教", "健身"],
        location: "北京市海淀区"
    },
    {
        id: "3",
        title: "面部深层清洁",
        provider: "美丽空间美容院",
        price: 158,
        image: "img/service3.jpg",
        category: "美容",
        tags: ["护肤", "面部", "清洁"],
        location: "北京市朝阳区"
    },
    {
        id: "4",
        title: "精油SPA按摩",
        provider: "悠然SPA会所",
        price: 388,
        image: "img/service4.jpg",
        category: "休闲",
        tags: ["按摩", "SPA", "精油"],
        location: "北京市朝阳区"
    },
    {
        id: "5",
        title: "婚纱摄影套餐",
        provider: "幸福时光摄影",
        price: 3999,
        image: "img/service5.jpg",
        category: "摄影",
        tags: ["婚纱", "摄影", "婚礼"],
        location: "北京市海淀区"
    }
];

// 立即初始化搜索功能
initializeSearch();

// 在DOM加载完成后再次初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM加载完成，初始化搜索功能");
    initializeSearch();
});

// 在页面完全加载后再次尝试初始化（确保所有资源都已加载）
window.addEventListener('load', function() {
    console.log("页面完全加载，再次初始化搜索功能");
    setTimeout(initializeSearch, 500);
});

// 搜索功能初始化
function initializeSearch() {
    try {
        console.log("初始化搜索功能");
        
        // 获取所有搜索框
        const searchBars = document.querySelectorAll('.search-bar');
        console.log(`找到 ${searchBars.length} 个搜索栏`);
        
        if (searchBars.length === 0) return;
        
        // 为每个搜索框设置功能
        searchBars.forEach((searchBar, index) => {
            try {
                console.log(`设置搜索栏 ${index + 1}`);
                
                // 获取搜索输入框和图标
                const searchInput = searchBar.querySelector('input');
                const searchIcon = searchBar.querySelector('i.fa-search');
                
                if (!searchInput) {
                    console.log(`搜索栏 ${index + 1} 没有输入框`);
                    return;
                }
                
                console.log(`搜索栏 ${index + 1} 输入框: ${searchInput}`);
                
                // 检查是否已经初始化过
                if (searchInput.dataset.initialized === 'true') {
                    console.log(`搜索栏 ${index + 1} 已经初始化过`);
                    return;
                }
                
                // 标记为已初始化
                searchInput.dataset.initialized = 'true';
                
                // 创建搜索结果容器
                let searchResultsContainer = searchBar.querySelector('.search-results');
                if (!searchResultsContainer) {
                    searchResultsContainer = document.createElement('div');
                    searchResultsContainer.className = 'search-results';
                    searchBar.appendChild(searchResultsContainer);
                }
                
                // 添加输入事件
                searchInput.addEventListener('input', async function(e) {
                    const query = e.target.value.trim().toLowerCase();
                    
                    // 如果查询为空，隐藏结果容器
                    if (query === '') {
                        searchResultsContainer.innerHTML = '';
                        searchResultsContainer.classList.remove('active');
                        return;
                    }
                    
                    // 显示加载状态
                    searchResultsContainer.innerHTML = '<div class="loading">搜索中...</div>';
                    searchResultsContainer.classList.add('active');
                    
                    try {
                        // 从API获取搜索建议
                        const response = await fetch(`/api/services/public?query=${encodeURIComponent(query)}&limit=5`, {
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        });
                        
                        if (!response.ok) {
                            throw new Error(`API请求失败: ${response.status}`);
                        }
                        
                        const data = await response.json();
                        const results = data.services || [];
                        
                        // 显示结果
                        if (results.length > 0) {
                            showSearchResults(results, searchResultsContainer);
                        } else {
                            searchResultsContainer.innerHTML = '<div class="no-results">未找到相关服务，请尝试其他关键词</div>';
                        }
                    } catch (error) {
                        console.error('获取搜索建议失败:', error);
                        searchResultsContainer.innerHTML = '<div class="error">搜索失败，请稍后再试</div>';
                    }
                });
                
                // 添加回车键执行搜索的事件
                searchInput.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        const query = e.target.value.trim();
                        if (query) {
                            window.location.href = `search.html?query=${encodeURIComponent(query)}`;
                        }
                    }
                });
                
                // 为搜索图标添加点击事件
                if (searchIcon) {
                    searchIcon.style.cursor = 'pointer';
                    searchIcon.addEventListener('click', function() {
                        const query = searchInput.value.trim();
                        if (query) {
                            window.location.href = `search.html?query=${encodeURIComponent(query)}`;
                        }
                    });
                }
                
                // 添加点击外部区域隐藏搜索结果的事件
                document.addEventListener('click', function(e) {
                    if (!searchBar.contains(e.target)) {
                        searchResultsContainer.classList.remove('active');
                    }
                });
            } catch (error) {
                console.error(`设置搜索栏 ${index + 1} 时发生错误:`, error);
            }
        });
    } catch (error) {
        console.error("初始化搜索功能时发生错误:", error);
    }
}

// 显示搜索结果在搜索框下拉菜单中
function showSearchResults(results, container) {
    container.innerHTML = '';
    
    // 最多显示5个结果
    const displayResults = results.slice(0, 5);
    
    displayResults.forEach(service => {
        const resultItem = document.createElement('div');
        resultItem.className = 'search-result-item';
        resultItem.innerHTML = `
            <div class="result-image">
                <img src="${service.image}" alt="${service.title}" onerror="this.src='img/placeholder.jpg'">
            </div>
            <div class="result-info">
                <div class="result-title">${service.title}</div>
                <div class="result-provider">${service.provider}</div>
                <div class="result-price">¥${service.price}</div>
            </div>
        `;
        
        // 点击搜索结果项跳转到服务详情页面
        resultItem.addEventListener('click', () => {
            window.location.href = `service-detail.html?id=${service.id}`;
        });
        
        container.appendChild(resultItem);
    });
    
    // 如果结果超过5个，显示"查看更多"链接
    if (results.length > 5) {
        const viewMoreItem = document.createElement('div');
        viewMoreItem.className = 'view-more';
        viewMoreItem.textContent = `查看全部 ${results.length} 个结果`;
        
        viewMoreItem.addEventListener('click', () => {
            const searchInput = container.parentElement.querySelector('input');
            window.location.href = `search.html?query=${encodeURIComponent(searchInput.value.trim())}`;
        });
        
        container.appendChild(viewMoreItem);
    }
}

/**
 * 更新结果数量显示
 * @param {number} count 结果数量
 */
function updateResultCount(count) {
    // 尝试更新search.html页面中的结果数量显示
    const resultCountElement = document.querySelector('.result-count');
    if (resultCountElement) {
        resultCountElement.textContent = `${count} 个结果`;
    }
    
    // 尝试更新search-results.html页面中的结果数量显示
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
