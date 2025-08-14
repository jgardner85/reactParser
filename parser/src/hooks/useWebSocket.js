import { useState, useEffect, useRef, useCallback } from 'react';

const useWebSocket = (url) => {
    // Use provided URL or auto-detect based on current hostname
    const wsUrl = url || `ws://${window.location.hostname}:8765`;
    const [socket, setSocket] = useState(null);
    const [lastMessage, setLastMessage] = useState(null);
    const [readyState, setReadyState] = useState(WebSocket.CONNECTING);
    const [messages, setMessages] = useState([]);
    const [connectionStatus, setConnectionStatus] = useState('Connecting...');

    // Use ref to maintain stable reference for cleanup
    const socketRef = useRef(null);

    // Connection status mapping
    const getConnectionStatus = (state) => {
        switch (state) {
            case WebSocket.CONNECTING:
                return 'Connecting...';
            case WebSocket.OPEN:
                return 'Connected';
            case WebSocket.CLOSING:
                return 'Disconnecting...';
            case WebSocket.CLOSED:
                return 'Disconnected';
            default:
                return 'Unknown';
        }
    };

    useEffect(() => {
        if (!wsUrl) return;

        console.log(`Connecting to WebSocket: ${wsUrl}`);

        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;
        setSocket(ws);

        ws.onopen = (event) => {
            console.log('WebSocket connected:', event);
            setReadyState(WebSocket.OPEN);
            setConnectionStatus(getConnectionStatus(WebSocket.OPEN));

            // Send initial connection message
            const initialMessage = {
                type: 'connection',
                message: 'React client connected',
                timestamp: new Date().toISOString()
            };
            ws.send(JSON.stringify(initialMessage));
        };

        ws.onmessage = (event) => {
            console.log('WebSocket message received:', event.data);

            let messageData;
            try {
                messageData = JSON.parse(event.data);
            } catch (e) {
                // Handle plain text messages
                messageData = {
                    type: 'text',
                    content: event.data,
                    timestamp: new Date().toISOString()
                };
            }

            setLastMessage(messageData);
            setMessages(prev => [...prev, {
                ...messageData,
                id: Date.now() + Math.random(), // Simple unique ID
                received_at: new Date().toISOString()
            }]);
        };

        ws.onclose = (event) => {
            console.log('WebSocket disconnected:', event);
            setReadyState(WebSocket.CLOSED);
            setConnectionStatus(getConnectionStatus(WebSocket.CLOSED));

            // Attempt to reconnect after 3 seconds
            setTimeout(() => {
                if (socketRef.current?.readyState === WebSocket.CLOSED) {
                    console.log('Attempting to reconnect...');
                    setConnectionStatus('Reconnecting...');
                }
            }, 3000);
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            setConnectionStatus('Error occurred');
        };

        // Cleanup function
        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, [wsUrl]);

    // Function to send messages
    const sendMessage = useCallback((message) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            const messageToSend = typeof message === 'string' ? message : JSON.stringify(message);
            socketRef.current.send(messageToSend);
            console.log('Message sent:', messageToSend);
            return true;
        } else {
            console.warn('WebSocket is not connected. Message not sent:', message);
            return false;
        }
    }, []);

    // Function to send JSON messages with metadata
    const sendJsonMessage = useCallback((data) => {
        const message = {
            ...data,
            timestamp: new Date().toISOString(),
            client_type: 'react'
        };
        return sendMessage(message);
    }, [sendMessage]);

    // Function to clear message history
    const clearMessages = useCallback(() => {
        setMessages([]);
    }, []);

    // Function to manually reconnect
    const reconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.close();
        }
    }, []);

    return {
        socket,
        lastMessage,
        readyState,
        messages,
        connectionStatus,
        sendMessage,
        sendJsonMessage,
        clearMessages,
        reconnect,
        isConnected: readyState === WebSocket.OPEN,
        isConnecting: readyState === WebSocket.CONNECTING,
        isDisconnected: readyState === WebSocket.CLOSED
    };
};

export default useWebSocket;