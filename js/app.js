// 尝试直接绑定导航栏事件，不等待DOMContentLoaded
console.log("加载app.js");

// 使用setTimeout确保DOM已加载
setTimeout(function() {
    // 导航栏按钮直接绑定事件
    console.log("直接绑定导航栏事件");
    
    // 发现服务按钮 - 简化代码，直接跳转到search-results.html
    var discoverBtns = document.querySelectorAll('.publish-btn');
    console.log("发现服务按钮数量:", discoverBtns.length);
    
    for(var i = 0; i < discoverBtns.length; i++) {
        discoverBtns[i].addEventListener('click', function(e) {
            e.preventDefault();
            console.log("点击了发现服务按钮，跳转到search-results.html");
            window.location.href = 'search-results.html';
        });
    }
    
    // 通知按钮 - 直接跳转到notifications.html页面
    var notificationBtns = document.querySelectorAll('.notification-btn');
    console.log("通知按钮数量:", notificationBtns.length);
    
    for(var i = 0; i < notificationBtns.length; i++) {
        notificationBtns[i].addEventListener('click', function(e) {
            e.preventDefault();
            console.log("点击了通知按钮，跳转到notifications.html");
            window.location.href = 'notifications.html';
        });
    }
});
    
// 其余app.js代码
const sign_in_btn = document.querySelector("#sign-in-btn");
const sign_up_btn = document.querySelector("#sign-up-btn");
const container = document.querySelector(".container");

sign_up_btn.addEventListener("click", () => {
    container.classList.add("sign-up-mode");
});

sign_in_btn.addEventListener("click", () => {
    container.classList.remove("sign-up-mode");
});


// 表单提交处理
const signUpForm = document.querySelector(".sign-up-form");
const signInForm = document.querySelector(".sign-in-form");

signUpForm.addEventListener("submit", async (e) => {
    const isValid = validateSignUp(e);
    if (!isValid) {
        return;
    }
    e.preventDefault();
    
    const formData = {
        username: signUpForm.querySelector('input[type="text"]').value,
        email: signUpForm.querySelector('input[type="email"]').value,
        password: signUpForm.querySelector('input[type="password"]').value,
        userType: signUpForm.querySelector('input[name="userType"]:checked').value
    };

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();
        
        if (response.ok) {
            alert('注册成功！请登录');
            container.classList.remove("sign-up-mode");
            // 彻底清空注册表单所有内容
            const signUpForm = document.querySelector('.sign-up-form');
            if (signUpForm) {
                // 清空所有input和textarea
                signUpForm.querySelectorAll('input, textarea').forEach(input => {
                    if (input.type === 'radio' || input.type === 'checkbox') {
                        input.checked = false;
                    } else {
                        input.value = '';
                    }
                });
            }
        } else {
            alert(data.message || '注册失败，请重试');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('注册失败，请检查网络连接');
    }
});

signInForm.addEventListener("submit", async (e) => {
    const isValid = validateSignIn(e);
    if (!isValid) {
        return;
    }
    e.preventDefault();
    
    const formData = {
        email: signInForm.querySelector('input[type="email"]').value,
        password: signInForm.querySelector('input[type="password"]').value
    };

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();
        
        if (response.ok) {
            // 登录成功，保存用户信息到 localStorage
            localStorage.setItem('userId', data.userId);
            localStorage.setItem('username', data.username);
            localStorage.setItem('userType', data.userType);
            localStorage.setItem('token', data.token);
            // 使用后端返回的重定向路径
            window.location.href = data.redirect;
        } else {
            alert(data.message || '登录失败，请检查邮箱和密码');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('登录失败，请检查网络连接');
    }
});

// 表单验证
const inputs = document.querySelectorAll('input');

inputs.forEach(input => {
    if (input.type !== 'radio') {
        input.addEventListener('blur', () => {
            if (input.value.trim() === '') {
                input.style.borderColor = '#ff4444';
            } else {
                input.style.borderColor = '';
            }
        });

        input.addEventListener('focus', () => {
            input.style.borderColor = '';
        });
    }
});

// 密码强度验证
const passwordInput = signUpForm.querySelector('input[type="password"]');
passwordInput.addEventListener('input', () => {
    const password = passwordInput.value;
    const strength = checkPasswordStrength(password);
    
    // 移除之前的所有强度类
    passwordInput.classList.remove('weak', 'medium', 'strong');
    
    if (password.length > 0) {
        passwordInput.classList.add(strength);
    }
});

function checkPasswordStrength(password) {
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (password.length < 8) return 'weak';
    if (hasLetter && hasNumber && hasSpecial && password.length >= 12) return 'strong';
    if ((hasLetter && hasNumber) || (hasLetter && hasSpecial) || (hasNumber && hasSpecial)) return 'medium';
    return 'weak';
}

// 导航栏滚动效果
document.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 20) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// 搜索框动画
const searchInput = document.querySelector('.search-box input');
const searchIcon = document.querySelector('.search-box i');

if (searchInput && searchIcon) {
    searchInput.addEventListener('focus', () => {
        searchIcon.style.color = '#4481eb';
    });

    searchInput.addEventListener('blur', () => {
        if (!searchInput.value) {
            searchIcon.style.color = '#666';
        }
    });
}

// 用户菜单交互
const userMenu = document.querySelector('.user-menu');
const dropdownMenu = document.querySelector('.dropdown-menu');

// 点击其他地方关闭下拉菜单
document.addEventListener('click', (e) => {
    if (!userMenu.contains(e.target)) {
        dropdownMenu.style.opacity = '0';
        dropdownMenu.style.visibility = 'hidden';
        dropdownMenu.style.transform = 'translateY(10px)';
    }
});

// 通知徽章动画
const notificationBadge = document.querySelector('.notification-badge');
if (notificationBadge) {
    notificationBadge.addEventListener('mouseover', () => {
        notificationBadge.style.transform = 'scale(1.1)';
    });
    
    notificationBadge.addEventListener('mouseout', () => {
        notificationBadge.style.transform = 'scale(1)';
    });
}

// 导航链接悬停效果
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('mouseover', () => {
        link.style.transform = 'translateY(-2px)';
    });
    
    link.addEventListener('mouseout', () => {
        link.style.transform = 'translateY(0)';
    });
});

// 初始化页面
document.addEventListener('DOMContentLoaded', () => {
    initializeFavorites();
    initializeBookingButtons();
    initializeGlobalSearch();
    initializeNavbar();
});

// 初始化收藏按钮
function initializeFavorites() {
    const favoriteButtons = document.querySelectorAll('.btn-favorite');
    
    favoriteButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡到卡片
            const icon = btn.querySelector('i');
            
            // 切换收藏状态
            icon.classList.toggle('far');
            icon.classList.toggle('fas');
            
            // 添加动画效果
            btn.style.transform = 'scale(1.2)';
            setTimeout(() => {
                btn.style.transform = 'scale(1)';
            }, 200);

            // 更新图标颜色
            icon.style.color = icon.classList.contains('fas') ? '#ff4d4f' : '#666';

            // 显示提示
            showToast(icon.classList.contains('fas') ? '已添加到收藏' : '已取消收藏');
        });
    });
}

// 初始化预约按钮
function initializeBookingButtons() {
    const bookingButtons = document.querySelectorAll('.btn-book');
    
    bookingButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡到卡片
            
            // 获取服务信息
            const card = btn.closest('.service-card');
            const serviceName = card.querySelector('.service-name').textContent;
            const serviceId = card.getAttribute('onclick').match(/id=(\d+)/)[1];
            
            // 跳转到服务详情页
            window.location.href = `service-detail.html?id=${serviceId}`;
        });
    });
}

// 显示提示信息
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    // 添加样式
    toast.style.cssText = `
        position: fixed;
        bottom: 20%;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 1rem 2rem;
        border-radius: 24px;
        font-size: 1rem;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;

    document.body.appendChild(toast);

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

// 添加页面过渡动画
window.addEventListener('pageshow', () => {
    document.body.style.opacity = '1';
});

window.addEventListener('beforeunload', () => {
    document.body.style.opacity = '0';
}); 

// 模拟服务数据 - 用于搜索功能
const serviceData = [
    {
        id: 1,
        title: "专业中医推拿",
        provider: "康复理疗中心",
        category: "医疗保健",
        tags: ["推拿", "按摩", "中医", "理疗"],
        rating: 4.8,
        price: 188,
        location: "朝阳区",
        image: "img/service1.jpg"
    },
    {
        id: 2,
        title: "日式美甲护理",
        provider: "樱花美甲沙龙",
        category: "美容美发",
        tags: ["美甲", "日式", "护理"],
        rating: 5.0,
        price: 128,
        location: "海淀区",
        image: "img/service2.jpg"
    },
    {
        id: 3,
        title: "瑜伽私教课程",
        provider: "轻体健身中心",
        category: "运动健身",
        tags: ["瑜伽", "私教", "健身"],
        rating: 4.0,
        price: 299,
        location: "朝阳区",
        image: "img/service3.jpg"
    },
    {
        id: 4,
        title: "精油SPA",
        provider: "舒适水疗中心",
        category: "美容美发",
        tags: ["SPA", "精油", "按摩", "放松"],
        rating: 4.6,
        price: 268,
        location: "朝阳区",
        image: "img/service4.jpg"
    },
    {
        id: 5,
        title: "高级发型设计",
        provider: "潮流发艺",
        category: "美容美发",
        tags: ["理发", "染发", "造型", "设计"],
        rating: 4.5,
        price: 200,
        location: "海淀区",
        image: "img/service5.jpg"
    }
];

// 全局搜索功能初始化
function initializeGlobalSearch() {
    // 获取所有页面上的搜索框
    const searchInputs = document.querySelectorAll('.search-bar input');
    
    if (searchInputs.length === 0) return;
    
    // 为每个搜索框添加事件监听
    searchInputs.forEach(input => {
        // 创建搜索结果容器
        const searchResultsContainer = document.createElement('div');
        searchResultsContainer.className = 'search-results';
        input.parentElement.appendChild(searchResultsContainer);
        
        // 添加输入事件
        input.addEventListener('input', function(e) {
            const query = e.target.value.trim().toLowerCase();
            
            // 如果查询为空，隐藏结果容器
            if (query === '') {
                searchResultsContainer.innerHTML = '';
                searchResultsContainer.classList.remove('active');
                return;
            }
            
            // 执行搜索
            const results = searchServices(query);
            
            // 显示结果
            if (results.length > 0) {
                displaySearchResults(results, searchResultsContainer);
                searchResultsContainer.classList.add('active');
            } else {
                searchResultsContainer.innerHTML = '<div class="no-results">未找到相关服务，请尝试其他关键词</div>';
                searchResultsContainer.classList.add('active');
            }
        });
        
        // 添加点击外部区域隐藏搜索结果的事件
        document.addEventListener('click', function(e) {
            if (!input.parentElement.contains(e.target)) {
                searchResultsContainer.classList.remove('active');
            }
        });
        
        // 添加回车键执行搜索的事件
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const query = e.target.value.trim();
                if (query) {
                    window.location.href = `search-results.html?query=${encodeURIComponent(query)}`;
                }
            }
        });

        // 为搜索图标添加点击事件，点击后执行搜索
        const searchIcon = input.previousElementSibling;
        if (searchIcon && searchIcon.tagName === 'I') {
            searchIcon.style.cursor = 'pointer';
            searchIcon.addEventListener('click', function() {
                const query = input.value.trim();
                if (query) {
                    window.location.href = `search-results.html?query=${encodeURIComponent(query)}`;
                }
            });
        }

        // 为搜索框的父元素添加表单提交事件（如果是表单）
        const searchForm = input.closest('form');
        if (searchForm) {
            searchForm.addEventListener('submit', function(e) {
                e.preventDefault();
                const query = input.value.trim();
                if (query) {
                    window.location.href = `search-results.html?query=${encodeURIComponent(query)}`;
                }
            });
        }
    });
}

// 搜索服务
function searchServices(query) {
    if (!query) return [];
    
    // 如果serviceData未定义或为空，提供一些示例数据
    if (typeof serviceData === 'undefined' || !serviceData) {
        // 示例数据
        return [
            {
                id: 1,
                title: "专业中医推拿",
                provider: "康复理疗中心",
                price: 298,
                image: "img/service1.jpg",
                category: "健康",
                tags: ["中医", "理疗", "推拿"],
                location: "北京市朝阳区"
            },
            {
                id: 2,
                title: "瑜伽私教课",
                provider: "轻体健身中心",
                price: 198,
                image: "img/service2.jpg",
                category: "健身",
                tags: ["瑜伽", "私教", "健身"],
                location: "北京市海淀区"
            }
        ].filter(service => {
            return service.title.toLowerCase().includes(query) ||
                service.provider.toLowerCase().includes(query) ||
                service.category.toLowerCase().includes(query) ||
                service.tags.some(tag => tag.toLowerCase().includes(query)) ||
                service.location.toLowerCase().includes(query);
        });
    }
    
    return serviceData.filter(service => {
        const titleMatch = service.title.toLowerCase().includes(query);
        const providerMatch = service.provider.toLowerCase().includes(query);
        const categoryMatch = service.category.toLowerCase().includes(query);
        const tagsMatch = service.tags.some(tag => tag.toLowerCase().includes(query));
        const locationMatch = service.location.toLowerCase().includes(query);
        
        return titleMatch || providerMatch || categoryMatch || tagsMatch || locationMatch;
    });
}

// 显示搜索结果
function displaySearchResults(results, container) {
    container.innerHTML = '';
    
    // 最多显示5个结果
    const displayResults = results.slice(0, 5);
    
    displayResults.forEach(service => {
        const resultItem = document.createElement('div');
        resultItem.className = 'search-result-item';
        resultItem.innerHTML = `
            <img src="${service.image}" alt="${service.title}">
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
            const searchInput = container.previousElementSibling;
            window.location.href = `search-results.html?query=${encodeURIComponent(searchInput.value.trim())}`;
        });
        
        container.appendChild(viewMoreItem);
    }
}

// 初始化顶部导航栏交互
function initializeNavbar() {
    console.log("初始化导航栏");
}

// 在页面加载完成后初始化全局搜索功能
document.addEventListener('DOMContentLoaded', function() {
    initializeGlobalSearch();
    initializeNavbar();
    
    // 直接添加点击事件处理
    console.log("DOM加载完成，初始化导航栏功能");
    
    // 发现服务按钮
    document.querySelectorAll('.nav-btn.publish-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log("点击了发现服务按钮");
            window.location.href = 'search-results.html';
        });
    });
    
    // 通知按钮 - 使用通知管理器处理
    document.querySelectorAll('.notification-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log("点击了通知按钮");
            // 如果通知管理器已初始化，使用它来处理
            if (window.notificationManager && window.notificationManager.initialized) {
                window.notificationManager.toggleNotificationDropdown(e);
            } else {
                // 备用方案：创建简单的下拉菜单
                createNotificationDropdown(this);
            }
        });
    });
});


/**
 * 全局应用脚本
 */

document.addEventListener('DOMContentLoaded', function() {
    // 绑定登录表单提交事件
    const signInForm = document.querySelector('.sign-in-form');
    if (signInForm) {
        signInForm.addEventListener('submit', validateSignIn);
    }
    
    // 绑定注册表单提交事件
    const signUpForm = document.querySelector('.sign-up-form');
    if (signUpForm) {
        signUpForm.addEventListener('submit', validateSignUp);
    }
});



/**
 * 初始化搜索功能
 */
function initSearchFunctionality() {
    // 获取所有搜索表单
    const searchForms = document.querySelectorAll('.search-form');
    const searchIcons = document.querySelectorAll('.search-bar .fa-search');
    
    // 为每个搜索表单设置事件
    searchForms.forEach(form => {
        form.addEventListener('submit', function(e) {
            const input = this.querySelector('input');
            const query = input.value.trim();
            
            // 如果查询为空，阻止提交
            if (!query) {
                e.preventDefault();
                return;
            }
            
            // 确保表单有正确的action，如果没有则设置为search.html
            if (!this.getAttribute('action')) {
                this.setAttribute('action', 'search.html');
            }
            
            // 确保输入框有name属性
            if (input && !input.getAttribute('name')) {
                input.setAttribute('name', 'query');
            }
        });
    });
    
    // 为搜索图标添加点击事件，点击时提交对应的表单
    searchIcons.forEach(icon => {
        icon.addEventListener('click', function() {
            // 找到最近的表单并提交
            const form = this.closest('form');
            if (form) {
                form.dispatchEvent(new Event('submit'));
            } else {
                // 如果找不到表单，可能在旧的布局中，查找兄弟输入框
                const input = this.nextElementSibling;
                if (input && input.tagName === 'INPUT') {
                    const query = input.value.trim();
                    if (query) {
                        window.location.href = `search.html?query=${encodeURIComponent(query)}`;
                    }
                }
            }
        });
    });
}

/**
 * 显示Toast消息
 * @param {string} message - 要显示的消息
 * @param {string} type - 消息类型 (success, error, info)
 * @param {number} duration - 显示时长(毫秒)
 */
function showToast(message, type = 'success', duration = 3000) {
    // 检查是否已存在Toast
    let toast = document.querySelector('.app-toast');
    
    // 如果已存在则移除
    if (toast) {
        document.body.removeChild(toast);
    }
    
    // 创建新的Toast
    toast = document.createElement('div');
    toast.className = `app-toast ${type}`;
    
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
    
    // 指定时间后隐藏
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, duration);
} 

function validateSignIn(event) {
    const agreeCheckbox = document.getElementById('agreeLogin');
    if (!agreeCheckbox.checked) {
        showToast('请同意隐私条款后再登录', 'error');
        event.preventDefault(); // 阻止表单提交
        return false;
    }
    // 继续执行登录逻辑
    const formData = {
        email: document.querySelector('.sign-in-form input[type="email"]').value,
        password: document.getElementById('loginPassword').value
    };
    // 如果勾选了，继续正常提交
    return true;
}

function validateSignUp(event) {
    const agreeCheckbox = document.getElementById('agreeRegister');
    if (!agreeCheckbox.checked) {
        showToast('请同意隐私条款后再注册', 'error');
        event.preventDefault(); // 阻止表单提交
        return false;
    }
    // 继续执行注册逻辑
    const formData = {
        username: document.querySelector('.sign-up-form input[type="text"]').value,
        email: document.querySelector('.sign-up-form input[type="email"]').value,
        password: document.getElementById('registerPassword').value,
        userType: document.querySelector('.sign-up-form input[name="userType"]:checked').value
    };
    return true;
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'times-circle';
    
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas fa-${icon}"></i>
            <span>${message}</span>
        </div>
    `;
    document.body.appendChild(toast);
    
    // 样式定义...（保持原有逻辑）
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    toast.style.zIndex = '1000';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '8px';
    
    if (type === 'success') {
        toast.style.backgroundColor = '#d4edda';
        toast.style.color = '#155724';
    } else if (type === 'error') {
        toast.style.backgroundColor = '#f8d7da';
        toast.style.color = '#721c24';
    } else {
        toast.style.backgroundColor = '#e1e5f9';
        toast.style.color = '#4a6cf7';
    }
    
    toast.style.opacity = '0';
    toast.style.transition = 'all 0.3s ease';
    
    setTimeout(() => {
        toast.style.opacity = '1';
    }, 10);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// 切换到注册模式时清空注册表单
const signUpBtn = document.getElementById('sign-up-btn');
if (signUpBtn) {
    signUpBtn.addEventListener('click', function() {
        const signUpForm = document.querySelector('.sign-up-form');
        if (signUpForm) {
            signUpForm.querySelectorAll('input, textarea').forEach(input => {
                if (input.type === 'radio' || input.type === 'checkbox') {
                    input.checked = false;
                } else {
                    input.value = '';
                }
            });
        }
    });
}

const token = localStorage.getItem('token');
if (!token) {
    window.location.href = 'index.html'; // 跳转登录
}
fetch('/api/user', {
    headers: { 'Authorization': 'Bearer ' + token }
}).then(res => {
    if (!res.ok) {
        window.location.href = 'index.html';
    }
    // ...正常渲染用户名
});

