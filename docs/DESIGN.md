# Interface design

This document describes the structure and conventions of the JETRISE interface as it is built today.

## Principles

- **Forecast and result are separate.** Anything shown before a day is run is a forecast and is labelled as one; settled results appear only in reports and history.
- **Previews never commit.** Simulations, comparisons and proposals change nothing until the player confirms a clearly named action.
- **Costs are disclosed first.** Any action that spends money or creates a commitment shows the price and the commitment before confirmation.
- **Real facts, no decoration.** Cards show actual aircraft, routes and numbers from the career.

## Structure

A sticky top bar holds the airline mark and name, the five destinations, treasury and day, alerts, sound, settings, language and the run-day action.

| Workspace | Purpose | Opens on |
| --- | --- | --- |
| Headquarters | Priorities, forecast, finance, staff, services, growth | Overview |
| Fleet | Aircraft, cabins, amenities, livery, maintenance | Overview |
| Network | Route map, route management, new routes | Map |
| Schedule | Whole-airline timetable and optimizer; per-aircraft hourly chart | Whole airline |
| Strategy | Competition, contracts, market, recovery, campaign, log | Competition |

Workspaces stay mounted once visited, so unsaved drafts and searches survive switching between them during a session. Reloading the page returns to Headquarters with the saved career.

Until the first day has been run, Headquarters shows a short checklist derived from the career's state, with exactly one next action.

## Responsive behaviour

- Below 1240px the navigation wraps to a second row.
- At 760px it becomes a bottom navigation bar that respects the safe area, and the airline name is hidden beside its mark.
- Pages scroll with the document. Only wide charts and tables scroll horizontally inside their own area.

## Visual language

- **Palette.** Midnight navy, ivory and sand surfaces.
- **Primary action.** Amber (`--cta`) with dark text. It does not depend on the airline colour, so contrast is constant.
- **Airline colour.** Chosen per career; used only for identity and selection, never for primary actions.
- **Type.** The system Arial / Segoe UI stack. No remote fonts are loaded.
- **Icons.** Phosphor Icons.
- **Imagery.** The map backdrop and aircraft renders are pre-rendered illustrations. The map is not navigation-grade; only routes and markers are interactive.

Colours and spacing are CSS custom properties in `src/styles.css`.

## Controls

| Need | Convention |
| --- | --- |
| Choosing from a short list | Native `select` |
| Choosing an airport | One combobox searching city, airport name, IATA code or country |
| Numeric input | Slider with a visible value; 15-minute steps for times |
| Transactions and confirmations | Native modal dialog with a title; focus returns to the opener on close |
| Destructive actions | Confirmation dialog with Cancel focused first |
| Feedback | One polite status message; validation errors stay inline beside the field |
| Save status | Hidden while healthy; a visible warning strip when saving fails |

## Accessibility

- The current destination is marked with `aria-current`, and a skip link reaches the main content.
- Navigating to a workspace moves focus to its heading.
- Invalid fields set `aria-invalid` and the first error receives focus.
- Motion respects `prefers-reduced-motion`. Sound is off until the player turns it on.
