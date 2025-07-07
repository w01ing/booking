#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
服务商账号设置数据库迁移脚本
此脚本用于更新服务商表结构，添加账号设置所需的新字段
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

def migrate_provider_settings():
    """更新服务商表以支持账号设置功能"""
    print(f"[{datetime.now()}] 开始迁移服务商表结构...")
    
    try:
        # 连接数据库
        connection = pymysql.connect(**DB_CONFIG)
        print(f"[{datetime.now()}] 数据库连接成功")
        
        with connection.cursor() as cursor:
            # 检查providers表是否存在
            cursor.execute("SHOW TABLES LIKE 'providers'")
            if not cursor.fetchone():
                print(f"[{datetime.now()}] 错误: providers表不存在")
                return False
            
            # 检查表中是否已有这些字段
            cursor.execute("DESCRIBE providers")
            existing_columns = [row['Field'] for row in cursor.fetchall()]
            
            # 需要添加的字段列表
            columns_to_add = []
            
            # 检查并添加nickname字段
            if 'nickname' not in existing_columns:
                columns_to_add.append("ADD COLUMN `nickname` VARCHAR(100) NULL AFTER `verified`")
            
            # 检查并添加gender字段
            if 'gender' not in existing_columns:
                columns_to_add.append("ADD COLUMN `gender` VARCHAR(10) NULL AFTER `nickname`")
            
            # 检查并添加bio字段
            if 'bio' not in existing_columns:
                columns_to_add.append("ADD COLUMN `bio` TEXT NULL AFTER `gender`")
            
            # 检查并添加avatar字段
            if 'avatar' not in existing_columns:
                columns_to_add.append("ADD COLUMN `avatar` VARCHAR(255) NULL AFTER `bio`")
            
            # 如果有需要添加的字段，执行ALTER TABLE语句
            if columns_to_add:
                alter_query = f"ALTER TABLE providers {', '.join(columns_to_add)}"
                print(f"[{datetime.now()}] 执行SQL: {alter_query}")
                cursor.execute(alter_query)
                connection.commit()
                print(f"[{datetime.now()}] 服务商表结构更新成功，添加了 {len(columns_to_add)} 个字段")
            else:
                print(f"[{datetime.now()}] 服务商表结构已经是最新的，无需更改")
            
            return True
    
    except Exception as e:
        print(f"[{datetime.now()}] 迁移失败: {str(e)}")
        return False
    
    finally:
        if 'connection' in locals() and connection:
            connection.close()
            print(f"[{datetime.now()}] 数据库连接已关闭")

def update_avatar_field():
    """更新服务商表中的avatar字段，将其值从文件路径更新为URL格式"""
    print(f"[{datetime.now()}] 开始更新服务商avatar字段...")
    
    try:
        # 连接数据库
        connection = pymysql.connect(**DB_CONFIG)
        print(f"[{datetime.now()}] 数据库连接成功")
        
        with connection.cursor() as cursor:
            # 查询所有服务商
            cursor.execute("SELECT id, avatar FROM providers WHERE avatar IS NOT NULL AND avatar != ''")
            providers = cursor.fetchall()
            
            updated_count = 0
            for provider in providers:
                provider_id = provider['id']
                avatar = provider['avatar']
                
                # 检查avatar是否需要更新为URL格式
                if avatar and not avatar.startswith(('http://', 'https://', '/')):
                    # 将路径转换为URL格式
                    new_avatar = f"/img/avatars/{avatar}" if not avatar.startswith('img/') else f"/{avatar}"
                    
                    # 更新数据库
                    cursor.execute(
                        "UPDATE providers SET avatar = %s WHERE id = %s",
                        (new_avatar, provider_id)
                    )
                    updated_count += 1
            
            connection.commit()
            print(f"[{datetime.now()}] 更新了 {updated_count} 个服务商的avatar字段")
            
            return True
    
    except Exception as e:
        print(f"[{datetime.now()}] 更新avatar字段失败: {str(e)}")
        return False
    
    finally:
        if 'connection' in locals() and connection:
            connection.close()
            print(f"[{datetime.now()}] 数据库连接已关闭")

if __name__ == "__main__":
    print(f"[{datetime.now()}] 开始执行服务商设置数据库迁移脚本")
    
    # 迁移服务商表结构
    if migrate_provider_settings():
        print(f"[{datetime.now()}] 服务商表结构迁移成功")
    else:
        print(f"[{datetime.now()}] 服务商表结构迁移失败")
        sys.exit(1)
    
    # 更新avatar字段
    if update_avatar_field():
        print(f"[{datetime.now()}] 服务商avatar字段更新成功")
    else:
        print(f"[{datetime.now()}] 服务商avatar字段更新失败")
    
    print(f"[{datetime.now()}] 服务商设置数据库迁移脚本执行完成") 