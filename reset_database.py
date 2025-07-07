import pymysql
from app import app
from models import db

def reset_database():
    """重置数据库，删除所有表并重新创建"""
    print("开始重置数据库...")
    
    # 连接MySQL服务器
    try:
        conn = pymysql.connect(
            host='localhost',
            user='root',
            password='123456',
            database='service_booking'
        )
        cursor = conn.cursor()
        
        # 获取所有表名
        cursor.execute("SHOW TABLES")
        tables = cursor.fetchall()
        
        # 禁用外键约束
        cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
        
        # 删除所有表
        for table in tables:
            table_name = table[0]
            print(f"删除表: {table_name}")
            cursor.execute(f"DROP TABLE IF EXISTS `{table_name}`")
        
        # 启用外键约束
        cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
        
        conn.commit()
        conn.close()
        print("所有表已删除")
        
    except Exception as e:
        print(f"重置数据库时出错: {e}")
        return False
    
    # 在Flask应用上下文中重新创建所有表
    with app.app_context():
        db.create_all()
        print("所有表重新创建成功")
    
    print("数据库重置完成")
    return True

if __name__ == '__main__':
    reset_database() 