#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
应用程序停止脚本
停止在端口5000上运行的Flask应用程序
"""

import sys
import time
import socket
import subprocess
import platform

# 配置
PORT = 5000

def check_port(port):
    """检查端口是否被占用"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

def find_process_by_port(port):
    """根据端口号查找进程ID"""
    if platform.system() == "Windows":
        try:
            # 使用netstat查找占用端口的进程
            output = subprocess.check_output(f'netstat -ano | findstr :{port}', shell=True).decode()
            if output:
                lines = output.strip().split('\n')
                for line in lines:
                    if f':{port}' in line:
                        parts = line.strip().split()
                        if len(parts) >= 5:
                            return int(parts[-1])
        except subprocess.CalledProcessError:
            pass
    else:
        # Linux/Mac
        try:
            output = subprocess.check_output(f'lsof -i :{port} -t', shell=True).decode()
            if output:
                return int(output.strip())
        except subprocess.CalledProcessError:
            pass
    return None

def kill_process(pid):
    """终止进程"""
    try:
        if platform.system() == "Windows":
            subprocess.call(['taskkill', '/F', '/PID', str(pid)])
        else:
            subprocess.call(['kill', '-9', str(pid)])
        return True
    except Exception as e:
        print(f"终止进程 {pid} 失败: {e}")
        return False

def stop_app():
    """停止应用程序"""
    # 检查端口是否被占用
    if not check_port(PORT):
        print(f"端口 {PORT} 未被占用，应用程序可能未在运行")
        return True
    
    # 查找占用端口的进程
    pid = find_process_by_port(PORT)
    if not pid:
        print(f"无法找到占用端口 {PORT} 的进程，应用程序可能未在运行")
        return False
    
    # 终止进程
    print(f"找到占用端口 {PORT} 的进程ID: {pid}")
    if kill_process(pid):
        print(f"已终止进程 {pid}")
        
        # 等待端口释放
        time.sleep(1)
        
        # 检查端口是否已释放
        if check_port(PORT):
            print(f"端口 {PORT} 仍然被占用，可能有多个进程在使用")
            return False
        else:
            print(f"端口 {PORT} 已释放，应用程序已停止")
            return True
    else:
        print(f"无法终止进程 {pid}，请手动关闭")
        return False

if __name__ == "__main__":
    print("=" * 50)
    print("应用程序停止工具")
    print("=" * 50)
    
    success = stop_app()
    
    if success:
        print("\n应用程序已成功停止")
    else:
        print("\n应用程序停止失败")
        sys.exit(1) 