import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import {
  finishWorkoutThunk,
  loadActiveWorkoutThunk,
  startWorkoutThunk,
} from './workoutThunks'

export type WorkoutOperationStatus = 'idle' | 'loading' | 'saving' | 'failed'

export interface WorkoutUiState {
  activeWorkoutId: string | null
  selectedExerciseId: string | null
  status: WorkoutOperationStatus
  error: string | null
}

const initialState: WorkoutUiState = {
  activeWorkoutId: null,
  selectedExerciseId: null,
  status: 'idle',
  error: null,
}

const workoutUiSlice = createSlice({
  name: 'workoutUi',
  initialState,
  reducers: {
    setSelectedExerciseId(state, action: PayloadAction<string | null>) {
      state.selectedExerciseId = action.payload
    },
    clearWorkoutError(state) {
      state.error = null
      if (state.status === 'failed') state.status = 'idle'
    },
    setWorkoutError(state, action: PayloadAction<string>) {
      state.error = action.payload
      state.status = 'failed'
    },
  },
  extraReducers(builder) {
    builder
      .addCase(loadActiveWorkoutThunk.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(loadActiveWorkoutThunk.fulfilled, (state, action) => {
        state.activeWorkoutId = action.payload
        state.status = 'idle'
      })
      .addCase(loadActiveWorkoutThunk.rejected, (state, action) => {
        state.status = 'failed'
        state.error =
          action.payload ?? action.error.message ?? 'Could not restore workout.'
      })
      .addCase(startWorkoutThunk.pending, (state) => {
        state.status = 'saving'
        state.error = null
      })
      .addCase(startWorkoutThunk.fulfilled, (state, action) => {
        state.activeWorkoutId = action.payload
        state.status = 'idle'
      })
      .addCase(startWorkoutThunk.rejected, (state, action) => {
        state.status = 'failed'
        state.error =
          action.payload ?? action.error.message ?? 'Could not start workout.'
      })
      .addCase(finishWorkoutThunk.pending, (state) => {
        state.status = 'saving'
        state.error = null
      })
      .addCase(finishWorkoutThunk.fulfilled, (state) => {
        state.activeWorkoutId = null
        state.status = 'idle'
      })
      .addCase(finishWorkoutThunk.rejected, (state, action) => {
        state.status = 'failed'
        state.error =
          action.payload ?? action.error.message ?? 'Could not finish workout.'
      })
  },
})

export const {
  clearWorkoutError,
  setSelectedExerciseId,
  setWorkoutError,
} = workoutUiSlice.actions
export default workoutUiSlice.reducer
