---
name: Elite Captain
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
  on-surface-variant: '#d4c5ab'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#9c8f78'
  outline-variant: '#504532'
  surface-tint: '#fbbc00'
  primary: '#ffe2ab'
  on-primary: '#402d00'
  primary-container: '#ffbf00'
  on-primary-container: '#6d5000'
  inverse-primary: '#795900'
  secondary: '#4ae176'
  on-secondary: '#003915'
  secondary-container: '#00b954'
  on-secondary-container: '#004119'
  tertiary: '#dbe6fe'
  on-tertiary: '#263143'
  tertiary-container: '#bfcae1'
  on-tertiary-container: '#4a5569'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdfa0'
  primary-fixed-dim: '#fbbc00'
  on-primary-fixed: '#261a00'
  on-primary-fixed-variant: '#5c4300'
  secondary-fixed: '#6bff8f'
  secondary-fixed-dim: '#4ae176'
  on-secondary-fixed: '#002109'
  on-secondary-fixed-variant: '#005321'
  tertiary-fixed: '#d8e3fb'
  tertiary-fixed-dim: '#bcc7de'
  on-tertiary-fixed: '#111c2d'
  on-tertiary-fixed-variant: '#3c475a'
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
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
  body-base:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  data-mono:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.2'
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 16px
  margin: 24px
---

## Brand & Style

The brand personality of this design system is analytical, prestigious, and high-stakes. It targets a demographic of competitive fantasy sports enthusiasts who value data density and professional-grade tools. The UI evokes the feeling of a premium digital "War Room" where strategic decisions are made.

The design style is **Corporate Modern with Glassmorphism influences**. It prioritizes extreme legibility and information hierarchy, using semi-transparent layers and high-contrast accents to differentiate between static data and interactive management tools. The aesthetic balances the excitement of live sports with the precision of a financial dashboard.

## Colors

The palette is anchored in a deep **Accent Navy** and **Charcoal Surface** to provide a sophisticated dark-mode foundation that reduces eye strain during long management sessions. 

- **Primary (Amber/Gold):** Used exclusively for high-priority actions, "Captain" selections, and critical CTAs.
- **Secondary (Performance Green):** Reserved for positive delta indicators, points gained, and upward market trends.
- **Tertiary (Slate Navy):** Used for secondary buttons and subtle structural dividers.
- **Functional Red (Negative):** A sharp #EF4444 is used for injury reports or negative performance stats.

## Typography

This design system utilizes **Inter** for all narrative and structural content to ensure maximum readability at small sizes. **Space Grotesk** is introduced specifically for numerical data, player price tags, and budget tracking to provide a technical, geometric "ticker" feel.

Large display headings should use heavy weights with tight letter spacing. All budget-related figures must be rendered in the monospaced Label font to maintain vertical alignment in lists and tables.

## Layout & Spacing

The system employs a **12-column fluid grid** for desktop and a single-column layout for mobile, utilizing a 4px baseline shift. The spacing rhythm is tight to allow for high data density without feeling cluttered.

- **Margins:** 24px standard margin for container edges.
- **Gutters:** 16px fixed gutters between player cards and stat modules.
- **Modules:** Use 40px (lg) padding for hero sections and 16px (sm) for internal card padding to maximize screen real estate for player stats.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** rather than heavy shadows. 

1. **Base Layer:** The deepest Navy (#020617) acts as the canvas.
2. **Surface Layer:** Cards and modules use a slightly lighter Charcoal (#1E1E1E).
3. **Interactive Layer:** Hover states utilize a subtle gradient (Top: 10% Amber opacity to Bottom: 0%).
4. **Glass Effect:** Overlays and player detail modals use a 12px backdrop blur with a 1px stroke (20% white opacity) to create a "glass" sheet effect over the team lineup.

## Shapes

The shape language is **Soft and precise**. A consistent 0.25rem (4px) radius is used for small elements like checkboxes and small chips, while 0.5rem (8px) is used for standard player cards. This creates a technical, modern aesthetic that feels more organized than fully rounded "pill" systems.

Avoid circular containers except for player avatars/headshots.

## Components

- **Primary Buttons:** High-contrast Gold (#FFBF00) with black text. Use a subtle linear gradient (5% shift) from top to bottom.
- **Player Cards:** Charcoal background with a 1px border. The top border should be color-coded by player role (e.g., Bowler, Batsman).
- **Stat Chips:** Small, dark grey pills with monospaced text. Performance chips (e.g., "Form: 8.5") use Green text for positive values.
- **Budget Ticker:** A sticky header component using Space Grotesk. The numbers should "roll" or animate during transfers.
- **Data Tables:** Zebra-striping is forbidden. Use 1px Slate Navy dividers between rows. 
- **Input Fields:** Dark background with a Gold bottom-border on focus. All labels must be in the uppercase Space Grotesk style.
- **Pitch View:** A stylized, top-down cricket pitch graphic used for team selection, utilizing the navy-to-charcoal gradient rather than realistic green grass to maintain the premium feel.