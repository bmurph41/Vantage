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
async function getUncachableGoogleCalendarClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
  }>;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: string;
      minutes: number;
    }>;
  };
}

export class CalendarService {
  /**
   * Create a calendar event in Google Calendar
   */
  static async createEvent(event: CalendarEvent, calendarId: string = 'primary'): Promise<any> {
    try {
      const calendar = await getUncachableGoogleCalendarClient();
      
      const response = await calendar.events.insert({
        calendarId,
        requestBody: event,
      });

      return response.data;
    } catch (error) {
      console.error('Failed to create calendar event:', error);
      throw new Error('Failed to create calendar event');
    }
  }

  /**
   * Update an existing calendar event
   */
  static async updateEvent(eventId: string, event: Partial<CalendarEvent>, calendarId: string = 'primary'): Promise<any> {
    try {
      const calendar = await getUncachableGoogleCalendarClient();
      
      const response = await calendar.events.patch({
        calendarId,
        eventId,
        requestBody: event,
      });

      return response.data;
    } catch (error) {
      console.error('Failed to update calendar event:', error);
      throw new Error('Failed to update calendar event');
    }
  }

  /**
   * Delete a calendar event
   */
  static async deleteEvent(eventId: string, calendarId: string = 'primary'): Promise<void> {
    try {
      const calendar = await getUncachableGoogleCalendarClient();
      
      await calendar.events.delete({
        calendarId,
        eventId,
      });
    } catch (error) {
      console.error('Failed to delete calendar event:', error);
      throw new Error('Failed to delete calendar event');
    }
  }

  /**
   * List calendar events within a time range
   */
  static async listEvents(
    timeMin: string,
    timeMax: string,
    calendarId: string = 'primary',
    maxResults: number = 250
  ): Promise<any[]> {
    try {
      const calendar = await getUncachableGoogleCalendarClient();
      
      const response = await calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        maxResults,
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.data.items || [];
    } catch (error) {
      console.error('Failed to list calendar events:', error);
      throw new Error('Failed to list calendar events');
    }
  }

  /**
   * Check if Google Calendar is connected
   */
  static async isConnected(): Promise<boolean> {
    try {
      await getAccessToken();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get calendar list
   */
  static async getCalendars(): Promise<any[]> {
    try {
      const calendar = await getUncachableGoogleCalendarClient();
      
      const response = await calendar.calendarList.list();

      return response.data.items || [];
    } catch (error) {
      console.error('Failed to get calendar list:', error);
      throw new Error('Failed to get calendar list');
    }
  }
}
