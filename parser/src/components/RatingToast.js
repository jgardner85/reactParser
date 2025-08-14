import React from 'react';
import {
    Snackbar,
    Alert,
    Box,
    Typography,
    Rating,
    Avatar
} from '@mui/material';
import { Star as StarIcon } from '@mui/icons-material';

const RatingToast = ({ open, onClose, onClick, ratingData }) => {
    if (!ratingData) return null;

    const latestRating = ratingData.ratings_feed[0]; // Newest rating (first in array)

    // Create a simple avatar from user name
    const getAvatarText = (name) => {
        return name ? name.charAt(0).toUpperCase() : '?';
    };

    const handleClick = () => {
        onClick(ratingData);
        onClose();
    };

    return (
        <Snackbar
            open={open}
            autoHideDuration={6000}
            onClose={onClose}
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
            <Alert
                severity="info"
                onClose={onClose}
                onClick={handleClick}
                sx={{
                    cursor: 'pointer',
                    minWidth: 300,
                    '&:hover': {
                        backgroundColor: 'action.hover'
                    }
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ width: 32, height: 32, fontSize: '0.875rem' }}>
                        {getAvatarText(latestRating.user_name)}
                    </Avatar>

                    <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                            {latestRating.user_name} rated an image
                        </Typography>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <Rating
                                value={latestRating.rating}
                                readOnly
                                size="small"
                                emptyIcon={<StarIcon style={{ opacity: 0.55 }} fontSize="inherit" />}
                            />
                            <Typography variant="caption" color="text.secondary">
                                ({latestRating.rating}/5)
                            </Typography>
                        </Box>

                        {latestRating.comment && (
                            <Typography
                                variant="body2"
                                sx={{
                                    mt: 0.5,
                                    fontStyle: 'italic',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    maxWidth: 200
                                }}
                            >
                                "{latestRating.comment}"
                            </Typography>
                        )}

                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                            {ratingData.image_filename} • Click to view feed
                        </Typography>
                    </Box>
                </Box>
            </Alert>
        </Snackbar>
    );
};

export default RatingToast;