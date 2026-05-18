# Plan V2.7.5 — Dashboard System Hardening

แผนแก้ไขข้อเสีย 14 ข้อของ `aiyu-multi-agent-dashboard` + server-side WS auth migration เรียงตาม priority

---

## Phase 1: Critical Architecture (P0)

### 1.1 ChatPanel Decomposition — Inspector Panels
- **File:** `src/components/chat-panel.tsx`
- **Action:** แยก inspector panels 4 แบบออกเป็น sub-components
  - `src/components/inspector/agent-inspector.tsx`
  - `src/components/inspector/activity-inspector.tsx`
  - `src/components/inspector/interaction-inspector.tsx`
  - `src/components/inspector/log-inspector.tsx`
- **Estimate:** ~400 บรรทัดย้ายออกจาก chat-panel.tsx
- **Verification:** tsc + lint + build

### 1.2 ChatPanel Decomposition — Input Area + Dialogs
- **File:** `src/components/chat-panel.tsx`
- **Action:** แยกส่วน UI ที่เหลือ
  - `src/components/chat-input-area.tsx` — input box, intervention bar
  - `src/components/chat-session-sidebar.tsx` — sidebar tabs, session list, monitor panels
  - `src/components/chat-history-panel.tsx` — history view with date grouping
  - `src/components/new-session-setup.tsx` — empty state + agent/provider select
- **Estimate:** ~500 บรรทัดย้ายออก
- **Verification:** tsc + lint + build + visual check

### 1.3 Inspector States → Discriminated Union
- **File:** `src/components/chat-panel.tsx`
- **Action:** รวม 4 inspector states เป็น 1 state
  ```typescript
  type InspectedItem =
    | { type: "agent"; name: string }
    | { type: "activity"; id: string }
    | { type: "interaction"; data: InteractionData }
    | { type: "log"; data: LogData }
    | null;
  const [inspectedItem, setInspectedItem] = useState<InspectedItem>(null);
  ```
- ลบ `handleInspectAgent`, `handleInspectActivity`, `handleInspectInteraction`, `handleInspectLog` แทนด้วย `setInspectedItem` ตัวเดียว
- **Verification:** tsc + lint + build

### 1.4 Module-level WS Refs → useRef or Store
- **File:** `src/lib/store.ts`
- **Action:** ย้าย module-level mutable refs เข้า Zustand store หรือใช้ `useRef` pattern ที่ปลอดภัยต่อ HMR
  - `wsRef` → store property (ไม่ trigger re-render เพราะใช้ `getState()`)
  - `reconnectAttemptsRef`, `reconnectTimeoutRef`, `intentionalCloseRef`, `closeTimerRef`, `cleanupTimerRef`, `historyLoadedRef` → internal store slice ที่ไม่ expose ผ่าน selector
  - เพิ่ม HMR guard: ถ้า `wsRef` มีค่าแล้วใน `initConnection()` ให้ reuse ไม่ต้องสร้างใหม่
- **Verification:** tsc + lint + build + HMR test (edit file while dev server running)

---

## Phase 2: High — Performance (P1)

### 2.1 Fix `evictOldActivities` — Return Instead of Mutate
- **File:** `src/lib/store.ts`
- **Action:** เปลี่ยน function ให้ return object ใหม่แทนการ mutate ต้นฉบับ
  ```typescript
  function evictOldActivities(activities: Record<string, Activity>): Record<string, Activity> {
    const keys = Object.keys(activities);
    if (keys.length <= MAX_ACTIVITIES) return activities;
    keys.sort((a, b) => ...);
    const cleaned: Record<string, Activity> = {};
    for (let i = keys.length - MAX_ACTIVITIES; i < keys.length; i++) {
      cleaned[keys[i]] = activities[keys[i]];
    }
    return cleaned; // return new object, no mutation
  }
  ```
- Caller: `set(s => ({ activities: evictOldActivities(newActivities) }))`
- **Verification:** unit test + tsc

### 2.2 Debounce `saveChatHistory`
- **File:** `src/lib/store.ts`
- **Action:** แทนที่ `setTimeout(..., 0)` ด้วย debounce helper
  ```typescript
  let saveHistoryTimer: ReturnType<typeof setTimeout> | null = null;
  function debouncedSaveHistory(data: object) {
    if (saveHistoryTimer) clearTimeout(saveHistoryTimer);
    saveHistoryTimer = setTimeout(() => {
      saveChatHistory(data);
      saveHistoryTimer = null;
    }, 500);
  }
  ```
- เรียก `debouncedSaveHistory` แทน `setTimeout(() => saveChatHistory(...), 0)` ทั้ง 5 จุด
- **Verification:** tsc + lint + build

### 2.3 Zustand Shallow Selector for Streaming
- **File:** `src/components/chat-panel.tsx`
- **Action:** แยก `streamingContent` ออกจาก `activities` ใน store
  - เพิ่ม `streamingContent: Record<string, string>` ใน `DashboardState`
  - `chat.token` event → update `streamingContent` แทน activities
  - ChatPanel ใช้ `useWs(s => s.streamingContent)` แยกจาก activities
  - ลด re-render: activities เปลี่ยนเฉพาะ step/complete, streamingContent เปลี่ยนตอน token
- **Verification:** tsc + lint + build + visual streaming test

### 2.4 Merge 4 useMemo Chat Derives → Single Derivation
- **File:** `src/components/chat-panel.tsx`
- **Action:** รวม `chatSessions`, `chatSteps`, `chatCompletions`, `chatUserMsgs` เป็น single useMemo
  ```typescript
  const chatData = useMemo(() => {
    const sessions = {}, steps = [], completions = {}, userMsgs = [];
    for (const [id, activity] of Object.entries(safeActivities)) {
      if (activity.mode !== "chat") continue;
      sessions[id] = { sessionId: id, agentName: activity.agentName, ... };
      // populate steps, completions, userMsgs in same loop
    }
    return { sessions, steps, completions, userMsgs };
  }, [safeActivities]);
  ```
- **Verification:** tsc + lint + build

### 2.5 Deduplicate `filteredSessions` + `historyFilteredSessions`
- **File:** `src/components/chat-panel.tsx`
- **Action:** สร้าง generic filter function
  ```typescript
  const filterSessions = (list: Session[], query: string) =>
    !query ? list : list.filter(s => s.agentName.toLowerCase().includes(query) || ...);
  ```
- ใช้ `filterSessions(sessions, sessionSearch)` และ `filterSessions(sessions, historySearch)`
- **Verification:** tsc + lint

---

## Phase 3: Medium — State Management (P2)

### 3.1 ErrorBoundary ระดับ Section
- **File:** `src/components/chat-panel.tsx`
- **Action:** เพิ่ม `<ErrorBoundary>` รอบส่วนสำคัญ
  - Chat messages area
  - Sidebar (session list + monitor panels)
  - Inspector panels
- สร้าง `src/components/section-error-boundary.tsx` ที่แสดง inline error แทน crash ทั้งหน้า
- **Verification:** tsc + lint + build + manual error trigger test

### 3.2 Unit Tests — Store + Hooks
- **Files:** `src/lib/store.test.ts`, `src/lib/use-chat-messages.test.ts`
- **Action:** เขียน unit tests
  - `evictOldActivities` — กรณี ≤ MAX, > MAX, empty, single
  - `aggregateUsage` — null/null, partial, full
  - `useChatMessages` — empty, single turn, multi-turn, handoff
  - `createNotification` — ID uniqueness
  - WS event handlers — step, complete, chat.token, chat.step, chat.complete
- **Verification:** `npm test` ผ่านทั้งหมด

### 3.3 Inline IIFE JSX → Sub-components
- **File:** `src/components/chat-panel.tsx` + inspector components
- **Action:** แปลง `{inspectedX && (() => { ... })()}` ทั้ง 6 จุดเป็น component ปกติ
  - ย้ายไปอยู่ใน inspector components ที่สร้างใน Phase 1.1 อยู่แล้ว
- **Verification:** tsc + lint + build

---

## Phase 4: Low — Code Quality (P3)

### 4.1 Extract Magic Numbers → Constants
- **File:** `src/lib/store.ts`
- **Action:** สร้าง named constants
  ```typescript
  const MAX_ERRORS = 50;           // replaces slice(-49)
  const MAX_ERRORS_SLICE = 49;     // for .slice(-49)
  ```
- ย้าย `MAX_ACTIVITIES`, `MAX_NOTIFICATIONS`, `MAX_ARRAY_SIZE`, `MAX_STEPS`, `MAX_INPUT_LENGTH` เป็น config block ด้านบนพร้อม doc comment
- **Verification:** tsc + lint

### 4.2 WS Auth: Subprotocol → Initial Auth Message
- **Files:**
  - Dashboard: `src/lib/store.ts` — `getWsProtocols()` → ส่ง `{ type: "auth", token: apiKey }` เป็น message แรกหลัง connect
  - Server: `lib/api/middleware.js` — `wsApiKeyAuth()` เพิ่มตัวเลือก: รับ token จาก query param `?token=` เป็นหลัก (มีอยู่แล้ว)
  - Server: `lib/api/ws.js` — `handleProtocols` ลบ `aiyu-token.*` matching, ใช้ first protocol ธรรมดา
  - Dashboard: `src/lib/store.ts` — `getWsProtocols()` return `undefined` เสมอ, ส่ง auth message ใน `ws.onopen`
- **Migration:** รองรับทั้งเก่า (subprotocol) และใหม่ (query param / auth message) ช่วง transition
- **Verification:** tsc + lint + build + manual WS connect test

### 4.3 useCallback Deps Cleanup
- **File:** `src/components/chat-panel.tsx`
- **Action:**
  - เพิ่ม `/* eslint-disable react-hooks/exhaustive-deps */` comment ที่ `handleInspectAgent` ฯลฯ พร้อมอธิบายว่า `setInspected*` เป็น stable
  - หรือดีกว่า: หลัง Phase 1.3 จะไม่ต้องใช้ callback เหล่านี้แล้ว
- **Verification:** lint

### 4.4 Cache `/api/agents/list` in handleAvatarClick
- **File:** `src/components/chat-panel.tsx`
- **Action:** ใช้ `useRef` cache สำหรับ agent list ที่ดึงมาแล้ว + TTL 30s
  ```typescript
  const agentListCacheRef = useRef<{ data: unknown; ts: number } | null>(null);
  ```
- **Verification:** tsc + lint

---

## Execution Order

```
Phase 1 (P0 — Critical)
  ├── 1.3 Inspector States → Discriminated Union     ← ทำก่อนเพราะ 1.1 ต้องใช้
  ├── 1.1 Inspector Panels → Sub-components
  ├── 1.2 Input Area + Dialogs → Sub-components
  └── 1.4 Module-level WS Refs → Store

Phase 2 (P1 — High)
  ├── 2.1 evictOldActivities return instead of mutate
  ├── 2.2 Debounce saveChatHistory
  ├── 2.3 Streaming shallow selector
  ├── 2.4 Merge 4 useMemo → single derivation
  └── 2.5 Deduplicate session filters

Phase 3 (P2 — Medium)
  ├── 3.1 Section ErrorBoundary
  ├── 3.2 Unit Tests (store + hooks)
  └── 3.3 IIFE JSX → Sub-components

Phase 4 (P3 — Low)
  ├── 4.1 Extract magic numbers
  ├── 4.2 WS Auth migration (dashboard + server)
  ├── 4.3 useCallback deps cleanup
  └── 4.4 Cache /api/agents/list
```

## Quality Gates

| Gate | Requirement |
|------|-------------|
| **Build** | `tsc` 0 errors + `next lint` clean + `next build` passes |
| **Tests** | All existing tests pass + new unit tests for store/hooks |
| **Visual** | No UI regression — chat, sidebar, inspector, monitor ทำงานปกติ |
| **HMR** | Dev server hot-reload ไม่ทำให้ WS connection พัง |
| **Auth** | WS auth ยังทำงานได้ทั้งแบบเก่า (subprotocol) และใหม่ (query param) |

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| ChatPanel refactor ทำให้ state flow พัง | Medium | High | ทำทีละ sub-component + verify ทุกขั้น |
| Streaming selector ทำให้ token หาย | Low | High | เทียบ behavior ก่อน-หลังด้วย manual test |
| WS auth migration ทำให้ client เก่าไม่ต่อได้ | Medium | Critical | รองรับทั้งเก่า+ใหม่ ช่วง transition |
| evictOldActivities return ใหม่ทำให้ state ไม่ sync | Low | Medium | Unit test ครอบคลุมทุกกรณี |

## Version Bump

- Dashboard `package.json` → `2.7.5`
- Dashboard `next.config.js` → `2.7.5`
- Server `package.json` → `2.7.5` (ถ้ามีการแก้ ws.js)
- `ARCHITECTURE.md` → update เมื่อเสร็จทุก phase
