const express = require('express')
const { Op } = require('sequelize')
const { sequelize } = require('../models')
const {
  Application,
  Job,
  Student,
  Resume,
  QualificationReview,
  Company,
  HiringRecord,
  User
} = require('../models')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

const validateApplication = async (studentId, jobId) => {
  const errors = []

  const student = await Student.findByPk(studentId)
  if (!student) return { valid: false, errors: ['学生信息不存在'] }

  const job = await Job.findByPk(jobId)
  if (!job) return { valid: false, errors: ['岗位不存在'] }

  if (job.status !== 'open') {
    errors.push(`岗位已${job.status === 'closed' ? '关闭' : '招满'}`)
  }

  const now = new Date()
  if (new Date(job.deadline) < now) {
    errors.push('岗位已截止')
  }

  if (job.remainingQuota <= 0) {
    errors.push('岗位名额已满')
  }

  const requiredMajors = job.requiredMajor.split(/[,，;；、\s]+/).filter(Boolean)
  const studentMajor = student.major.trim()
  const majorMatch = requiredMajors.some(m =>
    studentMajor.includes(m.trim()) || m.trim().includes(studentMajor)
  )
  if (!majorMatch) {
    errors.push(`专业不匹配，岗位要求：${job.requiredMajor}`)
  }

  if (job.requiredGrade !== student.grade) {
    errors.push(`年级不匹配，岗位要求：${job.requiredGrade}年级`)
  }

  if (job.requireInsurance && !student.hasInsurance) {
    errors.push('缺少保险材料')
  }

  const review = await QualificationReview.findOne({ where: { studentId } })
  if (!review) {
    errors.push('未进行资格审核')
  } else if (review.status === 'pending') {
    errors.push('资格审核待处理，暂不可投递')
  } else if (review.status === 'rejected') {
    errors.push('资格审核未通过，不可投递')
  }

  const existingApp = await Application.findOne({
    where: { studentId, jobId },
    order: [['createdAt', 'DESC']]
  })
  if (existingApp) {
    errors.push('已投递过该岗位，不可重复投递')
  }

  return { valid: errors.length === 0, errors, student, job, review }
}

router.post('/', authMiddleware(['student']), async (req, res) => {
  const transaction = await sequelize.transaction()
  try {
    const { jobId } = req.body
    if (!jobId) {
      return res.status(400).json({ message: '缺少岗位ID' })
    }

    const student = await Student.findOne({ where: { userId: req.user.id } })
    if (!student) {
      return res.status(404).json({ message: '学生信息不存在' })
    }

    const resume = await Resume.findOne({ where: { studentId: student.id } })
    if (!resume) {
      return res.status(400).json({ message: '请先上传简历' })
    }

    const validation = await validateApplication(student.id, jobId)
    if (!validation.valid) {
      return res.status(400).json({
        message: '投递失败',
        errors: validation.errors
      })
    }

    const application = await Application.create({
      studentId: student.id,
      jobId,
      resumeId: resume.id,
      status: 'applied',
      isHireable: true
    }, { transaction })

    await transaction.commit()
    res.status(201).json({ message: '投递成功', application })
  } catch (error) {
    await transaction.rollback()
    console.error('投递错误:', error)
    res.status(500).json({ message: '服务器错误', error: error.message })
  }
})

router.get('/my', authMiddleware(['student']), async (req, res) => {
  try {
    const student = await Student.findOne({ where: { userId: req.user.id } })
    if (!student) {
      return res.status(404).json({ message: '学生信息不存在' })
    }

    const applications = await Application.findAll({
      where: { studentId: student.id },
      include: [
        {
          model: Job,
          include: [
            { model: Company, include: [{ model: User, attributes: ['name'] }] }
          ]
        },
        { model: Resume }
      ],
      order: [['applyTime', 'DESC']]
    })

    res.json({ applications })
  } catch (error) {
    res.status(500).json({ message: '服务器错误' })
  }
})

router.get('/hiring-records', authMiddleware(), async (req, res) => {
  try {
    const where = {}
    if (req.user.role === 'company') {
      const company = await Company.findOne({ where: { userId: req.user.id } })
      if (company) where.companyId = company.id
    } else if (req.user.role === 'student') {
      const student = await Student.findOne({ where: { userId: req.user.id } })
      if (student) where.studentId = student.id
    }

    const records = await HiringRecord.findAll({
      where,
      include: [
        { model: Job, attributes: ['title'] },
        { model: Student, include: [{ model: User, attributes: ['name'] }] },
        { model: Company, include: [{ model: User, attributes: ['name'] }] }
      ],
      order: [['hireTime', 'DESC']]
    })

    res.json({ records })
  } catch (error) {
    console.error('hiring-records error:', error)
    res.status(500).json({ message: '服务器错误' })
  }
})

router.get('/:id', authMiddleware(), async (req, res) => {
  try {
    const application = await Application.findByPk(req.params.id, {
      include: [
        {
          model: Student,
          include: [{ model: User, attributes: ['name', 'email', 'phone'] }]
        },
        {
          model: Job,
          include: [
            { model: Company, include: [{ model: User, attributes: ['name'] }] }
          ]
        },
        { model: Resume }
      ]
    })

    if (!application) {
      return res.status(404).json({ message: '投递记录不存在' })
    }

    if (req.user.role === 'student') {
      const student = await Student.findOne({ where: { userId: req.user.id } })
      if (!student || student.id !== application.studentId) {
        return res.status(403).json({ message: '无权限查看' })
      }
    }

    if (req.user.role === 'company') {
      const company = await Company.findOne({ where: { userId: req.user.id } })
      if (!company || company.id !== application.Job?.companyId) {
        return res.status(403).json({ message: '无权限查看' })
      }
    }

    res.json({ application })
  } catch (error) {
    res.status(500).json({ message: '服务器错误' })
  }
})

router.post('/:id/accept', authMiddleware(['company']), async (req, res) => {
  const transaction = await sequelize.transaction()
  try {
    const application = await Application.findByPk(req.params.id, {
      include: [{ model: Job }],
      transaction
    })

    if (!application) {
      await transaction.rollback()
      return res.status(404).json({ message: '投递记录不存在' })
    }

    const company = await Company.findOne({
      where: { userId: req.user.id },
      transaction
    })
    if (!company || company.id !== application.Job.companyId) {
      await transaction.rollback()
      return res.status(403).json({ message: '无权限操作' })
    }

    if (!application.isHireable) {
      await transaction.rollback()
      return res.status(400).json({ message: '该投递已被标记为不可录用' })
    }

    if (!['applied', 'reviewing', 'rejected'].includes(application.status)) {
      await transaction.rollback()
      return res.status(400).json({ message: `当前状态(${application.status})不可录用` })
    }

    const job = await Job.findByPk(application.jobId, { transaction })
    if (job.remainingQuota <= 0) {
      await transaction.rollback()
      return res.status(400).json({ message: '岗位名额已满' })
    }

    const quotaBefore = job.remainingQuota
    await job.update({
      remainingQuota: job.remainingQuota - 1,
      status: job.remainingQuota - 1 <= 0 ? 'filled' : job.status
    }, { transaction })

    const updatedApp = await application.update({
      status: 'accepted'
    }, { transaction })

    await HiringRecord.create({
      applicationId: application.id,
      jobId: application.jobId,
      studentId: application.studentId,
      companyId: company.id,
      quotaBefore,
      quotaAfter: quotaBefore - 1
    }, { transaction })

    await transaction.commit()
    res.json({
      message: '录用成功，名额已扣减',
      application: updatedApp,
      job: { ...job.toJSON(), remainingQuota: quotaBefore - 1 }
    })
  } catch (error) {
    await transaction.rollback()
    console.error('录用错误:', error)
    res.status(500).json({ message: '服务器错误', error: error.message })
  }
})

router.post('/:id/reject', authMiddleware(['company']), async (req, res) => {
  try {
    const { rejectReason } = req.body
    const application = await Application.findByPk(req.params.id, {
      include: [{ model: Job }]
    })

    if (!application) return res.status(404).json({ message: '投递记录不存在' })

    const company = await Company.findOne({ where: { userId: req.user.id } })
    if (!company || company.id !== application.Job.companyId) {
      return res.status(403).json({ message: '无权限操作' })
    }

    await application.update({
      status: 'rejected',
      rejectReason
    })

    res.json({ message: '已拒绝该投递', application })
  } catch (error) {
    res.status(500).json({ message: '服务器错误' })
  }
})

router.post('/:id/confirm', authMiddleware(['student']), async (req, res) => {
  const transaction = await sequelize.transaction()
  try {
    const student = await Student.findOne({
      where: { userId: req.user.id },
      transaction
    })
    if (!student) {
      await transaction.rollback()
      return res.status(404).json({ message: '学生信息不存在' })
    }

    const application = await Application.findByPk(req.params.id, { transaction })
    if (!application) {
      await transaction.rollback()
      return res.status(404).json({ message: '投递记录不存在' })
    }

    if (application.studentId !== student.id) {
      await transaction.rollback()
      return res.status(403).json({ message: '无权限操作' })
    }

    if (application.status !== 'accepted') {
      await transaction.rollback()
      return res.status(400).json({ message: '仅录用状态可确认' })
    }

    const updatedApp = await application.update({
      status: 'confirmed'
    }, { transaction })

    const hiringRecord = await HiringRecord.findOne({
      where: { applicationId: application.id },
      transaction
    })
    if (hiringRecord) {
      await hiringRecord.update({
        confirmedTime: new Date()
      }, { transaction })
    }

    await Application.update(
      {
        isHireable: false,
        status: sequelize.literal(
          `CASE WHEN status IN ('applied', 'reviewing') THEN 'disabled' ELSE status END`
        )
      },
      {
        where: {
          studentId: student.id,
          id: { [Op.ne]: application.id }
        },
        transaction
      }
    )

    await transaction.commit()
    res.json({
      message: '确认录用成功，其他投递已设为不可录用',
      application: updatedApp
    })
  } catch (error) {
    await transaction.rollback()
    console.error('确认录用错误:', error)
    res.status(500).json({ message: '服务器错误', error: error.message })
  }
})

module.exports = { router, validateApplication }
