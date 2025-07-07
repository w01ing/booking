# 服务预约系统

这是一个基于Flask的服务预约系统，支持用户注册、登录、服务浏览、预约、评价等功能。

## 系统功能

- 用户注册和登录
- 服务商管理服务
- 服务浏览和搜索
- 服务预约和管理
- 服务评价
- 收藏服务
- 通知系统

## 技术栈

- 后端：Flask (Python)
- 数据库：MySQL
- 前端：HTML, CSS, JavaScript

## 安装和运行

1. 克隆仓库
```
git clone [仓库URL]
```

2. 安装依赖
```
pip install -r requirements.txt
```

3. 初始化数据库
```
python db_init.py
```

4. 运行应用
```
python run.py
```

5. 在浏览器中访问
```
http://localhost:5000
```

## API测试

系统提供了完整的API测试套件，用于测试所有API端点的功能。

### 运行API测试

使用以下命令运行所有API测试：

```
python test_api_groups.py
```

运行特定组的API测试：

```
python test_api_groups.py --groups public service timeslot
```

可用的测试组：
- `public`: 公共API（无需认证）
- `user`: 用户相关API
- `service`: 服务相关API
- `timeslot`: 时间段相关API
- `booking`: 预约相关API
- `review`: 评价相关API
- `favorite`: 收藏相关API
- `provider`: 服务商相关API
- `notification`: 通知相关API

### 测试工作流

系统还提供了测试完整业务流程的脚本：

```
python test_api_workflow.py
```

## 主要API端点

### 用户认证
- `POST /api/register` - 用户注册
- `POST /api/login` - 用户登录

### 服务管理
- `GET /api/services` - 获取服务列表
- `POST /api/services` - 创建服务
- `GET /api/services/{service_id}` - 获取服务详情
- `PUT /api/services/{service_id}` - 更新服务
- `DELETE /api/services/{service_id}` - 删除服务
- `GET /api/services/public` - 获取公开服务列表
- `GET /api/services/public/{service_id}` - 获取公开服务详情

### 时间段管理
- `GET /api/timeslots` - 获取时间段列表
- `POST /api/timeslots` - 创建时间段
- `PUT /api/timeslots/{date}/{time}` - 更新时间段
- `DELETE /api/timeslots/{date}/{time}` - 删除时间段
- `POST /api/timeslots/pattern` - 应用工作模式
- `PUT /api/timeslots/batch` - 批量更新时间段

### 预约管理
- `GET /api/bookings` - 获取预约列表
- `POST /api/bookings` - 创建预约
- `GET /api/bookings/{booking_id}` - 获取预约详情
- `PUT /api/bookings/{booking_id}` - 更新预约
- `DELETE /api/bookings/{booking_id}` - 取消预约
- `PUT /api/bookings/{booking_id}/accept` - 接受预约
- `PUT /api/bookings/{booking_id}/reject` - 拒绝预约
- `GET /api/bookings/calendar` - 获取日历预约（需要提供start_date和end_date参数）

### 评价管理
- `GET /api/reviews` - 获取评价列表
- `POST /api/reviews` - 创建评价
- `PUT /api/reviews/{review_id}` - 更新评价
- `DELETE /api/reviews/{review_id}` - 删除评价
- `GET /api/reviews/service/{service_id}` - 获取特定服务的评价

### 收藏管理
- `GET /api/favorites` - 获取收藏列表
- `POST /api/favorites` - 添加收藏
- `DELETE /api/favorites/{service_id}` - 删除收藏
- `GET /api/favorites/check/{service_id}` - 检查服务是否已收藏

### 通知管理
- `GET /api/user/notifications` - 获取通知列表
- `PUT /api/user/notifications/{notification_id}/read` - 标记通知为已读
- `PUT /api/user/notifications/read-all` - 标记所有通知为已读
- `DELETE /api/user/notifications/{notification_id}` - 删除通知
- `POST /api/notifications` - 创建通知（仅管理员）

## 文件结构

- `app.py`: 主应用文件
- `models.py`: 数据模型定义
- `db_init.py`: 数据库初始化脚本
- `run.py`: 应用启动脚本
- `test_api_groups.py`: API测试脚本
- `test_api_workflow.py`: API工作流测试脚本
- `css/`: CSS样式文件
- `js/`: JavaScript文件
- `img/`: 图片资源

## 许可证

[许可证信息]


