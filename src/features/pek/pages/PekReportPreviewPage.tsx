import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { pekService } from '../api/pekService';
import { PekLoading, PekPageHeader, PekState } from '../components/common/PekUi';
import { mapPekError } from '../utils/pekErrorMapper';

const PekReportPreviewPage = () => {
  const id = Number(useParams().reportId);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setError('');
    void pekService.downloadPreviewPdf(id)
      .then((result) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(result.blob);
        setUrl(objectUrl);
      })
      .catch((failure) => {
        if (active) setError(mapPekError(failure).message);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attempt, id]);

  return <div className="space-y-5">
    <PekPageHeader
      title="Предпросмотр отчёта ПЭК"
      description="Черновой PDF формируется backend. Официальный файл не создаётся из состояния браузера."
      actions={<Link className="rounded-full border px-5 py-2 text-sm font-bold" to={`/staff/pek/reports/${id}`}>Вернуться к отчёту</Link>}
    />
    {error
      ? <PekState title="Не удалось сформировать предпросмотр" message={error} retry={() => setAttempt((value) => value + 1)} />
      : !url
        ? <PekLoading />
        : <iframe title="Предпросмотр отчёта ПЭК" src={url} className="h-[calc(100vh-15rem)] min-h-[520px] w-full rounded-2xl border bg-white" />}
  </div>;
};

export default PekReportPreviewPage;
