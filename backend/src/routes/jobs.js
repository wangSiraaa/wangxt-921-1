const express = require('express')
const { Op } = require('sequelize')
const { Job, Company, Application, User, HiringRecord, Student, Resume } = require('../models')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

router.post('/', authMiddleware(['company']), async (req, res) => {
  try {
    const {
      title,
      description,
      requiredMajor,
      requiredGrade,
      quota,
      deadline,
      requireInsurance,
      salary,
      location
    } = req.body

    if (!title || !description || !requiredMajor || !requiredGrade || !quota || !deadline) {
      return res.status(400).json({ message: '缺少必填字段' })
    }

    const company = await Company.findOne({ where: { userId: req.user.id } })
    if (!company) {
      return res.status(404).json({ message: '企业信息不存在' })
    }

    const deadlineDate = new Date(deadline)
    if (isNaN(deadlineDate.getTime())) {
      return res.status(400).json({ message: '截止日期格式无效' })
    }

    const job = await Job.create({
      companyId: company.id,
      title,
      description,
      requiredMajor,
      requiredGrade,
      quota,
      remainingQuota: quota,
      deadline: deadlineDate,
      requireInsurance: requireInsurance || false,
      salary,
      location,
      status: 'open'
    })

    res.status(201).json({ message: '岗位发布成功', job })
  } catch (error) {
    console.error('发布岗位错误:', error)
    res.status(500).json({ message: '服务器错误', error: error.message })
  }
})

router.get('/', authMiddleware(), async (req, res) => {
  try {
    const { page = 1, pageSize = 10, major, grade, keyword, status, companyId } = req.query
    const offset = (page - 1) * pageSize

    const where = {}
    if (major) where.requiredMajor = { [Op.like]: `%${major}%` }
    if (grade) where.requiredGrade = grade
    if (keyword) where.title = { [Op.like]: `%${keyword}%` }
    if (status) where.status = status
    if (companyId) where.companyId = companyId

    if (req.user.role === 'company' && !companyId) {
      const company = await Company.findOne({ where: { userId: req.user.id } })
      if (company) where.companyId = company.id
    }

    const { count, rows } = await Job.findAndCountAll({
      where,
      include: [
        {
          model: Company,
          include: [{ model: User, attributes: ['name', 'email', 'phone'] }]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(pageSize),
      offset: parseInt(offset)
    })

    res.json({
      jobs: rows,
      total: count,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      totalPages: Math.ceil(count / pageSize)
    })
  } catch (error) {
    console.error('查询岗位错误:', error)
    res.status(500).json({ message: '服务器错误' })
  }
})

router.get('/:id', authMiddleware(), async (req, res) => {
  try {
    const job = await Job.findByPk(req.params.id, {
      include: [
        {
          model: Company,
          include: [{ model: User, attributes: ['name', 'email', 'phone'] }]
        }
      ]
    })

    if (!job) {
      return res.status(404).json({ message: '岗位不存在' })
    }

    res.json({ job })
  } catch (error) {
    res.status(500).json({ message: '服务器错误' })
  }
})

router.put('/:id', authMiddleware(['company']), async (req, res) => {
  try {
    const company = await Company.findOne({ where: { userId: req.user.id } })
    const job = await Job.findByPk(req.params.id)

    if (!job) return res.status(404).json({ message: '岗位不存在' })
    if (!company || job.companyId !== company.id) {
      return res.status(403).json({ message: '无权限修改此岗位' })
    }

    const updates = {}
    const allowedFields = ['title', 'description', 'requiredMajor', 'requiredGrade', 'deadline', 'requireInsurance', 'salary', 'location', 'status']
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field]
      }
    }

    if (req.body.quota !== undefined) {
      const newQuota = parseInt(req.body.quota)
      const originalHired = job.quota - job.remainingQuota
      if (newQuota < originalHired) {
        return res.status(400).json({ message: '新名额不能小于已录用人数' })
      }
      updates.quota = newQuota
      updates.remainingQuota = newQuota - originalHired
    }

    await job.update(updates)
    res.json({ message: '岗位更新成功', job })
  } catch (error) {
    console.error('更新岗位错误:', error)
    res.status(500).json({ message: '服务器错误' })
  }
})

router.delete('/:id', authMiddleware(['company']), async (req, res) => {
  try {
    const company = await Company.findOne({ where: { userId: req.user.id } })
    const job = await Job.findByPk(req.params.id)

    if (!job) return res.status(404).json({ message: '岗位不存在' })
    if (!company || job.companyId !== company.id) {
      return res.status(403).json({ message: '无权限删除此岗位' })
    }

    const hasApplications = await Application.count({ where: { jobId: job.id } })
    if (hasApplications > 0) {
      await job.update({ status: 'closed' })
      return res.json({ message: '岗位有关联投递，已关闭状态' })
    }

    await job.destroy()
    res.json({ message: '岗位删除成功' })
  } catch (error) {
    res.status(500).json({ message: '服务器错误' })
  }
})

router.get('/:id/applications', authMiddleware(['company']), async (req, res) => {
  try {
    const company = await Company.findOne({ where: { userId: req.user.id } })
    const job = await Job.findByPk(req.params.id)

    if (!job) return res.status(404).json({ message: '岗位不存在' })
    if (!company || job.companyId !== company.id) {
      return res.status(403).json({ message: '无权限查看此岗位投递' })
    }

    const applications = await Application.findAll({
      where: { jobId: job.id },
      include: [
        { model: Student, include: [{ model: User, attributes: ['name', 'email', 'phone'] }] },
        { model: Resume }
      ],
      order: [['applyTime', 'DESC']]
    })

    res.json({ applications })
  } catch (error) {
    console.error('查询投递记录错误:', error)
    res.status(500).json({ message: '服务器错误' })
  }
})

module.exports = router
