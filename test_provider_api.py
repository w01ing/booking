#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
提供商API接口测试脚本
专门测试/api/provider/<provider_id>/available-timeslots接口
"""

import requests
import json
import urllib.parse
from datetime import datetime, timedelta

# 服务器地址
BASE_URL = "http://localhost:5000"

def test_provider_timeslots(provider_id, date):
    """测试提供商可用时间段接口"""
    # URL编码provider_id
    encoded_provider_id = urllib.parse.quote(provider_id)
    url = f"{BASE_URL}/api/provider/{encoded_provider_id}/available-timeslots?date={date}"
    
    print(f"\n测试提供商 {provider_id} 在 {date} 的可用时间段")
    print(f"URL: {url}")
    
    try:
        response = requests.get(url, timeout=5)
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            response_json = response.json()
            print(f"响应内容: {json.dumps(response_json, ensure_ascii=False, indent=2)}")
            print("测试通过 ✓")
            return True
        else:
            print(f"测试失败 ✗ - 状态码 {response.status_code}")
            try:
                print(f"错误信息: {response.json()}")
            except:
                print(f"响应内容: {response.text[:200]}...")
            return False
            
    except Exception as e:
        print(f"测试异常: {str(e)}")
        return False

def main():
    """运行测试"""
    print("开始测试提供商API接口...")
    
    # 测试不同的provider_id
    provider_ids = [
        "prov1",
        "prov2", 
        "prov3",
        "8a05a2bf-282e-44d6-a093-7bc55d84394e",
        "provider with spaces"
    ]
    
    # 测试日期
    today = datetime.now().date().strftime("%Y-%m-%d")
    tomorrow = (datetime.now().date() + timedelta(days=1)).strftime("%Y-%m-%d")
    specific_date = "2025-07-05"
    
    success_count = 0
    total_tests = len(provider_ids) * 3  # 每个提供商测试3个日期
    
    # 测试每个提供商ID和日期组合
    for provider_id in provider_ids:
        for date in [today, tomorrow, specific_date]:
            if test_provider_timeslots(provider_id, date):
                success_count += 1
    
    # 打印测试结果摘要
    print("\n测试结果摘要:")
    print(f"总测试数: {total_tests}")
    print(f"通过: {success_count}")
    print(f"失败: {total_tests - success_count}")
    
    if success_count == total_tests:
        print("\n所有测试通过!")
        return 0
    else:
        print("\n有测试失败，请检查日志!")
        return 1

if __name__ == "__main__":
    exit_code = main()
    print(f"\n测试完成，退出代码: {exit_code}") 