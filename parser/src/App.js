import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Container } from '@mui/material';
import useWebSocket from './hooks/useWebSocket';
import Dashboard from './components/Dashboard';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

function App() {
  // Connect to WebSocket server on localhost:8765 (runs in background)
  const {
    connectionStatus,
    isConnected,
    lastMessage
  } = useWebSocket('ws://localhost:8765');

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Container maxWidth="xl">
        <Dashboard
          connectionStatus={connectionStatus}
          isConnected={isConnected}
          lastMessage={lastMessage}
        />
      </Container>
    </ThemeProvider>
  );
}

export default App;
