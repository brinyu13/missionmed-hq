# Webex Setup Walkthrough (5 minutes, one-time only)

After this, the system handles everything automatically. You will never need to do this again.

## Step 1: Integration App (ALREADY CREATED)

The Integration app "MissionMed Matrix" has already been created on developer.webex.com.
Credentials are pre-loaded in the admin settings. No action needed for this step.

## Step 2: Authorize the Service App (ALREADY CREATED)

The Service App "MissionMed Guest Access" has already been created on developer.webex.com.
It needs admin authorization before it can generate guest tokens:

1. Go to: https://admin.webex.com (Webex Control Hub)
2. Navigate to: Management > Apps > Service Apps
3. Find "MissionMed Guest Access" and click "Authorize"
4. Grant the requested scopes

## Step 3: Enter Credentials in WordPress Admin (PRE-POPULATED)

Credentials are pre-populated on first activation. To verify or update:

1. Go to: https://missionmedinstitute.com/wp-admin/admin.php?page=mmed-sessions
2. Find the "Webex Settings" panel at the top
3. Verify the four values are filled:
   - Integration Client ID (pre-populated)
   - Integration Client Secret (pre-populated)
   - Service App Client ID (pre-populated)
   - Service App Client Secret (pre-populated)
4. Click "Save Settings" if any changes were made
5. Click "Connect Webex Account"
6. Authorize MissionMed Matrix in the Webex popup

OAuth callback redirect URI:
https://missionmedinstitute.com/wp-json/mmed/v1/admin/webex/callback

## Step 4: Test It

1. In the Session Manager table, find "Mission Residency - Session A"
2. Click "Generate Webex Meeting"
3. Verify: a Webex join URL appears in the Meeting URL column
4. Click "Invite All Students"
5. Verify: toast says "Invited X of Y students"

Done. The system now auto-creates meetings and auto-populates student calendars.
Students see "Join Live" buttons and attend meetings inside MissionMed.
