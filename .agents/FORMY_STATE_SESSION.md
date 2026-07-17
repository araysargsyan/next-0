# formy-next: State Management & DOM Sync — Session Cheatsheet

> **Date:** July 17, 2026
> **Scope:** Formy component ecosystem — current architecture, public API, open issues
> **Status:** Core implementation complete, pending items listed below
> **History:** Full historical session log archived in `FORMY_STATE_SESSION_OLD.md` (do not read)

---

## 1. What is Formy?

A zero-hydration Server Action form wrapper for Next.js 16 + React 19. Solves the React 19 problem where `form.reset()` fires automatically after every Server Action completion (even on validation errors), wiping user-typed values.

---

## 2. File Structure

```
src/libs/formy/
├── Formy.tsx                          # Main orchestrator ("use client")
├── index.ts                          # Public API — all exports
├── types.ts                          # FormyActionState, FormyProps, FormyErrorProps,
│                                     #   FormyAction, Validators, DynamicInputProps, etc.
├── README.md
├── TECHNICAL.md
├── ANALYSIS.md
├── components/
│   ├── index.ts                      # Barrel: FormyError, FormySubmit, FormySuccess, FormyInput
│   ├── FormyError.tsx                # Field/global error display + client validation registration (memo)
│   ├── FormySubmit.tsx               # Submit button (useFormStatus from react-dom)
│   ├── FormySuccess.tsx              # Conditional success content ("data" in state)
│   ├── FormyRestoreEngine.tsx        # Event delegation on <form>, caches/restores values (dynamic, memo)
│   ├── FormContent/
│   │   ├── index.ts                  # Barrel: re-exports FormContent
│   │   ├── FormContent.tsx           # Submit-time validation orchestrator, wraps FieldsetBarrier + FormElement
│   │   ├── FormElement.tsx           # Renders <Form> (next/form) or <form>; mounts FormyRestoreEngine
│   │   └── FieldsetBarrier.tsx       # Disabled <fieldset> in staticMode, enabled on mount via useLayoutEffect
│   └── FormyInput/
│       ├── index.tsx                 # Pure RSC: renders <input data-formy-input .../>
│       ├── DynamicInput.tsx          # Client wrapper: lazy-loads RestoreInputValue in staticMode
│       └── RestoreInputValue.tsx     # Client: cloneElement to add ref+onChange, caches & restores values
├── contexts/
│   ├── index.ts                      # Barrel: re-exports all 3 contexts
│   ├── FormyContext.ts               # { state, isPending }
│   ├── FormyModeContext.ts           # { staticMode, clearOnSuccess }
│   └── ErrorsContext.tsx             # { store, clearFieldError, registerValidator, runFieldValidation }
├── hooks/
│   ├── index.ts                      # Barrel: re-exports all 4 hooks
│   ├── useFormyActionState.ts        # Wraps useActionState; handles fn vs URL action
│   ├── useFormyErrorStore.ts         # Creates & syncs ErrorsStore from server state
│   ├── useFormyErrors.ts             # Consumer hook: useSyncExternalStore keyed per field
│   └── useFormyState.ts             # Consumer hook: returns { state, isPending } from FormyContext
└── utils/
    ├── createErrorsStore.ts          # Minimal pub/sub store (getSnapshot, setErrors, subscribe)
    ├── renderChildren.ts             # Resolves children: function(state,isPending) or ReactNode
    └── validation.ts                 # runFormValidation: iterates validators, returns hasErrors
```

---

## 3. Architecture Overview

### 3.1. Orchestration Flow (Formy.tsx)

1. `validators` ref — mutable registry of field validators.
2. `useFormyActionState(action, initialState)` → `[state, resolvedAction, isPending]`.
3. `useFormyErrorStore(state, isPending)` → `{ errorsStore, clearFieldError }`.
4. Builds `errorsContextValue` (store + clearFieldError + registerValidator + runFieldValidation).
5. Fires `onStateChange(state)` via `useEffect`.
6. Renders three nested context providers → `FormContent` → `renderChildren`.

### 3.2. Three Contexts

| Context | Value | Consumed by |
|:---|:---|:---|
| `FormyContext` | `{ state, isPending }` | `FormySuccess`, `FormyRestoreEngine`, `RestoreInputValue`, `useFormyState` |
| `FormyModeContext` | `{ staticMode, clearOnSuccess }` | `FormyRestoreEngine`, `RestoreInputValue`, `DynamicInput`, `FieldsetBarrier` |
| `ErrorsContext` | `{ store, clearFieldError, registerValidator, runFieldValidation }` | `useFormyErrors` → `FormyError`, `FormyRestoreEngine`, `RestoreInputValue` |

### 3.3. Two Modes (`staticMode` prop, default `true`)

- **staticMode=true**: Inputs are RSC. `FieldsetBarrier` wraps form in disabled `<fieldset>` (enabled on hydration via `useLayoutEffect`). `FormyRestoreEngine` handles event delegation and DOM restoration.
- **staticMode=false**: Standard client-side form. No FieldsetBarrier, no RestoreEngine. Inputs need explicit client-side handling.

### 3.4. Dual Value-Restoration Strategies

Two parallel restoration mechanisms exist in the codebase:

1. **FormyRestoreEngine** (form-level): Single `input`/`change` listener on `<form>` via event delegation. Caches all `[data-formy-input]` element values into a `Map<string, string>`. Restores via `useLayoutEffect([state])`. Dynamically imported in `FormElement.tsx`, wrapped in `memo()`.

2. **RestoreInputValue** (per-input): `cloneElement` injects `ref` + `onChange` onto a single `<input>`. Caches value in `useRef<string | null>`. Restores via `useLayoutEffect([state, clearOnSuccess, type])`. Lazy-loaded via `DynamicInput` with `until(3000)` delay.

### 3.5. Error Management

- **Store**: `createErrorsStore` — minimal pub/sub compatible with `useSyncExternalStore`.
- **Sync**: `useFormyErrorStore` normalizes server state → store. Strings become `{ __global__: error }`. Errors cleared during `isPending`.
- **Consumption**: `useFormyErrors(key)` — per-field subscription. Only the `FormyError` for a specific field re-renders when that field's error changes.
- **Clearing**: `clearFieldError(name)` — removes field error (or `__global__` if it exists) on user input.

### 3.6. Validation

- **Registration**: `FormyError` calls `registerValidator(field, validateFn, setErrorFn)` on mount.
- **Field-level** (live): `runFieldValidation(name, value)` called from `FormyRestoreEngine` and `RestoreInputValue` on every input/change event.
- **Submit-time**: `FormContent.handleSubmit` calls `runFormValidation(validators, getValue)`. If errors → `e.preventDefault()`, Server Action is NOT called.
- **Priority**: Client errors (`clientError` in FormyError) take precedence over server errors.

### 3.7. FormyInput — Pure RSC

`FormyInput` (in `FormyInput/index.tsx`) has **no `"use client"` directive**. It renders:
```tsx
<input data-formy-input name={name} {...props} />
```
The `data-formy-input` attribute is the coordination marker for `FormyRestoreEngine` event delegation. Zero client JS.

---

## 4. Key Architectural Decisions

1. **RSC-first inputs**: `FormyInput` is a pure Server Component. Zero JS hydration for field layouts.
2. **FieldsetBarrier pattern**: Disabled `<fieldset style="display:contents">` prevents interaction before hydration. `useLayoutEffect` enables it — zero visual flicker.
3. **External store with useSyncExternalStore**: Per-field key scoping means surgical re-renders (only the affected `FormyError` re-renders).
4. **Action type polymorphism**: `useFormyActionState` handles both string (URL) and function (Server Action) actions. Guards against type changes during lifecycle.
5. **Error state normalization**: String errors → `{ __global__: error }`, object errors used as-is, cleared during pending.
6. **Validators registered by FormyError (not inputs)**: Validation logic co-located with error display. Declarative pattern.
7. **Discriminated union for FormyActionState**: `{ error }` or `{ data }` — no `success` boolean. Checked via `"data" in state`.
8. **Render-prop children**: `Formy` and `FormyError` both accept `ReactNode | function`.
9. **Dynamic import for FormyRestoreEngine**: Loaded via `next/dynamic` in `FormElement.tsx`, wrapped in `memo()`.
10. **clearOnSuccess**: When server returns `{ data }` and `clearOnSuccess=true`, cached values are cleared, allowing React's natural form reset.
11. **0-dependency**: No Zustand, no external state library. Everything is internal.
12. **FormySubmit uses useFormStatus**: Makes the button universally reusable outside `<Formy>`.

---

## 5. Public API (index.ts)

```typescript
export { default } from "./Formy";           // Default: Formy component
export type { FormyAction } from "./types";  // Type: action signature
export { useFormyErrors, useFormyState } from "./hooks";
export { FormyError, FormySubmit, FormySuccess, FormyInput } from "./components";
```

**Not exported**: `useFormyActionState`, `useFormyErrorStore`, `createErrorsStore`, `renderChildren`, `runFormValidation`, `DynamicInput`, `RestoreInputValue`, `FormContent`, `FormElement`, `FieldsetBarrier`, all contexts, all internal types except `FormyAction`.

---

## 6. Current Form IDs in Use

| Form | `id` prop | File |
|:---|:---|:---|
| Login | `login-form` | `src/components/Forms/LoginForm/index.tsx` |
| Image Upload | `image-upload-form` | `src/components/Forms/ImageUploadForm.tsx` |

---

## 7. Current TODO List (as of July 17, 2026)

### 🔴 High Priority

- [ ] **17.1. Radio buttons can silently revert to a stale selection:**
  Each radio instance has its own `value` ref. The restore `useLayoutEffect` fires on every `state` change and re-asserts `el.checked = el.value === value.current`. DOM assignment order determines winner — can silently restore stale selection.

### 🟡 Medium Priority

- [ ] **17.2. `FormySubmit` `disabled` prop overwrite:**
  `{...props}` spread after `disabled={isPending || props.disabled}` overwrites computed value. Consumer passing `disabled={false}` allows double-submits while pending.

- [ ] **17.3. `FormyActionState` type not exported:**
  `index.ts` exports `FormyAction` but not `FormyActionState`. README examples produce `TS2305` compile error.

- [ ] **17.4. `useFormyState` guard is dead code:**
  `FormyContext` has non-null default; `if (!ctx) throw` can never fire. Silently returns defaults outside `<Formy>` instead of throwing, unlike `useFormyErrors`.

### 🟢 Low Priority / Future

- [ ] **Async `validate` support:**
  Extend `validate` prop to `(value: string) => string | null | Promise<string | null>`. Requires AbortController, async submit pipeline, per-field loading state, built-in debounce.

- [ ] **17.5. Minor issues:**
  - `useFormyState` exported but undocumented in README API Reference.
  - `FormyError`'s `else if (!field)` branch is unreachable (`field` defaults to `'__global__'`).

- [ ] **DynamicInput / RestoreInputValue — architectural fate:**
  These per-input client wrappers (`cloneElement` + `useRef` cache) exist in parallel with the form-level `FormyRestoreEngine` (event delegation + `Map` cache). Need to decide: remove them entirely (FormyRestoreEngine covers everything), keep as an opt-in alternative, or merge approaches.

- [ ] **Рефакторинг FormyRestoreEngine на Reset-Interception:**
  Переписать `FormyRestoreEngine.tsx` на легковесный перехват события `reset` (`preventDefault` + `isTrusted` + `allowReset` флаг). Изменение полностью изолировано внутри логики сброса и не ломает публичный API/инпуты.

- [ ] **`until(3000)` debug delay in DynamicInput.tsx:**
  The artificial 3-second delay in the dynamic import is still present. Needs removal before production/NPM release.

---

*Last updated: July 17, 2026*

---

## 8. Reset-Interception vs. Value-Restoration (Сравнительный анализ)

В ходе технической дискуссии от 17 июля 2026 г. был исследован альтернативный легковесный подход к предотвращению автоматического сброса формы React 19.

### 8.1. Суть альтернативного подхода (Reset-Interception)
Метод основывается на перехвате события `reset` на форме и отмене его стандартного поведения:
1. **Перехват авто-сброса React**: 
   ```typescript
   form.addEventListener("reset", (e) => {
       if (!e.isTrusted) e.preventDefault();
   });
   ```
   Проверка `!e.isTrusted` позволяет отсечь программные события сброса от React 19 (у которых `isTrusted === false`), сохраняя при этом работоспособность стандартных пользовательских кнопок очистки формы `<button type="reset">` (у них `isTrusted === true`).
2. **Программный сброс при успехе**: 
   Для штатной очистки формы при успешной отправке (когда `clearOnSuccess === true`) вызывается нативный метод прототипа, который не вызывает событие `reset` повторно в некоторых браузерах или обходит блокировку:
   ```typescript
   HTMLFormElement.prototype.reset.call(form);
   ```
3. **Защита от гонок состояний**:
   Проблема быстрого ввода во время сетевого запроса решается блокировкой всей формы через `<fieldset disabled={isPending}>`.

### 8.2. Сравнение подходов

| Критерий | Текущий подход Formy (Value-Restoration) | Альтернативный подход (Reset-Interception) |
| :--- | :--- | :--- |
| **Сложность кода** | **Высокая**. Требует парсинга всех типов DOM-узлов (радио, чекбоксы, файлы) и их ручного заполнения в [FormyRestoreEngine.tsx](file:///C:/Users/arays/Documents/Projects/next-0/src/libs/formy/components/FormyRestoreEngine.tsx). | **Минимальная**. Буквально несколько строк кода для отмены события. DOM сохраняет значения нативно. |
| **Производительность** | **Средняя**. Слушает события `input` и `change` на каждое нажатие клавиши, хранит данные в `Map`. | **Максимальная**. Ноль дополнительных слушателей ввода, ноль затрат памяти на хранение значений. |
| **Работа с File-инпутами** | Сложная логика с `DataTransfer` для повторной инициализации файлов. | Нативное сохранение файлов в инпуте (браузер просто не сбрасывает их). |
| **Клиентские компоненты (`staticMode=false`)** | Полная поддержка. Контролируемые компоненты восстанавливают стейт корректно. | **Не работает**. Клиентские стейты кастомных компонентов (Shadcn/Radix) сбросятся независимо от `preventDefault()` на DOM. |
| **Надежность спецификации** | **Максимальная**. Использует легальный `useLayoutEffect` после коммита стейта React. | **Средняя (хак)**. Поведение `requestFormReset` в React 19 не имеет официального API для отключения, логика может измениться в патчах. |

### 8.3. Снятие технических возражений по Reset-Interception
В ходе обсуждения были опровергнуты первоначальные возражения против использования `preventDefault()` на событии `reset`:
1. **Проблема `formRef`**: Оркестратор `<Formy>` изначально является клиентским компонентом (`"use client"`), поэтому наличие ссылки на форму не накладывает дополнительных ограничений на серверный статус самих инпутов `<FormyInput>`.
2. **Проблема перезаписи данных с сервера (`defaultValue`)**: Если сервер вернул измененные данные, их можно легко записать в DOM поверх предотвращенного сброса в фазе `useLayoutEffect`, аналогично текущей логике восстановления.
3. **Совместимость с внешними клиентскими библиотеками**: Чтобы сторонние библиотеки (например, Shadcn) могли сбросить свой внутренний стейт по событию `reset` при успешной отправке формы, используется флаг `allowReset`:
   ```typescript
   let allowReset = false;
   form.addEventListener("reset", (e) => {
       if (allowReset) return;
       if (!e.isTrusted) e.preventDefault();
   });
   
   // При успешном сабмите:
   allowReset = true;
   form.reset(); // Вызовет событие reset для всех, но пропустит наш обработчик
   ```

### 8.4. Финальный архитектурный вывод
Альтернативный подход с перехватом события `reset` и проверкой `!e.isTrusted` признан **полностью пригодным, более легковесным и производительным** для работы Formy в режиме чистых RSC-компонентов (`staticMode=true`). 

**Рекомендация по рефакторингу**:
Внедрить гибридный режим в Formy:
* При `staticMode=true` (чистые RSC инпуты) использовать легковесный перехват `reset` + флаг `allowReset` (убирает необходимость в `onChange`/`input` слушателях для кэширования и циклическом восстановлении DOM-дерева в [FormyRestoreEngine.tsx](file:///C:/Users/arays/Documents/Projects/next-0/src/libs/formy/components/FormyRestoreEngine.tsx)).
* При `staticMode=false` (контролируемые клиентские инпуты) использовать стандартную логику кэширования и синхронизации стейта.


