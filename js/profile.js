// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    initializeNavigation();
    initializeFilters();
    initializeImageUploads();
    initializeFormValidation();
    initializeModals();
});

// 导航切换
function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.content-section');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetSection = item.getAttribute('data-section');
            
            // 更新导航项状态
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // 更新内容区域
            sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === targetSection) {
                    section.classList.add('active');
                    // 添加入场动画
                    section.style.animation = 'none';
                    section.offsetHeight; // 触发重绘
                    section.style.animation = 'fadeIn 0.3s ease forwards';
                }
            });
            
            // 更新URL hash
            window.location.hash = targetSection;
        });
    });
    
    // 根据URL hash加载对应页面
    const hash = window.location.hash.slice(1);
    if (hash) {
        const targetNav = document.querySelector(`[data-section="${hash}"]`);
        if (targetNav) {
            targetNav.click();
        }
    }
}

// 筛选功能
function initializeFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const filterValue = btn.getAttribute('data-filter');
            const parent = btn.closest('.section-header');
            const section = parent.parentElement;
            
            // 更新按钮状态
            parent.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // 筛选内容
            if (section.id === 'history') {
                filterAppointments(filterValue);
            } else if (section.id === 'reviews') {
                filterReviews(filterValue);
            } else if (section.id === 'favorites') {
                filterFavorites(filterValue);
            }
        });
    });
}

// 筛选预约历史
function filterAppointments(filter) {
    const appointments = document.querySelectorAll('.timeline-item');
    
    appointments.forEach(item => {
        if (filter === 'all' || item.classList.contains(filter)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

// 筛选评价
function filterReviews(filter) {
    const reviews = document.querySelectorAll('.review-card');
    
    reviews.forEach(review => {
        const rating = parseInt(review.querySelector('.review-rating').getAttribute('data-rating'));
        
        if (filter === 'all' || 
            (filter === 'high' && rating >= 4) || 
            (filter === 'low' && rating < 4)) {
            review.style.display = 'block';
        } else {
            review.style.display = 'none';
        }
    });
}

// 筛选收藏
function filterFavorites(filter) {
    const favorites = document.querySelectorAll('.favorite-card');
    
    favorites.forEach(card => {
        if (filter === 'all' || card.getAttribute('data-category') === filter) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// 头像上传
function initializeImageUploads() {
    const avatarUpload = document.querySelector('.avatar-upload input');
    const profileAvatar = document.querySelector('.profile-avatar');
    
    if (avatarUpload) {
        avatarUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    profileAvatar.src = e.target.result;
                    // 这里应该调用API上传图片
                    showToast('头像上传成功！');
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

// 表单验证
function initializeFormValidation() {
    const settingsForm = document.querySelector('.settings-form');
    
    if (settingsForm) {
        settingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // 获取表单数据
            const formData = new FormData(settingsForm);
            const data = Object.fromEntries(formData.entries());
            
            // 这里应该调用API保存设置
            showToast('设置保存成功！');
        });
    }
}

// 模态框处理
function initializeModals() {
    // 评价图片预览
    const reviewImages = document.querySelectorAll('.review-images img');
    
    reviewImages.forEach(img => {
        img.addEventListener('click', () => {
            showImagePreview(img.src);
        });
    });
    
    // 取消收藏确认
    const unfavoriteButtons = document.querySelectorAll('.btn-unfavorite');
    
    unfavoriteButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('确定要取消收藏该服务吗？')) {
                const card = btn.closest('.favorite-card');
                card.style.animation = 'fadeOut 0.3s ease forwards';
                setTimeout(() => {
                    card.remove();
                    showToast('已取消收藏');
                }, 300);
            }
        });
    });
}

// 图片预览模态框
function showImagePreview(src) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <img src="${src}" alt="预览图片">
            <button class="modal-close"><i class="fas fa-times"></i></button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 添加关闭事件
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.closest('.modal-close')) {
            modal.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => modal.remove(), 300);
        }
    });
    
    // 添加键盘事件
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            modal.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => modal.remove(), 300);
        }
    });
}

// 消息提示
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // 添加动画
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });
    
    // 自动消失
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// 添加页面切换动画
window.addEventListener('popstate', () => {
    const hash = window.location.hash.slice(1);
    if (hash) {
        const targetNav = document.querySelector(`[data-section="${hash}"]`);
        if (targetNav) {
            targetNav.click();
        }
    }
});

// 添加滚动动画
function addScrollAnimation() {
    const elements = document.querySelectorAll('.timeline-item, .review-card, .favorite-card');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'fadeIn 0.5s ease forwards';
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1
    });
    
    elements.forEach(el => observer.observe(el));
}

// 页面加载完成后添加滚动动画
window.addEventListener('load', addScrollAnimation); 