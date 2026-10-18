import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { formatLocalDate } from '../../lib/dateTime'
import type { MealType } from './types'

export type NutritionOperationStatus = 'idle' | 'loading' | 'saving' | 'failed'

export interface NutritionUiState {
  selectedDate: string
  status: NutritionOperationStatus
  error: string | null
  searchQuery: string
  activeMealTypeFilter: MealType | 'all'
}

const initialState: NutritionUiState = {
  selectedDate: formatLocalDate(new Date()),
  status: 'idle',
  error: null,
  searchQuery: '',
  activeMealTypeFilter: 'all',
}

const nutritionUiSlice = createSlice({
  name: 'nutritionUi',
  initialState,
  reducers: {
    setSelectedDate(state, action: PayloadAction<string>) {
      state.selectedDate = action.payload
      state.error = null
    },
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload
    },
    setActiveMealTypeFilter(state, action: PayloadAction<MealType | 'all'>) {
      state.activeMealTypeFilter = action.payload
    },
    setNutritionStatus(state, action: PayloadAction<NutritionOperationStatus>) {
      state.status = action.payload
    },
    setNutritionError(state, action: PayloadAction<string>) {
      state.error = action.payload
      state.status = 'failed'
    },
    clearNutritionError(state) {
      state.error = null
      if (state.status === 'failed') state.status = 'idle'
    },
  },
})

export const {
  clearNutritionError,
  setActiveMealTypeFilter,
  setNutritionError,
  setNutritionStatus,
  setSearchQuery,
  setSelectedDate,
} = nutritionUiSlice.actions

export default nutritionUiSlice.reducer

