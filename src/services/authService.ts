const TOKEN_KEY = 'eco-progress-token';

export const login = async (email: string, password: string) => {
  await new Promise((resolve) => setTimeout(resolve, 400));
  const token = btoa(`${email}:${password}`);
  localStorage.setItem(TOKEN_KEY, token);
  return { token, user: { email } };
};

export const logout = () => {
  localStorage.removeItem(TOKEN_KEY);
};

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const isAuthenticated = () => Boolean(getToken());
