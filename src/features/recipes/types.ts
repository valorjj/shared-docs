export type RecipeUserRef = {
  userId: number
  name: string
  pictureUrl: string | null
}

/** Backend stores ingredients + steps as opaque LONGTEXT JSON arrays.
 *  Client parses on read and re-serializes on save — see {@link parseIngredients}
 *  / {@link parseSteps} in `recipeData.ts`. */
export type Recipe = {
  id: number
  title: string
  category: string
  servings: number
  cookTimeMinutes: number | null
  imageUrl: string | null
  sourceUrl: string | null
  note: string | null
  ingredients: string
  steps: string
  createdBy: RecipeUserRef
  createdAt: string
  updatedAt: string
}

export type RecipeCategory = {
  id: number
  name: string
  color: string | null
  icon: string | null
  sortOrder: number
  active: boolean
}

/** Ingredient row inside a parsed ingredients array.
 *  `id` is a client-generated UUID used only as a stable React/dnd-kit key. */
export type RecipeIngredient = {
  id: string
  name: string
  amount: number | null
  unit: string
}

export type RecipeStep = {
  id: string
  text: string
}

export type CreateRecipePayload = {
  title?: string
  category: string
  servings?: number
  cookTimeMinutes?: number | null
  imageUrl?: string | null
  sourceUrl?: string | null
  note?: string | null
  ingredients?: string
  steps?: string
}

export type UpdateRecipePayload = {
  title?: string
  category?: string
  servings?: number
  cookTimeMinutes?: number | null
  imageUrl?: string | null
  sourceUrl?: string | null
  note?: string | null
  ingredients?: string
  steps?: string
}
