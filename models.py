from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import uuid
import json

db = SQLAlchemy()

# 用户地址表
class Address(db.Model):
    __tablename__ = 'addresses'
    
    id = db.Column(db.String(36), primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    label = db.Column(db.String(50), nullable=False)
    address = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __init__(self, **kwargs):
        super(Address, self).__init__(**kwargs)
        if not self.id:
            self.id = str(uuid.uuid4())
    
    def to_dict(self):
        return {
            'id': self.id,
            'label': self.label,
            'address': self.address,
            'created_at': self.created_at.isoformat()
        }

# 用户表
class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.String(36), primary_key=True)
    username = db.Column(db.String(100), nullable=False)
    nickname = db.Column(db.String(100))
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20))
    gender = db.Column(db.String(10))
    birthday = db.Column(db.Date)
    bio = db.Column(db.Text)
    avatar = db.Column(db.String(255))
    notification_settings = db.Column(db.Text)  # 存储为JSON字符串
    privacy_settings = db.Column(db.Text)  # 存储为JSON字符串
    blacklist = db.Column(db.Text)  # 存储为JSON数组字符串
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关联关系
    addresses = db.relationship('Address', backref='user', lazy=True, cascade="all, delete-orphan")
    favorites = db.relationship('Favorite', backref='user', lazy=True, cascade="all, delete-orphan")
    bookings = db.relationship('Booking', backref='user', lazy=True, cascade="all, delete-orphan")
    reviews = db.relationship('Review', backref='user', lazy=True, cascade="all, delete-orphan")
    
    def __init__(self, **kwargs):
        super(User, self).__init__(**kwargs)
        if not self.id:
            self.id = str(uuid.uuid4())
        if not self.notification_settings:
            self.notification_settings = json.dumps({
                "types": {
                    "booking": {
                        "enabled": True,
                        "confirmation": True,
                        "reminder": True,
                        "cancellation": True
                    },
                    "review": {
                        "enabled": True,
                        "new": True,
                        "reply": True
                    },
                    "system": {
                        "enabled": True,
                        "maintenance": True,
                        "security": True,
                        "promotion": True
                    }
                }
            })
        if not self.privacy_settings:
            self.privacy_settings = json.dumps({
                "visibility": {
                    "profile": "public",
                    "bookings": "private",
                    "reviews": "public"
                }
            })
        if not self.blacklist:
            self.blacklist = json.dumps([])
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'nickname': self.nickname,
            'email': self.email,
            'phone': self.phone,
            'gender': self.gender,
            'birthday': self.birthday.isoformat() if self.birthday else None,
            'bio': self.bio,
            'avatar': self.avatar,
            'addresses': [address.to_dict() for address in self.addresses],
            'notification_settings': json.loads(self.notification_settings) if self.notification_settings else {},
            'privacy_settings': json.loads(self.privacy_settings) if self.privacy_settings else {},
            'blacklist': json.loads(self.blacklist) if self.blacklist else [],
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

# 服务提供商表
class Provider(db.Model):
    __tablename__ = 'providers'
    
    id = db.Column(db.String(36), primary_key=True)
    username = db.Column(db.String(100), nullable=False)
    business_name = db.Column(db.String(100))
    business_description = db.Column(db.Text)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    rating = db.Column(db.Float, default=0)
    verified = db.Column(db.Boolean, default=False)
    # 个人信息字段
    nickname = db.Column(db.String(100))
    gender = db.Column(db.String(10))
    bio = db.Column(db.Text)
    avatar = db.Column(db.String(255))
    # 新增商家信息字段
    province = db.Column(db.String(50))
    city = db.Column(db.String(50))
    district = db.Column(db.String(50))
    detail_address = db.Column(db.String(255))
    open_time = db.Column(db.String(5), default="08:00")
    close_time = db.Column(db.String(5), default="21:00")
    holiday_desc = db.Column(db.String(255))
    phone = db.Column(db.String(20))
    service_phone = db.Column(db.String(20))
    business_type = db.Column(db.String(50))
    license_no = db.Column(db.String(50))  # 营业执照号
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关联关系
    services = db.relationship('Service', backref='provider', lazy=True, cascade="all, delete-orphan")
    
    def __init__(self, **kwargs):
        super(Provider, self).__init__(**kwargs)
        if not self.id:
            self.id = str(uuid.uuid4())
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'nickname': self.nickname,
            'gender': self.gender,
            'bio': self.bio,
            'avatar': self.avatar,
            'business_name': self.business_name,
            'business_description': self.business_description,
            'email': self.email,
            'rating': self.rating,
            'verified': self.verified,
            # 新增商家信息字段
            'province': self.province,
            'city': self.city,
            'district': self.district,
            'detail_address': self.detail_address,
            'open_time': self.open_time,
            'close_time': self.close_time,
            'holiday_desc': self.holiday_desc,
            'phone': self.phone,
            'service_phone': self.service_phone,
            'business_type': self.business_type,
            'license_no': self.license_no,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

# 收藏表
class Favorite(db.Model):
    __tablename__ = 'favorites'
    
    id = db.Column(db.String(36), primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    service_id = db.Column(db.String(36), db.ForeignKey('services.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __init__(self, **kwargs):
        super(Favorite, self).__init__(**kwargs)
        if not self.id:
            self.id = str(uuid.uuid4())

# 服务表
class Service(db.Model):
    __tablename__ = 'services'
    
    id = db.Column(db.String(36), primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    provider_id = db.Column(db.String(36), db.ForeignKey('providers.id'), nullable=False)
    price = db.Column(db.Float, nullable=False)
    price_unit = db.Column(db.String(20), nullable=False)
    duration = db.Column(db.Integer, nullable=False)  # 单位：分钟
    rating = db.Column(db.Float, default=0.0)
    reviews_count = db.Column(db.Integer, default=0)
    image = db.Column(db.String(255))
    categories = db.Column(db.Text)  # 存储为JSON数组字符串
    description = db.Column(db.Text)
    status = db.Column(db.String(20), default='draft')  # draft, active, inactive
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关联关系
    bookings = db.relationship('Booking', backref='service', lazy=True)
    reviews = db.relationship('Review', backref='service', lazy=True)
    
    def __init__(self, **kwargs):
        super(Service, self).__init__(**kwargs)
        if not self.id:
            self.id = str(uuid.uuid4())
        if not self.categories:
            self.categories = json.dumps([])
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'provider_id': self.provider_id,
            'provider': self.provider.to_dict() if self.provider else None,
            'price': self.price,
            'price_unit': self.price_unit,
            'duration': self.duration,
            'rating': self.rating,
            'reviews_count': self.reviews_count,
            'image': self.image,
            'categories': json.loads(self.categories) if self.categories else [],
            'description': self.description,
            'status': self.status,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

# 预约表
class Booking(db.Model):
    __tablename__ = 'bookings'
    
    id = db.Column(db.String(36), primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    provider_id = db.Column(db.String(36), db.ForeignKey('providers.id'), nullable=False)
    service_id = db.Column(db.String(36), db.ForeignKey('services.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    time = db.Column(db.String(5), nullable=False)  # 格式：HH:MM
    status = db.Column(db.String(20), default='pending')  # pending, confirmed, cancelled, completed
    review_needed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关联关系
    provider = db.relationship('Provider', backref=db.backref('bookings', lazy=True))
    
    def __init__(self, **kwargs):
        super(Booking, self).__init__(**kwargs)
        if not self.id:
            self.id = str(uuid.uuid4())
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'provider_id': self.provider_id,
            'service_id': self.service_id,
            'date': self.date.isoformat(),
            'time': self.time,
            'status': self.status,
            'review_needed': self.review_needed,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

# 评论表
class Review(db.Model):
    __tablename__ = 'reviews'
    
    id = db.Column(db.String(36), primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    provider_id = db.Column(db.String(36), db.ForeignKey('providers.id'), nullable=False)
    service_id = db.Column(db.String(36), db.ForeignKey('services.id'), nullable=False)
    booking_id = db.Column(db.String(36), db.ForeignKey('bookings.id'), nullable=False)
    rating = db.Column(db.Integer, nullable=False)
    content = db.Column(db.Text)
    reply = db.Column(db.Text)
    reply_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关联关系
    provider = db.relationship('Provider', backref=db.backref('reviews', lazy=True))
    booking = db.relationship('Booking', backref=db.backref('review', uselist=False))
    
    def __init__(self, **kwargs):
        super(Review, self).__init__(**kwargs)
        if not self.id:
            self.id = str(uuid.uuid4())
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'provider_id': self.provider_id,
            'service_id': self.service_id,
            'booking_id': self.booking_id,
            'rating': self.rating,
            'content': self.content,
            'reply': self.reply,
            'reply_at': self.reply_at.isoformat() if self.reply_at else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

# 通知表
class Notification(db.Model):
    __tablename__ = 'notifications'
    
    id = db.Column(db.String(36), primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    type = db.Column(db.String(50), nullable=False)  # booking, review, system
    subtype = db.Column(db.String(50))  # 如confirmation, reminder对应booking类型
    title = db.Column(db.String(100), nullable=False)
    content = db.Column(db.Text)
    is_read = db.Column(db.Boolean, default=False)
    related_id = db.Column(db.String(36))  # 相关的ID，如预约ID、评论ID等
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关联关系
    user = db.relationship('User', backref=db.backref('notifications', lazy=True))
    
    def __init__(self, **kwargs):
        super(Notification, self).__init__(**kwargs)
        if not self.id:
            self.id = str(uuid.uuid4())
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'type': self.type,
            'subtype': self.subtype,
            'title': self.title,
            'content': self.content,
            'is_read': self.is_read,
            'related_id': self.related_id,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

# 时间槽表
class TimeSlot(db.Model):
    __tablename__ = 'timeslots'
    
    id = db.Column(db.String(36), primary_key=True)
    provider_id = db.Column(db.String(36), db.ForeignKey('providers.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    time = db.Column(db.String(20), nullable=False)  # 格式：HH:MM 或 HH:MM-HH:MM
    is_available = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关联关系
    provider = db.relationship('Provider', backref=db.backref('timeslots', lazy=True))
    
    def __init__(self, **kwargs):
        super(TimeSlot, self).__init__(**kwargs)
        if not self.id:
            self.id = str(uuid.uuid4())
    
    def to_dict(self):
        return {
            'id': self.id,
            'provider_id': self.provider_id,
            'date': self.date.isoformat(),
            'time': self.time,
            'is_available': self.is_available,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        } 