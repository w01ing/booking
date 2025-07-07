#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
应用程序启动脚本
在启动前检查端口占用情况，并自动终止占用端口的进程
"""

import os
import sys
import time
import socket
import subprocess
import signal
import platform

# 配置
PORT = 5000
APP_SCRIPT = "run.py"

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
            os.kill(pid, signal.SIGTERM)
        return True
    except Exception as e:
        print(f"终止进程 {pid} 失败: {e}")
        return False

def start_app():
    """启动应用程序"""
    # 检查端口是否被占用
    if check_port(PORT):
        print(f"端口 {PORT} 已被占用，尝试终止占用进程...")
        pid = find_process_by_port(PORT)
        if pid:
            print(f"找到占用端口的进程ID: {pid}")
            if kill_process(pid):
                print(f"已终止进程 {pid}")
                # 等待端口释放
                time.sleep(1)
            else:
                print(f"无法终止进程 {pid}，请手动关闭占用端口 {PORT} 的程序")
                return False
        else:
            print(f"无法找到占用端口 {PORT} 的进程，请手动关闭")
            return False
    
    # 再次检查端口是否已释放
    if check_port(PORT):
        print(f"端口 {PORT} 仍然被占用，无法启动应用程序")
        return False
    
    # 启动应用程序
    print(f"正在启动应用程序...")
    try:
        if platform.system() == "Windows":
            # 使用pythonw.exe在后台运行
            subprocess.Popen(['python', APP_SCRIPT])
        else:
            # 在Linux/Mac上使用nohup在后台运行
            subprocess.Popen(['nohup', 'python', APP_SCRIPT, '&'], stdout=open('app.log', 'a'), stderr=subprocess.STDOUT)
        
        # 等待应用程序启动
        time.sleep(2)
        
        # 检查应用程序是否成功启动
        if check_port(PORT):
            print(f"应用程序已成功启动，访问地址: http://localhost:{PORT}")
            return True
        else:
            print(f"应用程序启动失败，请检查日志")
            return False
    except Exception as e:
        print(f"启动应用程序时出错: {e}")
        return False

if __name__ == "__main__":
    print("=" * 50)
    print("应用程序启动工具")
    print("=" * 50)
    
    success = start_app()
    
    if success:
        print("\n应用程序已在后台运行")
        print(f"访问地址: http://localhost:{PORT}")
        print("要停止应用程序，请运行 stop_app.py 或手动终止进程")
    else:
        print("\n应用程序启动失败")
        sys.exit(1) 