#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
服务商营业执照号数据库迁移脚本
此脚本用于更新服务商表结构，添加营业执照号字段
"""

import pymysql
import pymysql.cursors
import sys
from datetime import datetime

# 数据库连接配置
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '123456',
    'db': 'service_booking',
    'charset': 'utf8mb4',
    'cursorclass': pymysql.cursors.DictCursor
}

def migrate_provider_license():
    """更新服务商表以添加营业执照号字段"""
    print(f"[{datetime.now()}] 开始迁移服务商表结构...")
    
    try:
        # 连接数据库
        connection = pymysql.connect(**DB_CONFIG)
        print(f"[{datetime.now()}] 数据库连接成功")
        
        with connection.cursor() as cursor:
            # 检查providers表是否存在
            cursor.execute("SHOW TABLES LIKE 'providers'")
            if not cursor.fetchone():
                print(f"[{datetime.now()}] 错误：providers表不存在")
                return False
            
            # 检查license_no字段是否已存在
            cursor.execute("SHOW COLUMNS FROM providers LIKE 'license_no'")
            if cursor.fetchone():
                print(f"[{datetime.now()}] license_no字段已存在，无需迁移")
                return True
            
            # 添加license_no字段
            print(f"[{datetime.now()}] 添加license_no字段...")
            cursor.execute("ALTER TABLE providers ADD COLUMN license_no VARCHAR(50) DEFAULT NULL COMMENT '营业执照号'")
            connection.commit()
            print(f"[{datetime.now()}] license_no字段添加成功")
            
            return True
    
    except pymysql.MySQLError as e:
        print(f"[{datetime.now()}] 数据库错误：{e}")
        return False
    
    except Exception as e:
        print(f"[{datetime.now()}] 未知错误：{e}")
        return False
    
    finally:
        if 'connection' in locals() and connection:
            connection.close()
            print(f"[{datetime.now()}] 数据库连接已关闭")

if __name__ == "__main__":
    print(f"[{datetime.now()}] 开始执行服务商营业执照号迁移脚本...")
    
    success = migrate_provider_license()
    
    if success:
        print(f"[{datetime.now()}] 迁移完成：服务商表结构已更新")
        sys.exit(0)
    else:
        print(f"[{datetime.now()}] 迁移失败：请检查错误信息")
        sys.exit(1) 