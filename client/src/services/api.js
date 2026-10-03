import axios from 'axios';

/**
 * Single axios instance for the whole app.
 * The base URL comes from the environment (Vite proxy in development) so no
 * component ever hard-codes an API host.
 */
const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

export class ApiError extends Error {
  constructor(message, code = 'API_ERROR', status = 0, details = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const http = axios.create({
  baseURL,
  timeout: 180000,
  headers: { Accept: 'application/json' }
});

/* ------------------------------------------------------------------ */
/* Session token                                                       */
/* The AuthContext owns the token and pushes it here; the request       */
/* interceptor then attaches it to every call. A 401 response can also  */
/* notify the app so it can return the user to the sign-in screen.      */
/* ------------------------------------------------------------------ */

let authToken = '';
let onUnauthorized = null;

export function setAuthToken(token) {
  authToken = token || '';
}

/** Register a callback invoked when the API rejects the session (401). */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = typeof handler === 'function' ? handler : null;
}

http.interceptors.request.use((config) => {
  if (authToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

/** Turn an axios failure into a friendly, typed ApiError. */
function toApiError(error) {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      const payload = error.response.data || {};
      const info = payload.error || {};
      return new ApiError(
        info.message || 'Something went wrong while talking to the LoanLens API.',
        info.code || 'API_ERROR',
        error.response.status,
        payload.data || null
      );
    }
    if (error.code === 'ECONNABORTED') {
      return new ApiError(
        'The request took too long to complete. The document may be large - please try again.',
        'TIMEOUT',
        0
      );
    }
    return new ApiError(
      'We could not reach the LoanLens server. Please check that the API is running and try again.',
      'NETWORK_ERROR',
      0
    );
  }
  return new ApiError(error.message || 'Unexpected error.', 'UNKNOWN', 0);
}

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiError = toApiError(error);
    if (apiError.status === 401 && onUnauthorized) onUnauthorized(apiError);
    return Promise.reject(apiError);
  }
);

/** Unwrap the API envelope: { success, data } -> data */
async function unwrap(request) {
  const { data } = await request;
  return data && Object.prototype.hasOwnProperty.call(data, 'data') ? data.data : data;
}

/* ------------------------------------------------------------------ */
/* Authentication                                                      */
/* ------------------------------------------------------------------ */

export const register = (payload) => unwrap(http.post('/auth/register', payload));
export const login = (payload) => unwrap(http.post('/auth/login', payload));
export const getCurrentUser = () => unwrap(http.get('/auth/me'));

/* ------------------------------------------------------------------ */
/* Health + meta                                                       */
/* ------------------------------------------------------------------ */

export const getHealth = () => unwrap(http.get('/health'));
export const getDashboardMeta = () => unwrap(http.get('/dashboard/meta'));

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export const getDashboardStats = () => unwrap(http.get('/dashboard/stats'));

/* ------------------------------------------------------------------ */
/* Agreements                                                          */
/* ------------------------------------------------------------------ */

export const getAgreements = (params = {}) => unwrap(http.get('/agreements', { params }));

export const getAgreement = (id) => unwrap(http.get(`/agreements/${encodeURIComponent(id)}`));

export const getAgreementReport = (id) =>
  unwrap(http.get(`/agreements/${encodeURIComponent(id)}/report`));

export const deleteAgreement = (id) =>
  unwrap(http.delete(`/agreements/${encodeURIComponent(id)}`));

/**
 * Upload a PDF. `onProgress` receives a 0-100 integer.
 */
export const uploadAgreement = (file, onProgress) => {
  const form = new FormData();
  form.append('file', file, file.name);

  return unwrap(
    http.post('/agreements/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (!onProgress || !event.total) return;
        onProgress(Math.round((event.loaded * 100) / event.total));
      }
    })
  );
};

/** Start the analysis pipeline for an uploaded agreement. */
export const analyzeAgreement = (id) =>
  unwrap(http.post(`/agreements/${encodeURIComponent(id)}/analyze`));

export default http;
