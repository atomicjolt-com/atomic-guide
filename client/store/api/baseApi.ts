import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '../configure_store';

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    prepareHeaders: (headers, { getState }) => {
      // First try to get LTI JWT from Redux store
      let token = (getState() as RootState).jwt?.token;
      
      // If no LTI token, try to get auth token from Zustand store (persisted in localStorage)
      if (!token) {
        try {
          const authStorage = localStorage.getItem('auth-storage');
          if (authStorage) {
            const authState = JSON.parse(authStorage);
            token = authState.state?.token;
          }
        } catch (error) {
          console.error('Failed to get auth token from localStorage:', error);
        }
      }
      
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Chat', 'Learner', 'Session'],
  endpoints: () => ({}),
});
