# Decisions D1a — Plan Tree Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend for the structural Decisions tree — 계획(Plan) → 안건(SubPlan) → 선택지(Option) CRUD, workspace-scoped, plus the append-only PlanEvent audit log for the structural events. Ratings, decisions, timeline/feed are deferred to D1b (no further migration needed).

**Architecture:** New `decision` feature package in the Spring Boot + Kotlin backend, following the exact patterns of the `invitation`/`workspace` packages. Entities extend `BaseEntity` (id/createdAt/updatedAt/@Version), reference parents by id (no `@ManyToOne`), FK constraints `ON DELETE RESTRICT` declared in one Flyway migration (V15). Controllers are workspace-scoped via `@CurrentWorkspace ws: Workspace` (the filter guarantees membership) and read the actor via `@AuthenticationPrincipal me: AppPrincipal`. Typed domain exceptions extend `ApiException` → RFC 7807 automatically. Every structural mutation appends a `PlanEvent` in the same transaction via a small `PlanEventRecorder`.

**Tech Stack:** Kotlin 1.9.25, Spring Boot 3.5.3, Spring Data JPA + Hibernate, Flyway (MariaDB), Bean Validation, Jackson (kotlin module), JUnit5 + `spring-boot-starter-test`, MariaDB on `localhost:3307` (`shared_docs` dev / `shared_docs_test` tests). `ddl-auto: validate` everywhere — schema changes are migrations only.

**Conventions reference (verbatim patterns):** the brainstorming session captured the full backend pattern reference; mirror `invitation/WorkspaceInvitation.kt`, `invitation/InvitationRepository.kt`, `invitation/InvitationService.kt`, `invitation/InvitationExceptions.kt`, `invitation/InvitationDto.kt`, `invitation/InvitationController.kt`, and `invitation/InvitationServiceTest.kt`.

**Scope boundary (D1a only):**
- IN: Plan/SubPlan/Option entities + repos + CRUD service + controllers; PlanEvent entity/repo/recorder; events PLAN_CREATED / SUBPLAN_ADDED / OPTION_ADDED; the V15 migration creating the FULL decision schema (incl. the ratings/decisions tables D1b will use); tree read assembling subplans + options (rating/decision fields present in DTO but defaulted).
- OUT (→ D1b): OptionRating + Decision entities/services/endpoints; DECISION_* events; timeline + feed endpoints; rating aggregate computation. The DTO fields for those (`avgScore`, `ratingCount`, `ratings`, `decision`, `decidedCount`, SubPlanStatus=DECIDED) exist now and are populated with neutral defaults until D1b fills them.
- OUT (→ D3): `sub_plan_edges` table + entity + endpoints (a separate additive migration in D3).

**Base path:** all files under `/Users/jeongjin/WebstormProjects/shared-docs-root/shared-docs-backend/`. Package root `com.shareddocs.backend`. New package: `com.shareddocs.backend.decision`.

**Build/test commands:**
- Compile only: `./gradlew compileKotlin compileTestKotlin`
- Run one test class: `./gradlew test --tests "com.shareddocs.backend.decision.PlanServiceTest"`
- Full build (tests included): `./gradlew build`

---

### Task 1: Flyway migration V15 — full decision schema

**Files:**
- Create: `src/main/resources/db/migration/V15__decisions.sql`

The migration creates ALL six decision tables now (additive — purely new tables, no change to existing data), even though D1a only wires four of them. This makes D1b/canvas phases migration-free. Column shapes match `BaseEntity` (`version`/`created_at`/`updated_at`), InnoDB, utf8mb4, `DATETIME(6)`, FK `ON DELETE RESTRICT`.

- [ ] **Step 1: Write the migration**

```sql
-- D1a (Decisions, Pillar 3): the full decision schema, created in one additive
-- migration so later sub-phases (ratings/decisions in D1b, canvas edges in D3)
-- add no further migration. Purely new tables — no change to existing data.
--
-- Model: 계획(plan) → 안건(sub_plan) → 선택지(option); each member's 평가
-- (option_rating, 1–5 + comment) on an option; a 결정(decision) locks a chosen
-- option on a sub_plan with supersession history; plan_events is an append-only
-- audit log that backs the timeline + workspace feed.
--
-- canvas_x / canvas_y / group_label are nullable: D1a/D2 ignore them (auto-layout),
-- D3 persists drag positions — no migration needed then.

CREATE TABLE `plans` (
  `id`                  bigint(20)   NOT NULL AUTO_INCREMENT,
  `workspace_id`        bigint(20)   NOT NULL,
  `title`               varchar(200) NOT NULL,
  `description`         text         DEFAULT NULL,
  `status`              varchar(20)  NOT NULL DEFAULT 'ACTIVE',
  `created_by_user_id`  bigint(20)   NOT NULL,
  `canvas_x`            double       DEFAULT NULL,
  `canvas_y`            double       DEFAULT NULL,
  `group_label`         varchar(100) DEFAULT NULL,
  `version`             bigint(20)   NOT NULL DEFAULT 0,
  `created_at`          datetime(6)  NOT NULL,
  `updated_at`          datetime(6)  NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_plans_workspace` (`workspace_id`),
  CONSTRAINT `fk_plans_workspace` FOREIGN KEY (`workspace_id`)
      REFERENCES `workspaces` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_plans_creator` FOREIGN KEY (`created_by_user_id`)
      REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `sub_plans` (
  `id`                  bigint(20)   NOT NULL AUTO_INCREMENT,
  `workspace_id`        bigint(20)   NOT NULL,
  `plan_id`             bigint(20)   NOT NULL,
  `title`               varchar(200) NOT NULL,
  `description`         text         DEFAULT NULL,
  `sort_order`          int(11)      NOT NULL DEFAULT 0,
  `created_by_user_id`  bigint(20)   NOT NULL,
  `canvas_x`            double       DEFAULT NULL,
  `canvas_y`            double       DEFAULT NULL,
  `version`             bigint(20)   NOT NULL DEFAULT 0,
  `created_at`          datetime(6)  NOT NULL,
  `updated_at`          datetime(6)  NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sub_plans_plan` (`plan_id`),
  KEY `idx_sub_plans_workspace` (`workspace_id`),
  CONSTRAINT `fk_sub_plans_plan` FOREIGN KEY (`plan_id`)
      REFERENCES `plans` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_sub_plans_workspace` FOREIGN KEY (`workspace_id`)
      REFERENCES `workspaces` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_sub_plans_creator` FOREIGN KEY (`created_by_user_id`)
      REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `options` (
  `id`                  bigint(20)   NOT NULL AUTO_INCREMENT,
  `workspace_id`        bigint(20)   NOT NULL,
  `sub_plan_id`         bigint(20)   NOT NULL,
  `title`               varchar(200) NOT NULL,
  `description`         text         DEFAULT NULL,
  `sort_order`          int(11)      NOT NULL DEFAULT 0,
  `created_by_user_id`  bigint(20)   NOT NULL,
  `version`             bigint(20)   NOT NULL DEFAULT 0,
  `created_at`          datetime(6)  NOT NULL,
  `updated_at`          datetime(6)  NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_options_sub_plan` (`sub_plan_id`),
  KEY `idx_options_workspace` (`workspace_id`),
  CONSTRAINT `fk_options_sub_plan` FOREIGN KEY (`sub_plan_id`)
      REFERENCES `sub_plans` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_options_workspace` FOREIGN KEY (`workspace_id`)
      REFERENCES `workspaces` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_options_creator` FOREIGN KEY (`created_by_user_id`)
      REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `option_ratings` (
  `id`                  bigint(20)   NOT NULL AUTO_INCREMENT,
  `workspace_id`        bigint(20)   NOT NULL,
  `option_id`           bigint(20)   NOT NULL,
  `user_id`             bigint(20)   NOT NULL,
  `score`               int(11)      NOT NULL,
  `comment`             text         DEFAULT NULL,
  `version`             bigint(20)   NOT NULL DEFAULT 0,
  `created_at`          datetime(6)  NOT NULL,
  `updated_at`          datetime(6)  NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_option_ratings_option_user` (`option_id`, `user_id`),
  KEY `idx_option_ratings_option` (`option_id`),
  CONSTRAINT `fk_option_ratings_option` FOREIGN KEY (`option_id`)
      REFERENCES `options` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_option_ratings_workspace` FOREIGN KEY (`workspace_id`)
      REFERENCES `workspaces` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_option_ratings_user` FOREIGN KEY (`user_id`)
      REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `decisions` (
  `id`                  bigint(20)   NOT NULL AUTO_INCREMENT,
  `workspace_id`        bigint(20)   NOT NULL,
  `sub_plan_id`         bigint(20)   NOT NULL,
  `chosen_option_id`    bigint(20)   NOT NULL,
  `reason`              text         NOT NULL,
  `decided_by_user_id`  bigint(20)   NOT NULL,
  `superseded_at`       datetime(6)  DEFAULT NULL,
  `version`             bigint(20)   NOT NULL DEFAULT 0,
  `created_at`          datetime(6)  NOT NULL,
  `updated_at`          datetime(6)  NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_decisions_sub_plan` (`sub_plan_id`),
  KEY `idx_decisions_workspace` (`workspace_id`),
  CONSTRAINT `fk_decisions_sub_plan` FOREIGN KEY (`sub_plan_id`)
      REFERENCES `sub_plans` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_decisions_option` FOREIGN KEY (`chosen_option_id`)
      REFERENCES `options` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_decisions_workspace` FOREIGN KEY (`workspace_id`)
      REFERENCES `workspaces` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_decisions_user` FOREIGN KEY (`decided_by_user_id`)
      REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `plan_events` (
  `id`                  bigint(20)   NOT NULL AUTO_INCREMENT,
  `workspace_id`        bigint(20)   NOT NULL,
  `plan_id`             bigint(20)   NOT NULL,
  `sub_plan_id`         bigint(20)   DEFAULT NULL,
  `type`                varchar(40)  NOT NULL,
  `actor_user_id`       bigint(20)   NOT NULL,
  `payload`             longtext     DEFAULT NULL,
  `version`             bigint(20)   NOT NULL DEFAULT 0,
  `created_at`          datetime(6)  NOT NULL,
  `updated_at`          datetime(6)  NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_plan_events_plan` (`plan_id`),
  KEY `idx_plan_events_ws_created` (`workspace_id`, `created_at`),
  CONSTRAINT `fk_plan_events_plan` FOREIGN KEY (`plan_id`)
      REFERENCES `plans` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_plan_events_workspace` FOREIGN KEY (`workspace_id`)
      REFERENCES `workspaces` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_plan_events_actor` FOREIGN KEY (`actor_user_id`)
      REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 2: Verify the migration applies cleanly**

Run: `./gradlew test --tests "com.shareddocs.backend.invitation.InvitationServiceTest"`
Expected: PASS. (Booting any `@SpringBootTest` runs Flyway against `shared_docs_test`; if V15 had a SQL error or drift, the context would fail to start. A green pre-existing test proves V15 applied and Hibernate `validate` is still happy — at this point no new entities exist yet, so this only validates the SQL parses and runs.)

- [ ] **Step 3: Commit**

```bash
git add src/main/resources/db/migration/V15__decisions.sql
git commit -m "feat(decisions): V15 migration — full decision schema (D1a)"
```

---

### Task 2: Enums + entities (Plan, SubPlan, Option, PlanEvent)

**Files:**
- Create: `src/main/kotlin/com/shareddocs/backend/decision/PlanEnums.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/decision/Plan.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/decision/SubPlan.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/decision/Option.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/decision/PlanEvent.kt`

D1b adds `OptionRating.kt` and `Decision.kt` against the already-created tables. `@Enumerated(EnumType.STRING)` stores enum names as the `varchar` values from V15.

- [ ] **Step 1: Write the enums**

```kotlin
package com.shareddocs.backend.decision

/** Lifecycle of a 계획. ARCHIVED hides it from the active roadmap but keeps history. */
enum class PlanStatus { ACTIVE, ARCHIVED }

/**
 * Append-only audit-log event types. D1a writes the first three; D1b adds the
 * DECISION_* ones. The `type` column is varchar(40) — keep names within that.
 */
enum class PlanEventType {
    PLAN_CREATED,
    SUBPLAN_ADDED,
    OPTION_ADDED,
    DECISION_LOCKED,
    DECISION_REOPENED,
    DECISION_CHANGED,
}
```

- [ ] **Step 2: Write the Plan entity**

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.common.BaseEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Index
import jakarta.persistence.Table

/**
 * 계획 — the umbrella over a set of related 안건s ("우리 첫 집 구하기").
 * Lives on the workspace roadmap; canvas_x/y + group_label position it there
 * (nullable until D3 persists drag). id/createdAt/updatedAt/version from BaseEntity.
 */
@Entity
@Table(name = "plans", indexes = [Index(name = "idx_plans_workspace", columnList = "workspace_id")])
class Plan(
    @Column(name = "workspace_id", nullable = false, updatable = false)
    val workspaceId: Long,

    @Column(nullable = false, length = 200)
    var title: String,

    @Column(columnDefinition = "text")
    var description: String? = null,

    @Column(name = "created_by_user_id", nullable = false, updatable = false)
    val createdByUserId: Long,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var status: PlanStatus = PlanStatus.ACTIVE,

    @Column(name = "canvas_x")
    var canvasX: Double? = null,

    @Column(name = "canvas_y")
    var canvasY: Double? = null,

    @Column(name = "group_label", length = 100)
    var groupLabel: String? = null,
) : BaseEntity()
```

- [ ] **Step 3: Write the SubPlan entity**

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.common.BaseEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Index
import jakarta.persistence.Table

/**
 * 안건 — the decidable question under a 계획 ("동네 정하기"). The "bridge" between
 * the umbrella plan and concrete 선택지s. Referenced to its plan by id.
 */
@Entity
@Table(
    name = "sub_plans",
    indexes = [
        Index(name = "idx_sub_plans_plan", columnList = "plan_id"),
        Index(name = "idx_sub_plans_workspace", columnList = "workspace_id"),
    ],
)
class SubPlan(
    @Column(name = "workspace_id", nullable = false, updatable = false)
    val workspaceId: Long,

    @Column(name = "plan_id", nullable = false, updatable = false)
    val planId: Long,

    @Column(nullable = false, length = 200)
    var title: String,

    @Column(columnDefinition = "text")
    var description: String? = null,

    @Column(name = "sort_order", nullable = false)
    var sortOrder: Int = 0,

    @Column(name = "created_by_user_id", nullable = false, updatable = false)
    val createdByUserId: Long,

    @Column(name = "canvas_x")
    var canvasX: Double? = null,

    @Column(name = "canvas_y")
    var canvasY: Double? = null,
) : BaseEntity()
```

- [ ] **Step 4: Write the Option entity**

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.common.BaseEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Index
import jakarta.persistence.Table

/** 선택지 — a candidate answer to a 안건 ("마포"). Rated by members in D1b. */
@Entity
@Table(
    name = "options",
    indexes = [
        Index(name = "idx_options_sub_plan", columnList = "sub_plan_id"),
        Index(name = "idx_options_workspace", columnList = "workspace_id"),
    ],
)
class Option(
    @Column(name = "workspace_id", nullable = false, updatable = false)
    val workspaceId: Long,

    @Column(name = "sub_plan_id", nullable = false, updatable = false)
    val subPlanId: Long,

    @Column(nullable = false, length = 200)
    var title: String,

    @Column(columnDefinition = "text")
    var description: String? = null,

    @Column(name = "sort_order", nullable = false)
    var sortOrder: Int = 0,

    @Column(name = "created_by_user_id", nullable = false, updatable = false)
    val createdByUserId: Long,
) : BaseEntity()
```

- [ ] **Step 5: Write the PlanEvent entity**

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.common.BaseEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Index
import jakarta.persistence.Table

/**
 * Append-only audit-log row — one per meaningful moment in a 계획's life. Source
 * for both the per-계획 timeline and the workspace feed (D1b). `payload` is a JSON
 * string of denormalized labels (e.g. the 안건/선택지 title) so the timeline renders
 * without N+1 joins. Written in the same transaction as the mutation that caused it.
 */
@Entity
@Table(
    name = "plan_events",
    indexes = [
        Index(name = "idx_plan_events_plan", columnList = "plan_id"),
        Index(name = "idx_plan_events_ws_created", columnList = "workspace_id, created_at"),
    ],
)
class PlanEvent(
    @Column(name = "workspace_id", nullable = false, updatable = false)
    val workspaceId: Long,

    @Column(name = "plan_id", nullable = false, updatable = false)
    val planId: Long,

    @Column(name = "sub_plan_id", updatable = false)
    val subPlanId: Long? = null,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40, updatable = false)
    val type: PlanEventType,

    @Column(name = "actor_user_id", nullable = false, updatable = false)
    val actorUserId: Long,

    @Column(columnDefinition = "longtext", updatable = false)
    val payload: String? = null,
) : BaseEntity()
```

- [ ] **Step 6: Verify compilation**

Run: `./gradlew compileKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 7: Verify the entities match the schema**

Run: `./gradlew test --tests "com.shareddocs.backend.invitation.InvitationServiceTest"`
Expected: PASS. (Hibernate `validate` now checks the four new entities against the V15 tables on context startup; a column-name/type mismatch would fail the context.)

- [ ] **Step 8: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/
git commit -m "feat(decisions): Plan/SubPlan/Option/PlanEvent entities + enums (D1a)"
```

---

### Task 3: Repositories

**Files:**
- Create: `src/main/kotlin/com/shareddocs/backend/decision/PlanRepository.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/decision/SubPlanRepository.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/decision/OptionRepository.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/decision/PlanEventRepository.kt`

Method-name queries only (no `@Query`). Every lookup that takes an id ALSO takes `workspaceId`, so an id from another workspace returns null → 404. This is the cross-workspace guard at the data layer.

- [ ] **Step 1: Write PlanRepository**

```kotlin
package com.shareddocs.backend.decision

import org.springframework.data.jpa.repository.JpaRepository

interface PlanRepository : JpaRepository<Plan, Long> {

    /** Roadmap list for a workspace, newest first. */
    fun findAllByWorkspaceIdOrderByCreatedAtDesc(workspaceId: Long): List<Plan>

    /** A single plan, scoped to the workspace — a foreign id yields null (→ 404). */
    fun findByIdAndWorkspaceId(id: Long, workspaceId: Long): Plan?
}
```

- [ ] **Step 2: Write SubPlanRepository**

```kotlin
package com.shareddocs.backend.decision

import org.springframework.data.jpa.repository.JpaRepository

interface SubPlanRepository : JpaRepository<SubPlan, Long> {

    fun findAllByPlanIdOrderBySortOrderAscIdAsc(planId: Long): List<SubPlan>

    fun findByIdAndWorkspaceId(id: Long, workspaceId: Long): SubPlan?

    /** True if the plan has any 안건 — drives delete-tree ordering + roll-ups. */
    fun existsByPlanId(planId: Long): Boolean
}
```

- [ ] **Step 3: Write OptionRepository**

```kotlin
package com.shareddocs.backend.decision

import org.springframework.data.jpa.repository.JpaRepository

interface OptionRepository : JpaRepository<Option, Long> {

    fun findAllBySubPlanIdOrderBySortOrderAscIdAsc(subPlanId: Long): List<Option>

    /** Bulk fetch for assembling a whole plan tree without N+1 per 안건. */
    fun findAllBySubPlanIdInOrderBySortOrderAscIdAsc(subPlanIds: Collection<Long>): List<Option>

    fun findByIdAndWorkspaceId(id: Long, workspaceId: Long): Option?
}
```

- [ ] **Step 4: Write PlanEventRepository**

```kotlin
package com.shareddocs.backend.decision

import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository

interface PlanEventRepository : JpaRepository<PlanEvent, Long> {

    /** This plan's timeline, newest first. */
    fun findAllByPlanIdOrderByCreatedAtDesc(planId: Long): List<PlanEvent>

    /** Workspace-wide feed, newest first, paged (D1b uses the Pageable for a limit). */
    fun findAllByWorkspaceIdOrderByCreatedAtDesc(workspaceId: Long, pageable: Pageable): List<PlanEvent>
}
```

- [ ] **Step 5: Verify compilation**

Run: `./gradlew compileKotlin`
Expected: BUILD SUCCESSFUL. (Spring derives the queries at startup; a malformed method name fails later at context load, caught in Task 6's test.)

- [ ] **Step 6: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/
git commit -m "feat(decisions): repositories for plan tree + events (D1a)"
```

---

### Task 4: Exceptions

**Files:**
- Create: `src/main/kotlin/com/shareddocs/backend/decision/DecisionExceptions.kt`

Typed exceptions extend `ApiException` (status + stable type slug + title + Korean detail); the existing single `@ExceptionHandler(ApiException::class)` renders them as RFC 7807 — no handler change. 404 (not 403) for cross-workspace/missing ids, matching the repo's "don't reveal existence" rule. (Membership itself is already enforced by `@CurrentWorkspace`/the filter before the controller runs.)

- [ ] **Step 1: Write the exceptions**

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.common.ApiException
import org.springframework.http.HttpStatus

/*
 * Typed errors for the Decisions feature. 404 for not-found / wrong-workspace ids
 * (we don't reveal whether the id exists in another workspace). 400 for requests
 * that reference a child that doesn't belong to the named parent.
 */

class PlanNotFoundException :
    ApiException(HttpStatus.NOT_FOUND, "plan-not-found", "Plan not found", "계획을 찾을 수 없어요.")

class SubPlanNotFoundException :
    ApiException(HttpStatus.NOT_FOUND, "subplan-not-found", "Sub-plan not found", "안건을 찾을 수 없어요.")

class OptionNotFoundException :
    ApiException(HttpStatus.NOT_FOUND, "option-not-found", "Option not found", "선택지를 찾을 수 없어요.")

/** A 안건 id was given that isn't part of the named 계획. */
class SubPlanNotInPlanException :
    ApiException(HttpStatus.BAD_REQUEST, "subplan-not-in-plan", "Sub-plan not in plan", "이 안건은 해당 계획에 속하지 않아요.")

/** An 선택지 id was given that isn't part of the named 안건. */
class OptionNotInSubPlanException :
    ApiException(HttpStatus.BAD_REQUEST, "option-not-in-subplan", "Option not in sub-plan", "이 선택지는 해당 안건에 속하지 않아요.")
```

- [ ] **Step 2: Verify compilation**

Run: `./gradlew compileKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/DecisionExceptions.kt
git commit -m "feat(decisions): typed RFC 7807 exceptions (D1a)"
```

---

### Task 5: DTOs

**Files:**
- Create: `src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt`

Request DTOs carry Bean Validation. Response DTOs include the D1b/decision fields now (`avgScore`, `ratingCount`, `ratings`, `decision`, `decidedCount`, `SubPlanStatus`) with neutral defaults so the API shape is stable across sub-phases.

- [ ] **Step 1: Write the DTOs**

```kotlin
package com.shareddocs.backend.decision

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import java.time.Instant

// ── Requests ─────────────────────────────────────────────────────────────────

data class CreatePlanRequest(
    @field:NotBlank @field:Size(max = 200) val title: String,
    @field:Size(max = 5000) val description: String? = null,
)

/** All fields optional — only the present ones are applied (partial update). */
data class UpdatePlanRequest(
    @field:Size(max = 200) val title: String? = null,
    @field:Size(max = 5000) val description: String? = null,
    val status: PlanStatus? = null,
    val canvasX: Double? = null,
    val canvasY: Double? = null,
    @field:Size(max = 100) val groupLabel: String? = null,
)

data class CreateSubPlanRequest(
    @field:NotBlank @field:Size(max = 200) val title: String,
    @field:Size(max = 5000) val description: String? = null,
)

data class UpdateSubPlanRequest(
    @field:Size(max = 200) val title: String? = null,
    @field:Size(max = 5000) val description: String? = null,
    val sortOrder: Int? = null,
    val canvasX: Double? = null,
    val canvasY: Double? = null,
)

data class CreateOptionRequest(
    @field:NotBlank @field:Size(max = 200) val title: String,
    @field:Size(max = 5000) val description: String? = null,
)

data class UpdateOptionRequest(
    @field:Size(max = 200) val title: String? = null,
    @field:Size(max = 5000) val description: String? = null,
    val sortOrder: Int? = null,
)

// ── Responses ────────────────────────────────────────────────────────────────

/** Derived 안건 status for the UI chip. DECIDED only appears once D1b lands decisions. */
enum class SubPlanStatus { EMPTY, IN_PROGRESS, DECIDED }

/** Roadmap node: a 계획 with roll-up counts. `decidedCount` is 0 until D1b. */
data class PlanSummaryResponse(
    val id: Long,
    val title: String,
    val description: String?,
    val status: PlanStatus,
    val canvasX: Double?,
    val canvasY: Double?,
    val groupLabel: String?,
    val subPlanCount: Int,
    val decidedCount: Int,
    val createdByUserId: Long,
    val createdAt: Instant,
)

data class PlanTreeResponse(
    val id: Long,
    val title: String,
    val description: String?,
    val status: PlanStatus,
    val canvasX: Double?,
    val canvasY: Double?,
    val groupLabel: String?,
    val createdByUserId: Long,
    val createdAt: Instant,
    val subPlans: List<SubPlanResponse>,
)

data class SubPlanResponse(
    val id: Long,
    val title: String,
    val description: String?,
    val sortOrder: Int,
    val canvasX: Double?,
    val canvasY: Double?,
    val status: SubPlanStatus,
    val options: List<OptionResponse>,
    val decision: DecisionResponse?,  // null in D1a; populated in D1b
)

data class OptionResponse(
    val id: Long,
    val title: String,
    val description: String?,
    val sortOrder: Int,
    val avgScore: Double?,            // null until rated (D1b)
    val ratingCount: Int,             // 0 in D1a
    val ratings: List<RatingResponse>, // empty in D1a
)

/** Populated in D1b. Defined now so OptionResponse is stable. */
data class RatingResponse(
    val userId: Long,
    val score: Int,
    val comment: String?,
)

/** Populated in D1b. Defined now so SubPlanResponse is stable. */
data class DecisionResponse(
    val id: Long,
    val chosenOptionId: Long,
    val reason: String,
    val decidedByUserId: Long,
    val decidedAt: Instant,
)

data class PlanEventResponse(
    val id: Long,
    val planId: Long,
    val subPlanId: Long?,
    val type: PlanEventType,
    val actorUserId: Long,
    val payload: Map<String, Any?>?,
    val createdAt: Instant,
)
```

- [ ] **Step 2: Verify compilation**

Run: `./gradlew compileKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt
git commit -m "feat(decisions): request/response DTOs (D1a)"
```

---

### Task 6: PlanEventRecorder

**Files:**
- Create: `src/main/kotlin/com/shareddocs/backend/decision/PlanEventRecorder.kt`
- Test: `src/test/kotlin/com/shareddocs/backend/decision/PlanEventRecorderTest.kt`

A thin component that serializes a label map to JSON and appends one `PlanEvent`. Injected into PlanService (and DecisionService in D1b) so event-writing lives in one place.

- [ ] **Step 1: Write the failing test**

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import com.shareddocs.backend.workspace.WorkspaceService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PlanEventRecorderTest(
    @Autowired private val recorder: PlanEventRecorder,
    @Autowired private val events: PlanEventRepository,
    @Autowired private val plans: PlanRepository,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
) {
    private fun newUser() = userRepository.save(
        User(email = "u-${java.util.UUID.randomUUID()}@test.example", name = "U", role = Role.USER),
    )

    @Test
    fun `record persists an event with a serialized payload`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = plans.save(Plan(workspaceId = ws.id!!, title = "P", createdByUserId = owner.id!!))

        recorder.record(
            workspaceId = ws.id!!,
            planId = plan.id!!,
            subPlanId = null,
            type = PlanEventType.PLAN_CREATED,
            actorUserId = owner.id!!,
            payload = mapOf("title" to "P"),
        )

        val saved = events.findAllByPlanIdOrderByCreatedAtDesc(plan.id!!)
        assertEquals(1, saved.size)
        assertEquals(PlanEventType.PLAN_CREATED, saved[0].type)
        assertNotNull(saved[0].createdAt)
        assertEquals("""{"title":"P"}""", saved[0].payload)
    }

    @Test
    fun `record stores null payload for an empty map`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = plans.save(Plan(workspaceId = ws.id!!, title = "P", createdByUserId = owner.id!!))

        recorder.record(ws.id!!, plan.id!!, null, PlanEventType.PLAN_CREATED, owner.id!!)

        assertEquals(null, events.findAllByPlanIdOrderByCreatedAtDesc(plan.id!!)[0].payload)
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.PlanEventRecorderTest"`
Expected: FAIL — `PlanEventRecorder` does not exist (compilation error).

- [ ] **Step 3: Write the recorder**

```kotlin
package com.shareddocs.backend.decision

import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.stereotype.Component

/**
 * Single place that appends a [PlanEvent]. Callers pass a small label map (e.g.
 * the 안건/선택지 title) that is serialized to JSON so the timeline renders without
 * extra joins. An empty map stores null (no payload). Runs inside the caller's
 * transaction — the event commits with the mutation or not at all.
 */
@Component
class PlanEventRecorder(
    private val repository: PlanEventRepository,
    private val objectMapper: ObjectMapper,
) {
    fun record(
        workspaceId: Long,
        planId: Long,
        subPlanId: Long?,
        type: PlanEventType,
        actorUserId: Long,
        payload: Map<String, Any?> = emptyMap(),
    ) {
        repository.save(
            PlanEvent(
                workspaceId = workspaceId,
                planId = planId,
                subPlanId = subPlanId,
                type = type,
                actorUserId = actorUserId,
                payload = if (payload.isEmpty()) null else objectMapper.writeValueAsString(payload),
            ),
        )
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.PlanEventRecorderTest"`
Expected: PASS (2 tests). This is also the first boot of the new entities/repos — confirms Hibernate `validate` accepts them and the derived queries are valid.

- [ ] **Step 5: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/PlanEventRecorder.kt src/test/kotlin/com/shareddocs/backend/decision/PlanEventRecorderTest.kt
git commit -m "feat(decisions): PlanEventRecorder + test (D1a)"
```

---

### Task 7: PlanService — create + list + PLAN_CREATED event

**Files:**
- Create: `src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt`
- Test: `src/test/kotlin/com/shareddocs/backend/decision/PlanServiceTest.kt`

PlanService owns the whole plan-tree aggregate (plan + 안건 + 선택지 structural ops + tree read). It takes `workspaceId` + `actorUserId` (resolved in the controller from `@CurrentWorkspace`/principal). This task adds `create` and `list`; later tasks extend the same class.

- [ ] **Step 1: Write the failing test**

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import com.shareddocs.backend.workspace.WorkspaceService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PlanServiceTest(
    @Autowired private val service: PlanService,
    @Autowired private val events: PlanEventRepository,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
) {
    private fun newUser() = userRepository.save(
        User(email = "u-${java.util.UUID.randomUUID()}@test.example", name = "U", role = Role.USER),
    )

    @Test
    fun `create persists a plan and records a PLAN_CREATED event`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")

        val created = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "첫 집 구하기"))

        assertEquals("첫 집 구하기", created.title)
        assertEquals(PlanStatus.ACTIVE, created.status)
        assertEquals(0, created.subPlanCount)
        assertEquals(0, created.decidedCount)

        val log = events.findAllByPlanIdOrderByCreatedAtDesc(created.id)
        assertEquals(1, log.size)
        assertEquals(PlanEventType.PLAN_CREATED, log[0].type)
        assertEquals(owner.id, log[0].actorUserId)
    }

    @Test
    fun `list returns this workspace's plans newest-first and not other workspaces'`() {
        val owner = newUser()
        val wsA = workspaces.create(owner.id!!, "A", "a")
        val wsB = workspaces.create(owner.id!!, "B", "b")
        service.create(wsA.id!!, owner.id!!, CreatePlanRequest(title = "A-1"))
        service.create(wsA.id!!, owner.id!!, CreatePlanRequest(title = "A-2"))
        service.create(wsB.id!!, owner.id!!, CreatePlanRequest(title = "B-1"))

        val listA = service.list(wsA.id!!)
        assertEquals(listOf("A-2", "A-1"), listA.map { it.title }) // newest first
        assertTrue(listA.all { it.subPlanCount == 0 })

        val listB = service.list(wsB.id!!)
        assertEquals(listOf("B-1"), listB.map { it.title })
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.PlanServiceTest"`
Expected: FAIL — `PlanService` does not exist.

- [ ] **Step 3: Write the minimal PlanService**

```kotlin
package com.shareddocs.backend.decision

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * The 계획 aggregate service — plan + 안건 + 선택지 structural CRUD and the plan-tree
 * read. Workspace scoping is the caller's responsibility to PASS (controllers get
 * the workspace from @CurrentWorkspace, which the filter already proved membership
 * for); every lookup here is additionally scoped by workspaceId so a foreign id
 * 404s. Structural mutations append a PlanEvent in the same transaction.
 */
@Service
@Transactional
class PlanService(
    private val planRepository: PlanRepository,
    private val subPlanRepository: SubPlanRepository,
    private val optionRepository: OptionRepository,
    private val events: PlanEventRecorder,
) {
    fun create(workspaceId: Long, actorUserId: Long, request: CreatePlanRequest): PlanSummaryResponse {
        val plan = planRepository.save(
            Plan(
                workspaceId = workspaceId,
                title = request.title.trim(),
                description = request.description?.trim(),
                createdByUserId = actorUserId,
            ),
        )
        events.record(
            workspaceId = workspaceId,
            planId = plan.id!!,
            subPlanId = null,
            type = PlanEventType.PLAN_CREATED,
            actorUserId = actorUserId,
            payload = mapOf("title" to plan.title),
        )
        return plan.toSummary(subPlanCount = 0, decidedCount = 0)
    }

    @Transactional(readOnly = true)
    fun list(workspaceId: Long): List<PlanSummaryResponse> =
        planRepository.findAllByWorkspaceIdOrderByCreatedAtDesc(workspaceId).map { plan ->
            val subPlans = subPlanRepository.findAllByPlanIdOrderBySortOrderAscIdAsc(plan.id!!)
            // decidedCount stays 0 until D1b wires decisions into the roll-up.
            plan.toSummary(subPlanCount = subPlans.size, decidedCount = 0)
        }

    private fun Plan.toSummary(subPlanCount: Int, decidedCount: Int) = PlanSummaryResponse(
        id = id!!,
        title = title,
        description = description,
        status = status,
        canvasX = canvasX,
        canvasY = canvasY,
        groupLabel = groupLabel,
        subPlanCount = subPlanCount,
        decidedCount = decidedCount,
        createdByUserId = createdByUserId,
        createdAt = createdAt!!,
    )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.PlanServiceTest"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt src/test/kotlin/com/shareddocs/backend/decision/PlanServiceTest.kt
git commit -m "feat(decisions): PlanService create + list (D1a)"
```

---

### Task 8: PlanService — getById + update + delete-tree

**Files:**
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt`
- Modify: `src/test/kotlin/com/shareddocs/backend/decision/PlanServiceTest.kt`

`getTree` is added in Task 11 (after 안건/선택지 exist). Here: fetch a single plan as a summary, partial update (title/desc/status/canvas/group), and hard delete that removes children in FK-dependency order (events → options → sub_plans → plan; ratings/decisions are empty in D1a but are removed too so the method is correct once D1b lands).

- [ ] **Step 1: Write the failing tests (append to PlanServiceTest)**

```kotlin
    @Test
    fun `getById returns the plan, or 404 for a foreign workspace id`() {
        val owner = newUser()
        val wsA = workspaces.create(owner.id!!, "A", "a")
        val wsB = workspaces.create(owner.id!!, "B", "b")
        val plan = service.create(wsA.id!!, owner.id!!, CreatePlanRequest(title = "A-1"))

        assertEquals("A-1", service.getById(wsA.id!!, plan.id).title)
        org.junit.jupiter.api.Assertions.assertThrows(PlanNotFoundException::class.java) {
            service.getById(wsB.id!!, plan.id) // right id, wrong workspace
        }
    }

    @Test
    fun `update applies only the provided fields`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "old", description = "d"))

        val updated = service.update(
            ws.id!!, plan.id,
            UpdatePlanRequest(title = "new", status = PlanStatus.ARCHIVED, canvasX = 12.0, canvasY = 34.0),
        )
        assertEquals("new", updated.title)
        assertEquals("d", updated.description)               // untouched (null in request)
        assertEquals(PlanStatus.ARCHIVED, updated.status)
        assertEquals(12.0, updated.canvasX)
        assertEquals(34.0, updated.canvasY)
    }

    @Test
    fun `delete removes the plan and is 404 afterwards`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "x"))

        service.delete(ws.id!!, plan.id)

        org.junit.jupiter.api.Assertions.assertThrows(PlanNotFoundException::class.java) {
            service.getById(ws.id!!, plan.id)
        }
        assertTrue(service.list(ws.id!!).isEmpty())
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.PlanServiceTest"`
Expected: FAIL — `getById` / `update` / `delete` unresolved.

- [ ] **Step 3: Add the methods to PlanService**

Add these methods inside the `PlanService` class (and the import is already covered by the package). Insert after `list(...)`:

```kotlin
    @Transactional(readOnly = true)
    fun getById(workspaceId: Long, planId: Long): PlanSummaryResponse {
        val plan = requirePlan(workspaceId, planId)
        val subPlans = subPlanRepository.findAllByPlanIdOrderBySortOrderAscIdAsc(planId)
        return plan.toSummary(subPlanCount = subPlans.size, decidedCount = 0)
    }

    fun update(workspaceId: Long, planId: Long, request: UpdatePlanRequest): PlanSummaryResponse {
        val plan = requirePlan(workspaceId, planId)
        request.title?.let { plan.title = it.trim() }
        request.description?.let { plan.description = it.trim() }
        request.status?.let { plan.status = it }
        request.canvasX?.let { plan.canvasX = it }
        request.canvasY?.let { plan.canvasY = it }
        request.groupLabel?.let { plan.groupLabel = it.trim() }
        val subPlanCount = subPlanRepository.findAllByPlanIdOrderBySortOrderAscIdAsc(planId).size
        return plan.toSummary(subPlanCount = subPlanCount, decidedCount = 0)
    }

    /**
     * Hard-delete the whole tree. FK constraints are ON DELETE RESTRICT, so we
     * remove leaves first: events → options → sub_plans → plan. (ratings/decisions
     * are added in D1b and removed here too once their repos are injected.)
     */
    fun delete(workspaceId: Long, planId: Long) {
        val plan = requirePlan(workspaceId, planId)
        val subPlans = subPlanRepository.findAllByPlanIdOrderBySortOrderAscIdAsc(planId)
        val subPlanIds = subPlans.mapNotNull { it.id }
        if (subPlanIds.isNotEmpty()) {
            optionRepository.deleteAll(optionRepository.findAllBySubPlanIdInOrderBySortOrderAscIdAsc(subPlanIds))
        }
        planEventRepository.deleteAll(planEventRepository.findAllByPlanIdOrderByCreatedAtDesc(planId))
        subPlanRepository.deleteAll(subPlans)
        planRepository.delete(plan)
    }

    private fun requirePlan(workspaceId: Long, planId: Long): Plan =
        planRepository.findByIdAndWorkspaceId(planId, workspaceId) ?: throw PlanNotFoundException()
```

Also add `PlanEventRepository` to the constructor so `delete` can clear the log (events are written via the recorder but deleted directly). Change the constructor to:

```kotlin
class PlanService(
    private val planRepository: PlanRepository,
    private val subPlanRepository: SubPlanRepository,
    private val optionRepository: OptionRepository,
    private val planEventRepository: PlanEventRepository,
    private val events: PlanEventRecorder,
) {
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.PlanServiceTest"`
Expected: PASS (5 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt src/test/kotlin/com/shareddocs/backend/decision/PlanServiceTest.kt
git commit -m "feat(decisions): PlanService getById + update + delete-tree (D1a)"
```

---

### Task 9: PlanService — SubPlan (안건) add/update/delete

**Files:**
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt`
- Test: `src/test/kotlin/com/shareddocs/backend/decision/SubPlanServiceTest.kt`

`addSubPlan` appends after the current max sort_order and records SUBPLAN_ADDED. `updateSubPlan`/`deleteSubPlan` are scoped to workspace + verify the 안건 belongs to the named 계획.

- [ ] **Step 1: Write the failing test**

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import com.shareddocs.backend.workspace.WorkspaceService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SubPlanServiceTest(
    @Autowired private val service: PlanService,
    @Autowired private val events: PlanEventRepository,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
) {
    private fun newUser() = userRepository.save(
        User(email = "u-${java.util.UUID.randomUUID()}@test.example", name = "U", role = Role.USER),
    )

    @Test
    fun `addSubPlan appends in order and records SUBPLAN_ADDED`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))

        val a = service.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "동네"))
        val b = service.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "예산"))

        assertEquals(0, a.sortOrder)
        assertEquals(1, b.sortOrder)
        assertEquals(SubPlanStatus.EMPTY, a.status) // no options yet

        val log = events.findAllByPlanIdOrderByCreatedAtDesc(plan.id)
        assertEquals(PlanEventType.SUBPLAN_ADDED, log[0].type) // newest first
    }

    @Test
    fun `addSubPlan 404s for a plan in another workspace`() {
        val owner = newUser()
        val wsA = workspaces.create(owner.id!!, "A", "a")
        val wsB = workspaces.create(owner.id!!, "B", "b")
        val plan = service.create(wsA.id!!, owner.id!!, CreatePlanRequest(title = "P"))

        assertThrows(PlanNotFoundException::class.java) {
            service.addSubPlan(wsB.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "x"))
        }
    }

    @Test
    fun `update and delete a sub-plan`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val sp = service.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "동네"))

        val updated = service.updateSubPlan(ws.id!!, sp.id, UpdateSubPlanRequest(title = "동네 정하기", canvasX = 5.0))
        assertEquals("동네 정하기", updated.title)
        assertEquals(5.0, updated.canvasX)

        service.deleteSubPlan(ws.id!!, sp.id)
        assertTrue(service.getTree(ws.id!!, plan.id).subPlans.isEmpty())
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.SubPlanServiceTest"`
Expected: FAIL — `addSubPlan`/`updateSubPlan`/`deleteSubPlan`/`getTree` unresolved. (`getTree` is implemented in Task 11; this test compiles only after both tasks — so run it at the end of Task 11. For Task 9, temporarily assert via a direct repo or skip the delete assertion. To keep Task 9 self-contained, replace the last test's final line with the repo-free check below.)

Replace the final assertion in `update and delete a sub-plan` with:
```kotlin
        service.deleteSubPlan(ws.id!!, sp.id)
        assertThrows(SubPlanNotFoundException::class.java) {
            service.updateSubPlan(ws.id!!, sp.id, UpdateSubPlanRequest(title = "gone"))
        }
```

- [ ] **Step 3: Add SubPlan methods to PlanService**

Insert after the plan methods, before `requirePlan`:

```kotlin
    fun addSubPlan(
        workspaceId: Long,
        planId: Long,
        actorUserId: Long,
        request: CreateSubPlanRequest,
    ): SubPlanResponse {
        requirePlan(workspaceId, planId) // 404 if plan absent / wrong workspace
        val nextOrder = subPlanRepository.findAllByPlanIdOrderBySortOrderAscIdAsc(planId)
            .maxOfOrNull { it.sortOrder + 1 } ?: 0
        val subPlan = subPlanRepository.save(
            SubPlan(
                workspaceId = workspaceId,
                planId = planId,
                title = request.title.trim(),
                description = request.description?.trim(),
                sortOrder = nextOrder,
                createdByUserId = actorUserId,
            ),
        )
        events.record(
            workspaceId = workspaceId,
            planId = planId,
            subPlanId = subPlan.id,
            type = PlanEventType.SUBPLAN_ADDED,
            actorUserId = actorUserId,
            payload = mapOf("subPlanTitle" to subPlan.title),
        )
        return subPlan.toResponse(options = emptyList(), decision = null)
    }

    fun updateSubPlan(workspaceId: Long, subPlanId: Long, request: UpdateSubPlanRequest): SubPlanResponse {
        val subPlan = requireSubPlan(workspaceId, subPlanId)
        request.title?.let { subPlan.title = it.trim() }
        request.description?.let { subPlan.description = it.trim() }
        request.sortOrder?.let { subPlan.sortOrder = it }
        request.canvasX?.let { subPlan.canvasX = it }
        request.canvasY?.let { subPlan.canvasY = it }
        val options = optionRepository.findAllBySubPlanIdOrderBySortOrderAscIdAsc(subPlanId)
        return subPlan.toResponse(options = options.map { it.toResponse() }, decision = null)
    }

    fun deleteSubPlan(workspaceId: Long, subPlanId: Long) {
        val subPlan = requireSubPlan(workspaceId, subPlanId)
        optionRepository.deleteAll(optionRepository.findAllBySubPlanIdOrderBySortOrderAscIdAsc(subPlanId))
        subPlanRepository.delete(subPlan)
    }

    private fun requireSubPlan(workspaceId: Long, subPlanId: Long): SubPlan =
        subPlanRepository.findByIdAndWorkspaceId(subPlanId, workspaceId) ?: throw SubPlanNotFoundException()
```

Add these mapping helpers at the bottom of the class (next to `toSummary`):

```kotlin
    /** EMPTY (no 선택지) / IN_PROGRESS / DECIDED. DECIDED is computed in D1b; D1a never returns it. */
    private fun subPlanStatus(optionCount: Int, hasActiveDecision: Boolean): SubPlanStatus = when {
        hasActiveDecision -> SubPlanStatus.DECIDED
        optionCount > 0 -> SubPlanStatus.IN_PROGRESS
        else -> SubPlanStatus.EMPTY
    }

    private fun SubPlan.toResponse(options: List<OptionResponse>, decision: DecisionResponse?) = SubPlanResponse(
        id = id!!,
        title = title,
        description = description,
        sortOrder = sortOrder,
        canvasX = canvasX,
        canvasY = canvasY,
        status = subPlanStatus(optionCount = options.size, hasActiveDecision = decision != null),
        options = options,
        decision = decision,
    )

    private fun Option.toResponse() = OptionResponse(
        id = id!!,
        title = title,
        description = description,
        sortOrder = sortOrder,
        avgScore = null,   // D1b
        ratingCount = 0,   // D1b
        ratings = emptyList(), // D1b
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.SubPlanServiceTest"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt src/test/kotlin/com/shareddocs/backend/decision/SubPlanServiceTest.kt
git commit -m "feat(decisions): PlanService 안건 add/update/delete (D1a)"
```

---

### Task 10: PlanService — Option (선택지) add/update/delete

**Files:**
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt`
- Test: `src/test/kotlin/com/shareddocs/backend/decision/OptionServiceTest.kt`

`addOption` verifies the 안건 belongs to the workspace, appends after max sort_order, records OPTION_ADDED. `updateOption`/`deleteOption` scoped to workspace.

- [ ] **Step 1: Write the failing test**

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import com.shareddocs.backend.workspace.WorkspaceService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class OptionServiceTest(
    @Autowired private val service: PlanService,
    @Autowired private val events: PlanEventRepository,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
) {
    private fun newUser() = userRepository.save(
        User(email = "u-${java.util.UUID.randomUUID()}@test.example", name = "U", role = Role.USER),
    )

    private fun seedSubPlan(): Triple<Long, Long, Long> {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val sp = service.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "동네"))
        return Triple(ws.id!!, sp.id, owner.id!!)
    }

    @Test
    fun `addOption appends in order and records OPTION_ADDED`() {
        val (wsId, subPlanId, actor) = seedSubPlan()

        val a = service.addOption(wsId, subPlanId, actor, CreateOptionRequest(title = "마포"))
        val b = service.addOption(wsId, subPlanId, actor, CreateOptionRequest(title = "판교"))

        assertEquals(0, a.sortOrder)
        assertEquals(1, b.sortOrder)
        assertEquals(null, a.avgScore)
        assertEquals(0, a.ratingCount)

        assertEquals(PlanEventType.OPTION_ADDED, events.findAll().sortedByDescending { it.id }.first().type)
    }

    @Test
    fun `addOption 404s for a sub-plan in another workspace`() {
        val (_, subPlanId, actor) = seedSubPlan()
        val other = newUser()
        val wsOther = workspaces.create(other.id!!, "O", "o")
        assertThrows(SubPlanNotFoundException::class.java) {
            service.addOption(wsOther.id!!, subPlanId, actor, CreateOptionRequest(title = "x"))
        }
    }

    @Test
    fun `update and delete an option`() {
        val (wsId, subPlanId, actor) = seedSubPlan()
        val opt = service.addOption(wsId, subPlanId, actor, CreateOptionRequest(title = "마포"))

        val updated = service.updateOption(wsId, opt.id, UpdateOptionRequest(title = "마포구", sortOrder = 3))
        assertEquals("마포구", updated.title)
        assertEquals(3, updated.sortOrder)

        service.deleteOption(wsId, opt.id)
        assertThrows(OptionNotFoundException::class.java) {
            service.updateOption(wsId, opt.id, UpdateOptionRequest(title = "gone"))
        }
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.OptionServiceTest"`
Expected: FAIL — `addOption`/`updateOption`/`deleteOption` unresolved.

- [ ] **Step 3: Add Option methods to PlanService**

Insert after the SubPlan methods, before `requirePlan`:

```kotlin
    fun addOption(
        workspaceId: Long,
        subPlanId: Long,
        actorUserId: Long,
        request: CreateOptionRequest,
    ): OptionResponse {
        val subPlan = requireSubPlan(workspaceId, subPlanId)
        val nextOrder = optionRepository.findAllBySubPlanIdOrderBySortOrderAscIdAsc(subPlanId)
            .maxOfOrNull { it.sortOrder + 1 } ?: 0
        val option = optionRepository.save(
            Option(
                workspaceId = workspaceId,
                subPlanId = subPlanId,
                title = request.title.trim(),
                description = request.description?.trim(),
                sortOrder = nextOrder,
                createdByUserId = actorUserId,
            ),
        )
        events.record(
            workspaceId = workspaceId,
            planId = subPlan.planId,
            subPlanId = subPlanId,
            type = PlanEventType.OPTION_ADDED,
            actorUserId = actorUserId,
            payload = mapOf("subPlanTitle" to subPlan.title, "optionTitle" to option.title),
        )
        return option.toResponse()
    }

    fun updateOption(workspaceId: Long, optionId: Long, request: UpdateOptionRequest): OptionResponse {
        val option = requireOption(workspaceId, optionId)
        request.title?.let { option.title = it.trim() }
        request.description?.let { option.description = it.trim() }
        request.sortOrder?.let { option.sortOrder = it }
        return option.toResponse()
    }

    fun deleteOption(workspaceId: Long, optionId: Long) {
        val option = requireOption(workspaceId, optionId)
        optionRepository.delete(option)
    }

    private fun requireOption(workspaceId: Long, optionId: Long): Option =
        optionRepository.findByIdAndWorkspaceId(optionId, workspaceId) ?: throw OptionNotFoundException()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.OptionServiceTest"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt src/test/kotlin/com/shareddocs/backend/decision/OptionServiceTest.kt
git commit -m "feat(decisions): PlanService 선택지 add/update/delete (D1a)"
```

---

### Task 11: PlanService — getTree assembly

**Files:**
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt`
- Test: `src/test/kotlin/com/shareddocs/backend/decision/PlanTreeTest.kt`

Assembles the full plan tree in bulk (one query for sub-plans, one for all their options) — no N+1. Decisions/ratings are absent in D1a, so every SubPlan gets `decision = null` and EMPTY/IN_PROGRESS status, options get null aggregate.

- [ ] **Step 1: Write the failing test**

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import com.shareddocs.backend.workspace.WorkspaceService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PlanTreeTest(
    @Autowired private val service: PlanService,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
) {
    private fun newUser() = userRepository.save(
        User(email = "u-${java.util.UUID.randomUUID()}@test.example", name = "U", role = Role.USER),
    )

    @Test
    fun `getTree returns ordered sub-plans with their options and neutral decision fields`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "첫 집"))
        val dong = service.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "동네"))
        val budget = service.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "예산"))
        service.addOption(ws.id!!, dong.id, owner.id!!, CreateOptionRequest(title = "마포"))
        service.addOption(ws.id!!, dong.id, owner.id!!, CreateOptionRequest(title = "판교"))

        val tree = service.getTree(ws.id!!, plan.id)

        assertEquals("첫 집", tree.title)
        assertEquals(listOf("동네", "예산"), tree.subPlans.map { it.title })
        val dongNode = tree.subPlans.first { it.id == dong.id }
        assertEquals(listOf("마포", "판교"), dongNode.options.map { it.title })
        assertEquals(SubPlanStatus.IN_PROGRESS, dongNode.status) // has options, no decision
        assertEquals(null, dongNode.decision)
        assertEquals(null, dongNode.options[0].avgScore)
        val budgetNode = tree.subPlans.first { it.id == budget.id }
        assertEquals(SubPlanStatus.EMPTY, budgetNode.status)     // no options
    }

    @Test
    fun `getTree 404s for a foreign workspace`() {
        val owner = newUser()
        val wsA = workspaces.create(owner.id!!, "A", "a")
        val wsB = workspaces.create(owner.id!!, "B", "b")
        val plan = service.create(wsA.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        assertThrows(PlanNotFoundException::class.java) { service.getTree(wsB.id!!, plan.id) }
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.PlanTreeTest"`
Expected: FAIL — `getTree` unresolved.

- [ ] **Step 3: Add getTree to PlanService**

Insert after `getById`:

```kotlin
    @Transactional(readOnly = true)
    fun getTree(workspaceId: Long, planId: Long): PlanTreeResponse {
        val plan = requirePlan(workspaceId, planId)
        val subPlans = subPlanRepository.findAllByPlanIdOrderBySortOrderAscIdAsc(planId)
        val subPlanIds = subPlans.mapNotNull { it.id }
        // Bulk-load all options for the plan's sub-plans in one query (no N+1).
        val optionsBySubPlan = if (subPlanIds.isEmpty()) {
            emptyMap()
        } else {
            optionRepository.findAllBySubPlanIdInOrderBySortOrderAscIdAsc(subPlanIds)
                .groupBy { it.subPlanId }
        }
        val subPlanResponses = subPlans.map { sp ->
            val options = (optionsBySubPlan[sp.id] ?: emptyList()).map { it.toResponse() }
            // D1a: no decisions exist yet → decision = null, never DECIDED.
            sp.toResponse(options = options, decision = null)
        }
        return PlanTreeResponse(
            id = plan.id!!,
            title = plan.title,
            description = plan.description,
            status = plan.status,
            canvasX = plan.canvasX,
            canvasY = plan.canvasY,
            groupLabel = plan.groupLabel,
            createdByUserId = plan.createdByUserId,
            createdAt = plan.createdAt!!,
            subPlans = subPlanResponses,
        )
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.PlanTreeTest"`
Expected: PASS (2 tests). Now re-run the full SubPlan test (it referenced `getTree`):
Run: `./gradlew test --tests "com.shareddocs.backend.decision.SubPlanServiceTest"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt src/test/kotlin/com/shareddocs/backend/decision/PlanTreeTest.kt
git commit -m "feat(decisions): PlanService getTree assembly (D1a)"
```

---

### Task 12: Controllers

**Files:**
- Create: `src/main/kotlin/com/shareddocs/backend/decision/PlanController.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/decision/SubPlanController.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/decision/OptionController.kt`

These are workspace-scoped resources, so they use `@CurrentWorkspace ws: Workspace` (the filter guarantees the caller is a member) and `@AuthenticationPrincipal me: AppPrincipal` for the actor id. No service-side membership re-check is needed (unlike invitation/member controllers, which key off a path id because the invitee/owner ops aren't themselves workspace-header-scoped).

- [ ] **Step 1: Write PlanController**

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.auth.AppPrincipal
import com.shareddocs.backend.workspace.CurrentWorkspace
import com.shareddocs.backend.workspace.Workspace
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * 계획 (Plan) endpoints — the workspace roadmap + a single plan's tree. Scoped to
 * the active workspace via @CurrentWorkspace (membership already enforced by the
 * filter); the actor for audit events comes from @AuthenticationPrincipal.
 */
@RestController
@RequestMapping("/api/plans")
class PlanController(
    private val service: PlanService,
) {
    @GetMapping
    fun list(@CurrentWorkspace ws: Workspace): List<PlanSummaryResponse> =
        service.list(ws.id!!)

    @PostMapping
    fun create(
        @CurrentWorkspace ws: Workspace,
        @AuthenticationPrincipal me: AppPrincipal,
        @Valid @RequestBody request: CreatePlanRequest,
    ): ResponseEntity<PlanSummaryResponse> =
        ResponseEntity.status(HttpStatus.CREATED).body(service.create(ws.id!!, me.userId, request))

    @GetMapping("/{planId}")
    fun tree(@CurrentWorkspace ws: Workspace, @PathVariable planId: Long): PlanTreeResponse =
        service.getTree(ws.id!!, planId)

    @PatchMapping("/{planId}")
    fun update(
        @CurrentWorkspace ws: Workspace,
        @PathVariable planId: Long,
        @Valid @RequestBody request: UpdatePlanRequest,
    ): PlanSummaryResponse = service.update(ws.id!!, planId, request)

    @DeleteMapping("/{planId}")
    fun delete(@CurrentWorkspace ws: Workspace, @PathVariable planId: Long): ResponseEntity<Void> {
        service.delete(ws.id!!, planId)
        return ResponseEntity.noContent().build()
    }

    @PostMapping("/{planId}/subplans")
    fun addSubPlan(
        @CurrentWorkspace ws: Workspace,
        @AuthenticationPrincipal me: AppPrincipal,
        @PathVariable planId: Long,
        @Valid @RequestBody request: CreateSubPlanRequest,
    ): ResponseEntity<SubPlanResponse> =
        ResponseEntity.status(HttpStatus.CREATED).body(service.addSubPlan(ws.id!!, planId, me.userId, request))
}
```

- [ ] **Step 2: Write SubPlanController**

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.auth.AppPrincipal
import com.shareddocs.backend.workspace.CurrentWorkspace
import com.shareddocs.backend.workspace.Workspace
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/** 안건 (SubPlan) endpoints. Add-option lives here since options hang off a 안건. */
@RestController
@RequestMapping("/api/subplans")
class SubPlanController(
    private val service: PlanService,
) {
    @PatchMapping("/{subPlanId}")
    fun update(
        @CurrentWorkspace ws: Workspace,
        @PathVariable subPlanId: Long,
        @Valid @RequestBody request: UpdateSubPlanRequest,
    ): SubPlanResponse = service.updateSubPlan(ws.id!!, subPlanId, request)

    @DeleteMapping("/{subPlanId}")
    fun delete(@CurrentWorkspace ws: Workspace, @PathVariable subPlanId: Long): ResponseEntity<Void> {
        service.deleteSubPlan(ws.id!!, subPlanId)
        return ResponseEntity.noContent().build()
    }

    @PostMapping("/{subPlanId}/options")
    fun addOption(
        @CurrentWorkspace ws: Workspace,
        @AuthenticationPrincipal me: AppPrincipal,
        @PathVariable subPlanId: Long,
        @Valid @RequestBody request: CreateOptionRequest,
    ): ResponseEntity<OptionResponse> =
        ResponseEntity.status(HttpStatus.CREATED).body(service.addOption(ws.id!!, subPlanId, me.userId, request))
}
```

- [ ] **Step 3: Write OptionController**

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.workspace.CurrentWorkspace
import com.shareddocs.backend.workspace.Workspace
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/** 선택지 (Option) edit/delete. Creation is under /api/subplans/{id}/options; rating endpoints arrive in D1b. */
@RestController
@RequestMapping("/api/options")
class OptionController(
    private val service: PlanService,
) {
    @PatchMapping("/{optionId}")
    fun update(
        @CurrentWorkspace ws: Workspace,
        @PathVariable optionId: Long,
        @Valid @RequestBody request: UpdateOptionRequest,
    ): OptionResponse = service.updateOption(ws.id!!, optionId, request)

    @DeleteMapping("/{optionId}")
    fun delete(@CurrentWorkspace ws: Workspace, @PathVariable optionId: Long): ResponseEntity<Void> {
        service.deleteOption(ws.id!!, optionId)
        return ResponseEntity.noContent().build()
    }
}
```

- [ ] **Step 4: Verify compilation**

Run: `./gradlew compileKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/PlanController.kt src/main/kotlin/com/shareddocs/backend/decision/SubPlanController.kt src/main/kotlin/com/shareddocs/backend/decision/OptionController.kt
git commit -m "feat(decisions): Plan/SubPlan/Option REST controllers (D1a)"
```

---

### Task 13: Full build green + final commit

**Files:** none (verification).

- [ ] **Step 1: Run the full build (all tests + validate)**

Run: `./gradlew build`
Expected: BUILD SUCCESSFUL. All pre-existing tests (workspace/invitation/etc.) plus the new decision tests (`PlanEventRecorderTest`, `PlanServiceTest`, `SubPlanServiceTest`, `OptionServiceTest`, `PlanTreeTest`) pass. Hibernate `validate` confirms all entities (incl. the four new ones) match the V15 schema.

- [ ] **Step 2: Confirm clean working tree**

Run: `git status`
Expected: nothing to commit, working tree clean (everything was committed per-task). If anything is uncommitted, add + commit it with an appropriate message.

- [ ] **Step 3: Report**

D1a backend complete: the 계획/안건/선택지 tree CRUD is workspace-scoped, every structural mutation writes a PlanEvent, and the full decision schema (incl. the ratings/decisions tables) exists for D1b. Next: **D1b** (OptionRating + Decision entities/services/endpoints, DECISION_* events, timeline + feed, rating aggregate populating the now-defaulted DTO fields), then **D1-frontend** (plain non-canvas CRUD UI), then the canvas phases D2–D4.

---

## Self-Review

**Spec coverage (against `shared-docs/docs/plans/2026-06-08-decisions-canvas-design.md`):**
- §4 entities Plan/SubPlan/Option/PlanEvent → Task 2; OptionRating/Decision tables created (Task 1) but entities deferred to D1b (scope boundary, stated). ✓
- §4 nullable canvas positions → present on Plan/SubPlan (Task 2), unused in D1a. ✓
- §4 append-only PlanEvent + same-transaction write → Tasks 5/6 (recorder), exercised in 7/9/10. ✓
- §5 API: GET/POST /api/plans, GET/PATCH/DELETE /api/plans/{id}, POST /api/plans/{id}/subplans, PATCH/DELETE /api/subplans/{id}, POST /api/subplans/{id}/options, PATCH/DELETE /api/options/{id} → Task 12. Rating/decision/timeline/feed endpoints are D1b (scope). ✓
- §7 RFC 7807 typed exceptions, 404 cross-workspace → Task 4, asserted in 8/9/10/11. ✓
- §7 optimistic locking → inherited from BaseEntity @Version (Task 2); collision handling is the existing global handler, no new code. ✓
- §7 workspace isolation tests → present in PlanServiceTest/SubPlanServiceTest/OptionServiceTest/PlanTreeTest. ✓
- §8 D1a = "backend foundation, structural tree" → this whole plan. ✓

**Placeholder scan:** No TBD/TODO. Every code step shows complete code. The only "defaults populated in D1b" items (avgScore/ratingCount/ratings/decision/decidedCount) are real, compilable neutral values, not placeholders.

**Type consistency:** `PlanService` constructor (Task 7 → extended in Task 8 to add `planEventRepository`); method names stable: `create`/`list`/`getById`/`getTree`/`update`/`delete`/`addSubPlan`/`updateSubPlan`/`deleteSubPlan`/`addOption`/`updateOption`/`deleteOption`. Mapping helpers `toSummary`/`SubPlan.toResponse`/`Option.toResponse` defined once (Tasks 7/9). DTO field names match across service returns and controller signatures. Repo method names referenced match Task 3 definitions (`findAllBySubPlanIdInOrderBySortOrderAscIdAsc`, `findByIdAndWorkspaceId`, `findAllByPlanIdOrderByCreatedAtDesc`). `@CurrentWorkspace`/`Workspace`/`AppPrincipal` imports match the pattern reference paths.

> NOTE on Task 8/9 ordering: Task 8's `delete` test and Task 9 both call methods added across tasks; the SubPlan test references `getTree` (Task 11). Per the plan, run `SubPlanServiceTest` to green at the END of Task 11 (noted in Task 11 Step 4). If executing strictly task-by-task, Task 9 uses the repo-free assertion variant given in Task 9 Step 2.
