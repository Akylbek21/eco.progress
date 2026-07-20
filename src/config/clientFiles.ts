export const CLIENT_FILE_RULES = {
  maxSizeBytes: 20 * 1024 * 1024,
  extensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx'] as const,
  accept: '.pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export const validateClientFile = (file: File | null | undefined): string | undefined => {
  if (!file?.name) return 'Выберите файл документа.';
  if (file.size <= 0) return 'Нельзя загрузить пустой файл.';
  if (!CLIENT_FILE_RULES.extensions.some((extension) => file.name.toLowerCase().endsWith(extension))) return 'Можно загрузить только PDF, Word или Excel файл.';
  if (file.size > CLIENT_FILE_RULES.maxSizeBytes) return `Файл не должен быть больше ${CLIENT_FILE_RULES.maxSizeBytes / 1024 / 1024} МБ.`;
};
