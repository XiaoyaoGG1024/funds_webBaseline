import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { graphRouter } from './routes/graph.js'
import { nodeRouter } from './routes/node.js'
import { searchRouter } from './routes/search.js'


dotenv.config()

const app = express()
const PORT = process.env.PORT || 8000

app.use(cors())
app.use(express.json())

app.use('/api/graph', graphRouter)
app.use('/api/node', nodeRouter)
app.use('/api/search', searchRouter)


app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '资金流向可视化系统API运行正常' })
})

app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ 
    error: '服务器内部错误', 
    message: err.message 
  })
})

app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' })
})

app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`)
  console.log(`健康检查: http://localhost:${PORT}/api/health`)
})