// ==========================================
// FILE: api.js
// PURPOSE: Centralized Axios instance configuration for API communication.
// Ensures consistent routing, request authentication, and global error handling.
// ==========================================

import axios from "axios";

// ==========================================
// AXIOS INSTANCE INITIALIZATION
// ==========================================
  
// We prioritize Vite's environment variable for the base URL, but hardcode 
// the live Render server as a fallback. Notice the "/api" at the very end 
// of the URL. This is required to hit the correct backend routes.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://personal-finance-tracker-api-57xw.onrender.com/api",
});

// ==========================================
// GLOBAL INTERCEPTORS
// ==========================================

// Intercept outgoing requests to automatically append the JWT authorization header.
// This centralizes token management so individual component requests do not 
// need to manually retrieve and attach credentials.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercept incoming responses to globally handle unauthorized states (401).
// If the backend rejects a token as expired or invalid, we immediately purge 
// local storage and redirect to the login view to prevent the user from 
// remaining in a broken, pseudo-authenticated state.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export default api;