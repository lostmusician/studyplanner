---
name: ModStack
description: A clean, academic study planner for NUS SoC & NUSC students.
colors:
  canvas: "#efeee7"
  paper: "#e1dacd"
  ink: "#141413"
  muted: "#5a5956"
  line: "#c7bfb0"
  accent: "#605c4e"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
  headline:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.35
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.625rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.05em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  "2xl": "24px"
  "3xl": "32px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  "2xl": "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.xl}"
    padding: "6px 12px"
  button-secondary:
    backgroundColor: "rgba(20, 20, 19, 0.1)"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "6px 12px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.xl}"
    padding: "6px 12px"
  card:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.2xl}"
    padding: "12px"
---

# Design System: ModStack

## Overview

**Creative North Star: "The Academic Parchment"**

ModStack is styled as an interactive, highly legible academic parchment. The aesthetic prioritizes density, structure, and readability over dramatic visual flare, creating an atmosphere that feels scholarly, precise, and premium. Layouts are flat and structured, using subtle borders and backgrounds to define boundaries rather than heavy shadows or floating layers.

The visual system is optimized for information density: module check-lists, multi-semester grids, and credit requirements sit compactly on the screen to provide maximum visibility of the student's entire degree journey at a single glance.

**Key Characteristics:**
- Scholarly, low-contrast, and warm color scheme.
- High layout density for complete information scanability.
- Flat visual style with precise borders.
- Tactile interactions with micro-translations and soft transitions.

## Colors

The color palette is derived from natural, scholarly materials: warm paper, stone borders, and dark charcoal inks.

### Primary
- **Charcoal Ink** (#141413): Used for high-contrast primary text, main button fills, and structural borders.

### Neutral
- **Warm Sand** (#efeee7): The primary page background color.
- **Aged Parchment** (#e1dacd): The background color for sections, panels, cards, and modal components.
- **Muted Clay** (#5a5956): Used for secondary labels, helper descriptions, and inactive states.
- **Sandstone Border** (#c7bfb0): The color for borders, grid lines, and dividers.

### Accent
- **Deep Khaki** (#605c4e): Used for focus outlines, active selectors, and subtle visual highlights.

### Named Rules
**The Flat Border Rule.** Layout boundaries are defined using `1px` borders colored in Sandstone Border (#c7bfb0) rather than drop shadows. Contrast is achieved via the difference between Warm Sand (#efeee7) and Aged Parchment (#e1dacd).

## Typography

**Display Font:** system-ui sans-serif
**Body Font:** system-ui sans-serif

The typography hierarchy uses system sans-serif fonts to guarantee performance, readability, and platform integration.

### Hierarchy
- **Display** (Bold, 1.5rem / 24px, 1.2): Used for primary app headers and modal titles.
- **Headline** (Semi-bold, 1.25rem / 20px, 1.25): Used for semester names and primary sections.
- **Title** (Semi-bold, 0.875rem / 14px, 1.25): Used for module titles, category headers, and checklist labels.
- **Body** (Regular, 0.75rem / 12px, 1.35): Used for module details, descriptions, and lists.
- **Label** (Medium, 0.625rem / 10px, 1.2, uppercase): Used for MC counts, status indicators, and buttons.

## Layout

The layout uses a modular, multi-column structure that shifts responsively from desktop to mobile. On desktop, the planner has a 2-column layout: a wide multi-semester grid alongside a sidebar for requirement checklists and summaries.

Spacing follows a tight 4px grid system:
- **Element Gaps:** 12px (md) or 16px (lg).
- **Section Spacing:** 24px (xl) to maximize visibility on vertical screens.

## Elevation & Depth

ModStack is flat-by-default, emphasizing a tactile and grounded sheet-of-paper aesthetic.

### Shadow Vocabulary
- **Soft Glow** (`box-shadow: 0 18px 40px rgba(20, 20, 19, 0.08)`): Used exclusively on dropdown panels, popovers, and modal dialogs to lift them above the main planner sheet.

### Named Rules
**The Restrained Shadow Rule.** Drop shadows are never applied to static cards or grids. They are strictly reserved for temporary floating overlays (dropdowns, modals) to manage temporary visual hierarchy.

## Shapes

Shapes are geometric and precise, utilizing slightly rounded corners to soften the density of the grid layout.

- **Small Radius:** 4px (sm) for small chips, indicators, and badges.
- **Medium Radius:** 8px (md) for buttons, inputs, and dropdown options.
- **Large Radius:** 16px (xl) for individual module cards.
- **Extra Large Radius:** 24px (2xl) for semester grids and dialog containers.
- **Container Radius:** 32px (3xl) for high-level main panels.

## Components

### Buttons
- **Shape:** Rounded-xl (16px radius)
- **Primary:** Charcoal Ink (#141413) background with Warm Sand (#efeee7) text, padding `6px 12px`.
- **Secondary:** Transparent background with `rgba(20, 20, 19, 0.1)` fill and Charcoal Ink (#141413) text.
- **Hover:** Subtle scale down or light highlight.

### Cards / Containers
- **Corner Style:** Rounded-2xl (24px radius) for semester containers; Rounded-xl (16px radius) for module cards.
- **Background:** Aged Parchment (#e1dacd) for cards; white for total MC counts.
- **Border:** Sandstone Border (#c7bfb0) `1px` solid.

### Inputs / Fields
- **Style:** Sandstone Border (#c7bfb0) `1px` solid, background Warm Sand (#efeee7), radius 8px.
- **Focus:** Accent outline Deep Khaki (#605c4e) `2px` solid.

## Do's and Don'ts

### Do:
- **Do** align all grid elements to the 4px horizontal and vertical rhythm.
- **Do** use Aged Parchment (#e1dacd) to distinguish planner sections from the Warm Sand (#efeee7) body.
- **Do** preserve high text contrast against component background fills.

### Don't:
- **Don't** use standard Tailwind blue, red, or green for main interface states; use the custom palette's soft tones or desaturated fills.
- **Don't** add drop shadows to module cards or semester containers.
- **Don't** use text sizes larger than 1.5rem (24px) to preserve screen real estate.
