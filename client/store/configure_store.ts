import { configureStore as rtkConfigureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { baseApi } from './api/baseApi';
import chatReducer from '@features/chat/client/store/chatSlice';
import jwtReducer from '@features/lti/client/store/jwtSlice';
import deepLinkReducer from '@features/assessment/client/store/deepLinkSlice';

export interface StoreConfig {
  jwt?: string;
}

export function configureStore({ jwt }: StoreConfig) {
  const store = rtkConfigureStore({
    reducer: {
      chat: chatReducer,
      jwt: jwtReducer,
      deepLink: deepLinkReducer,
      [baseApi.reducerPath]: baseApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: ['jwt/refresh'],
        },
      }).concat(baseApi.middleware),
    preloadedState: jwt
      ? {
          jwt: { token: jwt, expiresAt: null },
        }
      : undefined,
  });

  setupListeners(store.dispatch);

  return store;
}

export type RootState = ReturnType<ReturnType<typeof configureStore>['getState']>;
export type AppDispatch = ReturnType<typeof configureStore>['dispatch'];
