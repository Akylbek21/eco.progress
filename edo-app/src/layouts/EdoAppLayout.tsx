import { useMemo, useState } from 'react';
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import DashboardIcon from '@mui/icons-material/Dashboard';
import InboxIcon from '@mui/icons-material/Inbox';
import OutboxIcon from '@mui/icons-material/Outbox';
import DrawIcon from '@mui/icons-material/Draw';
import DraftsIcon from '@mui/icons-material/Drafts';
import ArchiveIcon from '@mui/icons-material/Archive';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleIcon from '@mui/icons-material/People';
import DescriptionIcon from '@mui/icons-material/Description';
import HistoryIcon from '@mui/icons-material/History';
import SettingsIcon from '@mui/icons-material/Settings';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthSession } from '../features/auth/hooks/useAuthSession';
import { useDashboard, useDocumentTypes } from '../features/documents/hooks/useDocuments';
import { organizationsApi } from '../features/organizations/api/organizationsApi';
import { useAuthStore } from '../shared/auth/authStore';
import { useQueryClient } from '@tanstack/react-query';

const drawerWidth = 300;

const staticItems = [
  { label: 'Главная', path: '/app/dashboard', icon: <DashboardIcon /> },
  { label: 'Ожидают моей подписи', path: '/app/requires-my-signature', icon: <DrawIcon /> },
  { label: 'Черновики', path: '/app/drafts', icon: <DraftsIcon /> },
  { label: 'Архив', path: '/app/archive', icon: <ArchiveIcon /> },
  { label: 'Контрагенты', path: '/app/counterparties', icon: <BusinessIcon /> },
  { label: 'Шаблоны', path: '/app/templates', icon: <DescriptionIcon />, permission: 'TEMPLATE_MANAGE' },
  { label: 'Сотрудники', path: '/app/members', icon: <PeopleIcon />, permission: 'MEMBER_VIEW' },
  { label: 'Журнал действий', path: '/app/audit', icon: <HistoryIcon />, permission: 'AUDIT_VIEW' },
  { label: 'Настройки', path: '/app/settings/profile', icon: <SettingsIcon /> },
];

export const EdoAppLayout = () => {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('lg'));
  const location = useLocation();
  const navigate = useNavigate();
  const client = useQueryClient();
  const session = useAuthSession();
  const dashboard = useDashboard();
  const types = useDocumentTypes();
  const drawerOpen = useAuthStore((state) => state.drawerOpen);
  const setDrawerOpen = useAuthStore((state) => state.setDrawerOpen);
  const activeOrganizationId = useAuthStore((state) => state.activeOrganizationId);
  const setActiveOrganization = useAuthStore((state) => state.setActiveOrganization);
  const [expanded, setExpanded] = useState({ INCOMING: true, OUTGOING: true });
  const membership = session.data?.organizations.find((item) => item.organizationId === activeOrganizationId);
  const permissions = new Set(membership?.permissions || []);
  const grouped = useMemo(() => ({
    INCOMING: types.data?.filter((item) => item.direction === 'INCOMING') || [],
    OUTGOING: types.data?.filter((item) => item.direction === 'OUTGOING') || [],
  }), [types.data]);

  const activate = async (organizationId: string) => {
    await organizationsApi.activate(organizationId);
    setActiveOrganization(organizationId);
    client.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth' });
    navigate('/app/dashboard');
  };

  const navButton = (path: string, label: string, icon: React.ReactNode, badge?: number) => (
    <ListItemButton
      component={NavLink}
      to={path}
      selected={location.pathname === path}
      onClick={() => !desktop && setDrawerOpen(false)}
      sx={{ mx: 1, mb: .4, borderRadius: 2, '&.active,&.Mui-selected': { bgcolor: 'primary.main', color: 'white', '& .MuiListItemIcon-root': { color: 'white' } } }}
    >
      <ListItemIcon sx={{ minWidth: 40 }}>{icon}</ListItemIcon>
      <ListItemText primary={label} primaryTypographyProps={{ fontSize: 14, fontWeight: 700 }} />
      {typeof badge === 'number' && <Chip size="small" label={badge} />}
    </ListItemButton>
  );

  const drawer = (
    <Stack sx={{ width: drawerWidth, height: '100%', bgcolor: 'background.paper' }}>
      <Toolbar><Typography variant="h6" fontWeight={900} color="primary.dark">EcoProgress <Box component="span" color="primary.main">EDO</Box></Typography></Toolbar>
      <Box sx={{ px: 2, pb: 2 }}>
        {permissions.has('DOCUMENT_CREATE') && <Button fullWidth variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/app/documents/create')}>Создать документ</Button>}
      </Box>
      <List sx={{ overflowY: 'auto', flex: 1 }}>
        {navButton('/app/dashboard', 'Главная', <DashboardIcon />)}
        {(['INCOMING', 'OUTGOING'] as const).map((direction) => {
          const incoming = direction === 'INCOMING';
          return (
            <Box key={direction}>
              <ListItemButton onClick={() => setExpanded((value) => ({ ...value, [direction]: !value[direction] }))} aria-expanded={expanded[direction]} sx={{ mx: 1, borderRadius: 2 }}>
                <ListItemIcon sx={{ minWidth: 40 }}>{incoming ? <InboxIcon /> : <OutboxIcon />}</ListItemIcon>
                <ListItemText primary={incoming ? 'Входящие' : 'Исходящие'} primaryTypographyProps={{ fontSize: 14, fontWeight: 800 }} />
                <Chip size="small" label={incoming ? dashboard.data?.incoming ?? '—' : dashboard.data?.outgoing ?? '—'} />
                {expanded[direction] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </ListItemButton>
              <Collapse in={expanded[direction]}>
                <List disablePadding>
                  {navButton(`/app/${incoming ? 'incoming' : 'outgoing'}`, 'Все документы', incoming ? <InboxIcon fontSize="small" /> : <OutboxIcon fontSize="small" />)}
                  {grouped[direction].map((type) => navButton(`/app/${incoming ? 'incoming' : 'outgoing'}/${type.code}`, type.name, <DescriptionIcon fontSize="small" />, type.total))}
                </List>
              </Collapse>
            </Box>
          );
        })}
        <Divider sx={{ my: 1 }} />
        {staticItems.slice(1).filter((item) => !item.permission || permissions.has(item.permission)).map((item) =>
          navButton(item.path, item.label, item.icon, item.path.includes('requires') ? dashboard.data?.requiresMySignature : undefined),
        )}
      </List>
    </Stack>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" elevation={0} sx={{ zIndex: theme.zIndex.drawer + 1, bgcolor: 'rgba(255,255,255,.96)', color: 'text.primary', borderBottom: '1px solid', borderColor: 'divider', ml: { lg: `${drawerWidth}px` }, width: { lg: `calc(100% - ${drawerWidth}px)` } }}>
        <Toolbar sx={{ gap: 2 }}>
          {!desktop && <IconButton aria-label="Открыть меню" onClick={() => setDrawerOpen(true)}><MenuIcon /></IconButton>}
          <FormControl size="small" sx={{ minWidth: { xs: 160, md: 250 } }}>
            <Select value={activeOrganizationId || ''} onChange={(event) => void activate(event.target.value)} displayEmpty aria-label="Активная организация">
              {session.data?.organizations.map((organization) => <MenuItem key={organization.organizationId} value={organization.organizationId}>{organization.organizationName}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField placeholder="Глобальный поиск" sx={{ display: { xs: 'none', md: 'block' }, maxWidth: 420 }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }} />
          <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 'auto' }}>
            <Tooltip title="NCALayer"><Chip size="small" color="success" variant="outlined" label="NCALayer" /></Tooltip>
            <Tooltip title="Уведомления"><IconButton><Badge color="secondary" variant="dot"><NotificationsIcon /></Badge></IconButton></Tooltip>
            <Avatar sx={{ width: 36, height: 36 }}>{session.data?.user.firstName?.[0] || '?'}</Avatar>
          </Stack>
        </Toolbar>
      </AppBar>
      {desktop ? <Drawer variant="permanent" open sx={{ width: drawerWidth, '& .MuiDrawer-paper': { width: drawerWidth } }}>{drawer}</Drawer> : <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>{drawer}</Drawer>}
      <Box component="main" sx={{ flex: 1, minWidth: 0, p: { xs: 2, sm: 3, lg: 4 }, pt: { xs: 11, lg: 12 }, ml: { lg: 0 }, bgcolor: 'background.default' }}>
        <Outlet />
      </Box>
    </Box>
  );
};
