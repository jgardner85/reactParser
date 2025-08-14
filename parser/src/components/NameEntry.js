import React, { useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    TextField,
    Button,
    Container
} from '@mui/material';
import { PhotoLibrary as PhotoIcon } from '@mui/icons-material';

const NameEntry = ({ onNameSubmit }) => {
    const [name, setName] = useState('');

    console.log('NameEntry rendered');

    const handleSubmit = () => {
        if (name.trim()) {
            onNameSubmit(name.trim());
        }
    };

    const handleKeyPress = (event) => {
        if (event.key === 'Enter') {
            handleSubmit();
        }
    };

    return (
        <Container maxWidth="sm">
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                <Card sx={{ width: '100%', maxWidth: 400 }}>
                    <CardContent sx={{ p: 4, textAlign: 'center' }}>
                        <PhotoIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />

                        <Typography variant="h4" component="h1" gutterBottom>
                            Image Rater
                        </Typography>

                        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                            Rate and comment on images with a simple 5-star system
                        </Typography>

                        <TextField
                            fullWidth
                            variant="outlined"
                            label="What's your name?"
                            placeholder="Enter your name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyPress={handleKeyPress}
                            sx={{ mb: 3 }}
                            autoFocus
                        />

                        <Button
                            fullWidth
                            variant="contained"
                            size="large"
                            onClick={handleSubmit}
                            disabled={!name.trim()}
                            sx={{ py: 1.5 }}
                        >
                            Ready to rate some pics? 📸
                        </Button>

                        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                            Your ratings are saved privately for each session
                        </Typography>
                    </CardContent>
                </Card>
            </Box>
        </Container>
    );
};

export default NameEntry;