import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { OeeDashboard } from '../index';

// Mock OeeMetrics type
const sampleMetrics = {
  disponibilidad: 92.5,
  rendimiento: 85.3,
  calidad: 98.1,
  oee: 77.2,
  totalCajas: 150,
  tiempoPlanificadoMin: 480,
  tiempoParoProdMin: 15,
  tiempoParoMttoMin: 10,
  tiempoOperandoMin: 455,
  totalRechazos: 3,
  cajasBuenas: 147,
  ppmUtilizado: 30,
  usandoFallbackPpm: false,
  hasAnomalies: false,
};

function Wrapper({ children }: { children: React.ReactNode }) {
  return <PaperProvider>{children}</PaperProvider>;
}

describe('OeeDashboard — state rendering (before/after snapshot equivalence)', () => {
  it('renders NoShiftState when shiftStarted is false', () => {
    const onStartShift = jest.fn();

    const { toJSON, getByText } = render(
      <PaperProvider>
        <OeeDashboard
          isActiveDowntime={false}
          activeDowntimeEvent={null}
          metrics={sampleMetrics}
          onRegisterProduction={jest.fn()}
          onStartDowntime={jest.fn()}
          onEndDowntime={jest.fn()}
          onStartShift={onStartShift}
          onEndShift={jest.fn()}
          shiftStarted={false}
        />
      </PaperProvider>,
    );

    expect(getByText('No hay turno activo')).toBeTruthy();
    expect(getByText('Iniciar Turno')).toBeTruthy();
    expect(toJSON()).toMatchSnapshot();
  });

  it('fires onStartShift when pressing the button in NoShiftState', () => {
    const onStartShift = jest.fn();

    const { getByText } = render(
      <PaperProvider>
        <OeeDashboard
          isActiveDowntime={false}
          activeDowntimeEvent={null}
          metrics={sampleMetrics}
          onRegisterProduction={jest.fn()}
          onStartDowntime={jest.fn()}
          onEndDowntime={jest.fn()}
          onStartShift={onStartShift}
          onEndShift={jest.fn()}
          shiftStarted={false}
        />
      </PaperProvider>,
    );

    fireEvent.press(getByText('Iniciar Turno'));
    expect(onStartShift).toHaveBeenCalledTimes(1);
  });

  it('renders ActiveDowntimeState when isActiveDowntime is true', () => {
    const mockEvent = {
      get: (field: string) => {
        if (field === 'reason_code') return 'FMP';
        if (field === 'timestamp') return Date.now() - 300000;
        return undefined;
      },
    };

    const { toJSON, getByText } = render(
      <PaperProvider>
        <OeeDashboard
          isActiveDowntime={true}
          activeDowntimeEvent={mockEvent as any}
          metrics={sampleMetrics}
          onRegisterProduction={jest.fn()}
          onStartDowntime={jest.fn()}
          onEndDowntime={jest.fn()}
          onStartShift={jest.fn()}
          onEndShift={jest.fn()}
          shiftStarted={true}
        />
      </PaperProvider>,
    );

    expect(getByText('PARO ACTIVO')).toBeTruthy();
    expect(getByText('FIN DE PARO')).toBeTruthy();
    expect(toJSON()).toMatchSnapshot();
  });

  it('fires onEndDowntime when pressing the button in ActiveDowntimeState', () => {
    const onEndDowntime = jest.fn();
    const mockEvent = {
      get: (field: string) => {
        if (field === 'reason_code') return 'FMP';
        if (field === 'timestamp') return Date.now() - 300000;
        return undefined;
      },
    };

    const { getByText } = render(
      <PaperProvider>
        <OeeDashboard
          isActiveDowntime={true}
          activeDowntimeEvent={mockEvent as any}
          metrics={sampleMetrics}
          onRegisterProduction={jest.fn()}
          onStartDowntime={jest.fn()}
          onEndDowntime={onEndDowntime}
          onStartShift={jest.fn()}
          onEndShift={jest.fn()}
          shiftStarted={true}
        />
      </PaperProvider>,
    );

    fireEvent.press(getByText('FIN DE PARO'));
    expect(onEndDowntime).toHaveBeenCalledTimes(1);
  });

  it('renders ActiveDowntimeState with null event gracefully', () => {
    const { toJSON, getByText } = render(
      <PaperProvider>
        <OeeDashboard
          isActiveDowntime={true}
          activeDowntimeEvent={null}
          metrics={sampleMetrics}
          onRegisterProduction={jest.fn()}
          onStartDowntime={jest.fn()}
          onEndDowntime={jest.fn()}
          onStartShift={jest.fn()}
          onEndShift={jest.fn()}
          shiftStarted={true}
        />
      </PaperProvider>,
    );

    expect(getByText('PARO ACTIVO')).toBeTruthy();
    // Without event, reason should show fallback
    // Without event, the reason shows the fallback "??? · Desconocido"
    expect(getByText(/Desconocido/)).toBeTruthy();
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders NormalOperationState when shift is active and no downtime', () => {
    const { toJSON, getByText, getAllByText } = render(
      <PaperProvider>
        <OeeDashboard
          isActiveDowntime={false}
          activeDowntimeEvent={null}
          metrics={sampleMetrics}
          onRegisterProduction={jest.fn()}
          onStartDowntime={jest.fn()}
          onEndDowntime={jest.fn()}
          onStartShift={jest.fn()}
          onEndShift={jest.fn()}
          shiftStarted={true}
        />
      </PaperProvider>,
    );

    expect(getByText('OEE Dashboard')).toBeTruthy();
    // "Registrar Producción" and "Iniciar Paro" each appear twice
    // (once as CardActionButton title, once as button label)
    expect(getAllByText('Registrar Producción').length).toBe(2);
    expect(getAllByText('Iniciar Paro').length).toBe(2);
    expect(getByText('Cerrar Turno')).toBeTruthy();
    expect(toJSON()).toMatchSnapshot();
  });

  it('fires callbacks in NormalOperationState', () => {
    const onRegisterProduction = jest.fn();
    const onStartDowntime = jest.fn();
    const onEndShift = jest.fn();

    const { getByText, getAllByText } = render(
      <PaperProvider>
        <OeeDashboard
          isActiveDowntime={false}
          activeDowntimeEvent={null}
          metrics={sampleMetrics}
          onRegisterProduction={onRegisterProduction}
          onStartDowntime={onStartDowntime}
          onEndDowntime={jest.fn()}
          onStartShift={jest.fn()}
          onEndShift={onEndShift}
          shiftStarted={true}
        />
      </PaperProvider>,
    );

    fireEvent.press(getAllByText('Registrar Producción')[0]);
    expect(onRegisterProduction).toHaveBeenCalledTimes(1);

    fireEvent.press(getAllByText('Iniciar Paro')[0]);
    expect(onStartDowntime).toHaveBeenCalledTimes(1);

    fireEvent.press(getAllByText('Cerrar Turno')[0]);
    expect(onEndShift).toHaveBeenCalledTimes(1);
  });

  it('renders OEE metrics correctly in NormalOperationState', () => {
    const { getByText } = render(
      <PaperProvider>
        <OeeDashboard
          isActiveDowntime={false}
          activeDowntimeEvent={null}
          metrics={sampleMetrics}
          onRegisterProduction={jest.fn()}
          onStartDowntime={jest.fn()}
          onEndDowntime={jest.fn()}
          onStartShift={jest.fn()}
          onEndShift={jest.fn()}
          shiftStarted={true}
        />
      </PaperProvider>,
    );

    expect(getByText('92.5%')).toBeTruthy();
    expect(getByText('85.3%')).toBeTruthy();
    expect(getByText('98.1%')).toBeTruthy();
    expect(getByText('77.2%')).toBeTruthy();
  });
});
