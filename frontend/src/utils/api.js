const API_BASE = '/api';

class ApiClient {
  constructor() {
    // No more token in localStorage — cookies handle auth automatically
  }

  async request(path, options = {}) {
    const headers = {
      ...(options.headers || {}),
    };

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'same-origin', // Send cookies automatically
    });

    if (response.status === 401) {
      // Clear local user data and redirect
      localStorage.removeItem('sp_user');
      if (!window.location.pathname.includes('/login') && 
          !window.location.pathname.includes('/accept-invite') &&
          !window.location.pathname.includes('/reset-password')) {
        window.location.href = '/login';
      }
      throw new Error('Session expired');
    }

    if (response.status === 429) {
      const err = await response.json().catch(() => ({ detail: 'Too many attempts' }));
      throw new Error(err.detail || 'Too many attempts. Please wait.');
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(err.detail || 'Request failed');
    }

    return response.json();
  }

  // Auth
  login(username, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  logout() {
    return this.request('/auth/logout', { method: 'POST' });
  }

  getMe() {
    return this.request('/auth/me');
  }

  // Invite flow
  sendInvite(data) {
    return this.request('/auth/invite', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  validateToken(token, type = 'invite') {
    return this.request(`/auth/validate-token?token=${encodeURIComponent(token)}&type=${type}`);
  }

  acceptInvite(token, password) {
    return this.request('/auth/accept-invite', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  // Password reset
  forgotPassword(email) {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  resetPassword(token, password) {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  // Properties
  getProperties(status) {
    const params = status ? `?status=${status}` : '';
    return this.request(`/properties${params}`);
  }

  getProperty(id) {
    return this.request(`/properties/${id}`);
  }

  createProperty(data) {
    return this.request('/properties', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateProperty(id, data) {
    return this.request(`/properties/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  deleteProperty(id) {
    return this.request(`/properties/${id}`, { method: 'DELETE' });
  }

  archiveProperty(id) {
    return this.request(`/properties/${id}/archive`, { method: 'PUT' });
  }

  unarchiveProperty(id) {
    return this.request(`/properties/${id}/unarchive`, { method: 'PUT' });
  }

  // Photos
  uploadPhotos(propertyId, files) {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    return this.request(`/properties/${propertyId}/photos`, {
      method: 'POST',
      body: formData,
    });
  }

  deletePhoto(photoId) {
    return this.request(`/photos/${photoId}`, { method: 'DELETE' });
  }

  // Activities
  getActivities(propertyId, pendingOnly) {
    const params = new URLSearchParams();
    if (propertyId) params.set('property_id', propertyId);
    if (pendingOnly) params.set('pending_only', 'true');
    return this.request(`/activities?${params}`);
  }

  createActivity(data) {
    return this.request('/activities', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateActivity(id, data) {
    return this.request(`/activities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  deleteActivity(id) {
    return this.request(`/activities/${id}`, { method: 'DELETE' });
  }

  pushActivities(ids) {
    return this.request('/activities/push-batch', {
      method: 'POST',
      body: JSON.stringify(ids),
    });
  }

  importCSV(propertyId, file) {
    const formData = new FormData();
    formData.append('property_id', propertyId);
    formData.append('file', file);
    return this.request('/activities/import-csv', {
      method: 'POST',
      body: formData,
    });
  }

  // Marketing
  getMarketing(propertyId) {
    const params = propertyId ? `?property_id=${propertyId}` : '';
    return this.request(`/marketing${params}`);
  }

  createMarketing(data) {
    return this.request('/marketing', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  pushMarketing(id) {
    return this.request(`/marketing/${id}/push`, { method: 'PUT' });
  }

  // Dashboard
  getDashboard(propertyId) {
    return this.request(`/dashboard/${propertyId}`);
  }

  // Phase management
  updatePhase(propertyId, phase, targetLiveDate) {
    const body = { phase };
    if (targetLiveDate !== undefined) body.target_live_date = targetLiveDate;
    return this.request(`/properties/${propertyId}/phase`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  // Pre-market tasks
  getTasks(propertyId) {
    return this.request(`/properties/${propertyId}/tasks`);
  }

  createTask(propertyId, data) {
    return this.request(`/properties/${propertyId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ ...data, property_id: propertyId }),
    });
  }

  updateTask(taskId, data) {
    return this.request(`/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  deleteTask(taskId) {
    return this.request(`/tasks/${taskId}`, { method: 'DELETE' });
  }

  // Pending milestones
  getMilestones(propertyId) {
    return this.request(`/properties/${propertyId}/milestones`);
  }

  createMilestone(propertyId, data) {
    return this.request(`/properties/${propertyId}/milestones`, {
      method: 'POST',
      body: JSON.stringify({ ...data, property_id: propertyId }),
    });
  }

  updateMilestone(milestoneId, data) {
    return this.request(`/milestones/${milestoneId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  deleteMilestone(milestoneId) {
    return this.request(`/milestones/${milestoneId}`, { method: 'DELETE' });
  }

  // Clients
  getClients() {
    return this.request('/clients');
  }

  grantAccess(userId, propertyId) {
    return this.request('/property-access', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, property_id: propertyId }),
    });
  }
}

export const api = new ApiClient();
export default api;
