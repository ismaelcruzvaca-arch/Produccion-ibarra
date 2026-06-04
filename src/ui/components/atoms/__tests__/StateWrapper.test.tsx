import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { StateWrapper } from '../StateWrapper';

function Wrapper({ children }: { children: React.ReactNode }) {
  return <PaperProvider>{children}</PaperProvider>;
}

describe('StateWrapper', () => {
  // ─── Loading state ──────────────────────────────────────────────────────

  it('renders loading state with default message', () => {
    const { toJSON, getByText } = render(
      <Wrapper>
        <StateWrapper state="loading" />
      </Wrapper>,
    );

    expect(getByText('Cargando...')).toBeTruthy();
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders loading state with custom message', () => {
    const { getByText } = render(
      <Wrapper>
        <StateWrapper state="loading" message="Sincronizando datos..." />
      </Wrapper>,
    );

    expect(getByText('Sincronizando datos...')).toBeTruthy();
  });

  // ─── Empty state ────────────────────────────────────────────────────────

  it('renders empty state with default message', () => {
    const { toJSON, getByText } = render(
      <Wrapper>
        <StateWrapper state="empty" />
      </Wrapper>,
    );

    expect(getByText('Sin datos disponibles')).toBeTruthy();
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders empty state with custom message', () => {
    const { getByText } = render(
      <Wrapper>
        <StateWrapper state="empty" message="No hay registros para este turno" />
      </Wrapper>,
    );

    expect(getByText('No hay registros para este turno')).toBeTruthy();
  });

  it('renders empty state with action button when emptyAction is provided', () => {
    const onAction = jest.fn();

    const { toJSON, getByText } = render(
      <Wrapper>
        <StateWrapper
          state="empty"
          message="No hay productos"
          emptyAction={{ label: 'Agregar Producto', onPress: onAction }}
        />
      </Wrapper>,
    );

    expect(getByText('No hay productos')).toBeTruthy();
    expect(getByText('Agregar Producto')).toBeTruthy();
    expect(toJSON()).toMatchSnapshot();
  });

  it('fires emptyAction onPress when button is pressed', () => {
    const onAction = jest.fn();

    const { getByText } = render(
      <Wrapper>
        <StateWrapper
          state="empty"
          emptyAction={{ label: 'Crear', onPress: onAction }}
        />
      </Wrapper>,
    );

    fireEvent.press(getByText('Crear'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  // ─── Error state ────────────────────────────────────────────────────────

  it('renders error state with default message and retry button', () => {
    const onRetry = jest.fn();
    const { toJSON, getByText } = render(
      <Wrapper>
        <StateWrapper state="error" onRetry={onRetry} />
      </Wrapper>,
    );

    expect(getByText('Ocurrió un error')).toBeTruthy();
    expect(getByText('Reintentar')).toBeTruthy();
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders error state with custom message', () => {
    const { getByText } = render(
      <Wrapper>
        <StateWrapper state="error" message="Error de conexión" />
      </Wrapper>,
    );

    expect(getByText('Error de conexión')).toBeTruthy();
  });

  it('fires retry callback when retry button is pressed', () => {
    const onRetry = jest.fn();

    const { getByText } = render(
      <Wrapper>
        <StateWrapper state="error" onRetry={onRetry} />
      </Wrapper>,
    );

    fireEvent.press(getByText('Reintentar'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not render retry button when onRetry is not provided', () => {
    const { queryByText } = render(
      <Wrapper>
        <StateWrapper state="error" />
      </Wrapper>,
    );

    // The retry button should NOT be rendered (it only shows when onRetry is provided)
    // Wait — actually looking at the code: the retry button IS rendered when
    // state === 'error' regardless of onRetry. Let me check...
    //
    // Looking at StateWrapper lines 69-88:
    // {state === 'error' && (
    //   ...
    //   {onRetry && (
    //     <Button ...>Reintentar</Button>
    //   )}
    // )}
    //
    // So the retry button only shows when onRetry is provided.
    // But "Ocurrió un error" text always shows.
    expect(queryByText('Reintentar')).toBeNull();
  });

  it('renders retry button with testID', () => {
    const onRetry = jest.fn();

    const { getByTestId } = render(
      <Wrapper>
        <StateWrapper state="error" onRetry={onRetry} />
      </Wrapper>,
    );

    expect(getByTestId('state-wrapper-retry')).toBeTruthy();
  });

  // ─── Success state ──────────────────────────────────────────────────────

  it('renders children when state is success', () => {
    const { toJSON, getByText } = render(
      <Wrapper>
        <StateWrapper state="success">
          <Text>Child Content</Text>
        </StateWrapper>
      </Wrapper>,
    );

    expect(getByText('Child Content')).toBeTruthy();
    expect(toJSON()).toMatchSnapshot();
  });

  it('does not render loading/empty/error elements in success state', () => {
    const { queryByText } = render(
      <Wrapper>
        <StateWrapper state="success">
          <div>Content</div>
        </StateWrapper>
      </Wrapper>,
    );

    expect(queryByText('Cargando...')).toBeNull();
    expect(queryByText('Sin datos disponibles')).toBeNull();
    expect(queryByText('Ocurrió un error')).toBeNull();
  });

  // ─── TestID support ─────────────────────────────────────────────────────

  it('accepts and applies testID', () => {
    const { getByTestId } = render(
      <Wrapper>
        <StateWrapper state="loading" testID="state-wrapper" />
      </Wrapper>,
    );

    expect(getByTestId('state-wrapper')).toBeTruthy();
  });
});
