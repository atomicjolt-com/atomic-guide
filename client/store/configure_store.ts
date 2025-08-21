import { configureStore as rtkConfigureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { baseApi } from './api/baseApi';
import chatReducer from './slices/chatSlice';
import jwtReducer from './slices/jwtSlice';

export interface StoreConfig {
  jwt?: string;
  settings?: Record<string, any>;
}

export function configureStore({ jwt }: StoreConfig) {
  const store = rtkConfigureStore({
    reducer: {
      chat: chatReducer,
      jwt: jwtReducer,
      [baseApi.reducerPath]: baseApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: ['jwt/refresh'],
        },
      }).concat(baseApi.middleware),
    preloadedState: jwt ? {
      jwt: { token: jwt, expiresAt: null },
    } : undefined,
  });

  setupListeners(store.dispatch);

  return store;
}

export type RootState = ReturnType<ReturnType<typeof configureStore>['getState']>;
export type AppDispatch = ReturnType<typeof configureStore>['dispatch'];