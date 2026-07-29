import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Button, CircularProgress, LinearProgress, Stack, Typography } from '@mui/material';
import { Check } from 'lucide-react';
import { documentFlowPlansApi } from '../api/documentFlowApi';
import { documentFlowKeys } from '../api/documentFlowKeys';
import { AccessRequestDialog } from '../components/AccessRequestDialog';
import type { DocumentFlowPlan } from '../types';
import { getDocumentFlowError } from '../utils/errors';

const formatPrice = (plan: DocumentFlowPlan) => {
  if (plan.price === undefined) return 'По запросу';
  return new Intl.NumberFormat('ru-KZ', { style: 'currency', currency: plan.currency || 'KZT', maximumFractionDigits: 0 }).format(plan.price);
};

const formatBytes = (bytes?: number) => {
  if (bytes === undefined) return 'По тарифу';
  return `${Math.round(bytes / 1024 / 1024 / 1024)} ГБ`;
};

const DocumentFlowPricingPage = () => {
  const [selectedPlan, setSelectedPlan] = useState('');
  const query = useQuery({ queryKey: documentFlowKeys.plans(), queryFn: documentFlowPlansApi.list, retry: false });
  const plans = query.data?.filter((plan) => plan.active) || [];

  return (
    <div className="min-h-[70vh] bg-[#f6fafc] px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <p className="text-center text-sm font-black uppercase tracking-[.18em] text-eco-600">Тарифы документооборота</p>
        <h1 className="mx-auto mt-4 max-w-3xl text-center text-4xl font-black text-eco-950 sm:text-5xl">Возможности и лимиты возвращает backend</h1>
        <p className="mx-auto mt-5 max-w-2xl text-center leading-7 text-slate-600">Цены не зашиты во frontend. Здесь отображаются только активные тарифы из `/api/public/document-flow/plans`.</p>
        {query.isPending && <Box sx={{ mt: 8 }}><LinearProgress /><Typography sx={{ mt: 2 }} textAlign="center">Загружаем тарифы…</Typography></Box>}
        {query.isError && <Alert severity="error" sx={{ mt: 6 }}>{getDocumentFlowError(query.error, 'Не удалось загрузить тарифы.').message}</Alert>}
        {!query.isPending && !query.isError && plans.length === 0 && <Alert severity="info" sx={{ mt: 6 }}>Backend пока не опубликовал активные тарифы.</Alert>}
        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <article key={plan.code} className="flex flex-col rounded-[28px] border border-eco-100 bg-white p-6 shadow-sm">
              <p className="text-sm font-black uppercase tracking-wide text-eco-600">{plan.code}</p>
              <h2 className="mt-3 text-2xl font-black text-eco-950">{plan.name}</h2>
              <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{plan.description}</p>
              <p className="mt-6 text-3xl font-black text-eco-950">{formatPrice(plan)}</p>
              <p className="text-sm text-slate-500">{plan.period || 'условия по договору'}</p>
              {plan.trialDays ? <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">Пробный период: {plan.trialDays} дней</p> : null}
              <ul className="mt-6 flex-1 space-y-3 text-sm">
                <li className="flex gap-2"><Check size={17} className="text-emerald-600" /> Сотрудников: {plan.limits.members ?? 'по запросу'}</li>
                <li className="flex gap-2"><Check size={17} className="text-emerald-600" /> Документов/месяц: {plan.limits.documentsPerMonth ?? 'по запросу'}</li>
                <li className="flex gap-2"><Check size={17} className="text-emerald-600" /> Хранилище: {formatBytes(plan.limits.storageBytes)}</li>
                {plan.features.slice(0, 6).map((feature) => <li key={feature} className="flex gap-2"><Check size={17} className="text-emerald-600" /> {feature.replace(/_/g, ' ')}</li>)}
              </ul>
              <button onClick={() => setSelectedPlan(plan.code)} className="mt-7 rounded-full bg-eco-900 px-5 py-3 font-bold text-white">Подключить</button>
            </article>
          ))}
        </div>
      </div>
      <AccessRequestDialog open={!!selectedPlan} plans={plans} selectedPlan={selectedPlan} onClose={() => setSelectedPlan('')} />
    </div>
  );
};

export default DocumentFlowPricingPage;
