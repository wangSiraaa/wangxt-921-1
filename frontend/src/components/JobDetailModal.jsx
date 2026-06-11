import React from 'react'

export default function JobDetailModal({ job, onClose }) {
  if (!job) return null
  const deadline = new Date(job.deadline)
  const isExpired = deadline < new Date()
  const progress = ((job.quota - job.remainingQuota) / job.quota * 100).toFixed(0)

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📋 岗位详情</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="flex-between" style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 22 }}>{job.title}</h2>
            <span className={`status-badge status-${job.status}`}>
              {job.status === 'open' ? '招聘中' : job.status === 'filled' ? '已招满' : '已关闭'}
            </span>
          </div>
          <div style={{ fontSize: 15, color: '#667eea', marginBottom: 20, fontWeight: 500 }}>
            🏢 {job.Company?.companyName}
          </div>

          <div className="job-tags" style={{ marginBottom: 20 }}>
            <span className="tag">📚 专业: {job.requiredMajor}</span>
            <span className="tag warning">🎓 {job.requiredGrade}级</span>
            {job.requireInsurance && <span className="tag danger">⚠ 需实习保险</span>}
            {job.salary && <span className="tag success">💰 {job.salary}</span>}
            {job.location && <span className="tag info">📍 {job.location}</span>}
          </div>

          <div className="detail-row">
            <div className="label">招录名额</div>
            <div>
              <div className="flex-between" style={{ marginBottom: 6 }}>
                <span>剩余 <b style={{ color: '#67c23a' }}>{job.remainingQuota}</b> / 共 <b>{job.quota}</b> 人</span>
                <span className="text-muted">已招 {progress}%</span>
              </div>
              <div className="quota-bar">
                <div className="quota-bar-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>

          <div className="detail-row">
            <div className="label">截止日期</div>
            <div>
              <span style={{ color: isExpired ? '#f56c6c' : '#606266' }}>
                {deadline.toLocaleString()}
              </span>
              {isExpired && <span className="tag danger" style={{ marginLeft: 8 }}>已截止</span>}
            </div>
          </div>

          <div className="detail-row">
            <div className="label">联系方式</div>
            <div className="text-sm">
              {job.Company?.User?.email && <div>📧 {job.Company.User.email}</div>}
              {job.Company?.User?.phone && <div>📞 {job.Company.User.phone}</div>}
            </div>
          </div>

          <div className="detail-row">
            <div className="label">公司介绍</div>
            <div className="text-sm text-muted">{job.Company?.description || '暂无介绍'}</div>
          </div>

          <div className="detail-row">
            <div className="label">岗位描述</div>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{job.description}</div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-default" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  )
}
