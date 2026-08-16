import { api } from './api.js';

export const transactionService = {
  getAll: async (filters = {}) => {
    const queryParams = new URLSearchParams(filters).toString();
    const response = await api.get(`/transactions${queryParams ? `?${queryParams}` : ''}`);
    // Backend now returns { data, pagination } — handle both old and new format
    if (response.data && response.pagination) {
      return response;
    }
    // Fallback for backward compatibility
    return { data: response, pagination: null };
  },
  create: async (data) => {
    return await api.post('/transactions', data);
  },
  update: async (id, data) => {
    return await api.put(`/transactions/${id}`, data);
  },
  approve: async (id) => {
    return await api.patch(`/transactions/${id}`, { action: 'APPROVE' });
  },
  reject: async (id, rejectionNote) => {
    return await api.patch(`/transactions/${id}`, { action: 'REJECT', rejectionNote });
  },
  delete: async (id, reason) => {
    return await api.delete(`/transactions/${id}`, { reason });
  }
};
