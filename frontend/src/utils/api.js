const API_BASE = '/api';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('sp_token');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('sp_token', token);
    } else {
      localStorage.removeItem('sp_token');
    }
  }

  async request(path, options = {}) {
    const headers = {
      ...(options.headers || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      this.setToken(null);
      localStorage.removeItem('sp_user');
      window.location.href = '/login';
      throw new Error('Session expired');
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

  signup(data) {
    return this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getMe() {
    return this.request('/auth/me');
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
