const express = require('express')
const { QualificationReview, Student, Teacher, Resume, User } = require('../models')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

router.get('/', authMiddleware(['teacher']), async (req, res) => {
  try {
    const { status, page = 1, pageSize = 20 } = req.query
    const offset = (page - 1) * pageSize
    const where = {}
    if (status) where.status = status

    const { count, rows } = await QualificationReview.findAndCountAll({
      where,
      include: [
        {
          model: Student,
          include: [{ model: User, attributes: ['name', 'email', 'phone'] }]
        },
        { model: Resume },
        { model: Teacher, include: [{ model: User, attributes: ['name'] }] }
      ],
      order: [['createdAt', 'ASC']],
      limit: parseInt(pageSize),
      offset: parseInt(offset)
    })

    res.json({
      reviews: rows,
      total: count,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    })
  } catch (error) {
    console.error('查询资格审核列表错误:', error)
    res.status(500).json({ message: '服务器错误' })
  }
})

router.post('/:id/review', authMiddleware(['teacher']), async (req, res) => {
  try {
    const { status, comment } = req.body

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: '审核状态无效' })
    }

    const teacher = await Teacher.findOne({ where: { userId: req.user.id } })
    if (!teacher) {
      return res.status(404).json({ message: '老师信息不存在' })
    }

    const review = await QualificationReview.findByPk(req.params.id)
    if (!review) {
      return res.status(404).json({ message: '审核记录不存在' })
    }

    if (review.status !== 'pending') {
      return res.status(400).json({ message: '该记录已审核，无法重复审核' })
    }

    await review.update({
      status,
      comment,
      teacherId: teacher.id,
      reviewTime: new Date()
    })

    res.json({
      message: status === 'approved' ? '资格审核通过' : '资格审核未通过',
      review
    })
  } catch (error) {
    console.error('审核错误:', error)
    res.status(500).json({ message: '服务器错误' })
  }
})

router.get('/my-status', authMiddleware(['student']), async (req, res) => {
  try {
    const student = await Student.findOne({ where: { userId: req.user.id } })
    if (!student) {
      return res.status(404).json({ message: '学生信息不存在' })
    }

    const review = await QualificationReview.findOne({
      where: { studentId: student.id },
      include: [
        { model: Resume },
        { model: Teacher, include: [{ model: User, attributes: ['name'] }] }
      ]
    })

    res.json({ review, student })
  } catch (error) {
    res.status(500).json({ message: '服务器错误' })
  }
})

module.exports = router
