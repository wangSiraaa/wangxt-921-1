import React, { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { jobAPI, applicationAPI } from '../api'
import JobDetailModal from '../components/JobDetailModal.jsx'

export default function CompanyDashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const [jobs, setJobs] = useState([])
  const [stats, setStats] = useState({ total: 0, open: 0, filled: 0, hired: 0 })
  const [selectedJob, setSelectedJob] = useState(null)
  const [loading, setLoading] = useState(false)
  const [applications, setApplications] = useState([])
  const [hiringRecords, setHiringRecords] = useState([])
  const [currentJobApplications, setCurrentJobApplications] = useState([])
  const [showAppModal, setShowAppModal] = useState(false)

  const loadJobs = async () => {
    setLoading(true)
    try {
      const res = await jobAPI.list()
      setJobs(res.data.jobs || [])
      const total = (res.data.jobs || []).length
      const open = (res.data.jobs || []).filter(j => j.status === 'open').length
      const filled = (res.data.jobs || []).filter(j => j.status === 'filled').length
      const hired = (res.data.jobs || []).reduce((s, j) => s + (j.quota - j.remainingQuota), 0)
      setStats({ total, open, filled, hired })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const loadRecords = async () => {
    try {
      const res = await applicationAPI.hiringRecords()
      setHiringRecords(res.data.records || [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (location.pathname.match(/^\/company\/?$/)) loadJobs()
    if (location.pathname === '/company/records') loadRecords()
  }, [location.pathname])

  const handleDelete = async (id) => {
    if (!confirm('确定删除此岗位？有关联投递则只会关闭状态')) return
    try {
      await jobAPI.remove(id)
      loadJobs()
    } catch (e) {
      alert(e.response?.data?.message || '操作失败')
    }
  }

  const handleViewApplications = async (job) => {
    try {
      const res = await jobAPI.applications(job.id)
      setCurrentJobApplications(res.data.applications || [])
      setShowAppModal(true)
    } catch (e) {
      alert(e.response?.data?.message || '获取失败')
    }
  }

  const handleAccept = async (app) => {
    if (!confirm(`确认录用 ${app.Student?.User?.name || '学生'}？`)) return
    try {
      await applicationAPI.accept(app.id)
      alert('录用成功！名额已扣减')
      handleViewApplications({ id: app.jobId })
      loadJobs()
      loadRecords()
    } catch (e) {
      alert(e.response?.data?.message || '操作失败')
    }
  }

  const handleReject = async (app) => {
    const reason = prompt('请输入拒绝原因（可选）：')
    try {
      await applicationAPI.reject(app.id, { rejectReason: reason })
      handleViewApplications({ id: app.jobId })
    } catch (e) {
      alert(e.response?.data?.message || '操作失败')
    }
  }

  const JobListPage = () => (
    <div className="main-content">
      <h2 className="page-title">岗位管理</h2>

      <div className="stat-cards">
        <div className="stat-card primary"><div className="stat-label">岗位总数</div><div className="stat-value">{stats.total}</div></div>
        <div className="stat-card success"><div className="stat-label">招聘中</div><div className="stat-value">{stats.open}</div></div>
        <div className="stat-card warning"><div className="stat-label">已招满</div><div className="stat-value">{stats.filled}</div></div>
        <div className="stat-card danger"><div className="stat-label">已录用人数</div><div className="stat-value">{stats.hired}</div></div>
      </div>

      <div className="flex-between mb-16">
        <h3 style={{ fontSize: 18 }}>我的岗位列表</h3>
        <button className="btn btn-primary" onClick={() => navigate('/company/create')}>＋ 发布新岗位</button>
      </div>

      {loading ? (
        <div className="empty-state"><div className="icon">⏳</div><h3>加载中...</h3></div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📋</div>
          <h3>暂无岗位</h3>
          <p>点击右上角按钮发布您的第一个实习岗位</p>
        </div>
      ) : (
        <div className="job-grid">
          {jobs.map(job => (
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
                {job.location && <span className="tag info">📍 {job.location}</span>}
              </div>

              <div style={{ marginBottom: 8 }}>
                <div className="flex-between text-xs text-muted">
                  <span>名额进度</span>
                  <span>{job.remainingQuota} / {job.quota} 剩余</span>
                </div>
                <div className="quota-bar">
                  <div className="quota-bar-fill" style={{
                    width: `${((job.quota - job.remainingQuota) / job.quota * 100).toFixed(0)}%`
                  }} />
                </div>
              </div>

              <div className="job-footer">
                <span>📅 截止: {new Date(job.deadline).toLocaleDateString()}</span>
              </div>

              <div className="flex gap-8 mt-16" onClick={e => e.stopPropagation()}>
                <button className="btn btn-sm btn-info" onClick={() => handleViewApplications(job)}>
                  📨 查看投递
                </button>
                <button className="btn btn-sm btn-default" onClick={() => navigate(`/company/edit/${job.id}`)}>
                  ✏️ 编辑
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(job.id)}>
                  🗑️ 删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedJob && (
        <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} />
      )}

      {showAppModal && (
        <div className="modal-mask" onClick={() => setShowAppModal(false)}>
          <div className="modal" style={{ maxWidth: 800 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📨 投递记录</h3>
              <button className="modal-close" onClick={() => setShowAppModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {currentJobApplications.length === 0 ? (
                <div className="empty-state">
                  <div className="icon">📭</div>
                  <h3>暂无投递记录</h3>
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>学生姓名</th>
                      <th>专业/年级</th>
                      <th>邮箱</th>
                      <th>投递时间</th>
                      <th>状态</th>
                      <th>可录用</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentJobApplications.map(app => (
                      <tr key={app.id}>
                        <td style={{ fontWeight: 500 }}>{app.Student?.User?.name}</td>
                        <td>{app.Student?.major} / {app.Student?.grade}级</td>
                        <td className="text-sm text-muted">{app.Student?.User?.email || '-'}</td>
                        <td className="text-sm text-muted">{new Date(app.applyTime).toLocaleString()}</td>
                        <td>
                          <span className={`status-badge status-${app.status}`}>
                            {{ applied: '已投递', reviewing: '审核中', accepted: '已录用', rejected: '已拒绝', confirmed: '已确认', disabled: '不可录用' }[app.status]}
                          </span>
                        </td>
                        <td>{app.isHireable ? <span className="tag success">是</span> : <span className="tag danger">否</span>}</td>
                        <td>
                          <div className="flex gap-8">
                            {app.isHireable && !['accepted', 'confirmed'].includes(app.status) && (
                              <button className="btn btn-sm btn-success" onClick={() => handleAccept(app)}>录用</button>
                            )}
                            {app.status !== 'rejected' && app.status !== 'confirmed' && (
                              <button className="btn btn-sm btn-danger" onClick={() => handleReject(app)}>拒绝</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )

  const CreateJobPage = () => <CreateJob onSuccess={() => navigate('/company')} />
  const EditJobPage = () => {
    const id = parseInt(location.pathname.split('/').pop())
    return <CreateJob editId={id} onSuccess={() => navigate('/company')} />
  }

  const RecordsPage = () => (
    <div className="main-content">
      <h2 className="page-title">📋 录用记录</h2>
      {hiringRecords.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📑</div>
          <h3>暂无录用记录</h3>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>岗位</th>
              <th>学生</th>
              <th>录用时间</th>
              <th>名额变化</th>
              <th>确认状态</th>
              <th>确认时间</th>
            </tr>
          </thead>
          <tbody>
            {hiringRecords.map(r => (
              <tr key={r.id}>
                <td style={{ fontWeight: 500 }}>{r.Job?.title}</td>
                <td>{r.Student?.User?.name}</td>
                <td className="text-sm text-muted">{new Date(r.hireTime).toLocaleString()}</td>
                <td>
                  <span className="tag danger">{r.quotaBefore}</span>
                  <span style={{ margin: '0 4px' }}>→</span>
                  <span className="tag success">{r.quotaAfter}</span>
                </td>
                <td>
                  {r.confirmedTime ? <span className="status-badge status-confirmed">已确认</span> : <span className="status-badge status-accepted">待确认</span>}
                </td>
                <td className="text-sm text-muted">{r.confirmedTime ? new Date(r.confirmedTime).toLocaleString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )

  return (
    <Routes>
      <Route path="/" element={<JobListPage />} />
      <Route path="/create" element={<CreateJobPage />} />
      <Route path="/edit/:id" element={<EditJobPage />} />
      <Route path="/records" element={<RecordsPage />} />
    </Routes>
  )
}

function CreateJob({ editId, onSuccess }) {
  const [form, setForm] = useState({
    title: '', description: '', requiredMajor: '', requiredGrade: 2022,
    quota: 1, deadline: '', requireInsurance: false, salary: '', location: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (editId) {
      jobAPI.get(editId).then(res => {
        const j = res.data.job
        setForm({
          title: j.title, description: j.description, requiredMajor: j.requiredMajor,
          requiredGrade: j.requiredGrade, quota: j.quota,
          deadline: new Date(j.deadline).toISOString().slice(0, 16),
          requireInsurance: j.requireInsurance, salary: j.salary || '', location: j.location || ''
        })
      }).catch(e => alert('加载岗位失败'))
    }
  }, [editId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (editId) {
        await jobAPI.update(editId, form)
      } else {
        await jobAPI.create(form)
      }
      alert(editId ? '岗位更新成功！' : '岗位发布成功！')
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.message || '操作失败')
    } finally {
      setLoading(false)
    }
  }

  const set = (k, v) => setForm({ ...form, [k]: v })

  return (
    <div className="main-content">
      <h2 className="page-title">{editId ? '✏️ 编辑岗位' : '＋ 发布新岗位'}</h2>
      <div className="card" style={{ maxWidth: 800, margin: '0 auto' }}>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>岗位名称 *</label>
              <input value={form.title} onChange={e => set('title', e.target.value)} required placeholder="如：前端开发实习生" />
            </div>
            <div className="form-group">
              <label>招录名额 *</label>
              <input type="number" min={1} value={form.quota} onChange={e => set('quota', parseInt(e.target.value))} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>要求专业 *</label>
              <input value={form.requiredMajor} onChange={e => set('requiredMajor', e.target.value)} required placeholder="多个专业用逗号分隔" />
            </div>
            <div className="form-group">
              <label>要求年级 *</label>
              <select value={form.requiredGrade} onChange={e => set('requiredGrade', parseInt(e.target.value))} required>
                {[2020, 2021, 2022, 2023, 2024, 2025].map(y => <option key={y} value={y}>{y}级</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>截止日期 *</label>
              <input type="datetime-local" value={form.deadline} onChange={e => set('deadline', e.target.value)} required />
            </div>
            <div className="form-group">
              <label>薪资待遇</label>
              <input value={form.salary} onChange={e => set('salary', e.target.value)} placeholder="如：3000-5000/月" />
            </div>
          </div>
          <div className="form-group">
            <label>工作地点</label>
            <input value={form.location} onChange={e => set('location', e.target.value)} />
          </div>
          <div className="form-group">
            <label>岗位描述 *</label>
            <textarea rows={5} value={form.description} onChange={e => set('description', e.target.value)} required />
          </div>
          <div className="checkbox-row">
            <input type="checkbox" id="requireInsurance" checked={!!form.requireInsurance}
              onChange={e => set('requireInsurance', e.target.checked)} />
            <label htmlFor="requireInsurance" style={{ cursor: 'pointer' }}>要求学生提供实习保险材料</label>
          </div>
          <div className="flex gap-8 mt-16">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '提交中...' : (editId ? '保存修改' : '发布岗位')}
            </button>
            <button type="button" className="btn btn-default" onClick={onSuccess}>返回</button>
          </div>
        </form>
      </div>
    </div>
  )
}
