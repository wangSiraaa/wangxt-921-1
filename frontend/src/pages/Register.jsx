import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { authAPI } from '../api'

const roleOptions = [
  { value: 'company', icon: '🏢', label: '企业用户' },
  { value: 'student', icon: '🎓', label: '学生用户' },
  { value: 'teacher', icon: '👨‍🏫', label: '学院老师' }
]

export default function Register({ onSuccess }) {
  const [role, setRole] = useState('student')
  const [form, setForm] = useState({
    username: '', password: '', name: '', email: '', phone: '',
    extra: {
      studentNo: '', major: '', grade: 2022, college: '', hasInsurance: false,
      companyName: '', industry: '', address: '', description: '',
      teacherNo: '', department: '', title: ''
    }
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const submitData = { ...form }
      if (role === 'company') {
        submitData.extra = {
          companyName: form.extra.companyName,
          industry: form.extra.industry,
          address: form.extra.address,
          description: form.extra.description
        }
      } else if (role === 'student') {
        submitData.extra = {
          studentNo: form.extra.studentNo,
          major: form.extra.major,
          grade: parseInt(form.extra.grade),
          college: form.extra.college,
          hasInsurance: !!form.extra.hasInsurance
        }
      } else if (role === 'teacher') {
        submitData.extra = {
          teacherNo: form.extra.teacherNo,
          department: form.extra.department,
          title: form.extra.title
        }
      }
      submitData.role = role
      const res = await authAPI.register(submitData)
      onSuccess(res.data)
    } catch (err) {
      setError(err.response?.data?.message || '注册失败')
    } finally {
      setLoading(false)
    }
  }

  const updateExtra = (key, val) => {
    setForm({ ...form, extra: { ...form.extra, [key]: val } })
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card" style={{ maxWidth: 560 }}>
        <h2>🎯 注册新账号</h2>
        <div className="auth-tabs">
          <Link to="/login" style={{
            flex: 1, padding: '12px', background: 'none', border: 'none',
            cursor: 'pointer', fontSize: '15px', color: '#909399', textAlign: 'center',
            textDecoration: 'none', borderBottom: '2px solid transparent', marginBottom: '-2px'
          }}>登录</Link>
          <button className="active">注册</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="role-selector">
          {roleOptions.map(opt => (
            <div
              key={opt.value}
              className={`role-option ${role === opt.value ? 'selected' : ''}`}
              onClick={() => setRole(opt.value)}
            >
              <div className="icon">{opt.icon}</div>
              <div className="label">{opt.label}</div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>用户名 *</label>
              <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>密码 *</label>
              <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>姓名 *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>邮箱</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>电话</label>
            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>

          {role === 'company' && (
            <>
              <div className="form-group">
                <label>公司名称 *</label>
                <input value={form.extra.companyName} onChange={e => updateExtra('companyName', e.target.value)} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>行业</label>
                  <input value={form.extra.industry} onChange={e => updateExtra('industry', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>地址</label>
                  <input value={form.extra.address} onChange={e => updateExtra('address', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>公司介绍</label>
                <textarea rows={3} value={form.extra.description} onChange={e => updateExtra('description', e.target.value)} />
              </div>
            </>
          )}

          {role === 'student' && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>学号 *</label>
                  <input value={form.extra.studentNo} onChange={e => updateExtra('studentNo', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>年级 *</label>
                  <select value={form.extra.grade} onChange={e => updateExtra('grade', e.target.value)} required>
                    {[2020, 2021, 2022, 2023, 2024, 2025].map(y => (
                      <option key={y} value={y}>{y}级</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>专业 *</label>
                  <input value={form.extra.major} onChange={e => updateExtra('major', e.target.value)} required placeholder="如：计算机科学与技术" />
                </div>
                <div className="form-group">
                  <label>学院 *</label>
                  <input value={form.extra.college} onChange={e => updateExtra('college', e.target.value)} required />
                </div>
              </div>
              <div className="checkbox-row">
                <input type="checkbox" id="hasInsurance" checked={!!form.extra.hasInsurance}
                  onChange={e => updateExtra('hasInsurance', e.target.checked)} />
                <label htmlFor="hasInsurance" style={{ cursor: 'pointer' }}>已准备实习保险材料</label>
              </div>
            </>
          )}

          {role === 'teacher' && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>工号 *</label>
                  <input value={form.extra.teacherNo} onChange={e => updateExtra('teacherNo', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>职称</label>
                  <input value={form.extra.title} onChange={e => updateExtra('title', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>所属院系 *</label>
                <input value={form.extra.department} onChange={e => updateExtra('department', e.target.value)} required />
              </div>
            </>
          )}

          <button type="submit" className="btn btn-primary w-100" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
            {loading ? '注册中...' : '注册账号'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#909399' }}>
          已有账号？<Link to="/login" style={{ color: '#667eea' }}>返回登录</Link>
        </div>
      </div>
    </div>
  )
}
