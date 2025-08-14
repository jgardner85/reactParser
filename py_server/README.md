# Simple WebSocket Server

A basic Python WebSocket server that demonstrates real-time communication capabilities.

## Features

- **Echo Server**: Echoes back all received messages
- **JSON Support**: Handles both JSON and plain text messages
- **Multi-client**: Supports multiple concurrent connections
- **Heartbeat**: Sends periodic heartbeat messages to connected clients
- **Logging**: Comprehensive logging of connections and messages
- **Broadcasting**: Can broadcast messages to all connected clients

## Setup

1. **Install Dependencies**
   ```bash
   cd py_server
   pip install -r requirements.txt
   ```

2. **Run the Server**
   ```bash
   python websocket_server.py
   ```

   The server will start on `localhost:8765`

## Usage

### Testing with a WebSocket Client

You can test the server using any WebSocket client. Here are a few options:

#### Option 1: Browser JavaScript Console
```javascript
// Connect to the server
const ws = new WebSocket('ws://localhost:8765');

// Handle connection open
ws.onopen = function(event) {
    console.log('Connected to WebSocket server');
    ws.send('Hello Server!');
};

// Handle incoming messages
ws.onmessage = function(event) {
    console.log('Received:', event.data);
};

// Send JSON message
ws.send(JSON.stringify({
    type: 'test',
    message: 'Hello from browser!',
    timestamp: new Date().toISOString()
}));
```

#### Option 2: Python Client
```python
import asyncio
import websockets
import json

async def test_client():
    uri = "ws://localhost:8765"
    async with websockets.connect(uri) as websocket:
        # Send text message
        await websocket.send("Hello Server!")
        response = await websocket.recv()
        print(f"Server response: {response}")
        
        # Send JSON message
        message = {
            "type": "test",
            "content": "Hello from Python client!",
            "number": 42
        }
        await websocket.send(json.dumps(message))
        response = await websocket.recv()
        print(f"Server JSON response: {response}")

# Run the client
asyncio.run(test_client())
```

#### Option 3: Command Line with wscat
```bash
# Install wscat globally
npm install -g wscat

# Connect to server
wscat -c ws://localhost:8765

# Type messages and press Enter to send
```

### Message Types

The server handles two types of messages:

1. **Plain Text**: Any string message will be echoed back with timestamp and client info
2. **JSON**: JSON objects will be echoed back in a structured response format

### Server Response Format

For JSON messages, the server responds with:
```json
{
    "type": "echo",
    "original_message": { /* your original message */ },
    "timestamp": "2024-01-15T10:30:00.000Z",
    "client_id": "127.0.0.1:12345"
}
```

For text messages:
```
Echo: Your message (from 127.0.0.1:12345 at 10:30:00)
```

### Heartbeat Messages

Every 30 seconds, the server sends heartbeat messages to all connected clients:
```json
{
    "type": "heartbeat",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "connected_clients": 3
}
```

## Server Logs

The server provides detailed logging including:
- Client connections and disconnections
- Received messages
- Sent responses
- Error handling

Example log output:
```
2024-01-15 10:30:00,123 - INFO - Starting WebSocket server on localhost:8765
2024-01-15 10:30:05,456 - INFO - New client connected: 127.0.0.1:12345
2024-01-15 10:30:06,789 - INFO - Received from 127.0.0.1:12345: Hello Server!
2024-01-15 10:30:06,790 - INFO - Sent text response to 127.0.0.1:12345
```

## Customization

You can easily modify the server by:

- Changing the host/port in the `main()` function
- Adding custom message handlers in `handle_client()`
- Implementing different broadcasting strategies
- Adding authentication or message validation
- Creating specific message types for your application

## Requirements

- Python 3.7+
- websockets library (see requirements.txt)

## License

This is a simple example server for educational and development purposes.