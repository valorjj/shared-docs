import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  ChefHat,
  ChevronLeft,
  Clock,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react'
import {
  Field,
  Input,
  Label,
  Select,
  Stack,
  Textarea,
} from '../../components/ui'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { Menu, MenuItem, MenuSeparator } from '../../components/ui/Menu'
import { useAuth } from '../../auth/useAuth'
import {
  absoluteFileUrl,
  useDeleteRecipe,
  useRecipe,
  useRecipeCategories,
  useUpdateRecipe,
  useUploadFile,
} from './api'
import {
  makeId,
  parseIngredients,
  parseSteps,
  serializeIngredients,
  serializeSteps,
} from './recipeData'
import IngredientRow from './IngredientRow'
import StepRow from './StepRow'
import type { Recipe, RecipeIngredient, RecipeStep } from './types'
import styles from './RecipeEditor.module.css'

const AUTOSAVE_MS = 800

export default function RecipeEditor() {
  const params = useParams<{ id: string }>()
  const navigate = useNavigate()
  const id = params.id ? Number(params.id) : null

  const { data: recipe, isLoading, isError, error } = useRecipe(id)

  if (id == null || Number.isNaN(id)) {
    return (
      <div className={styles.statePad}>
        <p className={styles.error}>잘못된 레시피 주소예요.</p>
      </div>
    )
  }

  if (isLoading) {
    return <div className={styles.statePad}>불러오는 중…</div>
  }
  if (isError || !recipe) {
    return (
      <div className={styles.statePad}>
        <p className={styles.error}>
          {error instanceof Error ? error.message : '레시피를 불러오지 못했어요.'}
        </p>
        <button type="button" className={styles.backLink} onClick={() => navigate('/data/recipes')}>
          <ChevronLeft size={14} strokeWidth={2} /> 레시피 목록
        </button>
      </div>
    )
  }

  return <RecipeEditorInner key={recipe.id} recipe={recipe} />
}

function RecipeEditorInner({ recipe }: { recipe: Recipe }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isOwner = user?.userId === recipe.createdBy.userId
  const isAdmin = user?.role === 'ADMIN'
  const canEdit = isOwner
  const canDelete = isOwner || isAdmin

  const { data: categories } = useRecipeCategories()
  const update = useUpdateRecipe()
  const del = useDeleteRecipe()
  const upload = useUploadFile()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Local controlled state — autosave flushes debounced patches.
  const [title, setTitle] = useState(recipe.title)
  const [category, setCategory] = useState(recipe.category)
  const [servings, setServings] = useState(recipe.servings)
  const [cookTime, setCookTime] = useState<string>(
    recipe.cookTimeMinutes ? String(recipe.cookTimeMinutes) : '',
  )
  const [imageUrl, setImageUrl] = useState(recipe.imageUrl ?? '')
  const [sourceUrl, setSourceUrl] = useState(recipe.sourceUrl ?? '')
  const [note, setNote] = useState(recipe.note ?? '')
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(() =>
    parseIngredients(recipe.ingredients),
  )
  const [steps, setSteps] = useState<RecipeStep[]>(() => parseSteps(recipe.steps))

  // Display-only servings scaler — doesn't mutate stored amounts.
  const [displayServings, setDisplayServings] = useState(recipe.servings)
  const factor =
    servings > 0 && displayServings > 0 ? displayServings / servings : 1

  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const ingredientIds = useMemo(() => ingredients.map((i) => i.id), [ingredients])
  const stepIds = useMemo(() => steps.map((s) => s.id), [steps])

  // ── autosave ────────────────────────────────────────────────────────
  // Track the latest serialized doc; debounced timer flushes a PATCH.
  const pendingTimer = useRef<number | null>(null)
  const [dirty, setDirty] = useState(false)

  const flush = useCallback(() => {
    pendingTimer.current = null
    setDirty(false)
    update.mutate({
      id: recipe.id,
      payload: {
        title: title.trim() || '제목 없음',
        category,
        servings: Math.max(1, servings),
        cookTimeMinutes: cookTime ? Number(cookTime) : null,
        imageUrl: imageUrl.trim() || null,
        sourceUrl: sourceUrl.trim() || null,
        note: note.trim() || null,
        ingredients: serializeIngredients(ingredients),
        steps: serializeSteps(steps),
      },
    })
  }, [
    recipe.id,
    title,
    category,
    servings,
    cookTime,
    imageUrl,
    sourceUrl,
    note,
    ingredients,
    steps,
    update,
  ])

  const schedule = useCallback(() => {
    if (!canEdit) return
    setDirty(true)
    if (pendingTimer.current) window.clearTimeout(pendingTimer.current)
    pendingTimer.current = window.setTimeout(flush, AUTOSAVE_MS)
  }, [canEdit, flush])

  // Any local-state edit triggers a debounced save. Effect runs after each
  // render whose deps changed — schedule() is itself stable per-frame and
  // only resets the timer; no setState happens inside this effect's body.
  //
  // The `isInitialMount` ref skips the very first effect run so just viewing
  // a recipe doesn't bump its `updatedAt` (which would also flip "저장됨" on
  // for no reason). React StrictMode double-invokes effects in dev — the
  // ref keeps the same behavior there because the cleanup between the
  // two passes leaves `isInitialMount.current === false`.
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    schedule()
    // schedule is intentionally NOT in deps — it captures the latest fields
    // via closures held in flush, and we want one timer per "edit tick".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, category, servings, cookTime, imageUrl, sourceUrl, note, ingredients, steps])

  // Mirror the latest flush + dirty into refs so the unmount cleanup can
  // read them without taking flush as a dep (which would force the
  // cleanup to fire on every keystroke and defeat the debounce).
  const flushRef = useRef(flush)
  const dirtyRef = useRef(dirty)
  useEffect(() => { flushRef.current = flush })
  useEffect(() => { dirtyRef.current = dirty })

  // Flush on unmount / id change. Without this the user can edit and then
  // navigate away within the 800ms debounce window and lose the change.
  // The keyed-inner pattern (`key={recipe.id}` on RecipeEditorInner) means
  // unmount also covers "switched to a different recipe".
  useEffect(() => {
    return () => {
      if (pendingTimer.current) {
        window.clearTimeout(pendingTimer.current)
        pendingTimer.current = null
      }
      if (dirtyRef.current) flushRef.current()
    }
  }, [])

  // ── handlers ────────────────────────────────────────────────────────
  const handleIngredientDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = ingredients.findIndex((i) => i.id === active.id)
    const newIdx = ingredients.findIndex((i) => i.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    setIngredients(arrayMove(ingredients, oldIdx, newIdx))
  }

  const handleStepDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = steps.findIndex((s) => s.id === active.id)
    const newIdx = steps.findIndex((s) => s.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    setSteps(arrayMove(steps, oldIdx, newIdx))
  }

  const addIngredient = () =>
    setIngredients((prev) => [...prev, { id: makeId(), name: '', amount: null, unit: '' }])

  const addStep = () =>
    setSteps((prev) => [...prev, { id: makeId(), text: '' }])

  const handleDelete = () => {
    del.mutate(recipe.id, { onSuccess: () => navigate('/data/recipes', { replace: true }) })
  }

  const handleUploadPick = () => fileInputRef.current?.click()

  const handleFileSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    upload.mutate(file, {
      onSuccess: (res) => setImageUrl(absoluteFileUrl(res.url)),
      onError: (err) =>
        window.alert(err instanceof Error ? err.message : '업로드에 실패했어요.'),
    })
  }

  const handleClearImage = () => setImageUrl('')

  return (
    <div className={styles.root}>
      <header className={styles.topBar}>
        <button
          type="button"
          className={styles.backLink}
          onClick={() => navigate('/data/recipes')}
        >
          <ChevronLeft size={14} strokeWidth={2} aria-hidden="true" />
          레시피 목록
        </button>
        <div className={styles.topBarRight}>
          <span className={styles.savingHint} aria-live="polite">
            {dirty || update.isPending ? '저장 중…' : '저장됨'}
          </span>
          <Menu
            trigger={
              <button type="button" className={styles.kebab} aria-label="레시피 옵션">
                <MoreHorizontal size={16} strokeWidth={1.75} />
              </button>
            }
          >
            {sourceUrl && (
              <>
                <MenuItem
                  onSelect={() => window.open(sourceUrl, '_blank', 'noopener,noreferrer')}
                  icon={<ExternalLink size={14} />}
                >
                  원본 열기
                </MenuItem>
                <MenuSeparator />
              </>
            )}
            <MenuItem
              destructive
              onSelect={() => setConfirmingDelete(true)}
              icon={<Trash2 size={14} />}
            >
              삭제
            </MenuItem>
          </Menu>
        </div>
      </header>

      <div className={styles.hero}>
        {imageUrl ? (
          <>
            <img
              className={styles.heroImage}
              src={imageUrl}
              alt=""
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
            <div className={styles.heroActions}>
              <button
                type="button"
                className={styles.heroAction}
                onClick={handleUploadPick}
                disabled={upload.isPending}
                title="다른 사진"
              >
                {upload.isPending ? (
                  <Loader2 size={12} strokeWidth={2} className={styles.spin} aria-hidden="true" />
                ) : (
                  <Upload size={12} strokeWidth={2} aria-hidden="true" />
                )}
                다른 사진
              </button>
              <button
                type="button"
                className={styles.heroAction}
                onClick={handleClearImage}
                title="사진 제거"
              >
                <X size={12} strokeWidth={2} aria-hidden="true" />
                제거
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            className={styles.heroEmpty}
            onClick={handleUploadPick}
            disabled={upload.isPending}
          >
            {upload.isPending ? (
              <>
                <Loader2 size={20} strokeWidth={1.6} className={styles.spin} aria-hidden="true" />
                <span>업로드 중…</span>
              </>
            ) : (
              <>
                <Upload size={20} strokeWidth={1.6} aria-hidden="true" />
                <span>사진 추가</span>
                <span className={styles.heroEmptyHint}>5MB 이하 이미지</span>
              </>
            )}
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className={styles.hiddenFile}
        onChange={handleFileSelected}
      />

      <div className={styles.inner}>
        <input
          className={styles.titleInput}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목 없음"
          disabled={!canEdit}
        />

        <div className={styles.metaRow}>
          <Menu
            trigger={
              <button type="button" className={styles.metaPill}>
                <ChefHat size={12} strokeWidth={2} aria-hidden="true" />
                {category}
              </button>
            }
          >
            {categories?.map((c) => (
              <MenuItem key={c.id} onSelect={() => setCategory(c.name)}>
                {c.name}
              </MenuItem>
            ))}
          </Menu>

          <div className={styles.metaPill}>
            <Users size={12} strokeWidth={2} aria-hidden="true" />
            <button
              type="button"
              className={styles.stepperBtn}
              onClick={() => setServings((s) => Math.max(1, s - 1))}
              aria-label="기본 인분 감소"
            >
              −
            </button>
            <span className={styles.servings}>{servings}인분 (기본)</span>
            <button
              type="button"
              className={styles.stepperBtn}
              onClick={() => setServings((s) => s + 1)}
              aria-label="기본 인분 증가"
            >
              +
            </button>
          </div>

          <div className={styles.metaPill}>
            <Clock size={12} strokeWidth={2} aria-hidden="true" />
            <input
              className={styles.metaInput}
              type="text"
              inputMode="numeric"
              placeholder="조리 시간"
              value={cookTime}
              onChange={(e) => setCookTime(e.target.value.replace(/[^\d]/g, ''))}
              aria-label="조리 시간 (분)"
            />
            <span className={styles.metaUnit}>분</span>
          </div>
        </div>

        <div className={styles.scaleRow}>
          <span className={styles.scaleLabel}>인분 환산</span>
          <button
            type="button"
            className={styles.stepperBtn}
            onClick={() => setDisplayServings((s) => Math.max(1, s - 1))}
            aria-label="환산 인분 감소"
          >
            −
          </button>
          <span className={styles.scaleValue}>{displayServings}인분</span>
          <button
            type="button"
            className={styles.stepperBtn}
            onClick={() => setDisplayServings((s) => s + 1)}
            aria-label="환산 인분 증가"
          >
            +
          </button>
          {displayServings !== servings && (
            <button
              type="button"
              className={styles.scaleReset}
              onClick={() => setDisplayServings(servings)}
            >
              기본으로
            </button>
          )}
        </div>

        <div className={styles.columns}>
          <section className={styles.col}>
            <h2 className={styles.colTitle}>재료</h2>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleIngredientDragEnd}
            >
              <SortableContext items={ingredientIds} strategy={verticalListSortingStrategy}>
                <div className={styles.ingList}>
                  {ingredients.map((ing) => (
                    <IngredientRow
                      key={ing.id}
                      ingredient={ing}
                      factor={factor}
                      onChange={(next) =>
                        setIngredients((prev) =>
                          prev.map((i) => (i.id === next.id ? next : i)),
                        )
                      }
                      onDelete={() =>
                        setIngredients((prev) => prev.filter((i) => i.id !== ing.id))
                      }
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <button type="button" className={styles.addRow} onClick={addIngredient}>
              <Plus size={14} strokeWidth={2} aria-hidden="true" />
              재료 추가
            </button>
          </section>

          <section className={styles.col}>
            <h2 className={styles.colTitle}>순서</h2>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleStepDragEnd}
            >
              <SortableContext items={stepIds} strategy={verticalListSortingStrategy}>
                <div className={styles.stepList}>
                  {steps.map((s, i) => (
                    <StepRow
                      key={s.id}
                      step={s}
                      index={i}
                      onChange={(next) =>
                        setSteps((prev) => prev.map((x) => (x.id === next.id ? next : x)))
                      }
                      onDelete={() =>
                        setSteps((prev) => prev.filter((x) => x.id !== s.id))
                      }
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <button type="button" className={styles.addRow} onClick={addStep}>
              <Plus size={14} strokeWidth={2} aria-hidden="true" />
              순서 추가
            </button>
          </section>
        </div>

        <Stack gap={3}>
          <Field>
            <Label htmlFor="recipe-image-url" optional>
              <ImageIcon size={12} strokeWidth={2} aria-hidden="true" style={{ marginRight: 4 }} />
              이미지 URL
            </Label>
            <Input
              id="recipe-image-url"
              type="url"
              placeholder="https://…"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </Field>

          <Field>
            <Label htmlFor="recipe-source-url" optional>원본 링크</Label>
            <Input
              id="recipe-source-url"
              type="url"
              placeholder="레시피 출처 URL"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
          </Field>

          <Field>
            <Label htmlFor="recipe-note" optional>메모</Label>
            <Textarea
              id="recipe-note"
              rows={3}
              placeholder="기록하고 싶은 팁이나 변형."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
            />
          </Field>

          {/* Hidden access to the category Select for screen readers — we
              swap the dropdown for a pill+menu above. */}
          <Field className={styles.srOnly}>
            <Label htmlFor="recipe-category-fallback">카테고리</Label>
            <Select
              id="recipe-category-fallback"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories?.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </Select>
          </Field>
        </Stack>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="레시피를 삭제할까요?"
        description="이 레시피와 모든 재료·순서가 사라집니다. 되돌릴 수 없어요."
        confirmLabel="삭제"
        cancelLabel="취소"
        destructive
        onConfirm={canDelete ? handleDelete : () => undefined}
      />
    </div>
  )
}
