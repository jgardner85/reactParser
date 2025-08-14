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
    Drawer
} from '@mui/material';
import {
    Close as CloseIcon,
    Star as StarIcon,
    Notifications as NotificationsIcon,
    NotificationsNone as NotificationsNoneIcon
} from '@mui/icons-material';
import RatingToast from './RatingToast';

const Dashboard = ({ connectionStatus, isConnected, lastMessage, sendJsonMessage, userName }) => {
    const [selectedImage, setSelectedImage] = useState(null);
    const [images, setImages] = useState([]);
    const [imageMetadata, setImageMetadata] = useState({ total_count: 0, has_more: false, offset: 0 });
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [toastOpen, setToastOpen] = useState(false);
    const [toastData, setToastData] = useState(null);
    const [imageRatingsFeeds, setImageRatingsFeeds] = useState({}); // Store feeds for all images
    const [notifications, setNotifications] = useState([]); // Store all notifications
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

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
            setImageMetadata({
                total_count: lastMessage.total_count,
                has_more: lastMessage.has_more,
                offset: lastMessage.offset + lastMessage.files.length
            });
        }
    }, [lastMessage]);

    // Listen for more images from WebSocket
    useEffect(() => {
        if (lastMessage && lastMessage.type === 'more_images') {
            const hostname = window.location.hostname;
            const newImageFiles = lastMessage.files.map((filename, index) => ({
                id: images.length + index + 1,
                filename: filename,
                path: `http://${hostname}:8766/pics/${filename}`
            }));
            setImages(prev => [...prev, ...newImageFiles]);
            setImageMetadata({
                total_count: lastMessage.total_count,
                has_more: lastMessage.has_more,
                offset: lastMessage.offset + lastMessage.files.length
            });
        }
    }, [lastMessage, images.length]);

    // Listen for rating feed updates from other users
    useEffect(() => {
        if (lastMessage && lastMessage.type === 'rating_feed_update') {
            const feedData = lastMessage;

            // Store the ratings feed for this image
            setImageRatingsFeeds(prev => ({
                ...prev,
                [feedData.image_filename]: feedData
            }));

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

            console.log(`Loaded existing feed for ${feedData.image_filename}: ${feedData.total_ratings} ratings`);
        }
    }, [lastMessage]);

    const handleImageClick = (image) => {
        setSelectedImage(image);
        setRating(0);
        setComment('');

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
    };

    const handleSubmitRating = () => {
        if (selectedImage && rating > 0) {
            const ratingData = {
                type: 'image_rating',
                image_filename: selectedImage.filename,
                rating: rating,
                comment: comment,
                user_name: userName,
                timestamp: new Date().toISOString()
            };

            sendJsonMessage(ratingData);
            handleCloseDialog();
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

    const handleLoadMore = () => {
        if (sendJsonMessage && isConnected && imageMetadata.has_more) {
            sendJsonMessage({
                type: 'load_more_images',
                offset: imageMetadata.offset,
                limit: 20
            });
        }
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

            {/* Image Grid */}
            <Grid container spacing={2}>
                {images.map((image) => (
                    <Grid item xs={6} sm={4} md={3} lg={2} key={image.id}>
                        <Box
                            sx={{
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
                                loading="lazy"
                                sx={{
                                    objectFit: 'contain',
                                    width: '100%'
                                }}
                            />
                        </Box>
                    </Grid>
                ))}
            </Grid>

            {/* Load More Button */}
            {imageMetadata.has_more && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <Button
                        variant="outlined"
                        onClick={handleLoadMore}
                        disabled={!isConnected}
                        size="large"
                    >
                        Load More Images ({images.length} of {imageMetadata.total_count})
                    </Button>
                </Box>
            )}

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

                            {/* Existing Ratings Feed */}
                            {getCurrentImageFeed() && getCurrentImageFeed().ratings_feed.length > 0 && (
                                <Box sx={{ mb: 2 }}>
                                    <Divider sx={{ mb: 2 }} />
                                    <Typography variant="h6" gutterBottom>
                                        Comments Feed ({getCurrentImageFeed().total_ratings} ratings, avg: {getCurrentImageFeed().average_rating}/5)
                                    </Typography>
                                    <List dense>
                                        {getCurrentImageFeed().ratings_feed.map((feedRating, index) => (
                                            <ListItem key={index} alignItems="flex-start">
                                                <ListItemAvatar>
                                                    <Avatar sx={{ width: 32, height: 32, fontSize: '0.875rem' }}>
                                                        {getAvatarText(feedRating.user_name)}
                                                    </Avatar>
                                                </ListItemAvatar>
                                                <ListItemText
                                                    primary={
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                                                {feedRating.user_name}
                                                            </Typography>
                                                            <Rating
                                                                value={feedRating.rating}
                                                                readOnly
                                                                size="small"
                                                                emptyIcon={<StarIcon style={{ opacity: 0.55 }} fontSize="inherit" />}
                                                            />
                                                            <Typography variant="caption" color="text.secondary">
                                                                {new Date(feedRating.timestamp).toLocaleString()}
                                                            </Typography>
                                                        </Box>
                                                    }
                                                    secondary={
                                                        feedRating.comment && (
                                                            <Typography variant="body2" sx={{ mt: 0.5 }}>
                                                                {feedRating.comment}
                                                            </Typography>
                                                        )
                                                    }
                                                />
                                            </ListItem>
                                        ))}
                                    </List>
                                </Box>
                            )}
                        </DialogContent>

                        <DialogActions sx={{ p: 2, pt: 0 }}>
                            <Button onClick={handleCloseDialog} color="secondary">
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSubmitRating}
                                variant="contained"
                                disabled={rating === 0}
                                color="primary"
                            >
                                Submit Rating
                            </Button>
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