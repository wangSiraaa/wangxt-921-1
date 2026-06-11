import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import CompanyDashboard from './pages/CompanyDashboard.jsx'
import StudentDashboard from './pages/StudentDashboard.jsx'
import TeacherDashboard from './pages/TeacherDashboard.jsx'
import Navbar from './components/Navbar.jsx'

function App() {
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const saved = localStorage.getItem('user')
    if (saved) {
      try {
        setUser(JSON.parse(saved))
      } catch (e) {
        localStorage.removeItem('user')
        localStorage.removeItem('token')
      }
    }
  }, [])

  const handleAuthSuccess = (data) => {
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    setUser(data.user)
    navigate(getDashboardRoute(data.user.role))
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    navigate('/login')
  }

  const getDashboardRoute = (role) => {
    switch (role) {
      case 'company': return '/company'
      case 'student': return '/student'
      case 'teacher': return '/teacher'
      default: return '/login'
    }
  }

  const ProtectedRoute = ({ role, children }) => {
    if (!user) return <Navigate to="/login" replace />
    if (role && user.role !== role) return <Navigate to={getDashboardRoute(user.role)} replace />
    return children
  }

  return (
    <div className="app-container">
      {user && <Navbar user={user} onLogout={handleLogout} />}
      <Routes>
        <Route path="/login" element={
          user ? <Navigate to={getDashboardRoute(user.role)} replace />
            : <Login onSuccess={handleAuthSuccess} />
        } />
        <Route path="/register" element={
          user ? <Navigate to={getDashboardRoute(user.role)} replace />
            : <Register onSuccess={handleAuthSuccess} />
        } />
        <Route path="/company/*" element={
          <ProtectedRoute role="company">
            <CompanyDashboard user={user} />
          </ProtectedRoute>
        } />
        <Route path="/student/*" element={
          <ProtectedRoute role="student">
            <StudentDashboard user={user} />
          </ProtectedRoute>
        } />
        <Route path="/teacher/*" element={
          <ProtectedRoute role="teacher">
            <TeacherDashboard user={user} />
          </ProtectedRoute>
        } />
        <Route path="/" element={
          <Navigate to={user ? getDashboardRoute(user.role) : '/login'} replace />
        } />
        <Route path="*" element={<Navigate to={user ? getDashboardRoute(user.role) : '/login'} replace />} />
      </Routes>
    </div>
  )
}

export default App
