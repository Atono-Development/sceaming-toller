Roster Management Verification
I have implemented the Roster Management features, including inviting members, accepting invitations, and viewing the team roster.

Changes
Backend:
Added invitiations and members handlers.
Updated
Register
to support auto-joining teams via email match.
Added
Attendance
and
Lineup
models (prerequisites).
Frontend:
Created
RosterPage
to list team members.
Created
InviteMemberDialog
to generate invite links.
Created
AcceptInvitePage
handling the invitation acceptance flow.
Integrated with backend APIs.
Verification Steps

1. Invite a Player
   Login as a Team Admin.
   Navigate to the Schedule or use the Team Selector to verify your admin status (Admin badge visible).
   Navigate to /teams/:id/roster (currently manually or via potential nav link if added).
   Note: A direct nav link might need to be verified or added if not present in the header/sidebar.

Click Invite Player.
Enter an email address (e.g., newplayer@example.com) and select a role.
Click Create Invite.
Copy the generated link. 2. Accept Invitation (New User)
Open the copied link in a new incognito window (or logout).
You should be redirected to Login.
Click Register.
Register with the same email (newplayer@example.com).
After registration, you should be automatically added to the team and redirected to the Dashboard.
Verify the team appears in your Team Selector. 3. Accept Invitation (Existing User)
Login as an existing user (different form admin).
Paste the invite link in the browser.
You should see the "You're invited!" page.
Click Join Team.
Verify you are redirected to the Dashboard and the new team is selected/available. 4. Verify Roster
Switch back to the Admin account.
Go to the Roster Page.
Verify the new member is listed with the correct role and status.
Try removing a member (if needed).
