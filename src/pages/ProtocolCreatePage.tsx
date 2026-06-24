import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CreateProtocolModal from '../components/protocols/CreateProtocolModal';
import protocolService from '../services/protocolService';
import { protocolTemplates } from '../data/protocolTemplates';
import type { CreateProtocolPayload, ProtocolTemplate } from '../types/protocols';
import { useToast } from '../hooks/useToast';

const ProtocolCreatePage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<ProtocolTemplate[]>(protocolTemplates);

  useEffect(() => {
    protocolService.getProtocolTemplates().then((items) => items.length && setTemplates(items)).catch(() => setTemplates(protocolTemplates));
  }, []);

  const create = async (payload: CreateProtocolPayload) => {
    setLoading(true);
    try {
      const protocol = await protocolService.createProtocol(payload);
      toast.success('Черновик протокола создан');
      navigate(`/staff/protocols/${protocol.id}`, { replace: true });
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
