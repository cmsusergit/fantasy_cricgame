---
name: Elite Broadcast Management
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#bbcabf'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#86948a'
  outline-variant: '#3c4a42'
  surface-tint: '#4edea3'
  primary: '#4edea3'
  on-primary: '#003824'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#006c49'
  secondary: '#adc6ff'
  on-secondary: '#002e6a'
  secondary-container: '#0566d9'
  on-secondary-container: '#e6ecff'
  tertiary: '#ffb95f'
  on-tertiary: '#472a00'
  tertiary-container: '#e29100'
  on-tertiary-container: '#523200'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  h1:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  h2:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.3'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  stat-lg:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.05em
  stat-sm:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.1em
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.15em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 0.25rem
  sm: 0.5rem
  md: 1rem
  lg: 1.5rem
  xl: 2rem
  gutter: 1.5rem
  margin-safe: 2rem
---

## Brand & Style

The design system is engineered to evoke the high-stakes atmosphere of a professional sports broadcast booth combined with the surgical precision of a modern financial dashboard. The brand personality is authoritative, energetic, and elite, catering to users who treat fantasy sports as a tactical discipline rather than a casual pastime.

The visual style is a sophisticated blend of **Glassmorphism** and **Minimalism**. It utilizes translucent layers to create a sense of depth and "heads-up display" (HUD) aesthetics, ensuring that dense statistical data remains digestible. The interface prioritizes high-contrast focal points—such as player performance metrics and real-time scores—against a dark, cinematic backdrop to maintain a premium, television-ready feel.

## Colors

This design system is built on a "Dark Mode First" philosophy to reduce eye strain during long management sessions and to allow vibrant accents to pop.

- **Primary Emerald (#10b981):** Represents the pitch and "go" actions. It is the color of success, growth, and active status.
- **Secondary Sporty Blue (#3b82f6):** Used for interactive elements, links, and secondary data visualizations to provide a cool contrast to the emerald.
- **Gold Accent (#f59e0b):** Reserved strictly for premium features, achievements, and top-tier player rankings to signify prestige.
- **Backgrounds:** A tiered system of Deep Navy (#020617) for the lowest level and Slate (#0f172a) for containers, creating a rich, expansive depth.
- **Stat Scale:** A strict Red-Yellow-Green semantic palette is used for performance indicators, ensuring immediate cognitive recognition of player form.

## Typography

The typography strategy leverages **Inter** for its industrial-grade legibility in complex UI layouts. It handles all functional text, player names, and long-form descriptions. 

To introduce the "technical" feel of a sports ticker, **Space Grotesk** is used exclusively for numerical data, scores, budgets, and labels. Its geometric, near-monospaced construction ensures that numbers align perfectly in lists and tables, allowing users to scan and compare stats with precision. High-level headings should use tight tracking and heavy weights to mimic broadcast graphics.

## Layout & Spacing

The design system employs a **12-column fluid grid** for dashboard views and a tight, modular structure for mobile. The spacing rhythm is based on a 4px atomic unit, ensuring all components align to a consistent vertical and horizontal cadence.

- **Desktop:** 24px (lg) gutters between cards to allow the background depth to breathe.
- **Mobile:** 16px (md) side margins with condensed 8px (sm) gutters to maximize screen real estate for stats.
- **Information Density:** Use compact spacing (xs/sm) within stat-blocks and generous spacing (lg/xl) between major functional sections to maintain a clear visual hierarchy.

## Elevation & Depth

Depth in this design system is achieved through **Glassmorphism and Tonal Layering** rather than traditional drop shadows.

- **Level 1 (Base):** Deep Slate backgrounds.
- **Level 2 (Cards):** Translucent overlays with a 12px backdrop blur and a 1px inner border (white at 10% opacity) to define edges.
- **Level 3 (Active/Pop-over):** Increased transparency with a subtle outer glow using the Primary Emerald or Sporty Blue, suggesting the element is "active" or "live."
- **Visual Separation:** Use "ghost" strokes—ultra-thin 1px lines in muted slate—to separate list items without adding visual bulk.

## Shapes

The shape language is "Professional-Rounded." It avoids the playfulness of hyper-rounded corners in favor of a disciplined, modern look.

- **Standard Elements (Cards, Inputs):** 0.5rem (8px) radius.
- **Large Elements (Modals, Hero sections):** 1rem (16px) radius.
- **Interactive Tags/Chips:** Pill-shaped for maximum distinctness from structural containers.
- **Stat Bars:** Use squared-off ends for a more "metered" and technical appearance, while the outer container remains slightly rounded.

## Components

### Buttons & Inputs
- **Primary Action:** Solid Emerald fill with white text. On hover, apply a subtle 0 0 15px emerald glow.
- **Secondary Action:** Ghost style with a 1px Blue border and blurred background.
- **Inputs:** Darker than the card surface with a 1px border that illuminates in Blue when focused.

### Glass Cards
All content containers must use a backdrop-filter blur. The background color should be a semi-transparent Slate. Header sections within cards should have a subtle bottom divider.

### Stat Bars
Visual indicators for player strength or budget usage must use a segmented bar approach (e.g., 10 distinct blocks). The color transitions from Red to Green based on the value percentage.

### Player Avatars
Avatars are circular, framed by a "performance ring"—a thin circular progress bar that indicates the player's form or health status at a glance.

### Achievement Badges
Utilize the Gold accent color with high-contrast metallic gradients to signify premium milestones or league-winning status.