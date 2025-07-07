import app
import models
from datetime import datetime, timedelta

def check_provider_timeslots(provider_id=None):
    if provider_id:
        print(f"检查服务提供商 {provider_id} 的时间段数据...")
    else:
        print("检查所有服务提供商的时间段数据...")
    
    with app.app.app_context():
        # 查询提供商
        if provider_id:
            providers = [models.Provider.query.get(provider_id)]
            if not providers[0]:
                print(f"未找到ID为 {provider_id} 的服务提供商")
                return
        else:
            providers = models.Provider.query.all()
            print(f"找到 {len(providers)} 个服务提供商")
        
        for provider in providers:
            print(f"\n服务提供商: {provider.username} (ID: {provider.id})")
            
            # 计算日期范围（当前周）
            today = datetime.now().date()
            start_of_week = today - timedelta(days=today.weekday())  # 周一
            end_of_week = start_of_week + timedelta(days=6)  # 周日
            
            print(f"查询日期范围: {start_of_week} 至 {end_of_week}")
            
            # 查询时间段
            timeslots = models.TimeSlot.query.filter_by(provider_id=provider.id).filter(
                models.TimeSlot.date >= start_of_week,
                models.TimeSlot.date <= end_of_week
            ).order_by(models.TimeSlot.date, models.TimeSlot.time).all()
            
            print(f"找到 {len(timeslots)} 个时间段")
            
            if not timeslots:
                # 查询所有时间段
                all_slots = models.TimeSlot.query.filter_by(provider_id=provider.id).count()
                if all_slots > 0:
                    print(f"注意: 该提供商在数据库中有 {all_slots} 个时间段，但不在当前周")
                continue
            
            # 按日期分组
            slots_by_date = {}
            for slot in timeslots:
                date_str = slot.date.isoformat()
                if date_str not in slots_by_date:
                    slots_by_date[date_str] = []
                slots_by_date[date_str].append(slot)
            
            # 显示每天的时间段
            for date_str in sorted(slots_by_date.keys()):
                slots = slots_by_date[date_str]
                print(f"\n  日期: {date_str} ({len(slots)} 个时间段)")
                for i, slot in enumerate(slots[:5]):  # 只显示前5个
                    status = "可用" if slot.is_available else "不可用"
                    print(f"    {i+1}. {slot.time} - {status}")
                
                if len(slots) > 5:
                    print(f"    ... 还有 {len(slots) - 5} 个时间段")

def list_all_timeslots():
    print("列出数据库中的所有时间段...")
    
    with app.app.app_context():
        # 获取所有时间段
        all_slots = models.TimeSlot.query.all()
        print(f"数据库中共有 {len(all_slots)} 个时间段")
        
        # 按提供商分组
        slots_by_provider = {}
        for slot in all_slots:
            if slot.provider_id not in slots_by_provider:
                slots_by_provider[slot.provider_id] = []
            slots_by_provider[slot.provider_id].append(slot)
        
        print(f"时间段分布在 {len(slots_by_provider)} 个服务提供商中")
        
        # 显示每个提供商的时间段数量
        for provider_id, slots in slots_by_provider.items():
            provider = models.Provider.query.get(provider_id)
            provider_name = provider.username if provider else "未知提供商"
            print(f"  {provider_name} (ID: {provider_id}): {len(slots)} 个时间段")

if __name__ == "__main__":
    # 列出所有时间段
    list_all_timeslots()
    
    # 检查所有服务提供商
    check_provider_timeslots()
    
    # 也可以检查特定服务提供商
    # check_provider_timeslots("prov1") 