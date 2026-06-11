const http = require('http')
const fs = require('fs')
const path = require('path')

const API_BASE = process.env.API_BASE || 'http://localhost:3000/api'
const url = new URL(API_BASE)

const SUITE_NAME = '校园实习岗位匹配系统 - Smoke 测试'
let passed = 0
let failed = 0
const results = []

const log = (msg, indent = 0) => {
  const prefix = '  '.repeat(indent)
  console.log(`${prefix}${msg}`)
}

const assert = (condition, msg) => {
  if (condition) {
    passed++
    results.push({ status: 'PASS', msg })
    log(`✅ ${msg}`, 2)
  } else {
    failed++
    results.push({ status: 'FAIL', msg })
    log(`❌ ${msg}`, 2)
  }
}

const request = (pathname, { method = 'GET', headers = {}, body = null, formData = null } = {}) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: `${url.pathname.replace(/\/$/, '')}${pathname}`,
      method,
      headers
    }

    if (formData) {
      const boundary = '----SMOKETESTBOUNDARY' + Date.now()
      const parts = []
      for (const key in formData) {
        const val = formData[key]
        if (key === '__file__') {
          parts.push(
            `--${boundary}\r\nContent-Disposition: form-data; name="${val.field}"; filename="${val.filename}"\r\nContent-Type: ${val.contentType || 'application/pdf'}\r\n\r\n`
          )
          parts.push(val.content)
          parts.push('\r\n')
        } else {
          parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`)
        }
      }
      parts.push(`--${boundary}--\r\n`)
      const payload = Buffer.concat(parts.map(p => typeof p === 'string' ? Buffer.from(p) : p))
      options.headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`
      options.headers['Content-Length'] = payload.length

      const req = http.request(options, res => handleResponse(res, resolve, reject))
      req.on('error', reject)
      req.write(payload)
      req.end()
    } else if (body) {
      const payload = JSON.stringify(body)
      options.headers['Content-Type'] = 'application/json'
      options.headers['Content-Length'] = Buffer.byteLength(payload)

      const req = http.request(options, res => handleResponse(res, resolve, reject))
      req.on('error', reject)
      req.write(payload)
      req.end()
    } else {
      const req = http.request(options, res => handleResponse(res, resolve, reject))
      req.on('error', reject)
      req.end()
    }
  })
}

const handleResponse = (res, resolve, reject) => {
  let data = ''
  res.on('data', chunk => data += chunk)
  res.on('end', () => {
    let parsed = null
    try { parsed = data ? JSON.parse(data) : null } catch (e) { parsed = { raw: data } }
    resolve({ status: res.statusCode, headers: res.headers, body: parsed })
  })
  res.on('error', reject)
}

const ts = Date.now().toString().slice(-6)
const makeUser = (role, idx) => ({
  username: `smoke_${role}_${idx}_${ts}`,
  password: 'test123456',
  role,
  name: `Smoke ${role.charAt(0).toUpperCase()}${role.slice(1)} ${idx}`,
  email: `${role}${idx}_${ts}@test.com`,
  phone: `138${ts}${idx.toString().padStart(2, '0')}`,
  extra: {}
})

const makeCompany = (idx = 1) => {
  const u = makeUser('company', idx)
  u.extra = {
    companyName: `Smoke Tech ${idx} Co. Ltd.`,
    industry: 'IT/互联网',
    address: '北京市朝阳区科技园',
    description: '致力于软件研发和创新的科技公司'
  }
  return u
}

const makeStudent = (idx = 1) => {
  const u = makeUser('student', idx)
  u.extra = {
    studentNo: `STU${ts}${idx.toString().padStart(3, '0')}`,
    major: idx === 3 ? '机械工程' : '计算机科学与技术',
    grade: 2022,
    college: '信息工程学院',
    hasInsurance: idx >= 2
  }
  return u
}

const makeTeacher = (idx = 1) => {
  const u = makeUser('teacher', idx)
  u.extra = {
    teacherNo: `TCH${ts}${idx.toString().padStart(3, '0')}`,
    department: '信息工程学院教务处',
    title: '副教授'
  }
  return u
}

const makeJob = (quota = 3, requireInsurance = false, days = 7) => ({
  title: '前端开发实习生',
  description: '负责公司Web前端项目的开发和维护工作，熟悉React/Vue框架',
  requiredMajor: '计算机科学与技术,软件工程,信息安全',
  requiredGrade: 2022,
  quota,
  deadline: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
  requireInsurance,
  salary: '3000-5000/月',
  location: '北京市海淀区'
})

const register = async (data) => {
  const res = await request('/auth/register', { method: 'POST', body: data })
  if (res.status !== 201) {
    throw new Error(`注册失败 [${res.status}]: ${JSON.stringify(res.body)}`)
  }
  return res.body
}

const login = async (username, password) => {
  const res = await request('/auth/login', { method: 'POST', body: { username, password } })
  if (res.status !== 200) {
    throw new Error(`登录失败 [${res.status}]: ${JSON.stringify(res.body)}`)
  }
  return res.body.token
}

const createJob = async (token, job) => {
  const res = await request('/jobs', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: job
  })
  if (res.status !== 201) {
    throw new Error(`创建岗位失败 [${res.status}]: ${JSON.stringify(res.body)}`)
  }
  return res.body.job
}

const uploadResume = async (token) => {
  const fakePdf = Buffer.from('%PDF-1.4\n%fake resume content for smoke test\n%%EOF')
  const res = await request('/resumes/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    formData: {
      skills: 'JavaScript, React, Node.js',
      experience: '参与过Web项目开发',
      education: '本科在读',
      __file__: {
        field: 'resume',
        filename: 'resume_test.pdf',
        contentType: 'application/pdf',
        content: fakePdf
      }
    }
  })
  if (res.status !== 201) {
    throw new Error(`上传简历失败 [${res.status}]: ${JSON.stringify(res.body)}`)
  }
  return res.body.resume
}

const getReviewStatus = async (token) => {
  const res = await request('/reviews/my-status', {
    headers: { Authorization: `Bearer ${token}` }
  })
  return res.body
}

const reviewApproval = async (teacherToken, reviewId, approved = true) => {
  const res = await request(`/reviews/${reviewId}/review`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${teacherToken}` },
    body: {
      status: approved ? 'approved' : 'rejected',
      comment: approved ? '资格审核通过，符合实习条件' : '材料不完整，请重新提交'
    }
  })
  if (res.status !== 200) {
    throw new Error(`审核失败 [${res.status}]: ${JSON.stringify(res.body)}`)
  }
  return res.body
}

const listReviews = async (teacherToken, status = 'pending') => {
  const res = await request(`/reviews?status=${status}`, {
    headers: { Authorization: `Bearer ${teacherToken}` }
  })
  if (res.status !== 200) {
    throw new Error(`获取审核列表失败 [${res.status}]: ${JSON.stringify(res.body)}`)
  }
  return res.body.reviews || []
}

const applyJob = async (token, jobId) => {
  const res = await request('/applications', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: { jobId }
  })
  return res
}

const getJob = async (token, jobId) => {
  const res = await request(`/jobs/${jobId}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  return res.body?.job
}

const listApplicationsForJob = async (token, jobId) => {
  const res = await request(`/jobs/${jobId}/applications`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (res.status !== 200) {
    throw new Error(`获取投递列表失败 [${res.status}]: ${JSON.stringify(res.body)}`)
  }
  return res.body.applications || []
}

const acceptApplication = async (token, appId) => {
  const res = await request(`/applications/${appId}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  })
  return res
}

const confirmApplication = async (token, appId) => {
  const res = await request(`/applications/${appId}/confirm`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  })
  return res
}

const myApplications = async (token) => {
  const res = await request('/applications/my', {
    headers: { Authorization: `Bearer ${token}` }
  })
  return res.body?.applications || []
}

const hiringRecords = async (token) => {
  const res = await request('/applications/hiring-records', {
    headers: { Authorization: `Bearer ${token}` }
  })
  return res.body?.records || []
}

const main = async () => {
  console.log('\n' + '='.repeat(70))
  log(`🎯 ${SUITE_NAME}`)
  log(`🕒 启动时间: ${new Date().toLocaleString()}`)
  log(`🌐 API 地址: ${API_BASE}`)
  console.log('='.repeat(70))

  try {
    log('\n📍 [0/3] 环境与用户准备', 0)
    const health = await request('/health')
    assert(health.status === 200 && health.body?.status === 'ok', '后端服务健康检查通过')

    const comp1 = await register(makeCompany(1))
    assert(comp1?.user?.role === 'company', '注册企业账号成功')
    const compToken = comp1.token

    const stu1 = await register(makeStudent(1))
    assert(stu1?.user?.role === 'student', '注册学生账号1成功（无保险）')
    const stuToken1 = stu1.token

    const stu2 = await register(makeStudent(2))
    assert(stu2?.user?.role === 'student', '注册学生账号2成功（有保险）')
    const stuToken2 = stu2.token

    const tch1 = await register(makeTeacher(1))
    assert(tch1?.user?.role === 'teacher', '注册学院老师账号成功')
    const tchToken1 = tch1.token

    log('\n📍 [场景1] 未通过资格审核 → 投递失败', 0)

    await uploadResume(stuToken1)
    const rs1Before = await getReviewStatus(stuToken1)
    assert(rs1Before?.review?.status === 'pending', '学生1简历上传后自动生成待审核状态')

    const job1 = await createJob(compToken, makeJob(5, false, 7))
    assert(job1?.id > 0 && job1.quota === 5, `岗位1创建成功（名额5，无需保险）`)

    log('  → 尝试在资格审核未通过时投递', 1)
    const applyRes1 = await applyJob(stuToken1, job1.id)
    assert(applyRes1.status === 400, `投递返回 400 错误码（实际: ${applyRes1.status}）`)
    const errors1 = applyRes1.body?.errors || []
    assert(
      errors1.some(e => /资格审核/.test(e)),
      `错误信息包含"资格审核"相关提示（实际: ${JSON.stringify(errors1)}）`
    )
    const myApps1 = await myApplications(stuToken1)
    assert(myApps1.length === 0, `投递失败后数据库无此投递记录（当前: ${myApps1.length}条）`)

    log('\n📍 [场景2] 重复投递 → 失败', 0)

    await uploadResume(stuToken2)
    const pendingReviews = await listReviews(tchToken1, 'pending')
    const stu2Review = pendingReviews.find(r =>
      r.studentId === stu2.profile.id
    )
    assert(!!stu2Review, '老师端查询到学生2的待审核记录')
    await reviewApproval(tchToken1, stu2Review.id, true)
    const rs2After = await getReviewStatus(stuToken2)
    assert(rs2After?.review?.status === 'approved', '老师审核通过 → 学生2资格状态为通过')

    log('  → 首次投递', 1)
    const firstApply = await applyJob(stuToken2, job1.id)
    assert(firstApply.status === 201, `首次投递返回 201 成功（实际: ${firstApply.status}）`)
    const appsAfterFirst = await myApplications(stuToken2)
    assert(appsAfterFirst.length === 1, `首次投递成功，投递记录1条（当前: ${appsAfterFirst.length}条）`)

    log('  → 重复投递同一岗位', 1)
    const dupApply = await applyJob(stuToken2, job1.id)
    assert(dupApply.status === 400, `重复投递返回 400 错误（实际: ${dupApply.status}）`)
    const dupErrors = dupApply.body?.errors || []
    assert(
      dupErrors.some(e => /重复|已投/.test(e)),
      `错误信息包含"重复/已投"提示（实际: ${JSON.stringify(dupErrors)}）`
    )
    const appsAfterDup = await myApplications(stuToken2)
    assert(appsAfterDup.length === 1, `重复投递未新增记录（仍为: ${appsAfterDup.length}条）`)

    log('\n📍 [场景3] 企业录用 → 名额扣减', 0)

    const jobBefore = await getJob(compToken, job1.id)
    const quotaBefore = jobBefore.remainingQuota
    log(`  → 录用前岗位剩余名额: ${quotaBefore}/${jobBefore.quota}`, 1)

    const apps = await listApplicationsForJob(compToken, job1.id)
    assert(apps.length >= 1, `企业端查询到至少1条投递记录（实际: ${apps.length}条）`)
    const targetApp = apps.find(a => a.status === 'applied') || apps[0]

    const hireRes = await acceptApplication(compToken, targetApp.id)
    assert(hireRes.status === 200, `录用接口返回 200 成功（实际: ${hireRes.status}）`)
    assert(hireRes.body?.application?.status === 'accepted', '投递状态更新为 accepted')

    const jobAfter = await getJob(compToken, job1.id)
    const quotaAfter = jobAfter.remainingQuota
    log(`  → 录用后岗位剩余名额: ${quotaAfter}/${jobAfter.quota}`, 1)

    assert(
      quotaAfter === quotaBefore - 1,
      `名额扣减正确: ${quotaBefore} → ${quotaAfter}（预期: ${quotaBefore - 1}）`
    )

    const records = await hiringRecords(compToken)
    assert(records.length >= 1, `录用记录已写入（当前: ${records.length}条，内容: ${JSON.stringify(records)}）`)
    const latestRecord = records.length > 0 ? records[0] : null
    if (latestRecord) {
      assert(
        latestRecord.quotaBefore === quotaBefore && latestRecord.quotaAfter === quotaAfter,
        `录用记录中名额变化准确: ${latestRecord.quotaBefore} → ${latestRecord.quotaAfter}`
      )
    }

    const appsAfterHire = await myApplications(stuToken2)
    const acceptedApp = appsAfterHire.find(a => a.id === targetApp.id)
    assert(acceptedApp?.status === 'accepted', '学生端同步显示录用状态')

    log('\n  → 学生确认录用 → 其他投递自动不可录用', 1)
    const job2 = await createJob(compToken, makeJob(2, false, 7))
    const apply2 = await applyJob(stuToken2, job2.id)
    assert(apply2.status === 201, '学生2投递岗位2成功（用于验证禁用逻辑）')

    const confirmRes = await confirmApplication(stuToken2, targetApp.id)
    assert(confirmRes.status === 200, `确认录用接口成功（实际: ${confirmRes.status}）`)

    const appsFinal = await myApplications(stuToken2)
    const confirmedApp = appsFinal.find(a => a.id === targetApp.id)
    const disabledApp = appsFinal.find(a => a.jobId === job2.id)

    assert(confirmedApp?.status === 'confirmed', '被确认的投递状态为 confirmed')
    assert(disabledApp?.status === 'disabled' || !disabledApp?.isHireable, `其他投递变为不可录用（status: ${disabledApp?.status}, isHireable: ${disabledApp?.isHireable}）`)

    const finalJob = await getJob(compToken, job1.id)
    assert(
      finalJob.remainingQuota === quotaBefore - 1,
      `最终岗位名额稳定在 ${finalJob.remainingQuota}（无异常回滚）`
    )

  } catch (e) {
    failed++
    results.push({ status: 'ERROR', msg: `测试执行异常: ${e.message}` })
    log(`\n💥 执行中断: ${e.message}`, 0)
    console.error(e.stack)
  }

  console.log('\n' + '='.repeat(70))
  log(`📊 ${SUITE_NAME} - 最终报告`)
  console.log('='.repeat(70))
  log(`  总用例: ${passed + failed}`)
  log(`  通过  : ${passed}`)
  log(`  失败  : ${failed}`)
  log(`  通过率: ${(passed / Math.max(passed + failed, 1) * 100).toFixed(1)}%`)
  console.log('-'.repeat(70))

  results.forEach(r => {
    const mark = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️'
    log(`${mark} [${r.status}] ${r.msg}`)
  })

  console.log('='.repeat(70))
  if (failed > 0) {
    log(`❌ 存在失败用例，请检查以上错误`)
    process.exit(1)
  } else {
    log(`🎉 所有 Smoke 用例全部通过！`)
    process.exit(0)
  }
}

main()
