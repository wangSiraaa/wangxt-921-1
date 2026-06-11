import React, { useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { reviewAPI } from '../api'

export default function TeacherDashboard() {
  const location = useLocation()
  const [pending, setPending] = useState([])
  const [all, setAll] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(false)

  const loadPending = async () => {
    setLoading(true)
    try {
      const res = await reviewAPI.list({ status: 'pending' })
      setPending(res.data.reviews || [])
    } finally { setLoading(false) }
  }

  const loadAll = async () => {
    setLoading(true)
    try {
      const params = filter !== 'all' ? { status: filter } : {}
      const res = await reviewAPI.list(params)
      setAll(res.data.reviews || [])
    } finally { setLoading(false) }
  }

  useEffect(() => {
    if (location.pathname.match(/^\/teacher\/?$/)) loadPending()
    if (location.pathname === '/teacher/all') loadAll()
  }, [location.pathname, filter])

  const handleReview = async (review, status) => {
    const comment = status === 'rejected'
      ? prompt('请输入审核不通过的原因：', '资格条件不符合')
      : (prompt('请输入审核意见（可选）：') || '审核通过')
    if (comment === null) return

    try {
      await reviewAPI.review(review.id, { status, comment })
      alert(status === 'approved' ? '审核通过！' : '已驳回')
      loadPending()
      loadAll()
    } catch (e) {
      alert(e.response?.data?.message || '操作失败')
    }
  }

  const ReviewTable = ({ reviews, showActions }) => (
    loading ? (
      <div className="empty-state"><div className="icon">⏳</div><h3>加载中...</h3></div>
    ) : reviews.length === 0 ? (
      <div className="empty-state">
        <div className="icon">✅</div>
        <h3>暂无记录</h3>
      </div>
    ) : (
      <table className="table">
        <thead>
          <tr>
            <th>学生姓名</th>
            <th>学号</th>
            <th>学院 / 专业</th>
            <th>年级</th>
            <th>保险材料</th>
            <th>简历</th>
            <th>审核状态</th>
            <th>审核人</th>
            <th>提交时间</th>
            {showActions && <th>操作</th>}
          </tr>
        </thead>
        <tbody>
          {reviews.map(r => (
            <tr key={r.id}>
              <td style={{ fontWeight: 500 }}>{r.Student?.User?.name}</td>
              <td className="text-sm">{r.Student?.studentNo}</td>
              <td className="text-sm">{r.Student?.college} / {r.Student?.major}</td>
              <td>{r.Student?.grade}级</td>
              <td>
                {r.Student?.hasInsurance
                  ? <span className="tag success">已准备</span>
                  : <span className="tag danger">未准备</span>}
              </td>
              <td>
                <span className="tag info" style={{ cursor: 'pointer' }}>
                  📄 {r.Resume?.fileName || '查看'}
                </span>
              </td>
              <td>
                <span className={`status-badge status-${r.status}`}>
                  {r.status === 'pending' ? '待审核' : r.status === 'approved' ? '通过' : '未通过'}
                </span>
              </td>
              <td className="text-sm text-muted">
                {r.Teacher ? r.Teacher.User?.name : r.status === 'pending' ? '-' : '未知'}
              </td>
              <td className="text-sm text-muted">{new Date(r.createdAt).toLocaleString()}</td>
              {showActions && r.status === 'pending' && (
                <td>
                  <div className="flex gap-8">
                    <button className="btn btn-sm btn-success" onClick={() => handleReview(r, 'approved')}>通过</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleReview(r, 'rejected')}>驳回</button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    )
  )

  const PendingPage = () => {
    const stats = {
      pending: pending.length,
      approved: 0,
      rejected: 0
    }
    pending.forEach(r => {
      if (r.status === 'approved') stats.approved++
      else if (r.status === 'rejected') stats.rejected++
    })

    return (
      <div className="main-content">
        <h2 className="page-title">⏳ 待审核列表</h2>
        <div className="stat-cards">
          <div className="stat-card warning"><div className="stat-label">待审核</div><div className="stat-value">{stats.pending}</div></div>
        </div>

        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          <b>操作说明：</b>审核通过后学生方可投递岗位；驳回请务必填写具体原因，学生重新上传简历后会发起新的审核。
        </div>

        <ReviewTable reviews={pending} showActions={true} />
      </div>
    )
  }

  const AllPage = () => {
    const approvedCount = all.filter(r => r.status === 'approved').length
    const rejectedCount = all.filter(r => r.status === 'rejected').length
    const pendingCount = all.filter(r => r.status === 'pending').length

    return (
      <div className="main-content">
        <h2 className="page-title">📋 全部资格审核记录</h2>

        <div className="stat-cards">
          <div className="stat-card primary"><div className="stat-label">总记录数</div><div className="stat-value">{all.length}</div></div>
          <div className="stat-card success"><div className="stat-label">通过</div><div className="stat-value">{approvedCount}</div></div>
          <div className="stat-card warning"><div className="stat-label">待审核</div><div className="stat-value">{pendingCount}</div></div>
          <div className="stat-card danger"><div className="stat-label">未通过</div><div className="stat-value">{rejectedCount}</div></div>
        </div>

        <div className="filter-bar">
          {[
            { value: 'all', label: '全部' },
            { value: 'pending', label: '待审核' },
            { value: 'approved', label: '通过' },
            { value: 'rejected', label: '未通过' }
          ].map(opt => (
            <button
              key={opt.value}
              className={`btn btn-sm ${filter === opt.value ? 'btn-primary' : 'btn-default'}`}
              onClick={() => setFilter(opt.value)}
            >{opt.label}</button>
          ))}
        </div>

        <ReviewTable reviews={all} showActions={true} />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<PendingPage />} />
      <Route path="/all" element={<AllPage />} />
    </Routes>
  )
}
