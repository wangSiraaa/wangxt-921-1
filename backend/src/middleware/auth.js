const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'internship-matching-secret-key-2024'

const authMiddleware = (roles = []) => {
  return (req, res, next) => {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: '未提供认证令牌' })
    }

    const token = authHeader.substring(7)
    try {
      const decoded = jwt.verify(token, JWT_SECRET)
      req.user = decoded

      if (roles.length > 0 && !roles.includes(decoded.role)) {
        return res.status(403).json({ message: '权限不足' })
      }

      next()
    } catch (error) {
      return res.status(401).json({ message: '无效的认证令牌' })
    }
  }
}

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}

module.exports = { authMiddleware, generateToken, JWT_SECRET }
