# Claude Code Instructions

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md


Red flags in a React codebase

🚩 functions like <button onClick={handleClick}

- handleClick doesn't explain what it does
- you lose colocation
- need new names for each callback

Inline callbacks can call multiple functions with good names

onClick={() => {
    analytics.event('this-button')
    openModal()

🚩 useMemo

React devs are terrified of renders and often overuseMemo

- memoize things that you pass as props to components that may have expensive children
- it's ok for leaf components to over-render

useMemo does not fix bugs, it just makes them happen less often

🚩 <div onClick

divs are not interactive elements and adding onClick requires implementing keyboard control, screen reader announcement, etc
