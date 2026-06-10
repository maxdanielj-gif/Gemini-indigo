import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { signInWithGoogle } from '../services/firebaseService';
import { Calendar as CalendarIcon, RefreshCw, AlertCircle } from 'lucide-react';
import { fetchCalendarEvents } from '../services/calendarService';

const CalendarScreen: React.FC = () => {
  const { currentUser } = useApp();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const authenticateWithCalendar = async () => {
    setLoading(true);
    setError(null);
    try {
      const { accessToken: newToken } = await signInWithGoogle(undefined, [
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly'
      ]);
      if (newToken) {
        setAccessToken(newToken);
        loadEvents(newToken);
      } else {
        setError('Failed to get calendar permissions.');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to authenticate');
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async (token: string) => {
    setLoading(true);
    try {
      const data = await fetchCalendarEvents(token);
      setEvents(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden relative">
      <div className="p-4 md:p-6 lg:p-8 flex-1 overflow-y-auto w-full max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
            <CalendarIcon className="w-8 h-8 text-indigo-500" />
            Google Calendar
          </h1>
          {accessToken && (
            <button
              onClick={() => loadEvents(accessToken)}
              disabled={loading}
              className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 bg-red-100 dark:bg-red-900 border-l-4 border-red-500 p-4 rounded text-red-800 dark:text-red-100 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {!accessToken ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
            <CalendarIcon className="w-16 h-16 text-slate-300 dark:text-slate-600 mb-4" />
            <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">Connect Google Calendar</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8">
              Sign in with Google and grant Calendar permissions to see your upcoming events here.
            </p>
            <button
              onClick={authenticateWithCalendar}
              disabled={loading}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-medium rounded-lg transition-all flex items-center gap-2"
            >
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CalendarIcon className="w-5 h-5" />}
              Connect Calendar
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
            <p className="text-slate-500 dark:text-slate-400">No upcoming events found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => {
              const start = new Date(event.start?.dateTime || event.start?.date);
              const end = new Date(event.end?.dateTime || event.end?.date);
              const isAllDay = !event.start?.dateTime;
              
              return (
                <div key={event.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col sm:flex-row">
                  <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 sm:w-48 flex flex-col justify-center items-center text-center border-b sm:border-b-0 sm:border-r border-slate-200 dark:border-slate-700">
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">
                      {start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {isAllDay ? 'All day' : `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                    </span>
                  </div>
                  <div className="p-4 flex-1">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-1">{event.summary || '(No Title)'}</h3>
                    {event.description && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{event.description}</p>
                    )}
                    {event.location && (
                      <p className="text-sm text-indigo-600 dark:text-indigo-400 mt-2 truncate max-w-[20rem]">📍 {event.location}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarScreen;
