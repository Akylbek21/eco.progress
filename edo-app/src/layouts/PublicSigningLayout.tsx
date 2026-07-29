import { AppBar, Box, Container, Toolbar, Typography } from '@mui/material';
import { Outlet } from 'react-router-dom';

export const PublicSigningLayout = () => (
  <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
    <AppBar elevation={0} position="static"><Toolbar><Typography fontWeight={900}>EcoProgress EDO · Внешнее подписание</Typography></Toolbar></AppBar>
    <Container maxWidth="md" sx={{ py: 5 }}><Outlet /></Container>
  </Box>
);
