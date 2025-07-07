#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
前端认证流程测试脚本
监控API调用频率和认证相关请求
"""

import requests
import json
import time
import sys
from datetime import datetime

# 服务器地址
BASE_URL = "http://localhost:5000"

# 测试配置
MONITORING_DURATION = 10  # 监控持续时间（秒）
REQUEST_INTERVAL = 0.5    # 请求间隔（秒）

def timestamp():
    """返回当前时间戳"""
    return datetime.now().strftime("%H:%M:%S.%f")[:-3]

def monitor_api_calls():
    """监控API调用频率"""
    print(f"开始监控API调用频率，持续{MONITORING_DURATION}秒...")
    
    # 记录API调用次数
    api_calls = {}
    start_time = time.time()
    
    try:
        while time.time() - start_time < MONITORING_DURATION:
            # 模拟浏览器请求，不带认证信息
            endpoints = [
                "/",
                "/api/user",
                "/api/services/public",
                "/api/provider/prov1/available-timeslots?date=2025-07-05"
            ]
            
            for endpoint in endpoints:
                url = f"{BASE_URL}{endpoint}"
                try:
                    response = requests.get(url, timeout=2)
                    status = response.status_code
                    
                    # 记录API调用
                    if endpoint not in api_calls:
                        api_calls[endpoint] = {"total": 0, "success": 0, "failed": 0}
                    
                    api_calls[endpoint]["total"] += 1
                    if 200 <= status < 300 or status == 401:  # 401是预期的未认证响应
                        api_calls[endpoint]["success"] += 1
                    else:
                        api_calls[endpoint]["failed"] += 1
                    
                    print(f"[{timestamp()}] {endpoint} - 状态码: {status}")
                    
                except Exception as e:
                    print(f"[{timestamp()}] 请求 {endpoint} 失败: {str(e)}")
            
            # 等待一段时间再发送下一轮请求
            time.sleep(REQUEST_INTERVAL)
    
    except KeyboardInterrupt:
        print("\n监控被用户中断")
    
    # 打印监控结果
    print("\n监控结果:")
    for endpoint, stats in api_calls.items():
        print(f"端点: {endpoint}")
        print(f"  总请求数: {stats['total']}")
        print(f"  成功请求: {stats['success']}")
        print(f"  失败请求: {stats['failed']}")
        if stats['total'] > 0:
            requests_per_second = stats['total'] / min(MONITORING_DURATION, time.time() - start_time)
            print(f"  请求频率: {requests_per_second:.2f} 请求/秒")
        print()

def test_auth_flow():
    """测试认证流程"""
    print("测试认证流程...")
    
    # 1. 尝试访问需要认证的资源
    print("\n1. 尝试访问需要认证的资源")
    response = requests.get(f"{BASE_URL}/api/user")
    print(f"状态码: {response.status_code}")
    print(f"响应: {response.text[:100]}...")
    
    # 2. 尝试登录（使用无效凭据）
    print("\n2. 尝试登录（使用无效凭据）")
    login_data = {
        "email": "test@example.com",
        "password": "password123"
    }
    response = requests.post(f"{BASE_URL}/api/login", json=login_data)
    print(f"状态码: {response.status_code}")
    try:
        print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    except:
        print(f"响应: {response.text[:100]}...")

def main():
    """运行测试"""
    print("开始前端认证流程测试...")
    
    # 测试认证流程
    test_auth_flow()
    
    # 监控API调用频率
    monitor_api_calls()
    
    print("\n测试完成!")
    return 0

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code) 