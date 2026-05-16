// src/api/axiosInstance.ts
import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';

const BASE_URL = 'http://localhost:5000';
const TOKEN_KEY = 'hms_token';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('hms_user');
      if (window.location.pathname !== '/' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// ==================== AUTH API ====================
export const authApi = {
  login: (email: string, password: string) => api.post('/api/auth/login', { email, password }),
  register: (data: any) => api.post('/api/auth/register', data),
  getUsers: () => api.get('/api/auth/users'),
  changePassword: (data: any) => api.post('/api/auth/change-password', data),
  googleLogin: (tokenId: string) => api.post('/api/auth/google-login', { tokenId }),
  forgotPassword: (email: string) => api.post('/api/auth/forgot-password', { email }),
  resetPassword: (data: any) => api.post('/api/auth/reset-password', data),
  deleteUser: (id: number) => api.delete(`/api/auth/users/${id}`),
  restoreUser: (id: number) => api.post(`/api/auth/users/${id}/restore`),
  updateProfile: (data: any) => api.patch('/api/auth/profile', data),
  uploadPicture: (file: File, updateProfile: boolean = false) => {
    const formData = new FormData();
    formData.append('File', file);
    formData.append('UpdateProfile', updateProfile.toString());
    return api.post('/api/auth/upload-picture', formData);
  },
};

// ==================== DEPARTMENT API ====================
export const departmentApi = {
  getAll: () => api.get('/api/departments'),
};

// ==================== DOCTOR API ====================
export const doctorApi = {
  getAll: () => api.get('/api/doctors'),
  getByDepartment: (departmentId: number) => api.get(`/api/doctors/department/${departmentId}`),
  getById: (id: number) => api.get(`/api/doctors/${id}`),
  getMe: () => api.get('/api/doctors/me'),
  getSchedules: (doctorId: number) => api.get(`/api/doctors/${doctorId}/schedules`),
  addSchedule: (doctorId: number, data: any) => api.post(`/api/doctors/${doctorId}/schedules`, data),
  updateSchedule: (scheduleId: number, data: any) => api.put(`/api/doctors/schedules/${scheduleId}`, data),
  deleteSchedule: (scheduleId: number) => api.delete(`/api/doctors/schedules/${scheduleId}`),
  getAvailableSlots: (doctorId: number, date: string) => api.get(`/api/appointments/slots/${doctorId}?date=${date}`),
  updateProfilePicture: (imageUrl: string) => api.patch('/api/doctors/profile-picture', { imageUrl }),
  updateSlotDuration: (duration: number) => api.patch('/api/doctors/slot-duration', { duration }),
};

// ==================== APPOINTMENT API ====================
export const appointmentApi = {
  getMy: () => api.get('/api/appointments/my'),
  getAll: () => api.get('/api/appointments'),
  getByDoctor: (doctorId: number) => api.get(`/api/appointments/doctor/${doctorId}`),
  getByMyDoctor: () => api.get('/api/appointments/doctor/me'),
  getByPatient: (patientId: number) => api.get(`/api/appointments/patient/${patientId}`),
  book: (data: any) => api.post('/api/appointments', data),
  update: (id: number, data: any) => api.put(`/api/appointments/${id}`, data),
  cancel: (id: number) => api.delete(`/api/appointments/${id}/cancel`),
};

// ==================== BED API ====================
export const bedApi = {
  getAll: () => api.get('/api/Beds'),
  getAvailable: () => api.get('/api/Beds/available'),
  updateStatus: (id: number, status: string) => api.patch(`/api/Beds/${id}/status`, { status }),
};

// ==================== ADMISSION API ====================
export const admissionApi = {
  getAll: () => api.get('/api/admissions'),
  getByPatient: (patientId: number) => api.get(`/api/admissions/patient/${patientId}`),
  admit: (data: any) => api.post('/api/admissions', data),
  discharge: (id: number, data: any) => api.put(`/api/admissions/${id}/discharge`, data),
};

// ==================== VITALS API ====================
export const vitalsApi = {
  getByPatient: (patientId: number) => api.get(`/api/vitals/patient/${patientId}`),
  getByAdmission: (admissionId: number) => api.get(`/api/vitals/admission/${admissionId}`),
  create: (data: any) => api.post('/api/vitals', data),
};

// ==================== MEDICINE API ====================
export const medicineApi = {
  getAll: () => api.get('/api/medicines'),
  getLowStock: () => api.get('/api/medicines/low-stock'),
  add: (data: any) => api.post('/api/medicines', data),
  updateStock: (id: number, quantity: number) => api.patch(`/api/medicines/${id}/stock`, { NewQuantity: quantity }),
};

// ==================== PRESCRIPTION API ====================
export const prescriptionApi = {
  getAll: () => api.get('/api/prescriptions/pending'),
  getDoctorPrescriptions: () => api.get('/api/prescriptions/doctor'),
  getPending: () => api.get('/api/prescriptions/pending'),
  getByPatient: (patientId: number) => api.get(`/api/prescriptions/patient/${patientId}`),
  create: (data: any) => api.post('/api/prescriptions', data),
  update: (id: number, data: any) => api.put(`/api/prescriptions/${id}`, data),
  dispense: (id: number) => api.patch(`/api/prescriptions/${id}/dispense`),
};

// ==================== BILL API ====================
export const billApi = {
  create: (data: any) => api.post('/api/bills', data),
  pay: (id: number, data: any) => api.post(`/api/bills/${id}/payment`, data),
  getByPatient: (patientId: number) => api.get(`/api/bills/patient/${patientId}`),
  getPending: () => api.get('/api/bills/pending'),
};

// ==================== LAB API ====================
export const labApi = {
  getAll: () => api.get('/api/lab/orders'),
  getPending: () => api.get('/api/lab/pending'),
  createOrder: (data: any) => api.post('/api/lab/orders', data),
  uploadResult: (id: number, data: any) => api.post(`/api/lab/orders/${id}/result`, data),
};

// ==================== NOTIFICATION API ====================
export const notificationApi = {
  getMy: () => api.get('/api/notifications'),
  getUnreadCount: () => api.get('/api/notifications/unread-count'),
  markAsRead: (id: number) => api.patch(`/api/notifications/${id}/read`),
  markAllAsRead: () => api.patch('/api/notifications/read-all'),
};

// ==================== ADMIN API ====================
export const adminApi = {
  getStats: () => api.get('/api/admin/stats'),
};

// ==================== CHAT API ====================
export const chatApi = {
  getHistory: (patientId?: string) => api.get('/api/chat/history', { params: { patientId } }),
  markAsRead: (patientId: string) => api.patch(`/api/chat/read/${patientId}`),
};



