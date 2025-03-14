/**
 * This is a simple client demo to test the notification system
 * You would typically run this code in a frontend application
 */

// Example usage (for documentation purposes)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { io } = require('socket.io-client')

// Connect to the WebSocket server
const socket = io('http://localhost:3000/notifications', {
  query: {
    userId: 'f4056416-9952-4fd9-a572-8cbebe2008db', // Replace with an actual user ID
  },
})

// Listen for notification events
socket.on('new-notification', (notification) => {
  console.log('New notification received:', notification)
  // Update the UI to show the new notification
})

socket.on('notification-status-changed', (data) => {
  console.log('Notification status changed:', data)
  // Update the UI to reflect the read status
})

socket.on('notification-deleted', (data) => {
  console.log('Notification was deleted:', data)
  // Remove the notification from the UI
})

console.log('Client connected to the notification server')
