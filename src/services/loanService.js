import { api } from './api.js';

export const loanService = {
  getAll: async (filters = {}) => {
    const queryParams = new URLSearchParams(filters).toString();
    return await api.get(`/loans${queryParams ? `?${queryParams}` : ''}`);
  },
  getById: async (id) => {
    return await api.get(`/loans/${id}`);
  },
  create: async (data) => {
    return await api.post('/loans', data);
  },
  update: async (id, data) => {
    return await api.put(`/loans/${id}`, data);
  },
  recordPayment: async (id, paymentData) => {
    return await api.post(`/loans/${id}/pay`, paymentData);
  },
  close: async (id) => {
    return await api.delete(`/loans/${id}`);
  },
  resetAllEntries: async () => {
    return await api.delete('/loans');
  },
};
