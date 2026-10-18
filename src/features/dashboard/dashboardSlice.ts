import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import {
  loadDashboardAnalytics,
  loadExerciseProgress,
  type AnalyticsPeriod,
  type DashboardAnalytics,
  type ExerciseProgress,
} from './analyticsService'

type LoadStatus = 'idle' | 'loading' | 'failed'

export interface DashboardState {
  period: AnalyticsPeriod
  analytics: DashboardAnalytics | null
  status: LoadStatus
  error: string | null
  exerciseId: string
  exerciseProgress: ExerciseProgress | null
  exerciseStatus: LoadStatus
  exerciseError: string | null
  analyticsRequestId: string | null
  exerciseRequestId: string | null
}

const initialState: DashboardState = {
  period: 30,
  analytics: null,
  status: 'idle',
  error: null,
  exerciseId: '',
  exerciseProgress: null,
  exerciseStatus: 'idle',
  exerciseError: null,
  analyticsRequestId: null,
  exerciseRequestId: null,
}

function getErrorMessage(message: string | undefined, fallback: string): string {
  return message ?? fallback
}

export const loadDashboardThunk = createAsyncThunk(
  'dashboard/load',
  async (period: AnalyticsPeriod) => loadDashboardAnalytics(period),
)

export const loadExerciseProgressThunk = createAsyncThunk(
  'dashboard/loadExerciseProgress',
  async (exerciseId: string) => loadExerciseProgress(exerciseId),
)

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    setDashboardPeriod(state, action: PayloadAction<AnalyticsPeriod>) {
      state.period = action.payload
      state.analytics = null
      state.status = 'idle'
      state.error = null
      state.analyticsRequestId = null
    },
    setDashboardExercise(state, action: PayloadAction<string>) {
      state.exerciseId = action.payload
      state.exerciseProgress = null
      state.exerciseStatus = 'idle'
      state.exerciseError = null
      state.exerciseRequestId = null
    },
  },
  extraReducers(builder) {
    builder
      .addCase(loadDashboardThunk.pending, (state, action) => {
        state.analyticsRequestId = action.meta.requestId
        state.status = 'loading'
        state.error = null
      })
      .addCase(loadDashboardThunk.fulfilled, (state, action) => {
        if (state.analyticsRequestId !== action.meta.requestId) return
        state.analytics = action.payload
        state.status = 'idle'
        state.analyticsRequestId = null
      })
      .addCase(loadDashboardThunk.rejected, (state, action) => {
        if (state.analyticsRequestId !== action.meta.requestId) return
        state.status = 'failed'
        state.error = getErrorMessage(
          action.error.message,
          'Could not load dashboard analytics.',
        )
        state.analyticsRequestId = null
      })
      .addCase(loadExerciseProgressThunk.pending, (state, action) => {
        state.exerciseRequestId = action.meta.requestId
        state.exerciseStatus = 'loading'
        state.exerciseError = null
      })
      .addCase(loadExerciseProgressThunk.fulfilled, (state, action) => {
        if (state.exerciseRequestId !== action.meta.requestId) return
        state.exerciseProgress = action.payload
        state.exerciseStatus = 'idle'
        state.exerciseRequestId = null
      })
      .addCase(loadExerciseProgressThunk.rejected, (state, action) => {
        if (state.exerciseRequestId !== action.meta.requestId) return
        state.exerciseStatus = 'failed'
        state.exerciseError = getErrorMessage(
          action.error.message,
          'Could not load exercise history.',
        )
        state.exerciseRequestId = null
      })
  },
})

export const { setDashboardExercise, setDashboardPeriod } =
  dashboardSlice.actions
export default dashboardSlice.reducer
