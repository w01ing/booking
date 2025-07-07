#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}开始配置MySQL服务管理${NC}"

# 检查MySQL连接
echo -e "${YELLOW}检查MySQL连接...${NC}"
if ! mysql -u root -p123456 -e "SELECT 'MySQL连接成功'" 2>/dev/null; then
  echo -e "${RED}MySQL连接失败! 请确保MySQL服务已启动且凭据正确${NC}"
  echo "默认配置为: 用户名=root, 密码=123456"
  echo "如果您的MySQL配置不同，请修改app.py中的DATABASE_URI和此脚本中的连接参数"
  exit 1
fi

# 创建数据库
echo -e "${YELLOW}创建service_booking数据库...${NC}"
mysql -u root -p123456 -e "CREATE DATABASE IF NOT EXISTS service_booking CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null
if [ $? -eq 0 ]; then
  echo -e "${GREEN}数据库创建成功!${NC}"
else
  echo -e "${RED}数据库创建失败!${NC}"
  exit 1
fi

# 运行数据库初始化
echo -e "${YELLOW}初始化数据库表...${NC}"
python db_init.py
if [ $? -eq 0 ]; then
  echo -e "${GREEN}数据库表初始化成功!${NC}"
else
  echo -e "${RED}数据库表初始化失败!${NC}"
  exit 1
fi

# 运行数据迁移脚本
echo -e "${YELLOW}迁移服务数据到MySQL...${NC}"
python migrate_services_to_mysql.py
if [ $? -eq 0 ]; then
  echo -e "${GREEN}服务数据迁移成功!${NC}"
else
  echo -e "${RED}服务数据迁移失败!${NC}"
  exit 1
fi

echo -e "${GREEN}MySQL服务管理配置完成!${NC}"
echo -e "${YELLOW}现在您可以启动应用：${NC} python run.py" 