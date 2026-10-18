import { configureStore } from '@reduxjs/toolkit'
import workoutUiReducer from '../features/workouts/workoutUiSlice'
import nutritionUiReducer from '../features/nutrition/nutritionSlice'
import dashboardReducer from '../features/dashboard/dashboardSlice'

export const store = configureStore({
  reducer: {
    workoutUi: workoutUiReducer,
    nutritionUi: nutritionUiReducer,
    dashboard: dashboardReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
