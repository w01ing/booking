# API测试工具使用说明

这个目录包含了几个API测试工具，用于测试应用的各种API端点。这些工具可以帮助开发人员验证API的正确性，并确保业务逻辑按预期工作。

## 主要测试工具

### 1. test_api_groups.py - API分组测试工具

这个脚本按照功能分组测试API端点，可以选择性地测试特定类别的API。脚本已优化，确保API调用的正确依赖顺序（例如，先创建服务，再创建时间段，再创建预约，最后才能评价）。

**使用方法:**

```bash
# 测试所有API组
python test_api_groups.py --groups all

# 测试特定API组
python test_api_groups.py --groups public user booking

# 可用的API组:
# - public: 公共接口
# - user: 用户相关接口
# - provider: 服务商相关接口
# - service: 服务相关接口
# - timeslot: 时间段相关接口
# - booking: 预约相关接口
# - review: 评论相关接口
# - favorite: 收藏相关接口
# - notification: 通知相关接口
```

### 2. test_booking_review_workflow.py - 预约评价工作流测试

这个脚本专门测试预约和评价的完整工作流程，确保所有依赖关系正确设置。

**使用方法:**

```bash
python test_booking_review_workflow.py
```

**测试流程:**
1. 创建服务商账号
2. 创建用户账号
3. 登录服务商账号
4. 登录用户账号
5. 服务商创建服务
6. 服务商创建时间段
7. 用户预约服务
8. 检查预约是否存在
9. 服务商接受预约
10. 用户评价服务
11. 服务商查看评价
12. 服务商回复评价

### 3. test_provider_review_response.py - 服务商评论回复测试

这个脚本专门测试服务商评论回复的完整流程，确保所有依赖关系正确设置。

**使用方法:**

```bash
python test_provider_review_response.py
```

**测试流程:**
1. 注册并登录服务商
2. 注册并登录普通用户
3. 服务商创建服务
4. 服务商创建时间段
5. 用户预约服务
6. 服务商接受预约
7. 用户评价服务
8. 服务商查看评价
9. 服务商回复评价
10. 用户查看评价回复

### 4. test_booking_cancellation.py - 预约取消测试

这个脚本专门测试预约取消的完整流程，确保所有依赖关系正确设置。

**使用方法:**

```bash
python test_booking_cancellation.py
```

**测试流程:**
1. 注册并登录服务商
2. 注册并登录普通用户
3. 服务商创建服务
4. 服务商创建多个时间段
5. 用户预约服务
6. 服务商接受预约
7. 用户取消预约
8. 验证预约已取消

## 测试报告工具

### 1. generate_api_test_report.py - 生成HTML测试报告

这个脚本解析API测试日志，生成一个交互式HTML报告，展示API测试结果。

**使用方法:**

```bash
python generate_api_test_report.py --log api_test.log --output api_test_report.html
```

### 2. generate_api_summary.py - 生成Markdown测试摘要

这个脚本解析API测试日志，生成一个简洁的Markdown格式摘要。

**使用方法:**

```bash
python generate_api_summary.py --log api_test.log --output api_test_summary.md
```

### 3. view_report.py - 查看HTML报告

这个脚本打开HTML测试报告。

**使用方法:**

```bash
python view_report.py --report api_test_report.html
```

### 4. run_api_tests.py - 运行测试并生成报告

这个脚本协调整个测试和报告生成流程。

**使用方法:**

```bash
python run_api_tests.py --groups all --format html,md
```

## 测试依赖关系处理

测试脚本已经进行了优化，处理了API之间的依赖关系：

1. **服务创建依赖**：必须先有服务商账号才能创建服务
2. **时间段依赖**：必须先有服务才能创建时间段
3. **预约依赖**：必须有可用时间段才能创建预约
4. **评价依赖**：必须先有预约才能创建评价
5. **回复依赖**：必须先有评价才能回复评价

测试脚本会自动处理这些依赖关系，确保API按照正确的顺序调用。如果某个依赖步骤失败，脚本会尝试继续执行后续测试，但会在报告中标记相关警告。

## 常见问题解决

### 1. 401未授权错误

如果遇到大量401错误，可能是认证令牌过期。尝试重新运行测试，或者使用`--fresh`参数强制重新获取认证令牌：

```bash
python test_api_groups.py --groups all --fresh
```

### 2. 404找不到资源错误

这通常表示测试依赖的资源不存在。检查是否按照正确的顺序运行测试，或者使用`--create-dependencies`参数让脚本自动创建必要的依赖资源：

```bash
python test_api_groups.py --groups review --create-dependencies
```

### 3. 400请求错误

这通常表示请求数据格式不正确。检查API文档，确保请求数据符合API要求。特别注意批量创建时间段API使用PUT方法，而不是POST方法。 