import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-calendar',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Calendar not connected');
  }
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getUncachableGoogleCalendarClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

// Helper function to create calendar events
export async function createCalendarEvent(calendarEvent: {
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  location?: string;
  attendees?: string[];
}) {
  try {
    const calendar = await getUncachableGoogleCalendarClient();
    
    const event = {
      summary: calendarEvent.title,
      description: calendarEvent.description,
      location: calendarEvent.location,
      start: {
        dateTime: new Date(calendarEvent.startDate).toISOString(),
        timeZone: 'America/New_York',
      },
      end: {
        dateTime: calendarEvent.endDate 
          ? new Date(calendarEvent.endDate).toISOString()
          : new Date(new Date(calendarEvent.startDate).getTime() + 60 * 60 * 1000).toISOString(), // Default 1 hour
        timeZone: 'America/New_York',
      },
      attendees: calendarEvent.attendees?.map(email => ({ email })),
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 day before
          { method: 'popup', minutes: 60 }, // 1 hour before
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      sendUpdates: 'all',
    });

    return response.data;
  } catch (error) {
    console.error('Error creating calendar event:', error);
    throw error;
  }
}

// Helper function to check calendar availability
export async function checkCalendarAvailability() {
  try {
    const calendar = await getUncachableGoogleCalendarClient();
    
    // Simple test to check if the connection works
    const response = await calendar.calendarList.list();
    return response.data.items ? true : false;
  } catch (error) {
    console.error('Error checking calendar availability:', error);
    return false;
  }
}