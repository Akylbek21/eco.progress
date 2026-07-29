import { Box, Container, Link as MuiLink, Paper, Stack, Typography } from '@mui/material';
import { Link, Outlet } from 'react-router-dom';
import { env } from '../app/config/env';

export const AuthLayout = () => (
  <Box sx={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: { md: 'minmax(360px, .85fr) 1.15fr' }, bgcolor: 'background.default' }}>
    <Box sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', justifyContent: 'space-between', p: 6, color: 'white', background: 'linear-gradient(145deg, #021C39, #0E5C9E)' }}>
      <Typography variant="h5" fontWeight={900}>EcoProgress EDO</Typography>
      <Box>
        <Typography variant="h2" sx={{ maxWidth: 620, fontSize: { md: 44, lg: 56 } }}>Документы и подписи — в защищённом пространстве</Typography>
        <Typography sx={{ mt: 3, maxWidth: 560, color: 'rgba(255,255,255,.72)', lineHeight: 1.8 }}>Отдельная система электронного документооборота с собственными пользователями, организациями и сессиями.</Typography>
      </Box>
      <MuiLink href={env.mainSiteUrl} color="inherit" underline="hover">ecoprogress.kz</MuiLink>
    </Box>
    <Container maxWidth="sm" sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
      <Paper elevation={0} sx={{ width: '100%', p: { xs: 3, sm: 5 }, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
          <Typography component={Link} to="/login" variant="h6" fontWeight={900} color="primary.dark" sx={{ textDecoration: 'none' }}>EcoProgress EDO</Typography>
        </Stack>
        <Outlet />
      </Paper>
    </Container>
  </Box>
);
