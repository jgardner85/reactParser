import React, { useState, useEffect } from 'react';
import {
    Grid,
    CardMedia,
    Typography,
    Box,
    Dialog,
    DialogContent,
    DialogTitle,
    DialogActions,
    IconButton,
    Chip,
    Rating,
    TextField,
    Button,
    List,
    ListItem,
    ListItemText,
    ListItemAvatar,
    Avatar,
    Divider,
    Badge,
    Drawer,
    FormControl,
    InputLabel,
    Select,
    MenuItem
} from '@mui/material';
import {
    Close as CloseIcon,
    Star as StarIcon,
    Notifications as NotificationsIcon,
    NotificationsNone as NotificationsNoneIcon,
    Favorite as FavoriteIcon,
    Delete as DeleteIcon
} from '@mui/icons-material';
import RatingToast from './RatingToast';

const Dashboard = ({ connectionStatus, isConnected, lastMessage, sendJsonMessage, userName, messages }) => {
    const [selectedImage, setSelectedImage] = useState(null);
    const [images, setImages] = useState([]);
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [toastOpen, setToastOpen] = useState(false);
    const [toastData, setToastData] = useState(null);
    const [imageRatingsFeeds, setImageRatingsFeeds] = useState({}); // Store feeds for all images
    const [userRatings, setUserRatings] = useState({}); // Store current user's ratings by image filename
    const [freshRatings, setFreshRatings] = useState(new Set()); // Track images with fresh ratings that shouldn't be overwritten
    const [currentUserId, setCurrentUserId] = useState(null); // Store current user's ID from server
    const [seenImages, setSeenImages] = useState(() => {
        // Load seen images from localStorage on component mount
        const saved = localStorage.getItem(`seenImages_${userName}`);
        return saved ? new Set(JSON.parse(saved)) : new Set();
    });
    const [categories, setCategories] = useState([]); // Store available categories
    const [selectedCategory, setSelectedCategory] = useState(''); // Store selected category for current image
    const [filterCategory, setFilterCategory] = useState('all'); // Store category filter for image grid
    const [localImageCategories, setLocalImageCategories] = useState({}); // Track locally submitted categories for immediate filter updates
    const [notifications, setNotifications] = useState([]); // Store all notifications
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    // Save seen images to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem(`seenImages_${userName}`, JSON.stringify([...seenImages]));
    }, [seenImages, userName]);

    // Listen for file list from WebSocket
    useEffect(() => {
        if (lastMessage && lastMessage.type === 'file_list') {
            const hostname = window.location.hostname;
            const imageFiles = lastMessage.files.map((filename, index) => ({
                id: index + 1,
                filename: filename,
                path: `http://${hostname}:8766/pics/${filename}`
            }));
            setImages(imageFiles);

            // Set categories if provided
            if (lastMessage.categories) {
                setCategories(lastMessage.categories);
            }

            // Capture the current user's ID
            if (lastMessage.user_id) {
                setCurrentUserId(lastMessage.user_id);

                // Request feeds for all images to load existing user ratings
                if (sendJsonMessage && isConnected) {
                    imageFiles.forEach(image => {
                        sendJsonMessage({
                            type: 'request_feed',
                            image_filename: image.filename
                        });
                    });
                }
            }
        }
    }, [lastMessage, sendJsonMessage, isConnected]);

    // Listen for file list updates (when images are trashed)
    useEffect(() => {
        if (lastMessage && lastMessage.type === 'file_list_update') {
            const hostname = window.location.hostname;
            const imageFiles = lastMessage.files.map((filename, index) => ({
                id: index + 1,
                filename: filename,
                path: `http://${hostname}:8766/pics/${filename}`
            }));
            setImages(imageFiles);

            // If we're currently viewing the removed image, close the dialog
            if (selectedImage && lastMessage.removed_file === selectedImage.filename) {
                setSelectedImage(null);
                setRating(0);
                setComment('');
            }

            console.log(`Image ${lastMessage.removed_file} was trashed, updated file list`);
        }
    }, [lastMessage, selectedImage]);

    // Function to extract current user's MOST RECENT rating from a feed (by username)
    const extractUserRating = (feedData, userName) => {
        if (!feedData || !feedData.ratings_feed || !userName) return null;

        // Find the most recent rating by this username (feed is sorted newest first)
        const userRating = feedData.ratings_feed.find(rating => rating.user_name === userName);

        console.log(`Heart check for ${feedData.image_filename}: Found rating ${userRating?.rating} for ${userName} at ${userRating?.timestamp}`);

        return userRating ? userRating.rating : null;
    };

    // Process all feed_response messages to ensure none are missed
    useEffect(() => {
        if (!messages || !userName) return;

        // Find any feed_response messages that haven't been processed yet
        const feedResponses = messages.filter(msg => msg.type === 'feed_response');

        feedResponses.forEach(message => {
            const feedData = message;

            // Store the ratings feed for this image
            setImageRatingsFeeds(prev => ({
                ...prev,
                [feedData.image_filename]: feedData
            }));

            // Extract and store current user's rating for this image (but don't overwrite fresh ratings)
            const userRating = extractUserRating(feedData, userName);
            console.log(`Frontend: Processing feed for ${feedData.image_filename}:`, {
                userName,
                userRating,
                shouldShowHeart: userRating >= 4,
                feedData: feedData.ratings_feed?.find(r => r.user_name === userName)
            });
            if (userRating !== null && !freshRatings.has(feedData.image_filename)) {
                setUserRatings(prev => ({
                    ...prev,
                    [feedData.image_filename]: userRating
                }));
            }
        });
    }, [messages, userName]);

    // Listen for rating feed updates from other users
    useEffect(() => {
        if (lastMessage && lastMessage.type === 'rating_feed_update') {
            const feedData = lastMessage;

            // Store the ratings feed for this image
            setImageRatingsFeeds(prev => ({
                ...prev,
                [feedData.image_filename]: feedData
            }));

            // Extract and store current user's rating for this image
            if (userName) {
                const userRating = extractUserRating(feedData, userName);
                console.log(`Frontend: Checking rating for ${feedData.image_filename}:`, {
                    userName,
                    userRating,
                    shouldShowHeart: userRating >= 4,
                    feedData: feedData.ratings_feed?.find(r => r.user_name === userName)
                });
                if (userRating !== null && !freshRatings.has(feedData.image_filename)) {
                    setUserRatings(prev => ({
                        ...prev,
                        [feedData.image_filename]: userRating
                    }));
                }
            }

            // Update local category cache when we receive server updates (unless we have a fresh local submission)
            if (!freshRatings.has(feedData.image_filename)) {
                // Get the most recent category from server data
                const serverCategory = (() => {
                    if (!feedData.ratings_feed || feedData.ratings_feed.length === 0) {
                        return null;
                    }
                    const ratingsWithCategory = feedData.ratings_feed.filter(rating => rating.category);
                    if (ratingsWithCategory.length === 0) {
                        return null;
                    }
                    const sortedRatings = ratingsWithCategory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                    return sortedRatings[0].category;
                })();

                // Update local cache with server data
                setLocalImageCategories(prev => ({
                    ...prev,
                    [feedData.image_filename]: serverCategory
                }));
            }

            // Show toast notification for the latest rating
            if (feedData.ratings_feed && feedData.ratings_feed.length > 0) {
                const latestRating = feedData.ratings_feed[0]; // Newest rating

                // Create notification object
                const notification = {
                    id: Date.now() + Math.random(),
                    type: 'rating_update',
                    feedData: feedData,
                    latestRating: latestRating,
                    timestamp: new Date().toISOString(),
                    read: false
                };

                // Add to notifications list
                setNotifications(prev => [notification, ...prev]);
                setUnreadCount(prev => prev + 1);

                // Show toast
                setToastData(feedData);
                setToastOpen(true);
            }
        }
    }, [lastMessage]);

    // Listen for feed responses (existing ratings when user clicks image)
    useEffect(() => {
        if (lastMessage && lastMessage.type === 'feed_response') {
            const feedData = lastMessage;

            // Store the ratings feed for this image (no toast for existing data)
            setImageRatingsFeeds(prev => ({
                ...prev,
                [feedData.image_filename]: feedData
            }));

            // Extract and store current user's rating for this image
            if (userName) {
                const userRating = extractUserRating(feedData, userName);
                console.log(`Frontend: Checking rating for ${feedData.image_filename}:`, {
                    userName,
                    userRating,
                    shouldShowHeart: userRating >= 4,
                    feedData: feedData.ratings_feed?.find(r => r.user_name === userName)
                });
                if (userRating !== null && !freshRatings.has(feedData.image_filename)) {
                    setUserRatings(prev => ({
                        ...prev,
                        [feedData.image_filename]: userRating
                    }));
                }
            }

            console.log(`Loaded existing feed for ${feedData.image_filename}: ${feedData.total_ratings} ratings`);
        }
    }, [lastMessage]);

    const handleImageClick = (image) => {
        setSelectedImage(image);
        setRating(0);
        setComment('');
        setSelectedCategory('');

        // Mark this image as seen
        setSeenImages(prev => new Set([...prev, image.filename]));

        // Request existing ratings feed for this image
        if (sendJsonMessage && isConnected) {
            sendJsonMessage({
                type: 'request_feed',
                image_filename: image.filename
            });
        }
    };

    const handleCloseDialog = () => {
        setSelectedImage(null);
        setRating(0);
        setComment('');
        setSelectedCategory('');
    };

    const getNextImage = () => {
        if (!selectedImage || !images.length) return null;

        // First, try to find an unseen image
        const unseenImages = images.filter(img => !seenImages.has(img.filename));
        if (unseenImages.length > 0) {
            // Return the first unseen image
            return unseenImages[0];
        }

        // If all images have been seen, fall back to next sequential image
        const currentIndex = images.findIndex(img => img.id === selectedImage.id);
        if (currentIndex >= 0 && currentIndex < images.length - 1) {
            return images[currentIndex + 1];
        }
        return null;
    };

    const openNextImage = () => {
        const nextImage = getNextImage();
        if (nextImage) {
            setSelectedImage(nextImage);
            setRating(0);
            setComment('');
            setSelectedCategory('');

            // Mark this image as seen
            setSeenImages(prev => new Set([...prev, nextImage.filename]));

            // Request existing ratings feed for the next image
            if (sendJsonMessage && isConnected) {
                sendJsonMessage({
                    type: 'request_feed',
                    image_filename: nextImage.filename
                });
            }
        } else {
            // No more images, close dialog
            handleCloseDialog();
        }
    };

    const handleSubmitRating = () => {
        if (selectedImage && (rating > 0 || comment.trim() !== '')) {
            const ratingData = {
                type: 'image_rating',
                image_filename: selectedImage.filename,
                rating: rating,
                comment: comment,
                category: selectedCategory,
                user_name: userName,
                timestamp: new Date().toISOString()
            };

            // Immediately update user's rating for this image (for heart display)
            setUserRatings(prev => ({
                ...prev,
                [selectedImage.filename]: rating
            }));

            // Immediately update local category for this image (for filter updates)
            setLocalImageCategories(prev => ({
                ...prev,
                [selectedImage.filename]: selectedCategory || null
            }));

            // Mark this rating as fresh so it doesn't get overwritten by server data
            setFreshRatings(prev => new Set([...prev, selectedImage.filename]));

            // Clear the fresh status after a few seconds to allow server updates
            setTimeout(() => {
                setFreshRatings(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(selectedImage.filename);
                    return newSet;
                });
            }, 3000);

            sendJsonMessage(ratingData);
            // Auto-advance to next image instead of closing
            openNextImage();
        }
    };

    const handleSkipImage = () => {
        // Skip to next image without rating
        openNextImage();
    };

    const handleTrashImage = (imageFilename, event) => {
        // Stop propagation to prevent opening the image dialog
        event.stopPropagation();

        if (sendJsonMessage && isConnected) {
            // Send trash request to server
            sendJsonMessage({
                type: 'trash_image',
                image_filename: imageFilename,
                user_name: userName,
                timestamp: new Date().toISOString()
            });

            // Immediately remove from local images list for instant feedback
            setImages(prev => prev.filter(img => img.filename !== imageFilename));

            // Clean up any ratings data for this image
            setUserRatings(prev => {
                const newRatings = { ...prev };
                delete newRatings[imageFilename];
                return newRatings;
            });

            setImageRatingsFeeds(prev => {
                const newFeeds = { ...prev };
                delete newFeeds[imageFilename];
                return newFeeds;
            });
        }
    };

    const handleToastClose = () => {
        setToastOpen(false);
    };

    const handleToastClick = (feedData) => {
        // Find the image that was rated and open its modal
        const image = images.find(img => img.filename === feedData.image_filename);
        if (image) {
            setSelectedImage(image);
            setRating(0);
            setComment('');

            // Request existing ratings feed for this image (in case there are more ratings than just the latest)
            if (sendJsonMessage && isConnected) {
                sendJsonMessage({
                    type: 'request_feed',
                    image_filename: image.filename
                });
            }
        }
    };

    const getCurrentImageFeed = () => {
        if (!selectedImage) return null;
        return imageRatingsFeeds[selectedImage.filename] || null;
    };

    const getAvatarText = (name) => {
        return name ? name.charAt(0).toUpperCase() : '?';
    };

    const getCategoryName = (categoryId) => {
        const category = categories.find(cat => cat.id === categoryId);
        return category ? category.name : categoryId;
    };

    const getCategoryColor = (categoryId) => {
        const category = categories.find(cat => cat.id === categoryId);
        return category ? category.color : '#607D8B';
    };

    const getImageCategory = (imageFilename) => {
        // First check if we have a locally submitted category (for immediate filter updates)
        if (localImageCategories.hasOwnProperty(imageFilename)) {
            console.log(`Using local category for ${imageFilename}:`, localImageCategories[imageFilename]);
            return localImageCategories[imageFilename];
        }

        // Fallback to server data
        const feed = imageRatingsFeeds[imageFilename];
        if (!feed || !feed.ratings_feed || feed.ratings_feed.length === 0) {
            return null;
        }

        // Find the most recent rating with a category
        const ratingsWithCategory = feed.ratings_feed.filter(rating => rating.category);
        if (ratingsWithCategory.length === 0) {
            return null;
        }

        // Sort by timestamp (newest first) and get the most recent category
        const sortedRatings = ratingsWithCategory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return sortedRatings[0].category;
    };

    const getFilteredImages = () => {
        if (filterCategory === 'all') {
            return images;
        }

        if (filterCategory === 'uncategorized') {
            return images.filter(image => !getImageCategory(image.filename));
        }

        return images.filter(image => getImageCategory(image.filename) === filterCategory);
    };

    const handleNotificationsOpen = () => {
        setNotificationsOpen(true);
    };

    const handleNotificationsClose = () => {
        setNotificationsOpen(false);
    };

    const handleNotificationClick = (notification) => {
        // Mark notification as read
        setNotifications(prev =>
            prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));

        // Open the image modal for this notification
        const image = images.find(img => img.filename === notification.feedData.image_filename);
        if (image) {
            setSelectedImage(image);
            setRating(0);
            setComment('');
            setNotificationsOpen(false);

            // Request existing ratings feed for this image
            if (sendJsonMessage && isConnected) {
                sendJsonMessage({
                    type: 'request_feed',
                    image_filename: image.filename
                });
            }
        }
    };

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
    };

    const clearAllNotifications = () => {
        setNotifications([]);
        setUnreadCount(0);
    };

    const getStatusColor = () => {
        if (isConnected) return 'success';
        return 'default';
    };

    return (
        <Box sx={{ p: 3 }}>
            {/* Header with user name and connection status */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box>
                    <Typography variant="h4" component="h1">
                        Welcome, {userName}! 👋
                    </Typography>
                    <Typography variant="subtitle1" color="text.secondary">
                        Rate and comment on the images below
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <IconButton onClick={handleNotificationsOpen} color="primary">
                        <Badge badgeContent={unreadCount} color="error">
                            {unreadCount > 0 ? <NotificationsIcon /> : <NotificationsNoneIcon />}
                        </Badge>
                    </IconButton>
                    <Chip
                        label={`WebSocket: ${connectionStatus}`}
                        color={getStatusColor()}
                        size="small"
                        variant="outlined"
                    />
                </Box>
            </Box>

            {/* Category Filter */}
            {categories.length > 0 && (
                <Box sx={{ mb: 3 }}>
                    <FormControl variant="outlined" sx={{ minWidth: 200 }}>
                        <InputLabel>Filter by Category</InputLabel>
                        <Select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            label="Filter by Category"
                        >
                            <MenuItem value="all">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography>All Images</Typography>
                                </Box>
                            </MenuItem>
                            <MenuItem value="uncategorized">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box
                                        sx={{
                                            width: 12,
                                            height: 12,
                                            backgroundColor: '#9E9E9E',
                                            borderRadius: '50%'
                                        }}
                                    />
                                    <Typography>Uncategorized</Typography>
                                </Box>
                            </MenuItem>
                            {categories.map((category) => (
                                <MenuItem key={category.id} value={category.id}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Box
                                            sx={{
                                                width: 12,
                                                height: 12,
                                                backgroundColor: category.color,
                                                borderRadius: '50%'
                                            }}
                                        />
                                        <Typography>{category.name}</Typography>
                                    </Box>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>
            )}

            {/* Image Grid */}
            <Grid container spacing={2}>
                {getFilteredImages().map((image) => (
                    <Grid item xs={6} sm={4} md={3} lg={2} key={image.id}>
                        <Box
                            sx={{
                                position: 'relative',
                                cursor: 'pointer',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                                borderRadius: 2,
                                overflow: 'hidden',
                                backgroundColor: '#f5f5f5',
                                '&:hover': {
                                    transform: 'scale(1.05)',
                                    boxShadow: (theme) => theme.shadows[8]
                                }
                            }}
                            onClick={() => handleImageClick(image)}
                        >
                            <CardMedia
                                component="img"
                                height="100"
                                image={image.path}
                                alt={image.filename}
                                sx={{
                                    objectFit: 'contain',
                                    width: '100%'
                                }}
                            />
                            {/* Heart overlay for user's favorites (4+ star ratings) */}
                            {userRatings[image.filename] >= 4 && (
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        top: 8,
                                        right: 8,
                                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                        borderRadius: '50%',
                                        padding: 0.5,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <FavoriteIcon
                                        sx={{
                                            color: '#ff1744',
                                            fontSize: 16
                                        }}
                                    />
                                </Box>
                            )}

                            {/* Trash icon overlay */}
                            <Box
                                sx={{
                                    position: 'absolute',
                                    top: 8,
                                    left: 8,
                                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                    borderRadius: '50%',
                                    padding: 0.5,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    '&:hover': {
                                        backgroundColor: 'rgba(255, 0, 0, 0.1)',
                                        transform: 'scale(1.1)'
                                    },
                                    transition: 'all 0.2s'
                                }}
                                onClick={(e) => handleTrashImage(image.filename, e)}
                            >
                                <DeleteIcon
                                    sx={{
                                        color: '#f44336',
                                        fontSize: 16
                                    }}
                                />
                            </Box>
                        </Box>
                    </Grid>
                ))}
            </Grid>

            {/* Full-size Image Dialog with Rating */}
            <Dialog
                open={Boolean(selectedImage)}
                onClose={handleCloseDialog}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: {
                        maxHeight: '95vh',
                        backgroundColor: 'background.paper'
                    }
                }}
            >
                {selectedImage && (
                    <>
                        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="h6">{selectedImage.filename}</Typography>
                            <IconButton onClick={handleCloseDialog} size="small">
                                <CloseIcon />
                            </IconButton>
                        </DialogTitle>

                        <DialogContent sx={{ p: 2 }}>
                            {/* Full-size Image */}
                            <Box
                                component="img"
                                src={selectedImage.path}
                                alt={selectedImage.filename}
                                sx={{
                                    width: '100%',
                                    height: 'auto',
                                    maxHeight: { xs: '40vh', sm: '50vh' },
                                    objectFit: 'contain',
                                    display: 'block',
                                    margin: '0 auto 20px auto',
                                    borderRadius: 1
                                }}
                            />

                            {/* Rating Section */}
                            <Box sx={{ mb: 3 }}>
                                <Typography variant="h6" gutterBottom>
                                    Rate this image
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                                    <Rating
                                        name="image-rating"
                                        value={rating}
                                        onChange={(event, newValue) => setRating(newValue)}
                                        size="large"
                                        emptyIcon={<StarIcon style={{ opacity: 0.55 }} fontSize="inherit" />}
                                    />
                                    <Typography variant="body2" color="text.secondary">
                                        {rating > 0 ? `${rating}/5 stars` : 'No rating'}
                                    </Typography>
                                </Box>
                            </Box>

                            {/* Category Selection */}
                            {categories.length > 0 && (
                                <Box sx={{ mb: 2 }}>
                                    <Typography variant="h6" gutterBottom>
                                        Categorize
                                    </Typography>
                                    <FormControl fullWidth variant="outlined">
                                        <InputLabel>Select a category (optional)</InputLabel>
                                        <Select
                                            value={selectedCategory}
                                            onChange={(e) => setSelectedCategory(e.target.value)}
                                            label="Select a category (optional)"
                                        >
                                            <MenuItem value="">
                                                <em>No category</em>
                                            </MenuItem>
                                            {categories.map((category) => (
                                                <MenuItem key={category.id} value={category.id}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Box
                                                            sx={{
                                                                width: 12,
                                                                height: 12,
                                                                backgroundColor: category.color,
                                                                borderRadius: '50%'
                                                            }}
                                                        />
                                                        {category.name}
                                                    </Box>
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Box>
                            )}

                            {/* Comment Section */}
                            <Box sx={{ mb: 2 }}>
                                <Typography variant="h6" gutterBottom>
                                    Add a comment
                                </Typography>
                                <TextField
                                    fullWidth
                                    multiline
                                    rows={3}
                                    placeholder="What do you think about this image?"
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    variant="outlined"
                                />
                            </Box>

                            {/* Chronological Conversation Thread */}
                            {(() => {
                                const currentFeed = getCurrentImageFeed();
                                if (!currentFeed || currentFeed.ratings_feed.length === 0) return null;

                                // Create chronological conversation thread from all users
                                const conversationThread = [];

                                currentFeed.ratings_feed.forEach(feedRating => {
                                    // Add rating as a conversation item if it exists
                                    if (feedRating.rating > 0) {
                                        conversationThread.push({
                                            type: 'rating',
                                            user_name: feedRating.user_name,
                                            rating: feedRating.rating,
                                            time_rating: feedRating.time_rating,
                                            category: feedRating.category,
                                            timestamp: feedRating.timestamp,
                                            id: `rating-${feedRating.user_name}-${feedRating.timestamp}`
                                        });
                                    }

                                    // Add all comments from this user to the thread
                                    if (feedRating.comments && feedRating.comments.length > 0) {
                                        feedRating.comments.forEach((commentObj, commentIndex) => {
                                            conversationThread.push({
                                                type: 'comment',
                                                user_name: feedRating.user_name,
                                                comment: commentObj.comment,
                                                timestamp: commentObj.timestamp,
                                                id: `comment-${feedRating.user_name}-${commentIndex}-${commentObj.timestamp}`
                                            });
                                        });
                                    } else if (feedRating.comment) {
                                        // Fallback for old single comment format
                                        conversationThread.push({
                                            type: 'comment',
                                            user_name: feedRating.user_name,
                                            comment: feedRating.comment,
                                            timestamp: feedRating.timestamp,
                                            id: `comment-${feedRating.user_name}-${feedRating.timestamp}`
                                        });
                                    }
                                });

                                // Sort by timestamp (newest first, reverse chronological)
                                conversationThread.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

                                return (
                                    <Box sx={{ mb: 2 }}>
                                        <Divider sx={{ mb: 2 }} />
                                        <Typography variant="h6" gutterBottom>
                                            Conversation ({currentFeed.total_ratings} ratings, avg: {currentFeed.average_rating}/5)
                                        </Typography>
                                        <List dense>
                                            {conversationThread.map((item) => (
                                                <ListItem key={item.id} alignItems="flex-start">
                                                    <ListItemAvatar>
                                                        <Avatar sx={{ width: 32, height: 32, fontSize: '0.875rem' }}>
                                                            {getAvatarText(item.user_name)}
                                                        </Avatar>
                                                    </ListItemAvatar>
                                                    <ListItemText
                                                        primary={
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                                                    {item.user_name}
                                                                </Typography>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {new Date(item.timestamp).toLocaleString()}
                                                                </Typography>
                                                            </Box>
                                                        }
                                                        secondary={
                                                            item.type === 'rating' ? (
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                        <Rating
                                                                            value={item.rating}
                                                                            readOnly
                                                                            size="small"
                                                                            emptyIcon={<StarIcon style={{ opacity: 0.55 }} fontSize="inherit" />}
                                                                        />
                                                                        <Typography variant="caption" color="text.secondary">
                                                                            ({item.rating}/5)
                                                                        </Typography>
                                                                    </Box>
                                                                    {item.time_rating && (
                                                                        <Chip
                                                                            label={item.time_rating}
                                                                            size="small"
                                                                            variant="outlined"
                                                                            color="primary"
                                                                        />
                                                                    )}
                                                                    {item.category && (
                                                                        <Chip
                                                                            label={getCategoryName(item.category)}
                                                                            size="small"
                                                                            variant="outlined"
                                                                            sx={{
                                                                                borderColor: getCategoryColor(item.category),
                                                                                color: getCategoryColor(item.category),
                                                                                '&::before': {
                                                                                    content: '""',
                                                                                    width: 8,
                                                                                    height: 8,
                                                                                    borderRadius: '50%',
                                                                                    backgroundColor: getCategoryColor(item.category),
                                                                                    marginRight: 0.5,
                                                                                    display: 'inline-block'
                                                                                }
                                                                            }}
                                                                        />
                                                                    )}
                                                                </Box>
                                                            ) : (
                                                                <Typography variant="body2" sx={{ mt: 0.5 }}>
                                                                    {item.comment}
                                                                </Typography>
                                                            )
                                                        }
                                                    />
                                                </ListItem>
                                            ))}
                                        </List>
                                    </Box>
                                );
                            })()}
                        </DialogContent>

                        <DialogActions sx={{ p: 2, pt: 0, justifyContent: 'space-between' }}>
                            <Button onClick={handleCloseDialog} color="secondary">
                                Close
                            </Button>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button
                                    onClick={handleSkipImage}
                                    color="info"
                                    variant="outlined"
                                >
                                    Skip → Next
                                </Button>
                                <Button
                                    onClick={handleSubmitRating}
                                    variant="contained"
                                    disabled={rating === 0 && comment.trim() === ''}
                                    color="primary"
                                >
                                    {getNextImage() ? 'Submit & Next →' : 'Submit & Finish'}
                                </Button>
                            </Box>
                        </DialogActions>
                    </>
                )}
            </Dialog>

            {/* Notifications Drawer */}
            <Drawer
                anchor="right"
                open={notificationsOpen}
                onClose={handleNotificationsClose}
            >
                <Box sx={{ width: 400, p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">
                            Notifications ({notifications.length})
                        </Typography>
                        <Box>
                            {unreadCount > 0 && (
                                <Button size="small" onClick={markAllAsRead} sx={{ mr: 1 }}>
                                    Mark All Read
                                </Button>
                            )}
                            <Button size="small" onClick={clearAllNotifications}>
                                Clear All
                            </Button>
                            <IconButton onClick={handleNotificationsClose} size="small">
                                <CloseIcon />
                            </IconButton>
                        </Box>
                    </Box>

                    <Divider sx={{ mb: 2 }} />

                    {notifications.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                            No notifications yet. You'll see updates here when others rate images!
                        </Typography>
                    ) : (
                        <List>
                            {notifications.map((notification) => (
                                <ListItem
                                    key={notification.id}
                                    button
                                    onClick={() => handleNotificationClick(notification)}
                                    sx={{
                                        backgroundColor: notification.read ? 'transparent' : 'action.hover',
                                        borderRadius: 1,
                                        mb: 1,
                                        border: notification.read ? 'none' : '1px solid',
                                        borderColor: 'primary.main'
                                    }}
                                >
                                    <ListItemAvatar>
                                        <Avatar sx={{ width: 32, height: 32, fontSize: '0.875rem' }}>
                                            {getAvatarText(notification.latestRating.user_name)}
                                        </Avatar>
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={
                                            <Box>
                                                <Typography variant="subtitle2" sx={{ fontWeight: notification.read ? 'normal' : 'bold' }}>
                                                    {notification.latestRating.user_name} rated {notification.feedData.image_filename}
                                                </Typography>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                                    <Rating
                                                        value={notification.latestRating.rating}
                                                        readOnly
                                                        size="small"
                                                        emptyIcon={<StarIcon style={{ opacity: 0.55 }} fontSize="inherit" />}
                                                    />
                                                    <Typography variant="caption" color="text.secondary">
                                                        ({notification.latestRating.rating}/5)
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        }
                                        secondary={
                                            <Box>
                                                {notification.latestRating.comment && (
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            fontStyle: 'italic',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            mt: 0.5
                                                        }}
                                                    >
                                                        "{notification.latestRating.comment}"
                                                    </Typography>
                                                )}
                                                <Typography variant="caption" color="text.secondary">
                                                    {new Date(notification.timestamp).toLocaleString()}
                                                </Typography>
                                            </Box>
                                        }
                                    />
                                </ListItem>
                            ))}
                        </List>
                    )}
                </Box>
            </Drawer>

            {/* Toast Notification for Rating Updates */}
            <RatingToast
                open={toastOpen}
                onClose={handleToastClose}
                onClick={handleToastClick}
                ratingData={toastData}
            />
        </Box>
    );
};

export default Dashboard;