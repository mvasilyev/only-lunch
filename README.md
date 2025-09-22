# Only Lunch

A tiny static web app to create random lunch groups from a list of participants.

## Features
- Add/remove participants
- Choose group size (>= 2)
- Mark participants as Local
- Roll to create randomized, balanced groups ensuring each group has at least one Local (when possible)
- Persists participants and group size in your browser (localStorage)

## Quick start
Just open `index.html` in your browser.

### Optional: run a simple local server
Helpful if your browser restricts localStorage for `file://` or for mobile testing.

- Python 3:
  ```bash
  python3 -m http.server 5173
  ```
  Then open http://localhost:5173

- Node (npx):
  ```bash
  npx serve -p 5173
  ```

## Notes
- Duplicates are prevented case-insensitively.
- Groups are constrained to include at least one Local each. The number of groups is limited by the count of Locals.
- If Locals are fewer than desired groups by size, fewer (larger) groups will be created.
- If the final group would be smaller than the chosen size, members are distributed across earlier groups to balance sizes.
- No backend; everything is in the browser.
