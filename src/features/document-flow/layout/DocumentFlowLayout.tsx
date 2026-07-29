import { useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  AppBar, Avatar, Box, Chip, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText,
  Toolbar, Tooltip, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import {
  Archive, Bell, Building2, FileClock, FileInput, FileOutput, FileSignature, Home, Menu, Plus,
  ScrollText, Settings, ShieldCheck, Users, Wifi,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useDocumentFlowAccess } from '../access/DocumentFlowAccessProvider';

const width = 280;

const items = [
  { label: 'Главная', path: '/document-flow/app/dashboard', icon: Home },
  { label: 'Входящие', path: '/document-flow/app/incoming', icon: FileInput, permission: 'DOCUMENT_VIEW' },
  { label: 'Исходящие', path: '/document-flow/app/outgoing', icon: FileOutput, permission: 'DOCUMENT_VIEW' },
  { label: 'Ожидают моей подписи', path: '/document-flow/app/requires-my-signature', icon: FileSignature, permission: 'DOCUMENT_SIGN' },
  { label: 'Черновики', path: '/document-flow/app/drafts', icon: FileClock, permission: 'DOCUMENT_VIEW' },
  { label: 'Архив', path: '/document-flow/app/archive', icon: Archive, permission: 'DOCUMENT_VIEW' },
  { label: 'Запросы на отзыв', path: '/document-flow/app/revocation-requests', icon: ScrollText, permission: 'DOCUMENT_REVOKE' },
  { label: 'Контрагенты', path: '/document-flow/app/counterparties', icon: Building2, permission: 'COUNTERPARTY_MANAGE' },
  { label: 'Сотрудники', path: '/document-flow/app/members', icon: Users, permission: 'MEMBER_MANAGE' },
  { label: 'Шаблоны', path: '/document-flow/app/templates', icon: ScrollText, permission: 'TEMPLATE_MANAGE', feature: 'TEMPLATES' },
  { label: 'Журнал действий', path: '/document-flow/app/audit', icon: ShieldCheck, permission: 'AUDIT_VIEW', feature: 'AUDIT_LOG' },
  { label: 'Настройки', path: '/document-flow/app/settings', icon: Settings },
] as const;

const DocumentFlowLayout = ({ children }: { children: ReactNode }) => {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('lg'));
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { access, can, hasFeature, hasAction } = useDocumentFlowAccess();
  const visibleItems = useMemo(() => items.filter((item) =>
    (!('permission' in item) || can(item.permission))
    && (!('feature' in item) || hasFeature(item.feature)),
  ), [access.permissions, access.features]);
  const readOnly = access.readOnly || ['READ_ONLY', 'EXPIRED'].includes(access.status);

  const navigation = (
    <Box sx={{ px: 1.5, py: 2 }}>
      <Box component={Link} to="/" sx={{ display: 'block', px: 1.5, mb: 2, color: '#06385d', textDecoration: 'none' }}>
        <Typography fontWeight={950} fontSize={19}>ecoprogress.kz</Typography>
        <Typography variant="caption" color="text.secondary">Документооборот</Typography>
      </Box>
      {!readOnly && can('DOCUMENT_CREATE') && hasAction('CREATE_DOCUMENT') && (
        <ListItemButton onClick={() => navigate('/document-flow/app/documents/create')} sx={{ bgcolor: '#075985', color: 'white', borderRadius: 2.5, mb: 2, '&:hover': { bgcolor: '#06466b' } }}>
          <ListItemIcon sx={{ minWidth: 38, color: 'inherit' }}><Plus size={19} /></ListItemIcon><ListItemText primary="Создать документ" primaryTypographyProps={{ fontWeight: 800 }} />
        </ListItemButton>
      )}
      <List disablePadding>
        {visibleItems.map(({ label, path, icon: Icon }) => (
          <ListItemButton key={path} component={NavLink} to={path} onClick={() => setOpen(false)}
            sx={{ borderRadius: 2, mb: 0.4, color: '#475569', '&.active': { bgcolor: '#e0f2fe', color: '#075985' } }}>
            <ListItemIcon sx={{ minWidth: 38, color: 'inherit' }}><Icon size={18} /></ListItemIcon>
            <ListItemText primary={label} primaryTypographyProps={{ fontSize: 14, fontWeight: 700 }} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f9fb' }}>
      <AppBar position="fixed" elevation={0} sx={{ bgcolor: 'white', color: '#0f172a', borderBottom: '1px solid #e2e8f0', ml: { lg: `${width}px` }, width: { lg: `calc(100% - ${width}px)` } }}>
        <Toolbar sx={{ gap: 1.5 }}>
          {!desktop && <IconButton onClick={() => setOpen(true)} aria-label="Открыть меню"><Menu /></IconButton>}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography fontWeight={900} noWrap>{access.organization?.name || user?.companyName || 'Документооборот'}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>{access.plan?.name || 'Тариф не указан'}{access.expiresAt ? ` · до ${new Date(access.expiresAt).toLocaleDateString('ru-KZ')}` : ''}</Typography>
          </Box>
          <Chip size="small" color={readOnly ? 'warning' : access.status === 'TRIAL' ? 'info' : 'success'} label={readOnly ? 'Только просмотр' : access.status === 'TRIAL' ? 'Пробный период' : access.status} />
          <Tooltip title="NCALayer подключается только перед подписью"><Chip size="small" variant="outlined" icon={<Wifi size={14} />} label="NCALayer" /></Tooltip>
          <IconButton aria-label="Уведомления"><Bell size={19} /></IconButton>
          <Tooltip title={user?.name || user?.email || 'Профиль'}><Avatar sx={{ width: 34, height: 34, bgcolor: '#075985', fontSize: 14 }}>{(user?.name || user?.email || 'U').slice(0, 1).toUpperCase()}</Avatar></Tooltip>
        </Toolbar>
      </AppBar>
      <Drawer variant={desktop ? 'permanent' : 'temporary'} open={desktop || open} onClose={() => setOpen(false)}
        sx={{ '& .MuiDrawer-paper': { width, boxSizing: 'border-box', borderRight: '1px solid #e2e8f0' } }}>
        {navigation}
      </Drawer>
      <Box component="main" sx={{ ml: { lg: `${width}px` }, pt: '64px', minHeight: '100vh' }}>
        {readOnly && <Box sx={{ bgcolor: '#fff7ed', borderBottom: '1px solid #fed7aa', color: '#9a3412', px: 3, py: 1.3, fontWeight: 800 }}>Срок доступа истёк. Раздел работает в режиме просмотра.</Box>}
        {access.status === 'GRACE_PERIOD' && <Box sx={{ bgcolor: '#fffbeb', borderBottom: '1px solid #fde68a', color: '#92400e', px: 3, py: 1.3, fontWeight: 800 }}>Срок оплаты истёк. Доступ будет ограничен после указанной даты.</Box>}
        <Box sx={{ p: { xs: 2, md: 3.5 } }}>{children}</Box>
      </Box>
    </Box>
  );
};

export default DocumentFlowLayout;

