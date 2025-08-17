-- 资金流向可视化数据库初始化脚本（含1000+模拟数据）
CREATE DATABASE IF NOT EXISTS funds_visualization 
  DEFAULT CHARACTER SET utf8mb4 
  DEFAULT COLLATE utf8mb4_unicode_ci;
USE funds_visualization;

-- 交易明细表
CREATE TABLE IF NOT EXISTS 交易明细表 (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    交易卡号 VARCHAR(50) NOT NULL COMMENT '发起交易的卡片',
    交易账号 VARCHAR(50),
    交易户名 VARCHAR(100),
    交易证件号码 VARCHAR(30),
    交易时间 DATETIME NOT NULL,
    交易金额 DECIMAL(15,2) NOT NULL,
    交易余额 DECIMAL(15,2),
    收付标志 VARCHAR(10) NOT NULL,
    交易对手账卡号 VARCHAR(50) NOT NULL,
    对手户名 VARCHAR(100),
    对手身份证号 VARCHAR(30),
    对手开户银行 VARCHAR(200),
    对手交易余额 DECIMAL(15,2),
    IP地址 VARCHAR(50),
    MAC地址 VARCHAR(30),
    交易网点名称 VARCHAR(200),
    发生地 VARCHAR(100),
    商户名称 VARCHAR(200),
    商户代码 VARCHAR(50),
    摘要说明 TEXT,
    交易类型 VARCHAR(50),
    币种 VARCHAR(10) DEFAULT 'CNY',
    交易是否成功 VARCHAR(10) DEFAULT '是',
    原始文件路径 VARCHAR(500),
    传票号 VARCHAR(50),
    凭证号 VARCHAR(50),
    创建时间 TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    更新时间 TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_card_id (交易卡号),
    INDEX idx_counterpart_card (交易对手账卡号),
    INDEX idx_transaction_time (交易时间),
    INDEX idx_amount (交易金额),
    INDEX idx_direction (收付标志),
    INDEX idx_success (交易是否成功),
    INDEX idx_card_counterpart (交易卡号, 交易对手账卡号),
    INDEX idx_time_amount (交易时间, 交易金额)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 用户表
CREATE TABLE IF NOT EXISTS 用户表 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    卡号 VARCHAR(50) NOT NULL UNIQUE,
    姓名 VARCHAR(100) NOT NULL,
    身份证号 VARCHAR(30),
    开户银行 VARCHAR(200),
    开户时间 DATE,
    账户状态 VARCHAR(20) DEFAULT '正常',
    风险等级 VARCHAR(20) DEFAULT '低风险',
    创建时间 TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    更新时间 TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_card_id (卡号),
    INDEX idx_name (姓名),
    INDEX idx_id_card (身份证号),
    INDEX idx_risk_level (风险等级)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 汇总表
CREATE TABLE IF NOT EXISTS 汇总表 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    主端卡号 VARCHAR(50) NOT NULL UNIQUE,
    最后交易时间 DATETIME,
    首次交易时间 DATETIME,
    交易次数 INT DEFAULT 0,
    交易流水 VARCHAR(100),
    疑似团伙卡 int,
    交易余额 DECIMAL(18,2) DEFAULT 0,
    出款次数 INT DEFAULT 0,
    进款次数 INT DEFAULT 0,
    单次出款平均值 DECIMAL(15,2) DEFAULT 0,
    单次进款平均值 DECIMAL(15,2) DEFAULT 0,
    峰值日期 DATE,
    峰值次数 INT DEFAULT 0,
    三方支付次数 INT DEFAULT 0,
    公司次数 INT DEFAULT 0,
    消费次数 INT DEFAULT 0,
    空壳公司次数 INT DEFAULT 0,
    转账次数 INT DEFAULT 0,
    三方支付金额 DECIMAL(18,2) DEFAULT 0,
    公司金额 DECIMAL(18,2) DEFAULT 0,
    消费金额 DECIMAL(18,2) DEFAULT 0,
    空壳公司金额 DECIMAL(18,2) DEFAULT 0,
    转账金额 DECIMAL(18,2) DEFAULT 0,
    消费率 DECIMAL(6,4) DEFAULT 0,
    消费占比 DECIMAL(6,4) DEFAULT 0,
    进出比 DECIMAL(6,4) DEFAULT 0,
    卡性质 VARCHAR(100),
    INDEX idx_card_id (主端卡号)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO 用户表 (卡号, 姓名, 身份证号, 开户银行, 开户时间)
SELECT 
  CONCAT('6228', LPAD(1000000000 + t.n, 10, '0')) AS 卡号,
  CONCAT('用户', LPAD(t.n, 4, '0')) AS 姓名,
  CONCAT('11010119', LPAD(100000 + t.n, 6, '0'), 'X') AS 身份证号,
  CASE t.n % 5
    WHEN 0 THEN '中国工商银行'
    WHEN 1 THEN '中国建设银行'
    WHEN 2 THEN '中国农业银行'
    WHEN 3 THEN '中国银行'
    ELSE '招商银行' END AS 开户银行,
  DATE_ADD('2020-01-01', INTERVAL t.n DAY) AS 开户时间
FROM (
  SELECT @rownum := @rownum + 1 AS n FROM 
    (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) t1,
    (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) t2,
    (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) t3
    , (SELECT @rownum := 1) r
  LIMIT 1200
) t;

-- 批量插入1000+交易明细（卡号唯一，用户表已存在）
INSERT INTO 交易明细表 (
  交易卡号, 交易账号, 交易户名, 交易证件号码, 交易时间, 交易金额, 交易余额, 收付标志, 交易对手账卡号, 对手户名, 对手身份证号, 摘要说明, 交易类型, 交易是否成功
)
SELECT 
  u1.卡号,
  CONCAT('ACC', LPAD(u1.id, 6, '0')),
  u1.姓名,
  u1.身份证号,
  DATE_ADD('2024-01-01', INTERVAL (u1.id + u2.id) DAY),
  ROUND(1000 + (u1.id * u2.id) % 100000, 2),
  ROUND(10000 + (u1.id * u2.id) % 50000, 2),
  CASE WHEN u1.id % 2 = 0 THEN '收' ELSE '付' END,
  u2.卡号,
  u2.姓名,
  u2.身份证号,
  CASE WHEN u1.id % 3 = 0 THEN '工资' WHEN u1.id % 3 = 1 THEN '转账' ELSE '消费' END,
  CASE WHEN u1.id % 3 = 0 THEN '工资' WHEN u1.id % 3 = 1 THEN '转账' ELSE '消费' END,
  '是'
FROM 用户表 u1
JOIN 用户表 u2 ON u1.卡号 <> u2.卡号
WHERE u1.id <= 1000 AND u2.id <= 10
LIMIT 1500;

-- 批量插入汇总表（主端卡号唯一，部分统计字段为模拟数据）
INSERT INTO 汇总表 (
  主端卡号, 最后交易时间, 首次交易时间, 交易次数, 交易流水, 疑似团伙卡, 交易余额, 出款次数, 进款次数, 单次出款平均值, 单次进款平均值, 峰值日期, 峰值次数, 三方支付次数, 公司次数, 消费次数, 空壳公司次数, 转账次数, 三方支付金额, 公司金额, 消费金额, 空壳公司金额, 转账金额, 消费率, 消费占比, 进出比, 卡性质
)
SELECT 
  u.卡号,
  DATE_ADD('2024-01-01', INTERVAL u.id * 2 DAY),
  DATE_ADD('2024-01-01', INTERVAL u.id DAY),
  10 + u.id % 20,
  CONCAT('流水', u.id),
  CASE WHEN u.id % 10 = 0 THEN 1 ELSE 0 END,
  ROUND(10000 + u.id * 10, 2),
  u.id % 5,
  u.id % 7,
  ROUND(1000 + u.id * 2, 2),
  ROUND(800 + u.id * 1.5, 2),
  DATE_ADD('2024-01-01', INTERVAL u.id * 2 DAY),
  u.id % 3,
  u.id % 4,
  u.id % 6,
  u.id % 8,
  u.id % 2,
  u.id % 9,
  ROUND(5000 + u.id * 3, 2),
  ROUND(2000 + u.id * 2, 2),
  ROUND(3000 + u.id * 2.5, 2),
  ROUND(1000 + u.id * 1.2, 2),
  ROUND(4000 + u.id * 2.2, 2),
  ROUND((u.id % 10) / 10, 4),
  ROUND((u.id % 5) / 10, 4),
  ROUND((u.id % 7) / 10, 4),
  CASE WHEN u.id % 3 = 0 THEN '收款卡' WHEN u.id % 3 = 1 THEN '中转卡' ELSE '出款卡' END
FROM 用户表 u
WHERE u.id <= 1000;
-- 汇总表可通过后续分析脚本或触发器自动生成
COMMIT;
