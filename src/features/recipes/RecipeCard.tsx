import { useState } from 'react'
import { ChefHat, Clock, Users } from 'lucide-react'
import { parseIngredients } from './recipeData'
import type { Recipe } from './types'
import styles from './RecipeCard.module.css'

type Props = {
  recipe: Recipe
  onOpen: () => void
}

export default function RecipeCard({ recipe, onOpen }: Props) {
  const [imgErr, setImgErr] = useState(false)
  const ingredients = parseIngredients(recipe.ingredients)
  const showImage = !!recipe.imageUrl && !imgErr

  return (
    <button type="button" className={styles.card} onClick={onOpen}>
      {showImage ? (
        <img
          className={styles.image}
          src={recipe.imageUrl!}
          alt=""
          loading="lazy"
          onError={() => setImgErr(true)}
        />
      ) : (
        <div className={styles.imagePlaceholder} aria-hidden="true">
          <ChefHat size={28} strokeWidth={1.4} />
        </div>
      )}
      <div className={styles.body}>
        <div className={styles.category}>{recipe.category}</div>
        <h3 className={styles.title}>{recipe.title}</h3>
        <div className={styles.meta}>
          <span className={styles.metaItem}>
            <Users size={12} strokeWidth={2} aria-hidden="true" />
            {recipe.servings}인분
          </span>
          <span className={styles.metaSep} aria-hidden="true">·</span>
          <span className={styles.metaItem}>
            재료 {ingredients.length}개
          </span>
          {recipe.cookTimeMinutes ? (
            <>
              <span className={styles.metaSep} aria-hidden="true">·</span>
              <span className={styles.metaItem}>
                <Clock size={12} strokeWidth={2} aria-hidden="true" />
                {recipe.cookTimeMinutes}분
              </span>
            </>
          ) : null}
        </div>
      </div>
    </button>
  )
}
