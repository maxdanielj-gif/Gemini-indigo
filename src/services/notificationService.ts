export const showNativeNotification = async (title: string, options?: NotificationOptions) => {
  console.log('showNativeNotification called:', title, options);
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.log('Notification API not supported');
    return;
  }
  
  console.log('Notification permission:', Notification.permission);
  if (Notification.permission !== 'granted') return;

  try {
    // Try using Service Worker registration first (required for Android/Chrome)
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      console.log('Service Worker registration:', registration);
      if (registration) {
        await registration.showNotification(title, options);
        console.log('Notification shown via Service Worker');
        return;
      }
    }
    
    // Fallback to standard constructor (may fail on some mobile browsers)
    console.log('Showing notification via fallback');
    new Notification(title, options);
  } catch (error) {
    console.error('Error showing native notification:', error);
  }
};
