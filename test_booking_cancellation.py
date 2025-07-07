#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
预约取消测试脚本
测试完整的预约和取消流程，确保所有依赖关系正确设置
"""

import requests
import json
import sys
import time
from datetime import datetime, timedelta

# 服务器地址
BASE_URL = "http://localhost:5000"

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

def test_api(endpoint, method="GET", data=None, expected_status=200, auth_token=None, 
             description="", skip=False, params=None, files=None):
    """测试API接口"""
    if skip:
        print_colored(f"\n跳过 {method} {endpoint} - {description}", Colors.YELLOW)
        return None
    
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
            return None
        
        # 打印响应状态和内容
        print(f"状态码: {response.status_code}")
        try:
            response_json = response.json()
            print(f"响应内容: {json.dumps(response_json, ensure_ascii=False, indent=2)}")
        except:
            print(f"响应内容: {response.text[:200]}...")
        
        # 检查状态码
        if response.status_code == expected_status:
            print_colored("测试通过 ✓", Colors.GREEN)
            return response
        else:
            print_colored(f"测试失败 ✗ - 预期状态码 {expected_status}, 实际状态码 {response.status_code}", Colors.RED)
            return response
            
    except Exception as e:
        print_colored(f"测试异常: {str(e)}", Colors.RED)
        return None

def register_and_login_user(user_type="user"):
    """注册并登录用户，返回令牌"""
    timestamp = int(time.time())
    
    # 注册用户
    register_data = {
        "username": f"{user_type}_{timestamp}",
        "email": f"{user_type}{timestamp}@example.com",
        "password": "password123",
        "confirm_password": "password123",
        "userType": user_type
    }
    
    if user_type == "provider":
        register_data["business_name"] = f"测试服务商_{timestamp}"
    
    register_response = test_api("/api/register", method="POST", data=register_data, 
                                expected_status=201, description=f"注册{user_type}账号")
    
    # 登录用户
    login_data = {
        "email": register_data["email"],
        "password": "password123"
    }
    login_response = test_api("/api/login", method="POST", data=login_data, 
                             description=f"登录{user_type}账号")
    
    if login_response and login_response.status_code == 200:
        try:
            return login_response.json().get("token")
        except:
            pass
    
    return None

def test_booking_cancellation_flow():
    """测试预约取消完整流程"""
    print_colored("\n=== 测试预约取消完整流程 ===", Colors.BLUE)
    
    # 1. 注册并登录服务商
    print_colored("\n步骤1: 注册并登录服务商", Colors.BLUE)
    provider_token = register_and_login_user("provider")
    if not provider_token:
        print_colored("无法获取服务商令牌，测试终止", Colors.RED)
        return False
    
    # 2. 注册并登录普通用户
    print_colored("\n步骤2: 注册并登录普通用户", Colors.BLUE)
    user_token = register_and_login_user("user")
    if not user_token:
        print_colored("无法获取用户令牌，测试终止", Colors.RED)
        return False
    
    # 3. 服务商创建服务
    print_colored("\n步骤3: 服务商创建服务", Colors.BLUE)
    service_data = {
        "title": f"测试服务-{int(time.time())}",
        "description": "这是一个测试服务",
        "price": 100,
        "duration": 60,
        "categories": ["测试类别"],
        "status": "active"
    }
    create_service_response = test_api("/api/services", method="POST", data=service_data, 
                                      auth_token=provider_token, expected_status=201, 
                                      description="创建服务")
    
    # 获取服务ID
    service_id = None
    if create_service_response and create_service_response.status_code == 201:
        try:
            service_id = create_service_response.json().get("service", {}).get("id")
            if service_id:
                print_colored(f"成功创建服务，ID: {service_id}", Colors.GREEN)
        except Exception as e:
            print_colored(f"获取创建的服务ID失败: {str(e)}", Colors.RED)
            return False
    else:
        print_colored("创建服务失败，测试终止", Colors.RED)
        return False
    
    # 4. 服务商创建多个时间段
    print_colored("\n步骤4: 服务商创建多个时间段", Colors.BLUE)
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    
    # 创建三个时间段用于不同的测试场景
    time_slots = [
        {"date": tomorrow, "time": "10:00", "service_id": service_id},  # 用于正常预约
        {"date": tomorrow, "time": "11:00", "service_id": service_id},  # 用于预约后拒绝
        {"date": tomorrow, "time": "14:00", "service_id": service_id}   # 用于预约后取消
    ]
    
    # 使用批量创建接口
    timeslot_data = {
        "timeslots": time_slots,
        "is_available": True
    }
    create_timeslot_response = test_api("/api/timeslots/batch", method="PUT", data=timeslot_data, 
                                      auth_token=provider_token, expected_status=200, 
                                      description="批量创建时间段")
    
    if not create_timeslot_response or create_timeslot_response.status_code != 200:
        print_colored("创建时间段失败，测试终止", Colors.RED)
        return False
    
    # 5. 用户创建第一个预约（将被接受）
    print_colored("\n步骤5: 用户创建第一个预约（将被接受）", Colors.BLUE)
    booking_data_1 = {
        "provider_id": "prov1",  # 假设服务商ID为prov1
        "service_id": service_id,
        "date": tomorrow,
        "time": "10:00",
        "notes": "测试预约1 - 将被接受"
    }
    create_booking_response_1 = test_api("/api/bookings", method="POST", data=booking_data_1, 
                                       auth_token=user_token, expected_status=201, 
                                       description="创建预约1")
    
    # 获取预约ID
    booking_id_1 = None
    if create_booking_response_1 and create_booking_response_1.status_code == 201:
        try:
            booking_id_1 = create_booking_response_1.json().get("id")
            if booking_id_1:
                print_colored(f"成功创建预约1，ID: {booking_id_1}", Colors.GREEN)
        except Exception as e:
            print_colored(f"获取创建的预约1 ID失败: {str(e)}", Colors.RED)
    
    # 6. 用户创建第二个预约（将被拒绝）
    print_colored("\n步骤6: 用户创建第二个预约（将被拒绝）", Colors.BLUE)
    booking_data_2 = {
        "provider_id": "prov1",
        "service_id": service_id,
        "date": tomorrow,
        "time": "11:00",
        "notes": "测试预约2 - 将被拒绝"
    }
    create_booking_response_2 = test_api("/api/bookings", method="POST", data=booking_data_2, 
                                       auth_token=user_token, expected_status=201, 
                                       description="创建预约2")
    
    # 获取预约ID
    booking_id_2 = None
    if create_booking_response_2 and create_booking_response_2.status_code == 201:
        try:
            booking_id_2 = create_booking_response_2.json().get("id")
            if booking_id_2:
                print_colored(f"成功创建预约2，ID: {booking_id_2}", Colors.GREEN)
        except Exception as e:
            print_colored(f"获取创建的预约2 ID失败: {str(e)}", Colors.RED)
    
    # 7. 用户创建第三个预约（将被取消）
    print_colored("\n步骤7: 用户创建第三个预约（将被取消）", Colors.BLUE)
    booking_data_3 = {
        "provider_id": "prov1",
        "service_id": service_id,
        "date": tomorrow,
        "time": "14:00",
        "notes": "测试预约3 - 将被用户取消"
    }
    create_booking_response_3 = test_api("/api/bookings", method="POST", data=booking_data_3, 
                                       auth_token=user_token, expected_status=201, 
                                       description="创建预约3")
    
    # 获取预约ID
    booking_id_3 = None
    if create_booking_response_3 and create_booking_response_3.status_code == 201:
        try:
            booking_id_3 = create_booking_response_3.json().get("id")
            if booking_id_3:
                print_colored(f"成功创建预约3，ID: {booking_id_3}", Colors.GREEN)
        except Exception as e:
            print_colored(f"获取创建的预约3 ID失败: {str(e)}", Colors.RED)
    
    # 8. 服务商查看预约列表
    print_colored("\n步骤8: 服务商查看预约列表", Colors.BLUE)
    test_api("/api/bookings/provider", auth_token=provider_token,
            expected_status=200, description="服务商查看预约列表")
    
    # 9. 服务商接受第一个预约
    if booking_id_1:
        print_colored("\n步骤9: 服务商接受第一个预约", Colors.BLUE)
        test_api(f"/api/bookings/{booking_id_1}/accept", method="PUT", auth_token=provider_token,
                expected_status=200, description="接受预约1")
    
    # 10. 服务商拒绝第二个预约
    if booking_id_2:
        print_colored("\n步骤10: 服务商拒绝第二个预约", Colors.BLUE)
        test_api(f"/api/bookings/{booking_id_2}/reject", method="PUT", auth_token=provider_token,
                expected_status=200, description="拒绝预约2")
    
    # 11. 用户取消第三个预约
    if booking_id_3:
        print_colored("\n步骤11: 用户取消第三个预约", Colors.BLUE)
        test_api(f"/api/bookings/{booking_id_3}", method="DELETE", auth_token=user_token,
                expected_status=200, description="用户取消预约3")
    
    # 12. 用户查看预约列表
    print_colored("\n步骤12: 用户查看预约列表", Colors.BLUE)
    test_api("/api/bookings", auth_token=user_token,
            expected_status=200, description="用户查看预约列表")
    
    # 13. 用户查看预约详情
    if booking_id_1:
        print_colored("\n步骤13: 用户查看预约详情", Colors.BLUE)
        test_api(f"/api/bookings/{booking_id_1}", auth_token=user_token,
                expected_status=200, description="查看预约1详情")
    
    # 14. 检查时间段状态
    print_colored("\n步骤14: 检查时间段状态", Colors.BLUE)
    test_api("/api/timeslots", auth_token=provider_token,
            expected_status=200, description="检查时间段状态")
    
    print_colored("\n预约取消完整流程测试完成!", Colors.GREEN)
    return True

if __name__ == "__main__":
    success = test_booking_cancellation_flow()
    sys.exit(0 if success else 1) 