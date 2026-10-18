import { createBrowserRouter } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import DashboardPage from '../features/dashboard/DashboardPage'
import NotFoundPage from '../features/not-found/NotFoundPage'
import NutritionPage from '../features/nutrition/NutritionPage'
import SavedMealsPage from '../features/nutrition/SavedMealsPage'
import ActiveWorkoutPage from '../features/workouts/ActiveWorkoutPage'
import WorkoutDetailsPage from '../features/workouts/WorkoutDetailsPage'
import WorkoutPage from '../features/workouts/WorkoutPage'
import DataManagementPage from '../features/data-management/DataManagementPage'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'workouts', element: <WorkoutPage /> },
      { path: 'workouts/active', element: <ActiveWorkoutPage /> },
      { path: 'workouts/:workoutId', element: <WorkoutDetailsPage /> },
      { path: 'nutrition', element: <NutritionPage /> },
      { path: 'nutrition/meals', element: <SavedMealsPage /> },
      { path: 'settings/data', element: <DataManagementPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
