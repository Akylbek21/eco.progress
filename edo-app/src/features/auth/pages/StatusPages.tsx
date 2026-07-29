import { Alert, Button, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { env } from '../../../app/config/env';

const Status = ({ title, text, action = 'Вернуться ко входу' }: { title: string; text: string; action?: string }) => <Stack spacing={2.5}><Typography variant="h4" fontWeight={900}>{title}</Typography><Alert severity="info">{text}</Alert><Button component={Link} to="/login" variant="contained">{action}</Button></Stack>;

export const AccessDeniedPage = () => <Status title="Нет доступа" text="Backend не предоставил право для открытия этого раздела." />;
export const SessionExpiredPage = () => <Status title="Сессия завершена" text="Сессия истекла или была отозвана. Войдите повторно." />;
export const ResendVerificationPage = () => <Status title="Повторная отправка" text="Запросите новый код на странице подтверждения email." action="Открыть страницу входа" />;
export const TermsPage = () => <Stack spacing={2}><Typography variant="h4" fontWeight={900}>Условия использования</Typography><Typography>Актуальные юридические условия публикуются владельцем сервиса EcoProgress EDO.</Typography><Button href={env.mainSiteUrl}>Основной сайт</Button></Stack>;
export const PrivacyPage = () => <Stack spacing={2}><Typography variant="h4" fontWeight={900}>Политика конфиденциальности</Typography><Typography>Система не сохраняет закрытые ключи, пароль PKCS12, CMS или полный ИИН в браузерном хранилище.</Typography><Button href={env.mainSiteUrl}>Основной сайт</Button></Stack>;
