import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { authAPI } from '../api'

export default function Login({ onSuccess }) {
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await authAPI.login(form)
      onSuccess(res.data)
    } catch (err) {
      setError(err.response?.data?.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h2>🎯 校园实习岗位匹配系统</h2>
        <div className="auth-tabs">
          <button className="active">登录</button>
          <Link to="/register" style={{
            flex: 1, padding: '12px', background: 'none', border: 'none',
            cursor: 'pointer', fontSize: '15px', color: '#909399', textAlign: 'center',
            textDecoration: 'none', borderBottom: '2px solid transparent', marginBottom: '-2px'
          }}>注册</Link>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>用户名</label>
            <input
              type="text"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              required
              placeholder="请输入用户名"
            />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
              placeholder="请输入密码"
            />
          </div>
          <button type="submit" className="btn btn-primary w-100" disabled={loading} style={{ width: '100%' }}>
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#909399' }}>
          还没有账号？<Link to="/register" style={{ color: '#667eea' }}>立即注册</Link>
        </div>
      </div>
    </div>
  )
}
