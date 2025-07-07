document.addEventListener('DOMContentLoaded', async function() {
    // 确保清除任何可能存在的模态框
    const existingModals = document.querySelectorAll('.modal');
    existingModals.forEach(modal => modal.remove());
    
    // 初始化左侧预约状态卡片点击事件（无论是否登录都要初始化）
    initializeBookingStatCards();
    
    // 检查用户是否已登录
    if (!checkAuth()) return;
    
    // 更新用户信息
    updateUserInfo();
    
    // 加载评论数据
    await loadReviews();
    
    // 过滤按钮交互
    initializeFilterButtons();
    
    // 根据URL参数设置过滤状态
    setFilterFromURL();

    // 评价图片预览
    initializeImagePreviews();

    // 评价操作按钮交互
    initializeActionButtons();

    // 加载更多按钮交互
    const loadMoreBtn = document.querySelector('.btn-load-more');
    let isLoading = false;

    loadMoreBtn?.addEventListener('click', async () => {
        if (isLoading) return;

        isLoading = true;
        loadMoreBtn.classList.add('loading');

        try {
            // 加载更多评价
            await loadMoreReviews();
            
            // 重新初始化交互
            initializeImagePreviews();
            initializeActionButtons();
            initializeFilterButtons();
        } catch (error) {
            console.error('加载更多评价失败:', error);
            showToast('加载更多评价失败，请稍后再试', 'error');
        } finally {
            isLoading = false;
            loadMoreBtn.classList.remove('loading');
        }
        });
    });

// 初始化图片预览功能
function initializeImagePreviews() {
    const reviewImages = document.querySelectorAll('.review-images img');
    
    reviewImages.forEach(img => {
        img.addEventListener('click', () => {
            showImagePreview(img.src);
        });
    });
}

// 初始化按钮交互
function initializeActionButtons() {
    // 清除任何现有的模态框
    const existingModals = document.querySelectorAll('.modal');
    existingModals.forEach(modal => modal.remove());
    
    // 已评价项的操作按钮
    document.querySelectorAll('.review-card.completed .review-actions button').forEach(button => {
        // 清除现有监听器，避免重复绑定
        button.replaceWith(button.cloneNode(true));
    });
    
    // 重新添加监听器
    document.querySelectorAll('.review-card.completed .review-actions button').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const action = button.classList.contains('btn-edit') ? 'edit' : 'delete';
            const reviewCard = button.closest('.review-card');
            const serviceName = reviewCard.querySelector('.service-details h3').textContent;
            const reviewId = reviewCard.dataset.id;

            if (action === 'edit') {
                // 获取当前评价内容
                const starsElements = reviewCard.querySelectorAll('.rating-stars i.fas');
                const stars = starsElements.length;
                const text = reviewCard.querySelector('.review-text').textContent;
                const images = Array.from(reviewCard.querySelectorAll('.review-images img')).map(img => img.src);
                
                // 打开编辑模态框
                showReviewModal(serviceName, stars, text, images, null, null, reviewId);
            } else if (action === 'delete') {
                // 显示删除确认
                showDeleteConfirmation(serviceName, reviewCard, reviewId);
            }
        });
    });

    // 待评价项的评价按钮
    document.querySelectorAll('.review-card.pending .btn-review').forEach(button => {
        // 清除现有监听器，避免重复绑定
        button.replaceWith(button.cloneNode(true));
    });
    
    // 重新添加监听器
    document.querySelectorAll('.review-card.pending .btn-review').forEach(button => {
        button.addEventListener('click', () => {
            const reviewCard = button.closest('.review-card');
            const serviceName = reviewCard.querySelector('.service-details h3').textContent;
            const serviceId = reviewCard.dataset.serviceId;
            const providerId = reviewCard.dataset.providerId;
            const bookingId = reviewCard.dataset.id;
            
            // 确保没有其他打开的评价模态框
            const existingModals = document.querySelectorAll('.modal');
            existingModals.forEach(modal => modal.remove());
            
            // 打开评价模态框
            showReviewModal(serviceName, 0, '', [], serviceId, providerId, null, bookingId);
        });
    });
}

    // 显示图片预览模态框
    function showImagePreview(imageSrc) {
        const modal = document.createElement('div');
        modal.className = 'image-preview-modal';
        modal.innerHTML = `
            <img src="${imageSrc}" alt="预览图片" class="preview-image">
            <div class="close-preview">&times;</div>
        `;

        document.body.appendChild(modal);

        // 添加动画类
        setTimeout(() => modal.classList.add('active'), 10);

        // 关闭按钮事件
        const closeBtn = modal.querySelector('.close-preview');
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        });

        // 点击模态框背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                setTimeout(() => modal.remove(), 300);
            }
        });
    }

// 加载评论数据
async function loadReviews() {
    try {
        // 显示加载状态
        const reviewsList = document.querySelector('.reviews-list');
        reviewsList.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>';
        
        // 获取评价数据
        const reviews = await apiRequest('/api/reviews');
        
        // 获取已完成但未评价的预约数据
        const bookings = await apiRequest('/api/bookings');
        const completedBookings = bookings.filter(booking => 
            booking.status === 'completed' && 
            booking.review_needed === true
        );
        
        // 存储待评价的预约，供后续使用
        const pendingReviews = completedBookings.map(booking => ({
            id: booking.id,
            service_id: booking.service_id,
            provider_id: booking.provider_id,
            booking_id: booking.id,
            date: booking.date,
            time: booking.time,
            service: booking.service,
            provider: booking.provider
        }));
        
        // 清空加载状态
        reviewsList.innerHTML = '';
        
        // 如果没有评价和待评价项，显示空状态
        if (!reviews.length && !pendingReviews.length) {
            reviewsList.innerHTML = '<div class="empty-state">暂无评价数据</div>';
            updateReviewStats([]); // 更新评价统计
            return;
        }
        
        // 渲染评论列表
        renderReviews(reviews, pendingReviews);
        
        // 更新评价统计
        updateReviewStats(reviews);
        
        // 确保移除所有已存在的模态框
        const existingModals = document.querySelectorAll('.modal');
        existingModals.forEach(modal => modal.remove());
        
        // 初始化交互组件
        initializeImagePreviews();
        initializeActionButtons();
        
        // 根据URL参数应用过滤
        setFilterFromURL();
        
    } catch (error) {
        console.error('加载评论数据失败:', error);
        const reviewsList = document.querySelector('.reviews-list');
        reviewsList.innerHTML = '<div class="error-state">加载评价数据失败，请刷新页面重试</div>';
    }
}

// 加载更多评论
async function loadMoreReviews() {
    // 这里可以实现分页加载，目前API不支持，先模拟加载更多
    return new Promise(resolve => {
        setTimeout(() => {
            resolve();
        }, 1000);
    });
}

// 渲染评论列表
function renderReviews(reviews, pendingReviews = []) {
    const reviewsList = document.querySelector('.reviews-list');
    
    // 获取当前过滤条件
    const urlParams = new URLSearchParams(window.location.search);
    const filter = urlParams.get('filter');
    
    console.log('渲染评价列表，过滤条件:', filter);
    
    // 根据过滤条件筛选数据
    let filteredReviews = reviews;
    let filteredPendingReviews = pendingReviews;
    
    if (filter === 'pending') {
        // 只显示待评价
        filteredReviews = [];
        filteredPendingReviews = pendingReviews;
    } else if (filter === 'completed') {
        // 只显示已评价
        filteredReviews = reviews;
        filteredPendingReviews = [];
    }
    // filter === 'all' 或未指定时显示全部
    
    if (filteredReviews.length === 0 && filteredPendingReviews.length === 0) {
        reviewsList.innerHTML = '<div class="empty-state">暂无评价数据</div>';
        return;
    }
    
    // 清空列表
    reviewsList.innerHTML = '';
    
    // 先渲染待评价项
    filteredPendingReviews.forEach(booking => {
        const pendingReviewElement = createPendingReviewElement(booking);
        reviewsList.appendChild(pendingReviewElement);
    });
    
    // 渲染已有评价
    filteredReviews.forEach(review => {
        const reviewElement = createReviewElement(review);
        reviewsList.appendChild(reviewElement);
    });
    
    // 添加页面动画
    document.querySelectorAll('.review-card').forEach((card, index) => {
        card.style.animation = `fadeIn 0.5s ease-out ${index * 0.1}s`;
    });
}

// 创建待评价元素
function createPendingReviewElement(booking) {
    const reviewCard = document.createElement('div');
    reviewCard.className = 'review-card pending';
    reviewCard.dataset.id = booking.booking_id;
    reviewCard.dataset.serviceId = booking.service_id;
    reviewCard.dataset.providerId = booking.provider_id;
    
    reviewCard.innerHTML = `
        <div class="service-info">
            <img src="${booking.service?.image || 'img/default-service.jpg'}" alt="服务图片" class="service-image">
            <div class="service-details">
                <h3>${booking.service?.title || '未知服务'}</h3>
                <p class="service-provider">${booking.provider?.business_name || booking.provider?.username || '未知提供商'}</p>
                <p class="service-time">预约时间：${booking.date} ${booking.time}</p>
                <div class="status-tag">待评价</div>
            </div>
        </div>
        <div class="review-actions">
            <button class="btn btn-primary btn-review">立即评价</button>
        </div>
    `;
    
    return reviewCard;
}

// 创建评价元素
function createReviewElement(review) {
    const reviewCard = document.createElement('div');
    reviewCard.className = 'review-card completed';
    reviewCard.dataset.id = review.id;
    reviewCard.dataset.rating = review.rating || 0;
    
    // 格式化日期
    const date = new Date(review.created_at);
    const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    
    // 生成星级HTML
    const starsHtml = Array(5).fill().map((_, i) => 
        `<i class="${i < review.rating ? 'fas' : 'far'} fa-star"></i>`
    ).join('');
    
    // 构建评价卡片HTML
    reviewCard.innerHTML = `
        <div class="service-info">
            <img src="${review.service?.image || 'img/service-placeholder.jpg'}" alt="服务图片" class="service-image">
            <div class="service-details">
                <h3>${review.service?.title || '未知服务'}</h3>
                <p class="service-provider">${review.provider?.business_name || review.provider?.username || '未知提供商'}</p>
                <p class="service-time">评价时间：${formattedDate}</p>
            </div>
        </div>
        <div class="review-content">
            <div class="rating-stars">
                ${starsHtml}
            </div>
            <p class="review-text">${review.content}</p>
            ${review.images ? `
                <div class="review-images">
                    ${review.images.map(img => `<img src="${img}" alt="评价图片">`).join('')}
                </div>
            ` : ''}
        </div>
        <div class="review-actions">
            <button class="btn btn-edit">编辑评价</button>
            <button class="btn btn-delete">删除评价</button>
        </div>
    `;
    
    return reviewCard;
}

// 更新评价统计
function updateReviewStats(reviews) {
    if (!reviews || reviews.length === 0) {
        document.querySelector('.overall-rating .rating-value').textContent = '0.0';
        document.querySelectorAll('.rating-bar .bar-fill').forEach(bar => {
            bar.style.width = '0%';
        });
        document.querySelectorAll('.rating-bar .count').forEach(count => {
            count.textContent = '0';
        });
        return;
    }
    
    // 计算平均评分
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const avgRating = (totalRating / reviews.length).toFixed(1);
    
    // 更新总体评分
    document.querySelector('.overall-rating .rating-value').textContent = avgRating;
    
    // 更新星级显示
    const ratingStars = document.querySelectorAll('.overall-rating .rating-stars i');
    ratingStars.forEach((star, i) => {
        if (i < Math.floor(avgRating)) {
            star.className = 'fas fa-star';
        } else if (i < Math.floor(avgRating) + 0.5) {
            star.className = 'fas fa-star-half-alt';
        } else {
            star.className = 'far fa-star';
        }
    });
    
    // 计算各星级数量
    const ratingCounts = [0, 0, 0, 0, 0]; // 1-5星的数量
    reviews.forEach(review => {
        if (review.rating >= 1 && review.rating <= 5) {
            ratingCounts[review.rating - 1]++;
        }
    });
    
    // 更新评分条
    const ratingBars = document.querySelectorAll('.rating-bar');
    ratingBars.forEach((bar, i) => {
        const index = 4 - i; // 5星在最上面，所以需要反转索引
        const count = ratingCounts[index];
        const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
        
        bar.querySelector('.bar-fill').style.width = `${percentage}%`;
        bar.querySelector('.count').textContent = count.toString();
    });
}

    // 显示评价模态框
function showReviewModal(serviceName, stars = 0, text = '', images = [], serviceId = null, providerId = null, reviewId = null, bookingId = null) {
        const modal = document.createElement('div');
    modal.className = 'modal review-modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                <h3>${reviewId ? '编辑评价' : '发表评价'}</h3>
                <span class="close-btn">&times;</span>
                </div>
                <div class="modal-body">
                    <h4>${serviceName}</h4>
                    <div class="rating-input">
                        <div class="rating-stars">
                            ${Array(5).fill().map((_, i) => `
                            <i class="${i < stars ? 'fas' : 'far'} fa-star" data-rating="${i + 1}"></i>
                            `).join('')}
                        </div>
                    <span class="rating-text">${stars ? `${stars}星` : '点击星星评分'}</span>
                    </div>
                    <textarea placeholder="请分享您的使用体验...">${text}</textarea>
                    <div class="image-upload">
                        <div class="upload-preview">
                            ${images.map(src => `
                                <div class="preview-item">
                                    <img src="${src}" alt="评价图片">
                                    <button class="remove-image">&times;</button>
                                </div>
                            `).join('')}
                            ${images.length < 3 ? `
                                <div class="upload-trigger">
                                    <i class="fas fa-camera"></i>
                                    <span>上传图片</span>
                                    <input type="file" accept="image/*" multiple>
                                </div>
                            ` : ''}
                        </div>
                        <p class="upload-tip">最多上传3张图片</p>
                    </div>
                </div>
                <div class="modal-footer">
                <button class="btn btn-secondary btn-cancel">取消</button>
                <button class="btn btn-primary btn-submit"${stars ? '' : ' disabled'}>${reviewId ? '保存修改' : '提交评价'}</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 星级评分交互
        const ratingStars = modal.querySelectorAll('.rating-stars i');
        const ratingText = modal.querySelector('.rating-text');
    const submitBtn = modal.querySelector('.btn-submit');
        let currentRating = stars;
    
    const ratingTexts = [
        '点击星星评分',
        '非常差',
        '较差',
        '一般',
        '很好',
        '非常好'
    ];

        function updateStars(rating) {
            ratingStars.forEach((star, index) => {
                star.className = index < rating ? 'fas fa-star' : 'far fa-star';
            });
        ratingText.textContent = rating ? ratingTexts[rating] : ratingTexts[0];
        // 只有选择了评分才能提交
        submitBtn.disabled = rating === 0;
        }

        updateStars(currentRating);

        ratingStars.forEach(star => {
            star.addEventListener('mouseover', () => {
                const rating = parseInt(star.dataset.rating);
            if (!currentRating) { // 只在未选择评分时显示悬停效果
                updateStars(rating);
            }
            });

            star.addEventListener('mouseout', () => {
            if (!currentRating) { // 只在未选择评分时恢复初始状态
                updateStars(0);
            }
            });

            star.addEventListener('click', () => {
                currentRating = parseInt(star.dataset.rating);
                updateStars(currentRating);
            });
        });

        // 图片上传交互
        const fileInput = modal.querySelector('input[type="file"]');
        const uploadPreview = modal.querySelector('.upload-preview');

        fileInput?.addEventListener('change', () => {
            const files = Array.from(fileInput.files);
            const currentImages = modal.querySelectorAll('.preview-item').length;

            files.slice(0, 3 - currentImages).forEach(file => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const previewItem = document.createElement('div');
                    previewItem.className = 'preview-item';
                    previewItem.innerHTML = `
                        <img src="${e.target.result}" alt="评价图片">
                        <button class="remove-image">&times;</button>
                    `;
                    uploadPreview.insertBefore(previewItem, uploadPreview.lastElementChild);

                    if (uploadPreview.querySelectorAll('.preview-item').length >= 3) {
                        uploadPreview.querySelector('.upload-trigger').style.display = 'none';
                    }
                };
                reader.readAsDataURL(file);
            });
        });

        // 删除图片
        modal.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-image')) {
                e.target.parentElement.remove();
                const uploadTrigger = uploadPreview.querySelector('.upload-trigger');
                if (uploadTrigger && uploadPreview.querySelectorAll('.preview-item').length < 3) {
                    uploadTrigger.style.display = 'flex';
                }
            }
        });

        // 关闭按钮事件
    const closeBtn = modal.querySelector('.close-btn');
        const cancelBtn = modal.querySelector('.btn-cancel');

        [closeBtn, cancelBtn].forEach(btn => {
            btn.addEventListener('click', () => {
                modal.classList.remove('active');
                setTimeout(() => modal.remove(), 300);
            });
        });

    submitBtn.addEventListener('click', function() {
        const reviewText = modal.querySelector('textarea').value.trim();
        
        // 验证输入
        if (!currentRating) {
            showToast('请选择评分', 'warning');
            return;
        }
        if (!reviewText) {
            showToast('请填写评价内容', 'warning');
            return;
        }

        // 禁用按钮，显示加载状态
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 提交中...';
        
        // 显示加载状态
        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin"></i>
                <span>处理中...</span>
            </div>
        `;
        loadingOverlay.style.position = 'fixed';
        loadingOverlay.style.top = '0';
        loadingOverlay.style.left = '0';
        loadingOverlay.style.width = '100%';
        loadingOverlay.style.height = '100%';
        loadingOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        loadingOverlay.style.display = 'flex';
        loadingOverlay.style.justifyContent = 'center';
        loadingOverlay.style.alignItems = 'center';
        loadingOverlay.style.zIndex = '9999';
        loadingOverlay.style.opacity = '0';
        document.body.appendChild(loadingOverlay);
        
        // 显示动画
        setTimeout(() => {
            loadingOverlay.style.opacity = '1';
        }, 10);
        
        // 构建评价数据
        const reviewData = !reviewId ? {
            service_id: serviceId,
            provider_id: providerId,
            booking_id: bookingId,
            rating: currentRating,
            content: reviewText
        } : {
            content: reviewText,
            rating: currentRating
        };
        
        // 使用普通的fetch而不是async/await，避免异步问题
        const url = !reviewId ? '/api/reviews' : `/api/reviews/${reviewId}`;
        const method = !reviewId ? 'POST' : 'PUT';
        
        // 获取认证令牌
        const token = localStorage.getItem('token');
        if (!token) {
            showToast('未登录，无法提交评价', 'error');
            loadingOverlay.style.opacity = '0';
            setTimeout(() => {
                if (loadingOverlay.parentNode) {
                    loadingOverlay.parentNode.removeChild(loadingOverlay);
                }
            }, 300);
            return;
        }
        
        // 发送请求
        fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(reviewData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('服务器响应错误');
            }
            return response.json();
        })
        .then(data => {
            if (data && data.review) {
                showToast(reviewId ? '评价更新成功！' : '评价提交成功', 'success');
                
                // 关闭模态框
                modal.classList.remove('active');
                
                // 强制刷新页面，确保状态重置
                setTimeout(() => {
                    window.location.reload();
                }, 500);
            } else {
                throw new Error('评价提交失败');
            }
        })
        .catch(error => {
            console.error('提交评价失败:', error);
            showToast('提交失败，请稍后再试', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = reviewId ? '保存修改' : '提交评价';
        })
        .finally(() => {
            // 移除加载覆盖层
            if (loadingOverlay && loadingOverlay.parentNode) {
                loadingOverlay.style.opacity = '0';
                setTimeout(() => {
                    if (loadingOverlay.parentNode) {
                        loadingOverlay.parentNode.removeChild(loadingOverlay);
                    }
                }, 300);
            }
        });
        
        // 防止默认行为和冒泡
        return false;
    });
}

// 显示删除确认
function showDeleteConfirmation(serviceName, reviewCard, reviewId) {
    const modal = document.createElement('div');
    modal.className = 'modal delete-confirm-modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>删除评价</h3>
                <span class="close-btn">&times;</span>
            </div>
            <div class="modal-body">
                <p>确定要删除对"${serviceName}"的评价吗？此操作不可撤销。</p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary btn-cancel">取消</button>
                <button class="btn btn-danger btn-confirm">确认删除</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // 关闭按钮事件
    modal.querySelector('.close-btn').addEventListener('click', () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    });

    // 取消按钮事件
    modal.querySelector('.btn-cancel').addEventListener('click', () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    });

    // 确认删除按钮事件
    modal.querySelector('.btn-confirm').addEventListener('click', async () => {
        try {
            // 显示加载状态
            modal.querySelector('.btn-confirm').disabled = true;
            modal.querySelector('.btn-confirm').innerHTML = '<i class="fas fa-spinner fa-spin"></i> 删除中...';
            
            // 发送删除请求
            const response = await apiRequest(`/api/reviews/${reviewId}`, 'DELETE');
            
            // 关闭模态框
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
            
            if (response) {
                // 显示成功消息
                showToast('评价已成功删除', 'success');
                
                // 从DOM中移除评价卡片，添加动画效果
                reviewCard.style.animation = 'fadeOut 0.3s ease-out';
                setTimeout(() => {
                    // 获取剩余的评价
                    const remainingReviews = Array.from(document.querySelectorAll('.review-card.completed'))
                        .filter(card => card !== reviewCard);
                    
                    // 移除当前卡片
                    reviewCard.remove();
                    
                    // 如果没有评价了，显示空状态
                    if (remainingReviews.length === 0 && document.querySelectorAll('.review-card.pending').length === 0) {
                        document.querySelector('.reviews-list').innerHTML = '<div class="empty-state">暂无评价数据</div>';
                    }
                    
                    // 更新过滤按钮计数 - 已评价数量减少1
                    updateReviewStats(Array.from(document.querySelectorAll('.review-card.completed')).map(card => {
                        return {
                            rating: parseInt(card.dataset.rating || "0")
                        };
                    }));
                }, 300);
            } else {
                throw new Error('删除评价失败');
            }
        } catch (error) {
            console.error('删除评价失败:', error);
            // 关闭模态框
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
            
            showToast('删除失败，请稍后再试', 'error');
        }
    });
}

    // 显示提示消息
function showToast(message, type = 'success') {
    // 移除已有的toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    // 创建新toast
        const toast = document.createElement('div');
    toast.className = `toast ${type}`;
        toast.textContent = message;

        document.body.appendChild(toast);

    // 显示toast
        setTimeout(() => toast.classList.add('active'), 10);

    // 3秒后自动隐藏
        setTimeout(() => {
            toast.classList.remove('active');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

// API请求函数
async function apiRequest(url, method = 'GET', data = null) {
    try {
        // 获取认证令牌
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未登录，无法获取数据');
        }

        // 准备请求选项
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };

        // 添加请求体（如果有）
        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }

        // 发送请求
        const response = await fetch(url, options);
        
        // 处理响应
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || '请求失败');
        }
        
        // 对于DELETE请求，可能没有返回内容
        if (response.status === 204) {
            return true;
        }
        
        // 解析JSON响应
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('API请求失败:', error);
        throw error;
    }
}

// 初始化过滤按钮
function initializeFilterButtons() {
    const filterButtons = document.querySelectorAll('.filter-btn');

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            const filter = button.textContent.trim();
            console.log('点击过滤按钮:', filter);

            // 根据筛选条件跳转到对应页面
            if (filter === '待评价') {
                // 跳转到待评价页面
                window.location.href = 'my-reviews.html?filter=pending';
            } else if (filter === '已评价') {
                // 跳转到已评价页面
                window.location.href = 'my-reviews.html?filter=completed';
            } else if (filter === '全部评价') {
                // 跳转到全部评价页面
                window.location.href = 'my-reviews.html?filter=all';
            }
        });
    });
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
// 根据URL参数设置过滤状态
function setFilterFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const filter = urlParams.get('filter');
    
    console.log('URL参数中的过滤条件:', filter);
    
    if (filter) {
        // 设置对应的过滤按钮为激活状态
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(button => {
            button.classList.remove('active');
            
            const buttonText = button.textContent.trim();
            if (
                (filter === 'pending' && buttonText === '待评价') ||
                (filter === 'completed' && buttonText === '已评价') ||
                (filter === 'all' && buttonText === '全部评价')
            ) {
                button.classList.add('active');
            }
        });
        
        // 根据过滤条件显示对应的评价卡片
        const reviewCards = document.querySelectorAll('.review-card');
        if (reviewCards.length > 0) {
            reviewCards.forEach(card => {
                if (filter === 'all') {
                    // 显示所有评价卡片
                    card.style.display = 'block';
                    card.style.animation = 'fadeIn 0.5s ease-out';
                } else if (filter === 'pending' && card.classList.contains('pending')) {
                    // 只显示待评价卡片
                    card.style.display = 'block';
                    card.style.animation = 'fadeIn 0.5s ease-out';
                } else if (filter === 'completed' && card.classList.contains('completed')) {
                    // 只显示已评价卡片
                    card.style.display = 'block';
                    card.style.animation = 'fadeIn 0.5s ease-out';
                } else {
                    // 隐藏其他卡片
                    card.style.display = 'none';
                }
            });
        }
}

// 提交评价 - 不再直接使用，保留作为参考
async function submitReview(serviceId, providerId, bookingId, rating, content) {
    try {
        // 构建评价数据
        const reviewData = {
            service_id: serviceId,
            provider_id: providerId,
            booking_id: bookingId,
            rating: rating,
            content: content
        };
        
        // 发送评价请求
        const response = await apiRequest('/api/reviews', 'POST', reviewData);
        
        if (response && response.review) {
            // 显示成功消息
            showToast('评价提交成功', 'success');
            return true;
        } else {
            showToast('评价提交失败', 'error');
            return false;
        }
    } catch (error) {
        console.error('提交评价失败:', error);
        showToast('评价提交失败: ' + error.message, 'error');
        return false;
    }
}

// 显示加载状态
function showLoading() {
    // 创建加载蒙层
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = `
        <div class="loading-spinner">
            <i class="fas fa-spinner fa-spin"></i>
            <span>处理中...</span>
        </div>
    `;
    document.body.appendChild(loadingOverlay);
    
    // 添加样式
    loadingOverlay.style.position = 'fixed';
    loadingOverlay.style.top = '0';
    loadingOverlay.style.left = '0';
    loadingOverlay.style.width = '100%';
    loadingOverlay.style.height = '100%';
    loadingOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    loadingOverlay.style.display = 'flex';
    loadingOverlay.style.justifyContent = 'center';
    loadingOverlay.style.alignItems = 'center';
    loadingOverlay.style.zIndex = '9999';
    
    // 显示动画
    setTimeout(() => {
        loadingOverlay.style.opacity = '1';
    }, 10);
}

// 隐藏加载状态
function hideLoading() {
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.opacity = '0';
        setTimeout(() => {
            loadingOverlay.remove();
        }, 300);
    }
    
    // 移除所有可能存在的加载指示器
    const spinners = document.querySelectorAll('.fa-spinner.fa-spin');
    spinners.forEach(spinner => {
        const button = spinner.closest('button');
        if (button) {
            if (button.classList.contains('btn-submit')) {
                button.innerHTML = '提交评价';
                button.disabled = false;
            }
        }
    });
} 
}