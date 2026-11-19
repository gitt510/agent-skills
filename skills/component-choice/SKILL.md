---
name: component-choice
description: Rules for choosing between selection and switching UI components (segmented control, tabs, radio group, picker/select, switch, checkbox, action group, tag group), based on Adobe Spectrum 2 usage guidelines. Use whenever writing or changing UI code that renders one of these (Mantine, Radix, React Spectrum, or plain HTML), including a filter, a form choice, or a view toggle added as part of a larger change.
---

# component-choice

Choose the component by **what the interaction does**, not by how the library implements it. Mantine and Radix render a segmented control as a radio group, but that does not make it a substitute for radio buttons.

The baseline is the Adobe Spectrum 2 (S2) usage guidelines. Where another design system disagrees, S2 wins unless the project states otherwise.

## Decision table

| What the interaction does | Component |
| --- | --- |
| Changes how the same information on the page is viewed (Preview / JSON, Day / Week / Month) | Segmented control |
| Navigates, or discloses a different section of content | Tabs |
| Picks one value from mutually exclusive options, 2–5 items | Radio group |
| Picks one value from many options, or space is tight | Picker (select) |
| Turns a setting on or off, effective immediately | Switch |
| Selects any number of options, including none | Checkbox (group) |
| Triggers actions, or toggles simple options (multiple selection allowed) | Action group |
| Filters content | Tag group, or a facet list of checkboxes / radios beside the list |

## Segmented control

S2 restricts it to view switching only:

> Segmented controls are only meant to be used to change the way you view information on a page. They should not be used for navigating, filtering content, or taking actions.

> Use a segmented control when the primary goal is to switch views of content. Tabs are reserved for navigation. Action groups are for triggering actions. Tag groups are for filtering content.

> Don't use segmented control as actions, to make selections, or to navigate.

- Keep it to 2–5 items; beyond that, use a picker or radio group
- If one item has an icon, every item has an icon

Test before using one: after switching, is the user still looking at **the same data**, only presented differently? If the switch changes a stored value, a query, or which records are shown, it is not a segmented control.

## Tabs

- Organize sections of equal importance; do not replace a step-by-step flow with tabs (use pagination)
- Avoid nested tabs; prefer side navigation or accordions
- When tabs overflow, scroll horizontally or collapse into a quiet picker; do not truncate labels

## Radio, switch, or checkbox

> Radio buttons are best when only one option can be selected at a time from a set (e.g., choosing one preference or mode). Switches are best for communicating activation (e.g., turning a setting on or off). Checkboxes are best for communicating selection (e.g., selecting multiple items from a list).

- A switch has no partial state; use a checkbox when a mixed value must be shown
- Always label a radio group or checkbox group

## Common mistakes

Each of these was a segmented control and should not have been:

| Used for | Why it is wrong | Use instead |
| --- | --- | --- |
| A form field such as `auth.type` (none / flow / static) | Stores a value | Radio group |
| Page size (50 / 100 / 500) | Changes the query, not the view | Radio group or picker |
| Status or area filter on a list | Filters content | Tag group, or checkboxes / picker |
| Choosing a category on an edit form | Makes a selection | Radio group or picker |

## Library names

| S2 | Mantine | Radix Themes |
| --- | --- | --- |
| SegmentedControl | `SegmentedControl` | `SegmentedControl` |
| Tabs | `Tabs` | `Tabs` |
| RadioGroup | `Radio.Group` | `RadioGroup` / `RadioCards` |
| Picker | `Select` | `Select` |
| Switch | `Switch` | `Switch` |
| CheckboxGroup | `Checkbox.Group` | `CheckboxGroup` / `CheckboxCards` |
| ActionGroup / ToggleButtonGroup | `Button.Group` + toggle state | — |
| TagGroup | `Chip.Group` / `Pill` | — |

## Primary sources

Re-read the source when a case is not covered above. Each S2 component page is `https://spectrum.adobe.com/web/rsp/components/<name>`; its usage guidelines section loads from a fragment that can be fetched directly:

```sh
curl -sL "https://spectrum.adobe.com/fragments/components/<name>/usage-guidelines.plain.html"
```

`<name>` is the page slug, such as `segmented-control`, `tabs`, `radio-group`, `picker`, `switch`, `checkbox`, `action-group`, or `tag-group`.

Quotes above were taken from these pages on 2026-11-19.
