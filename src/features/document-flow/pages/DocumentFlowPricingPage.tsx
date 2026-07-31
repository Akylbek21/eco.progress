import { Alert, Box, Card, CardContent, Chip, CircularProgress, Container, Grid, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import PublicLayout from '../../../layouts/PublicLayout';
import { documentFlowApi } from '../api/documentFlowApi';
import { documentFlowKeys } from '../api/documentFlowKeys';

export default function DocumentFlowPricingPage() {
  const query = useQuery({
    queryKey: documentFlowKeys.plans(),
    queryFn: ({ signal }) => documentFlowApi.plans(signal),
  });
  return (
    <PublicLayout>
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Typography variant="h3" fontWeight={900}>Тарифы документооборота</Typography>
        <Typography color="text.secondary" mt={1}>Возможности определяются feature matrix backend, а не названием тарифа.</Typography>
        {query.isLoading && <Box py={8} textAlign="center"><CircularProgress /></Box>}
        {query.isError && <Alert severity="error" sx={{ mt: 3 }}>{query.error.message}</Alert>}
        <Grid container spacing={3} mt={2}>
          {(query.data || []).map((plan) => (
            <Grid size={{ xs: 12, md: 4 }} key={plan.code}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h5" fontWeight={800}>{plan.nameRu}</Typography>
                  <Typography variant="h4" mt={2}>{Number(plan.price).toLocaleString('ru-RU')} {plan.currency}</Typography>
                  <Typography color="text.secondary">{plan.billingPeriod}</Typography>
                  {plan.trialDays > 0 && <Chip sx={{ mt: 2 }} label={`${plan.trialDays} дней trial`} />}
                  <Typography mt={2}>{plan.descriptionRu}</Typography>
                  <Stack gap={1} mt={2}>
                    {plan.features.filter((feature) => feature.enabled).map((feature) => (
                      <Box key={feature.code}>✓ {feature.code}{feature.limitValue != null ? ` — ${feature.limitValue}` : ''}</Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </PublicLayout>
  );
}
