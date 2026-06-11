const express = require('express')
const cors = require('cors')
const path = require('fs')
const { initDB } = require('./models')

const authRoutes = require('./routes/auth')
const jobRoutes = require('./routes/jobs')
const resumeRoutes = require('./routes/resumes')
const reviewRoutes = require('./routes/reviews')
const { router: applicationRoutes } = require('./routes/applications')

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors({
  origin: true,
  credentials: true
}))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/auth', authRoutes)
app.use('/api/jobs', jobRoutes)
app.use('/api/resumes', resumeRoutes)
app.use('/api/reviews', reviewRoutes)
app.use('/api/applications', applicationRoutes)

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  })
})

const startServer = async () => {
  try {
    await initDB()
    console.log('Database initialized')

    if (require.main === module) {
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`)
      })
    }
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()

module.exports = app
