// 测试脚本：检查服务商控制台是否正常工作
document.addEventListener('DOMContentLoaded', async () => {
    console.log('测试脚本已加载');
    
    // 初始化一个虚拟的服务商控制台
    if (window.providerDashboard) {
        console.log('找到服务商控制台实例，准备测试...');
        
        // 尝试手动调用加载预约函数
        try {
            console.log('开始加载预约数据...');
            await window.providerDashboard.loadBookings();
            console.log('预约数据加载成功');
        } catch (error) {
            console.error('测试失败:', error);
        }
    } else {
        console.error('找不到服务商控制台实例，请确保provider-dashboard.js已正确加载');
    }
}); 