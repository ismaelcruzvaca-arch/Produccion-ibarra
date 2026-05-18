import { useCatalogStore } from '../ui/store/catalogStore';

export function useOeeValidation() {
  const selectedLine = useCatalogStore((state) => state.selectedLine);
  const selectedMachine = useCatalogStore((state) => state.selectedMachine);
  const selectedShift = useCatalogStore((state) => state.selectedShift);

  if (!selectedLine) {
    return { isValid: false, message: 'Debe seleccionar una Línea' };
  }

  if (!selectedMachine) {
    return { isValid: false, message: 'Debe seleccionar una Máquina' };
  }

  if (!selectedShift) {
    return { isValid: false, message: 'Debe seleccionar un Turno' };
  }

  return { isValid: true, message: null };
}
