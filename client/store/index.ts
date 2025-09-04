export { configureStore } from './configure_store';
export type { RootState, AppDispatch } from './configure_store';

export {
  toggleChat,
  openChat,
  closeChat,
  minimizeChat,
  maximizeChat,
  addMessage,
  setConversationId,
  setLoading,
  setError,
  clearMessages,
} from '../../src/features/chat/client/store/chatSlice';

export { setJwt, clearJwt, refreshJwt } from '../../src/features/lti/client/store/jwtSlice';

import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from './configure_store';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
