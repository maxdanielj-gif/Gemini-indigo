import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
// Removed bad import

// Wait, firebaseService has signInWithGoogle

export async function fetchCalendarEvents(accessToken: string) {
  const timeMin = new Date().toISOString();
  // Fetch up to 10 upcoming events
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&maxResults=10&singleEvents=true&orderBy=startTime`;
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Calendar API error: ${response.status}`);
  }

  const data = await response.json();
  return data.items || [];
}
