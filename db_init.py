import os
import pymysql
from app import app
from models import db

def init_database():
    """初始化MySQL数据库"""
    print("开始初始化数据库...")
    
    # 连接MySQL服务器
    try:
        conn = pymysql.connect(
            host='localhost',
            user='root',
            password='123456'
        )
        cursor = conn.cursor()
        
        # 创建数据库
        cursor.execute("CREATE DATABASE IF NOT EXISTS service_booking")
        print("数据库 service_booking 创建成功")
        
        conn.close()
        print("MySQL连接关闭")
        
    except Exception as e:
        print(f"初始化数据库时出错: {e}")
        return False
    
    # 在Flask应用上下文中创建所有表
    with app.app_context():
        db.create_all()
        print("所有表创建成功")
    
    print("数据库初始化完成")
    return True

if __name__ == '__main__':
    init_database() 