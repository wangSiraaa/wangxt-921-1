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
  User,
  TripartiteAgreement,
  PositionChange,
  Teacher
} = require('../models')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

const validateApplication = async (studentId, jobId) => {
  const errors = []

  const student = await Student.findByPk(studentId)
  if (!student) return { valid: false, errors: ['学生信息不存在'] }

  const activeConfirm = await Application.findOne({
    where: {
      studentId,
      status: { [Op.in]: ['confirmed', 'agreement_generated', 'agreement_student_filled', 'agreement_mentor_confirmed', 'agreement_signed', 'onboarded'] }
    }
  })
  if (activeConfirm) {
    errors.push('您已有确认录用或正在流程中的岗位，不可再投递新岗位')
  }

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
    where: {
      studentId,
      jobId,
      status: { [Op.notIn]: ['withdrawn', 'rejected', 'transferred'] }
    },
    order: [['createdAt', 'DESC']]
  })
  if (existingApp) {
    errors.push('已投递过该岗位，不可重复投递')
  }

  return { valid: errors.length === 0, errors, student, job, review }
}

const generateAgreementNo = () => {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `TPA-${y}${m}${d}-${rand}`
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
        { model: Resume },
        { model: TripartiteAgreement }
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
        { model: Company, include: [{ model: User, attributes: ['name'] }] },
        { model: Application, attributes: ['status', 'withdrawReason', 'withdrawTime'] }
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
        { model: Resume },
        { model: TripartiteAgreement }
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
      include: [{ model: Job }, { model: Student }],
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

    const lockedApp = await Application.findOne({
      where: {
        studentId: application.studentId,
        status: { [Op.in]: ['confirmed', 'agreement_generated', 'agreement_student_filled', 'agreement_mentor_confirmed', 'agreement_signed', 'onboarded'] }
      },
      transaction
    })
    if (lockedApp) {
      await transaction.rollback()
      return res.status(400).json({ message: '该学生已被其他岗位确认录用或在协议流程中，不可重复录用' })
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

router.post('/:id/agreement/generate', authMiddleware(['teacher']), async (req, res) => {
  const transaction = await sequelize.transaction()
  try {
    const teacher = await Teacher.findOne({
      where: { userId: req.user.id },
      transaction
    })
    if (!teacher) {
      await transaction.rollback()
      return res.status(404).json({ message: '老师信息不存在' })
    }

    const application = await Application.findByPk(req.params.id, {
      include: [{ model: Job }, { model: Student }],
      transaction
    })
    if (!application) {
      await transaction.rollback()
      return res.status(404).json({ message: '投递记录不存在' })
    }

    if (application.status !== 'confirmed') {
      await transaction.rollback()
      return res.status(400).json({ message: `当前状态(${application.status})不可生成三方协议，需先确认录用` })
    }

    const existingAgreement = await TripartiteAgreement.findOne({
      where: { applicationId: application.id },
      transaction
    })
    if (existingAgreement) {
      await transaction.rollback()
      return res.status(400).json({ message: '该岗位已生成三方协议，不可重复生成' })
    }

    const agreement = await TripartiteAgreement.create({
      applicationId: application.id,
      jobId: application.jobId,
      studentId: application.studentId,
      companyId: application.Job.companyId,
      teacherId: teacher.id,
      agreementNo: generateAgreementNo(),
      status: 'generated'
    }, { transaction })

    await application.update({
      status: 'agreement_generated'
    }, { transaction })

    await transaction.commit()
    res.json({
      message: '三方协议生成成功',
      agreement,
      application: { ...application.toJSON(), status: 'agreement_generated' }
    })
  } catch (error) {
    await transaction.rollback()
    console.error('生成三方协议错误:', error)
    res.status(500).json({ message: '服务器错误', error: error.message })
  }
})

router.post('/:id/agreement/student-fill', authMiddleware(['student']), async (req, res) => {
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

    const {
      insuranceMaterials,
      insuranceFileUrl,
      internshipStartDate,
      internshipEndDate,
      internshipCycle
    } = req.body

    const application = await Application.findByPk(req.params.id, { transaction })
    if (!application) {
      await transaction.rollback()
      return res.status(404).json({ message: '投递记录不存在' })
    }

    if (application.studentId !== student.id) {
      await transaction.rollback()
      return res.status(403).json({ message: '无权限操作' })
    }

    if (application.status !== 'agreement_generated') {
      await transaction.rollback()
      return res.status(400).json({ message: `当前状态(${application.status})不可补充材料，需等待协议生成` })
    }

    const agreement = await TripartiteAgreement.findOne({
      where: { applicationId: application.id },
      transaction
    })
    if (!agreement) {
      await transaction.rollback()
      return res.status(404).json({ message: '三方协议不存在' })
    }

    await agreement.update({
      insuranceMaterials,
      insuranceFileUrl,
      internshipStartDate,
      internshipEndDate,
      internshipCycle,
      status: 'student_filled'
    }, { transaction })

    await application.update({
      status: 'agreement_student_filled'
    }, { transaction })

    await transaction.commit()
    res.json({
      message: '学生补充信息成功，等待企业确认导师',
      agreement,
      application: { ...application.toJSON(), status: 'agreement_student_filled' }
    })
  } catch (error) {
    await transaction.rollback()
    console.error('学生补充三方协议错误:', error)
    res.status(500).json({ message: '服务器错误', error: error.message })
  }
})

router.post('/:id/agreement/confirm-mentor', authMiddleware(['company']), async (req, res) => {
  const transaction = await sequelize.transaction()
  try {
    const company = await Company.findOne({
      where: { userId: req.user.id },
      transaction
    })
    if (!company) {
      await transaction.rollback()
      return res.status(404).json({ message: '企业信息不存在' })
    }

    const { mentorName, mentorTitle, mentorPhone, mentorEmail } = req.body
    if (!mentorName) {
      await transaction.rollback()
      return res.status(400).json({ message: '导师姓名必填' })
    }

    const application = await Application.findByPk(req.params.id, {
      include: [{ model: Job }],
      transaction
    })
    if (!application) {
      await transaction.rollback()
      return res.status(404).json({ message: '投递记录不存在' })
    }

    if (application.Job.companyId !== company.id) {
      await transaction.rollback()
      return res.status(403).json({ message: '无权限操作' })
    }

    if (application.status !== 'agreement_student_filled') {
      await transaction.rollback()
      return res.status(400).json({ message: `当前状态(${application.status})不可确认导师，需等待学生补充信息` })
    }

    const agreement = await TripartiteAgreement.findOne({
      where: { applicationId: application.id },
      transaction
    })
    if (!agreement) {
      await transaction.rollback()
      return res.status(404).json({ message: '三方协议不存在' })
    }

    await agreement.update({
      mentorName,
      mentorTitle,
      mentorPhone,
      mentorEmail,
      status: 'mentor_confirmed'
    }, { transaction })

    await application.update({
      status: 'agreement_mentor_confirmed'
    }, { transaction })

    await transaction.commit()
    res.json({
      message: '导师确认成功，岗位已锁定',
      agreement,
      application: { ...application.toJSON(), status: 'agreement_mentor_confirmed' }
    })
  } catch (error) {
    await transaction.rollback()
    console.error('确认导师错误:', error)
    res.status(500).json({ message: '服务器错误', error: error.message })
  }
})

router.post('/:id/agreement/sign', authMiddleware(), async (req, res) => {
  const transaction = await sequelize.transaction()
  try {
    const { signParty } = req.body
    if (!['student', 'company', 'teacher'].includes(signParty)) {
      await transaction.rollback()
      return res.status(400).json({ message: '签署方无效' })
    }

    const application = await Application.findByPk(req.params.id, {
      include: [{ model: Job }],
      transaction
    })
    if (!application) {
      await transaction.rollback()
      return res.status(404).json({ message: '投递记录不存在' })
    }

    const agreement = await TripartiteAgreement.findOne({
      where: { applicationId: application.id },
      transaction
    })
    if (!agreement) {
      await transaction.rollback()
      return res.status(404).json({ message: '三方协议不存在' })
    }

    if (agreement.status !== 'mentor_confirmed') {
      await transaction.rollback()
      return res.status(400).json({ message: `当前状态(${agreement.status})不可签署，需先确认导师` })
    }

    const updateFields = {}
    if (signParty === 'student') {
      const student = await Student.findOne({ where: { userId: req.user.id }, transaction })
      if (!student || student.id !== application.studentId) {
        await transaction.rollback()
        return res.status(403).json({ message: '无权限操作' })
      }
      updateFields.studentSignTime = new Date()
    } else if (signParty === 'company') {
      const company = await Company.findOne({ where: { userId: req.user.id }, transaction })
      if (!company || company.id !== application.Job.companyId) {
        await transaction.rollback()
        return res.status(403).json({ message: '无权限操作' })
      }
      updateFields.companySignTime = new Date()
    } else if (signParty === 'teacher') {
      const teacher = await Teacher.findOne({ where: { userId: req.user.id }, transaction })
      if (!teacher || teacher.id !== agreement.teacherId) {
        await transaction.rollback()
        return res.status(403).json({ message: '无权限操作' })
      }
      updateFields.teacherSignTime = new Date()
    }

    const updated = await agreement.update(updateFields, { transaction })
    const allSigned = updated.studentSignTime && updated.companySignTime && updated.teacherSignTime

    if (allSigned) {
      await updated.update({
        signCompleted: true,
        status: 'signed'
      }, { transaction })
      await application.update({
        status: 'agreement_signed'
      }, { transaction })
    }

    await transaction.commit()
    res.json({
      message: allSigned ? '三方协议签署完成' : `${signParty}签署成功`,
      agreement: allSigned ? { ...updated.toJSON(), signCompleted: true, status: 'signed' } : updated,
      allSigned
    })
  } catch (error) {
    await transaction.rollback()
    console.error('签署三方协议错误:', error)
    res.status(500).json({ message: '服务器错误', error: error.message })
  }
})

router.post('/:id/onboard', authMiddleware(['teacher', 'company']), async (req, res) => {
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

    if (req.user.role === 'company') {
      const company = await Company.findOne({ where: { userId: req.user.id }, transaction })
      if (!company || company.id !== application.Job.companyId) {
        await transaction.rollback()
        return res.status(403).json({ message: '无权限操作' })
      }
    } else if (req.user.role === 'teacher') {
      const teacher = await Teacher.findOne({ where: { userId: req.user.id }, transaction })
      if (!teacher) {
        await transaction.rollback()
        return res.status(403).json({ message: '无权限操作' })
      }
    }

    const agreement = await TripartiteAgreement.findOne({
      where: { applicationId: application.id },
      transaction
    })

    if (!agreement || !agreement.signCompleted || agreement.status !== 'signed') {
      await transaction.rollback()
      return res.status(400).json({
        message: '协议未签署完成，不可确认入岗',
        agreementStatus: agreement?.status,
        signCompleted: agreement?.signCompleted
      })
    }

    if (application.status !== 'agreement_signed') {
      await transaction.rollback()
      return res.status(400).json({ message: `当前状态(${application.status})不可确认入岗` })
    }

    const updatedApp = await application.update({
      status: 'onboarded',
      onboardedTime: new Date()
    }, { transaction })

    await transaction.commit()
    res.json({
      message: '入岗确认成功',
      application: updatedApp
    })
  } catch (error) {
    await transaction.rollback()
    console.error('确认入岗错误:', error)
    res.status(500).json({ message: '服务器错误', error: error.message })
  }
})

router.post('/:id/withdraw', authMiddleware(['company']), async (req, res) => {
  const transaction = await sequelize.transaction()
  try {
    const { withdrawReason } = req.body
    if (!withdrawReason) {
      await transaction.rollback()
      return res.status(400).json({ message: '必须填写撤回原因' })
    }

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

    if (!['accepted', 'confirmed', 'agreement_generated', 'agreement_student_filled', 'agreement_mentor_confirmed'].includes(application.status)) {
      await transaction.rollback()
      return res.status(400).json({
        message: `当前状态(${application.status})不可撤回录用`,
        allowedStatuses: ['accepted', 'confirmed', 'agreement_generated', 'agreement_student_filled', 'agreement_mentor_confirmed']
      })
    }

    if (application.status === 'agreement_signed' || application.status === 'onboarded') {
      await transaction.rollback()
      return res.status(400).json({ message: '协议已签署或已入岗，不可撤回录用' })
    }

    const job = await Job.findByPk(application.jobId, { transaction })
    const newRemaining = job.remainingQuota + 1
    await job.update({
      remainingQuota: newRemaining,
      status: newRemaining > 0 ? 'open' : job.status
    }, { transaction })

    const hiringRecord = await HiringRecord.findOne({
      where: { applicationId: application.id },
      transaction
    })
    if (hiringRecord) {
      await hiringRecord.update({
        withdrawReason,
        withdrawTime: new Date(),
        quotaRestored: true
      }, { transaction })
    }

    const agreement = await TripartiteAgreement.findOne({
      where: { applicationId: application.id },
      transaction
    })
    if (agreement && agreement.status !== 'signed') {
      await agreement.update({
        status: 'cancelled',
        remark: `企业撤回录用: ${withdrawReason}`
      }, { transaction })
    }

    const updatedApp = await application.update({
      status: 'withdrawn',
      withdrawReason,
      withdrawTime: new Date(),
      isHireable: true
    }, { transaction })

    await Application.update(
      { isHireable: true, status: sequelize.literal(`CASE WHEN status = 'disabled' THEN 'applied' ELSE status END`) },
      { where: { studentId: application.studentId, id: { [Op.ne]: application.id } }, transaction }
    )

    await transaction.commit()
    res.json({
      message: '录用撤回成功，名额已恢复',
      application: updatedApp,
      job: { ...job.toJSON(), remainingQuota: newRemaining }
    })
  } catch (error) {
    await transaction.rollback()
    console.error('撤回录用错误:', error)
    res.status(500).json({ message: '服务器错误', error: error.message })
  }
})

const validateTransfer = async (studentId, oldApplicationId, newJobId, transaction) => {
  const errors = []

  const oldApp = await Application.findByPk(oldApplicationId, {
    include: [{ model: Job }],
    transaction
  })
  if (!oldApp) {
    return { valid: false, errors: ['原投递记录不存在'] }
  }
  if (oldApp.studentId !== studentId) {
    return { valid: false, errors: ['无权限操作该投递记录'] }
  }

  const originalSigned = oldApp.status === 'agreement_signed' || oldApp.status === 'onboarded'
  if (originalSigned) {
    errors.push('原岗位协议已签署或已入岗，不可申请改投')
  }

  if (!['confirmed', 'agreement_generated', 'agreement_student_filled', 'agreement_mentor_confirmed'].includes(oldApp.status)) {
    errors.push(`原岗位当前状态(${oldApp.status})不可改投`)
  }

  const newJob = await Job.findByPk(newJobId, { transaction })
  if (!newJob) {
    return { valid: false, errors: [...errors, '目标岗位不存在'] }
  }

  const targetQuotaOk = newJob.remainingQuota > 0 && newJob.status === 'open'
  if (!targetQuotaOk) {
    errors.push(`目标岗位名额不足或已关闭（剩余: ${newJob.remainingQuota}, 状态: ${newJob.status}）`)
  }

  const student = await Student.findByPk(studentId, { transaction })
  const requiredMajors = newJob.requiredMajor.split(/[,，;；、\s]+/).filter(Boolean)
  const studentMajor = student.major.trim()
  const majorMatch = requiredMajors.some(m =>
    studentMajor.includes(m.trim()) || m.trim().includes(studentMajor)
  )
  if (!majorMatch) {
    errors.push(`专业不匹配，目标岗位要求：${newJob.requiredMajor}`)
  }

  const oldAgreement = await TripartiteAgreement.findOne({
    where: { applicationId: oldApplicationId },
    transaction
  })
  const materialDiff = []
  if (newJob.requireInsurance && !student.hasInsurance && !oldAgreement?.insuranceFileUrl) {
    materialDiff.push('目标岗位要求保险材料，需补充提交')
  }
  if (newJob.requireInsurance && !oldAgreement?.insuranceFileUrl && student.hasInsurance) {
    materialDiff.push('学生档案有保险标记，但未在三方协议中上传证明文件')
  }
  if (oldAgreement?.internshipStartDate || oldAgreement?.internshipEndDate) {
    materialDiff.push('原协议已填写实习周期，改投后需重新确认')
  }
  if (materialDiff.length === 0) {
    materialDiff.push('缴交材料无差异，可沿用原有材料')
  }

  const existingNewApp = await Application.findOne({
    where: {
      studentId,
      jobId: newJobId,
      id: { [Op.ne]: oldApplicationId },
      status: { [Op.notIn]: ['withdrawn', 'rejected', 'transferred'] }
    },
    transaction
  })
  if (existingNewApp) {
    errors.push('已投递过目标岗位，不可重复投递')
  }

  return {
    valid: errors.length === 0,
    errors,
    originalSigned,
    targetQuotaOk,
    majorMatch,
    materialDiff: materialDiff.join('; '),
    oldApp,
    newJob,
    student
  }
}

router.post('/:id/transfer/validate', authMiddleware(['student', 'teacher']), async (req, res) => {
  try {
    const { newJobId } = req.body
    if (!newJobId) {
      return res.status(400).json({ message: '缺少目标岗位ID' })
    }

    let studentId
    if (req.user.role === 'student') {
      const student = await Student.findOne({ where: { userId: req.user.id } })
      if (!student) return res.status(404).json({ message: '学生信息不存在' })
      studentId = student.id
    } else {
      const { studentId: sid } = req.body
      if (!sid) return res.status(400).json({ message: '缺少学生ID' })
      studentId = sid
    }

    const result = await validateTransfer(studentId, req.params.id, newJobId)

    res.json({
      valid: result.valid,
      errors: result.errors,
      validation: {
        originalSigned: result.originalSigned,
        targetQuotaOk: result.targetQuotaOk,
        majorMatch: result.majorMatch,
        materialDiff: result.materialDiff
      }
    })
  } catch (error) {
    console.error('改投校验错误:', error)
    res.status(500).json({ message: '服务器错误', error: error.message })
  }
})

router.post('/:id/transfer', authMiddleware(['student', 'teacher']), async (req, res) => {
  const transaction = await sequelize.transaction()
  try {
    const { newJobId, changeReason } = req.body
    if (!newJobId) {
      await transaction.rollback()
      return res.status(400).json({ message: '缺少目标岗位ID' })
    }
    if (!changeReason) {
      await transaction.rollback()
      return res.status(400).json({ message: '缺少改投原因' })
    }

    let studentId
    let reviewTeacherId = null
    if (req.user.role === 'student') {
      const student = await Student.findOne({ where: { userId: req.user.id }, transaction })
      if (!student) {
        await transaction.rollback()
        return res.status(404).json({ message: '学生信息不存在' })
      }
      studentId = student.id
    } else {
      const { studentId: sid } = req.body
      if (!sid) {
        await transaction.rollback()
        return res.status(400).json({ message: '缺少学生ID' })
      }
      studentId = sid
      const teacher = await Teacher.findOne({ where: { userId: req.user.id }, transaction })
      if (teacher) reviewTeacherId = teacher.id
    }

    const validation = await validateTransfer(studentId, req.params.id, newJobId, transaction)
    if (!validation.valid) {
      await transaction.rollback()
      return res.status(400).json({
        message: '改投校验失败',
        errors: validation.errors
      })
    }

    const student = validation.student
    const oldApp = validation.oldApp
    const oldJob = validation.oldApp.Job
    const newJob = validation.newJob

    const oldAgreement = await TripartiteAgreement.findOne({
      where: { applicationId: oldApp.id },
      transaction
    })
    if (oldAgreement && oldAgreement.status !== 'signed') {
      await oldAgreement.update({
        status: 'cancelled',
        remark: `改投新岗位: ${newJob.title}，原因: ${changeReason}`
      }, { transaction })
    }

    const oldJobAfter = await Job.findByPk(oldApp.jobId, { transaction })
    const oldRemaining = oldJobAfter.remainingQuota + 1
    await oldJobAfter.update({
      remainingQuota: oldRemaining,
      status: oldRemaining > 0 ? 'open' : oldJobAfter.status
    }, { transaction })

    const oldHiring = await HiringRecord.findOne({
      where: { applicationId: oldApp.id },
      transaction
    })
    if (oldHiring) {
      await oldHiring.update({
        withdrawReason: `改投新岗位: ${newJob.title}`,
        withdrawTime: new Date(),
        quotaRestored: true
      }, { transaction })
    }

    await oldApp.update({
      status: 'transferred',
      isHireable: false,
      withdrawReason: `改投新岗位ID:${newJobId}`
    }, { transaction })

    const resume = await Resume.findOne({ where: { studentId }, transaction })
    if (!resume) {
      await transaction.rollback()
      return res.status(400).json({ message: '学生简历不存在' })
    }

    const newRemaining = newJob.remainingQuota - 1
    await newJob.update({
      remainingQuota: newRemaining,
      status: newRemaining <= 0 ? 'filled' : newJob.status
    }, { transaction })

    const newApp = await Application.create({
      studentId,
      jobId: newJobId,
      resumeId: resume.id,
      status: 'accepted',
      isHireable: true
    }, { transaction })

    await HiringRecord.create({
      applicationId: newApp.id,
      jobId: newJobId,
      studentId,
      companyId: newJob.companyId,
      quotaBefore: newJob.remainingQuota + 1,
      quotaAfter: newRemaining
    }, { transaction })

    const positionChange = await PositionChange.create({
      studentId,
      oldApplicationId: oldApp.id,
      newApplicationId: newApp.id,
      oldJobId: oldApp.jobId,
      newJobId,
      status: reviewTeacherId ? 'completed' : 'pending_review',
      changeReason,
      originalSigned: validation.originalSigned,
      targetQuotaOk: validation.targetQuotaOk,
      majorMatch: validation.majorMatch,
      materialDiff: validation.materialDiff,
      reviewTeacherId,
      reviewTime: reviewTeacherId ? new Date() : null
    }, { transaction })

    await transaction.commit()
    res.json({
      message: reviewTeacherId ? '改投完成，原岗位名额已释放' : '改投申请已提交，等待学院老师审核',
      positionChange,
      newApplication: newApp,
      oldApplication: { ...oldApp.toJSON(), status: 'transferred' },
      oldJobRemaining: oldRemaining,
      newJobRemaining: newRemaining
    })
  } catch (error) {
    await transaction.rollback()
    console.error('改投错误:', error)
    res.status(500).json({ message: '服务器错误', error: error.message })
  }
})

router.post('/position-changes/:id/review', authMiddleware(['teacher']), async (req, res) => {
  const transaction = await sequelize.transaction()
  try {
    const { status, rejectReason } = req.body
    if (!status || !['approved', 'rejected', 'completed', 'cancelled'].includes(status)) {
      await transaction.rollback()
      return res.status(400).json({ message: '审核状态无效' })
    }

    const teacher = await Teacher.findOne({ where: { userId: req.user.id }, transaction })
    if (!teacher) {
      await transaction.rollback()
      return res.status(404).json({ message: '老师信息不存在' })
    }

    const change = await PositionChange.findByPk(req.params.id, {
      include: [
        { model: Application, as: 'OldApplication', include: [{ model: Job, as: 'OldJob' }] },
        { model: Application, as: 'NewApplication', include: [{ model: Job, as: 'NewJob' }] }
      ],
      transaction
    })
    if (!change) {
      await transaction.rollback()
      return res.status(404).json({ message: '变更记录不存在' })
    }

    if (change.status !== 'pending_review') {
      await transaction.rollback()
      return res.status(400).json({ message: `当前状态(${change.status})不可审核` })
    }

    await change.update({
      status,
      rejectReason,
      reviewTeacherId: teacher.id,
      reviewTime: new Date()
    }, { transaction })

    if (status === 'rejected' || status === 'cancelled') {
      const oldApp = change.OldApplication
      if (oldApp && oldApp.status === 'transferred') {
        await oldApp.update({
          status: 'confirmed',
          withdrawReason: null,
          isHireable: false
        }, { transaction })

        const oldJob = await Job.findByPk(change.oldJobId, { transaction })
        const revertRemaining = Math.max(0, oldJob.remainingQuota - 1)
        await oldJob.update({
          remainingQuota: revertRemaining,
          status: revertRemaining <= 0 ? 'filled' : oldJob.status
        }, { transaction })
      }

      const newApp = change.NewApplication
      if (newApp) {
        const newJob = await Job.findByPk(change.newJobId, { transaction })
        const restoreRemaining = newJob.remainingQuota + 1
        await newJob.update({
          remainingQuota: restoreRemaining,
          status: 'open'
        }, { transaction })

        const newHiring = await HiringRecord.findOne({
          where: { applicationId: newApp.id },
          transaction
        })
        if (newHiring) {
          await newHiring.update({
            withdrawReason: `改投审核${status === 'rejected' ? '拒绝' : '取消'}`,
            withdrawTime: new Date(),
            quotaRestored: true
          }, { transaction })
        }
        await newApp.destroy({ transaction })
      }
    }

    await transaction.commit()
    res.json({
      message: `改投审核${status === 'completed' || status === 'approved' ? '通过' : '不通过'}`,
      positionChange: change
    })
  } catch (error) {
    await transaction.rollback()
    console.error('改投审核错误:', error)
    res.status(500).json({ message: '服务器错误', error: error.message })
  }
})

router.get('/agreements/list', authMiddleware(['teacher', 'company', 'student']), async (req, res) => {
  try {
    const where = {}
    const { studentId, status } = req.query

    if (req.user.role === 'company') {
      const company = await Company.findOne({ where: { userId: req.user.id } })
      if (company) where.companyId = company.id
    } else if (req.user.role === 'student') {
      const student = await Student.findOne({ where: { userId: req.user.id } })
      if (student) where.studentId = student.id
    } else if (req.user.role === 'teacher') {
      if (studentId) where.studentId = studentId
    }
    if (status) where.status = status

    const agreements = await TripartiteAgreement.findAll({
      where,
      include: [
        { model: Student, include: [{ model: User, attributes: ['name', 'email', 'phone'] }] },
        { model: Company, include: [{ model: User, attributes: ['name'] }] },
        { model: Job, attributes: ['title', 'location', 'salary'] },
        { model: Teacher, include: [{ model: User, attributes: ['name'] }] },
        { model: Application, attributes: ['status', 'onboardedTime'] }
      ],
      order: [['generatedTime', 'DESC']]
    })

    res.json({ agreements })
  } catch (error) {
    console.error('查询三方协议列表错误:', error)
    res.status(500).json({ message: '服务器错误' })
  }
})

router.get('/teacher/student-trail', authMiddleware(['teacher']), async (req, res) => {
  try {
    const { studentId } = req.query
    if (!studentId) {
      return res.status(400).json({ message: '缺少学生ID' })
    }

    const teacher = await Teacher.findOne({ where: { userId: req.user.id } })
    if (!teacher) {
      return res.status(404).json({ message: '老师信息不存在' })
    }

    const student = await Student.findByPk(studentId, {
      include: [
        { model: User, attributes: ['name', 'email', 'phone'] },
        { model: QualificationReview, include: [{ model: Teacher, include: [{ model: User, attributes: ['name'] }] }] }
      ]
    })
    if (!student) {
      return res.status(404).json({ message: '学生信息不存在' })
    }

    const applications = await Application.findAll({
      where: { studentId },
      include: [
        {
          model: Job,
          include: [{ model: Company, include: [{ model: User, attributes: ['name'] }] }]
        },
        { model: TripartiteAgreement },
        { model: HiringRecord }
      ],
      order: [['applyTime', 'DESC']]
    })

    const positionChanges = await PositionChange.findAll({
      where: { studentId },
      include: [
        { model: Job, as: 'OldJob', attributes: ['title'] },
        { model: Job, as: 'NewJob', attributes: ['title'] },
        { model: Teacher, include: [{ model: User, attributes: ['name'] }] }
      ],
      order: [['applyTime', 'DESC']]
    })

    const hiringRecords = await HiringRecord.findAll({
      where: { studentId },
      include: [
        { model: Job, attributes: ['title'] },
        { model: Company, include: [{ model: User, attributes: ['name'] }] },
        { model: Application, attributes: ['status', 'withdrawReason', 'withdrawTime'] }
      ],
      order: [['hireTime', 'DESC']]
    })

    const agreements = await TripartiteAgreement.findAll({
      where: { studentId },
      include: [
        { model: Job, attributes: ['title'] },
        { model: Company, include: [{ model: User, attributes: ['name'] }] },
        { model: Teacher, include: [{ model: User, attributes: ['name'] }] }
      ],
      order: [['generatedTime', 'DESC']]
    })

    res.json({
      student,
      trail: {
        applications: applications.map(a => ({
          id: a.id,
          jobTitle: a.Job?.title,
          companyName: a.Job?.Company?.User?.name,
          status: a.status,
          applyTime: a.applyTime,
          rejectReason: a.rejectReason,
          withdrawReason: a.withdrawReason,
          onboardedTime: a.onboardedTime,
          hasAgreement: !!a.TripartiteAgreement,
          agreementStatus: a.TripartiteAgreement?.status
        })),
        positionChanges: positionChanges.map(pc => ({
          id: pc.id,
          oldJob: pc.OldJob?.title,
          newJob: pc.NewJob?.title,
          status: pc.status,
          changeReason: pc.changeReason,
          rejectReason: pc.rejectReason,
          originalSigned: pc.originalSigned,
          targetQuotaOk: pc.targetQuotaOk,
          majorMatch: pc.majorMatch,
          materialDiff: pc.materialDiff,
          applyTime: pc.applyTime,
          reviewTime: pc.reviewTime,
          reviewerName: pc.Teacher?.User?.name
        })),
        hiringRecords: hiringRecords.map(hr => ({
          id: hr.id,
          jobTitle: hr.Job?.title,
          companyName: hr.Company?.User?.name,
          hireTime: hr.hireTime,
          confirmedTime: hr.confirmedTime,
          quotaBefore: hr.quotaBefore,
          quotaAfter: hr.quotaAfter,
          withdrawReason: hr.withdrawReason,
          withdrawTime: hr.withdrawTime,
          quotaRestored: hr.quotaRestored
        })),
        agreements: agreements.map(a => ({
          id: a.id,
          agreementNo: a.agreementNo,
          jobTitle: a.Job?.title,
          companyName: a.Company?.User?.name,
          status: a.status,
          generatedTime: a.generatedTime,
          mentorName: a.mentorName,
          internshipCycle: a.internshipCycle,
          signCompleted: a.signCompleted,
          studentSignTime: a.studentSignTime,
          companySignTime: a.companySignTime,
          teacherSignTime: a.teacherSignTime
        }))
      }
    })
  } catch (error) {
    console.error('查询学生轨迹错误:', error)
    res.status(500).json({ message: '服务器错误', error: error.message })
  }
})

router.get('/teacher/position-changes', authMiddleware(['teacher']), async (req, res) => {
  try {
    const { status } = req.query
    const where = {}
    if (status) where.status = status

    const changes = await PositionChange.findAll({
      where,
      include: [
        { model: Student, include: [{ model: User, attributes: ['name'] }] },
        { model: Job, as: 'OldJob', attributes: ['title'] },
        { model: Job, as: 'NewJob', attributes: ['title'] },
        { model: Teacher, include: [{ model: User, attributes: ['name'] }] }
      ],
      order: [['applyTime', 'DESC']]
    })

    res.json({ changes })
  } catch (error) {
    console.error('查询改投列表错误:', error)
    res.status(500).json({ message: '服务器错误' })
  }
})

router.get('/agreements/:id', authMiddleware(), async (req, res) => {
  try {
    const agreement = await TripartiteAgreement.findByPk(req.params.id, {
      include: [
        { model: Student, include: [{ model: User, attributes: ['name', 'email', 'phone'] }] },
        { model: Company, include: [{ model: User, attributes: ['name'] }] },
        { model: Job, include: [{ model: Company, include: [{ model: User }] }] },
        { model: Teacher, include: [{ model: User, attributes: ['name'] }] },
        { model: Application, include: [{ model: HiringRecord }] }
      ]
    })

    if (!agreement) {
      return res.status(404).json({ message: '三方协议不存在' })
    }

    if (req.user.role === 'student') {
      const student = await Student.findOne({ where: { userId: req.user.id } })
      if (!student || student.id !== agreement.studentId) {
        return res.status(403).json({ message: '无权限查看' })
      }
    } else if (req.user.role === 'company') {
      const company = await Company.findOne({ where: { userId: req.user.id } })
      if (!company || company.id !== agreement.companyId) {
        return res.status(403).json({ message: '无权限查看' })
      }
    }

    res.json({ agreement })
  } catch (error) {
    console.error('查询三方协议错误:', error)
    res.status(500).json({ message: '服务器错误' })
  }
})

module.exports = { router, validateApplication }
