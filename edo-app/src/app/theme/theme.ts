import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#0E5C9E', dark: '#063B6D', light: '#87C9F9' },
    secondary: { main: '#38C7BA' },
    background: { default: '#F5F9FB', paper: '#FFFFFF' },
    text: { primary: '#092A46', secondary: '#607184' },
    warning: { main: '#C27A16' },
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
    h1: { fontWeight: 800 },
    h2: { fontWeight: 800 },
    h3: { fontWeight: 750 },
    button: { textTransform: 'none', fontWeight: 700 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { minHeight: 44, borderRadius: 12 } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiTextField: { defaultProps: { fullWidth: true, size: 'small' } },
  },
});
