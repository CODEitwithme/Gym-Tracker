import { createElement, lazy } from 'react'
import { Navigate, createBrowserRouter } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'

const dashboardPage = lazy(() => import('../features/dashboard/DashboardPage'))
const progressPage = lazy(() => import('../features/progress/ProgressDashboardPage'))
const notFoundPage = lazy(() => import('../features/not-found/NotFoundPage'))
const nutritionPage = lazy(() => import('../features/nutrition/NutritionPage'))
const savedMealsPage = lazy(() => import('../features/nutrition/SavedMealsPage'))
const activeWorkoutPage = lazy(
  () => import('../features/workouts/ActiveWorkoutPage'),
)
const workoutDetailsPage = lazy(
  () => import('../features/workouts/WorkoutDetailsPage'),
)
const workoutPage = lazy(() => import('../features/workouts/WorkoutPage'))
const dataManagementPage = lazy(
  () => import('../features/data-management/DataManagementPage'),
)
const aiSettingsPage = lazy(
  () => import('../features/ai-settings/AiSettingsPage'),
)

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: createElement(dashboardPage) },
      { path: 'progress', element: createElement(progressPage) },
      { path: 'workouts', element: createElement(workoutPage) },
      { path: 'workouts/active', element: createElement(activeWorkoutPage) },
      { path: 'workouts/:workoutId', element: createElement(workoutDetailsPage) },
      { path: 'nutrition', element: createElement(nutritionPage) },
      { path: 'nutrition/meals', element: createElement(savedMealsPage) },
      { path: 'ai-logger', element: <Navigate to="/nutrition" replace /> },
      { path: 'settings', element: <Navigate to="/settings/ai" replace /> },
      { path: 'settings/ai', element: createElement(aiSettingsPage) },
      { path: 'settings/data', element: createElement(dataManagementPage) },
      { path: '*', element: createElement(notFoundPage) },
    ],
  },
])
