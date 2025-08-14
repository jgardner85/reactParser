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
    Button
} from '@mui/material';
import { Close as CloseIcon, Star as StarIcon } from '@mui/icons-material';

const Dashboard = ({ connectionStatus, isConnected, lastMessage, sendJsonMessage }) => {
    const [selectedImage, setSelectedImage] = useState(null);
    const [images, setImages] = useState([]);
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');

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
        }
    }, [lastMessage]);

    const handleImageClick = (image) => {
        setSelectedImage(image);
        setRating(0);
        setComment('');
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
                timestamp: new Date().toISOString()
            };

            sendJsonMessage(ratingData);
            handleCloseDialog();
        }
    };

    const getStatusColor = () => {
        if (isConnected) return 'success';
        return 'default';
    };

    return (
        <Box sx={{ p: 3 }}>
            {/* Header with connection status */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Typography variant="h4" component="h1">
                    Image Dashboard
                </Typography>
                <Chip
                    label={`WebSocket: ${connectionStatus}`}
                    color={getStatusColor()}
                    size="small"
                    variant="outlined"
                />
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
                                sx={{
                                    objectFit: 'contain',
                                    width: '100%'
                                }}
                            />
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
        </Box>
    );
};

export default Dashboard;