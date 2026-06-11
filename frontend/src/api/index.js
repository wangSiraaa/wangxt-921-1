import axios from 'axios'

const API_BASE = '/api'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me')
}

export const jobAPI = {
  create: (data) => api.post('/jobs', data),
  list: (params) => api.get('/jobs', { params }),
  get: (id) => api.get(`/jobs/${id}`),
  update: (id, data) => api.put(`/jobs/${id}`, data),
  remove: (id) => api.delete(`/jobs/${id}`),
  applications: (id) => api.get(`/jobs/${id}/applications`)
}

export const resumeAPI = {
  upload: (formData) => api.post('/resumes/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  my: () => api.get('/resumes/my'),
  get: (id) => api.get(`/resumes/${id}`)
}

export const reviewAPI = {
  list: (params) => api.get('/reviews', { params }),
  review: (id, data) => api.post(`/reviews/${id}/review`, data),
  myStatus: () => api.get('/reviews/my-status')
}

export const applicationAPI = {
  apply: (data) => api.post('/applications', data),
  my: () => api.get('/applications/my'),
  get: (id) => api.get(`/applications/${id}`),
  accept: (id) => api.post(`/applications/${id}/accept`),
  reject: (id, data) => api.post(`/applications/${id}/reject`, data),
  confirm: (id) => api.post(`/applications/${id}/confirm`),
  hiringRecords: () => api.get('/applications/hiring-records')
}

export default api
