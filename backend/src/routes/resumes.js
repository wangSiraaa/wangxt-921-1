const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { Resume, Student, QualificationReview } = require('../models')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

const uploadDir = path.join(__dirname, '..', '..', 'data', 'uploads')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    const ext = path.extname(file.originalname)
    cb(null, 'resume-' + uniqueSuffix + ext)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.txt']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) cb(null, true)
    else cb(new Error('仅支持 PDF, DOC, DOCX, TXT 格式'))
  }
})

router.post('/upload', authMiddleware(['student']), upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '请上传简历文件' })
    }

    const student = await Student.findOne({ where: { userId: req.user.id } })
    if (!student) {
      return res.status(404).json({ message: '学生信息不存在' })
    }

    const { skills, experience, education } = req.body

    const existingResume = await Resume.findOne({ where: { studentId: student.id } })
    if (existingResume) {
      const oldPath = existingResume.filePath
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath)
      await existingResume.destroy()
    }

    const resume = await Resume.create({
      studentId: student.id,
      fileName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      skills,
      experience,
      education
    })

    await QualificationReview.destroy({ where: { studentId: student.id } })
    await QualificationReview.create({
      studentId: student.id,
      resumeId: resume.id,
      status: 'pending'
    })

    res.status(201).json({
      message: '简历上传成功，等待资格审核',
      resume,
      reviewStatus: 'pending'
    })
  } catch (error) {
    console.error('上传简历错误:', error)
    res.status(500).json({ message: '服务器错误', error: error.message })
  }
})

router.get('/my', authMiddleware(['student']), async (req, res) => {
  try {
    const student = await Student.findOne({ where: { userId: req.user.id } })
    if (!student) {
      return res.status(404).json({ message: '学生信息不存在' })
    }

    const resume = await Resume.findOne({ where: { studentId: student.id } })
    const review = await QualificationReview.findOne({ where: { studentId: student.id } })

    res.json({ resume, review, student })
  } catch (error) {
    res.status(500).json({ message: '服务器错误' })
  }
})

router.get('/:id', authMiddleware(['company', 'teacher', 'student']), async (req, res) => {
  try {
    const resume = await Resume.findByPk(req.params.id, {
      include: [{
        model: Student,
        include: [{ model: require('../models').User, attributes: ['name', 'email'] }]
      }]
    })

    if (!resume) {
      return res.status(404).json({ message: '简历不存在' })
    }

    if (req.user.role === 'student') {
      const student = await Student.findOne({ where: { userId: req.user.id } })
      if (!student || student.id !== resume.studentId) {
        return res.status(403).json({ message: '无权限查看' })
      }
    }

    res.json({ resume })
  } catch (error) {
    res.status(500).json({ message: '服务器错误' })
  }
})

module.exports = router
