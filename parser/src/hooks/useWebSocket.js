import { useState, useEffect, useRef, useCallback } from 'react';

const useWebSocket = (url) => {
    const [socket, setSocket] = useState(null);
    const [lastMessage, setLastMessage] = useState(null);
    const [readyState, setReadyState] = useState(WebSocket.CLOSED);
    const [messages, setMessages] = useState([]);
    const [connectionStatus, setConnectionStatus] = useState('Not connected');

    // Use ref to maintain stable reference for cleanup
    const socketRef = useRef(null);

    // Don't connect if url is explicitly null
    const shouldConnect = url !== null;
    const wsUrl = shouldConnect ? (url || `ws://${window.location.hostname}:8767`) : null;

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
        if (!shouldConnect || !wsUrl) {
            setReadyState(WebSocket.CLOSED);
            setConnectionStatus('Not connected');
            return;
        }

        console.log(`Connecting to WebSocket: ${wsUrl}`);
        console.log('User Agent:', navigator.userAgent);
        console.log('WebSocket support:', typeof WebSocket !== 'undefined');

        // Check WebSocket support
        if (typeof WebSocket === 'undefined') {
            console.error('WebSocket not supported in this browser');
            setConnectionStatus('WebSocket not supported');
            setReadyState(WebSocket.CLOSED);
            return;
        }

        try {
            const ws = new WebSocket(wsUrl);
            socketRef.current = ws;
            setSocket(ws);
            setReadyState(WebSocket.CONNECTING);
            setConnectionStatus('Connecting...');

            console.log('WebSocket object created successfully');

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
                console.log('Close event details:', {
                    code: event.code,
                    reason: event.reason,
                    wasClean: event.wasClean,
                    type: event.type
                });
                console.log('WebSocket URL was:', wsUrl);
                setReadyState(WebSocket.CLOSED);
                setConnectionStatus(getConnectionStatus(WebSocket.CLOSED));

                // Attempt to reconnect after 3 seconds if we should still be connected
                if (shouldConnect) {
                    setTimeout(() => {
                        if (socketRef.current?.readyState === WebSocket.CLOSED) {
                            console.log('Attempting to reconnect...');
                            setConnectionStatus('Reconnecting...');
                        }
                    }, 3000);
                }
            };

            ws.onerror = (error) => {
                console.error('WebSocket error occurred:', error);
                console.error('Error details:', {
                    type: error.type,
                    target: error.target,
                    message: error.message,
                    code: error.code,
                    reason: error.reason
                });
                console.error('WebSocket state:', ws.readyState);
                console.error('WebSocket URL was:', wsUrl);
                setConnectionStatus(`Error: ${error.message || 'Connection failed'}`);
            };

            // Cleanup function
            return () => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.close();
                }
            };
        } catch (error) {
            console.error('Error creating WebSocket:', error);
            console.error('Full error object:', error);
            console.error('Error stack:', error.stack);
            console.error('Error name:', error.name);
            console.error('Error message:', error.message);
            console.error('WebSocket URL attempted:', wsUrl);
            setConnectionStatus(`Connection error: ${error.message}`);
            setReadyState(WebSocket.CLOSED);
            return;
        }
    }, [shouldConnect, wsUrl]);

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