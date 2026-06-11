import React from 'react'
import { Link, useLocation } from 'react-router-dom'

const roleLabels = {
  company: '企业端',
  student: '学生端',
  teacher: '学院老师'
}

const roleIcons = {
  company: '🏢',
  student: '🎓',
  teacher: '👨‍🏫'
}

export default function Navbar({ user, onLogout }) {
  const location = useLocation()

  const navLinks = () => {
    const links = []
    if (user.role === 'company') {
      links.push({ to: '/company', label: '岗位管理', match: /^\/company\/?$/ })
      links.push({ to: '/company/create', label: '发布岗位', match: /^\/company\/create/ })
      links.push({ to: '/company/records', label: '录用记录', match: /^\/company\/records/ })
    } else if (user.role === 'student') {
      links.push({ to: '/student', label: '岗位大厅', match: /^\/student\/?$/ })
      links.push({ to: '/student/resume', label: '我的简历', match: /^\/student\/resume/ })
      links.push({ to: '/student/applications', label: '我的投递', match: /^\/student\/applications/ })
    } else if (user.role === 'teacher') {
      links.push({ to: '/teacher', label: '待审核', match: /^\/teacher\/?$/ })
      links.push({ to: '/teacher/all', label: '全部记录', match: /^\/teacher\/all/ })
    }
    return links
  }

  return (
    <nav className="navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <h1>🎯 校园实习匹配系统</h1>
        <span className="role-badge">{roleIcons[user.role]} {roleLabels[user.role]}</span>
      </div>
      <div className="nav-links">
        {navLinks().map(link => (
          <Link
            key={link.to}
            to={link.to}
            style={{
              background: link.match.test(location.pathname) ? 'rgba(255,255,255,0.25)' : 'transparent',
              fontWeight: link.match.test(location.pathname) ? 600 : 400
            }}
          >
            {link.label}
          </Link>
        ))}
        <div className="user-info">
          <span>👤 {user.name}</span>
          <button onClick={onLogout}>退出</button>
        </div>
      </div>
    </nav>
  )
}
