import React, { useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { jobAPI, resumeAPI, reviewAPI, applicationAPI } from '../api'
import JobDetailModal from '../components/JobDetailModal.jsx'

export default function StudentDashboard() {
  const location = useLocation()
  const [jobs, setJobs] = useState([])
  const [totalJobs, setTotalJobs] = useState(0)
  const [filters, setFilters] = useState({ page: 1, pageSize: 12, keyword: '', major: '', grade: '' })
  const [loading, setLoading] = useState(false)
  const [selectedJob, setSelectedJob] = useState(null)
  const [applyErrors, setApplyErrors] = useState([])
  const [success, setSuccess] = useState('')
  const [myApplications, setMyApplications] = useState([])
  const [resumeInfo, setResumeInfo] = useState({ resume: null, review: null, student: null })
  const [reviewStatus, setReviewStatus] = useState(null)
  const [appliedJobIds, setAppliedJobIds] = useState(new Set())
  const [profileLoading, setProfileLoading] = useState(true)

  const loadJobs = async () => {
    setLoading(true)
    try {
      const res = await jobAPI.list(filters)
      setJobs(res.data.jobs || [])
      setTotalJobs(res.data.total || 0)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const loadApplications = async () => {
    try {
      const res = await applicationAPI.my()
      setMyApplications(res.data.applications || [])
      setAppliedJobIds(new Set((res.data.applications || []).map(a => a.jobId)))
    } catch (e) { console.error(e) }
  }

  const loadResume = async () => {
    setProfileLoading(true)
    try {
      const res = await resumeAPI.my()
      const { resume = null, review = null, student = null } = res.data || {}
      setResumeInfo({ resume, review, student })
      setReviewStatus(review?.status || null)
    } catch (e) { console.error(e) }
    finally { setProfileLoading(false) }
  }

  useEffect(() => {
    if (location.pathname.match(/^\/student\/?$/)) {
      loadJobs()
      loadApplications()
      loadResume()
    }
    if (location.pathname === '/student/resume') loadResume()
    if (location.pathname === '/student/applications') loadApplications()
  }, [location.pathname, filters])

  const handleApply = async (job) => {
    if (profileLoading) {
      alert('正在加载个人信息，请稍候...')
      return
    }
    if (!resumeInfo?.resume) {
      alert('请先上传简历并等待资格审核通过')
      return
    }
    if (!reviewStatus || reviewStatus === 'pending') {
      alert('资格审核待处理，暂不可投递')
      return
    }
    if (reviewStatus === 'rejected') {
      alert('资格审核未通过，不可投递')
      return
    }
    if (job.requireInsurance && !resumeInfo.student?.hasInsurance) {
      alert('该岗位要求提供保险材料，请在简历页面补充后再投递')
      return
    }
    setApplyErrors([])
    setSuccess('')
    try {
      const res = await applicationAPI.apply({ jobId: job.id })
      setSuccess(res.data.message)
      setAppliedJobIds(prev => new Set([...prev, job.id]))
      loadApplications()
    } catch (e) {
      setApplyErrors(e.response?.data?.errors || [e.response?.data?.message || '投递失败'])
    }
  }

  const handleConfirm = async (app) => {
    if (!confirm('确认接受该录用？确认后其他投递将变为不可录用状态，此操作不可撤销！')) return
    try {
      await applicationAPI.confirm(app.id)
      alert('确认成功！其他投递已自动设为不可录用')
      loadApplications()
    } catch (e) {
      alert(e.response?.data?.message || '操作失败')
    }
  }

  const JobHallPage = () => (
    <div className="main-content">
      <h2 className="page-title">🎯 岗位大厅</h2>

      <div className="stat-cards">
        <div className="stat-card primary"><div className="stat-label">可投岗位</div><div className="stat-value">{totalJobs}</div></div>
        <div className="stat-card success"><div className="stat-label">我的投递</div><div className="stat-value">{myApplications.length}</div></div>
        <div className="stat-card warning">
          <div className="stat-label">资格审核状态</div>
          <div className="stat-value" style={{ fontSize: 18 }}>
            {profileLoading && <span style={{ color: '#909399' }}>加载中...</span>}
            {!profileLoading && !reviewStatus && resumeInfo.resume && <span style={{ color: '#909399' }}>暂无记录</span>}
            {!profileLoading && !reviewStatus && !resumeInfo.resume && <span style={{ color: '#909399' }}>未上传简历</span>}
            {!profileLoading && reviewStatus === 'pending' && <span style={{ color: '#e6a23c' }}>⏳ 待审核</span>}
            {!profileLoading && reviewStatus === 'approved' && <span style={{ color: '#67c23a' }}>✅ 已通过</span>}
            {!profileLoading && reviewStatus === 'rejected' && <span style={{ color: '#f56c6c' }}>❌ 未通过</span>}
          </div>
        </div>
        <div className="stat-card danger">
          <div className="stat-label">保险材料</div>
          <div className="stat-value" style={{ fontSize: 18 }}>
            {profileLoading && <span style={{ color: '#909399' }}>加载中...</span>}
            {!profileLoading && !resumeInfo.student && <span style={{ color: '#909399' }}>未上传</span>}
            {!profileLoading && resumeInfo.student?.hasInsurance ? <span style={{ color: '#67c23a' }}>✅ 已准备</span> : !profileLoading && resumeInfo.student && <span style={{ color: '#f56c6c' }}>❌ 未准备</span>}
          </div>
        </div>
      </div>

      {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}
      {applyErrors.length > 0 && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          <b>投递失败：</b>
          <ul style={{ marginTop: 6, paddingLeft: 20 }}>
            {applyErrors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      <div className="filter-bar">
        <input
          type="text" placeholder="搜索岗位名称..."
          value={filters.keyword}
          onChange={e => { setFilters({ ...filters, keyword: e.target.value, page: 1 }) }}
        />
        <input
          type="text" placeholder="搜索专业..."
          value={filters.major}
          onChange={e => setFilters({ ...filters, major: e.target.value, page: 1 })}
        />
        <select
          value={filters.grade}
          onChange={e => setFilters({ ...filters, grade: e.target.value, page: 1 })}
        >
          <option value="">全部年级</option>
          {[2020, 2021, 2022, 2023, 2024, 2025].map(y => <option key={y} value={y}>{y}级</option>)}
        </select>
        <button className="btn btn-default" onClick={() => { setFilters({ page: 1, pageSize: 12, keyword: '', major: '', grade: '' }); loadJobs() }}>
          重置
        </button>
      </div>

      {loading ? (
        <div className="empty-state"><div className="icon">⏳</div><h3>加载中...</h3></div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🔍</div>
          <h3>暂无匹配的岗位</h3>
          <p>请尝试调整筛选条件</p>
        </div>
      ) : (
        <>
          <div className="job-grid">
            {jobs.map(job => {
              const isApplied = appliedJobIds.has(job.id)
              const isExpired = new Date(job.deadline) < new Date()
              const progress = ((job.quota - job.remainingQuota) / job.quota * 100).toFixed(0)

              return (
                <div key={job.id} className="job-card" onClick={() => setSelectedJob(job)}>
                  <div className="flex-between" style={{ marginBottom: 8 }}>
                    <h3>{job.title}</h3>
                    <span className={`status-badge status-${job.status}`}>
                      {job.status === 'open' ? '招聘中' : job.status === 'filled' ? '已招满' : '已关闭'}
                    </span>
                  </div>
                  <div className="company-name">🏢 {job.Company?.companyName}</div>

                  <div className="job-tags">
                    <span className="tag">📚 {job.requiredMajor}</span>
                    <span className="tag warning">🎓 {job.requiredGrade}级</span>
                    {job.requireInsurance && <span className="tag danger">⚠ 需保险</span>}
                    {job.salary && <span className="tag success">💰 {job.salary}</span>}
                    {isApplied && <span className="tag info" style={{ fontWeight: 600 }}>✓ 已投递</span>}
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <div className="quota-bar">
                      <div className="quota-bar-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="flex-between text-xs text-muted" style={{ marginTop: 4 }}>
                      <span>{job.remainingQuota}/{job.quota} 名额</span>
                      <span>{isExpired ? '⚠ 已截止' : `📅 ${new Date(job.deadline).toLocaleDateString()}`}</span>
                    </div>
                  </div>

                  <div className="flex gap-8" onClick={e => e.stopPropagation()}>
                    <button className="btn btn-sm btn-info" style={{ flex: 1 }} onClick={() => setSelectedJob(job)}>查看详情</button>
                    <button
                      className="btn btn-sm btn-primary"
                      style={{ flex: 1 }}
                      disabled={
                        profileLoading ||
                        isApplied ||
                        isExpired ||
                        job.status !== 'open' ||
                        job.remainingQuota <= 0 ||
                        reviewStatus !== 'approved'
                      }
                      onClick={() => handleApply(job)}
                    >
                      {isApplied ? '已投递' :
                        profileLoading ? '加载中...' :
                          reviewStatus === 'pending' ? '审核中' :
                            reviewStatus === 'rejected' ? '审核未通过' :
                              !reviewStatus ? '请先上传简历' :
                                isExpired ? '已截止' :
                                  job.remainingQuota <= 0 ? '招满' : '立即投递'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {totalJobs > filters.pageSize && (
            <div className="pagination">
              <button disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>上一页</button>
              <span className="text-sm text-muted">
                第 {filters.page} / {Math.ceil(totalJobs / filters.pageSize)} 页
              </span>
              <button
                disabled={filters.page >= Math.ceil(totalJobs / filters.pageSize)}
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
              >下一页</button>
            </div>
          )}
        </>
      )}

      {selectedJob && <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} />}
    </div>
  )

  const ResumePage = () => {
    const [file, setFile] = useState(null)
    const [extra, setExtra] = useState({ skills: '', experience: '', education: '' })
    const [uploading, setUploading] = useState(false)
    const [msg, setMsg] = useState({ type: '', text: '' })

    const handleUpload = async () => {
      if (!file) {
        setMsg({ type: 'error', text: '请选择简历文件' })
        return
      }
      setMsg({ type: '', text: '' })
      setUploading(true)
      try {
        const fd = new FormData()
        fd.append('resume', file)
        fd.append('skills', extra.skills)
        fd.append('experience', extra.experience)
        fd.append('education', extra.education)
        const res = await resumeAPI.upload(fd)
        setMsg({ type: 'success', text: res.data.message })
        loadResume()
      } catch (e) {
        setMsg({ type: 'error', text: e.response?.data?.message || '上传失败' })
      } finally {
        setUploading(false)
      }
    }

    return (
      <div className="main-content">
        <h2 className="page-title">📄 我的简历</h2>

        {resumeInfo.review && (
          <div className={`alert alert-${resumeInfo.review.status === 'approved' ? 'success' : resumeInfo.review.status === 'rejected' ? 'error' : 'warning'}`} style={{ marginBottom: 20 }}>
            <b>资格审核状态：</b>
            <span className={`status-badge status-${resumeInfo.review.status}`} style={{ marginLeft: 8 }}>
              {resumeInfo.review.status === 'pending' ? '待审核' : resumeInfo.review.status === 'approved' ? '已通过' : '未通过'}
            </span>
            {resumeInfo.review.comment && (
              <div style={{ marginTop: 8 }} className="text-sm">审核意见：{resumeInfo.review.comment}</div>
            )}
            {resumeInfo.review.status === 'rejected' && (
              <div style={{ marginTop: 8 }} className="text-sm text-muted">
                提示：重新上传简历后会自动发起新的资格审核
              </div>
            )}
          </div>
        )}

        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 16 }}>上传 / 更新简历</h3>
          {msg.text && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

          <div className="form-row">
            <div className="form-group">
              <label>简历文件 * (PDF/DOC/DOCX/TXT，最大10MB)</label>
              <div className="upload-area" onClick={() => document.getElementById('resumeInput').click()}>
                <div className="upload-icon">📁</div>
                <div className="upload-text">
                  {file ? `已选择: ${file.name}` : '点击选择文件 或 拖拽文件到此'}
                </div>
                <div className="upload-hint">支持 PDF、Word、TXT 格式</div>
                <input
                  id="resumeInput"
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  style={{ display: 'none' }}
                  onChange={e => e.target.files[0] && setFile(e.target.files[0])}
                />
              </div>
            </div>
          </div>
          <div className="form-group">
            <label>技能特长</label>
            <textarea rows={2} value={extra.skills} onChange={e => setExtra({ ...extra, skills: e.target.value })}
              placeholder="如：JavaScript, React, Node.js..." />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>实习/项目经历</label>
              <textarea rows={4} value={extra.experience} onChange={e => setExtra({ ...extra, experience: e.target.value })} />
            </div>
            <div className="form-group">
              <label>教育背景</label>
              <textarea rows={4} value={extra.education} onChange={e => setExtra({ ...extra, education: e.target.value })} />
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleUpload} disabled={uploading}>
            {uploading ? '上传中...' : '📤 上传简历并提交审核'}
          </button>
        </div>

        {resumeInfo.resume && (
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>当前简历信息</h3>
            <div className="detail-row"><div className="label">文件名</div><div>{resumeInfo.resume.fileName}</div></div>
            <div className="detail-row"><div className="label">文件大小</div><div>{(resumeInfo.resume.fileSize / 1024).toFixed(1)} KB</div></div>
            <div className="detail-row"><div className="label">上传时间</div><div>{new Date(resumeInfo.resume.uploadTime).toLocaleString()}</div></div>
            {resumeInfo.resume.skills && <div className="detail-row"><div className="label">技能</div><div>{resumeInfo.resume.skills}</div></div>}
            {resumeInfo.resume.experience && <div className="detail-row"><div className="label">经历</div><div style={{ whiteSpace: 'pre-wrap' }}>{resumeInfo.resume.experience}</div></div>}
            {resumeInfo.resume.education && <div className="detail-row"><div className="label">教育</div><div style={{ whiteSpace: 'pre-wrap' }}>{resumeInfo.resume.education}</div></div>}
          </div>
        )}
      </div>
    )
  }

  const ApplicationsPage = () => {
    const [filter, setFilter] = useState('all')

    const filtered = myApplications.filter(a => {
      if (filter === 'all') return true
      return a.status === filter
    })

    return (
      <div className="main-content">
        <h2 className="page-title">📨 我的投递记录</h2>

        <div className="filter-bar">
          {[
            { value: 'all', label: '全部' },
            { value: 'applied', label: '已投递' },
            { value: 'reviewing', label: '审核中' },
            { value: 'accepted', label: '已录用' },
            { value: 'confirmed', label: '已确认' },
            { value: 'rejected', label: '已拒绝' },
            { value: 'disabled', label: '不可录用' }
          ].map(opt => (
            <button
              key={opt.value}
              className={`btn btn-sm ${filter === opt.value ? 'btn-primary' : 'btn-default'}`}
              onClick={() => setFilter(opt.value)}
            >{opt.label}</button>
          ))}
        </div>

        {myApplications.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📭</div>
            <h3>暂无投递记录</h3>
            <p>去岗位大厅投递心仪的实习岗位吧</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🔍</div>
            <h3>该状态下无记录</h3>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>岗位</th>
                <th>企业</th>
                <th>投递时间</th>
                <th>状态</th>
                <th>可录用</th>
                <th>拒绝原因</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(app => (
                <tr key={app.id}>
                  <td style={{ fontWeight: 500 }}>{app.Job?.title}</td>
                  <td className="text-sm text-muted">{app.Job?.Company?.companyName}</td>
                  <td className="text-sm text-muted">{new Date(app.applyTime).toLocaleString()}</td>
                  <td>
                    <span className={`status-badge status-${app.status}`}>
                      {{ applied: '已投递', reviewing: '审核中', accepted: '已录用', rejected: '已拒绝', confirmed: '已确认', disabled: '不可录用' }[app.status]}
                    </span>
                  </td>
                  <td>{app.isHireable ? <span className="tag success">是</span> : <span className="tag danger">否</span>}</td>
                  <td className="text-sm text-muted">{app.rejectReason || '-'}</td>
                  <td>
                    <div className="flex gap-8">
                      <button className="btn btn-sm btn-info" onClick={() => setSelectedJob(app.Job)}>看岗位</button>
                      {app.status === 'accepted' && (
                        <button className="btn btn-sm btn-success" onClick={() => handleConfirm(app)}>✅ 确认录用</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {selectedJob && <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} />}
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<JobHallPage />} />
      <Route path="/resume" element={<ResumePage />} />
      <Route path="/applications" element={<ApplicationsPage />} />
    </Routes>
  )
}
