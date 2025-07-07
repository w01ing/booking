#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import sys
import subprocess
import time
import argparse
import importlib.util

def import_module_from_file(module_name, file_path):
    """从文件导入模块"""
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    if spec is None:
        raise ImportError(f"无法从文件加载模块: {file_path}")
    module = importlib.util.module_from_spec(spec)
    if spec.loader is None:
        raise ImportError(f"无法获取模块加载器: {file_path}")
    spec.loader.exec_module(module)
    return module

def main():
    """主函数"""
    parser = argparse.ArgumentParser(description="API测试和报告生成工具")
    parser.add_argument("--skip-tests", action="store_true", help="跳过测试步骤，直接生成报告")
    parser.add_argument("--view", action="store_true", help="生成报告后在浏览器中查看")
    parser.add_argument("--log-file", default="api_test.log", help="日志文件路径")
    
    args = parser.parse_args()
    
    # 确保工作目录是脚本所在目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    # 步骤1: 运行API测试
    if not args.skip_tests:
        print("步骤1: 运行API测试...")
        print("注意: 此功能需要单独运行测试脚本")
        print("请先运行 'python test_api_groups.py --groups provider' 并将输出保存到日志文件")
    
    # 步骤2: 生成HTML报告
    print("\n步骤2: 生成HTML报告...")
    try:
        # 导入报告生成模块
        report_module = import_module_from_file("generate_api_test_report", "generate_api_test_report.py")
        report_module.main()
    except Exception as e:
        print(f"生成HTML报告时出错: {str(e)}")
    
    # 步骤3: 生成Markdown摘要
    print("\n步骤3: 生成Markdown摘要...")
    try:
        # 导入摘要生成模块
        summary_module = import_module_from_file("generate_api_summary", "generate_api_summary.py")
        summary_module.main()
    except Exception as e:
        print(f"生成Markdown摘要时出错: {str(e)}")
    
    # 步骤4: 查看报告
    if args.view:
        print("\n步骤4: 在浏览器中查看报告...")
        try:
            # 导入查看报告模块
            view_module = import_module_from_file("view_report", "view_report.py")
            view_module.open_report()
        except Exception as e:
            print(f"查看报告时出错: {str(e)}")
    
    print("\n所有步骤完成!")
    print("- HTML报告: api_test_report.html")
    print("- Markdown摘要: api_test_summary.md")
    
    return 0

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code) 