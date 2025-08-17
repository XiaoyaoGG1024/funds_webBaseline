import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'funds_visualization',
  charset: 'utf8mb4',
  timezone: '+08:00'
}

let pool = null

export const initDatabase = () => {
  try {
    pool = mysql.createPool({
      ...dbConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      acquireTimeout: 60000,
      timeout: 60000
    })
    
    console.log('数据库连接池初始化成功')
    return pool
  } catch (error) {
    console.error('数据库连接池初始化失败:', error)
    throw error
  }
}

export const getConnection = async () => {
  if (!pool) {
    pool = initDatabase()
  }
  return await pool.getConnection()
}

export const query = async (sql, params = []) => {
  const connection = await getConnection()
  try {
    const [rows] = await connection.execute(sql, params)
    return rows
  } catch (error) {
    console.error('数据库查询错误:', error)
    throw error
  } finally {
    connection.release()
  }
}

export { pool }