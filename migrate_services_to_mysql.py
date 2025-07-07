#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
服务数据从JSON迁移到MySQL
此脚本将把服务数据从JSON文件迁移到MySQL数据库
"""

import json
import os
from datetime import datetime
from app import app
from models import db, Service, Provider

# JSON文件路径
SERVICES_FILE = 'data/services.json'
PROVIDERS_FILE = 'data/providers.json'

def load_json_data(file_path):
    """从JSON文件加载数据"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"读取 {file_path} 失败: {str(e)}")
        return []

def migrate_services():
    """将服务数据从JSON迁移到MySQL"""
    print("开始迁移服务数据...")
    
    # 加载JSON数据
    services_json = load_json_data(SERVICES_FILE)
    if not services_json:
        print("未找到服务数据或数据为空")
        return False
    
    print(f"从JSON加载了 {len(services_json)} 条服务记录")
    
    # 获取当前数据库中的服务ID列表
    existing_service_ids = [service.id for service in Service.query.all()]
    
    migrated_count = 0
    skipped_count = 0
    error_count = 0
    
    # 迁移服务数据
    for service_data in services_json:
        service_id = service_data.get('id')
        
        # 如果服务已存在，跳过
        if service_id in existing_service_ids:
            print(f"服务 {service_id} 已存在，跳过")
            skipped_count += 1
            continue
        
        try:
            # 将创建时间和更新时间从字符串转换为日期时间对象
            created_at = datetime.fromisoformat(service_data.get('created_at')) if service_data.get('created_at') else datetime.now()
            updated_at = datetime.fromisoformat(service_data.get('updated_at')) if service_data.get('updated_at') else datetime.now()
            
            # 创建新的服务记录
            new_service = Service(
                id=service_id,
                title=service_data.get('title', '未命名服务'),
                provider_id=service_data.get('provider_id'),
                price=float(service_data.get('price', 0)),
                price_unit=service_data.get('price_unit', '元/次'),
                duration=int(service_data.get('duration', 60)),
                rating=float(service_data.get('rating', 0)),
                reviews_count=int(service_data.get('reviews_count', 0)),
                image=service_data.get('image'),
                categories=json.dumps(service_data.get('categories', [])),
                description=service_data.get('description', ''),
                status=service_data.get('status', 'draft'),
                created_at=created_at,
                updated_at=updated_at
            )
            
            # 保存到数据库
            db.session.add(new_service)
            db.session.commit()
            
            print(f"成功迁移服务: {service_id} - {new_service.title}")
            migrated_count += 1
            
        except Exception as e:
            db.session.rollback()
            print(f"迁移服务 {service_id} 失败: {str(e)}")
            error_count += 1
    
    # 打印迁移结果
    print(f"\n迁移完成!")
    print(f"总记录数: {len(services_json)}")
    print(f"成功迁移: {migrated_count}")
    print(f"已存在跳过: {skipped_count}")
    print(f"迁移失败: {error_count}")
    
    return True

def check_provider_exists(provider_id):
    """检查提供商是否存在于数据库中"""
    return Provider.query.get(provider_id) is not None

def create_missing_providers():
    """为缺少的提供商创建记录"""
    print("检查并创建缺失的服务提供商...")
    
    # 加载服务和提供商数据
    services_json = load_json_data(SERVICES_FILE)
    providers_json = load_json_data(PROVIDERS_FILE)
    
    # 构建提供商映射表 {id: provider_data}
    providers_map = {p.get('id'): p for p in providers_json}
    
    # 获取所有服务使用的提供商ID
    provider_ids = set(s.get('provider_id') for s in services_json if s.get('provider_id'))
    
    # 检查每个提供商是否存在
    missing_count = 0
    created_count = 0
    
    for provider_id in provider_ids:
        if not check_provider_exists(provider_id):
            print(f"提供商 {provider_id} 不存在，尝试创建...")
            missing_count += 1
            
            # 从JSON数据中获取提供商信息
            provider_data = providers_map.get(provider_id)
            
            if provider_data:
                try:
                    # 创建新的提供商记录
                    new_provider = Provider(
                        id=provider_id,
                        username=provider_data.get('username', f'provider_{provider_id[:8]}'),
                        business_name=provider_data.get('business_name', ''),
                        business_description=provider_data.get('business_description', ''),
                        email=provider_data.get('email', f'provider_{provider_id[:8]}@example.com'),
                        password=provider_data.get('password', 'password123'),  # 安全起见，应该使用加密后的密码
                        rating=float(provider_data.get('rating', 0)),
                        verified=bool(provider_data.get('verified', False)),
                        created_at=datetime.now(),
                        updated_at=datetime.now()
                    )
                    
                    # 保存到数据库
                    db.session.add(new_provider)
                    db.session.commit()
                    
                    print(f"成功创建提供商: {provider_id}")
                    created_count += 1
                    
                except Exception as e:
                    db.session.rollback()
                    print(f"创建提供商 {provider_id} 失败: {str(e)}")
            else:
                print(f"无法找到提供商 {provider_id} 的数据")
    
    print(f"\n提供商检查完成!")
    print(f"缺少的提供商: {missing_count}")
    print(f"成功创建: {created_count}")
    
    return created_count > 0

if __name__ == '__main__':
    with app.app_context():
        # 确保必要的表存在
        db.create_all()
        
        # 检查并创建缺失的提供商
        create_missing_providers()
        
        # 迁移服务数据
        migrate_services()
        
        print("\n数据迁移完成!") 