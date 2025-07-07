from flask import Flask, request, jsonify, send_from_directory, make_response # type: ignore
import json
import os
import uuid
import hashlib
import threading
import jwt
from datetime import datetime, timedelta
import re
import time
import random
from functools import wraps
from werkzeug.utils import secure_filename
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import or_
from models import db, User, Provider, Service, Booking, Review, Notification, TimeSlot, Address, Favorite
import pymysql
import pymysql.cursors  # 添加明确的cursors导入
from flask_cors import CORS  # 导入CORS
import urllib.parse

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

# 添加CORS支持的辅助函数
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
    return response

# 服务器启动前的处理
@app.before_request
def handle_options_request():
    # 处理预检请求
    if request.method == 'OPTIONS':
        response = app.make_default_options_response()
        add_cors_headers(response)
        return response
    return None

@app.after_request
def add_cors_headers_to_response(response):
    # 为所有响应添加CORS头
    return add_cors_headers(response)

# 配置密钥
app.config['SECRET_KEY'] = 'your_secret_key_here'
app.config['JWT_EXPIRATION_DELTA'] = 24 * 60 * 60  # Token有效期24小时

# 配置数据库
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root:123456@localhost/service_booking'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# 文件路径定义
SERVICES_FILE = 'data/services.json'
PROVIDERS_FILE = 'data/providers.json'
BOOKINGS_FILE = 'data/bookings.json'
USERS_FILE = 'data/users.json'
NOTIFICATIONS_FILE = 'data/notifications.json'

# 防重复请求缓存
REQUEST_CACHE = {}
REQUEST_CACHE_TTL = 5  # 缓存过期时间，单位：秒

# 初始化数据库
db.init_app(app)

# 确保static/uploads目录存在
UPLOAD_FOLDER = 'static/uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# 辅助函数
def hash_password(password):
    """对密码进行哈希处理"""
    return hashlib.sha256(password.encode()).hexdigest()

def generate_token(user_id, user_type):
    """生成JWT令牌"""
    payload = {
        'user_id': user_id,
        'user_type': user_type,
        'exp': datetime.utcnow() + timedelta(seconds=app.config['JWT_EXPIRATION_DELTA'])
    }
    token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')
    # 某些版本的PyJWT返回bytes而不是字符串，确保返回字符串
    if isinstance(token, bytes):
        return token.decode('utf-8')
    return token

def verify_token(token):
    """验证JWT令牌"""
    try:
        print(f"开始验证令牌: {token[:10]}...")
        # 确保token是字符串类型
        if isinstance(token, bytes):
            token = token.decode('utf-8')
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        print(f"令牌验证成功: {payload}")
        return payload
    except Exception as e:
        print(f"令牌验证失败: {str(e)}")
        return None

# 请求防重复装饰器
def prevent_duplicate_requests(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        # 获取请求特征值
        request_method = request.method
        request_path = request.path
        auth_header = request.headers.get('Authorization', '')
        
        # 根据请求类型不同获取数据特征
        request_data = {}
        try:
            if request_method in ['POST', 'PUT'] and request.is_json:
                request_data = request.get_json() or {}
        except Exception as e:
            print(f"解析请求数据失败: {e}, 继续处理...")
        
        # 计算请求唯一标识
        data_str = json.dumps(request_data, sort_keys=True) if request_data else ""
        request_hash = hashlib.md5(f"{auth_header}:{request_path}:{request_method}:{data_str}".encode()).hexdigest()
        
        # 检查是否是重复请求
        now = time.time()
        if request_hash in REQUEST_CACHE:
            last_time, cached_response = REQUEST_CACHE[request_hash]
            if now - last_time < REQUEST_CACHE_TTL:
                print(f"检测到重复请求: {request_method} {request_path}")
                print(f"时间差: {now - last_time:.6f}秒，小于{REQUEST_CACHE_TTL}秒阈值")
                print(f"返回缓存响应")
                return cached_response
            else:
                print(f"请求哈希存在，但已过期: {now - last_time:.6f}秒 > {REQUEST_CACHE_TTL}秒")
        
        # 执行原始请求
        print(f"处理新请求: {request_method} {request_path}")
        response = func(*args, **kwargs)
        
        # 缓存响应
        REQUEST_CACHE[request_hash] = (now, response)
        
        # 清理过期缓存
        expired_keys = []
        for key, (timestamp, _) in REQUEST_CACHE.items():
            if now - timestamp > REQUEST_CACHE_TTL:
                expired_keys.append(key)
        
        for key in expired_keys:
            del REQUEST_CACHE[key]
            
        return response
    
    return wrapper

# API路由：服务管理接口
@app.route('/api/services/provider', methods=['GET'])
def get_provider_services():
    """获取当前服务商的所有服务（从MySQL数据库）"""
    print("API被调用: /api/services/provider")
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        print("缺少认证令牌")
        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
        print("令牌验证失败")
        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 确保是服务商
    if user_type != 'provider':
        print(f"用户类型错误: {user_type}")
        return jsonify({'message': '权限不足，仅服务商可访问此接口'}), 403
    
    try:
        # 从MySQL数据库获取服务列表
        print(f"正在为服务商 {user_id} 读取服务数据(MySQL)...")
        provider_services_db = Service.query.filter_by(provider_id=user_id).all()
        
        # 转换成字典列表
        provider_services = []
        for service in provider_services_db:
            # 获取该服务的预约数量
            booking_count = Booking.query.filter_by(service_id=service.id).count()
            
            # 构建服务数据
            service_data = service.to_dict()
            # 添加额外统计信息
            service_data['booking_count'] = booking_count
            # 浏览统计数可以从前端收集，这里先模拟一个数值
            service_data['view_count'] = booking_count * 5 + 50
            provider_services.append(service_data)
        
        print(f"从数据库读取到 {len(provider_services)} 个服务")
        return jsonify(provider_services)
    
    except Exception as e:
        print(f"获取服务数据失败: {str(e)}")
        return jsonify({'message': f'获取服务列表失败: {str(e)}'}), 500

@app.route('/api/services', methods=['POST'])
@prevent_duplicate_requests
def create_service():
    """创建新服务（MySQL版本）"""
    # 生成唯一请求ID和记录请求源信息，便于调试
    request_id = f"req-{datetime.now().strftime('%H%M%S')}-{random.randint(1000, 9999)}"
    user_agent = request.headers.get('User-Agent', 'Unknown')
    client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    
    print(f"[{request_id}] 创建服务请求开始, 来源: {client_ip}, 用户代理: {user_agent[:30]}...")
    
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        print(f"[{request_id}] 缺少认证令牌")
        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
        print(f"[{request_id}] 令牌验证失败")
        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 确保是服务商
    if user_type != 'provider':
        print(f"[{request_id}] 用户类型错误: {user_type}")
        return jsonify({'message': '权限不足，仅服务商可访问此接口'}), 403
    
    # 获取请求数据
    if not request.is_json:
        print(f"[{request_id}] 无效的请求格式，需要JSON")
        return jsonify({'message': '无效的请求格式，需要JSON数据'}), 400
    
    data = request.get_json()
    if not data:
        print(f"[{request_id}] 请求数据为空")
        return jsonify({'message': '无效的请求数据'}), 400
        
    print(f"[{request_id}] 接收到的数据: {json.dumps(data)[:200]}...")
    
    # 验证必填字段
    required_fields = ['title', 'price', 'duration', 'categories', 'description']
    for field in required_fields:
        if field not in data:
            print(f"[{request_id}] 缺少必填字段: {field}")
            return jsonify({'message': f'缺少必填字段: {field}'}), 400
    
    try:
        # 创建新服务记录
        new_service = Service(
            title=data['title'],
            provider_id=user_id,
            price=float(data['price']),
            price_unit=data.get('price_unit', '元/次'),
            duration=int(data['duration']),
            image=data.get('image', 'img/service-placeholder.jpg'),
            description=data['description'],
            status=data.get('status', 'draft'),
            categories=json.dumps(data.get('categories', []))
        )
        
        # 保存到数据库
        db.session.add(new_service)
        db.session.commit()
        
        print(f"[{request_id}] 服务创建成功: {new_service.id}")
        
        # 创建通知 - 使用直接SQL插入而不是ORM，避免外键约束问题
        try:
            # 获取数据库连接参数
            db_uri = app.config['SQLALCHEMY_DATABASE_URI']
            # 解析URI获取连接信息
            db_info = db_uri.replace('mysql+pymysql://', '').split('/')
            db_credentials = db_info[0].split('@')
            db_user_pass = db_credentials[0].split(':')
            db_host = db_credentials[1]
            db_name = db_info[1]
            
            # 创建直接数据库连接
            connection = pymysql.connect(
                host=db_host,
                user=db_user_pass[0],
                password=db_user_pass[1],
                database=db_name,
                charset='utf8mb4',
                cursorclass=pymysql.cursors.DictCursor
            )
            cursor = connection.cursor()
            
            # 创建通知记录
            notification_id = str(uuid.uuid4())
            notification_query = """
            INSERT INTO notifications 
            (id, user_id, type, subtype, title, content, is_read, related_id, created_at, updated_at) 
            VALUES 
            (%s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
            """
            
            # 检查provider_id是否存在于users表中
            check_query = "SELECT id FROM users WHERE id = %s"
            cursor.execute(check_query, (user_id,))
            user_exists = cursor.fetchone()
            
            if user_exists:
                # 如果用户ID存在于users表中，则创建通知
                cursor.execute(notification_query, (
                    notification_id,
                    user_id,
                    "service",
                    "created",
                    "服务创建成功",
                    f"您的服务「{new_service.title}」已创建成功，当前状态为：{'已上线' if new_service.status == 'active' else '草稿'}。",
                    False,
                    new_service.id
                ))
                connection.commit()
                print(f"[{request_id}] 创建服务通知成功")
            else:
                # 如果用户ID不存在于users表中，则跳过通知创建
                print(f"[{request_id}] 跳过通知创建：提供商ID不在users表中")
                
            cursor.close()
            connection.close()
            
        except Exception as e:
            print(f"[{request_id}] 创建服务通知失败: {str(e)}")
            # 不影响主流程
        
        # 返回创建的服务
        return jsonify({
            'message': '服务创建成功',
            'service': new_service.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"[{request_id}] 服务创建失败: {str(e)}")
        return jsonify({'message': f'服务创建失败: {str(e)}'}), 500

@app.route('/api/services/<service_id>/status', methods=['PUT'])
@prevent_duplicate_requests
def update_service_status(service_id):
    """更新服务状态（发布、下线）- MySQL直接查询版本"""
    print(f"API被调用: /api/services/{service_id}/status PUT")
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        print("缺少认证令牌")
        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
        print("令牌验证失败")
        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 确保是服务商
    if user_type != 'provider':
        print(f"用户类型错误: {user_type}")
        return jsonify({'message': '权限不足，仅服务商可更新服务状态'}), 403
    
    # 获取请求数据
    data = request.get_json()
    if not data:
        print("请求数据为空")
        return jsonify({'message': '无效的请求数据'}), 400
        
    status = data.get('status')
    
    # 验证状态值
    if status not in ['active', 'inactive', 'draft']:
        print(f"无效的状态值: {status}")
        return jsonify({'message': '无效的状态值，必须是active、inactive或draft之一'}), 400
    
    # 使用原生SQL操作而不依赖SQLAlchemy ORM
    connection = None
    cursor = None
    try:
        # 获取数据库连接参数
        db_uri = app.config['SQLALCHEMY_DATABASE_URI']
        # 解析URI获取连接信息
        db_info = db_uri.replace('mysql+pymysql://', '').split('/')
        db_credentials = db_info[0].split('@')
        db_user_pass = db_credentials[0].split(':')
        db_host = db_credentials[1]
        db_name = db_info[1]
        
        # 创建直接数据库连接
        connection = pymysql.connect(
            host=db_host,
            user=db_user_pass[0],
            password=db_user_pass[1],
            database=db_name,
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor
        )
        cursor = connection.cursor()
        
        # 1. 先检查服务是否存在
        check_query = "SELECT id, provider_id, title, status FROM services WHERE id = %s"
        cursor.execute(check_query, (service_id,))
        service_data = cursor.fetchone()
        
        if not service_data:
            print(f"服务不存在: {service_id}")
            return jsonify({'message': '服务不存在'}), 404
        
        # 2. 检查权限 - 使用字典键访问
        provider_id_from_db = service_data.get('provider_id')
        if provider_id_from_db != user_id:
            print(f"无权修改其他服务商的服务: {service_id}")
            return jsonify({'message': '无权修改其他服务商的服务'}), 403
        
        # 记录原始状态
        current_status = service_data.get('status')
        service_title = service_data.get('title', '未知服务')
        
        # 3. 更新服务状态
        update_query = "UPDATE services SET status = %s, updated_at = NOW() WHERE id = %s"
        cursor.execute(update_query, (status, service_id))
        connection.commit()
        
        # 4. 创建通知（如果状态改变）
        if current_status != status:
            status_text = '上线' if status == 'active' else '下线' if status == 'inactive' else '草稿'
            notification_id = str(uuid.uuid4())
            notification_query = """
            INSERT INTO notifications 
            (id, user_id, type, subtype, title, content, is_read, related_id, created_at, updated_at) 
            VALUES 
            (%s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
            """
            try:
                cursor.execute(notification_query, (
                    notification_id,
                    user_id,
                    'service',
                    'status_change',
                    f'服务{status_text}通知',
                    f'您的服务「{service_title}」已{status_text}',
                    False,
                    service_id
                ))
                connection.commit()
                print(f"创建状态变更通知成功")
            except Exception as e:
                print(f"创建状态变更通知失败（非阻断性错误）: {str(e)}")
                # 通知创建失败不影响主流程
        
        # 5. 获取更新后的完整服务数据
        query = "SELECT * FROM services WHERE id = %s"
        cursor.execute(query, (service_id,))
        service = cursor.fetchone()
        
        # 将日期时间对象转为字符串
        for key, value in service.items():
            if isinstance(value, datetime):
                service[key] = value.isoformat()
        
        status_text = '上线' if status == 'active' else '下线' if status == 'inactive' else '草稿'
        print(f"服务状态更新成功: {current_status} -> {status}")
        
        return jsonify({
            'message': f'服务已成功{status_text}',
            'service': service
                        }), 200
    
    except Exception as e:
        if connection:
            connection.rollback()
        print(f"更新服务状态失败: {str(e)}")
        return jsonify({'message': f'更新服务状态失败: {str(e)}'}), 500
    
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route('/api/services/<service_id>/update_status', methods=['PUT'])
def alternative_update_service_status(service_id):
    """替代方案：更新服务状态"""
    print(f"API被调用: /api/services/{service_id}/update_status PUT")
    return update_service_status(service_id)

@app.route('/api/services/<service_id>', methods=['DELETE'])
@prevent_duplicate_requests
def delete_service(service_id):
    """删除服务（MySQL版本）"""
    # 生成唯一请求ID
    request_id = f"req-{datetime.now().strftime('%H%M%S')}-{random.randint(1000, 9999)}"
    
    print(f"[{request_id}] API被调用: /api/services/{service_id} DELETE")
    
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        print(f"[{request_id}] 缺少认证令牌")
        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
        print(f"[{request_id}] 令牌验证失败")
        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 确保是服务商
    if user_type != 'provider':
        print(f"[{request_id}] 用户类型错误: {user_type}")
        return jsonify({'message': '权限不足，仅服务商可删除服务'}), 403
    
    try:
        # 从数据库查找服务
        service = Service.query.get(service_id)
        
        if not service:
            print(f"[{request_id}] 服务不存在: {service_id}")
            return jsonify({'message': '服务不存在'}), 404
        
        # 验证是否是此服务商的服务
        if service.provider_id != user_id:
            print(f"[{request_id}] 无权删除其他服务商的服务: {service_id}")
            return jsonify({'message': '无权删除其他服务商的服务'}), 403
        
        # 记录要删除的服务信息，用于后续通知
        service_title = service.title
        
        # 保存服务信息以便返回
        service_dict = service.to_dict()
        
        # 先删除与服务相关的收藏记录
        favorites = Favorite.query.filter_by(service_id=service_id).all()
        for favorite in favorites:
            db.session.delete(favorite)
        
        # 先删除与服务相关的评论
        reviews = Review.query.filter_by(service_id=service_id).all()
        for review in reviews:
            db.session.delete(review)
        
        # 删除与服务相关的预约
        bookings = Booking.query.filter_by(service_id=service_id).all()
        for booking in bookings:
            db.session.delete(booking)
        
        # 删除服务
        db.session.delete(service)
        db.session.commit()
        
        print(f"[{request_id}] 服务从数据库中删除成功: {service_title}")
        
        # 创建通知 - 使用直接SQL插入而不是ORM，避免外键约束问题
        try:
            # 获取数据库连接参数
            db_uri = app.config['SQLALCHEMY_DATABASE_URI']
            # 解析URI获取连接信息
            db_info = db_uri.replace('mysql+pymysql://', '').split('/')
            db_credentials = db_info[0].split('@')
            db_user_pass = db_credentials[0].split(':')
            db_host = db_credentials[1]
            db_name = db_info[1]
            
            # 创建直接数据库连接
            connection = pymysql.connect(
                host=db_host,
                user=db_user_pass[0],
                password=db_user_pass[1],
                database=db_name,
                charset='utf8mb4',
                cursorclass=pymysql.cursors.DictCursor
            )
            cursor = connection.cursor()
            
            # 创建通知记录
            notification_id = str(uuid.uuid4())
            notification_query = """
            INSERT INTO notifications 
            (id, user_id, type, subtype, title, content, is_read, related_id, created_at, updated_at) 
            VALUES 
            (%s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
            """
            
            # 检查provider_id是否存在于users表中
            check_query = "SELECT id FROM users WHERE id = %s"
            cursor.execute(check_query, (user_id,))
            user_exists = cursor.fetchone()
            
            if user_exists:
                # 如果用户ID存在于users表中，则创建通知
                cursor.execute(notification_query, (
                    notification_id,
                    user_id,
                    "service_delete",
                    "deletion_success",
                    "服务删除通知",
                    f"您的服务「{service_title}」已成功删除。",
                    False,
                    service_id
                ))
                connection.commit()
                print(f"[{request_id}] 创建服务删除通知成功")
            else:
                # 如果用户ID不存在于users表中，则跳过通知创建
                print(f"[{request_id}] 跳过通知创建：提供商ID不在users表中")
                
            cursor.close()
            connection.close()
            
        except Exception as e:
            print(f"[{request_id}] 创建服务删除通知失败: {str(e)}")
            # 继续执行，不影响主流程
        
        print(f"[{request_id}] 服务删除处理完成")
        return jsonify({'message': '服务删除成功', 'service': service_dict}), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"[{request_id}] 服务删除失败: {str(e)}")
        return jsonify({'message': f'服务删除失败: {str(e)}'}), 500

# 辅助函数：为服务管理功能创建通知
def create_service_notification(user_id, title, message, type, subtype=None, sender_id=None, sender_type=None, data=None):
    """创建系统通知"""
    print(f"创建通知: {title} 给用户 {user_id}")
    # 读取通知数据
    try:
        with open(NOTIFICATIONS_FILE, 'r', encoding='utf-8') as f:
            notifications = json.load(f)
        print(f"读取通知数据，共 {len(notifications)} 条记录")
    except Exception as e:
        print(f"读取通知数据失败: {str(e)}")
        notifications = []
    
    # 创建新通知
    new_notification = {
        'id': str(uuid.uuid4()),
        'user_id': user_id,
        'sender_id': sender_id or 'system',
        'sender_type': sender_type or 'system',
        'type': type,
        'subtype': subtype,
        'title': title,
        'content': message,
        'data': data or {},
        'read': False,
        'created_at': datetime.now().isoformat()
    }
    
    notifications.append(new_notification)
    
    # 保存通知数据
    try:
        with open(NOTIFICATIONS_FILE, 'w', encoding='utf-8') as f:
            json.dump(notifications, f, ensure_ascii=False, indent=2)
        print(f"保存通知成功: ID = {new_notification['id']}")
    except Exception as e:
        print(f"保存通知数据失败: {str(e)}")
    
    return new_notification

# 路由：提供静态文件
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

# API路由：用户注册
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json or {}
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    user_type = data.get('userType')

    if not all([username, email, password, user_type]):
                        return jsonify({'message': '所有字段都是必填的'}), 400
    
    # 检查邮箱是否已被注册
    if user_type == 'user':
        existing_user = User.query.filter_by(email=email).first()
    else:
        existing_user = Provider.query.filter_by(email=email).first()
    
    if existing_user:
        return jsonify({'message': '该邮箱已被注册'}), 400
    
    # 创建新用户
    if user_type == 'user':
        new_user = User(
            username=username,
            email=email,
            password=hash_password(password),
            created_at=datetime.now()
        )
    else:  # 服务提供商
        new_user = Provider(
            username=username,
            email=email,
            password=hash_password(password),
            business_name='',
            business_description='',
            rating=0,
            verified=False,
            created_at=datetime.now()
        )
    
    try:
        db.session.add(new_user)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'注册失败: {str(e)}'}), 500
    
    return jsonify({'message': '注册成功', 'userId': new_user.id}), 201

# API路由：用户登录
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json or {}
    email = data.get('email')
    password = data.get('password')
    
    if not all([email, password]):
        return jsonify({'message': '邮箱和密码都是必填的'}), 400
    
    # 在用户和服务商表中查找匹配的用户
    user_found = False
    user_data = None
    user_type = None
    
    # 首先在用户表中查找
    user = User.query.filter_by(email=email).first()
    if user and user.password == hash_password(password):
        user_found = True
        user_data = user
        user_type = 'user'
    else:
        # 如果在用户表中未找到，则在服务商表中查找
        provider = Provider.query.filter_by(email=email).first()
        if provider and provider.password == hash_password(password):
            user_found = True
            user_data = provider
            user_type = 'provider'
    
    if not user_found or not user_data:
        return jsonify({'message': '邮箱或密码不正确'}), 401
    
    # 生成令牌
    token = generate_token(user_data.id, user_type)
    
    # 根据用户类型返回不同的重定向路径
    redirect_path = 'provider-dashboard.html' if user_type == 'provider' else 'dashboard.html'
    
    return jsonify({
        'message': '登录成功',
        'token': token,
        'userType': user_type,
        'userId': user_data.id,
        'username': user_data.username,
        'email': user_data.email,
        'redirect': redirect_path
                    }), 200

# API路由：获取用户信息
@app.route('/api/user', methods=['GET'])
def get_user_info():
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 根据用户类型获取用户信息
    if user_type == 'user':
        user = User.query.get(user_id)
        if not user:
            return jsonify({'message': '用户不存在'}), 404
        
        # 返回用户信息
        user_data = user.to_dict()
        # 添加头像URL字段，确保前端能正确显示头像
        if user.avatar:
            user_data['avatar_url'] = user.avatar
        else:
            user_data['avatar_url'] = '/img/avatar-placeholder.jpg'
        
        return jsonify({'user': user_data}), 200
    else:  # provider
        provider = Provider.query.get(user_id)
        if not provider:
            return jsonify({'message': '服务商不存在'}), 404
        
        # 返回服务商信息
        provider_data = provider.to_dict()
        # 添加头像URL字段，确保前端能正确显示头像
        if provider.avatar:
            provider_data['avatar_url'] = provider.avatar
        else:
            provider_data['avatar_url'] = '/img/avatar-placeholder.jpg'
        
            return jsonify({'user': provider_data}), 200

# API路由：更新用户信息
@app.route('/api/user', methods=['PUT'])
def update_user_info():
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 获取请求数据
    data = request.json or {}
    
    try:
        # 根据用户类型更新用户信息
        if user_type == 'user':
            user = User.query.get(user_id)
            if not user:
                return jsonify({'message': '用户不存在'}), 404
            
            # 如果要更新邮箱，先检查新邮箱是否已被使用
            if 'email' in data and data['email'] != user.email:
                # 检查新邮箱是否已被其他用户使用
                existing_user = User.query.filter(User.email == data['email'], User.id != user_id).first()
                if existing_user:
                    return jsonify({'message': '该邮箱已被其他用户使用'}), 400
                
                # 检查新邮箱是否已被服务商使用
                existing_provider = Provider.query.filter_by(email=data['email']).first()
                if existing_provider:
                    return jsonify({'message': '该邮箱已被服务商使用'}), 400
                
                # 更新邮箱
                user.email = data['email']
            
            # 更新用户信息
            if 'username' in data:
                user.username = data['username']
            if 'nickname' in data:
                user.nickname = data['nickname']
            if 'phone' in data:
                user.phone = data['phone']
            if 'gender' in data:
                user.gender = data['gender']
            if 'birthday' in data and data['birthday']:
                try:
                    user.birthday = datetime.strptime(str(data['birthday']), '%Y-%m-%d').date()
                except ValueError:
                                    return jsonify({'message': '生日格式不正确，应为YYYY-MM-DD'}), 400
            if 'bio' in data:
                user.bio = data['bio']
            if 'avatar' in data:
                user.avatar = data['avatar']
            if 'notification_settings' in data:
                user.notification_settings = json.dumps(data['notification_settings'])
            if 'privacy_settings' in data:
                user.privacy_settings = json.dumps(data['privacy_settings'])
            if 'blacklist' in data:
                user.blacklist = json.dumps(data['blacklist'])
            
            user.updated_at = datetime.now()
            
        else:  # provider
            provider = Provider.query.get(user_id)
            if not provider:
                return jsonify({'message': '服务商不存在'}), 404
            
            # 如果要更新邮箱，先检查新邮箱是否已被使用
            if 'email' in data and data['email'] != provider.email:
                # 检查新邮箱是否已被其他服务商使用
                existing_provider = Provider.query.filter(Provider.email == data['email'], Provider.id != user_id).first()
                if existing_provider:
                    return jsonify({'message': '该邮箱已被其他服务商使用'}), 400
                
                # 检查新邮箱是否已被用户使用
                existing_user = User.query.filter_by(email=data['email']).first()
                if existing_user:
                    return jsonify({'message': '该邮箱已被用户使用'}), 400
                
                # 更新邮箱
                provider.email = data['email']
            
            # 更新服务商信息
            if 'username' in data:
                provider.username = data['username']
            if 'nickname' in data:
                provider.nickname = data.get('nickname')
            if 'gender' in data:
                provider.gender = data.get('gender')
            if 'bio' in data:
                provider.bio = data.get('bio')
            if 'phone' in data:
                provider.phone = data.get('phone')
            if 'service_phone' in data:
                provider.service_phone = data.get('service_phone')
            if 'business_name' in data:
                provider.business_name = data['business_name']
            if 'business_description' in data:
                provider.business_description = data['business_description']
            
            provider.updated_at = datetime.now()
        
        # 保存更新
        db.session.commit()
        
        return jsonify({'message': '用户信息更新成功'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'更新失败: {str(e)}'}), 500

# API路由：更新用户密码
@app.route('/api/user/password', methods=['PUT'])
def update_user_password():
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 获取请求数据
    data = request.json or {}
    current_password = data.get('current_password')
    new_password = data.get('new_password')
    
    if not all([current_password, new_password]):
        return jsonify({'message': '当前密码和新密码都是必填的'}), 400
    
    try:
        # 根据用户类型验证当前密码并更新
        if user_type == 'user':
            user = User.query.get(user_id)
            if not user:
                return jsonify({'message': '用户不存在'}), 404
            
            # 验证当前密码
            if user.password != hash_password(current_password):
                return jsonify({'message': '当前密码不正确'}), 401
            
            # 更新密码
            user.password = hash_password(new_password)
            user.updated_at = datetime.now()
            
        else:  # provider
            provider = Provider.query.get(user_id)
            if not provider:
                return jsonify({'message': '服务商不存在'}), 404
            
            # 验证当前密码
            if provider.password != hash_password(current_password):
                return jsonify({'message': '当前密码不正确'}), 401
            
            # 更新密码
            provider.password = hash_password(new_password)
            provider.updated_at = datetime.now()
        
        # 保存更新
        db.session.commit()
        
        return jsonify({'message': '密码更新成功'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'更新密码失败: {str(e)}'}), 500

# API路由：获取用户预约列表
@app.route('/api/bookings', methods=['GET'])
def get_bookings():
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 获取参数，判断是否只获取已完成的预约
    completed_only = request.args.get('completed_only', 'false').lower() == 'true'
    
    # 根据用户类型查询预约
    if user_type == 'user':
        if completed_only:
            bookings = Booking.query.filter_by(user_id=user_id, status='completed').order_by(Booking.date, Booking.time).all()
        else:
            bookings = Booking.query.filter_by(user_id=user_id).all()
    else:  # provider
        if completed_only:
            bookings = Booking.query.filter_by(provider_id=user_id, status='completed').order_by(Booking.date, Booking.time).all()
        else:
            bookings = Booking.query.filter_by(provider_id=user_id).all()
    
    result = []
    for booking in bookings:
        booking_data = booking.to_dict()
        
        # 获取服务详情
        service = Service.query.get(booking.service_id)
        if service:
            booking_data['service'] = service.to_dict()
        
        # 获取用户和服务商详情
        if user_type == 'provider':
            user = User.query.get(booking.user_id)
            if user:
                booking_data['user'] = {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email
                }
        else:
            provider = Provider.query.get(booking.provider_id)
            if provider:
                booking_data['provider'] = {
                    'id': provider.id,
                    'username': provider.username,
                    'business_name': provider.business_name
                }
        
        # 检查是否已评价
        review = Review.query.filter_by(booking_id=booking.id).first()
        booking_data['has_reviewed'] = review is not None
        
        result.append(booking_data)
    
    return jsonify(result), 200

# API路由：获取仪表盘预约数据（待确认和即将到来的预约）
@app.route('/api/bookings/dashboard', methods=['GET'])
def get_dashboard_bookings():
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 根据用户类型查询所有相关预约（包括待确认、已确认和已完成的）
    if user_type == 'user':
        bookings = Booking.query.filter(
            Booking.user_id == user_id,
            Booking.status.in_(['pending', 'confirmed', 'completed'])
        ).order_by(Booking.date, Booking.time).all()
    else:  # provider
        bookings = Booking.query.filter(
            Booking.provider_id == user_id,
            Booking.status.in_(['pending', 'confirmed', 'completed'])
        ).order_by(Booking.date, Booking.time).all()
    
    result = []
    for booking in bookings:
        booking_data = booking.to_dict()
        
        # 获取服务详情
        service = Service.query.get(booking.service_id)
        if service:
            booking_data['service'] = service.to_dict()
        
        # 获取用户和服务商详情
        if user_type == 'provider':
            user = User.query.get(booking.user_id)
            if user:
                booking_data['user'] = {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'avatar': user.avatar
                }
        else:
            provider = Provider.query.get(booking.provider_id)
            if provider:
                booking_data['provider'] = {
                    'id': provider.id,
                    'username': provider.username,
                    'business_name': provider.business_name,
                    'verified': provider.verified
                }
        
        result.append(booking_data)
    
    # 将预约分类
    pending_bookings = []
    upcoming_bookings = []
    completed_bookings = []
    
    for booking in result:
        if booking['status'] == 'pending':
            pending_bookings.append(booking)
        elif booking['status'] == 'confirmed':
            upcoming_bookings.append(booking)
        elif booking['status'] == 'completed':
            completed_bookings.append(booking)
    
    return jsonify({
        'pending': pending_bookings,
        'upcoming': upcoming_bookings,
        'completed': completed_bookings
    }), 200

# API路由：创建预约
@app.route('/api/bookings', methods=['POST'])
def create_booking():
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    if user_type != 'user':
        return jsonify({'message': '只有用户才能创建预约'}), 403
    
    data = request.json or {}
    service_id = data.get('service_id')
    date = data.get('date')
    time = data.get('time')
    
    if not all([service_id, date, time]):
        return jsonify({'message': '服务ID、日期和时间都是必填的'}), 400
    
    # 获取服务信息
    service = Service.query.get(service_id)
    if not service:
        return jsonify({'message': '服务不存在'}), 404
    
    provider_id = service.provider_id
    
    # 创建新预约
    new_booking = Booking(
        user_id=user_id,
        provider_id=provider_id,
        service_id=service_id,
        date=datetime.strptime(date, '%Y-%m-%d').date(),
        time=time,
        status='pending',
        created_at=datetime.now()
    )
    
    db.session.add(new_booking)
    db.session.commit()
    
    return jsonify({
        'message': '预约创建成功',
        'booking': new_booking.to_dict()
    }), 201

# API路由：更新预约状态
@app.route('/api/bookings/<booking_id>', methods=['PUT'])
def update_booking(booking_id):
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'message': '缺少认证令牌'}), 401
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    # 验证令牌
    payload = verify_token(token)
    if not payload:
        return jsonify({'message': '无效或过期的令牌'}), 401
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 获取预约信息
    booking = Booking.query.get(booking_id)
    if not booking:
        return jsonify({'message': '预约不存在'}), 404
    
    # 验证用户权限
    if (user_type == 'user' and booking.user_id != user_id) or \
       (user_type == 'provider' and booking.provider_id != user_id):
        return jsonify({'message': '无权操作此预约'}), 403
    
    data = request.json or {}
    status = data.get('status')
    
    if not status:
        return jsonify({'message': '状态是必填的'}), 400
    
    # 记录原始状态，用于判断状态是否变更
    original_status = booking.status
    
    # 更新预约状态
    booking.status = status
    
    # 如果是完成状态，设置需要评价标记
    if status == 'completed':
        booking.review_needed = True
    
    booking.updated_at = datetime.now()
    
    try:
        db.session.commit()
        
        # 获取服务和提供商信息，用于通知内容
        service = Service.query.get(booking.service_id)
        provider = Provider.query.get(booking.provider_id)
        
        service_title = service.title if service else "预约服务"
        provider_name = provider.business_name if provider and provider.business_name else "服务提供商"
        
        # 根据状态变更发送不同的通知
        if original_status != status:
            # 当状态变为confirmed（已确认）时，发送确认通知
            if status == 'confirmed' and user_type == 'provider':
                # 创建用户通知
                confirmation_notification = Notification(
                    user_id=booking.user_id,
                    type='booking',
                    subtype='confirmation',
                    title='预约已确认',
                    content=f"您预约的 {service_title} 服务已被 {provider_name} 确认。预约时间：{booking.date.strftime('%Y-%m-%d')} {booking.time}",
                    related_id=booking.id,
                    created_at=datetime.now()
                )
                db.session.add(confirmation_notification)
                db.session.commit()
            
            # 当状态变为completed（已完成）时，发送完成通知
            elif status == 'completed' and user_type == 'provider':
                # 创建用户通知
                completion_notification = Notification(
                    user_id=booking.user_id,
                    type='booking',
                    subtype='completion',
                    title='预约已完成',
                    content=f"您与 {provider_name} 的 {service_title} 服务预约已完成。请对本次服务进行评价。",
                    related_id=booking.id,
                    created_at=datetime.now()
                )
                db.session.add(completion_notification)
                db.session.commit()
            
            # 当状态变为cancelled（已取消）时，发送取消通知
            elif status == 'cancelled':
                # 确定通知接收者（如果是用户取消，通知提供商；如果是提供商取消，通知用户）
                recipient_id = booking.provider_id if user_type == 'user' else booking.user_id
                
                # 创建通知
                cancellation_notification = Notification(
                    user_id=recipient_id,
                    type='booking',
                    subtype='cancellation',
                    title='预约已取消',
                    content=f"{service_title} 服务预约已被取消。原定时间：{booking.date.strftime('%Y-%m-%d') if booking.date else ''} {booking.time}",
                    related_id=booking.id,
                    created_at=datetime.now()
                )
                db.session.add(cancellation_notification)
                db.session.commit()
        
        return jsonify({
            'message': '预约状态更新成功',
            'booking': booking.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'更新预约失败: {str(e)}'}), 500

# API路由：获取用户收藏列表
@app.route('/api/favorites', methods=['GET'])
def get_favorites():
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    if user_type != 'user':
        return jsonify({'message': '只有用户才能查看收藏'}), 403
    
    # 获取用户收藏
    favorites = Favorite.query.filter_by(user_id=user_id).all()
    
    result = []
    for favorite in favorites:
        service = Service.query.get(favorite.service_id)
        if service:
            service_data = service.to_dict()
            result.append(service_data)
    
    return jsonify(result), 200

# API路由：添加收藏
@app.route('/api/favorites', methods=['POST'])
def add_favorite():
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    if user_type != 'user':
        return jsonify({'message': '只有用户才能添加收藏'}), 403
    
    data = request.json or {}
    service_id = data.get('service_id')
    
    if not service_id:
        return jsonify({'message': '服务ID是必填的'}), 400
    
    # 检查服务是否存在
    service = Service.query.get(service_id)
    if not service:
        return jsonify({'message': '服务不存在'}), 404
    
    # 检查是否已收藏
    existing_favorite = Favorite.query.filter_by(user_id=user_id, service_id=service_id).first()
    if existing_favorite:
        return jsonify({'message': '已经收藏过该服务'}), 400
    
    # 创建新收藏
    new_favorite = Favorite(
        user_id=user_id,
        service_id=service_id,
        created_at=datetime.now()
    )
    
    db.session.add(new_favorite)
    db.session.commit()
    
    return jsonify({
        'message': '收藏添加成功',
        'service': service.to_dict()
    }), 201

# API路由：删除收藏
@app.route('/api/favorites/<service_id>', methods=['DELETE'])
def remove_favorite(service_id):
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    if user_type != 'user':
        return jsonify({'message': '只有用户才能删除收藏'}), 403
    
    # 查找并删除收藏
    favorite = Favorite.query.filter_by(user_id=user_id, service_id=service_id).first()
    if not favorite:
        return jsonify({'message': '未找到该收藏'}), 404
    
    db.session.delete(favorite)
    db.session.commit()
    
    return jsonify({'message': '收藏删除成功'}), 200

# API路由：取消预约
@app.route('/api/bookings/<booking_id>', methods=['DELETE'])
def cancel_booking(booking_id):
    request_id = f"req-cancel-{datetime.now().strftime('%H%M%S')}-{random.randint(1000, 9999)}"
    print(f"[{request_id}] 开始处理取消预约请求: {booking_id}")
    
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        print(f"[{request_id}] 缺少认证令牌")
        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
        print(f"[{request_id}] 令牌验证失败")
        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    print(f"[{request_id}] 用户ID: {user_id}, 类型: {user_type}")
    
    try:
        # 开始数据库事务
        print(f"[{request_id}] 查询预约信息: {booking_id}")
        # 获取预约信息
        booking = Booking.query.get(booking_id)
        if not booking:
            print(f"[{request_id}] 预约不存在: {booking_id}")
            return jsonify({'message': '预约不存在'}), 404
        
        print(f"[{request_id}] 找到预约: {booking_id}, 状态: {booking.status}, 用户: {booking.user_id}, 服务商: {booking.provider_id}")
        
        # 验证用户权限
        if (user_type == 'user' and booking.user_id != user_id) or \
           (user_type == 'provider' and booking.provider_id != user_id):
            print(f"[{request_id}] 用户无权操作此预约: {user_id} 尝试取消预约 {booking_id}")
            return jsonify({'message': '无权操作此预约'}), 403
        
        # 检查预约状态是否可取消
        if booking.status in ['canceled', 'completed', 'no-show']:
            print(f"[{request_id}] 预约状态不允许取消: {booking.status}")
            return jsonify({'message': f'当前状态({booking.status})的预约无法取消'}), 400
            
        # 记录原始状态
        original_status = booking.status
        
        # 将预约状态改为已取消
        print(f"[{request_id}] 更新预约状态: {original_status} -> canceled")
        booking.status = 'canceled'
        booking.updated_at = datetime.now()
        
        try:
            db.session.commit()
            print(f"[{request_id}] 预约已成功取消")
            
            # 为用户和提供商创建取消通知
            try:
                # 获取服务和提供商信息，用于通知内容
                service = Service.query.get(booking.service_id)
                provider = Provider.query.get(booking.provider_id)
                
                service_title = service.title if service else "预约服务"
                provider_name = provider.business_name if provider and provider.business_name else "服务提供商"
                
                # 如果是用户取消，通知提供商
                if user_type == 'user':
                    cancellation_notification = Notification(
                        user_id=booking.provider_id,
                        type='booking',
                        subtype='cancellation',
                        title='预约已取消',
                        content=f"用户已取消 {service_title} 服务预约。原定时间：{booking.date.strftime('%Y-%m-%d') if booking.date else ''} {booking.time}",
                        related_id=booking.id,
                        created_at=datetime.now()
                    )
                    db.session.add(cancellation_notification)
                
                # 如果是提供商取消，通知用户
                else:
                    cancellation_notification = Notification(
                        user_id=booking.user_id,
                        type='booking',
                        subtype='cancellation',
                        title='预约已取消',
                        content=f"{provider_name} 已取消您的 {service_title} 服务预约。原定时间：{booking.date.strftime('%Y-%m-%d') if booking.date else ''} {booking.time}",
                        related_id=booking.id,
                        created_at=datetime.now()
                    )
                    db.session.add(cancellation_notification)
                
                db.session.commit()
                print(f"[{request_id}] 已创建取消通知")
            except Exception as e:
                print(f"[{request_id}] 创建取消通知失败，但不影响主流程: {str(e)}")
                db.session.rollback()
                # 通知创建失败不影响主流程，继续返回成功
            
            return jsonify({'message': '预约已取消', 'booking_id': booking_id}), 200
            
        except Exception as e:
            db.session.rollback()
            print(f"[{request_id}] 提交数据库事务失败: {str(e)}")
            return jsonify({'message': f'取消预约失败: {str(e)}'}), 500
            
    except Exception as e:
        print(f"[{request_id}] 取消预约过程中发生错误: {str(e)}")
        db.session.rollback()
        return jsonify({'message': f'取消预约失败: {str(e)}'}), 500

# API路由：获取所有服务
@app.route('/api/services', methods=['GET'])
def get_all_services():
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
        return jsonify({'message': '无效或过期的令牌'}), 401
    
    # 查询所有服务
    services = Service.query.all()
    
    # 转换为JSON格式
    result = []
    for service in services:
        service_data = service.to_dict()
        result.append(service_data)
    
    return jsonify(result), 200

# API路由：获取公开服务（无需认证）
@app.route('/api/services/public', methods=['GET'])
def get_public_services():
    # 获取查询参数
    query = request.args.get('query', '')
    category = request.args.get('category', '')
    sort_by = request.args.get('sort_by', '')
    limit = request.args.get('limit', 50, type=int)
    offset = request.args.get('offset', 0, type=int)
    
    # 查询活跃状态的服务
    services_query = Service.query.filter_by(status='active')
    
    # 如果有搜索关键词，进行模糊搜索
    if query:
        services_query = services_query.filter(
            db.or_(
                Service.title.ilike(f'%{query}%'),
                Service.description.ilike(f'%{query}%'),
                Service.categories.ilike(f'%{query}%')
            )
        )
    
    # 如果有分类筛选
    if category and category != '全部':
        services_query = services_query.filter(Service.categories.ilike(f'%{category}%'))
    
    # 排序
    if sort_by == 'price_asc':
        services_query = services_query.order_by(Service.price.asc())
    elif sort_by == 'price_desc':
        services_query = services_query.order_by(Service.price.desc())
    elif sort_by == 'rating':
        services_query = services_query.order_by(Service.rating.desc())
    else:
        # 默认按创建时间降序排序
        services_query = services_query.order_by(Service.created_at.desc())
    
    # 应用分页
    total_count = services_query.count()
    services = services_query.limit(limit).offset(offset).all()
    
    # 转换为JSON格式
    result = []
    for service in services:
        service_data = service.to_dict()
        
        # 获取服务提供商信息
        provider = Provider.query.get(service.provider_id)
        if provider:
            service_data['provider'] = provider.business_name or provider.username
        
        result.append(service_data)
    
    # 返回结果，包含分页信息
    return jsonify({
        'services': result,
        'total': total_count,
        'offset': offset,
        'limit': limit,
        'has_more': offset + len(result) < total_count
    }), 200

# API路由：获取单个服务详情（无需认证）
@app.route('/api/services/public/<service_id>', methods=['GET'])
def get_public_service_detail(service_id):
    # 查询服务
    service = Service.query.get(service_id)
    
    # 如果服务不存在，返回404
    if not service:
                        return jsonify({'message': '服务不存在'}), 404
    
    # 如果服务不是活跃状态，返回403
    if service.status != 'active':
                        return jsonify({'message': '该服务当前不可用'}), 403
    
    # 获取服务详情
    service_data = service.to_dict()
    
    # 获取服务提供商信息
    provider = Provider.query.get(service.provider_id)
    if provider:
        service_data['provider'] = {
            'id': provider.id,
            'username': provider.username,
            'business_name': provider.business_name,
            'business_description': provider.business_description,
            'rating': provider.rating,
            'verified': provider.verified
        }
    
    # 获取服务评论
    reviews = Review.query.filter_by(service_id=service_id).order_by(Review.created_at.desc()).limit(5).all()
    service_data['reviews'] = []
    
    for review in reviews:
        review_data = review.to_dict()

        # 获取用户信息
        user = User.query.get(review.user_id)
        if user:
            review_data['user'] = {
                'id': user.id,
                'username': user.username,
                'avatar': user.avatar
            }
        
        service_data['reviews'].append(review_data)
    
    # 获取可用时间槽
    current_date = datetime.now().date()
    timeslots = TimeSlot.query.filter(
        TimeSlot.provider_id == service.provider_id,
        TimeSlot.date >= current_date,
        TimeSlot.is_available == True
    ).order_by(TimeSlot.date, TimeSlot.time).limit(20).all()
    
    service_data['available_timeslots'] = [timeslot.to_dict() for timeslot in timeslots]
    
    return jsonify(service_data), 200

# API路由：获取所有服务提供商
@app.route('/api/providers', methods=['GET'])
def get_all_providers():
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
        return jsonify({'message': '无效或过期的令牌'}), 401
    
    # 查询所有服务提供商
    providers = Provider.query.all()
    
    # 转换为JSON格式
    result = []
    for provider in providers:
        provider_data = provider.to_dict()
        result.append(provider_data)
    
    return jsonify(result), 200

# API路由：获取单个预约详情
@app.route('/api/bookings/<booking_id>', methods=['GET'])
def get_booking_detail(booking_id):
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 获取预约信息
    booking = Booking.query.get(booking_id)
    if not booking:
        return jsonify({'message': '预约不存在'}), 404
    
    # 验证用户权限
    if (user_type == 'user' and booking.user_id != user_id) or \
       (user_type == 'provider' and booking.provider_id != user_id):
        return jsonify({'message': '无权查看此预约'}), 403
    
    # 获取预约详情
    booking_data = booking.to_dict()
    
    # 获取服务详情
    service = Service.query.get(booking.service_id)
    if service:
        booking_data['service'] = service.to_dict()
    
    # 获取服务提供商详情
    provider = Provider.query.get(booking.provider_id)
    if provider:
        booking_data['provider'] = {
            'id': provider.id,
            'username': provider.username,
            'business_name': provider.business_name,
            'rating': provider.rating,
            'verified': provider.verified
        }
    
    # 获取用户详情
    user = User.query.get(booking.user_id)
    if user:
        booking_data['user'] = {
            'id': user.id,
            'username': user.username,
            'avatar': user.avatar
        }
    
    return jsonify(booking_data), 200

# API路由：获取服务提供商的可用时间段
@app.route('/api/timeslots', methods=['GET'])
def get_timeslots():
    """获取服务提供商的时间段，支持按日期或按周查询"""
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 确保是服务提供商
    if user_type != 'provider':
        return jsonify({'message': '权限不足，仅服务提供商可访问此接口'}), 403
    
    # 获取查询参数
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    if not start_date or not end_date:
        return jsonify({'message': '开始日期和结束日期是必需的'}), 400
    
    try:
        # 解析日期字符串
        start_date_obj = datetime.strptime(start_date, '%Y-%m-%d').date()
        end_date_obj = datetime.strptime(end_date, '%Y-%m-%d').date()
        
        # 查询数据库中的时间段
        timeslots = TimeSlot.query.filter_by(provider_id=user_id).filter(
            TimeSlot.date >= start_date_obj,
            TimeSlot.date <= end_date_obj
        ).all()
        
        # 转换为字典列表
        result = []
        for slot in timeslots:
            result.append(slot.to_dict())
        
        return jsonify(result), 200
    
    except ValueError:
        return jsonify({'message': '日期格式无效，应为YYYY-MM-DD'}), 400
    except Exception as e:
        return jsonify({'message': f'获取时间段失败: {str(e)}'}), 500

# API路由：创建或更新时间段
@app.route('/api/timeslots', methods=['POST'])
def create_timeslots():
    """批量创建或更新时间段"""
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 确保是服务提供商
    if user_type != 'provider':
        return jsonify({'message': '权限不足，仅服务提供商可访问此接口'}), 403
    
    # 获取请求数据
    data = request.get_json()
    if not data or not isinstance(data, list):
        return jsonify({'message': '请求数据格式无效，应为时间段对象数组'}), 400
    
    try:
        created_slots = []
        updated_slots = []
        
        for slot_data in data:
            # 验证必要字段
            if 'date' not in slot_data or 'time' not in slot_data:
                 return jsonify({'message': '每个时间段必须包含日期和时间'}), 400
            
            # 解析日期
            try:
                date_obj = datetime.strptime(slot_data['date'], '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'message': f'日期格式无效: {slot_data["date"]}，应为YYYY-MM-DD'}), 400
            
            # 检查是否已存在相同的时间段
            existing_slot = TimeSlot.query.filter_by(
                provider_id=user_id,
                date=date_obj,
                time=slot_data['time']
            ).first()
            
            if existing_slot:
                # 更新现有时间段
                existing_slot.is_available = slot_data.get('is_available', True)
                existing_slot.updated_at = datetime.utcnow()
                updated_slots.append(existing_slot.to_dict())
            else:
                # 创建新时间段
                new_slot = TimeSlot(
                    provider_id=user_id,
                    date=date_obj,
                    time=slot_data['time'],
                    is_available=slot_data.get('is_available', True)
                )
                db.session.add(new_slot)
                created_slots.append(new_slot.to_dict())
        
        db.session.commit()
        
        return jsonify({
            'message': f'成功创建 {len(created_slots)} 个时间段，更新 {len(updated_slots)} 个时间段',
            'created': created_slots,
            'updated': updated_slots
                        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'创建或更新时间段失败: {str(e)}'}), 500

# API路由：更新单个时间段
@app.route('/api/timeslots/<date>/<time>', methods=['PUT'])
def update_timeslot(date, time):
    """更新单个时间段的可用状态"""
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
                        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
                        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 确保是服务提供商
    if user_type != 'provider':
                        return jsonify({'message': '权限不足，仅服务提供商可访问此接口'}), 403
    
    # 获取请求数据
    data = request.get_json()
    if not data or 'is_available' not in data:
                        return jsonify({'message': '请求数据必须包含is_available字段'}), 400
    
    try:
        # 解析日期
        try:
            date_obj = datetime.strptime(date, '%Y-%m-%d').date()
        except ValueError:
                            return jsonify({'message': f'日期格式无效: {date}，应为YYYY-MM-DD'}), 400
        
        # 查找时间段
        slot = TimeSlot.query.filter_by(
            provider_id=user_id,
            date=date_obj,
            time=time
        ).first()
        
        if not slot:
            # 如果时间段不存在，创建新的
            slot = TimeSlot(
                provider_id=user_id,
                date=date_obj,
                time=time,
                is_available=data['is_available']
            )
            db.session.add(slot)
            db.session.commit()
            return jsonify({
                'message': '成功创建时间段',
                'timeslot': slot.to_dict()
            }), 201
        else:
            # 更新现有时间段
            slot.is_available = data['is_available']
            slot.updated_at = datetime.utcnow()
            db.session.commit()
        return jsonify({
                'message': '成功更新时间段',
                'timeslot': slot.to_dict()
                            }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'更新时间段失败: {str(e)}'}), 500

# API路由：批量应用工作模式
@app.route('/api/timeslots/pattern', methods=['POST'])
def apply_working_pattern():
    """应用工作模式，批量创建时间段"""
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
                        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
                        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 确保是服务提供商
    if user_type != 'provider':
                        return jsonify({'message': '权限不足，仅服务提供商可访问此接口'}), 403
    
    # 获取请求数据
    data = request.get_json()
    if not data:
                        return jsonify({'message': '请求数据无效'}), 400
    
    pattern = data.get('pattern')
    start_date = data.get('start_date')
    end_date = data.get('end_date')
    time_slots = data.get('time_slots')
    non_working_time_slots = data.get('non_working_time_slots', [])
    
    if not pattern or not start_date or not end_date or not time_slots:
                        return jsonify({'message': '工作模式、开始日期、结束日期和时间段是必需的'}), 400
    
    try:
        # 解析日期
        start_date_obj = datetime.strptime(start_date, '%Y-%m-%d').date()
        end_date_obj = datetime.strptime(end_date, '%Y-%m-%d').date()
        
        # 生成日期范围
        all_dates = []
        included_dates = []
        excluded_dates = []
        
        current_date = start_date_obj
        while current_date <= end_date_obj:
            all_dates.append(current_date)
            
            # 根据工作模式筛选日期
            weekday = current_date.weekday()  # 0-6，0是周一
            
            include_date = False
            if pattern == 'everyday':
                include_date = True
            elif pattern == 'weekdays' and weekday < 5:  # 周一至周五
                include_date = True
            elif pattern == 'weekends' and weekday >= 5:  # 周六、周日
                include_date = True
            elif pattern == 'custom' and 'days' in data:
                # 自定义日期，例如 ['monday', 'wednesday', 'friday']
                day_names = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
                if day_names[weekday] in data['days']:
                    include_date = True
            
            if include_date:
                included_dates.append(current_date)
            else:
                excluded_dates.append(current_date)
            
            current_date += timedelta(days=1)
        
        # 批量创建或更新时间段
        created_count = 0
        updated_count = 0
        disabled_count = 0
        
        # 处理包含在工作模式中的日期
        for date_obj in included_dates:
            # 1. 处理工作时间内的时间段（设置为可用）
            for time_slot in time_slots:
                # 检查是否已存在
                existing_slot = TimeSlot.query.filter_by(
                    provider_id=user_id,
                    date=date_obj,
                    time=time_slot
                ).first()
                
                if existing_slot:
                    # 更新现有时间段
                    existing_slot.is_available = True
                    existing_slot.updated_at = datetime.utcnow()
                    updated_count += 1
                else:
                    # 创建新时间段
                    new_slot = TimeSlot(
                        provider_id=user_id,
                        date=date_obj,
                        time=time_slot,
                        is_available=True
                    )
                    db.session.add(new_slot)
                    created_count += 1
            
            # 2. 处理工作时间外的时间段（设置为不可用）
            for time_slot in non_working_time_slots:
                # 检查是否已存在
                existing_slot = TimeSlot.query.filter_by(
                    provider_id=user_id,
                    date=date_obj,
                    time=time_slot
                ).first()
                
                if existing_slot:
                    # 更新现有时间段为不可用
                    existing_slot.is_available = False
                    existing_slot.updated_at = datetime.utcnow()
                    disabled_count += 1
                else:
                    # 创建新时间段（不可用）
                    new_slot = TimeSlot(
                        provider_id=user_id,
                        date=date_obj,
                        time=time_slot,
                        is_available=False
                    )
                    db.session.add(new_slot)
                    created_count += 1
                    disabled_count += 1
        
        # 处理不包含在工作模式中的日期（所有时间段都设置为不可用）
        for date_obj in excluded_dates:
            # 所有时间段都设置为不可用
            all_time_slots = time_slots + non_working_time_slots
            for time_slot in all_time_slots:
                # 检查是否已存在
                existing_slot = TimeSlot.query.filter_by(
                    provider_id=user_id,
                    date=date_obj,
                    time=time_slot
                ).first()
                
                if existing_slot:
                    # 更新现有时间段为不可用
                    existing_slot.is_available = False
                    existing_slot.updated_at = datetime.utcnow()
                    disabled_count += 1
                else:
                    # 创建新时间段（不可用）
                    new_slot = TimeSlot(
                        provider_id=user_id,
                        date=date_obj,
                        time=time_slot,
                        is_available=False
                    )
                    db.session.add(new_slot)
                    created_count += 1
                    disabled_count += 1
        
        db.session.commit()
        
        return jsonify({
            'message': f'成功应用工作模式，创建 {created_count} 个时间段，更新 {updated_count} 个时间段，禁用 {disabled_count} 个时间段',
            'pattern': pattern,
            'included_dates': [date.isoformat() for date in included_dates],
            'excluded_dates': [date.isoformat() for date in excluded_dates]
                        }), 200
    
    except ValueError:
                        return jsonify({'message': '日期格式无效，应为YYYY-MM-DD'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'应用工作模式失败: {str(e)}'}), 500

# API路由：删除时间段
@app.route('/api/timeslots/<date>/<time>', methods=['DELETE'])
def delete_timeslot(date, time):
    """删除单个时间段"""
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
                        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
                        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 确保是服务提供商
    if user_type != 'provider':
                        return jsonify({'message': '权限不足，仅服务提供商可访问此接口'}), 403
    
    try:
        # 解析日期
        try:
            date_obj = datetime.strptime(date, '%Y-%m-%d').date()
        except ValueError:
                            return jsonify({'message': f'日期格式无效: {date}，应为YYYY-MM-DD'}), 400
        
        # 查找时间段
        slot = TimeSlot.query.filter_by(
            provider_id=user_id,
            date=date_obj,
            time=time
        ).first()
        
        if not slot:
                            return jsonify({'message': '时间段不存在'}), 404
        
        # 检查是否有关联的预约
        booking = Booking.query.filter_by(
            provider_id=user_id,
            date=date_obj,
            time=time
        ).first()
        
        if booking and booking.status in ['pending', 'confirmed']:
                            return jsonify({'message': '无法删除已有预约的时间段'}), 400
        
        # 删除时间段
        db.session.delete(slot)
        db.session.commit()
        
        return jsonify({'message': '成功删除时间段'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'删除时间段失败: {str(e)}'}), 500

# API路由：获取时间段的预约详情
@app.route('/api/timeslots/<date>/<time>/booking', methods=['GET'])
def get_timeslot_booking(date, time):
    """获取时间段的预约详情"""
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
                        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
                        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 确保是服务提供商
    if user_type != 'provider':
                        return jsonify({'message': '权限不足，仅服务提供商可访问此接口'}), 403
    
    try:
        # 解析日期
        try:
            date_obj = datetime.strptime(date, '%Y-%m-%d').date()
        except ValueError:
                            return jsonify({'message': f'日期格式无效: {date}，应为YYYY-MM-DD'}), 400
        
        # 查找预约
        booking = Booking.query.filter_by(
            provider_id=user_id,
            date=date_obj,
            time=time
        ).first()
        
        if not booking:
                            return jsonify({'message': '该时间段没有预约'}), 404
        
        # 获取预约详情
        booking_data = booking.to_dict()
        
        # 获取服务详情
        service = Service.query.get(booking.service_id)
        if service:
            booking_data['service'] = {
                'id': service.id,
                'title': service.title,
                'price': service.price,
                'price_unit': service.price_unit,
                'duration': service.duration
            }
        
        # 获取用户详情
        user = User.query.get(booking.user_id)
        if user:
            booking_data['user'] = {
                'id': user.id,
                'username': user.username,
                'nickname': user.nickname,
                'avatar': user.avatar,
                'phone': user.phone
            }
        
        return jsonify(booking_data), 200
    
    except Exception as e:
                        return jsonify({'message': f'获取预约详情失败: {str(e)}'}), 500

# 定时任务：检查即将到来的预约
def check_upcoming_bookings():
    with app.app_context():
        print(f"[{datetime.now()}] 开始检查即将到来的预约...")
        
        try:
            # 获取所有已确认的预约
            confirmed_bookings = Booking.query.filter_by(status='confirmed').all()
            
            # 检查每个预约
            for booking in confirmed_bookings:
                booking_date = booking.date
                booking_time = booking.time
                
                # 解析预约时间
                hour, minute = map(int, booking_time.split(':'))
                booking_datetime = datetime.combine(booking_date, datetime.min.time())
                booking_datetime = booking_datetime.replace(hour=hour, minute=minute)
                
                # 计算时间差
                time_diff = booking_datetime - datetime.now()
                hours_remaining = time_diff.total_seconds() / 3600
                
                # 如果预约时间已过，自动标记为未出席
                if hours_remaining < -1:  # 超过1小时未完成
                    booking.status = 'no-show'
                    booking.updated_at = datetime.now()
                    db.session.commit()
                    print(f"预约 {booking.id} 已标记为未出席")
                    
                    # 创建未出席通知
                    try:
                        service = Service.query.get(booking.service_id)
                        service_title = service.title if service else "预约服务"
                        
                        no_show_notification = Notification(
                            user_id=booking.user_id,
                            type='booking',
                            subtype='no-show',
                            title='预约未出席',
                            content=f"您的 {service_title} 服务预约已被标记为未出席。",
                            related_id=booking.id,
                            created_at=datetime.now()
                        )
                        db.session.add(no_show_notification)
                        db.session.commit()
                    except Exception as e:
                        db.session.rollback()
                        print(f"创建未出席通知失败: {str(e)}")
                
                # 如果预约即将到来（1小时内），发送提醒通知
                elif 0 <= hours_remaining <= 1:
                    # 检查是否已经发送过1小时提醒通知
                    existing_reminder = Notification.query.filter_by(
                        user_id=booking.user_id,
                        type='booking',
                        subtype='reminder',
                        related_id=booking.id
                    ).first()
                    
                    # 如果没有发送过1小时提醒，则发送
                    if not existing_reminder:
                        try:
                            service = Service.query.get(booking.service_id)
                            provider = Provider.query.get(booking.provider_id)
                            
                            service_title = service.title if service else "预约服务"
                            provider_name = provider.business_name if provider and provider.business_name else "服务提供商"
                            
                            # 创建用户通知
                            reminder_notification = Notification(
                                user_id=booking.user_id,
                                type='booking',
                                subtype='reminder',
                                title='预约即将开始',
                                content=f"您与 {provider_name} 的 {service_title} 服务预约将在 {int(hours_remaining * 60)} 分钟后开始。",
                                related_id=booking.id,
                                created_at=datetime.now()
                            )
                            db.session.add(reminder_notification)
                            db.session.commit()
                            print(f"已为预约 {booking.id} 的用户 {booking.user_id} 创建1小时提醒通知")
                        except Exception as e:
                            db.session.rollback()
                            print(f"创建提醒通知失败: {str(e)}")
            
            print(f"[{datetime.now()}] 预约检查完成")
        except Exception as e:
            print(f"[{datetime.now()}] 检查预约时出错: {str(e)}")
            db.session.rollback()

# 启动定时任务
def start_scheduler():
    while True:
        check_upcoming_bookings()
        time.sleep(3600)  # 每小时检查一次

scheduler_thread = threading.Thread(target=start_scheduler)
scheduler_thread.daemon = True
scheduler_thread.start()

# API路由：获取评价列表
@app.route('/api/reviews', methods=['GET'])
def get_reviews():
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
                        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
                        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    try:
        if user_type == 'user':
            # 用户查看自己的评价
            reviews = Review.query.filter_by(user_id=user_id).all()
        else:
            # 服务商查看自己收到的评价
            reviews = Review.query.filter_by(provider_id=user_id).all()
        
        # 扩展评价信息，包含服务和提供商信息
        reviews_data = []
        for review in reviews:
            review_dict = review.to_dict()
            
            # 添加服务信息
            service = Service.query.get(review.service_id)
            if service:
                review_dict['service'] = service.to_dict()
            
            # 添加提供商信息
            provider = Provider.query.get(review.provider_id)
            if provider:
                review_dict['provider'] = provider.to_dict()
            
            # 添加用户信息（对于服务商查看评价时）
            if user_type == 'provider':
                user = User.query.get(review.user_id)
                if user:
                    review_dict['user'] = user.to_dict()
            
            reviews_data.append(review_dict)
        
        return jsonify(reviews_data), 200
    except Exception as e:
                        return jsonify({'message': f'获取评价失败: {str(e)}'}), 500

# API路由：提交评价
@app.route('/api/reviews', methods=['POST'])
def create_review():
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
                        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
                        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 只有普通用户可以提交评价
    if user_type != 'user':
                        return jsonify({'message': '只有普通用户可以提交评价'}), 403
    
    data = request.json or {}
    service_id = data.get('service_id')
    provider_id = data.get('provider_id')
    booking_id = data.get('booking_id')
    rating = data.get('rating')
    content = data.get('content')
    
    # 验证必填字段
    if not all([service_id, provider_id, booking_id, rating]):
                        return jsonify({'message': '缺少必要的评价信息'}), 400
    
    # 验证评分范围
    if not isinstance(rating, int) or rating < 1 or rating > 5:
                        return jsonify({'message': '评分必须是1到5之间的整数'}), 400
    
    try:
        # 检查预约是否存在且属于当前用户
        booking = Booking.query.filter_by(id=booking_id, user_id=user_id).first()
        if not booking:
                            return jsonify({'message': '未找到相关预约或无权评价此预约'}), 404
        
        # 检查预约状态是否为已完成
        if booking.status != 'completed':
                            return jsonify({'message': '只能评价已完成的预约'}), 400
        
        # 检查是否已经评价过
        existing_review = Review.query.filter_by(booking_id=booking_id).first()
        if existing_review:
                            return jsonify({'message': '此预约已经评价过了'}), 400
        
        # 创建新评价
        new_review = Review(
            user_id=user_id,
            provider_id=provider_id,
            service_id=service_id,
            booking_id=booking_id,
            rating=rating,
            content=content,
            created_at=datetime.now()
        )
        
        db.session.add(new_review)
        
        # 更新预约的评价状态
        booking.review_needed = False
        
        # 更新服务的评分和评价数量
        service = Service.query.get(service_id)
        if service:
            # 计算新的平均评分
            all_service_reviews = Review.query.filter_by(service_id=service_id).all()
            total_ratings = sum(r.rating for r in all_service_reviews) + rating
            new_count = len(all_service_reviews) + 1
            new_avg = total_ratings / new_count
            
            service.rating = new_avg
            service.reviews_count = new_count
        
        # 更新提供商的评分
        provider = Provider.query.get(provider_id)
        if provider:
            # 计算新的平均评分
            all_provider_reviews = Review.query.filter_by(provider_id=provider_id).all()
            total_ratings = sum(r.rating for r in all_provider_reviews) + rating
            new_avg = total_ratings / (len(all_provider_reviews) + 1)
            
            provider.rating = new_avg
        
        # 为服务提供商创建一个系统通知而不是直接的用户通知
        # 因为provider_id不是users表中的ID，所以不能直接用作user_id
        # 在这里，我们可以选择跳过通知创建，或者改为创建系统记录
        # 系统通知可以在提供商登录时查看
        
        # 记录服务商收到新评价
        try:
            # 这里我们可以在评价表中添加一个标记，表示这个评价需要被提供商查看
            # 或者可以在服务商登录时检查新评价
            pass
        except Exception as e:
            print(f"记录提供商通知失败: {str(e)}")
        db.session.commit()
        
        # 返回新创建的评价
        review_dict = new_review.to_dict()
        review_dict['service'] = service.to_dict() if service else None
        review_dict['provider'] = provider.to_dict() if provider else None
        
        return jsonify({'message': '评价提交成功', 'review': review_dict}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'评价提交失败: {str(e)}'}), 500

# API路由：更新评价
@app.route('/api/reviews/<review_id>', methods=['PUT'])
def update_review(review_id):
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
                        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
                        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 获取评价数据
    data = request.json or {}
    rating = data.get('rating')
    content = data.get('content')
    
    # 验证评分范围
    if rating is not None and (not isinstance(rating, int) or rating < 1 or rating > 5):
                        return jsonify({'message': '评分必须是1到5之间的整数'}), 400
    
    try:
        # 查找评价
        review = Review.query.get(review_id)
        if not review:
                            return jsonify({'message': '未找到评价'}), 404
        
        # 验证权限
        if user_type == 'user':
            # 用户只能修改自己的评价
            if review.user_id != user_id:
                                return jsonify({'message': '无权修改此评价'}), 403
            
            # 更新评价内容
            if rating is not None:
                old_rating = review.rating
                review.rating = rating
                
                # 更新服务的评分
                service = Service.query.get(review.service_id)
                if service and service.reviews_count > 0:
                    # 计算新的平均评分
                    total_ratings = service.rating * service.reviews_count - old_rating + rating
                    service.rating = total_ratings / service.reviews_count
                
                # 更新提供商的评分
                provider = Provider.query.get(review.provider_id)
                if provider:
                    all_provider_reviews = Review.query.filter_by(provider_id=review.provider_id).all()
                    total_ratings = sum(r.rating for r in all_provider_reviews if r.id != review.id) + rating
                    provider.rating = total_ratings / len(all_provider_reviews)
            
            if content is not None:
                review.content = content
            
            review.updated_at = datetime.now()
            
            # 评价更新，但不为提供商创建通知
            # 因为provider_id不是users表中的ID，所以不能直接用作user_id
            # 在这里，我们可以选择跳过通知创建
            
            # 记录服务商有评价被更新
            try:
                # 这里我们可以在评价表中添加一个标记，表示这个评价被更新
                # 或者可以在服务商登录时检查更新的评价
                pass
            except Exception as e:
                print(f"记录提供商评价更新通知失败: {str(e)}")
            
        elif user_type == 'provider':
            # 服务商只能回复自己收到的评价
            if review.provider_id != user_id:
                                return jsonify({'message': '无权回复此评价'}), 403
            
            # 更新回复
            reply = data.get('reply')
            if reply is not None:
                review.reply = reply
                review.reply_at = datetime.now()
                
                # 创建通知
                notification = Notification(
                    user_id=review.user_id,
                    type='review',
                    subtype='reply',
                    title='您的评价收到回复',
                    content=f'您对"{review.service.title if review.service else "未知服务"}"的评价收到了回复。',
                    related_id=review.id
                )
                
                db.session.add(notification)
        
        db.session.commit()
        
        # 返回更新后的评价
        review_dict = review.to_dict()
        review_dict['service'] = review.service.to_dict() if review.service else None
        review_dict['provider'] = review.provider.to_dict() if review.provider else None
        
        return jsonify({'message': '评价更新成功', 'review': review_dict}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'评价更新失败: {str(e)}'}), 500

# API路由：删除评价
@app.route('/api/reviews/<review_id>', methods=['DELETE'])
def delete_review(review_id):
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
                        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
                        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    try:
        # 查找评价
        review = Review.query.get(review_id)
        if not review:
                            return jsonify({'message': '未找到评价'}), 404
        
        # 验证权限（只有用户可以删除自己的评价）
        if user_type != 'user' or review.user_id != user_id:
                            return jsonify({'message': '无权删除此评价'}), 403
        
        # 保存评价相关信息，用于更新服务和提供商评分
        service_id = review.service_id
        provider_id = review.provider_id
        old_rating = review.rating
        
        # 删除评价
        db.session.delete(review)
        
        # 更新服务的评分和评价数量
        service = Service.query.get(service_id)
        if service and service.reviews_count > 0:
            new_count = service.reviews_count - 1
            if new_count > 0:
                # 计算新的平均评分
                total_ratings = service.rating * service.reviews_count - old_rating
                service.rating = total_ratings / new_count
            else:
                service.rating = 0
            service.reviews_count = new_count
        
        # 更新提供商的评分
        provider = Provider.query.get(provider_id)
        if provider:
            all_provider_reviews = Review.query.filter_by(provider_id=provider_id).all()
            if all_provider_reviews:
                total_ratings = sum(r.rating for r in all_provider_reviews if r.id != review_id)
                provider.rating = total_ratings / len(all_provider_reviews) if all_provider_reviews else 0
            else:
                provider.rating = 0
        
        db.session.commit()
        
        return jsonify({'message': '评价已删除'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'删除评价失败: {str(e)}'}), 500

# API路由：获取用户通知
@app.route('/api/user/notifications', methods=['GET'])
def get_user_notifications():
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
                        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
                        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    
    try:
        # 查询用户的通知
        notifications = Notification.query.filter_by(user_id=user_id).order_by(Notification.created_at.desc()).all()
        
        # 将通知转换为字典列表
        notifications_data = [notification.to_dict() for notification in notifications]
        
        # 添加相关实体信息
        for notification in notifications_data:
            # 如果通知与预约相关
            if notification['type'] == 'booking' and notification['related_id']:
                booking = Booking.query.get(notification['related_id'])
                if booking:
                    notification['related_entity'] = {
                        'booking_id': booking.id,
                        'service_id': booking.service_id,
                        'provider_id': booking.provider_id,
                        'date': booking.date.isoformat(),
                        'time': booking.time,
                        'status': booking.status
                    }
                    
                    # 添加服务信息
                    service = Service.query.get(booking.service_id)
                    if service:
                        notification['related_entity']['service'] = {
                            'title': service.title,
                            'image': service.image
                        }
                    
                    # 添加提供商信息
                    provider = Provider.query.get(booking.provider_id)
                    if provider:
                        notification['related_entity']['provider'] = {
                            'business_name': provider.business_name
                        }
            
            # 如果通知与评价相关
            elif notification['type'] == 'review' and notification['related_id']:
                review = Review.query.get(notification['related_id'])
                if review:
                    notification['related_entity'] = {
                        'review_id': review.id,
                        'service_id': review.service_id,
                        'provider_id': review.provider_id,
                        'booking_id': review.booking_id,
                        'rating': review.rating,
                        'content': review.content,
                        'reply': review.reply,
                        'created_at': review.created_at.isoformat()
                    }
                    
                    # 添加服务信息
                    service = Service.query.get(review.service_id)
                    if service:
                        notification['related_entity']['service'] = {
                            'title': service.title,
                            'image': service.image
                        }
        
        return jsonify(notifications_data), 200
    except Exception as e:
                        return jsonify({'message': f'获取通知失败: {str(e)}'}), 500

# API路由：标记通知为已读
@app.route('/api/user/notifications/<notification_id>/read', methods=['PUT'])
def mark_notification_as_read(notification_id):
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
                        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
                        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    
    try:
        # 查询通知
        notification = Notification.query.filter_by(id=notification_id, user_id=user_id).first()
        if not notification:
                            return jsonify({'message': '通知不存在或无权访问'}), 404
        
        # 标记为已读
        notification.is_read = True
        notification.updated_at = datetime.now()
        
        db.session.commit()
        
        return jsonify({'message': '通知已标记为已读'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'标记通知失败: {str(e)}'}), 500

# API路由：标记所有通知为已读
@app.route('/api/user/notifications/read-all', methods=['PUT'])
def mark_all_notifications_as_read():
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
                        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
                        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    
    try:
        # 查询用户所有未读通知
        notifications = Notification.query.filter_by(user_id=user_id, is_read=False).all()
        
        # 标记所有通知为已读
        for notification in notifications:
            notification.is_read = True
            notification.updated_at = datetime.now()
        
        db.session.commit()
        
        return jsonify({'message': '所有通知已标记为已读', 'count': len(notifications)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'标记所有通知失败: {str(e)}'}), 500

# API路由：删除通知
@app.route('/api/user/notifications/<notification_id>', methods=['DELETE'])
def delete_notification(notification_id):
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
                        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
                        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    
    try:
        # 查询通知
        notification = Notification.query.filter_by(id=notification_id, user_id=user_id).first()
        if not notification:
                            return jsonify({'message': '通知不存在或无权访问'}), 404
        
        # 删除通知
        db.session.delete(notification)
        db.session.commit()
        
        return jsonify({'message': '通知已删除'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'删除通知失败: {str(e)}'}), 500

# API路由：创建通知
@app.route('/api/notifications', methods=['POST'])
def create_notification():
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
                        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
                        return jsonify({'message': '无效或过期的令牌'}), 401
    
    # 只有服务提供商可以创建通知
    user_type = payload.get('user_type')
    if user_type != 'provider':
                        return jsonify({'message': '无权创建通知'}), 403
    
    data = request.json or {}
    user_id = data.get('user_id')
    type = data.get('type')
    subtype = data.get('subtype')
    title = data.get('title')
    content = data.get('content')
    related_id = data.get('related_id')
    
    # 验证必填字段
    if not all([user_id, type, title, content]):
                        return jsonify({'message': '缺少必要的通知信息'}), 400
    
    try:
        # 创建新通知
        new_notification = Notification(
            user_id=user_id,
            type=type,
            subtype=subtype,
            title=title,
            content=content,
            related_id=related_id,
            is_read=False,
            created_at=datetime.now()
        )
        
        db.session.add(new_notification)
        db.session.commit()
        
        return jsonify({'message': '通知创建成功', 'notification': new_notification.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'创建通知失败: {str(e)}'}), 500

# API路由：永久删除预约历史
@app.route('/api/bookings/<booking_id>/permanent', methods=['DELETE'])
def delete_booking_permanently(booking_id):
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
                        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 获取预约信息
    booking = Booking.query.get(booking_id)
    if not booking:
                        return jsonify({'message': '预约不存在'}), 404
    
    # 验证用户权限
    if (user_type == 'user' and booking.user_id != user_id) or \
       (user_type == 'provider' and booking.provider_id != user_id):
                        return jsonify({'message': '无权操作此预约'}), 403
    
    # 验证预约状态，只能删除已完成的预约
    if booking.status != 'completed':
                        return jsonify({'message': '只能删除已完成的预约'}), 400
    
    try:
        # 先删除关联的评价（如果有）
        Review.query.filter_by(booking_id=booking_id).delete()
        
        # 删除预约
        db.session.delete(booking)
        db.session.commit()
        
        return jsonify({'message': '预约历史已永久删除'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'删除预约历史失败: {str(e)}'}), 500

# API路由：获取仪表板统计数据
@app.route('/api/bookings/stats', methods=['GET'])
def get_booking_stats():
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
                        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
                        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 创建统计数据结构
    stats = {
        'pending': 0,     # 待确认
        'upcoming': 0,    # 即将到来
        'completed': 0,   # 已完成
        'canceled': 0     # 已取消
    }
    
    try:
        # 根据用户类型查询不同状态的预约数量
        if user_type == 'user':
            # 待确认预约数量
            stats['pending'] = Booking.query.filter_by(
                user_id=user_id, status='pending'
            ).count()
            
            # 即将到来的预约数量（已确认）
            stats['upcoming'] = Booking.query.filter_by(
                user_id=user_id, status='confirmed'
            ).count()
            
            # 已完成预约数量
            stats['completed'] = Booking.query.filter_by(
                user_id=user_id, status='completed'
            ).count()
            
            # 已取消预约数量
            stats['canceled'] = Booking.query.filter_by(
                user_id=user_id, status='canceled'
            ).count()
        else:  # provider
            # 待确认预约数量
            stats['pending'] = Booking.query.filter_by(
                provider_id=user_id, status='pending'
            ).count()
            
            # 即将到来的预约数量（已确认）
            stats['upcoming'] = Booking.query.filter_by(
                provider_id=user_id, status='confirmed'
            ).count()
            
            # 已完成预约数量
            stats['completed'] = Booking.query.filter_by(
                provider_id=user_id, status='completed'
            ).count()
            
            # 已取消预约数量
            stats['canceled'] = Booking.query.filter_by(
                provider_id=user_id, status='canceled'
            ).count()
        
        # 获取用户信息
        user_info = None
        if user_type == 'user':
            user = User.query.get(user_id)
            if user:
                user_info = {
                    'id': user.id,
                    'username': user.username,
                    'name': user.nickname or user.username,
                    'role': '普通用户'
                }
        else:  # provider
            provider = Provider.query.get(user_id)
            if provider:
                user_info = {
                    'id': provider.id,
                    'username': provider.username,
                    'name': provider.business_name or provider.username,
                    'role': '服务商'
                }
        
        # 返回统计数据和用户信息
        return jsonify({
            'stats': stats,
            'user': user_info
        }), 200
    
    except Exception as e:
                        return jsonify({'message': f'获取统计数据失败: {str(e)}'}), 500

# API路由：获取用户地址
@app.route('/api/user/addresses', methods=['GET'])
def get_user_addresses():
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
                        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
                        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 只有普通用户可以使用此API
    if user_type != 'user':
                        return jsonify({'message': '权限不足'}), 403
    
    # 查询用户地址
    addresses = Address.query.filter_by(user_id=user_id).all()
    
    # 返回地址列表
    return jsonify([address.to_dict() for address in addresses]), 200

# API路由：添加用户地址
@app.route('/api/user/addresses', methods=['POST'])
def add_user_address():
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
                        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
                        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 只有普通用户可以使用此API
    if user_type != 'user':
                        return jsonify({'message': '权限不足'}), 403
    
    # 获取请求数据
    data = request.json or {}
    
    # 验证必填字段
    if not data.get('label') or not data.get('address'):
                        return jsonify({'message': '标签和地址都是必填的'}), 400
    
    # 创建新地址
    new_address = Address(
        user_id=user_id,
        label=data.get('label'),
        address=data.get('address')
    )
    
    try:
        db.session.add(new_address)
        db.session.commit()
        return jsonify({'message': '地址添加成功', 'address': new_address.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'地址添加失败: {str(e)}'}), 500

#API路由：更新用户地址
@app.route('/api/user/addresses/<address_id>', methods=['PUT'])
def update_user_address_alt(address_id):
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
                        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
                        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 只有普通用户可以使用此API
    if user_type != 'user':
                        return jsonify({'message': '权限不足'}), 403
    
    # 查询地址
    address = Address.query.filter_by(id=address_id, user_id=user_id).first()
    if not address:
                        return jsonify({'message': '地址不存在或无权限修改'}), 404
    
    # 获取请求数据
    data = request.json or {}
    
    # 更新地址信息
    if 'label' in data:
        address.label = data['label']
    if 'address' in data:
        address.address = data['address']
    
    try:
        db.session.commit()
        return jsonify({'message': '地址更新成功', 'address': address.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'地址更新失败: {str(e)}'}), 500

# API路由：删除用户地址
@app.route('/api/user/addresses/<address_id>', methods=['DELETE'])
def delete_user_address_alt(address_id):
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
                        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
                        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 只有普通用户可以使用此API
    if user_type != 'user':
                        return jsonify({'message': '权限不足'}), 403
    
    # 查询地址
    address = Address.query.filter_by(id=address_id, user_id=user_id).first()
    if not address:
                        return jsonify({'message': '地址不存在或无权限删除'}), 404
    
    try:
        db.session.delete(address)
        db.session.commit()
        return jsonify({'message': '地址删除成功'}), 200
    except Exception as e:
        db.session.rollback()
        print(f"删除地址失败: {str(e)}")
        return jsonify({'message': f'删除地址失败: {str(e)}'}), 500

@app.route('/api/user/notification-settings', methods=['PUT'])
def update_notification_settings():
    """更新用户的通知设置"""
    print("API被调用: /api/user/notification-settings [PUT]")
    
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        print("缺少认证令牌")
        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
        print("令牌验证失败")
        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 获取请求数据
    data = request.json or {}
    if not data or 'notification_settings' not in data:
                        return jsonify({'message': '缺少必要参数'}), 400
    
    try:
        notification_settings = data['notification_settings']
        
        # 查找用户或服务商
        if user_type == 'user':
            user = User.query.get(user_id)
            if not user:
                                return jsonify({'message': '用户不存在'}), 404
            
            # 更新通知设置
            user.notification_settings = json.dumps(notification_settings)
            user.updated_at = datetime.now()
            
        else:  # provider
            provider = Provider.query.get(user_id)
            if not provider:
                                return jsonify({'message': '服务商不存在'}), 404
            
            # 如果Provider模型没有notification_settings字段，则可以在这里添加自定义逻辑
            # 例如，将设置存储在另一个表中
            # 由于目前Provider模型中没有notification_settings字段，这里仅返回成功
            pass
        
        # 保存更改
        db.session.commit()
        
        return jsonify({'message': '通知设置已更新'}), 200
    except Exception as e:
        db.session.rollback()
        print(f"更新通知设置失败: {str(e)}")
        return jsonify({'message': f'更新通知设置失败: {str(e)}'}), 500

# API路由：更新用户隐私设置
@app.route('/api/user/privacy-settings', methods=['PUT'])
def update_privacy_settings():
    """更新用户隐私设置"""
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
                        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
                        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 确保是普通用户
    if user_type != 'user':
                        return jsonify({'message': '只有普通用户可以更新隐私设置'}), 403
    
    # 获取请求数据
    data = request.json or {}
    privacy_settings = data.get('privacy_settings')
    
    if not privacy_settings:
                        return jsonify({'message': '隐私设置不能为空'}), 400
    
    try:
        # 查找用户
        user = User.query.get(user_id)
        if not user:
                            return jsonify({'message': '用户不存在'}), 404
        
        # 更新隐私设置
        user.privacy_settings = json.dumps(privacy_settings)
        user.updated_at = datetime.now()
        
        # 保存到数据库
        db.session.commit()
        
        return jsonify({'message': '隐私设置更新成功'}), 200
    
    except Exception as e:
        db.session.rollback()
        print(f"更新隐私设置失败: {str(e)}")
        return jsonify({'message': f'更新隐私设置失败: {str(e)}'}), 500

@app.route('/api/user/blacklist', methods=['PUT'])
def update_user_blacklist():
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
                        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
                        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    
    try:
        # 获取请求数据
        data = request.get_json()
        if not data or 'blacklist' not in data:
                            return jsonify({'message': '请求数据为空或格式错误'}), 400
        
        # 获取用户
        user = User.query.get(user_id)
        if not user:
                            return jsonify({'message': '用户不存在'}), 404
        
        # 更新黑名单
        user.blacklist = data['blacklist']
        
        # 更新修改时间
        user.updated_at = datetime.now()
        
        # 保存到数据库
        db.session.commit()
        
        return jsonify({'message': '黑名单更新成功'}), 200
    
    except Exception as e:
        db.session.rollback()
        print(f"更新黑名单失败: {str(e)}")
        return jsonify({'message': f'更新黑名单失败: {str(e)}'}), 500

# 扩展allowed_file函数，支持指定允许的扩展名
def allowed_file(filename, allowed_extensions=None):
    """检查文件是否具有允许的扩展名"""
    if allowed_extensions is None:
        allowed_extensions = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx']
    
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in allowed_extensions

# API路由：获取/更新服务商业务信息
@app.route('/api/provider/business', methods=['GET', 'PUT'])
def provider_business():
    """获取或更新当前服务商的业务信息"""
    print(f"API被调用: /api/provider/business [{request.method}]")
    print(f"请求URL: {request.url}")
    print(f"请求头: {dict(request.headers)}")
    
    try:
        # 从请求头获取令牌
        token = request.headers.get('Authorization')
        if not token:
            print("缺少认证令牌")
            return jsonify({'message': '缺少认证令牌'}), 401
        
        # 移除Bearer前缀（如果有）
        if token.startswith('Bearer '):
            token = token[7:]
        
        # 验证令牌
        payload = verify_token(token)
        if not payload:
            print("令牌验证失败")
            return jsonify({'message': '无效或过期的令牌'}), 401
        
        user_id = payload.get('user_id')
        user_type = payload.get('user_type')
        
        print(f"认证用户: {user_type} {user_id}")
        
        # 确保是服务商
        if user_type != 'provider':
            print(f"用户类型错误: {user_type}")
            return jsonify({'message': '权限不足，仅服务商可访问此接口'}), 403
        
        try:
            # 从数据库获取服务商信息
            provider = Provider.query.get(user_id)
            if not provider:
                                return jsonify({'message': '服务商不存在'}), 404
            
            # 处理GET请求 - 获取业务信息
            if request.method == 'GET':
                try:
                    print(f"正在为服务商 {user_id} 读取业务信息...")
                    
                    # 返回业务信息
                    business_info = {
                        'business_name': provider.business_name or '',
                        'business_description': provider.business_description or '',
                        'business_type': provider.business_type or '',
                        'license_no': provider.license_no or '',
                        'province': provider.province or '',
                        'city': provider.city or '',
                        'district': provider.district or '',
                        'detail_address': provider.detail_address or '',
                        'open_time': provider.open_time or '08:00',
                        'close_time': provider.close_time or '21:00',
                        'holiday_desc': provider.holiday_desc or '',
                        'phone': provider.phone or '',
                        'service_phone': provider.service_phone or ''
                    }
                    
                    print(f"成功读取服务商业务信息")
                    response = jsonify({'business_info': business_info, 'message': '业务信息获取成功'})
                    return response
                
                except Exception as e:
                    print(f"获取服务商业务信息失败: {str(e)}")
                    return jsonify({'message': f'获取业务信息失败: {str(e)}'}), 500
            
            # 处理PUT请求 - 更新业务信息
            elif request.method == 'PUT':
                try:
                    print(f"正在为服务商 {user_id} 更新业务信息...")
                    
                    # 获取请求体内容
                    data = None
                    if request.is_json:
                        try:
                            data = request.get_json() or {}
                        except Exception as e:
                            print(f"解析JSON请求体失败: {str(e)}")
                            return jsonify({'message': f'无效的JSON格式: {str(e)}'}), 400
                    else:
                        # 尝试手动解析请求体
                        try:
                            data = json.loads(request.data.decode('utf-8')) or {}
                        except Exception as e:
                            print(f"解析请求体失败: {str(e)}")
                            print(f"请求体内容: {request.data[:1000]}")
                            return jsonify({'message': f'无效的JSON格式: {str(e)}'}), 400
                    
                    if not data:
                        print("请求数据为空")
                        return jsonify({'message': '请求数据为空或格式错误'}), 400
                    
                    # 输出接收到的数据以便调试
                    print(f"接收到的数据: {data}")
                    
                    # 验证必填字段
                    if 'business_name' in data and not data['business_name'].strip():
                        print("商家名称为空")
                        return jsonify({'message': '商家名称不能为空'}), 400
                    
                    # 验证营业时间格式和逻辑
                    if 'open_time' in data and 'close_time' in data:
                        try:
                            open_parts = data['open_time'].split(':')
                            close_parts = data['close_time'].split(':')
                            
                            if len(open_parts) != 2 or len(close_parts) != 2:
                                                return jsonify({'message': '时间格式必须为HH:MM'}), 400
                            
                            open_hour, open_min = int(open_parts[0]), int(open_parts[1])
                            close_hour, close_min = int(close_parts[0]), int(close_parts[1])
                            
                            if open_hour < 0 or open_hour > 23 or open_min < 0 or open_min > 59:
                                                return jsonify({'message': '开始时间格式无效'}), 400
                            
                            if close_hour < 0 or close_hour > 23 or close_min < 0 or close_min > 59:
                                                return jsonify({'message': '结束时间格式无效'}), 400
                            
                            if (open_hour > close_hour) or (open_hour == close_hour and open_min >= close_min):
                                                return jsonify({'message': '结束时间必须晚于开始时间'}), 400
                        except ValueError:
                                            return jsonify({'message': '时间格式必须为HH:MM'}), 400
                        except Exception as e:
                            print(f"验证时间格式失败: {str(e)}")
                            return jsonify({'message': f'验证时间格式失败: {str(e)}'}), 400
                    
                    # 更新服务商业务信息
                    if 'business_name' in data:
                        provider.business_name = data['business_name']
                    if 'business_description' in data:
                        provider.business_description = data['business_description']
                    if 'business_type' in data:
                        provider.business_type = data['business_type']
                    if 'license_no' in data:
                        provider.license_no = data['license_no']
                    if 'province' in data:
                        provider.province = data['province']
                    if 'city' in data:
                        provider.city = data['city']
                    if 'district' in data:
                        provider.district = data['district']
                    if 'detail_address' in data:
                        provider.detail_address = data['detail_address']
                    if 'open_time' in data:
                        provider.open_time = data['open_time']
                    if 'close_time' in data:
                        provider.close_time = data['close_time']
                    if 'holiday_desc' in data:
                        provider.holiday_desc = data['holiday_desc']
                    if 'phone' in data:
                        provider.phone = data['phone']
                    if 'service_phone' in data:
                        provider.service_phone = data['service_phone']
                    
                    # 更新修改时间
                    provider.updated_at = datetime.now()
                    
                    # 提交更改到数据库
                    db.session.commit()
                    
                    # 返回成功信息和更新后的数据
                    result = {
                        'message': '业务信息已更新',
                        'business_info': {
                            'business_name': provider.business_name or '',
                            'business_description': provider.business_description or '',
                            'business_type': provider.business_type or '',
                            'license_no': provider.license_no or '',
                            'province': provider.province or '',
                            'city': provider.city or '',
                            'district': provider.district or '',
                            'detail_address': provider.detail_address or '',
                            'open_time': provider.open_time or '08:00',
                            'close_time': provider.close_time or '21:00',
                            'holiday_desc': provider.holiday_desc or '',
                            'phone': provider.phone or '',
                            'service_phone': provider.service_phone or ''
                        }
                    }
                    
                    print(f"服务商业务信息已更新")
                    print(f"返回数据: {result}")
                    
                    # 确保返回的是有效的JSON
                    response = jsonify(result)
                    return response, 200
                    
                except Exception as e:
                    db.session.rollback()
                    print(f"更新服务商业务信息失败: {str(e)}")
                    return jsonify({'message': f'更新业务信息失败: {str(e)}'}), 500
        except Exception as e:
            print(f"数据库操作失败: {str(e)}")
            return jsonify({'message': f'数据库操作失败: {str(e)}'}), 500
    
    except Exception as e:
        print(f"处理请求时发生错误: {str(e)}")
        return jsonify({'message': f'系统错误: {str(e)}'}), 500

# API路由：批量更新时间段
@app.route('/api/timeslots/batch', methods=['PUT'])
def batch_update_timeslots():
    """批量更新时间段状态"""
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
                        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
                        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 确保是服务提供商
    if user_type != 'provider':
                        return jsonify({'message': '权限不足，仅服务提供商可访问此接口'}), 403
    
    # 获取请求数据
    data = request.get_json()
    if not data:
                        return jsonify({'message': '请求数据无效'}), 400
    
    timeslots = data.get('timeslots')
    is_available = data.get('is_available')
    
    if not timeslots or is_available is None:
                        return jsonify({'message': '时间段列表和可用状态是必需的'}), 400
    
    try:
        updated_count = 0
        created_count = 0
        failed_count = 0
        
        for slot_data in timeslots:
            date_str = slot_data.get('date')
            time_str = slot_data.get('time')
            
            if not date_str or not time_str:
                failed_count += 1
                continue
            
            try:
                # 解析日期
                date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                failed_count += 1
                continue
            
            # 查找时间段
            slot = TimeSlot.query.filter_by(
                provider_id=user_id,
                date=date_obj,
                time=time_str
            ).first()
            
            if slot:
                # 更新现有时间段
                slot.is_available = is_available
                slot.updated_at = datetime.utcnow()
                updated_count += 1
            else:
                # 创建新时间段
                new_slot = TimeSlot(
                    provider_id=user_id,
                    date=date_obj,
                    time=time_str,
                    is_available=is_available
                )
                db.session.add(new_slot)
                created_count += 1
        
        db.session.commit()
        
        return jsonify({
            'message': f'批量更新时间段成功，更新 {updated_count} 个，创建 {created_count} 个，失败 {failed_count} 个',
            'updated': updated_count,
            'created': created_count,
            'failed': failed_count
                        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'批量更新时间段失败: {str(e)}'}), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True) 

# API路由：服务商日历视图，获取某时间段内的预约，按日期分组
@app.route('/api/bookings/calendar', methods=['GET'])
def get_bookings_calendar():
    token = request.headers.get('Authorization')
    if not token:
                        return jsonify({'message': '缺少认证令牌'}), 401
    if token.startswith('Bearer '):
        token = token[7:]
    payload = verify_token(token)
    if not payload:
                        return jsonify({'message': '无效或过期的令牌'}), 401
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    if user_type != 'provider':
                        return jsonify({'message': '只有服务商可以查看日历预约'}), 403

    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    service_id = request.args.get('service_id')
    status = request.args.get('status')

    if not start_date or not end_date:
                        return jsonify({'message': '起止日期(start_date, end_date)为必填'}), 400

    try:
        with open(BOOKINGS_FILE, 'r', encoding='utf-8') as f:
            bookings = json.load(f)
    except:
        bookings = []
    try:
        with open(USERS_FILE, 'r', encoding='utf-8') as f:
            users = json.load(f)
    except:
        users = []
    try:
        with open(SERVICES_FILE, 'r', encoding='utf-8') as f:
            services = json.load(f)
    except:
        services = []

    # 过滤服务商的预约
    provider_bookings = [b for b in bookings if b.get('provider_id') == user_id]
    # 过滤时间段
    result = {}
    for b in provider_bookings:
        date_str = b.get('date')
        if not date_str or not (start_date <= date_str <= end_date):
            continue
        if service_id and b.get('service_id') != service_id:
            continue
        if status and b.get('status') != status:
            continue
        # 补充用户信息
        user = next((u for u in users if u.get('id') == b.get('user_id')), None)
        b['user'] = {
            'id': user.get('id'),
            'username': user.get('username'),
            'email': user.get('email')
        } if user else None
        # 补充服务信息
        service = next((s for s in services if s.get('id') == b.get('service_id')), None)
        b['service'] = {
            'id': service.get('id'),
            'title': service.get('title'),
            'price': service.get('price'),
            'duration': service.get('duration')
        } if service else None
        # 按日期分组
        result.setdefault(date_str, []).append(b)
    return jsonify(result), 200

# API路由：服务商预约管理列表视图，获取预约列表
@app.route('/api/bookings/provider', methods=['GET'])
def get_provider_bookings():
    token = request.headers.get('Authorization')
    if not token:
                        return jsonify({'message': '缺少认证令牌'}), 401
    if token.startswith('Bearer '):
        token = token[7:]
    payload = verify_token(token)
    if not payload:
                        return jsonify({'message': '无效或过期的令牌'}), 401
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    if user_type != 'provider':
                        return jsonify({'message': '只有服务商可以查看预约列表'}), 403

    status = request.args.get('status')
    service_id = request.args.get('service_id')
    date = request.args.get('date')

    try:
        with open(BOOKINGS_FILE, 'r', encoding='utf-8') as f:
            bookings = json.load(f)
    except:
        bookings = []
    try:
        with open(USERS_FILE, 'r', encoding='utf-8') as f:
            users = json.load(f)
    except:
        users = []
    try:
        with open(SERVICES_FILE, 'r', encoding='utf-8') as f:
            services = json.load(f)
    except:
        services = []

    # 过滤服务商的预约
    provider_bookings = [b for b in bookings if b.get('provider_id') == user_id]
    # 进一步筛选
    if status:
        provider_bookings = [b for b in provider_bookings if b.get('status') == status]
    if service_id:
        provider_bookings = [b for b in provider_bookings if b.get('service_id') == service_id]
    if date:
        provider_bookings = [b for b in provider_bookings if b.get('date') == date]

    # 补充用户和服务信息
    for b in provider_bookings:
        user = next((u for u in users if u.get('id') == b.get('user_id')), None)
        b['user'] = {
            'id': user.get('id'),
            'username': user.get('username'),
            'email': user.get('email')
        } if user else None
        service = next((s for s in services if s.get('id') == b.get('service_id')), None)
        b['service'] = {
            'id': service.get('id'),
            'title': service.get('title'),
            'price': service.get('price'),
            'duration': service.get('duration')
        } if service else None

    # 按预约时间倒序排序
    provider_bookings.sort(key=lambda x: (x.get('date', ''), x.get('time', '')), reverse=True)
    return jsonify({'bookings': provider_bookings}), 200

# API路由：服务商确认预约
@app.route('/api/bookings/<booking_id>/accept', methods=['PUT'])
def accept_booking(booking_id):
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 确保是服务商
    if user_type != 'provider':
        return jsonify({'message': '只有服务商可以确认预约'}), 403
    
    try:
        # 查询预约
        booking = Booking.query.get(booking_id)
        if not booking:
            return jsonify({'message': '找不到预约'}), 404
        
        # 检查权限
        if booking.provider_id != user_id:
            return jsonify({'message': '无权操作此预约'}), 403
        
        # 检查预约状态
        if booking.status != 'pending':
            return jsonify({'message': '只有待确认预约才能被确认'}), 400
        
        # 更新预约状态
        booking.status = 'confirmed'
        booking.updated_at = datetime.now()
        
        # 创建通知
        try:
            notification = Notification(
                user_id=booking.user_id,
                title='预约已确认',
                message=f'您的预约 {booking.date} {booking.time} 已被服务商确认',
                type='booking',
                subtype='confirmed',
                data=json.dumps({
                    'booking_id': booking_id,
                    'service_id': booking.service_id,
                    'provider_id': booking.provider_id
                })
            )
            db.session.add(notification)
        except Exception as e:
            print(f"创建通知失败: {str(e)}")
        
        # 保存更改
        db.session.commit()
        
        # 返回更新后的预约
        return jsonify({
            'message': '预约已确认',
            'booking': booking.to_dict()
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'确认预约失败: {str(e)}'}), 500

# API路由：服务商拒绝预约
@app.route('/api/bookings/<booking_id>/reject', methods=['PUT'])
def reject_booking(booking_id):
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 确保是服务商
    if user_type != 'provider':
        return jsonify({'message': '只有服务商可以拒绝预约'}), 403
    
    try:
        # 查询预约
        booking = Booking.query.get(booking_id)
        if not booking:
            return jsonify({'message': '找不到预约'}), 404
        
        # 检查权限
        if booking.provider_id != user_id:
            return jsonify({'message': '无权操作此预约'}), 403
        
        # 检查预约状态
        if booking.status != 'pending':
            return jsonify({'message': '只有待确认预约才能被拒绝'}), 400
        
        # 获取拒绝原因
        data = request.json or {}
        
        # 更新预约状态
        booking.status = 'rejected'
        booking.reject_reason = data.get('reason', '')
        booking.reject_message = data.get('message', '')
        booking.updated_at = datetime.now()
        
        # 创建通知
        try:
            notification = Notification(
                user_id=booking.user_id,
                title='预约已拒绝',
                message=f'您的预约 {booking.date} {booking.time} 已被服务商拒绝',
                type='booking',
                subtype='rejected',
                data=json.dumps({
                    'booking_id': booking_id,
                    'service_id': booking.service_id,
                    'provider_id': booking.provider_id,
                    'reason': booking.reject_reason,
                    'message': booking.reject_message
                })
            )
            db.session.add(notification)
        except Exception as e:
            print(f"创建通知失败: {str(e)}")
        
        # 保存更改
        db.session.commit()
        
        # 返回更新后的预约
        return jsonify({
            'message': '预约已拒绝',
            'booking': booking.to_dict()
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'拒绝预约失败: {str(e)}'}), 500

@app.route('/api/provider/<provider_id>/available-timeslots', methods=['GET'])
def get_provider_available_timeslots(provider_id):
    """获取服务提供商特定日期的可用时间段（客户预约使用）"""
    from datetime import datetime, timedelta
    # 解码provider_id
    provider_id = urllib.parse.unquote(provider_id)
    date = request.args.get('date')
    service_id = request.args.get('service_id')
    
    if not date:
        return jsonify({'message': '缺少日期参数'}), 400
    
    try:
        # 解析日期字符串
        date_obj = datetime.strptime(date, '%Y-%m-%d').date()
        
        # 从MySQL数据库获取该服务提供商在指定日期的所有时间段
        timeslots = TimeSlot.query.filter_by(provider_id=provider_id, date=date_obj).all()
        
        # 如果数据库中没有时间段数据，则检查是否有工作模式设置
        if not timeslots:
            print(f"未找到日期 {date} 的时间段数据，尝试查找最近的工作模式设置")
            
            # 查找最近的一周数据作为参考
            # 计算当前周的开始日期（周一）
            today = datetime.now().date()
            start_of_week = today - timedelta(days=today.weekday())
            end_of_week = start_of_week + timedelta(days=6)
            
            # 查询当前周的时间段设置
            reference_timeslots = TimeSlot.query.filter_by(provider_id=provider_id).filter(
                TimeSlot.date >= start_of_week,
                TimeSlot.date <= end_of_week
            ).all()
            
            # 提取当前周的时间模式
            time_patterns = {}
            for slot in reference_timeslots:
                # 获取星期几 (0-6, 0是周一)
                weekday = slot.date.weekday()
                if weekday not in time_patterns:
                    time_patterns[weekday] = {'available': [], 'unavailable': []}
                
                if slot.is_available:
                    time_patterns[weekday]['available'].append(slot.time)
                else:
                    time_patterns[weekday]['unavailable'].append(slot.time)
            
            # 获取请求日期是星期几
            requested_weekday = date_obj.weekday()
            
            # 默认时间段为9:00-17:00，每半小时一段
            all_times = []
            for h in range(9, 17):  # 9点到16点
                all_times.append(f"{h:02d}:00")  # 整点
                all_times.append(f"{h:02d}:30")  # 半点
            all_times.append("17:00")  # 17:00
            
            # 如果有该星期几的时间模式，应用它
            if requested_weekday in time_patterns:
                print(f"找到星期{requested_weekday+1}的时间模式，应用到请求的日期")
                # 只保留在可用列表中且不在不可用列表中的时间段
                available_times = [t for t in all_times if 
                                  (not time_patterns[requested_weekday]['available'] or  # 如果没有明确的可用列表
                                   t in time_patterns[requested_weekday]['available']) and  # 或者在可用列表中
                                  t not in time_patterns[requested_weekday]['unavailable']]  # 且不在不可用列表中
            else:
                print(f"未找到星期{requested_weekday+1}的时间模式，使用默认时间段")
                # 过滤掉今天之前的日期和今天已过的时间
                today_str = datetime.now().strftime('%Y-%m-%d')
                now_time = datetime.now().strftime('%H:%M')
                
                if date < today_str:
                    available_times = []
                elif date == today_str:
                    available_times = [t for t in all_times if t > now_time]
                else:
                    available_times = all_times.copy()
            
            # 获取已经预约的时间段
            booked_slots = Booking.query.filter(
                Booking.provider_id == provider_id,
                Booking.date == date_obj,
                Booking.status.in_(['pending', 'confirmed'])  # 只考虑待确认和已确认的预约
            ).all()
            
            # 从可用时间段中移除已预约的时间段
            booked_times = [booking.time for booking in booked_slots]
            available_times = [t for t in available_times if t not in booked_times]
            
            return jsonify({
                'date': date,
                'available_times': available_times
            }), 200
        else:
            # 从数据库中筛选出可用的时间段
            available_times = [slot.time for slot in timeslots if slot.is_available]
        
            # 获取已经预约的时间段
            booked_slots = Booking.query.filter(
                Booking.provider_id == provider_id,
                Booking.date == date_obj,
                Booking.status.in_(['pending', 'confirmed'])  # 只考虑待确认和已确认的预约
            ).all()
            
            # 从可用时间段中移除已预约的时间段
            booked_times = [booking.time for booking in booked_slots]
            available_times = [t for t in available_times if t not in booked_times]
            
            # 过滤掉今天已过的时间
            if date == datetime.now().strftime('%Y-%m-%d'):
                now_time = datetime.now().strftime('%H:%M')
                available_times = [t for t in available_times if t > now_time]
            
            return jsonify({
                'date': date,
                'available_times': available_times
            }), 200
        
    except ValueError:
        return jsonify({'message': '日期格式无效，应为YYYY-MM-DD'}), 400
    except Exception as e:
        return jsonify({'message': f'获取可用时间段失败: {str(e)}'}), 500

# 服务管理API
@app.route('/api/services/<service_id>', methods=['PUT'])
@prevent_duplicate_requests
def update_service(service_id):
    """更新服务信息（MySQL版本）"""
    # 生成唯一请求ID
    request_id = f"req-{datetime.now().strftime('%H%M%S')}-{random.randint(1000, 9999)}"
    
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        print(f"[{request_id}] 缺少认证令牌")
        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
        print(f"[{request_id}] 令牌验证失败")
        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 确保是服务商
    if user_type != 'provider':
        print(f"[{request_id}] 用户类型错误: {user_type}")
        return jsonify({'message': '权限不足，仅服务商可更新服务'}), 403
    
    try:
        # 从数据库中查询服务
        service = Service.query.get(service_id)
        if not service:
            print(f"[{request_id}] 服务不存在: {service_id}")
            return jsonify({'message': '服务不存在'}), 404
        
        # 验证是否是此服务商的服务
        if service.provider_id != user_id:
            print(f"[{request_id}] 无权修改其他服务商的服务")
            return jsonify({'message': '无权修改其他服务商的服务'}), 403
        
        # 获取请求数据
        data = request.get_json()
        if not data:
            print(f"[{request_id}] 请求数据为空")
            return jsonify({'message': '无效的请求数据'}), 400
        
        # 更新服务信息
        if 'title' in data:
            service.title = data['title']
        
        if 'price' in data:
            try:
                service.price = float(data['price'])
            except:
                print(f"[{request_id}] 价格必须是数字")
                return jsonify({'message': '价格必须是数字'}), 400
        
        if 'price_unit' in data:
            service.price_unit = data['price_unit']
        
        if 'duration' in data:
            service.duration = int(data['duration'])
        
        if 'categories' in data:
            service.categories = json.dumps(data['categories'])
        
        if 'description' in data:
            service.description = data['description']
        
        if 'image' in data:
            service.image = data['image']
        
        if 'status' in data:
            service.status = data['status']
        
        # 更新修改时间
        service.updated_at = datetime.now()
        
        # 保存更改到数据库
        db.session.commit()
        
        print(f"[{request_id}] 服务更新成功: {service_id}")
        return jsonify({'message': '服务更新成功', 'service': service.to_dict()}), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"[{request_id}] 服务更新失败: {str(e)}")
        return jsonify({'message': f'服务更新失败: {str(e)}'}), 500

@app.route('/api/services/<service_id>/upload', methods=['POST'])
def upload_service_image(service_id):
    """上传服务图片"""
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 确保是服务商
    if user_type != 'provider':
                        return jsonify({'message': '权限不足，仅服务商可上传服务图片'}), 403
    
    # 验证服务所有权（如果提供了service_id）
    if service_id != 'new':  # 'new'表示正在创建新服务
        # 读取服务数据
        try:
            with open(SERVICES_FILE, 'r', encoding='utf-8') as f:
                services = json.load(f)
        except:
                            return jsonify({'message': '读取服务数据失败'}), 500
        
        # 查找服务并验证所有权
        service = next((s for s in services if s.get('id') == service_id), None)
        if not service:
                            return jsonify({'message': '服务不存在'}), 404
        
        if service.get('provider_id') != user_id:
                            return jsonify({'message': '无权操作其他服务商的服务'}), 403
    
    # 检查是否有文件
    if 'image' not in request.files:
                        return jsonify({'message': '未提供文件'}), 400
    
    file = request.files['image']
    
    # 检查文件名
    if file.filename == '':
                        return jsonify({'message': '未选择文件'}), 400
    
    # 检查文件类型
    if file and file.filename and allowed_file(file.filename):
        # 确保上传目录存在
        upload_dir = os.path.join('static', 'uploads', 'services')
        if not os.path.exists(upload_dir):
            os.makedirs(upload_dir)
        
        # 生成安全的文件名
        filename = secure_filename(str(file.filename))
        timestamp = int(time.time())
        new_filename = f"{timestamp}_{filename}"
        
        # 保存文件
        filepath = os.path.join(upload_dir, new_filename)
        file.save(filepath)
        
        # 生成访问URL
        file_url = f"/static/uploads/services/{new_filename}"
        
        return jsonify({
            'message': '图片上传成功',
            'file_url': file_url
        }), 200
    
    return jsonify({'message': '不允许的文件类型'}), 400

# API路由：更新用户头像
@app.route('/api/user/avatar', methods=['POST'])
def update_user_avatar():
    """更新用户或服务商头像"""
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
            return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
                        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    try:
        # 获取上传的文件
        if 'avatar' not in request.files:
                            return jsonify({'message': '没有上传文件'}), 400
        
        avatar_file = request.files['avatar']
        if avatar_file.filename == '':
                            return jsonify({'message': '没有选择文件'}), 400
        
        if avatar_file and allowed_file(avatar_file.filename, ['jpg', 'jpeg', 'png', 'gif']):
            # 生成安全的文件名
            filename = secure_filename(f"avatar_{user_type}_{user_id}_{int(time.time())}{os.path.splitext(avatar_file.filename)[1]}")
            
            # 确保上传目录存在
            avatar_folder = os.path.join(UPLOAD_FOLDER, 'avatars')
            if not os.path.exists(avatar_folder):
                os.makedirs(avatar_folder)
            
            # 保存文件
            filepath = os.path.join(avatar_folder, filename)
            avatar_file.save(filepath)
            
            # 更新用户或服务商头像URL
            avatar_url = f"/static/uploads/avatars/{filename}"
            
            if user_type == 'user':
                user = User.query.get(user_id)
                if not user:
                                    return jsonify({'message': '用户不存在'}), 404
                
                # 设置头像URL
                user.avatar = avatar_url
                user.updated_at = datetime.now()
            else:  # provider
                provider = Provider.query.get(user_id)
                if not provider:
                                    return jsonify({'message': '服务商不存在'}), 404
                
                # 设置头像URL
                provider.avatar = avatar_url
                provider.updated_at = datetime.now()
            
            # 保存到数据库
            db.session.commit()
            
            return jsonify({
                'message': '头像上传成功',
                'avatar_url': avatar_url
                            }), 200
        
        return jsonify({'message': '不允许的文件类型'}), 400
    except Exception as e:
        db.session.rollback()
        print(f"头像上传失败: {str(e)}")
        return jsonify({'message': f'头像上传失败: {str(e)}'}), 500

# API路由：获取用户地址 (重复定义，已被注释)
# @app.route('/api/user/addresses', methods=['GET'])
# def get_user_addresses_alt():
#     """获取用户地址列表(重复定义)"""
#     # 从请求头获取令牌
#     token = request.headers.get('Authorization')
#     if not token:
#                         return jsonify({'message': '缺少认证令牌'}), 401
    
#     # 移除Bearer前缀（如果有）
#     if token.startswith('Bearer '):
#         token = token[7:]
    
#     # 验证令牌
#     payload = verify_token(token)
#     if not payload:
#                         return jsonify({'message': '无效或过期的令牌'}), 401
    
#     user_id = payload.get('user_id')
#     user_type = payload.get('user_type')
    
#     # 确保是普通用户
#     if user_type != 'user':
#                         return jsonify({'message': '只有普通用户可以查看地址'}), 403
    
#     try:
#         # 查询用户地址
#         addresses = Address.query.filter_by(user_id=user_id).all()
        
#         # 转换为字典列表
#         address_list = [address.to_dict() for address in addresses]
        
#         return jsonify(address_list), 200
    
#     except Exception as e:
#         print(f"获取地址列表失败: {str(e)}")
#         return jsonify({'message': f'获取地址列表失败: {str(e)}'}), 500

# API路由：添加用户地址
# 注释掉重复的路由定义 - 已在前面定义过
# @app.route('/api/user/addresses', methods=['POST'])
# def add_user_address_duplicate():
#     """添加用户地址 (重复定义，已被注释)"""
#     # 从请求头获取令牌
#     token = request.headers.get('Authorization')
#     if not token:
#                         return jsonify({'message': '缺少认证令牌'}), 401
    
#     # 移除Bearer前缀（如果有）
#     if token.startswith('Bearer '):
#         token = token[7:]
    
#     # 验证令牌
#     payload = verify_token(token)
#     if not payload:
#                         return jsonify({'message': '无效或过期的令牌'}), 401
    
#     user_id = payload.get('user_id')
#     user_type = payload.get('user_type')
    
#     # 确保是普通用户
#     if user_type != 'user':
#                         return jsonify({'message': '只有普通用户可以添加地址'}), 403
    
#     # 获取请求数据
#     data = request.json or {}
#     label = data.get('label')
#     address = data.get('address')
    
#     if not all([label, address]):
#                         return jsonify({'message': '标签和地址都是必填的'}), 400
    
#     try:
#         # 创建新地址
#         new_address = Address(
#             user_id=user_id,
#             label=label,
#             address=address
#         )
        
#         # 保存到数据库
#         db.session.add(new_address)
#         db.session.commit()
        
#         return jsonify({
#             'message': '地址添加成功',
#             'address': new_address.to_dict()
#         }), 201
    
#     except Exception as e:
#         db.session.rollback()
#         print(f"添加地址失败: {str(e)}")
#         return jsonify({'message': f'添加地址失败: {str(e)}'}), 500

# API路由：更新用户地址
# @app.route('/api/user/addresses/<address_id>', methods=['PUT'])
# def update_user_address(address_id):
#     """更新用户地址"""
#     # 从请求头获取令牌
#     token = request.headers.get('Authorization')
#     if not token:
#                         return jsonify({'message': '缺少认证令牌'}), 401
    
#     # 移除Bearer前缀（如果有）
#     if token.startswith('Bearer '):
#         token = token[7:]
    
#     # 验证令牌
#     payload = verify_token(token)
#     if not payload:
#                         return jsonify({'message': '无效或过期的令牌'}), 401
    
#     user_id = payload.get('user_id')
#     user_type = payload.get('user_type')
    
#     # 确保是普通用户
#     if user_type != 'user':
#                         return jsonify({'message': '只有普通用户可以更新地址'}), 403
    
#     # 获取请求数据
#     data = request.json or {}
#     label = data.get('label')
#     address = data.get('address')
    
#     if not all([label, address]):
#                         return jsonify({'message': '标签和地址都是必填的'}), 400
    
#     try:
#         # 查找地址
#         addr = Address.query.filter_by(id=address_id, user_id=user_id).first()
#         if not addr:
#                             return jsonify({'message': '地址不存在或无权限修改'}), 404
        
#         # 更新地址
#         addr.label = label
#         addr.address = address
        
#         # 保存到数据库
#         db.session.commit()
        
#         return jsonify({
#             'message': '地址更新成功',
#             'address': addr.to_dict()
#                         }), 200
    
#     except Exception as e:
#         db.session.rollback()
#         print(f"更新地址失败: {str(e)}")
#         return jsonify({'message': f'更新地址失败: {str(e)}'}), 500

# API路由：删除用户地址
# @app.route('/api/user/addresses/<address_id>', methods=['DELETE'])
# def delete_user_address(address_id):
#     """删除用户地址"""
#     # 从请求头获取令牌
#     token = request.headers.get('Authorization')
#     if not token:
#                         return jsonify({'message': '缺少认证令牌'}), 401
    
#     # 移除Bearer前缀（如果有）
#     if token.startswith('Bearer '):
#         token = token[7:]
    
#     # 验证令牌
#     payload = verify_token(token)
#     if not payload:
#                         return jsonify({'message': '无效或过期的令牌'}), 401
    
#     user_id = payload.get('user_id')
#     user_type = payload.get('user_type')
    
#     # 只有普通用户可以使用此API
#     if user_type != 'user':
#                         return jsonify({'message': '权限不足'}), 403
    
#     # 查询地址
#     address = Address.query.filter_by(id=address_id, user_id=user_id).first()
#     if not address:
#                         return jsonify({'message': '地址不存在或无权限删除'}), 404
    
#     try:
#         db.session.delete(address)
#         db.session.commit()
#         return jsonify({'message': '地址删除成功'}), 200
#     except Exception as e:
#         db.session.rollback()
#         print(f"删除地址失败: {str(e)}")
#         return jsonify({'message': f'删除地址失败: {str(e)}'}), 500

# 测试路由：检查时间段表状态
@app.route('/api/test/timeslots', methods=['GET'])
def test_timeslots():
    """测试路由，检查时间段表状态"""
    try:
        # 获取所有时间段
        all_slots = TimeSlot.query.all()
        
        # 转换为字典列表
        result = []
        for slot in all_slots:
            result.append(slot.to_dict())
        
        # 获取数据库表信息
        table_info = {
            'total_slots': len(result),
            'table_name': TimeSlot.__tablename__,
            'columns': [column.name for column in TimeSlot.__table__.columns],
            'database_uri': app.config['SQLALCHEMY_DATABASE_URI'].split('@')[-1]  # 隐藏敏感信息
        }
        
        return jsonify({
            'status': 'success',
            'table_info': table_info,
            'slots_sample': result[:10] if result else []  # 只返回前10条数据作为样本
                        }), 200
    
    except Exception as e:
                        return jsonify({
            'status': 'error',
            'message': f'检查时间段表失败: {str(e)}'
        }), 500

@app.route('/api/debug/timeslots', methods=['GET'])
def debug_timeslots():
    """调试端点：获取特定日期范围内的所有时间段状态"""
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
                        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
                        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 确保是服务提供商
    if user_type != 'provider':
                        return jsonify({'message': '权限不足，仅服务提供商可访问此接口'}), 403
    
    # 获取查询参数
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    if not start_date or not end_date:
                        return jsonify({'message': '开始日期和结束日期是必需的'}), 400
    
    try:
        # 解析日期字符串
        start_date_obj = datetime.strptime(start_date, '%Y-%m-%d').date()
        end_date_obj = datetime.strptime(end_date, '%Y-%m-%d').date()
        
        # 查询数据库中的时间段
        timeslots = TimeSlot.query.filter_by(provider_id=user_id).filter(
            TimeSlot.date >= start_date_obj,
            TimeSlot.date <= end_date_obj
        ).all()
        
        # 按日期分组
        result = {}
        for slot in timeslots:
            date_str = slot.date.isoformat()
            if date_str not in result:
                result[date_str] = []
            
            result[date_str].append({
                'id': slot.id,
                'time': slot.time,
                'is_available': slot.is_available,
                'created_at': slot.created_at.isoformat() if slot.created_at else None,
                'updated_at': slot.updated_at.isoformat() if slot.updated_at else None
            })
        
        return jsonify({
            'provider_id': user_id,
            'date_range': {
                'start': start_date,
                'end': end_date
            },
            'timeslots_by_date': result,
            'total_count': len(timeslots)
                        }), 200
    
    except ValueError:
                        return jsonify({'message': '日期格式无效，应为YYYY-MM-DD'}), 400
    except Exception as e:
                        return jsonify({'message': f'获取时间段失败: {str(e)}'}), 500

# API路由：提供商设置
@app.route('/api/provider/settings', methods=['GET', 'PUT'])
def provider_settings():
    print(f"API被调用: /api/provider/settings [{request.method}]")
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 确保是服务提供商
    if user_type != 'provider':
        return jsonify({'message': '权限不足，仅服务提供商可访问此接口'}), 403
    
    # 获取提供商
    provider = Provider.query.get(user_id)
    if not provider:
        return jsonify({'message': '提供商不存在'}), 404
    
    # 处理GET请求 - 获取设置
    if request.method == 'GET':
        # 从provider表中获取设置，如果不存在则返回默认值
        settings = {
            'booking_notice_time': provider.booking_notice_time if hasattr(provider, 'booking_notice_time') else 24,
            'max_booking_per_day': provider.max_booking_per_day if hasattr(provider, 'max_booking_per_day') else 10,
            'allow_instant_booking': provider.allow_instant_booking if hasattr(provider, 'allow_instant_booking') else True,
            'auto_confirm_booking': provider.auto_confirm_booking if hasattr(provider, 'auto_confirm_booking') else False
        }
        return jsonify(settings), 200
    
    # 处理PUT请求 - 更新设置
    elif request.method == 'PUT':
        data = request.json or {}
        
        # 更新设置
        if 'booking_notice_time' in data:
            provider.booking_notice_time = data['booking_notice_time']
        if 'max_booking_per_day' in data:
            provider.max_booking_per_day = data['max_booking_per_day']
        if 'allow_instant_booking' in data:
            provider.allow_instant_booking = data['allow_instant_booking']
        if 'auto_confirm_booking' in data:
            provider.auto_confirm_booking = data['auto_confirm_booking']
        
        provider.updated_at = datetime.now()
        
        try:
            db.session.commit()
            
            # 返回更新后的设置
            settings = {
                'booking_notice_time': provider.booking_notice_time if hasattr(provider, 'booking_notice_time') else 24,
                'max_booking_per_day': provider.max_booking_per_day if hasattr(provider, 'max_booking_per_day') else 10,
                'allow_instant_booking': provider.allow_instant_booking if hasattr(provider, 'allow_instant_booking') else True,
                'auto_confirm_booking': provider.auto_confirm_booking if hasattr(provider, 'auto_confirm_booking') else False
            }
            return jsonify({'message': '设置更新成功', 'settings': settings}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({'message': f'设置更新失败: {str(e)}'}), 500

# API路由：提供商营业时间
@app.route('/api/provider/business-hours', methods=['GET', 'PUT'])
def provider_business_hours():
    print(f"API被调用: /api/provider/business-hours [{request.method}]")
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 确保是服务提供商
    if user_type != 'provider':
        return jsonify({'message': '权限不足，仅服务提供商可访问此接口'}), 403
    
    # 获取提供商
    provider = Provider.query.get(user_id)
    if not provider:
        return jsonify({'message': '提供商不存在'}), 404
    
    # 处理GET请求 - 获取营业时间
    if request.method == 'GET':
        # 从provider表中获取营业时间，如果不存在则返回默认值
        business_hours_json = provider.business_hours if hasattr(provider, 'business_hours') and provider.business_hours else None
        
        if business_hours_json:
            try:
                business_hours = json.loads(business_hours_json)
            except:
                business_hours = get_default_business_hours()
        else:
            business_hours = get_default_business_hours()
        
        return jsonify(business_hours), 200
    
    # 处理PUT请求 - 更新营业时间
    elif request.method == 'PUT':
        data = request.json or {}
        
        # 验证数据格式
        required_days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        for day in required_days:
            if day not in data:
                return jsonify({'message': f'缺少必要的日期: {day}'}), 400
            
            day_data = data[day]
            if not isinstance(day_data, dict) or 'start' not in day_data or 'end' not in day_data or 'is_open' not in day_data:
                return jsonify({'message': f'{day}的数据格式无效，必须包含start、end和is_open字段'}), 400
        
        # 更新营业时间
        provider.business_hours = json.dumps(data)
        provider.updated_at = datetime.now()
        
        try:
            db.session.commit()
            return jsonify({'message': '营业时间更新成功', 'business_hours': data}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({'message': f'营业时间更新失败: {str(e)}'}), 500

# 辅助函数：获取默认营业时间
def get_default_business_hours():
    return {
        'monday': {'start': '09:00', 'end': '17:00', 'is_open': True},
        'tuesday': {'start': '09:00', 'end': '17:00', 'is_open': True},
        'wednesday': {'start': '09:00', 'end': '17:00', 'is_open': True},
        'thursday': {'start': '09:00', 'end': '17:00', 'is_open': True},
        'friday': {'start': '09:00', 'end': '17:00', 'is_open': True},
        'saturday': {'start': '10:00', 'end': '15:00', 'is_open': True},
        'sunday': {'start': '00:00', 'end': '00:00', 'is_open': False}
    }

# API路由：提供商资质
@app.route('/api/provider/qualifications', methods=['GET', 'POST'])
def provider_qualifications():
    print(f"API被调用: /api/provider/qualifications [{request.method}]")
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 确保是服务提供商
    if user_type != 'provider':
        return jsonify({'message': '权限不足，仅服务提供商可访问此接口'}), 403
    
    # 获取提供商
    provider = Provider.query.get(user_id)
    if not provider:
        return jsonify({'message': '提供商不存在'}), 404
    
    # 处理GET请求 - 获取资质列表
    if request.method == 'GET':
        # 从provider表中获取资质，如果不存在则返回空列表
        qualifications_json = provider.qualifications if hasattr(provider, 'qualifications') and provider.qualifications else None
        
        if qualifications_json:
            try:
                qualifications = json.loads(qualifications_json)
            except:
                qualifications = []
        else:
            qualifications = []
        
        return jsonify(qualifications), 200
    
    # 处理POST请求 - 添加新资质
    elif request.method == 'POST':
        data = request.json or {}
        
        # 验证必填字段
        required_fields = ['title', 'issuing_organization', 'issue_date']
        for field in required_fields:
            if field not in data:
                return jsonify({'message': f'缺少必填字段: {field}'}), 400
        
        # 获取现有资质
        qualifications_json = provider.qualifications if hasattr(provider, 'qualifications') and provider.qualifications else None
        
        if qualifications_json:
            try:
                qualifications = json.loads(qualifications_json)
            except:
                qualifications = []
        else:
            qualifications = []
        
        # 添加新资质
        new_qualification = {
            'id': str(uuid.uuid4()),
            'title': data['title'],
            'issuing_organization': data['issuing_organization'],
            'issue_date': data['issue_date'],
            'expiration_date': data.get('expiration_date'),
            'credential_id': data.get('credential_id'),
            'created_at': datetime.now().isoformat()
        }
        
        qualifications.append(new_qualification)
        
        # 更新提供商资质
        provider.qualifications = json.dumps(qualifications)
        provider.updated_at = datetime.now()
        
        try:
            db.session.commit()
            return jsonify({'message': '资质添加成功', 'qualification': new_qualification}), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({'message': f'资质添加失败: {str(e)}'}), 500

# API路由：提供商统计数据
@app.route('/api/provider/stats', methods=['GET'])
def provider_stats():
    print(f"API被调用: /api/provider/stats")
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 确保是服务提供商
    if user_type != 'provider':
        return jsonify({'message': '权限不足，仅服务提供商可访问此接口'}), 403
    
    try:
        # 获取服务数量
        service_count = Service.query.filter_by(provider_id=user_id).count()
        
        # 获取预约数量
        booking_count = Booking.query.filter_by(provider_id=user_id).count()
        
        # 获取已完成预约数量
        completed_booking_count = Booking.query.filter_by(provider_id=user_id, status='completed').count()
        
        # 获取评价数量和平均评分
        reviews = Review.query.filter_by(provider_id=user_id).all()
        review_count = len(reviews)
        avg_rating = sum(review.rating for review in reviews) / review_count if review_count > 0 else 0
        
        # 获取活跃服务数量
        active_service_count = Service.query.filter_by(provider_id=user_id, status='active').count()
        
        # 获取本月预约数量
        current_month = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        next_month = (current_month + timedelta(days=32)).replace(day=1)
        bookings_this_month = Booking.query.filter(
            Booking.provider_id == user_id,
            Booking.created_at >= current_month,
            Booking.created_at < next_month
        ).count()
        
        # 获取本周预约数量
        today = datetime.now().date()
        start_of_week = today - timedelta(days=today.weekday())
        end_of_week = start_of_week + timedelta(days=7)
        bookings_this_week = Booking.query.filter(
            Booking.provider_id == user_id,
            Booking.date >= start_of_week,
            Booking.date < end_of_week
        ).count()
        
        # 返回统计数据
        stats = {
            'service_count': service_count,
            'active_service_count': active_service_count,
            'booking_count': booking_count,
            'completed_booking_count': completed_booking_count,
            'review_count': review_count,
            'avg_rating': round(avg_rating, 1),
            'bookings_this_month': bookings_this_month,
            'bookings_this_week': bookings_this_week
        }
        
        return jsonify(stats), 200
    
    except Exception as e:
        return jsonify({'message': f'获取统计数据失败: {str(e)}'}), 500

# API路由：提供商评价
@app.route('/api/provider/reviews', methods=['GET'])
def provider_reviews():
    print(f"API被调用: /api/provider/reviews")
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 确保是服务提供商
    if user_type != 'provider':
        return jsonify({'message': '权限不足，仅服务提供商可访问此接口'}), 403
    
    try:
        # 获取提供商的评价
        reviews = Review.query.filter_by(provider_id=user_id).order_by(Review.created_at.desc()).all()
        
        # 转换为JSON格式
        result = []
        for review in reviews:
            review_data = review.to_dict()
            
            # 获取用户信息
            user = User.query.get(review.user_id)
            if user:
                review_data['user'] = {
                    'id': user.id,
                    'username': user.username,
                    'avatar': user.avatar
                }
            
            # 获取服务信息
            service = Service.query.get(review.service_id)
            if service:
                review_data['service'] = {
                    'id': service.id,
                    'title': service.title,
                    'image': service.image
                }
            
            result.append(review_data)
        
        return jsonify(result), 200
    
    except Exception as e:
        return jsonify({'message': f'获取评价失败: {str(e)}'}), 500

# API路由：提供商头像上传
@app.route('/api/provider/avatar', methods=['POST'])
def upload_provider_avatar():
    print(f"API被调用: /api/provider/avatar")
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    user_type = payload.get('user_type')
    
    # 确保是服务提供商
    if user_type != 'provider':
        return jsonify({'message': '权限不足，仅服务提供商可访问此接口'}), 403
    
    # 检查是否有文件上传
    if 'avatar' not in request.files:
        return jsonify({'message': '没有找到上传的文件'}), 400
    
    file = request.files['avatar']
    
    # 如果用户没有选择文件，浏览器也会发送一个空的文件
    if file.filename == '':
        return jsonify({'message': '没有选择文件'}), 400
    
    # 检查文件类型
    allowed_extensions = {'png', 'jpg', 'jpeg', 'gif'}
    if not allowed_file(file.filename, allowed_extensions):
        return jsonify({'message': '不支持的文件类型，仅支持PNG、JPG、JPEG和GIF'}), 400
    
    try:
        # 生成安全的文件名
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        new_filename = f"provider_{user_id}_{timestamp}_{filename}"
        
        # 确保上传目录存在
        avatar_folder = os.path.join(UPLOAD_FOLDER, 'avatars')
        if not os.path.exists(avatar_folder):
            os.makedirs(avatar_folder)
        
        # 保存文件
        filepath = os.path.join(avatar_folder, new_filename)
        file.save(filepath)
        
        # 更新提供商头像
        provider = Provider.query.get(user_id)
        if provider:
            # 获取相对路径
            relative_path = f"/static/uploads/avatars/{new_filename}"
            provider.avatar = relative_path
            provider.updated_at = datetime.now()
            db.session.commit()
            
            return jsonify({
                'message': '头像上传成功',
                'avatar_url': relative_path
            }), 200
        else:
            return jsonify({'message': '提供商不存在'}), 404
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'头像上传失败: {str(e)}'}), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='0.0.0.0')

# API路由：获取特定服务的评论
@app.route('/api/reviews/service/<service_id>', methods=['GET'])
def get_service_reviews(service_id):
    """获取特定服务的所有评论"""
    try:
        # 查询服务
        service = Service.query.get(service_id)
        if not service:
            return jsonify({'message': '服务不存在'}), 404
        
        # 获取该服务的所有评论
        reviews = Review.query.filter_by(service_id=service_id).all()
        
        # 格式化评论数据
        reviews_data = []
        for review in reviews:
            review_dict = review.to_dict()
            
            # 添加用户信息
            user = User.query.get(review.user_id)
            if user:
                review_dict['user'] = {
                    'id': user.id,
                    'username': user.username,
                    'avatar': user.avatar
                }
            
            # 添加提供商信息
            provider = Provider.query.get(review.provider_id)
            if provider:
                review_dict['provider'] = {
                    'id': provider.id,
                    'username': provider.username,
                    'business_name': provider.business_name
                }
            
            reviews_data.append(review_dict)
        
        return jsonify(reviews_data), 200
    except Exception as e:
        return jsonify({'message': f'获取服务评论失败: {str(e)}'}), 500

# API路由：检查服务是否已收藏
@app.route('/api/favorites/check/<service_id>', methods=['GET'])
def check_favorite(service_id):
    """检查用户是否已收藏指定服务"""
    # 从请求头获取令牌
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'message': '缺少认证令牌'}), 401
    
    # 移除Bearer前缀（如果有）
    if token.startswith('Bearer '):
        token = token[7:]
    
    # 验证令牌
    payload = verify_token(token)
    if not payload:
        return jsonify({'message': '无效或过期的令牌'}), 401
    
    user_id = payload.get('user_id')
    
    try:
        # 查询服务
        service = Service.query.get(service_id)
        if not service:
            return jsonify({'message': '服务不存在'}), 404
        
        # 检查是否已收藏
        favorite = Favorite.query.filter_by(user_id=user_id, service_id=service_id).first()
        
        return jsonify({
            'is_favorite': favorite is not None,
            'favorite_id': favorite.id if favorite else None
        }), 200
    except Exception as e:
        return jsonify({'message': f'检查收藏状态失败: {str(e)}'}), 500
