const express = require('express')
const bcrypt = require('bcryptjs')
const { User, Company, Student, Teacher } = require('../models')
const { generateToken, authMiddleware } = require('../middleware/auth')

const router = express.Router()

router.post('/register', async (req, res) => {
  try {
    const { username, password, role, name, email, phone, extra } = req.body

    if (!username || !password || !role || !name) {
      return res.status(400).json({ message: '缺少必填字段' })
    }

    if (!['company', 'student', 'teacher'].includes(role)) {
      return res.status(400).json({ message: '无效的角色类型' })
    }

    const existingUser = await User.findOne({ where: { username } })
    if (existingUser) {
      return res.status(400).json({ message: '用户名已存在' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await User.create({
      username,
      password: hashedPassword,
      role,
      name,
      email,
      phone
    })

    let profile = null
    if (role === 'company') {
      profile = await Company.create({
        userId: user.id,
        companyName: extra?.companyName || name,
        industry: extra?.industry,
        address: extra?.address,
        description: extra?.description
      })
    } else if (role === 'student') {
      if (!extra?.studentNo || !extra?.major || !extra?.grade || !extra?.college) {
        await user.destroy()
        return res.status(400).json({ message: '学生信息不完整' })
      }
      profile = await Student.create({
        userId: user.id,
        studentNo: extra.studentNo,
        major: extra.major,
        grade: extra.grade,
        college: extra.college,
        hasInsurance: extra.hasInsurance || false
      })
    } else if (role === 'teacher') {
      if (!extra?.teacherNo || !extra?.department) {
        await user.destroy()
        return res.status(400).json({ message: '老师信息不完整' })
      }
      profile = await Teacher.create({
        userId: user.id,
        teacherNo: extra.teacherNo,
        department: extra.department,
        title: extra?.title
      })
    }

    const token = generateToken(user)
    res.status(201).json({
      message: '注册成功',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        email: user.email,
        phone: user.phone
      },
      profile
    })
  } catch (error) {
    console.error('注册错误:', error)
    res.status(500).json({ message: '服务器错误', error: error.message })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ message: '用户名和密码必填' })
    }

    const user = await User.findOne({ where: { username } })
    if (!user) {
      return res.status(401).json({ message: '用户名或密码错误' })
    }

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      return res.status(401).json({ message: '用户名或密码错误' })
    }

    let profile = null
    if (user.role === 'company') {
      profile = await Company.findOne({ where: { userId: user.id } })
    } else if (user.role === 'student') {
      profile = await Student.findOne({ where: { userId: user.id } })
    } else if (user.role === 'teacher') {
      profile = await Teacher.findOne({ where: { userId: user.id } })
    }

    const token = generateToken(user)
    res.json({
      message: '登录成功',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        email: user.email,
        phone: user.phone
      },
      profile
    })
  } catch (error) {
    console.error('登录错误:', error)
    res.status(500).json({ message: '服务器错误' })
  }
})

router.get('/me', authMiddleware(), async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id)
    if (!user) {
      return res.status(404).json({ message: '用户不存在' })
    }

    let profile = null
    if (user.role === 'company') {
      profile = await Company.findOne({ where: { userId: user.id } })
    } else if (user.role === 'student') {
      profile = await Student.findOne({ where: { userId: user.id } })
    } else if (user.role === 'teacher') {
      profile = await Teacher.findOne({ where: { userId: user.id } })
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        email: user.email,
        phone: user.phone
      },
      profile
    })
  } catch (error) {
    res.status(500).json({ message: '服务器错误' })
  }
})

module.exports = router
