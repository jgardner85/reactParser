import React, { useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Container } from '@mui/material';
import useWebSocket from './hooks/useWebSocket';
import Dashboard from './components/Dashboard';
import NameEntry from './components/NameEntry';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

function App() {
  const [userName, setUserName] = useState('');
  const [showDashboard, setShowDashboard] = useState(false);

  // Only connect to WebSocket after user enters name
  console.log('App render - showDashboard:', showDashboard);
  const {
    connectionStatus,
    isConnected,
    lastMessage,
    sendJsonMessage,
    messages
  } = useWebSocket(showDashboard ? undefined : null);

  const handleNameSubmit = (name) => {
    setUserName(name);
    setShowDashboard(true);
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      {!showDashboard ? (
        <NameEntry onNameSubmit={handleNameSubmit} />
      ) : (
        <Container maxWidth="xl">
          <Dashboard
            connectionStatus={connectionStatus}
            isConnected={isConnected}
            lastMessage={lastMessage}
            sendJsonMessage={sendJsonMessage}
            userName={userName}
            messages={messages}
          />
        </Container>
      )}
    </ThemeProvider>
  );
}

export default App;
