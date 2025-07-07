#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
API工作流测试脚本
测试完整的业务流程：服务创建、时间段创建、预约、评价和回复评价
"""

import requests
import json
import sys
import time
from datetime import datetime, timedelta

# 服务器地址
BASE_URL = "http://localhost:5000"

# 测试结果统计
results = {
    "success": 0,
    "failed": 0,
    "skipped": 0,
    "total": 0
}

# 颜色代码
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'

def print_colored(text, color):
    """打印彩色文本"""
    print(f"{color}{text}{Colors.ENDC}")

def test_api(endpoint, method="GET", data=None, expected_status=None, auth_token=None, 
             description="", skip=False, params=None, files=None):
    """测试API接口"""
    if skip:
        print_colored(f"\n跳过 {method} {endpoint} - {description}", Colors.YELLOW)
        results["skipped"] += 1
        return None
    
    results["total"] += 1
    url = f"{BASE_URL}{endpoint}"
    
    print_colored(f"\n测试 {method} {endpoint} - {description}", Colors.BLUE)
    print(f"URL: {url}")
    
    headers = {}
    if auth_token:
        headers["Authorization"] = f"Bearer {auth_token}"
    
    try:
        if method == "GET":
            response = requests.get(url, headers=headers, params=params, timeout=5)
        elif method == "POST":
            if files:
                # 不设置Content-Type，让requests自动处理multipart/form-data
                response = requests.post(url, headers=headers, data=data, files=files, timeout=5)
            else:
                headers["Content-Type"] = "application/json"
                response = requests.post(url, json=data, headers=headers, timeout=5)
        elif method == "PUT":
            headers["Content-Type"] = "application/json"
            response = requests.put(url, json=data, headers=headers, timeout=5)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers, timeout=5)
        else:
            print_colored(f"不支持的HTTP方法: {method}", Colors.RED)
            results["failed"] += 1
            return None
        
        # 打印响应状态和内容
        print(f"状态码: {response.status_code}")
        try:
            response_json = response.json()
            print(f"响应内容: {json.dumps(response_json, ensure_ascii=False, indent=2)}")
        except:
            print(f"响应内容: {response.text[:200]}...")
        
        # 检查状态码
        if expected_status is None or response.status_code == expected_status:
            print_colored("测试通过 ✓", Colors.GREEN)
            results["success"] += 1
            return response
        else:
            print_colored(f"测试失败 ✗ - 预期状态码 {expected_status}, 实际状态码 {response.status_code}", Colors.RED)
            results["failed"] += 1
            return response
            
    except Exception as e:
        print_colored(f"测试异常: {str(e)}", Colors.RED)
        results["failed"] += 1
        return None

def register_and_login(user_type="user"):
    """注册并登录账户，返回认证令牌"""
    print_colored(f"\n=== 注册并登录{user_type}账户 ===", Colors.BLUE)
    
    # 生成唯一用户名和邮箱
    timestamp = int(time.time())
    username = f"{user_type}_{timestamp}"
    email = f"{user_type}{timestamp}@example.com"
    password = "password123"
    
    # 构建注册数据
    register_data = {
        "username": username,
        "email": email,
        "password": password,
        "confirm_password": password,
        "userType": user_type
    }
    
    # 如果是服务商，添加业务名称
    if user_type == "provider":
        register_data["business_name"] = f"测试服务商-{timestamp}"
    
    # 注册账户
    register_response = test_api("/api/register", method="POST", data=register_data, 
                               expected_status=201, description=f"注册{user_type}账户")
    
    if not register_response or register_response.status_code != 201:
        print_colored(f"无法注册{user_type}账户，测试终止", Colors.RED)
        sys.exit(1)
    
    # 获取用户ID
    user_id = register_response.json().get("userId")
    if not user_id:
        print_colored(f"无法获取{user_type}账户ID，测试终止", Colors.RED)
        sys.exit(1)
    
    # 登录账户
    login_data = {
        "email": email,
        "password": password
    }
    
    login_response = test_api("/api/login", method="POST", data=login_data, 
                            expected_status=200, description=f"登录{user_type}账户")
    
    if not login_response or login_response.status_code != 200:
        print_colored(f"无法登录{user_type}账户，测试终止", Colors.RED)
        sys.exit(1)
    
    # 获取认证令牌
    token = login_response.json().get("token")
    if not token:
        print_colored(f"无法获取{user_type}认证令牌，测试终止", Colors.RED)
        sys.exit(1)
    
    print_colored(f"成功获取{user_type}认证令牌", Colors.GREEN)
    return {
        "token": token,
        "user_id": user_id,
        "username": username,
        "email": email
    }

def create_service(provider_token):
    """创建服务"""
    print_colored("\n=== 创建服务 ===", Colors.BLUE)
    
    # 构建服务数据
    timestamp = int(time.time())
    service_data = {
        "title": f"测试服务-{timestamp}",
        "description": "这是一个测试服务",
        "price": 100,
        "duration": 60,
        "categories": ["测试类别"],
        "status": "active"
    }
    
    # 创建服务
    service_response = test_api("/api/services", method="POST", data=service_data, 
                              auth_token=provider_token, expected_status=201, 
                              description="创建服务")
    
    if not service_response or service_response.status_code != 201:
        print_colored("无法创建服务，测试终止", Colors.RED)
        sys.exit(1)
    
    # 获取服务ID和提供商ID
    service = service_response.json().get("service", {})
    service_id = service.get("id")
    provider_id = service.get("provider_id")
    
    if not service_id or not provider_id:
        print_colored("无法获取服务ID或提供商ID，测试终止", Colors.RED)
        sys.exit(1)
    
    print_colored(f"成功创建服务，ID: {service_id}", Colors.GREEN)
    return {
        "service_id": service_id,
        "provider_id": provider_id
    }

def create_timeslots(provider_token, service_id):
    """创建时间段"""
    print_colored("\n=== 创建时间段 ===", Colors.BLUE)
    
    # 生成测试日期和时间
    today = datetime.now()
    test_date = today.strftime("%Y-%m-%d")
    tomorrow = (today + timedelta(days=1)).strftime("%Y-%m-%d")
    test_times = ["10:00", "10:30", "11:00", "11:30", "14:00", "14:30"]
    
    # 构建时间段数据
    timeslots_data = []
    for test_time in test_times:
        timeslots_data.append({
            "date": tomorrow,  # 使用明天的日期，避免时间已过的问题
            "time": test_time,
            "service_id": service_id
        })
    
    batch_data = {
        "timeslots": timeslots_data,
        "is_available": True
    }
    
    # 批量创建时间段
    batch_response = test_api("/api/timeslots/batch", method="PUT", data=batch_data, 
                            auth_token=provider_token, expected_status=200, 
                            description="批量创建时间段")
    
    if not batch_response or batch_response.status_code != 200:
        print_colored("无法创建时间段，测试终止", Colors.RED)
        sys.exit(1)
    
    print_colored("成功创建时间段", Colors.GREEN)
    return {
        "date": tomorrow,
        "times": test_times,
        "timeslots": timeslots_data
    }

def create_booking(user_token, provider_id, service_id, timeslot):
    """创建预约"""
    print_colored("\n=== 创建预约 ===", Colors.BLUE)
    
    # 构建预约数据
    booking_data = {
        "provider_id": provider_id,
        "service_id": service_id,
        "date": timeslot["date"],
        "time": timeslot["times"][0],  # 使用第一个可用时间
        "notes": "这是一个测试预约"
    }
    
    # 创建预约
    booking_response = test_api("/api/bookings", method="POST", data=booking_data, 
                              auth_token=user_token, expected_status=201, 
                              description="创建预约")
    
    if not booking_response or booking_response.status_code != 201:
        print_colored("无法创建预约，测试终止", Colors.RED)
        sys.exit(1)
    
    # 获取预约ID
    booking = booking_response.json().get("booking", {})
    booking_id = booking.get("id")
    if not booking_id:
        # 尝试直接从响应中获取ID
        booking_id = booking_response.json().get("id")
        if not booking_id:
            print_colored("无法获取预约ID，测试终止", Colors.RED)
            sys.exit(1)
    
    print_colored(f"成功创建预约，ID: {booking_id}", Colors.GREEN)
    return booking_id

def accept_booking(provider_token, booking_id):
    """接受预约"""
    print_colored("\n=== 接受预约 ===", Colors.BLUE)
    
    # 先获取预约详情，确认预约存在
    booking_response = test_api(f"/api/bookings/{booking_id}", auth_token=provider_token, 
                              expected_status=200, description="获取预约详情")
    
    if not booking_response or booking_response.status_code != 200:
        print_colored("无法获取预约详情，跳过接受预约", Colors.YELLOW)
        return
    
    # 检查预约状态
    booking_status = booking_response.json().get("status", "")
    print_colored(f"当前预约状态: {booking_status}", Colors.BLUE)
    
    # 接受预约
    accept_response = test_api(f"/api/bookings/{booking_id}/accept", method="PUT", 
                             auth_token=provider_token, expected_status=200, 
                             description="接受预约")
    
    if not accept_response or accept_response.status_code != 200:
        print_colored("无法接受预约，测试继续", Colors.YELLOW)
    else:
        print_colored("成功接受预约", Colors.GREEN)

def create_review(user_token, service_id, booking_id):
    """创建评价"""
    print_colored("\n=== 创建评价 ===", Colors.BLUE)
    
    # 先检查预约状态，确保预约已完成
    booking_response = test_api(f"/api/bookings/{booking_id}", auth_token=user_token, 
                              expected_status=200, description="获取预约详情")
    
    if not booking_response or booking_response.status_code != 200:
        print_colored("无法获取预约详情，跳过创建评价", Colors.YELLOW)
        return None
    
    # 获取provider_id
    provider_id = booking_response.json().get("provider_id")
    if not provider_id:
        print_colored("无法获取服务商ID，跳过创建评价", Colors.YELLOW)
        return None
    
    # 更新预约状态为已完成
    update_data = {
        "status": "completed"
    }
    update_response = test_api(f"/api/bookings/{booking_id}", method="PUT", data=update_data,
                             auth_token=user_token, expected_status=200, 
                             description="更新预约状态为已完成")
    
    if not update_response or update_response.status_code != 200:
        print_colored("无法更新预约状态，跳过创建评价", Colors.YELLOW)
        return None
    
    # 构建评价数据
    review_data = {
        "service_id": service_id,
        "provider_id": provider_id,  # 添加provider_id
        "booking_id": booking_id,
        "rating": 5,
        "content": "这是一条测试评价，服务很好！"
    }
    
    # 创建评价
    review_response = test_api("/api/reviews", method="POST", data=review_data, 
                             auth_token=user_token, expected_status=201, 
                             description="创建评价")
    
    if not review_response or review_response.status_code != 201:
        print_colored("无法创建评价，测试继续", Colors.YELLOW)
        return None
    
    # 获取评价ID
    review_id = None
    try:
        review_id = review_response.json().get("id")
        if not review_id:
            # 尝试从其他字段获取
            review_id = review_response.json().get("review", {}).get("id")
    except Exception as e:
        print_colored(f"解析评价ID失败: {str(e)}", Colors.RED)
    
    if not review_id:
        print_colored("无法获取评价ID，测试继续", Colors.YELLOW)
        return None
    
    print_colored(f"成功创建评价，ID: {review_id}", Colors.GREEN)
    return review_id

def reply_review(provider_token, review_id):
    """回复评价"""
    print_colored("\n=== 回复评价 ===", Colors.BLUE)
    
    # 先获取评价详情，确认评价存在
    review_response = test_api(f"/api/reviews/{review_id}", auth_token=provider_token, 
                             expected_status=200, description="获取评价详情")
    
    if not review_response or review_response.status_code != 200:
        print_colored("无法获取评价详情，跳过回复评价", Colors.YELLOW)
        return
    
    # 构建回复数据
    reply_data = {
        "reply": "感谢您的评价，我们会继续提供优质服务！"
    }
    
    # 回复评价
    reply_response = test_api(f"/api/reviews/{review_id}/reply", method="POST", data=reply_data, 
                            auth_token=provider_token, expected_status=200, 
                            description="回复评价")
    
    if not reply_response or reply_response.status_code != 200:
        print_colored("无法回复评价，测试继续", Colors.YELLOW)
    else:
        print_colored("成功回复评价", Colors.GREEN)

def print_results():
    """打印测试结果摘要"""
    print_colored("\n测试结果摘要:", Colors.BLUE)
    print(f"总测试数: {results['total']}")
    print_colored(f"通过: {results['success']}", Colors.GREEN)
    print_colored(f"失败: {results['failed']}", Colors.RED)
    print_colored(f"跳过: {results['skipped']}", Colors.YELLOW)
    
    success_rate = results['success'] / results['total'] * 100 if results['total'] > 0 else 0
    print(f"成功率: {success_rate:.2f}%")
    
    if results["failed"] > 0:
        print_colored("\n有测试失败，请检查日志!", Colors.RED)
        return False
    else:
        print_colored("\n所有测试通过!", Colors.GREEN)
        return True

def main():
    """主函数"""
    print_colored("开始API工作流测试...", Colors.BLUE)
    
    # 1. 注册并登录服务商账户
    provider = register_and_login("provider")
    provider_token = provider["token"]
    
    # 2. 注册并登录用户账户
    user = register_and_login("user")
    user_token = user["token"]
    
    # 3. 服务商创建服务
    service = create_service(provider_token)
    service_id = service["service_id"]
    provider_id = service["provider_id"]
    
    # 4. 服务商创建时间段
    timeslot = create_timeslots(provider_token, service_id)
    
    # 5. 用户创建预约
    booking_id = create_booking(user_token, provider_id, service_id, timeslot)
    
    # 6. 服务商接受预约
    accept_booking(provider_token, booking_id)
    
    # 7. 用户评价服务
    review_id = create_review(user_token, service_id, booking_id)
    
    # 8. 服务商回复评价
    if review_id:
        reply_review(provider_token, review_id)
    else:
        print_colored("跳过回复评价，因为没有成功创建评价", Colors.YELLOW)
    
    # 打印测试结果摘要
    success = print_results()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main() 