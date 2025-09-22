# Only Lunch

A tiny static web app to create random lunch groups from a list of participants.

## Features
- Add/remove participants
- Choose group size (>= 2)
- Roll to create randomized, balanced groups
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
- If the final group would be smaller than the chosen size, members are distributed across earlier groups to balance sizes.
- No backend; everything is in the browser.
