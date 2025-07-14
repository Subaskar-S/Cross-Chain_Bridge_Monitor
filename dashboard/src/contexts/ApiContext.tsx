import React, { createContext, useContext, ReactNode } from 'react';
import axios, { AxiosInstance, AxiosResponse } from 'axios';

interface ApiContextType {
  api: AxiosInstance;
  get: <T = any>(url: string, params?: any) => Promise<AxiosResponse<T>>;
  post: <T = any>(url: string, data?: any) => Promise<AxiosResponse<T>>;
  put: <T = any>(url: string, data?: any) => Promise<AxiosResponse<T>>;
  delete: <T = any>(url: string) => Promise<AxiosResponse<T>>;
}

const ApiContext = createContext<ApiContextType | undefined>(undefined);

interface ApiProviderProps {
  children: ReactNode;
}

export const ApiProvider: React.FC<ApiProviderProps> = ({ children }) => {
  // Create axios instance with base configuration
  const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000/api',
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Add API key if available
  if (process.env.REACT_APP_API_KEY) {
    api.defaults.headers.common['x-api-key'] = process.env.REACT_APP_API_KEY;
  }

  // Request interceptor
  api.interceptors.request.use(
    (config) => {
      console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    },
    (error) => {
      console.error('API Request Error:', error);
      return Promise.reject(error);
    }
  );

  // Response interceptor
  api.interceptors.response.use(
    (response) => {
      console.log(`API Response: ${response.status} ${response.config.url}`);
      return response;
    },
    (error) => {
      console.error('API Response Error:', error.response?.data || error.message);
      
      // Handle common error cases
      if (error.response?.status === 401) {
        console.error('Unauthorized access - check API key');
      } else if (error.response?.status === 429) {
        console.error('Rate limit exceeded');
      } else if (error.response?.status >= 500) {
        console.error('Server error');
      }
      
      return Promise.reject(error);
    }
  );

  // Convenience methods
  const get = <T = any>(url: string, params?: any): Promise<AxiosResponse<T>> => {
    return api.get(url, { params });
  };

  const post = <T = any>(url: string, data?: any): Promise<AxiosResponse<T>> => {
    return api.post(url, data);
  };

  const put = <T = any>(url: string, data?: any): Promise<AxiosResponse<T>> => {
    return api.put(url, data);
  };

  const deleteRequest = <T = any>(url: string): Promise<AxiosResponse<T>> => {
    return api.delete(url);
  };

  const value: ApiContextType = {
    api,
    get,
    post,
    put,
    delete: deleteRequest
  };

  return (
    <ApiContext.Provider value={value}>
      {children}
    </ApiContext.Provider>
  );
};

export const useApi = (): ApiContextType => {
  const context = useContext(ApiContext);
  if (context === undefined) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  return context;
};
