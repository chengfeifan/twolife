export const api = {
  getToken: () => localStorage.getItem('token'),
  
  async request(endpoint: string, options: RequestInit = {}) {
    const token = this.getToken();
    const isFormData = options.body instanceof FormData;
    
    let headers: any = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    if (!isFormData) {
       headers['Content-Type'] = 'application/json';
    } else {
       // Let browser set the correct content-type with boundary
       if (headers['Content-Type']) {
           delete headers['Content-Type'];
       }
    }

    
    // Auto prefix /api
    const url = endpoint.startsWith('http') ? endpoint : `/api${endpoint}`;

    const response = await fetch(url, { ...options, headers });
    
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'API Request Failed');
    }
    
    return response.json();
  }
};
