import { useEffect } from 'react';

const JIVO_SCRIPT_ID = 'jivo-chat-widget-script';
const JIVO_SCRIPT_SRC = 'https://code.jivo.ru/widget/hyHyYMNJ0z';

const JivoChat = () => {
  useEffect(() => {
    if (document.getElementById(JIVO_SCRIPT_ID)) {
      return;
    }

    const script = document.createElement('script');
    script.id = JIVO_SCRIPT_ID;
    script.src = JIVO_SCRIPT_SRC;
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return null;
};

export default JivoChat;
