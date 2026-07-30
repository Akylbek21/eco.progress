type SensitiveSigningState = {
  signingDataBase64?: string;
  cmsSignatureBase64?: string;
};

const activeStates = new Set<SensitiveSigningState>();

export const createSensitiveSigningState = () => {
  const state: SensitiveSigningState = {};
  activeStates.add(state);
  return {
    setSigningData: (value: string) => { state.signingDataBase64 = value; },
    setCms: (value: string) => { state.cmsSignatureBase64 = value; },
    clear: () => {
      state.signingDataBase64 = undefined;
      state.cmsSignatureBase64 = undefined;
      activeStates.delete(state);
    },
  };
};

export const clearSensitiveSigningState = () => {
  activeStates.forEach((state) => {
    state.signingDataBase64 = undefined;
    state.cmsSignatureBase64 = undefined;
  });
  activeStates.clear();
};
