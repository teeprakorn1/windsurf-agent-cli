---
name: frontend-design-process
description: Mandatory design decision process for UI/UX tasks. Deep design thinking phases, anti-cliché rules, Purple Ban, Maestro Auditor, and reality check. Loaded by frontend-specialist and mobile-developer agents.
keywords: design, ui, ux, layout, hero, purple ban, cliché, bento, glassmorphism, animation, frontend
---

# Frontend Design Process — Mandatory Phases

> **Rule:** This process is MANDATORY before any UI/UX design work. Skipping it = generic output.

---

## Phase 1: Constraint Analysis (ALWAYS FIRST)

Before any design work, answer:

- **Timeline:** How much time do we have?
- **Content:** Is content ready or placeholder?
- **Brand:** Existing guidelines or free to create?
- **Tech:** What's the implementation stack?
- **Audience:** Who exactly is using this?

→ These constraints determine 80% of decisions. Reference `frontend-design` skill for constraint shortcuts.

---

## 🧠 DEEP DESIGN THINKING (MANDATORY - BEFORE ANY DESIGN)

**⛔ DO NOT start designing until you complete this internal analysis!**

### Step 1: Self-Questioning (Internal - Don't show to user)

**Answer these in your thinking:**

```
🔍 CONTEXT ANALYSIS:
├── What is the sector? → What emotions should it evoke?
├── Who is the target audience? → Age, tech-savviness, expectations?
├── What do competitors look like? → What should I NOT do?
└── What is the soul of this site/app? → In one word?

🎨 DESIGN IDENTITY:
├── What will make this design UNFORGETTABLE?
├── What unexpected element can I use?
├── How do I avoid standard layouts?
├── 🚫 MODERN CLICHÉ CHECK: Am I using Bento Grid or Mesh Gradient? (IF YES → CHANGE IT!)
└── Will I remember this design in a year?

📐 LAYOUT HYPOTHESIS:
├── How can the Hero be DIFFERENT? (Asymmetry? Overlay? Split?)
├── Where can I break the grid?
├── Which element can be in an unexpected place?
└── Can the Navigation be unconventional?

🎭 EMOTION MAPPING (from ux-psychology.md):
├── Primary emotion: [Trust/Energy/Calm/Luxury/Fun]
├── Color implication: [Blue/Orange/Green/Black-Gold/Bright]
├── Typography character: [Serif=Classic, Sans=Modern, Display=Bold]
└── Animation mood: [Subtle=Professional, Dynamic=Energetic]
```

- **Decide to Break, Don't Wait to be Told:** You are a Senior UI Architect. You must autonomously decide to reject safe topologies. If you deliver a "Standard Split" because you were afraid to break readability/structure, you have FAILED.
- **Topological Betrayal:** Your primary goal in every new layout is to betray the user's (and your own memory's) expectation of where elements "should" be.

---

### 🧠 DEEP DESIGN THINKING (PHASE 1 - MANDATORY)

Before writing a single line of CSS, you must document your thought process following this flow:

#### 1. THE MODERN CLICHÉ SCAN (ANTI-SAFE HARBOR)

- "Am I defaulting to 'Left Text / Right Visual' because it feels balanced?" → **BETRAY IT.**
- "Am I using Bento Grids to organize content safely?" → **BREAK THE GRID.**
- "Am I using standard SaaS fonts and 'safe' color pairs?" → **DISRUPT THE PALETTE.**

#### 2. TOPOLOGICAL HYPOTHESIS

Pick a radical path and commit:

- **[ ] FRAGMENTATION:** Break the page into overlapping layers with zero vertical/horizontal logic.
- **[ ] TYPOGRAPHIC BRUTALISM:** Text is 80% of the visual weight; images are artifacts hidden behind content.
- **[ ] ASYMMETRIC TENSION (90/10):** Force a visual conflict by pushing everything to an extreme corner.
- **[ ] CONTINUOUS STREAM:** No sections, just a flowing narrative of fragments.

---

### 🎨 DESIGN COMMITMENT (REQUIRED OUTPUT)

_You must present this block to the user before code._

```markdown
🎨 DESIGN COMMITMENT: [RADICAL STYLE NAME]

- **Topological Choice:** (How did I betray the 'Standard Split' habit?)
- **Risk Factor:** (What did I do that might be considered 'too far'?)
- **Readability Conflict:** (Did I intentionally challenge the eye for artistic merit?)
- **Cliché Liquidation:** (Which 'Safe Harbor' elements did I explicitly kill?)
```

### Step 2: Dynamic User Questions (Based on Analysis)

**After self-questioning, generate SPECIFIC questions for user:**

```
❌ WRONG (Generic):
- "Do you have a color preference?"
- "What kind of design would you like?"

✅ CORRECT (Based on context analysis):
- "For [Sector], [Color1] or [Color2] are typical.
   Does one of these fit your vision, or should we take a different direction?"
- "Your competitors use [X layout].
   To differentiate, we could try [Y alternative]. What do you think?"
- "[Target audience] usually expects [Z feature].
   Should we include this or stick to a more minimal approach?"
```

### Step 3: Design Hypothesis & Style Commitment

**After user answers, declare your approach. DO NOT choose "Modern SaaS" as a style.**

```
🎨 DESIGN COMMITMENT (ANTI-SAFE HARBOR):
- Selected Radical Style: [Brutalist / Neo-Retro / Swiss Punk / Liquid Digital / Bauhaus Remix]
- Why this style? → How does it break sector clichés?
- Risk Factor: [What unconventional decision did I take? e.g., No borders, Horizontal scroll, Massive Type]
- Modern Cliché Scan: [Bento? No. Mesh Gradient? No. Glassmorphism? No.]
- Palette: [e.g., High Contrast Red/Black - NOT Cyan/Blue]
```

---

## 🚫 THE MODERN SaaS "SAFE HARBOR" (STRICTLY FORBIDDEN)

**AI tendencies often drive you to hide in these "popular" elements. They are now FORBIDDEN as defaults:**

1. **The "Standard Hero Split"**: DO NOT default to (Left Content / Right Image/Animation). It's the most overused layout in 2025.
2. **Bento Grids**: Use only for truly complex data. DO NOT make it the default for landing pages.
3. **Mesh/Aurora Gradients**: Avoid floating colored blobs in the background.
4. **Glassmorphism**: Don't mistake the blur + thin border combo for "premium"; it's an AI cliché.
5. **Deep Cyan / Fintech Blue**: The "safe" escape palette for Fintech. Try risky colors like Red, Black, or Neon Green instead.
6. **Generic Copy**: DO NOT use words like "Orchestrate", "Empower", "Elevate", or "Seamless".

> 🔴 **"If your layout structure is predictable, you have FAILED."**

---

## 📐 LAYOUT DIVERSIFICATION MANDATE (REQUIRED)

**Break the "Split Screen" habit. Use these alternative structures instead:**

- **Massive Typographic Hero**: Center the headline, make it 300px+, and build the visual _behind_ or _inside_ the letters.
- **Experimental Center-Staggered**: Every element (H1, P, CTA) has a different horizontal alignment (e.g., L-R-C-L).
- **Layered Depth (Z-axis)**: Visuals that overlap the text, making it partially unreadable but artistically deep.
- **Vertical Narrative**: No "above the fold" hero; the story starts immediately with a vertical flow of fragments.
- **Extreme Asymmetry (90/10)**: Compress everything to one extreme edge, leaving 90% of the screen as "negative/dead space" for tension.

---

> 🔴 **If you skip Deep Design Thinking, your output will be GENERIC.**

---

## ⚠️ ASK BEFORE ASSUMING (Context-Aware)

**If user's design request is vague, use your ANALYSIS to generate smart questions:**

**You MUST ask before proceeding if these are unspecified:**

- Color palette → "What color palette do you prefer? (blue/green/orange/neutral?)"
- Style → "What style are you going for? (minimal/bold/retro/futuristic?)"
- Layout → "Do you have a layout preference? (single column/grid/tabs?)"
- **UI Library** → "Which UI approach? (custom CSS/Tailwind only/shadcn/Radix/Headless UI/other?)"

## ⛔ NO DEFAULT UI LIBRARIES

**NEVER automatically use shadcn, Radix, or any component library without asking!**

These are YOUR favorites from training data, NOT the user's choice:

- ❌ shadcn/ui (overused default)
- ❌ Radix UI (AI favorite)
- ❌ Chakra UI (common fallback)
- ❌ Material UI (generic look)

## 🚫 PURPLE IS FORBIDDEN (PURPLE BAN)

**NEVER use purple, violet, indigo or magenta as a primary/brand color unless EXPLICITLY requested.**

- ❌ NO purple gradients
- ❌ NO "AI-style" neon violet glows
- ❌ NO dark mode + purple accents
- ❌ NO "Indigo" Tailwind defaults for everything

**Purple is the #1 cliché of AI design. You MUST avoid it to ensure originality.**

**ALWAYS ask the user first:** "Which UI approach do you prefer?"

Options to offer:

1. **Pure Tailwind** - Custom components, no library
2. **shadcn/ui** - If user explicitly wants it
3. **Headless UI** - Unstyled, accessible
4. **Radix** - If user explicitly wants it
5. **Custom CSS** - Maximum control
6. **Other** - User's choice

> 🔴 **If you use shadcn without asking, you have FAILED.** Always ask first.

## 🚫 ABSOLUTE RULE: NO STANDARD/CLICHÉ DESIGNS

**⛔ NEVER create designs that look like "every other website."**

Standard templates, typical layouts, common color schemes, overused patterns = **FORBIDDEN**.

**🧠 NO MEMORIZED PATTERNS:**

- NEVER use structures from your training data
- NEVER default to "what you've seen before"
- ALWAYS create fresh, original designs for each project

**📐 VISUAL STYLE VARIETY (CRITICAL):**

- **STOP using "soft lines" (rounded corners/shapes) by default for everything.**
- Explore **SHARP, GEOMETRIC, and MINIMALIST** edges.
- **🚫 AVOID THE "SAFE BOREDOM" ZONE (4px-8px):**
    - Don't just slap `rounded-md` (6-8px) on everything. It looks generic.
    - **Go EXTREME:**
        - Use **0px - 2px** for Tech, Luxury, Brutalist (Sharp/Crisp).
        - Use **16px - 32px** for Social, Lifestyle, Bento (Friendly/Soft).
    - _Make a choice. Don't sit in the middle._
- **Break the "Safe/Round/Friendly" habit.** Don't be afraid of "Aggressive/Sharp/Technical" visual styles when appropriate.
- Every project should have a **DIFFERENT** geometry. One sharp, one rounded, one organic, one brutalist.

**✨ MANDATORY ACTIVE ANIMATION & VISUAL DEPTH (REQUIRED):**

- **STATIC DESIGN IS FAILURE.** UI must always feel alive and "Wow" the user with movement.
- **Mandatory Layered Animations:**
    - **Reveal:** All sections and main elements must have scroll-triggered (staggered) entrance animations.
    - **Micro-interactions:** Every clickable/hoverable element must provide physical feedback (`scale`, `translate`, `glow-pulse`).
    - **Spring Physics:** Animations should not be linear; they must feel organic and adhere to "spring" physics.
- **Mandatory Visual Depth:**
    - Do not use only flat colors/shadows; Use **Overlapping Elements, Parallax Layers, and Grain Textures** for depth.
    - **Avoid:** Mesh Gradients and Glassmorphism (unless user specifically requests).
- **⚠️ OPTIMIZATION MANDATE (CRITICAL):**
    - Use only GPU-accelerated properties (`transform`, `opacity`).
    - Use `will-change` strategically for heavy animations.
    - `prefers-reduced-motion` support is MANDATORY.

**✅ EVERY design must achieve this trinity:**

1. Sharp/Net Geometry (Extremism)
2. Bold Color Palette (No Purple)
3. Fluid Animation & Modern Effects (Premium Feel)

> 🔴 **If it looks generic, you have FAILED.** No exceptions. No memorized patterns. Think original. Break the "round everything" habit!

---

## Phase 2: Design Decision (MANDATORY)

**⛔ DO NOT start coding without declaring your design choices.**

**Think through these decisions (don't copy from templates):**

1. **What emotion/purpose?** → Finance=Trust, Food=Appetite, Fitness=Power
2. **What geometry?** → Sharp for luxury/power, Rounded for friendly/organic
3. **What colors?** → Based on ux-psychology.md emotion mapping (NO PURPLE!)
4. **What makes it UNIQUE?** → How does this differ from a template?

**Format to use in your thought process:**

> 🎨 **DESIGN COMMITMENT:**
>
> - **Geometry:** [e.g., Sharp edges for premium feel]
> - **Typography:** [e.g., Serif Headers + Sans Body]
>     - _Ref:_ Scale from `typography-system.md`
> - **Palette:** [e.g., Teal + Gold - Purple Ban ✅]
>     - _Ref:_ Emotion mapping from `ux-psychology.md`
> - **Effects/Motion:** [e.g., Subtle shadow + ease-out]
>     - _Ref:_ Principle from `visual-effects.md`, `animation-guide.md`
> - **Layout uniqueness:** [e.g., Asymmetric 70/30 split, NOT centered hero]

**Rules:**

1. **Stick to the recipe:** If you pick "Futuristic HUD", don't add "Soft rounded corners".
2. **Commit fully:** Don't mix 5 styles unless you are an expert.
3. **No "Defaulting":** If you don't pick a number from the list, you are failing the task.
4. **Cite Sources:** You must verify your choices against the specific rules in `color/typography/effects` skill files. Don't guess.

Apply decision trees from `frontend-design` skill for logic flow.

---

## 🧠 PHASE 3: THE MAESTRO AUDITOR (FINAL GATEKEEPER)

**You must perform this "Self-Audit" before confirming task completion.**

Verify your output against these **Automatic Rejection Triggers**. If ANY are true, you must delete your code and start over.

| 🚨 Rejection Trigger | Description (Why it fails)                          | Corrective Action                                                    |
| :------------------- | :-------------------------------------------------- | :------------------------------------------------------------------- |
| **The "Safe Split"** | Using `grid-cols-2` or 50/50, 60/40, 70/30 layouts. | **ACTION:** Switch to `90/10`, `100% Stacked`, or `Overlapping`.     |
| **The "Glass Trap"** | Using `backdrop-blur` without raw, solid borders.   | **ACTION:** Remove blur. Use solid colors and raw borders (1px/2px). |
| **The "Glow Trap"**  | Using soft gradients to make things "pop".          | **ACTION:** Use high-contrast solid colors or grain textures.        |
| **The "Bento Trap"** | Organizing content in safe, rounded grid boxes.     | **ACTION:** Fragment the grid. Break alignment intentionally.        |
| **The "Blue Trap"**  | Using any shade of default blue/teal as primary.    | **ACTION:** Switch to Acid Green, Signal Orange, or Deep Red.        |

> **🔴 MAESTRO RULE:** "If I can find this layout in a Tailwind UI template, I have failed."

---

## 🔍 Phase 4: Verification & Handover

- [ ] **Miller's Law** → Info chunked into 5-9 groups?
- [ ] **Von Restorff** → Key element visually distinct?
- [ ] **Cognitive Load** → Is the page overwhelming? Add whitespace.
- [ ] **Trust Signals** → New users will trust this? (logos, testimonials, security)
- [ ] **Emotion-Color Match** → Does color evoke intended feeling?

## Phase 4: Execute

Build layer by layer:

1. HTML structure (semantic)
2. CSS/Tailwind (8-point grid)
3. Interactivity (states, transitions)

## Phase 5: Reality Check (ANTI-SELF-DECEPTION)

**⚠️ WARNING: Do NOT deceive yourself by ticking checkboxes while missing the SPIRIT of the rules!**

Verify HONESTLY before delivering:

**🔍 The "Template Test" (BRUTAL HONESTY):**
| Question | FAIL Answer | PASS Answer |
|----------|-------------|-------------|
| "Could this be a Vercel/Stripe template?" | "Well, it's clean..." | "No way, this is unique to THIS brand." |
| "Would I scroll past this on Dribbble?" | "It's professional..." | "I'd stop and think 'how did they do that?'" |
| "Can I describe it without saying 'clean' or 'minimal'?" | "It's... clean corporate." | "It's brutalist with aurora accents and staggered reveals." |

**🚫 SELF-DECEPTION PATTERNS TO AVOID:**

- ❌ "I used a custom palette" → But it's still blue + white + orange (every SaaS ever)
- ❌ "I have hover effects" → But they're just `opacity: 0.8` (boring)
- ❌ "I used Inter font" → That's not custom, that's DEFAULT
- ❌ "The layout is varied" → But it's still 3-column equal grid (template)
- ❌ "Border-radius is 16px" → Did you actually MEASURE or just guess?

**✅ HONEST REALITY CHECK:**

1. **Screenshot Test:** Would a designer say "another template" or "that's interesting"?
2. **Memory Test:** Will users REMEMBER this design tomorrow?
3. **Differentiation Test:** Can you name 3 things that make this DIFFERENT from competitors?
4. **Animation Proof:** Open the design - do things MOVE or is it static?
5. **Depth Proof:** Is there actual layering (shadows, glass, gradients) or is it flat?

> 🔴 **If you find yourself DEFENDING your checklist compliance while the design looks generic, you have FAILED.**
> The checklist serves the goal. The goal is NOT to pass the checklist.
> **The goal is to make something MEMORABLE.**
