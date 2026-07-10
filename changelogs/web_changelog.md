# Svelte Web Version Changelog

Detailed record of all changes, fixes, and feature additions applied to the original web application codebase (`/home/user1/game/fantasy_cricmanager/src/`).

---

## 🏆 Match Engine & Award Systems
* **End of Match & Tournament Awards**:
  * Implemented post-match award selections including **Man of the Match**.
  * Added end-of-season tournament-wide awards: **Man of the Tournament (MVP)**, **Best Batsman**, **Best Bowler**, and **Most Catches**.
  * Integrated award displays inside the post-match summary views.

## 🏏 Free Hit Delivery Behavior Fix
* **Correct Free Hit Exclusions**:
  * Fixed a bug in the match simulation logic where players could still be dismissed on a free hit delivery (the ball immediately following a No-Ball).
  * Enforced official ICC rules: a batsman can only be run out, handle the ball, obstruct the field, or hit the ball twice on a free hit. Clean bowled, caught, LBW, and stumped dismissals are blocked.

## 🎨 Theme & Contrast Improvements
* **Light Theme Readability**:
  * Corrected color styling variables in CSS rules to improve font visibility on light background cards.
  * Extracted hardcoded white text definitions and replaced them with dynamic CSS variables to resolve accessibility contrast bugs.
