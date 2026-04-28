import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../services/authService';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

const LoginPage = ({ onSuccess }: { onSuccess?: () => void }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email || !password) {
      setError('Пожалуйста, заполните оба поля.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      onSuccess?.();
      navigate('/cabinet');
    } catch (err) {
      setError('Не удалось выполнить вход. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-eco-50 py-16">
      <div className="mx-auto max-w-md px-6">
        <Card>
          <div className="space-y-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-eco-700">Личный кабинет</p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-900">Вход в Eco.Progress</h1>
              <p className="mt-2 text-slate-600">Введите email и пароль, чтобы продолжить работу с документами и заявками.</p>
            </div>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@mail.com"
              />
              <Input
                label="Пароль"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Пароль"
              />
              {error && <p className="text-sm text-rose-600">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Загрузка...' : 'Войти'}
              </Button>
            </form>
            <div className="flex items-center justify-between text-sm text-slate-600">
              <Link to="/" className="text-eco-700 hover:text-eco-800">Забыли пароль?</Link>
              <Link to="/" className="text-eco-700 hover:text-eco-800">Создать аккаунт</Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
