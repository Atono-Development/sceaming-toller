Walkthrough 5 - Game Management Implementation
I have implemented the Game Management feature, allowing team admins to schedule games and players to view the team schedule.

Key Changes

1. Backend Game Scheduling
   Implemented
   CreateGame
   ,
   GetTeamGames
   , and
   GetGame
   handlers.
   Integrated
   Game
   model with team-scoped API routes.
   Validated date inputs and team membership.
2. Frontend Schedule Interface
   Added "Schedule" link to the Dashboard header (Top Navigation).
   Created
   GamesPage
   to list upcoming games.
   Created
   CreateGamePage
   with a form to add new games (Admin only).
   Updated
   TeamContext
   for better type safety and consistency.
3. User Feedback Integration
   Placed the "Schedule" access point in the top navigation bar of the Dashboard for easier access, as requested.
   Technical Verification
   Backend Build: go build ./... - PASSED
   Frontend Build: npm run build - PASSED
   How to Test
   Login to the application.
   Select a Team from the dropdown in the header.
   Click the "Schedule" link in the header.
   Admin Check: If you are an admin, you should see an "Add Game" button.
   Create a Game:
   Click "Add Game".
   Fill in Date, Time, Location, and Opposing Team.
   Click "Schedule Game".
   Verify: You should be redirected back to the Schedule page, and the new game should be listed.
