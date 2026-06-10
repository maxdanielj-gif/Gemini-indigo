import React, { useEffect } from 'react';

/**
 * KeepAlive component pings the server periodically to prevent the 
 * development container from idling out while the user has the app open.
 */
const KeepAlive: React.FC = () => {
  useEffect(() => {
    const pingServer = async () => {
      try {
        const response = await fetch('/api/health');
        if (!response.ok) {
          // Silent failure for background ping
        }
      } catch (error) {
        // Silent failure for background ping
      }
    };

    // Initial ping after a short delay to ensure server is ready
    const initialTimeout = setTimeout(pingServer, 5000);

    // Ping every 2 minutes (120000 ms)
    const interval = setInterval(pingServer, 120000);
    
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  return null; // This component doesn't render anything
};

export default KeepAlive;
