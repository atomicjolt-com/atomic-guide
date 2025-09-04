/**
 * @fileoverview Barrel export for shared client store utilities
 * @module shared/client/store
 */

export { useAppDispatch, useAppSelector } from './hooks';
export type { RootState, AppDispatch } from '../../../../client/store/configure_store';
