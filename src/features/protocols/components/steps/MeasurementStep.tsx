import type { ComponentProps } from 'react';
import EnvironmentStep from './EnvironmentStep';
import ExecutorDeviceStep from './ExecutorDeviceStep';
import MethodsStep from './MethodsStep';

type Props = ComponentProps<typeof ExecutorDeviceStep> & ComponentProps<typeof EnvironmentStep>;

export default function MeasurementStep(props: Props) {
  return <section className="space-y-5">
    <div><h2 id="wizard-step-title" tabIndex={-1} className="text-lg font-semibold text-slate-950">Измерения</h2><p className="mt-1 text-sm text-slate-500">Укажите лабораторию, условия на объекте и применённую методику.</p></div>
    <ExecutorDeviceStep {...props} />
    <EnvironmentStep {...props} />
    <MethodsStep />
  </section>;
}

