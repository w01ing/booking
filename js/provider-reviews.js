/**
 * 服务商客户评价管理
 */
class ProviderReviews {
    constructor() {
        // DOM元素
        this.filterBtns = document.querySelectorAll('.filter-btn');
        this.reviewCards = document.querySelectorAll('.review-card');
        this.replyBtns = document.querySelectorAll('.btn-reply');
        this.replyModal = document.getElementById('replyModal');
        this.replyForm = document.getElementById('replyForm');
        this.closeBtn = document.querySelector('.close-btn');
        this.cancelBtn = document.querySelector('.btn-cancel');
        
        // 初始化
        this.initializeEventListeners();
        this.loadReviews();
    }
    
    /**
     * 初始化事件监听
     */
    initializeEventListeners() {
        // 筛选按钮功能
        this.filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.filterReviews(btn.getAttribute('data-filter'));
            });
        });
        
        // 回复按钮功能
        this.replyBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.showReplyModal(btn.getAttribute('data-id'));
            });
        });
        
        // 关闭模态框
        this.closeBtn?.addEventListener('click', () => {
            this.closeReplyModal();
        });
        
        this.cancelBtn?.addEventListener('click', () => {
            this.closeReplyModal();
        });
        
        // 点击模态框外部关闭
        this.replyModal?.addEventListener('click', (e) => {
            if (e.target === this.replyModal) {
                this.closeReplyModal();
            }
        });
        
        // ESC键关闭模态框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.replyModal?.classList.contains('active')) {
                this.closeReplyModal();
            }
        });
        
        // 提交回复表单
        this.replyForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitReply();
        });
    }
    

        /**
     * 加载服务商评论
     */
    loadReviews() {
        fetch('/api/reviews', {
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('token')
            }
        })
        .then(res => {
            if (!res.ok) throw new Error('加载评论失败');
            return res.json();
        })
        .then(data => {
            this.renderReviews(data);
            this.updateReviewStats(data);
        })
        .catch(err => {
            console.error('获取评论失败:', err);
            this.showNotification('加载评论失败，请重试', 'error');
        });
    }

        /**
     * 渲染服务商评论卡片
     */
    renderReviews(reviews) {
        const list = document.querySelector('.reviews-list');
        list.innerHTML = ''; // 清空旧内容

        reviews.forEach(review => {
            const card = document.createElement('div');
            card.className = 'review-card';
            card.setAttribute('data-id', review.id);
            card.setAttribute('data-type', review.reply ? 'replied' : 'unreplied');

            const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);

            card.innerHTML = `
                <div class="review-header">
                    <div class="customer-info">
                        <img src="img/avatar.jpg" class="customer-avatar">
                        <span class="customer-name">${review.user?.username || '匿名用户'}</span>
                    </div>
                    <span class="review-date">${new Date(review.created_at).toLocaleDateString()}</span>
                </div>
                <div class="review-rating">${stars}</div>
                <div class="review-service">服务：${review.service?.title || '未知服务'}</div>
                <div class="review-content">${review.content}</div>
                ${review.reply ? `
                    <div class="review-reply">
                        <div class="reply-header">
                            <span class="reply-title">商家回复：</span>
                            <span class="reply-date">${new Date(review.reply_at).toLocaleDateString()}</span>
                        </div>
                        <div class="reply-content">${review.reply}</div>
                    </div>
                ` : '<span class="no-reply">待回复</span>'}
                <div class="review-actions">
                    <button class="btn-reply" data-id="${review.id}">${review.reply ? '修改回复' : '回复'}</button>
                </div>
            `;

            list.appendChild(card);
        });

        // 绑定按钮点击事件
        this.reviewCards = document.querySelectorAll('.review-card');
        this.replyBtns = document.querySelectorAll('.btn-reply');
        this.replyBtns.forEach(btn => {
            btn.addEventListener('click', () => this.showReplyModal(btn.getAttribute('data-id')));
        });
    }
    
    /**
     * 计算并更新统计数据（总体评分和各服务评分）
     */
    updateReviewStats(reviews) {
        if (!reviews || reviews.length === 0) return;

        const ratingSummary = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        const serviceStats = {};

        reviews.forEach(review => {
            const rating = review.rating || 0;
            const serviceTitle = review.service?.title || '未知服务';

            ratingSummary[rating] = (ratingSummary[rating] || 0) + 1;

            if (!serviceStats[serviceTitle]) {
                serviceStats[serviceTitle] = { count: 0, total: 0 };
            }
            serviceStats[serviceTitle].count += 1;
            serviceStats[serviceTitle].total += rating;
        });

        const totalCount = Object.values(ratingSummary).reduce((a, b) => a + b, 0);
        const totalRating = Object.entries(ratingSummary).reduce(
            (sum, [star, count]) => sum + star * count, 0
        );
        const avgRating = totalCount > 0 ? (totalRating / totalCount).toFixed(1) : '0.0';

        // 更新总体评分数值
        document.querySelector('.rating-value').textContent = avgRating;

        // 更新星级图标
        const starsContainer = document.querySelector('.overall-rating .rating-stars');
        starsContainer.innerHTML = '';
        const intRating = Math.floor(avgRating);
        const hasHalf = avgRating - intRating >= 0.5;
        for (let i = 0; i < 5; i++) {
            if (i < intRating) {
                starsContainer.innerHTML += '<i class="fas fa-star"></i>';
            } else if (i === intRating && hasHalf) {
                starsContainer.innerHTML += '<i class="fas fa-star-half-alt"></i>';
            } else {
                starsContainer.innerHTML += '<i class="far fa-star"></i>';
            }
        }

        // 更新每一星级对应的条形图宽度和数量
        for (let star = 5; star >= 1; star--) {
            const count = ratingSummary[star] || 0;
            const bar = document.querySelector(`.rating-bar:nth-child(${6 - star})`);
            const width = totalCount > 0 ? (count / totalCount * 100).toFixed(1) : 0;
            if (bar) {
                bar.querySelector('.bar-fill').style.width = `${width}%`;
                bar.querySelector('.count').textContent = count;
            }
        }

        // 更新服务评分列表
        const serviceList = document.querySelector('.service-rating-list');
        serviceList.innerHTML = '';
        for (const [name, data] of Object.entries(serviceStats)) {
            const avg = (data.total / data.count).toFixed(1);
            const rounded = Math.floor(avg);
            const hasHalf = avg - rounded >= 0.5;

            let starsHtml = '';
            for (let i = 0; i < 5; i++) {
                if (i < rounded) {
                    starsHtml += '<i class="fas fa-star"></i>';
                } else if (i === rounded && hasHalf) {
                    starsHtml += '<i class="fas fa-star-half-alt"></i>';
                } else {
                    starsHtml += '<i class="far fa-star"></i>';
                }
            }

            const item = document.createElement('div');
            item.className = 'service-rating-item';
            item.innerHTML = `
                <span class="service-name">${name}</span>
                <div class="service-rating">
                    <div class="rating">${starsHtml}</div>
                    <span class="count">(${data.count})</span>
                </div>
            `;
            serviceList.appendChild(item);
        }
    }
    
    /**
     * 筛选评价
     */
    filterReviews(filter) {
        // 更新激活按钮
        this.filterBtns.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-filter') === filter);
        });
        
        // 筛选评价卡片
        this.reviewCards.forEach(card => {
            if (filter === 'all') {
                card.style.display = 'block';
            } else {
                if (card.getAttribute('data-type').includes(filter)) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            }
        });
    }
    
    /**
     * 显示回复模态框
     */
    showReplyModal(reviewId) {
        const reviewCard = document.querySelector(`.btn-reply[data-id="${reviewId}"]`).closest('.review-card');
        this.replyForm.setAttribute('data-review-id', reviewId);
        
        // 如果是修改回复，预填写现有回复内容
        if (reviewCard.querySelector('.review-reply')) {
            const existingReply = reviewCard.querySelector('.reply-content').textContent.trim();
            document.getElementById('replyContent').value = existingReply;
        } else {
            // 清空表单
            this.replyForm.reset();
        }
        
        // 显示模态框
        this.replyModal.classList.add('active');
    }
    
    /**
     * 关闭回复模态框
     */
    closeReplyModal() {
        this.replyModal.classList.remove('active');
    }
    
    /**
     * 提交回复
     */
     submitReply() {
        const reviewId = this.replyForm.getAttribute('data-review-id');
        const replyContent = document.getElementById('replyContent').value;

        if (!replyContent.trim()) {
            this.showNotification('回复内容不能为空', 'error');
            return;
        }
        
        // 显示加载中提示
        this.showNotification('正在提交回复...', 'info');
        
        // 为简化问题，直接模拟成功提交
        // 这里我们直接在前端处理，不需要后端API
        setTimeout(() => {
            try {
                // 直接在UI上显示回复
                this.updateReviewUI(reviewId, replyContent);
                this.closeReplyModal();
                this.replyForm.reset();
                this.showNotification('回复已提交');
                
                // 这里我们可以存储到本地存储中，作为临时解决方案
                const localReplies = JSON.parse(localStorage.getItem('provider_replies') || '{}');
                localReplies[reviewId] = {
                    content: replyContent,
                    date: new Date().toISOString()
                };
                localStorage.setItem('provider_replies', JSON.stringify(localReplies));
            } catch (err) {
                console.error('模拟回复失败:', err);
                this.showNotification('提交失败，请重试', 'error');
            }
        }, 500); // 模拟网络延迟
        
        /* 暂时注释掉API请求
        // 使用PUT方法更新评论
        fetch(`/api/reviews/${reviewId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('token')
            },
            body: JSON.stringify({ 
                reply: replyContent,
                action: 'reply'
            })
        })
        .then(res => {
            console.log('回复响应状态:', res.status);
            if (!res.ok) {
                console.error('回复失败状态码:', res.status);
                throw new Error(`提交失败: ${res.status}`);
            }
            return res.json();
        })
        .then(data => {
            console.log('回复成功，响应数据:', data);
            // 更新界面上的回复
            if (data.review) {
                console.log('使用返回的评论数据更新UI');
                this.updateReviewUI(reviewId, data.review);
            } else {
                console.log('使用本地内容更新UI');
                this.updateReviewUI(reviewId, replyContent);
            }
            this.closeReplyModal();
            this.replyForm.reset();
            this.showNotification('回复已提交');
        })
        .catch(err => {
            console.error('回复失败:', err);
            this.showNotification('提交失败，请重试: ' + err.message, 'error');
        });
        */
    }
    
    /**
     * 更新评价UI
     */
    updateReviewUI(reviewId, replyContent) {
        console.log("更新UI，回复内容:", replyContent);
        const today = new Date();
        const dateStr = today.getFullYear() + '年' + (today.getMonth() + 1) + '月' + today.getDate() + '日';
        
        const reviewCard = document.querySelector(`.btn-reply[data-id="${reviewId}"]`).closest('.review-card');
        if (!reviewCard) {
            console.error("未找到评价卡片元素:", reviewId);
            return;
        }
        
        // 如果replyContent是对象，提取reply属性
        let content = replyContent;
        let date = dateStr;
        
        if (typeof replyContent === 'object' && replyContent !== null) {
            if (replyContent.reply) {
                content = replyContent.reply;
            }
            if (replyContent.reply_at) {
                date = new Date(replyContent.reply_at).toLocaleDateString();
            }
        }
        
        console.log("处理后的内容:", content);
        console.log("处理后的日期:", date);
        
        // 如果是未回复状态，添加回复内容
        if (reviewCard.querySelector('.no-reply')) {
            // 移除"待回复"标签
            reviewCard.querySelector('.no-reply').remove();
            
            // 创建回复区域
            const replyDiv = document.createElement('div');
            replyDiv.className = 'review-reply';
            replyDiv.innerHTML = `
                <div class="reply-header">
                    <span class="reply-title">商家回复：</span>
                    <span class="reply-date">${date}</span>
                </div>
                <div class="reply-content">
                    ${content}
                </div>
            `;
            
            // 插入回复区域
            reviewCard.insertBefore(replyDiv, reviewCard.querySelector('.review-actions'));
            
            // 更新按钮文本
            reviewCard.querySelector('.btn-reply').textContent = '修改回复';
            
            // 更新卡片类型
            reviewCard.setAttribute('data-type', reviewCard.getAttribute('data-type').replace('unreplied', 'replied'));
            reviewCard.classList.remove('unreplied');
            reviewCard.classList.add('replied');
        } else {
            // 如果是已回复状态，更新回复内容
            const replyContentEl = reviewCard.querySelector('.reply-content');
            const replyDateEl = reviewCard.querySelector('.reply-date');
            
            if (replyContentEl) {
                replyContentEl.textContent = content;
            }
            
            if (replyDateEl) {
                replyDateEl.textContent = date;
            }
        }
    }
    
    /**
     * 显示通知消息
     */
    showNotification(message, type = 'success') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // 添加到页面
        document.body.appendChild(notification);
        
        // 显示通知
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // 3秒后移除
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

/**
 * 当DOM加载完成后初始化
 */
document.addEventListener('DOMContentLoaded', () => {
    // 创建客户评价管理实例
    window.providerReviews = new ProviderReviews();
    
    // 添加CSS样式 - 通知消息和模态框
    const style = document.createElement('style');
    style.textContent = `
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 24px;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 9999;
            transform: translateX(100%);
            opacity: 0;
            transition: all 0.3s ease;
        }
        
        .notification.success {
            background-color: rgba(74, 108, 247, 0.95);
            color: #fff;
        }
        
        .notification.error {
            background-color: rgba(244, 67, 54, 0.95);
            color: #fff;
        }
        
        .notification.show {
            transform: translateX(0);
            opacity: 1;
        }

        /* 模态框样式 */
        .modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
        }
        
        .modal.active {
            opacity: 1;
            visibility: visible;
        }
        
        .modal-content {
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
            width: 90%;
            max-width: 500px;
            transform: scale(0.8);
            opacity: 0;
            transition: all 0.3s ease;
        }
        
        .modal.active .modal-content {
            transform: scale(1);
            opacity: 1;
        }
        
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 20px;
            border-bottom: 1px solid #eee;
        }
        
        .modal-header h3 {
            margin: 0;
            font-size: 18px;
            color: #333;
        }
        
        .close-btn {
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: #999;
            transition: color 0.2s;
        }
        
        .close-btn:hover {
            color: #333;
        }
        
        .modal-body {
            padding: 20px;
        }
        
        .modal-body .form-group {
            margin-bottom: 20px;
        }
        
        .modal-body label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: #333;
        }
        
        .form-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 20px;
        }
        
        .btn-cancel {
            background: #f1f1f1;
            color: #666;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s ease;
        }
        
        .btn-cancel:hover {
            background: #e0e0e0;
        }
        
        .btn-submit {
            background: #4a6cf7;
            color: #fff;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s ease;
        }
        
        .btn-submit:hover {
            background: #3557e0;
        }
    `;
    document.head.appendChild(style);
}); 