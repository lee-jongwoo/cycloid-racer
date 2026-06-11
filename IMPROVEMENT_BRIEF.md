# Improvement Brief

## 1. App Purpose

Describe the real-world use case for this app.

- Event / setting: for a school festival booth
- Primary audience: students and attendees of the festival
- Expected session length: about 1 minute per user
- Number of users: hundreds over the course of the event
- Operator role, if any: a volunteer to reset the game and manage the booth
- What counts as success: engagement and fun for the attendees, smooth operation for the volunteer, and a memorable experience that encourages learning about cycloids and physics.

## 2. Supported Environment

Define where the app actually needs to work.

- Target device(s): primarily HYUNDAI digital whiteboard, but testing would be done on desktop browsers.
- Screen size / resolution: a large touch screen, likely around 55 inches
- Browser: Chrome on Android
- Input method: touch input for drawing, with keyboard input for nickname entry on a connected device
- Network assumptions: Wi-Fi is available at school, but it should be able to function without a stable connection after the initial load
- Offline requirements: not much though
- Public deployment URL, if relevant: jongwoo-lee.github.io/cycloid-racer; the app should be deployable with static hosting.

## 3. Out Of Scope

List things that do not need to be fixed, even if they are technically imperfect.

- mobile layout: the game is not intended for use on small screens.
- 
- 

## 4. Known Issues To Fix

Use this section to mark which observed issues should be addressed.

| Issue | Fix? | Priority | Notes |
| --- | --- | --- | --- |
| Small vertical page overflow | No |  |  |
| Cramped mobile layout / wrapped leaderboard title | No |  |  |
| Near-horizontal paths can break physics | Yes |  |  |
| Resize leaves finish point outside the canvas | Yes | Low |  |
| Canceling nickname modal leaves completed run on screen | Yes |  |  |
| Missing favicon causes 404 | No |  |  |

## 5. Desired Gameplay Behavior

Describe how the game should behave during normal play.

- Start state: a blank canvas with a start button and an empty leaderboard
- Drawing behavior: users can draw a path with their finger, which is drawn in real-time on the canvas.
- Ball drop behavior: ball drops from a fixed point above the start of the path.
- Finish condition: when the ball reaches a certain area near the end of the path, the run is completed and the timer stops.
- Timer behavior: starts when the ball is released, and stops when the finish condition is met; the time is displayed to the user.
- Retry / redo behavior: after a run is completed, the user can choose to enter their nickname and save their score, or they can reset the game to try again without saving.
- Best-path demo behavior: when the volunteer presses a demo button, a cycloid path is drawn on the canvas, and a ball rolls along it to show the optimal solution.
- Leaderboard behavior: after a run is completed and the user enters their nickname, their time and a thumbnail of their path are added to the leaderboard, which is sorted by time with the fastest runs at the top.

## 6. Leaderboard Requirements

Define what should be stored, displayed, and cleared.

- Storage lifetime: until the next reset, which can be done by the volunteer at any time; no need for persistence across sessions.
- Required fields: nickname, time, and a thumbnail of the drawn path.
- Sorting rule: By time, fastest first.
- Maximum number of entries: Allow scrolling, but display the top 10 prominently.
- Thumbnail requirements: a small image, showing the drawn path
- Name validation: None
- Clear/reset rules: Manually reset by the volunteer

## 7. Layout And Visual Requirements

Describe the expected visual experience.

- Required visible regions: drawing canvas, timer, start/reset buttons, leaderboard
- Minimum supported viewport: should be playable on iPads, but optimized for the large whiteboard
- Desktop / large display layout: canvas takes up most of the space, with the timer and buttons at the top, and the leaderboard on the right side.
- Touch device layout: this is the primary target.
- Text language: Korean
- Visual style constraints: simple and clear, easy to use without much instruction
- Accessibility concerns: Minimal, as the game is only intended for a specific event, but should have clear visuals

## 8. Technical Constraints

List constraints for implementation.

- Keep vanilla JS/HTML/CSS
- Allowed libraries: matter.js for physics, but no large frameworks like React or Vue
- Deployment constraints: must be deployable as a static site, no server-side code
- Browser compatibility: Chrome on Android is the primary target, but it should also work on desktop browsers for testing purposes.
- Performance constraints: The game should run smoothly on the whiteboard hardware, which may not be as powerful as a modern desktop, so optimizations may be necessary.
- Code cleanup expectations: The code is very messy at the moment, so aggressive refractoring is expected. Large-scale redesigns of the code structure are allowed.

## 9. Acceptance Criteria

List concrete checks that must pass before the work is done.

- drawing behavior works as expected, with real-time rendering of the path
- ball drops and rolls along the drawn path with realistic physics
- leaderboard updates correctly with nickname, time, and thumbnail after a run is completed

## 10. QA Plan

Describe how the app should be verified.

- Functional checks: drawing, ball physics, timer, leaderboard updates
- Visual checks: layout on the whiteboard, readability of text, visibility of the ball and path
- Touch / mouse checks: ensure that touch input works correctly on the whiteboard, and that mouse input works for testing on desktop
- Edge cases: drawing very short paths, drawing near-horizontal paths, canceling the nickname entry modal, resetting the game mid-run
- Screenshots or evidence required: minimal, just keep a live server running for testing and demonstration purposes. 

## 11. Notes For Codex

Add any extra instructions for implementation style, priorities, or things to avoid.

- In the current implementation, generated matter.js bodies are quite rugged, which ends to ackward bouncing of the ball while rolling. Try to fix this problem by smoothing the paths properly.
- In the current implementation, the drawn path is resized to fit the start and end points, which can lead to distortion and unexpected physics behavior. Instead of resizing the path, consider implementing a way to keep the path's original shape while ensuring the start point is fixed.
- There's a quirk where drawing a very short path can generate a smoother surface that tends to score better than longer paths, which can be exploited by users. Consider a way to normalize the path to prevent this issue.
- The code is currently very messy, so feel free to refactor and reorganize as needed. Focus on improving readability and maintainability, even if it means making significant changes to the structure of the code.
