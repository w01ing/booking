import json
import os
from datetime import datetime
from models import db, User, Provider, Service, Booking, Review, Notification, TimeSlot, Address, Favorite
from app import app

# 数据文件路径
DATA_DIR = 'data'
USERS_FILE = os.path.join(DATA_DIR, 'users.json')
PROVIDERS_FILE = os.path.join(DATA_DIR, 'providers.json')
SERVICES_FILE = os.path.join(DATA_DIR, 'services.json')
BOOKINGS_FILE = os.path.join(DATA_DIR, 'bookings.json')
REVIEWS_FILE = os.path.join(DATA_DIR, 'reviews.json')
NOTIFICATIONS_FILE = os.path.join(DATA_DIR, 'notifications.json')
TIMESLOTS_FILE = os.path.join(DATA_DIR, 'timeslots.json')

def parse_date(date_str):
    """解析日期字符串为日期对象"""
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, '%Y-%m-%d').date()
    except:
        return None

def parse_datetime(datetime_str):
    """解析日期时间字符串为日期时间对象"""
    if not datetime_str:
        return None
    try:
        return datetime.fromisoformat(datetime_str)
    except:
        try:
            return datetime.strptime(datetime_str, '%Y-%m-%dT%H:%M:%S.%f')
        except:
            try:
                return datetime.strptime(datetime_str, '%Y-%m-%dT%H:%M:%S')
            except:
                try:
                    return datetime.strptime(datetime_str, '%Y-%m-%dT%H:%M:%SZ')
                except:
                    return None

def clean_data():
    """清理JSON数据中的ID冲突和无效引用"""
    print("开始清理数据...")
    
    # 读取所有数据
    try:
        with open(USERS_FILE, 'r', encoding='utf-8') as f:
            users_data = json.load(f)
        with open(PROVIDERS_FILE, 'r', encoding='utf-8') as f:
            providers_data = json.load(f)
        with open(SERVICES_FILE, 'r', encoding='utf-8') as f:
            services_data = json.load(f)
        with open(BOOKINGS_FILE, 'r', encoding='utf-8') as f:
            bookings_data = json.load(f)
        with open(REVIEWS_FILE, 'r', encoding='utf-8') as f:
            reviews_data = json.load(f)
    except Exception as e:
        print(f"读取数据失败: {e}")
        return False
    
    # 收集所有有效的ID
    user_ids = {user.get('id') for user in users_data}
    provider_ids = {provider.get('id') for provider in providers_data}
    service_ids = {service.get('id') for service in services_data}
    
    # 清理预约数据中的无效引用
    cleaned_bookings = []
    for booking in bookings_data:
        user_id = booking.get('user_id')
        provider_id = booking.get('provider_id')
        service_id = booking.get('service_id')
        
        if user_id in user_ids and provider_id in provider_ids and service_id in service_ids:
            cleaned_bookings.append(booking)
        else:
            print(f"移除无效预约: ID={booking.get('id')}, 用户={user_id}, 服务商={provider_id}, 服务={service_id}")
    
    # 清理评论数据中的无效引用
    cleaned_reviews = []
    for review in reviews_data:
        user_id = review.get('user_id')
        provider_id = review.get('provider_id')
        service_id = review.get('service_id')
        
        if user_id in user_ids and provider_id in provider_ids and service_id in service_ids:
            # 处理回复字段
            reply = review.get('reply')
            if isinstance(reply, dict):
                review['reply_content'] = reply.get('content', '')
                review['reply_at'] = reply.get('date')
                del review['reply']
            
            cleaned_reviews.append(review)
        else:
            print(f"移除无效评论: ID={review.get('id')}, 用户={user_id}, 服务商={provider_id}, 服务={service_id}")
    
    # 清理用户收藏中的无效引用
    for user in users_data:
        favorites = user.get('favorites', [])
        if favorites:
            valid_favorites = [sid for sid in favorites if sid in service_ids]
            if len(valid_favorites) != len(favorites):
                print(f"用户 {user.get('id')} 的收藏列表中有无效引用，已清理")
                user['favorites'] = valid_favorites
    
    # 保存清理后的数据
    try:
        with open(BOOKINGS_FILE, 'w', encoding='utf-8') as f:
            json.dump(cleaned_bookings, f, ensure_ascii=False, indent=2)
        with open(REVIEWS_FILE, 'w', encoding='utf-8') as f:
            json.dump(cleaned_reviews, f, ensure_ascii=False, indent=2)
        with open(USERS_FILE, 'w', encoding='utf-8') as f:
            json.dump(users_data, f, ensure_ascii=False, indent=2)
        
        print("数据清理完成！")
        return True
    except Exception as e:
        print(f"保存清理后的数据失败: {e}")
        return False

def migrate_users():
    """迁移用户数据"""
    print("开始迁移用户数据...")
    try:
        with open(USERS_FILE, 'r', encoding='utf-8') as f:
            users_data = json.load(f)
    except Exception as e:
        print(f"读取用户数据失败: {e}")
        return
    
    for user_data in users_data:
        user = User(
            id=user_data.get('id'),
            username=user_data.get('username'),
            nickname=user_data.get('nickname'),
            email=user_data.get('email'),
            password=user_data.get('password'),
            phone=user_data.get('phone'),
            gender=user_data.get('gender'),
            birthday=parse_date(user_data.get('birthday')),
            bio=user_data.get('bio'),
            avatar=user_data.get('avatar'),
            notification_settings=json.dumps(user_data.get('notification_settings', {})),
            privacy_settings=json.dumps(user_data.get('privacy_settings', {})),
            blacklist=json.dumps(user_data.get('blacklist', [])),
            created_at=parse_datetime(user_data.get('created_at')),
            updated_at=parse_datetime(user_data.get('updated_at'))
        )
        db.session.add(user)
        
        # 添加用户地址
        if 'addresses' in user_data and isinstance(user_data['addresses'], list):
            for addr_data in user_data['addresses']:
                address = Address(
                    id=addr_data.get('id'),
                    user_id=user_data.get('id'),
                    label=addr_data.get('label'),
                    address=addr_data.get('address'),
                    created_at=parse_datetime(addr_data.get('created_at'))
                )
                db.session.add(address)
    
    try:
        db.session.commit()
        print("用户数据迁移完成！")
    except Exception as e:
        db.session.rollback()
        print(f"迁移用户数据失败: {e}")

def migrate_providers():
    """迁移服务提供商数据"""
    print("开始迁移服务提供商数据...")
    try:
        with open(PROVIDERS_FILE, 'r', encoding='utf-8') as f:
            providers_data = json.load(f)
    except Exception as e:
        print(f"读取服务提供商数据失败: {e}")
        return
    
    for provider_data in providers_data:
        provider = Provider(
            id=provider_data.get('id'),
            username=provider_data.get('username'),
            business_name=provider_data.get('business_name'),
            business_description=provider_data.get('business_description'),
            email=provider_data.get('email'),
            password=provider_data.get('password'),
            rating=provider_data.get('rating', 0),
            verified=provider_data.get('verified', False),
            created_at=parse_datetime(provider_data.get('created_at')),
            updated_at=parse_datetime(provider_data.get('updated_at'))
        )
        db.session.add(provider)
    
    try:
        db.session.commit()
        print("服务提供商数据迁移完成！")
    except Exception as e:
        db.session.rollback()
        print(f"迁移服务提供商数据失败: {e}")

def migrate_services():
    """迁移服务数据"""
    print("开始迁移服务数据...")
    try:
        with open(SERVICES_FILE, 'r', encoding='utf-8') as f:
            services_data = json.load(f)
    except Exception as e:
        print(f"读取服务数据失败: {e}")
        return
    
    # 获取所有有效的服务商ID
    providers = Provider.query.all()
    valid_provider_ids = {provider.id for provider in providers}
    
    for service_data in services_data:
        provider_id = service_data.get('provider_id')
        
        # 跳过无效的服务商ID
        if provider_id not in valid_provider_ids:
            print(f"警告: 服务 {service_data.get('id')} 引用了不存在的服务商 {provider_id}，跳过")
            continue
            
        service = Service(
            id=service_data.get('id'),
            title=service_data.get('title'),
            provider_id=provider_id,
            price=service_data.get('price', 0),
            price_unit=service_data.get('price_unit', '次'),
            duration=service_data.get('duration', 0),
            rating=service_data.get('rating', 0),
            reviews_count=service_data.get('reviews_count', 0),
            image=service_data.get('image'),
            categories=json.dumps(service_data.get('categories', [])),
            description=service_data.get('description'),
            status=service_data.get('status', 'draft'),
            created_at=parse_datetime(service_data.get('created_at')),
            updated_at=parse_datetime(service_data.get('updated_at'))
        )
        db.session.add(service)
    
    try:
        db.session.commit()
        print("服务数据迁移完成！")
    except Exception as e:
        db.session.rollback()
        print(f"迁移服务数据失败: {e}")

def migrate_bookings():
    """迁移预约数据"""
    print("开始迁移预约数据...")
    try:
        with open(BOOKINGS_FILE, 'r', encoding='utf-8') as f:
            bookings_data = json.load(f)
    except Exception as e:
        print(f"读取预约数据失败: {e}")
        return
    
    for booking_data in bookings_data:
        booking = Booking(
            id=booking_data.get('id'),
            user_id=booking_data.get('user_id'),
            provider_id=booking_data.get('provider_id'),
            service_id=booking_data.get('service_id'),
            date=parse_date(booking_data.get('date')),
            time=booking_data.get('time'),
            status=booking_data.get('status', 'pending'),
            review_needed=booking_data.get('review_needed', False),
            created_at=parse_datetime(booking_data.get('created_at')),
            updated_at=parse_datetime(booking_data.get('updated_at'))
        )
        db.session.add(booking)
    
    try:
        db.session.commit()
        print("预约数据迁移完成！")
    except Exception as e:
        db.session.rollback()
        print(f"迁移预约数据失败: {e}")

def migrate_reviews():
    """迁移评论数据"""
    print("开始迁移评论数据...")
    try:
        with open(REVIEWS_FILE, 'r', encoding='utf-8') as f:
            reviews_data = json.load(f)
    except Exception as e:
        print(f"读取评论数据失败: {e}")
        return
    
    for review_data in reviews_data:
        # 处理回复数据
        reply_content = review_data.get('reply_content', '')
        reply_at = parse_datetime(review_data.get('reply_at'))
        
        review = Review(
            id=review_data.get('id'),
            user_id=review_data.get('user_id'),
            provider_id=review_data.get('provider_id'),
            service_id=review_data.get('service_id'),
            booking_id=review_data.get('booking_id'),
            rating=review_data.get('rating', 0),
            content=review_data.get('content'),
            reply=reply_content,
            reply_at=reply_at,
            created_at=parse_datetime(review_data.get('created_at')),
            updated_at=parse_datetime(review_data.get('updated_at'))
        )
        db.session.add(review)
    
    try:
        db.session.commit()
        print("评论数据迁移完成！")
    except Exception as e:
        db.session.rollback()
        print(f"迁移评论数据失败: {e}")

def migrate_notifications():
    """迁移通知数据"""
    print("开始迁移通知数据...")
    try:
        with open(NOTIFICATIONS_FILE, 'r', encoding='utf-8') as f:
            notifications_data = json.load(f)
    except Exception as e:
        print(f"读取通知数据失败: {e}")
        return
    
    # 获取所有有效的用户ID
    users = User.query.all()
    valid_user_ids = {user.id for user in users}
    
    for notification_data in notifications_data:
        user_id = notification_data.get('user_id')
        
        # 跳过无效的用户ID
        if user_id not in valid_user_ids:
            print(f"警告: 通知 {notification_data.get('id')} 引用了不存在的用户 {user_id}，跳过")
            continue
            
        notification = Notification(
            id=notification_data.get('id'),
            user_id=user_id,
            type=notification_data.get('type'),
            subtype=notification_data.get('subtype'),
            title=notification_data.get('title'),
            content=notification_data.get('content'),
            is_read=notification_data.get('is_read', False),
            related_id=notification_data.get('related_id'),
            created_at=parse_datetime(notification_data.get('created_at')),
            updated_at=parse_datetime(notification_data.get('updated_at'))
        )
        db.session.add(notification)
    
    try:
        db.session.commit()
        print("通知数据迁移完成！")
    except Exception as e:
        db.session.rollback()
        print(f"迁移通知数据失败: {e}")

def migrate_timeslots():
    """迁移时间槽数据"""
    print("开始迁移时间槽数据...")
    try:
        with open(TIMESLOTS_FILE, 'r', encoding='utf-8') as f:
            timeslots_data = json.load(f)
    except Exception as e:
        print(f"读取时间槽数据失败: {e}")
        return
    
    # 获取所有有效的服务商ID
    providers = Provider.query.all()
    valid_provider_ids = {provider.id for provider in providers}
    
    for timeslot_data in timeslots_data:
        provider_id = timeslot_data.get('provider_id')
        
        # 跳过无效的服务商ID
        if provider_id not in valid_provider_ids:
            print(f"警告: 时间槽 {timeslot_data.get('id')} 引用了不存在的服务商 {provider_id}，跳过")
            continue
            
        # 确保时间格式正确
        time_value = timeslot_data.get('time', '')
        if len(time_value) > 20:
            time_value = time_value[:20]
            print(f"警告: 时间槽 {timeslot_data.get('id')} 的时间值过长，已截断")
            
        timeslot = TimeSlot(
            id=timeslot_data.get('id'),
            provider_id=provider_id,
            date=parse_date(timeslot_data.get('date')),
            time=time_value,
            is_available=timeslot_data.get('is_available', True),
            created_at=parse_datetime(timeslot_data.get('created_at')),
            updated_at=parse_datetime(timeslot_data.get('updated_at'))
        )
        db.session.add(timeslot)
    
    try:
        db.session.commit()
        print("时间槽数据迁移完成！")
    except Exception as e:
        db.session.rollback()
        print(f"迁移时间槽数据失败: {e}")

def migrate_favorites():
    """迁移收藏数据"""
    print("开始迁移收藏数据...")
    
    # 遍历用户数据，处理favorites字段
    try:
        with open(USERS_FILE, 'r', encoding='utf-8') as f:
            users_data = json.load(f)
    except Exception as e:
        print(f"读取用户数据失败: {e}")
        return
    
    # 获取所有有效的用户ID和服务ID
    users = User.query.all()
    valid_user_ids = {user.id for user in users}
    
    services = Service.query.all()
    valid_service_ids = {service.id for service in services}
    
    for user_data in users_data:
        user_id = user_data.get('id')
        
        # 跳过无效的用户ID
        if user_id not in valid_user_ids:
            print(f"警告: 用户 {user_id} 不存在，跳过其收藏数据")
            continue
            
        favorites = user_data.get('favorites', [])
        
        for service_id in favorites:
            # 跳过无效的服务ID
            if service_id not in valid_service_ids:
                print(f"警告: 用户 {user_id} 收藏的服务 {service_id} 不存在，跳过")
                continue
                
            favorite = Favorite(
                user_id=user_id,
                service_id=service_id,
                created_at=datetime.now()
            )
            db.session.add(favorite)
    
    try:
        db.session.commit()
        print("收藏数据迁移完成！")
    except Exception as e:
        db.session.rollback()
        print(f"迁移收藏数据失败: {e}")

def run_migration():
    """运行所有迁移任务"""
    with app.app_context():
        print("开始数据迁移...")
        
        # 首先清理数据
        if not clean_data():
            print("数据清理失败，迁移终止")
            return
        
        # 创建所有表
        db.create_all()
        
        # 按照依赖顺序迁移数据
        migrate_users()
        migrate_providers()
        migrate_services()
        
        # 确保基本数据先成功迁移
        db.session.commit()
        
        # 迁移其他数据
        migrate_bookings()
        migrate_reviews()
        migrate_notifications()
        migrate_timeslots()
        migrate_favorites()
        
        print("所有数据迁移完成！")

if __name__ == '__main__':
    run_migration() 