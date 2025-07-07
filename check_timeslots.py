#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
检查时间段数据的脚本
"""

from app import app
from models import TimeSlot
import datetime

def main():
    """主函数"""
    print("正在检查时间段数据...")
    
    with app.app_context():
        # 检查总时间段数
        total_count = TimeSlot.query.count()
        print(f"时间段总数: {total_count}")
        
        # 检查特定提供商的时间段
        provider_id = 'prov1'
        provider_count = TimeSlot.query.filter_by(provider_id=provider_id).count()
        print(f"{provider_id}的时间段数: {provider_count}")
        
        # 显示示例时间段
        print("\n示例时间段:")
        sample_slots = TimeSlot.query.filter_by(provider_id=provider_id).limit(5).all()
        for slot in sample_slots:
            status = "可预约" if slot.is_available else "不可用"
            print(f"  {slot.date} {slot.time} - {status}")
        
        # 检查当前周的时间段
        today = datetime.date.today()
        start_of_week = today - datetime.timedelta(days=today.weekday())
        end_of_week = start_of_week + datetime.timedelta(days=6)
        
        print(f"\n当前周 ({start_of_week} 至 {end_of_week}) 的时间段:")
        current_week_slots = TimeSlot.query.filter(
            TimeSlot.provider_id == provider_id,
            TimeSlot.date >= start_of_week.strftime('%Y-%m-%d'),
            TimeSlot.date <= end_of_week.strftime('%Y-%m-%d')
        ).count()
        
        print(f"当前周的时间段数: {current_week_slots}")
        
        # 如果当前周没有时间段，可能需要创建
        if current_week_slots == 0:
            print("\n警告: 当前周没有时间段数据!")
            print("建议: 使用工作模式功能为当前周创建时间段")

if __name__ == "__main__":
    main() 