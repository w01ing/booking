#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
分组API接口测试脚本
允许用户选择性地测试特定类别的API端点
"""

import requests
import json
import sys
import urllib.parse
import time
import argparse
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

def test_public_apis(auth_token=None):
    """测试公共API接口"""
    print_colored("\n=== 测试公共接口 ===", Colors.BLUE)
    
    # 生成测试数据
    test_date = datetime.now().strftime("%Y-%m-%d")
    test_provider_id = "prov0"
    test_service_id = "b92e384e-0b81-4ae2-b8b3-d9c0e26996ee"  # 假设的服务ID
    
    # 1.1 首页
    test_api("/", description="测试首页访问")
    
    # 1.2 注册服务商账号
    provider_register_data = {
        "username": f"provider_{int(time.time())}",
        "email": f"provider{int(time.time())}@example.com",
        "password": "password123",
        "confirm_password": "password123",
        "userType": "provider",
        "business_name": "测试服务商"
    }
    test_api("/api/register", method="POST", data=provider_register_data, 
            expected_status=201, description="注册服务商账号")
    
    # 1.3 注册普通用户账号
    user_register_data = {
        "username": f"user_{int(time.time())}",
        "email": f"user{int(time.time())}@example.com",
        "password": "password123",
        "confirm_password": "password123",
        "userType": "user"
    }
    test_api("/api/register", method="POST", data=user_register_data, 
            expected_status=201, description="注册普通用户账号")
    
    # 1.4 登录服务商账号
    provider_login_data = {
        "email": provider_register_data["email"],
        "password": "password123"
    }
    provider_login_response = test_api("/api/login", method="POST", data=provider_login_data, 
                                      description="登录服务商账号")
    
    # 保存服务商token用于后续测试
    provider_token = None
    if provider_login_response and provider_login_response.status_code == 200:
        try:
            provider_token = provider_login_response.json().get("token")
        except:
            pass
    
    # 1.5 登录普通用户账号
    user_login_data = {
        "email": user_register_data["email"],
        "password": "password123"
    }
    user_login_response = test_api("/api/login", method="POST", data=user_login_data, 
                                  description="登录普通用户账号")
    
    # 保存用户token用于后续测试
    user_token = None
    if user_login_response and user_login_response.status_code == 200:
        try:
            user_token = user_login_response.json().get("token")
        except:
            pass
    
    # 1.6 公共服务列表
    test_api("/api/services/public", description="测试公开服务列表")
    
    # 1.7 服务详情
    test_api(f"/api/services/public/{test_service_id}", description="测试服务详情")
    
    # 1.8 提供商列表
    test_api("/api/providers", description="测试提供商列表")
    
    # 1.9 提供商可用时间段
    test_api(f"/api/provider/{urllib.parse.quote(test_provider_id)}/available-timeslots?date={test_date}", 
            description=f"测试提供商 {test_provider_id} 在 {test_date} 的可用时间段")
    
    # 1.10 评论列表
    test_api("/api/reviews", description="获取评论列表")
    
    # 返回获取到的token，用于后续测试
    return {
        "provider_token": provider_token,
        "user_token": user_token
    }

def get_auth_token(user_type="user"):
    """获取认证令牌"""
    print_colored(f"\n尝试登录获取{user_type}认证令牌...", Colors.BLUE)
    
    # 创建一个新的测试账户并登录
    username = f"test_user_{int(time.time())}"
    email = f"test{int(time.time())}@example.com"
    password = "password123"
    
    # 注册新账户
    register_data = {
        "username": username,
        "email": email,
        "password": password,
        "confirm_password": password,
        "userType": user_type  # 创建一个服务商账户
    }
    
    register_response = test_api("/api/register", method="POST", data=register_data, 
                               expected_status=201, description=f"注册{user_type}测试账户")
    
    if not register_response or register_response.status_code != 201:
        print_colored(f"无法注册{user_type}测试账户", Colors.RED)
        return None
    
    # 使用新注册的账户登录
    login_data = {
        "email": email,
        "password": password
    }
    
    response = test_api("/api/login", method="POST", data=login_data, 
                       expected_status=200, description=f"登录获取{user_type}令牌")
    
    if response and response.status_code == 200:
        try:
            token = response.json().get("token")
            if token:
                print_colored(f"成功获取{user_type}认证令牌", Colors.GREEN)
                return token
        except:
            pass
    
    print_colored(f"无法获取{user_type}认证令牌，将跳过需要{user_type}认证的测试", Colors.YELLOW)
    return None

def test_user_apis(auth_token=None):
    """测试用户API接口"""
    print_colored("\n=== 测试用户接口 ===", Colors.BLUE)
    
    test_address_id = "addr123"  # 假设的地址ID
    
    # 2.1 用户信息
    test_api("/api/user", auth_token=auth_token, 
            description="获取用户信息")
    
    user_data = {
        "username": f"updated_user_{int(time.time())}",
        "phone": "1234567890"
    }
    test_api("/api/user", method="PUT", data=user_data, auth_token=auth_token,
            description="更新用户信息")
    
    # 3.3 更新用户密码
    password_data = {
        "current_password": "password123",
        "new_password": "newpassword123",
        "confirm_password": "newpassword123"
    }
    test_api("/api/user/password", method="PUT", data=password_data, auth_token=auth_token,
            expected_status=200, description="更新用户密码")
    
    # 2.3 用户头像
    # 注意：文件上传需要特殊处理，这里简化处理
    test_api("/api/user/avatar", method="POST", data={}, auth_token=auth_token,
            skip=True, description="更新用户头像(跳过)")
    
    # 2.4 用户地址
    address_data = {
        "label": "家",
        "address": "北京市海淀区中关村大街1号",
        "province": "北京市",
        "city": "北京市",
        "district": "海淀区",
        "street": "中关村大街",
        "building": "1号",
        "room": "101",
        "postal_code": "100000",
        "is_default": True
    }
    test_api("/api/user/addresses", method="POST", data=address_data, auth_token=auth_token,
            expected_status=201, description="添加用户地址")
    
    test_api(f"/api/user/addresses/{test_address_id}", method="PUT", data=address_data, 
            auth_token=auth_token, expected_status=404, description="更新用户地址")
    
    test_api(f"/api/user/addresses/{test_address_id}", method="DELETE", 
            auth_token=auth_token, expected_status=404, description="删除用户地址")
    
    

def test_notification_apis(auth_token=None):
    """测试通知API接口"""
    print_colored("\n=== 测试通知接口 ===", Colors.BLUE)
    
    test_notification_id = "notif123"  # 测试通知ID
    
    # 9.1 获取用户通知
    test_api("/api/user/notifications", auth_token=auth_token,
            expected_status=200, description="获取用户通知")
    
    # 9.2 标记通知为已读
    test_api(f"/api/user/notifications/{test_notification_id}/read", method="PUT", auth_token=auth_token,
            expected_status=404, description="标记通知为已读")
    
    # 9.3 标记所有通知为已读
    test_api("/api/user/notifications/read-all", method="PUT", auth_token=auth_token,
            expected_status=200, description="标记所有通知为已读")
    
    # 9.4 删除通知
    test_api(f"/api/user/notifications/{test_notification_id}", method="DELETE", auth_token=auth_token,
            expected_status=404, description="删除通知")
    
    

def test_service_apis(auth_token=None):
    """测试服务API接口"""
    print_colored("\n=== 测试服务接口 ===", Colors.BLUE)
    
    test_service_id = None  # 用于存储新创建的服务ID
    provider_id = None      # 用于存储服务商ID
    
    # 5.1 获取所有服务
    test_api("/api/services", auth_token=auth_token,
            expected_status=200, description="获取所有服务")
    
    # 5.2 创建服务
    service_data = {
        "title": f"测试服务-{int(time.time())}",  # 使用title而不是name
        "description": "这是一个测试服务",
        "price": 100,
        "duration": 60,
        "categories": ["测试类别"],  # 添加categories字段
        "status": "active"
    }
    create_service_response = test_api("/api/services", method="POST", data=service_data, auth_token=auth_token,
            expected_status=201, description="创建服务")
    
    # 获取新创建的服务ID
    if create_service_response and create_service_response.status_code == 201:
        try:
            created_service_id = create_service_response.json().get("service", {}).get("id")
            if created_service_id:
                test_service_id = created_service_id
                print_colored(f"成功创建服务，ID: {test_service_id}", Colors.GREEN)
            
            # 获取服务商ID
            provider_id = create_service_response.json().get("service", {}).get("provider_id")
            if provider_id:
                print_colored(f"获取到服务商ID: {provider_id}", Colors.GREEN)
        except Exception as e:
            print_colored(f"获取创建的服务ID失败: {str(e)}", Colors.RED)
    
    # 如果没有成功创建服务，尝试获取该提供商的服务
    if not test_service_id:
        provider_services_response = test_api("/api/services/provider", auth_token=auth_token,
                expected_status=200, description="获取提供商服务")
        
        if provider_services_response and provider_services_response.status_code == 200:
            try:
                services = provider_services_response.json()
                if services and len(services) > 0:
                    test_service_id = services[0].get("id")
                    provider_id = services[0].get("provider_id")
                    print_colored(f"使用现有服务，ID: {test_service_id}", Colors.BLUE)
            except Exception as e:
                print_colored(f"获取提供商服务失败: {str(e)}", Colors.RED)
    
    # 如果仍然没有服务ID，跳过需要服务ID的测试
    if not test_service_id:
        print_colored("无法获取服务ID，将跳过需要服务ID的测试", Colors.YELLOW)
        return {"service_id": None, "provider_id": None}
    
    # 5.3 更新服务
    update_service_data = {
        "title": f"更新的测试服务-{int(time.time())}",
        "description": "这是一个更新后的测试服务",
        "price": 120,
        "duration": 90,
        "categories": ["更新的测试类别"]  # 添加categories字段
    }
    test_api(f"/api/services/{test_service_id}", method="PUT", data=update_service_data, 
            auth_token=auth_token, expected_status=200, description="更新服务")
    
    # 5.4 上传服务图片
    test_api(f"/api/services/{test_service_id}/upload", method="POST", data={}, 
            auth_token=auth_token, skip=True, description="上传服务图片(跳过)")
    
    # 5.5 更新服务状态
    status_data = {
        "status": "active"
    }
    test_api(f"/api/services/{test_service_id}/status", method="PUT", data=status_data, 
            auth_token=auth_token, expected_status=200, description="更新服务状态")
    
    return {"service_id": test_service_id, "provider_id": provider_id}

def test_timeslot_apis(auth_token=None, service_id=None):
    """测试时间段API接口"""
    print_colored("\n=== 测试时间段接口 ===", Colors.BLUE)
    
    # 生成测试数据
    test_date = datetime.now().strftime("%Y-%m-%d")
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    next_week = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
    test_times = ["10:00", "10:30", "11:00", "11:30", "14:00", "14:30"]
    created_timeslots = []  # 存储创建的时间段信息
    
    # 6.1 获取时间段
    test_api("/api/timeslots", auth_token=auth_token, params={"start_date": test_date, "end_date": next_week},
            expected_status=200, description="获取时间段")
    
    # 6.2 创建时间段 (使用批量创建接口)
    timeslots_data = []
    for test_time in test_times:
        timeslots_data.append({
            "date": test_date,
            "time": test_time,
            "service_id": service_id
        })
        created_timeslots.append({
            "date": test_date,
            "time": test_time,
            "service_id": service_id
        })
    
    batch_data = {
        "timeslots": timeslots_data,
        "is_available": True
    }
    
    batch_response = test_api("/api/timeslots/batch", method="PUT", data=batch_data, auth_token=auth_token,
            expected_status=200, description="批量创建时间段")
    
    # 6.3 更新时间段
    if created_timeslots:
        sample_slot = created_timeslots[0]
        update_data = {
            "date": sample_slot["date"],
            "time": sample_slot["time"],
            "is_available": False,
            "service_id": sample_slot["service_id"]
        }
        test_api(f"/api/timeslots/{sample_slot['date']}/{sample_slot['time']}", 
                method="PUT", data=update_data, auth_token=auth_token,
                expected_status=200, description="更新时间段")
    
    # 6.4 批量更新时间段
    batch_data = {
        "timeslots": [
            {"date": tomorrow, "time": "09:00", "service_id": service_id},
            {"date": tomorrow, "time": "09:30", "service_id": service_id},
            {"date": tomorrow, "time": "10:00", "service_id": service_id}
        ],
        "is_available": True
    }
    batch_response = test_api("/api/timeslots/batch", method="PUT", data=batch_data, auth_token=auth_token,
            expected_status=200, description="批量更新时间段")
    
    if batch_response and batch_response.status_code == 200:
        for slot in batch_data["timeslots"]:
            created_timeslots.append({
                "date": slot["date"],
                "time": slot["time"],
                "service_id": slot["service_id"]
            })
    
    # 6.5 应用工作模式
    pattern_data = {
        "pattern": "weekly",
        "start_date": test_date,
        "end_date": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
        "time_slots": ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"],
        "service_id": service_id
    }
    test_api("/api/timeslots/pattern", method="POST", data=pattern_data, auth_token=auth_token,
            expected_status=200, description="应用工作模式")
    
    # 6.6 获取时间段预约
    test_api(f"/api/timeslots/{test_date}/{test_times[0]}/booking", auth_token=auth_token,
            expected_status=404, description=f"获取时间段 {test_date} {test_times[0]} 的预约")
    
    # 返回创建的时间段信息，用于后续测试
    return created_timeslots

def test_booking_apis(auth_token=None, service_id=None, timeslots=None, provider_id=None, provider_token=None):
    """测试预约API接口"""
    print_colored("\n=== 测试预约接口 ===", Colors.BLUE)
    
    # 生成测试数据
    test_date = datetime.now().strftime("%Y-%m-%d")
    test_time = "10:00"
    test_provider_id = provider_id or "prov1"  # 使用传入的服务商ID或默认ID
    test_service_id = service_id or "b92e384e-0b81-4ae2-b8b3-d9c0e26996ee"  # 使用传入的服务ID或默认ID
    test_booking_id = None  # 存储创建的预约ID
    
    # 如果没有提供服务商令牌，尝试获取一个
    if not provider_token:
        provider_token = get_auth_token("provider")
    
    # 使用可用的时间段
    available_timeslot = None
    if timeslots and len(timeslots) > 0:
        available_timeslot = timeslots[0]
        test_date = available_timeslot["date"]
        test_time = available_timeslot["time"]
        print_colored(f"使用可用时间段: {test_date} {test_time}", Colors.BLUE)
    else:
        print_colored("警告: 没有可用的时间段，预约可能会失败", Colors.YELLOW)
    
    # 4.1 获取预约列表
    test_api("/api/bookings", auth_token=auth_token,
            expected_status=200, description="获取预约列表")
    
    # 4.2 创建预约
    booking_data = {
        "provider_id": test_provider_id,
        "service_id": test_service_id,
        "date": test_date,
        "time": test_time,
        "notes": "测试预约"
    }
    create_booking_response = test_api("/api/bookings", method="POST", data=booking_data, auth_token=auth_token,
            expected_status=201, description="创建预约")
    
    # 获取创建的预约ID
    if create_booking_response and create_booking_response.status_code == 201:
        try:
            test_booking_id = create_booking_response.json().get("booking", {}).get("id")
            if test_booking_id:
                print_colored(f"成功创建预约，ID: {test_booking_id}", Colors.GREEN)
            else:
                # 尝试直接从响应中获取ID
                test_booking_id = create_booking_response.json().get("id")
                if test_booking_id:
                    print_colored(f"成功创建预约，ID: {test_booking_id}", Colors.GREEN)
        except Exception as e:
            print_colored(f"获取创建的预约ID失败: {str(e)}", Colors.RED)
            test_booking_id = "booking123"  # 使用默认ID
    else:
        test_booking_id = "booking123"  # 使用默认ID
    
    # 4.3 获取预约详情
    test_api(f"/api/bookings/{test_booking_id}", auth_token=auth_token,
            expected_status=None, description="获取预约详情")
    
    # 4.4 更新预约
    update_booking_data = {
        "provider_id": test_provider_id,
        "service_id": test_service_id,
        "date": test_date,
        "time": test_time,
        "notes": "更新的测试预约",
        "status": "pending"
    }
    test_api(f"/api/bookings/{test_booking_id}", method="PUT", data=update_booking_data, 
            auth_token=auth_token, expected_status=None, description="更新预约")
    
    # 4.5 获取仪表盘预约
    test_api("/api/bookings/dashboard", auth_token=auth_token,
            expected_status=200, description="获取仪表盘预约")
    
    # 4.6 获取日历预约
    test_api("/api/bookings/calendar", auth_token=provider_token,
            params={"start_date": test_date, "end_date": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")},
            expected_status=200, description="获取日历预约")
    
    # 4.7 获取提供商预约 (使用provider_token)
    # 注意：这个API需要服务商权限，所以应该使用provider_token
    test_api("/api/bookings/provider", auth_token=provider_token,
            expected_status=200, description="获取提供商预约")
    
    # 4.8 获取预约统计
    test_api("/api/bookings/stats", auth_token=auth_token,
            expected_status=None, description="获取预约统计")
    
    # 4.9 接受预约
    test_api(f"/api/bookings/{test_booking_id}/accept", method="PUT", auth_token=provider_token,
            expected_status=None, description="接受预约")
    
    # 4.10 拒绝预约（创建新预约后再拒绝）
    if timeslots and len(timeslots) > 1:
        second_timeslot = timeslots[1]
        second_booking_data = {
            "provider_id": test_provider_id,
            "service_id": test_service_id,
            "date": second_timeslot["date"],
            "time": second_timeslot["time"],
            "notes": "第二个测试预约"
        }
        second_booking_response = test_api("/api/bookings", method="POST", data=second_booking_data, 
                                         auth_token=auth_token, expected_status=201, 
                                         description="创建第二个预约")
        
        if second_booking_response and second_booking_response.status_code == 201:
            try:
                second_booking_id = second_booking_response.json().get("booking", {}).get("id") or second_booking_response.json().get("id")
                if second_booking_id:
                    test_api(f"/api/bookings/{second_booking_id}/reject", method="PUT", 
                            auth_token=provider_token, expected_status=None, description="拒绝预约")
            except:
                pass
    
    # 4.11 取消预约（创建新预约后再取消）
    if timeslots and len(timeslots) > 2:
        third_timeslot = timeslots[2]
        third_booking_data = {
            "provider_id": test_provider_id,
            "service_id": test_service_id,
            "date": third_timeslot["date"],
            "time": third_timeslot["time"],
            "notes": "第三个测试预约"
        }
        third_booking_response = test_api("/api/bookings", method="POST", data=third_booking_data, 
                                        auth_token=auth_token, expected_status=201, 
                                        description="创建第三个预约")
        
        if third_booking_response and third_booking_response.status_code == 201:
            try:
                third_booking_id = third_booking_response.json().get("booking", {}).get("id") or third_booking_response.json().get("id")
                if third_booking_id:
                    test_api(f"/api/bookings/{third_booking_id}", method="DELETE", 
                            auth_token=auth_token, expected_status=None, description="取消预约")
            except:
                pass
    
    # 返回创建的预约ID和服务商ID
    return {"booking_id": test_booking_id, "provider_id": test_provider_id}

def test_review_apis(auth_token=None, service_id=None, booking_id=None, provider_id=None):
    """测试评论API接口"""
    print_colored("\n=== 测试评论接口 ===", Colors.BLUE)
    
    test_service_id = service_id or "b92e384e-0b81-4ae2-b8b3-d9c0e26996ee"  # 使用传入的服务ID或默认ID
    test_provider_id = provider_id or "prov1"  # 使用传入的服务商ID或默认ID
    test_review_id = None  # 存储创建的评论ID
    
    # 检查是否有预约ID，如果没有则可能无法创建评论
    if not booking_id:
        print_colored("警告: 没有提供预约ID，评论创建可能会失败", Colors.YELLOW)
    
    # 7.1 获取评论
    test_api("/api/reviews", auth_token=auth_token, description="获取评论")
    
    # 7.2 创建评论
    review_data = {
        "service_id": test_service_id,
        "provider_id": test_provider_id,
        "booking_id": booking_id,
        "rating": 5,
        "content": "这是一条测试评论，服务很好！"
    }
    create_review_response = test_api("/api/reviews", method="POST", data=review_data, auth_token=auth_token,
            expected_status=None, description="创建评论")
    
    # 获取创建的评论ID
    if create_review_response and (create_review_response.status_code == 201 or create_review_response.status_code == 200):
        try:
            test_review_id = create_review_response.json().get("id")
            if test_review_id:
                print_colored(f"成功创建评论，ID: {test_review_id}", Colors.GREEN)
            else:
                # 尝试从其他字段获取
                test_review_id = create_review_response.json().get("review", {}).get("id")
                if test_review_id:
                    print_colored(f"成功创建评论，ID: {test_review_id}", Colors.GREEN)
        except Exception as e:
            print_colored(f"获取创建的评论ID失败: {str(e)}", Colors.RED)
            test_review_id = "review123"  # 使用默认ID
    else:
        test_review_id = "review123"  # 使用默认ID
    
    # 7.3 更新评论
    update_review_data = {
        "service_id": test_service_id,
        "rating": 4,
        "content": "这是一条更新后的测试评论，服务还不错！"
    }
    test_api(f"/api/reviews/{test_review_id}", method="PUT", data=update_review_data, 
            auth_token=auth_token, expected_status=None, description="更新评论")
    
    # 7.4 获取特定服务的评论
    test_api(f"/api/reviews/service/{test_service_id}", auth_token=auth_token,
            expected_status=200, description="获取特定服务的评论")
    
    # 返回创建的评论ID
    return test_review_id

def test_favorite_apis(auth_token=None, service_id=None):
    """测试收藏API接口"""
    print_colored("\n=== 测试收藏接口 ===", Colors.BLUE)
    
    test_service_id = service_id or "b92e384e-0b81-4ae2-b8b3-d9c0e26996ee"  # 使用传入的服务ID或默认ID
    
    # 8.1 获取收藏列表
    test_api("/api/favorites", auth_token=auth_token,
            expected_status=200, description="获取收藏列表")
    
    # 8.2 添加收藏
    favorite_data = {
        "service_id": test_service_id
    }
    test_api("/api/favorites", method="POST", data=favorite_data, auth_token=auth_token,
            expected_status=None, description="添加收藏")
    
    # 8.3 检查是否已收藏
    test_api(f"/api/favorites/check/{test_service_id}", auth_token=auth_token,
            expected_status=200, description="检查服务是否已收藏")
    
    # 8.4 删除收藏
    test_api(f"/api/favorites/{test_service_id}", method="DELETE", auth_token=auth_token,
            expected_status=200, description="删除收藏")

def test_provider_apis(auth_token=None):
    """测试提供商API接口"""
    print_colored("\n=== 测试提供商业务接口 ===", Colors.BLUE)
    
    # 9.1 获取提供商业务信息
    test_api("/api/provider/business", auth_token=auth_token,
            expected_status=200, description="获取提供商业务信息")
    
    # 9.2 更新提供商业务信息
    business_data = {
        "business_name": f"测试服务商-{int(time.time())}",
        "description": "这是一个测试服务商",
        "category": "健康服务",
        "address": "测试地址",
        "phone": "1234567890"
    }
    test_api("/api/provider/business", method="PUT", data=business_data, auth_token=auth_token,
            expected_status=200, description="更新提供商业务信息")
    
    # 9.3 获取提供商设置
    test_api("/api/provider/settings", auth_token=auth_token,
            expected_status=200, description="获取提供商设置")
    
    # 9.4 更新提供商设置
    settings_data = {
        "booking_notice_time": 24,
        "max_booking_per_day": 10,
        "allow_instant_booking": True,
        "auto_confirm_booking": False
    }
    test_api("/api/provider/settings", method="PUT", data=settings_data, auth_token=auth_token,
            expected_status=200, description="更新提供商设置")
    
    # 9.5 获取提供商资质
    test_api("/api/provider/qualifications", auth_token=auth_token,
            expected_status=200, description="获取提供商资质")
    
    # 9.6 添加提供商资质
    qualification_data = {
        "title": "专业证书",
        "issuing_organization": "测试机构",
        "issue_date": "2023-01-01",
        "expiration_date": "2025-01-01",
        "credential_id": "CERT-12345"
    }
    test_api("/api/provider/qualifications", method="POST", data=qualification_data, auth_token=auth_token,
            expected_status=201, description="添加提供商资质")
    
    # 9.7 获取提供商统计数据
    test_api("/api/provider/stats", auth_token=auth_token,
            expected_status=200, description="获取提供商统计数据")
    
    # 9.8 获取提供商评价 (此时可能没有评价，但API应该返回空列表而不是错误)
    test_api("/api/provider/reviews", auth_token=auth_token,
            expected_status=200, description="获取提供商评价")
    
    # 9.9 回复评价 - 跳过，因为需要先有评价
    print_colored("跳过回复评价测试，因为需要先有评价", Colors.YELLOW)
    
    # 9.10 上传提供商头像
    test_api("/api/provider/avatar", method="POST", data={}, auth_token=auth_token,
            skip=True, description="上传提供商头像(跳过)")
    
    # 9.11 获取提供商营业时间
    test_api("/api/provider/business-hours", auth_token=auth_token,
            expected_status=200, description="获取提供商营业时间")
    
    # 9.12 更新提供商营业时间
    business_hours_data = {
        "monday": {"start": "09:00", "end": "17:00", "is_open": True},
        "tuesday": {"start": "09:00", "end": "17:00", "is_open": True},
        "wednesday": {"start": "09:00", "end": "17:00", "is_open": True},
        "thursday": {"start": "09:00", "end": "17:00", "is_open": True},
        "friday": {"start": "09:00", "end": "17:00", "is_open": True},
        "saturday": {"start": "10:00", "end": "15:00", "is_open": True},
        "sunday": {"start": "00:00", "end": "00:00", "is_open": False}
    }
    test_api("/api/provider/business-hours", method="PUT", data=business_hours_data, auth_token=auth_token,
            expected_status=200, description="更新提供商营业时间")

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

def run_tests(groups=None):
    """运行所有或指定组的测试"""
    print_colored("开始API接口测试...", Colors.BLUE)
    
    # 如果没有指定组，则测试所有组
    if not groups:
        groups = ["public", "provider", "service", "timeslot", "user", "booking", "review", "favorite", "notification"]
    
    # 先测试公共接口，获取认证令牌
    tokens = None
    if "public" in groups:
        tokens = test_public_apis()
        groups.remove("public")
    else:
        # 如果不测试公共接口，尝试使用默认账户获取令牌
        user_token = get_auth_token("user")
        provider_token = get_auth_token("provider")
        tokens = {"provider_token": provider_token, "user_token": user_token}
    
    # 存储测试过程中创建的资源ID
    test_resources = {
        "service_id": None,
        "timeslots": [],
        "booking_id": None,
        "review_id": None,
        "provider_id": None
    }
    
    # 强制执行正确的测试顺序，确保依赖关系
    # 即使用户没有选择特定组，也需要执行必要的依赖测试
    
    # 1. 先测试服务商相关接口
    if "provider" in groups or any(g in groups for g in ["service", "timeslot", "booking"]):
        test_provider_apis(tokens.get("provider_token"))
        if "provider" in groups:
            groups.remove("provider")
    
    # 2. 服务商创建服务
    if "service" in groups or any(g in groups for g in ["timeslot", "booking", "review", "favorite"]):
        service_response = test_service_apis(tokens.get("provider_token"))
        test_resources["service_id"] = service_response.get("service_id")
        test_resources["provider_id"] = service_response.get("provider_id")
        if "service" in groups:
            groups.remove("service")
    
    # 3. 服务商设置时间段
    if "timeslot" in groups or "booking" in groups:
        test_resources["timeslots"] = test_timeslot_apis(tokens.get("provider_token"), test_resources.get("service_id"))
        if "timeslot" in groups:
            groups.remove("timeslot")
    
    # 4. 用户相关接口
    if "user" in groups or any(g in groups for g in ["booking", "review", "favorite"]):
        test_user_apis(tokens.get("user_token"))
        if "user" in groups:
            groups.remove("user")
    
    # 5. 用户预约服务
    if "booking" in groups or "review" in groups:
        booking_result = test_booking_apis(tokens.get("user_token"), 
                                      test_resources.get("service_id"), 
                                      test_resources.get("timeslots"),
                                      test_resources.get("provider_id"),
                                      tokens.get("provider_token"))
        test_resources["booking_id"] = booking_result.get("booking_id")
        if "booking" in groups:
            groups.remove("booking")
    
    # 6. 用户评价服务 (需要先有预约)
    if "review" in groups:
        test_resources["review_id"] = test_review_apis(tokens.get("user_token"), 
                                                     test_resources.get("service_id"),
                                                     test_resources.get("booking_id"),
                                                     test_resources.get("provider_id"))
        groups.remove("review")
    
    # 7. 用户收藏服务
    if "favorite" in groups:
        test_favorite_apis(tokens.get("user_token"), test_resources.get("service_id"))
        groups.remove("favorite")
    
    # 8. 通知相关接口
    if "notification" in groups:
        test_notification_apis(tokens.get("user_token"))
        groups.remove("notification")
    
    # 打印测试结果摘要
    return print_results()

def main():
    """主函数"""
    parser = argparse.ArgumentParser(description="API接口测试工具")
    parser.add_argument("--groups", nargs="+", choices=["public", "user", "notification", "booking", 
                                                      "service", "timeslot", "review", "favorite", 
                                                      "provider", "all"],
                       help="要测试的API组，可以指定多个组，例如: --groups public user")
    
    args = parser.parse_args()
    
    # 如果指定了"all"，则测试所有组
    if args.groups and "all" in args.groups:
        args.groups = None
    
    success = run_tests(args.groups)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main() 