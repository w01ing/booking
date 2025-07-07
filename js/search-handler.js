/**
 * 顶部导航栏搜索功能处理模块
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('初始化顶部导航栏搜索功能');
    initializeTopNavSearch();
});

/**
 * 初始化顶部导航栏搜索功能
 */
function initializeTopNavSearch() {
    // 获取顶部导航栏搜索表单和输入框
    const searchForm = document.getElementById('top-search-form');
    const searchInput = document.getElementById('top-search-input');
    const searchIcon = document.querySelector('.top-nav .search-bar i.fa-search');
    
    if (!searchForm || !searchInput) {
        console.log('未找到顶部导航栏搜索表单或输入框');
        return;
    }
    
    console.log('找到顶部导航栏搜索表单，设置事件监听');
    
    // 为搜索表单添加提交事件
    searchForm.addEventListener('submit', function(e) {
        e.preventDefault();
        handleSearch(searchInput.value);
    });
    
    // 为搜索图标添加点击事件
    if (searchIcon) {
        searchIcon.addEventListener('click', function() {
            searchForm.dispatchEvent(new Event('submit'));
        });
    }
    
    // 如果当前页面是搜索结果页面，则从URL中获取查询参数并填充搜索框
    if (window.location.pathname.includes('search-results.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const query = urlParams.get('query');
        if (query) {
            searchInput.value = query;
        }
    }
}

/**
 * 处理搜索请求
 * @param {string} query - 搜索关键词
 */
function handleSearch(query) {
    query = query.trim();
    
    if (!query) {
        console.log('搜索关键词为空，不执行搜索');
        return;
    }
    
    console.log('执行搜索:', query);
    
    // 跳转到搜索结果页面
    window.location.href = `search-results.html?query=${encodeURIComponent(query)}`;
}

/**
 * 显示提示消息
 * @param {string} message - 消息内容
 * @param {string} type - 消息类型 (success, error, info, warning)
 * @param {number} duration - 显示持续时间（毫秒）
 */
function showToast(message, type = 'info', duration = 3000) {
    // 检查是否已存在Toast容器
    let toastContainer = document.querySelector('.toast-container');
    
    // 如果不存在，则创建一个
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        toastContainer.style.position = 'fixed';
        toastContainer.style.top = '20px';
        toastContainer.style.right = '20px';
        toastContainer.style.zIndex = '9999';
        document.body.appendChild(toastContainer);
    }
    
    // 创建Toast元素
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.backgroundColor = type === 'success' ? '#4caf50' : 
                                type === 'error' ? '#f44336' : 
                                type === 'warning' ? '#ff9800' : '#2196f3';
    toast.style.color = '#fff';
    toast.style.padding = '12px 20px';
    toast.style.marginBottom = '10px';
    toast.style.borderRadius = '4px';
    toast.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.minWidth = '250px';
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    
    // 添加图标
    const icon = document.createElement('i');
    icon.className = `fas ${type === 'success' ? 'fa-check-circle' : 
                        type === 'error' ? 'fa-exclamation-circle' : 
                        type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`;
    icon.style.marginRight = '10px';
    toast.appendChild(icon);
    
    // 添加消息文本
    const text = document.createElement('span');
    text.textContent = message;
    toast.appendChild(text);
    
    // 添加到容器
    toastContainer.appendChild(toast);
    
    // 显示Toast
    setTimeout(() => {
        toast.style.opacity = '1';
    }, 10);
    
    // 设置自动关闭
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            toastContainer.removeChild(toast);
            
            // 如果没有更多的Toast，移除容器
            if (toastContainer.children.length === 0) {
                document.body.removeChild(toastContainer);
            }
        }, 300);
    }, duration);
} 