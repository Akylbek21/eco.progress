import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CreateProtocolModal from '../components/protocols/CreateProtocolModal';
import protocolService from '../services/protocolService';
import { protocolTemplates } from '../data/protocolTemplates';
import type { CreateProtocolPayload, ProtocolResultPayload, ProtocolTemplate } from '../types/protocols';
import { useToast } from '../hooks/useToast';

const ProtocolCreatePage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<ProtocolTemplate[]>(protocolTemplates);

  useEffect(() => {
    protocolService.getProtocolTemplates().then((items) => items.length && setTemplates(items)).catch(() => setTemplates(protocolTemplates));
  }, []);

  const create = async (payload: CreateProtocolPayload, results: ProtocolResultPayload[]) => {
    setLoading(true);
    try {
      let protocol = await protocolService.createProtocol(payload);
      for (const result of results) {
        await protocolService.addProtocolResult(protocol.id, result);
      }
      protocol = await protocolService.calculateProtocol(protocol.id);
      toast.success('Протокол рассчитан и создан');
      navigate(`/staff/protocols/${protocol.id}?preview=1`, { replace: true });
    } catch (error) {
      toast.error('Не удалось создать протокол', error instanceof Error ? error.message : undefined);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh]">
      <CreateProtocolModal open loading={loading} templates={templates} onClose={() => navigate('/staff/protocols')} onCreate={create} />
    </div>
  );
};

export default ProtocolCreatePage;
