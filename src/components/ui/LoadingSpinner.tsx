const LoadingSpinner = () => {
  return (
    <div className="flex min-h-[180px] items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-white text-slate-600 shadow-sm">
      <div className="flex items-center gap-3 text-sm font-medium text-slate-700">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-eco-600 border-t-transparent"></div>
        Загрузка...
      </div>
    </div>
  );
};

export default LoadingSpinner;
