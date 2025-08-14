import React, { useState, useEffect } from 'react';
import {
    Grid,
    CardMedia,
    Typography,
    Box,
    Dialog,
    DialogContent,
    DialogTitle,
    IconButton,
    Chip
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

const Dashboard = ({ connectionStatus, isConnected, lastMessage }) => {
    const [selectedImage, setSelectedImage] = useState(null);
    const [images, setImages] = useState([]);

    // Listen for file list from WebSocket
    useEffect(() => {
        if (lastMessage && lastMessage.type === 'file_list') {
            const imageFiles = lastMessage.files.map((filename, index) => ({
                id: index + 1,
                filename: filename,
                path: `http://localhost:8766/pics/${filename}`
            }));
            setImages(imageFiles);
        }
    }, [lastMessage]);

    const handleImageClick = (image) => {
        setSelectedImage(image);
    };

    const handleCloseDialog = () => {
        setSelectedImage(null);
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
                                height="150"
                                image={image.path}
                                alt={image.filename}
                                sx={{
                                    objectFit: 'cover',
                                    width: '100%'
                                }}
                            />
                        </Box>
                    </Grid>
                ))}
            </Grid>

            {/* Full-size Image Dialog */}
            <Dialog
                open={Boolean(selectedImage)}
                onClose={handleCloseDialog}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: {
                        maxHeight: '90vh',
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
                            <Box
                                component="img"
                                src={selectedImage.path}
                                alt={selectedImage.filename}
                                sx={{
                                    width: '100%',
                                    height: 'auto',
                                    maxHeight: '70vh',
                                    objectFit: 'contain',
                                    display: 'block',
                                    margin: '0 auto'
                                }}
                            />
                        </DialogContent>
                    </>
                )}
            </Dialog>
        </Box>
    );
};

export default Dashboard;