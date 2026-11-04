# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Primary users are NUS School of Computing (SoC) and NUS College (NUSC) undergraduate students. They need to plan their multi-semester degree pathways, track complex academic requirements (including majors, second majors, minors, NUSC modules, and special programs like NUS Overseas Colleges), and share their plans with peers or advisors for review.

## Product Purpose
ModStack is an interactive, visual study planner designed to make complex academic planning and requirement tracking effortless. Success means students can confidently map out their entire degree without rule violations, view clean credit summaries, and easily share/review plans with others.

## Positioning
A lightweight, zero-backend, client-side application specifically engineered to handle the complex, overlapping, and customized degree curriculum rules of NUS SoC and NUS College. It offers a companion admin tool for visual data authoring to keep curriculum data decoupled from core application code.

## Operating Context
Used by students during course registration, matriculation, or academic counseling sessions. It runs directly in the browser (desktop and responsive mobile) and loads requirements dynamically from local files and the NUSMods API.

## Capabilities and Constraints
- **Architecture**: React 19 + TypeScript + Vite + Tailwind CSS.
- **Storage**: Client-side only; plans persist via `localStorage` with no database or account registration.
- **Sharing**: Plan states are fully serialized into a compact URL hash (`#i=<encoded-plan>`) for instant sharing.
- **Data Integration**: Integrates directly with the NUSMods API for course descriptions and prerequisite verification.
- **Data Management**: Independent `admin` tool authors the JSON schemas for majors, second majors, and minors.

## Brand Commitments
- **Name**: ModStack
- **Voice**: Clean, professional, productive, and academically enabling.
- **Privacy**: No user registration or database storage to preserve student privacy and ensure zero-friction onboarding.

## Evidence on Hand
- Fully functional client-side planner app under `src/`.
- Companion admin tool under `admin/` for authoring curriculum configurations.
- Schema validation scripts under `scripts/`.
- Configured JSON schemas for CS, Business Analytics, and various minors under `shared/data/`.
- Pure logic tests verified by the Vitest test suite (`src/lib/` and `shared/`).

## Product Principles
1. **Zero Friction**: No login or setup required. Students get immediate access to the planning canvas.
2. **Accurate Validation**: Keep curriculum rules decoupled in JSON, validating placement and double/triple-counting limits correctly.
3. **Actionable Feedback**: Render requirement checklists and credit tracking dynamically to guide correct placements.
4. **Instant Portability**: Share and load plans via a single, self-contained URL.

## Accessibility & Inclusion
- High contrast and distinct UI states for readable module codes, status badges, and checklist indicators.
- Logical screen reader structure and keyboard-accessible interaction design for planner grids.
