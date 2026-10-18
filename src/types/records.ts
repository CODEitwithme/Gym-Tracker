export type UUID = string

export interface SyncMetadata {
  id: UUID
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface NutritionValues {
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
}
