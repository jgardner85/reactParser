#!/usr/bin/env python3
"""
Simple WebSocket Server

A basic websocket server that:
- Accepts WebSocket connections on localhost:8765
- Echoes back any messages received from clients
- Handles multiple concurrent connections
- Logs connection events and messages
"""

import asyncio
import websockets
import logging
import json
import os
from datetime import datetime
import http.server
import socketserver
import threading
import uuid

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Store connected clients with their user IDs
connected_clients = {}  # websocket -> user_id mapping


def get_image_files():
    """Get list of image files from the pics directory"""
    pics_dir = "pics"
    if not os.path.exists(pics_dir):
        return []

    image_extensions = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"}
    image_files = []

    for filename in os.listdir(pics_dir):
        if any(filename.lower().endswith(ext) for ext in image_extensions):
            image_files.append(filename)

    return sorted(image_files)


def get_image_ratings_file(image_filename):
    """Get the ratings file path for a specific image"""
    ratings_dir = "image_ratings"
    if not os.path.exists(ratings_dir):
        os.makedirs(ratings_dir)
    # Clean filename for filesystem (remove extension, replace special chars)
    clean_name = os.path.splitext(image_filename)[0].replace(" ", "_").replace("/", "_")
    return os.path.join(ratings_dir, f"{clean_name}_ratings.json")


def load_image_ratings(image_filename):
    """Load all ratings for a specific image"""
    ratings_file = get_image_ratings_file(image_filename)
    if os.path.exists(ratings_file):
        try:
            with open(ratings_file, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            logger.error(f"Error loading ratings for image {image_filename}: {e}")

    # Return empty structure if file doesn't exist
    return {
        "image_filename": image_filename,
        "total_ratings": 0,
        "average_rating": 0.0,
        "ratings_feed": [],
    }


def save_image_rating(
    user_id, image_filename, rating, comment, user_name=None, full_message=None
):
    """Add a new rating to an image's chronological feed"""
    ratings_data = load_image_ratings(image_filename)

    # Create the rating entry with full WebSocket message data
    rating_entry = {
        "user_id": user_id,
        "user_name": user_name,
        "rating": rating,
        "comment": comment,
        "timestamp": datetime.now().isoformat(),
        "full_message": full_message,  # Store the complete WebSocket message
    }

    # Check if this user already rated this image (to replace their previous rating)
    existing_index = None
    for i, existing_rating in enumerate(ratings_data["ratings_feed"]):
        if existing_rating["user_id"] == user_id:
            existing_index = i
            break

    # Either replace existing rating or append new one
    if existing_index is not None:
        ratings_data["ratings_feed"][existing_index] = rating_entry
        logger.info(f"Updated existing rating for user {user_name} ({user_id})")
    else:
        ratings_data["ratings_feed"].append(rating_entry)
        logger.info(f"Added new rating for user {user_name} ({user_id})")

    # Sort by timestamp (newest first)
    ratings_data["ratings_feed"].sort(key=lambda x: x["timestamp"], reverse=True)

    # Update summary statistics
    ratings_data["total_ratings"] = len(ratings_data["ratings_feed"])
    if ratings_data["total_ratings"] > 0:
        total_score = sum(r["rating"] for r in ratings_data["ratings_feed"])
        ratings_data["average_rating"] = round(
            total_score / ratings_data["total_ratings"], 2
        )
    else:
        ratings_data["average_rating"] = 0.0

    # Save back to file
    ratings_file = get_image_ratings_file(image_filename)
    try:
        with open(ratings_file, "w") as f:
            json.dump(ratings_data, f, indent=2)
        user_display = f"{user_name} ({user_id})" if user_name else user_id
        logger.info(
            f"Saved rating for {user_display} on {image_filename}: {rating}/5 (avg: {ratings_data['average_rating']})"
        )
        return True
    except IOError as e:
        logger.error(f"Error saving rating for image {image_filename}: {e}")
        return False


async def handle_client(websocket, path):
    """Handle a single WebSocket connection"""
    client_id = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
    user_id = str(uuid.uuid4())[:8]  # Generate short user ID
    logger.info(f"New client connected: {client_id} (User: {user_id})")

    # Add client to connected set with user ID
    connected_clients[websocket] = user_id

    # Send image file list immediately after connection
    try:
        image_files = get_image_files()
        file_list_message = {
            "type": "file_list",
            "files": image_files,
            "user_id": user_id,
            "timestamp": datetime.now().isoformat(),
        }
        await websocket.send(json.dumps(file_list_message))
        logger.info(
            f"Sent file list to {client_id} (User: {user_id}): {len(image_files)} images"
        )
    except Exception as e:
        logger.error(f"Error sending file list to {client_id}: {e}")

    try:
        async for message in websocket:
            logger.info(f"Received from {client_id}: {message}")

            try:
                # Try to parse as JSON for structured messages
                data = json.loads(message)

                # Handle different message types
                if data.get("type") == "image_rating":
                    # Handle image rating submission
                    image_filename = data.get("image_filename")
                    rating = data.get("rating")
                    comment = data.get("comment", "")
                    user_name = data.get("user_name")

                    if image_filename and rating:
                        success = save_image_rating(
                            user_id, image_filename, rating, comment, user_name, data
                        )

                        # Send confirmation to the rating user
                        response = {
                            "type": "rating_saved",
                            "success": success,
                            "image_filename": image_filename,
                            "rating": rating,
                            "user_name": user_name,
                            "timestamp": datetime.now().isoformat(),
                        }
                        await websocket.send(json.dumps(response))

                        # Broadcast the updated ratings feed to all other connected users
                        if success:
                            await broadcast_rating_update(
                                image_filename, exclude_client=websocket
                            )
                    else:
                        # Send error response
                        response = {
                            "type": "error",
                            "message": "Invalid rating data",
                            "timestamp": datetime.now().isoformat(),
                        }
                        await websocket.send(json.dumps(response))
                else:
                    # Echo other messages
                    response = {
                        "type": "echo",
                        "original_message": data,
                        "timestamp": datetime.now().isoformat(),
                        "client_id": client_id,
                    }
                    await websocket.send(json.dumps(response))
                    logger.info(f"Sent JSON response to {client_id}")

            except json.JSONDecodeError:
                # Handle plain text messages
                response = f"Echo: {message} (from {client_id} at {datetime.now().strftime('%H:%M:%S')})"
                await websocket.send(response)
                logger.info(f"Sent text response to {client_id}")

    except websockets.exceptions.ConnectionClosed:
        logger.info(f"Client {client_id} disconnected")
    except Exception as e:
        logger.error(f"Error handling client {client_id}: {e}")
    finally:
        # Remove client from connected set
        if websocket in connected_clients:
            del connected_clients[websocket]
        logger.info(f"Client {client_id} (User: {user_id}) connection cleaned up")


async def broadcast_message(message, exclude_client=None):
    """Broadcast a message to all connected clients, optionally excluding one"""
    if connected_clients:
        # Create list to avoid dict changed during iteration, excluding specified client
        clients_list = [
            client for client in connected_clients.keys() if client != exclude_client
        ]

        if clients_list:
            logger.info(
                f"Broadcasting to {len(clients_list)} clients (excluding sender): {message[:100]}..."
            )
            await asyncio.gather(
                *[client.send(message) for client in clients_list],
                return_exceptions=True,
            )
        else:
            logger.info("No other clients to broadcast to")


async def broadcast_rating_update(image_filename, exclude_client=None):
    """Broadcast the full ratings feed for an image to all connected clients"""
    try:
        # Load the complete ratings data for this image
        ratings_data = load_image_ratings(image_filename)

        # Create broadcast message with full feed
        broadcast_data = {
            "type": "rating_feed_update",
            "image_filename": image_filename,
            "total_ratings": ratings_data["total_ratings"],
            "average_rating": ratings_data["average_rating"],
            "ratings_feed": ratings_data["ratings_feed"],
            "timestamp": datetime.now().isoformat(),
        }

        message = json.dumps(broadcast_data)
        logger.info(
            f"Broadcasting rating update for {image_filename} - {ratings_data['total_ratings']} ratings, avg: {ratings_data['average_rating']}"
        )

        # Print full feed to console for debugging
        print(f"\n=== RATINGS FEED UPDATE: {image_filename} ===")
        print(f"Total Ratings: {ratings_data['total_ratings']}")
        print(f"Average Rating: {ratings_data['average_rating']}/5")
        print("Feed (newest first):")
        for i, rating in enumerate(ratings_data["ratings_feed"]):
            print(
                f"  {i+1}. {rating['user_name']} ({rating['user_id'][:8]}): {rating['rating']}/5"
            )
            print(f"     Comment: '{rating['comment']}'")
            print(f"     Time: {rating['timestamp']}")
            print()
        print("=" * 50)

        await broadcast_message(message, exclude_client)

    except Exception as e:
        logger.error(f"Error broadcasting rating update: {e}")


async def periodic_heartbeat():
    """Send periodic heartbeat to all connected clients"""
    while True:
        await asyncio.sleep(30)  # Send heartbeat every 30 seconds
        if connected_clients:
            heartbeat = json.dumps(
                {
                    "type": "heartbeat",
                    "timestamp": datetime.now().isoformat(),
                    "connected_clients": len(connected_clients),
                }
            )
            await broadcast_message(heartbeat)


def start_http_server():
    """Start HTTP server to serve images"""

    class HTTPHandler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=os.getcwd(), **kwargs)

        def end_headers(self):
            self.send_header("Access-Control-Allow-Origin", "*")
            super().end_headers()

    httpd = socketserver.TCPServer(("0.0.0.0", 8766), HTTPHandler)
    logger.info("Starting HTTP server on localhost:8766 to serve images")
    httpd.serve_forever()


def main():
    """Start the WebSocket server"""
    host = "0.0.0.0"  # Bind to all interfaces
    port = 8765

    logger.info(f"Starting WebSocket server on {host}:{port}")
    logger.info("Server features:")
    logger.info("- Echoes back all received messages")
    logger.info("- Supports both JSON and plain text messages")
    logger.info("- Handles multiple concurrent connections")
    logger.info("- Sends periodic heartbeat messages")
    logger.info("- Serves images via HTTP on port 8766")

    # Start HTTP server in background thread
    http_thread = threading.Thread(target=start_http_server, daemon=True)
    http_thread.start()

    # Create the server
    start_server = websockets.serve(handle_client, host, port)

    # Create event loop
    loop = asyncio.get_event_loop()

    # Start the server and heartbeat task
    loop.run_until_complete(start_server)
    loop.run_until_complete(
        asyncio.gather(asyncio.Future(), periodic_heartbeat())  # Run forever
    )


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Server error: {e}")
