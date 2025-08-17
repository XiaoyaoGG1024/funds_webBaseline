# 资金流向可视化系统 禁止二开贩卖

基于Vue3 + Node.js + MySQL的全栈资金流向可视化系统，使用ECharts展示资金交易路径的力导图。

找不到工作随手做一个开源项目，希望对各位有所帮助，如果有空会继续更新

## 📌 项目特点

- 🎯 **直观的资金流向图谱**：使用ECharts力导图展示复杂的资金关系
- 🔍 **智能搜索**：支持按卡号、姓名搜索定位
- 🎨 **交互式操作**：节点拖拽、点击展开、详情查看
- 📊 **数据过滤**：按交易类型过滤显示
- 📸 **多格式导出**：支持PNG图片和CSV数据导出
- ⚡ **高性能**：优化的数据库查询和前端渲染

## 🛠️ 技术栈

### 前端
- **Vue 3** - 渐进式JavaScript框架
- **ECharts** - 数据可视化图表库
- **Axios** - HTTP客户端
- **Vite** - 构建工具
- **File-saver** - 文件导出
- **Moment.js** - 时间处理

### 后端
- **Node.js** - JavaScript运行环境
- **Express** - Web应用框架
- **MySQL** - 关系型数据库
- **mysql2** - MySQL驱动

## 🚀 快速开始

### 环境要求
- Node.js >= 16.0.0
- MySQL >= 8.0
- npm >= 7.0.0


### 1. 数据库初始化
```bash
# 启动MySQL服务
# 执行数据库初始化脚本
mysql -u root -p < database/init.sql
```

### 2. 后端设置
```bash
cd backend
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置数据库连接信息

# 启动后端服务
npm run dev
```

### 3. 前端设置
```bash
cd frontend
npm install

# 启动前端开发服务器
npm run dev
```

### 5. 访问应用
打开浏览器访问 `http://localhost:3000`

## 📁 项目结构

```
funds_web/
├── frontend/                 # Vue3前端项目
│   ├── src/
│   │   ├── components/      # 组件
│   │   ├── views/          # 页面
│   │   ├── api/            # API接口
│   │   └── utils/          # 工具函数
│   ├── package.json
│   └── vite.config.js
├── backend/                 # Node.js后端项目
│   ├── config/             # 配置文件
│   ├── models/             # 数据模型
│   ├── routes/             # 路由
│   ├── utils/              # 工具函数
│   ├── server.js           # 入口文件
│   └── package.json
├── database/               # 数据库脚本
│   ├── init.sql           # 初始化脚本
│   └── README.md          # 数据库说明
```

## 🔧 主要功能

### 1. 图谱可视化
- 以指定卡号为起点展示资金流向
- 力导图布局，支持节点拖拽
- 根据收付方向区分颜色

### 2. 交互功能
- 点击节点查看详细信息
- 递归展开交易路径
- 搜索定位特定节点
- 按条件过滤显示

### 3. 数据导出
- PNG格式图片导出
- CSV格式数据导出
- 自定义导出参数

## 📊 数据库设计

### 核心表结构

基于python、sql对数据进行清洗建模三套模型未开源(数据处理，卡标签，卡研判)

- **交易明细表**：存储所有交易记录
  - 通过python对经侦调卡数据返回进行清洗

- **用户表**：用户基本信息
- **汇总表**：统计分析数据
  - 个人案件总结所得指标字段


### 性能优化
- 复合索引优化查询
- 触发器自动维护统计
- 视图预计算关联数据

## 🔌 API接口

### 图谱数据
```
GET /api/graph/:cardId
GET /api/graph/:cardId?minAmount=1000&maxAmount=50000
```

### 节点详情
```
GET /api/node/:cardId
```

### 搜索
```
GET /api/search?q=关键词
```



## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 📞 联系方式

如有问题或建议，请通过以下方式联系：
- 提交 Issue
- 发送邮件至 [1774958836@qq.com]

---

⭐ 如果这个项目对你有帮助，请给它一个星标！

有经济能力打赏一杯奶茶钱，谢谢老板

![](README.assets/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20250817161045_15.jpg)
## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=XiaoyaoGG1024/funds_webBaseline&type=Date)](https://www.star-history.com/#XiaoyaoGG1024/funds_webBaseline&Date)
