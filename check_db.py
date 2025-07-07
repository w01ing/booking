import app
import models
from datetime import datetime

def check_timeslots():
    print("检查时间段表...")
    with app.app.app_context():
        # 查询所有时间段
        slots = models.TimeSlot.query.all()
        print(f"时间段总数: {len(slots)}")
        
        if slots:
            print("示例数据:")
            for i, slot in enumerate(slots[:5]):  # 只显示前5条
                print(f"{i+1}. {slot.to_dict()}")
        else:
            print("没有找到时间段数据")
        
        # 检查表结构
        print("\n表结构:")
        for column in models.TimeSlot.__table__.columns:
            print(f"- {column.name}: {column.type}")

def create_test_timeslot():
    print("创建测试时间段...")
    with app.app.app_context():
        # 获取一个服务提供商
        provider = models.Provider.query.first()
        if not provider:
            print("未找到服务提供商，无法创建测试时间段")
            return
        
        # 创建测试时间段
        test_slot = models.TimeSlot(
            provider_id=provider.id,
            date=datetime.now().date(),
            time="10:00",
            is_available=True
        )
        
        try:
            models.db.session.add(test_slot)
            models.db.session.commit()
            print(f"成功创建测试时间段: {test_slot.to_dict()}")
        except Exception as e:
            models.db.session.rollback()
            print(f"创建测试时间段失败: {str(e)}")

if __name__ == "__main__":
    check_timeslots()
    create_test_timeslot()
    check_timeslots()  # 再次检查以验证创建是否成功 