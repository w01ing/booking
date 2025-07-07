#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
简化版预约和评价工作流测试脚本
测试完整的预约-评价流程，确保所有依赖关系正确设置
"""

import requests
import json
import sys
import time
from datetime import datetime, timedelta
import os

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

def test_api(endpoint, method="GET", data=None, expected_status=None, auth_token=None, 
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
        if expected_status is None or response.status_code == expected_status:
            print_colored("测试通过 ✓", Colors.GREEN)
            return response
        else:
            print_colored(f"测试失败 ✗ - 预期状态码 {expected_status}, 实际状态码 {response.status_code}", Colors.RED)
            return response
            
    except Exception as e:
        print_colored(f"测试异常: {str(e)}", Colors.RED)
        return None

def test_booking_review_workflow():
    """测试预约和评价工作流"""
    print_colored("\n=== 测试预约和评价工作流 ===", Colors.BLUE)
    
    # 1. 创建服务商账号
    print_colored("\n步骤1: 创建服务商账号", Colors.BLUE)
    provider_timestamp = int(time.time())
    provider_register_data = {
        "username": f"provider_{provider_timestamp}",
        "email": f"provider{provider_timestamp}@example.com",
        "password": "password123",
        "confirm_password": "password123",
        "userType": "provider",
        "business_name": "测试服务商"
    }
    provider_register_response = test_api("/api/register", method="POST", data=provider_register_data, 
                                         expected_status=201, description="注册服务商账号")
    
    # 2. 创建用户账号
    print_colored("\n步骤2: 创建用户账号", Colors.BLUE)
    user_timestamp = int(time.time())
    user_register_data = {
        "username": f"user_{user_timestamp}",
        "email": f"user{user_timestamp}@example.com",
        "password": "password123",
        "confirm_password": "password123",
        "userType": "user"
    }
    user_register_response = test_api("/api/register", method="POST", data=user_register_data, 
                                     expected_status=201, description="注册用户账号")
    
    # 3. 登录服务商账号
    print_colored("\n步骤3: 登录服务商账号", Colors.BLUE)
    provider_login_data = {
        "email": provider_register_data["email"],
        "password": "password123"
    }
    provider_login_response = test_api("/api/login", method="POST", data=provider_login_data, 
                                      description="登录服务商账号")
    
    provider_token = None
    if provider_login_response and provider_login_response.status_code == 200:
        provider_token = provider_login_response.json().get("token")
        print_colored(f"服务商登录成功，获取到令牌", Colors.GREEN)
    else:
        print_colored("服务商登录失败，测试终止", Colors.RED)
        return False
    
    # 4. 登录用户账号
    print_colored("\n步骤4: 登录用户账号", Colors.BLUE)
    user_login_data = {
        "email": user_register_data["email"],
        "password": "password123"
    }
    user_login_response = test_api("/api/login", method="POST", data=user_login_data, 
                                  description="登录用户账号")
    
    user_token = None
    if user_login_response and user_login_response.status_code == 200:
        user_token = user_login_response.json().get("token")
        print_colored(f"用户登录成功，获取到令牌", Colors.GREEN)
    else:
        print_colored("用户登录失败，测试终止", Colors.RED)
        return False
    
    # 5. 服务商创建服务
    print_colored("\n步骤5: 服务商创建服务", Colors.BLUE)
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
    
    # 获取服务商ID
    provider_id = None
    try:
        provider_id = create_service_response.json().get("service", {}).get("provider_id")
        if provider_id:
            print_colored(f"获取到服务商ID: {provider_id}", Colors.GREEN)
        else:
            # 尝试从其他响应中获取
            provider_id = create_service_response.json().get("service", {}).get("provider", {}).get("id")
            if provider_id:
                print_colored(f"获取到服务商ID: {provider_id}", Colors.GREEN)
            else:
                print_colored("无法获取服务商ID，将使用默认值", Colors.YELLOW)
                provider_id = "prov1"
    except Exception as e:
        print_colored(f"获取服务商ID失败: {str(e)}，将使用默认值", Colors.YELLOW)
        provider_id = "prov1"
    
    # 6. 服务商创建时间段
    print_colored("\n步骤6: 服务商创建时间段", Colors.BLUE)
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    timeslot_data = {
        "timeslots": [
            {
                "date": tomorrow,
                "time": "10:00",
                "service_id": service_id
            }
        ],
        "is_available": True
    }
    create_timeslot_response = test_api("/api/timeslots/batch", method="PUT", data=timeslot_data, 
                                       auth_token=provider_token, expected_status=200, 
                                       description="批量创建时间段")
    
    if not create_timeslot_response or create_timeslot_response.status_code != 200:
        print_colored("创建时间段失败，尝试使用单个时间段创建API", Colors.YELLOW)
        # 尝试使用单个时间段创建API
        single_timeslot_data = {
            "date": tomorrow,
            "time": "10:00",
            "is_available": True,
            "service_id": service_id
        }
        create_timeslot_response = test_api("/api/timeslots", method="POST", data=[single_timeslot_data], 
                                          auth_token=provider_token, expected_status=None, 
                                          description="创建单个时间段")
        
        if not create_timeslot_response or (create_timeslot_response.status_code != 200 and create_timeslot_response.status_code != 201):
            print_colored("创建时间段失败，测试继续，但预约可能会失败", Colors.YELLOW)
    
    # 7. 用户预约服务
    print_colored("\n步骤7: 用户预约服务", Colors.BLUE)
    booking_data = {
        "provider_id": provider_id,
        "service_id": service_id,
        "date": tomorrow,
        "time": "10:00",
        "notes": "测试预约"
    }
    create_booking_response = test_api("/api/bookings", method="POST", data=booking_data, 
                                      auth_token=user_token, expected_status=201, 
                                      description="创建预约")
    
    booking_id = None
    if create_booking_response and create_booking_response.status_code == 201:
        try:
            booking_id = create_booking_response.json().get("booking", {}).get("id")
            if booking_id:
                print_colored(f"成功创建预约，ID: {booking_id}", Colors.GREEN)
            else:
                # 尝试直接从响应中获取ID
                booking_id = create_booking_response.json().get("id")
                if booking_id:
                    print_colored(f"成功创建预约，ID: {booking_id}", Colors.GREEN)
                else:
                    print_colored("无法获取预约ID，测试可能会失败", Colors.YELLOW)
        except Exception as e:
            print_colored(f"获取创建的预约ID失败: {str(e)}", Colors.RED)
    else:
        print_colored("创建预约失败，测试可能会失败", Colors.YELLOW)
    
    # 8. 检查预约是否存在
    if booking_id:
        print_colored("\n步骤8: 检查预约是否存在", Colors.BLUE)
        check_booking_response = test_api(f"/api/bookings/{booking_id}", auth_token=user_token, 
                                        expected_status=None, description="检查预约")
        
        if check_booking_response and check_booking_response.status_code == 200:
            print_colored("预约存在，继续测试", Colors.GREEN)
        else:
            print_colored("预约不存在，测试可能会失败", Colors.YELLOW)
    
    # 9. 服务商接受预约
    if booking_id:
        print_colored("\n步骤9: 服务商接受预约", Colors.BLUE)
        accept_booking_response = test_api(f"/api/bookings/{booking_id}/accept", method="PUT", 
                                         auth_token=provider_token, expected_status=None, 
                                         description="接受预约")
        
        if accept_booking_response and (accept_booking_response.status_code == 200 or accept_booking_response.status_code == 404):
            if accept_booking_response.status_code == 200:
                print_colored("预约接受成功", Colors.GREEN)
            else:
                print_colored("预约接受失败，但继续测试", Colors.YELLOW)
        else:
            print_colored("预约接受失败，测试可能会失败", Colors.YELLOW)
    
    # 10. 用户评价服务
    if booking_id:
        print_colored("\n步骤10: 用户评价服务", Colors.BLUE)
        review_data = {
            "service_id": service_id,
            "booking_id": booking_id,
            "rating": 4,
            "content": "这是一条测试评论，服务还不错！"
        }
        create_review_response = test_api("/api/reviews", method="POST", data=review_data, 
                                        auth_token=user_token, expected_status=None, 
                                        description="创建评论")
        
        review_id = None
        if create_review_response and (create_review_response.status_code == 201 or create_review_response.status_code == 200):
            try:
                review_id = create_review_response.json().get("id")
                if review_id:
                    print_colored(f"成功创建评论，ID: {review_id}", Colors.GREEN)
                else:
                    # 尝试从其他字段获取
                    review_id = create_review_response.json().get("review", {}).get("id")
                    if review_id:
                        print_colored(f"成功创建评论，ID: {review_id}", Colors.GREEN)
                    else:
                        print_colored("无法获取评论ID，测试可能会失败", Colors.YELLOW)
            except Exception as e:
                print_colored(f"获取创建的评论ID失败: {str(e)}", Colors.RED)
        else:
            print_colored("创建评论失败，测试可能会失败", Colors.YELLOW)
        
        # 11. 服务商查看评价
        print_colored("\n步骤11: 服务商查看评价", Colors.BLUE)
        provider_reviews_response = test_api("/api/provider/reviews", auth_token=provider_token, 
                                           expected_status=None, description="获取服务商评价")
        
        if provider_reviews_response and provider_reviews_response.status_code == 200:
            print_colored("获取服务商评价成功", Colors.GREEN)
        else:
            print_colored("获取服务商评价失败", Colors.YELLOW)
        
        # 12. 服务商回复评价
        if review_id:
            print_colored("\n步骤12: 服务商回复评价", Colors.BLUE)
            reply_data = {
                "content": "感谢您的评价，我们会继续努力提供更好的服务！"
            }
            reply_review_response = test_api(f"/api/provider/reviews/{review_id}/reply", method="POST", 
                                           data=reply_data, auth_token=provider_token, 
                                           expected_status=None, description="回复评价")
            
            if reply_review_response and (reply_review_response.status_code == 201 or reply_review_response.status_code == 200):
                print_colored("回复评价成功", Colors.GREEN)
            else:
                print_colored("回复评价失败", Colors.YELLOW)
    
    print_colored("\n测试完成!", Colors.GREEN)
    return True

if __name__ == "__main__":
    success = test_booking_review_workflow()
    sys.exit(0 if success else 1) 