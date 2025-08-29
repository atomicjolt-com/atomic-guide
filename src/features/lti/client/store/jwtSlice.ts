import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface JwtState {
  token: string | null;
  expiresAt: number | null;
}

const initialState: JwtState = {
  token: null,
  expiresAt: null,
};

const jwtSlice = createSlice({
  name: 'jwt',
  initialState,
  reducers: {
    setJwt: (state, action: PayloadAction<{ token: string; expiresAt?: number }>) => {
      state.token = action.payload.token;
      state.expiresAt = action.payload.expiresAt || null;
    },
    clearJwt: (state) => {
      state.token = null;
      state.expiresAt = null;
    },
    refreshJwt: (state, action: PayloadAction<string>) => {
      state.token = action.payload;
    },
  },
});

export const { setJwt, clearJwt, refreshJwt } = jwtSlice.actions;
export default jwtSlice.reducer;