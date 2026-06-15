/**
 * Shift Calendar Screen — Admin month-grid calendar for recurring slot and
 * exception management (SC-4).
 *
 * Features:
 * - Month grid navigation (prev/next month)
 * - Color-coded days: blue (slot), red (holiday), orange (override), green (extraordinary)
 * - Tap day → modal: slot CRUD for that day_of_week + exception management
 * - Exception type selector: holiday | override | extraordinary
 *
 * Access: Admin / Supervisor only.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  Text,
  Button,
  Dialog,
  Portal,
  TextInput,
  Chip,
  List,
  Divider,
  IconButton,
  HelperText,
} from 'react-native-paper';
import { colors, spacing, typography, borderRadius } from '../../../src/ui/theme/tokens';
import { useShiftCalendarRepository } from '../../../src/repositories/useShiftCalendarRepository';
import { useCatalogStore } from '../../../src/ui/store/catalogStore';
import { useAuthStore } from '../../../src/auth/useAuthStore';
import {
  generateUuid,
} from '../../../src/utils/uuid';
import { nowMs } from '../../../src/utils/timestamp';
import type {
  IShiftCalendarSlot,
  IShiftCalendarException,
  ShiftType,
  CalendarExceptionType,
  ICatalogLine,
} from '../../../src/core/types';

// ─── Constants ──────────────────────────────────────────────────────────────────

const DAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

const SHIFT_OPTIONS: { value: ShiftType; label: string }[] = [
  { value: 'matutino', label: 'Matutino' },
  { value: 'vespertino', label: 'Vespertino' },
  { value: 'nocturno', label: 'Nocturno' },
];

const EXCEPTION_TYPES: { value: CalendarExceptionType; label: string; color: string }[] = [
  { value: 'holiday', label: 'Festivo', color: colors.error },
  { value: 'override', label: 'Sobrescritura', color: colors.caution },
  { value: 'extraordinary', label: 'Extraordinario', color: colors.success },
];

/** Max characters for exception description */
const DESC_MAX_LENGTH = 200;

// ─── Helpers ────────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay(); // 0=Sun
}

function formatDate(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function formatMonthLabel(year: number, month: number): string {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  return `${months[month]} ${year}`;
}

/**
 * Returns a set of "YYYY-MM-DD" strings that have exceptions of a given type.
 */
function collectExceptionDates(
  exceptions: IShiftCalendarException[],
  type?: CalendarExceptionType,
): Set<string> {
  const filtered = type
    ? exceptions.filter((e) => e.type === type)
    : exceptions;
  return new Set(filtered.map((e) => e.date));
}

// ─── Calendar Grid Component ────────────────────────────────────────────────────

interface DayCellInfo {
  day: number;
  dateStr: string;
  dayOfWeek: number;
  hasSlot: boolean;
  hasHoliday: boolean;
  hasOverride: boolean;
  hasExtraordinary: boolean;
}

function CalendarGrid({
  year,
  month,
  selectedLineId,
  onDayPress,
}: {
  year: number;
  month: number;
  selectedLineId: string | null;
  onDayPress: (info: DayCellInfo) => void;
}) {
  const calendarRepo = useShiftCalendarRepository();
  const [slots, setSlots] = useState<IShiftCalendarSlot[]>([]);
  const [exceptions, setExceptions] = useState<IShiftCalendarException[]>([]);
  const [loading, setLoading] = useState(true);

  // Reload data when month or line changes
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [slotDocs, excDocs] = await Promise.all([
          calendarRepo.findAllSlots(),
          calendarRepo.findAllExceptions(),
        ]);
        if (!cancelled) {
          const rawSlots = slotDocs.map((d) => d.toJSON() as IShiftCalendarSlot);
          const rawExceptions = excDocs.map((d) => d.toJSON() as IShiftCalendarException);

          // Filter by selected line if one is chosen
          const filteredSlots = selectedLineId
            ? rawSlots.filter((s) => s.line_id === selectedLineId)
            : rawSlots;
          const filteredExceptions = selectedLineId
            ? rawExceptions.filter((e) => e.line_id === selectedLineId)
            : rawExceptions;

          setSlots(filteredSlots);
          setExceptions(filteredExceptions);
        }
      } catch {
        // Non-critical — empty grid shown
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [year, month, selectedLineId, calendarRepo]);

  const holidayDates = useMemo(() => collectExceptionDates(exceptions, 'holiday'), [exceptions]);
  const overrideDates = useMemo(() => collectExceptionDates(exceptions, 'override'), [exceptions]);
  const extraordinaryDates = useMemo(() => collectExceptionDates(exceptions, 'extraordinary'), [exceptions]);

  // Build grid cells
  const cells = useMemo(() => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const result: (DayCellInfo | null)[] = [];

    // Leading blanks
    for (let i = 0; i < firstDay; i++) {
      result.push(null);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = formatDate(year, month, d);
      const dayOfWeek = new Date(year, month, d).getDay();

      // Check if any slot matches this day of week for the selected line
      const hasSlot = slots.some(
        (s) => s.day_of_week === dayOfWeek && (!selectedLineId || s.line_id === selectedLineId),
      );

      result.push({
        day: d,
        dateStr,
        dayOfWeek,
        hasSlot,
        hasHoliday: holidayDates.has(dateStr),
        hasOverride: overrideDates.has(dateStr),
        hasExtraordinary: extraordinaryDates.has(dateStr),
      });
    }

    return result;
  }, [year, month, slots, exceptions, holidayDates, overrideDates, extraordinaryDates, selectedLineId]);

  if (loading) {
    return (
      <View style={styles.gridLoading}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  // Split into rows of 7
  const rows: (DayCellInfo | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  const todayStr = formatDate(
    new Date().getFullYear(),
    new Date().getMonth(),
    new Date().getDate(),
  );

  return (
    <View>
      {/* Day labels header */}
      <View style={styles.gridHeader}>
        {DAY_LABELS.map((label, i) => (
          <View key={i} style={styles.gridHeaderCell}>
            <Text style={styles.gridHeaderLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Day cells */}
      {rows.map((row, ri) => (
        <View key={ri} style={styles.gridRow}>
          {row.map((cell, ci) => {
            if (!cell) {
              return <View key={`blank-${ci}`} style={styles.gridCell} />;
            }

            const isToday = cell.dateStr === todayStr;
            const dots: { color: string; key: string }[] = [];
            if (cell.hasSlot) dots.push({ color: '#1976D2', key: 'slot' });
            if (cell.hasHoliday) dots.push({ color: colors.error, key: 'holiday' });
            if (cell.hasOverride) dots.push({ color: colors.caution, key: 'override' });
            if (cell.hasExtraordinary) dots.push({ color: colors.success, key: 'extraordinary' });

            return (
              <TouchableOpacity
                key={cell.dateStr}
                style={[
                  styles.gridCell,
                  isToday && styles.gridCellToday,
                ]}
                onPress={() => onDayPress(cell)}
                activeOpacity={0.6}
              >
                <Text
                  style={[
                    styles.gridCellDay,
                    isToday && styles.gridCellDayToday,
                  ]}
                >
                  {cell.day}
                </Text>
                {dots.length > 0 && (
                  <View style={styles.dotRow}>
                    {dots.map((dot) => (
                      <View
                        key={dot.key}
                        style={[styles.dot, { backgroundColor: dot.color }]}
                      />
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────────

export default function ShiftCalendarScreen() {
  const userRole = useAuthStore((s) => s.role);
  const lines = useCatalogStore((s) => s.lines);
  const isAuthorized = userRole === 'admin' || userRole === 'supervisor';

  // ─── Calendar navigation ────────────────────────────────────────────────────
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  // 0 = all lines; >0 = specific line id
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

  const goPrevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const goNextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  const goToday = useCallback(() => {
    const n = new Date();
    setViewYear(n.getFullYear());
    setViewMonth(n.getMonth());
  }, []);

  // ─── Modal state for day detail ──────────────────────────────────────────────
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayCellInfo | null>(null);

  // ─── Slot form state ──────────────────────────────────────────────────────────
  const [slotStartTime, setSlotStartTime] = useState('06:00');
  const [slotEndTime, setSlotEndTime] = useState('14:00');
  const [slotShiftType, setSlotShiftType] = useState<ShiftType>('matutino');
  const [slotLineId, setSlotLineId] = useState('');
  const [slotError, setSlotError] = useState<string | null>(null);
  const [slotSaving, setSlotSaving] = useState(false);

  // ─── Existing slots for the selected day_of_week ─────────────────────────────
  const [daySlots, setDaySlots] = useState<IShiftCalendarSlot[]>([]);
  const [dayExceptions, setDayExceptions] = useState<IShiftCalendarException[]>([]);

  // ─── Exception form state ────────────────────────────────────────────────────
  const [excType, setExcType] = useState<CalendarExceptionType>('holiday');
  const [excStartTime, setExcStartTime] = useState('');
  const [excEndTime, setExcEndTime] = useState('');
  const [excDescription, setExcDescription] = useState('');
  const [excError, setExcError] = useState<string | null>(null);
  const [excSaving, setExcSaving] = useState(false);

  // ─── Calendar repo ──────────────────────────────────────────────────────────
  const calendarRepo = useShiftCalendarRepository();

  // ─── Open modal for a day ─────────────────────────────────────────────────────
  const handleDayPress = useCallback(
    async (info: DayCellInfo) => {
      setSelectedDay(info);
      setSlotError(null);
      setExcError(null);
      setSlotStartTime('06:00');
      setSlotEndTime('14:00');
      setSlotShiftType('matutino');
      setSlotLineId(selectedLineId ?? '');
      setExcStartTime('');
      setExcEndTime('');
      setExcDescription('');
      setExcType('holiday');

      // Load existing slots for this day_of_week
      try {
        const lineFilter = selectedLineId ?? '';
        const [slotDocs, excDocs] = await Promise.all([
          lineFilter
            ? calendarRepo.findSlotsByLineAndDay(lineFilter, info.dayOfWeek)
            : Promise.resolve([] as any[]),
          lineFilter
            ? calendarRepo.findExceptionsByDateAndLine(info.dateStr, lineFilter)
            : calendarRepo.findExceptionsByDate(info.dateStr),
        ]);

        setDaySlots(slotDocs.map((d) => d.toJSON() as IShiftCalendarSlot));
        setDayExceptions(excDocs.map((d) => d.toJSON() as IShiftCalendarException));
      } catch {
        setDaySlots([]);
        setDayExceptions([]);
      }

      setModalVisible(true);
    },
    [selectedLineId, calendarRepo],
  );

  // ─── Close modal ──────────────────────────────────────────────────────────────
  const closeModal = useCallback(() => {
    setModalVisible(false);
    setSelectedDay(null);
  }, []);

  // ─── Create slot ──────────────────────────────────────────────────────────────
  const handleCreateSlot = useCallback(async () => {
    if (!selectedDay) return;
    if (!slotLineId) {
      setSlotError('Seleccione una línea primero');
      return;
    }
    if (!slotStartTime || !slotEndTime) {
      setSlotError('Ingrese hora de inicio y fin');
      return;
    }
    if (slotStartTime >= slotEndTime) {
      setSlotError('La hora de inicio debe ser anterior a la hora de fin');
      return;
    }

    setSlotSaving(true);
    setSlotError(null);

    try {
      await calendarRepo.createSlot({
        day_of_week: selectedDay.dayOfWeek,
        start_time: slotStartTime,
        end_time: slotEndTime,
        line_id: slotLineId,
        shift_type: slotShiftType,
      });

      // Refresh day slots
      const slotDocs = await calendarRepo.findSlotsByLineAndDay(slotLineId, selectedDay.dayOfWeek);
      setDaySlots(slotDocs.map((d) => d.toJSON() as IShiftCalendarSlot));

      // Reset form
      setSlotStartTime('06:00');
      setSlotEndTime('14:00');
      setSlotShiftType('matutino');
    } catch (e: any) {
      setSlotError(e?.message ?? 'Error al crear slot');
    } finally {
      setSlotSaving(false);
    }
  }, [selectedDay, slotLineId, slotStartTime, slotEndTime, slotShiftType, calendarRepo]);

  // ─── Delete slot ──────────────────────────────────────────────────────────────
  const handleDeleteSlot = useCallback(
    async (slotId: string) => {
      try {
        await calendarRepo.removeSlot(slotId);
        setDaySlots((prev) => prev.filter((s) => s.id !== slotId));
      } catch (e: any) {
        setSlotError(e?.message ?? 'Error al eliminar slot');
      }
    },
    [calendarRepo],
  );

  // ─── Create exception ─────────────────────────────────────────────────────────
  const handleCreateException = useCallback(async () => {
    if (!selectedDay) return;
    if (!selectedLineId) {
      setExcError('Seleccione una línea primero');
      return;
    }

    // Validate times for override and extraordinary
    if (excType === 'override' || excType === 'extraordinary') {
      if (!excStartTime || !excEndTime) {
        setExcError(`Ingrese hora de inicio y fin para tipo "${EXCEPTION_TYPES.find((t) => t.value === excType)?.label ?? excType}"`);
        return;
      }
      if (excStartTime >= excEndTime) {
        setExcError('La hora de inicio debe ser anterior a la hora de fin');
        return;
      }
    }

    if (excDescription.length > DESC_MAX_LENGTH) {
      setExcError(`La descripción no puede exceder ${DESC_MAX_LENGTH} caracteres`);
      return;
    }

    setExcSaving(true);
    setExcError(null);

    try {
      await calendarRepo.createException({
        date: selectedDay.dateStr,
        type: excType,
        line_id: selectedLineId,
        start_time: (excType === 'override' || excType === 'extraordinary') ? excStartTime : undefined,
        end_time: (excType === 'override' || excType === 'extraordinary') ? excEndTime : undefined,
        description: excDescription.trim() || undefined,
        shift_type: undefined, // will inherit from slot if applicable
      });

      // Refresh exceptions
      const excDocs = await calendarRepo.findExceptionsByDateAndLine(selectedDay.dateStr, selectedLineId);
      setDayExceptions(excDocs.map((d) => d.toJSON() as IShiftCalendarException));

      // Reset form
      setExcType('holiday');
      setExcStartTime('');
      setExcEndTime('');
      setExcDescription('');
    } catch (e: any) {
      setExcError(e?.message ?? 'Error al crear excepción');
    } finally {
      setExcSaving(false);
    }
  }, [selectedDay, selectedLineId, excType, excStartTime, excEndTime, excDescription, calendarRepo]);

  // ─── Delete exception ─────────────────────────────────────────────────────────
  const handleDeleteException = useCallback(
    async (excId: string) => {
      try {
        await calendarRepo.removeException(excId);
        setDayExceptions((prev) => prev.filter((e) => e.id !== excId));
      } catch (e: any) {
        setExcError(e?.message ?? 'Error al eliminar excepción');
      }
    },
    [calendarRepo],
  );

  // ─── Guard: unauthorized ──────────────────────────────────────────────────────
  if (!isAuthorized) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.unauthorizedText}>
          Solo administradores y supervisores pueden gestionar el calendario.
        </Text>
      </View>
    );
  }

  // ─── Line selector chip ───────────────────────────────────────────────────────
  const activeLine = lines.find((l) => l.id === selectedLineId);

  const handleLineFilter = useCallback(
    (line: ICatalogLine) => {
      setSelectedLineId((prev) => (prev === line.id ? null : line.id));
    },
    [],
  );

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Line filter chips */}
      <View style={styles.lineFilterRow}>
        <Text style={styles.sectionLabel}>Línea:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.lineChips}>
            {lines.map((line) => (
              <Chip
                key={line.id}
                selected={selectedLineId === line.id}
                onPress={() => handleLineFilter(line)}
                style={styles.lineChip}
                selectedColor={colors.primary}
                showSelectedCheck
                compact
              >
                {line.name}
              </Chip>
            ))}
            {lines.length === 0 && (
              <Text style={styles.emptyText}>No hay líneas disponibles</Text>
            )}
          </View>
        </ScrollView>
      </View>

      {/* Month navigation */}
      <View style={styles.monthNav}>
        <IconButton
          icon="chevron-left"
          size={28}
          onPress={goPrevMonth}
        />
        <TouchableOpacity onPress={goToday}>
          <Text style={styles.monthLabel}>{formatMonthLabel(viewYear, viewMonth)}</Text>
        </TouchableOpacity>
        <IconButton
          icon="chevron-right"
          size={28}
          onPress={goNextMonth}
        />
      </View>

      {/* Calendar grid */}
      <CalendarGrid
        year={viewYear}
        month={viewMonth}
        selectedLineId={selectedLineId}
        onDayPress={handleDayPress}
      />

      {/* Color legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#1976D2' }]} />
          <Text style={styles.legendText}>Slot recurrente</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.error }]} />
          <Text style={styles.legendText}>Festivo</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.caution }]} />
          <Text style={styles.legendText}>Sobrescritura</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
          <Text style={styles.legendText}>Extraordinario</Text>
        </View>
      </View>

      {/* ── Day Detail Modal ────────────────────────────────────────────────── */}
      <Portal>
        <Dialog
          visible={modalVisible}
          onDismiss={closeModal}
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitle}>
            {selectedDay
              ? `${selectedDay.day} de ${formatMonthLabel(viewYear, viewMonth)}`
              : 'Detalle del Día'}
          </Dialog.Title>

          <Dialog.ScrollArea style={styles.dialogScroll}>
            <ScrollView>
              {/* ── Existing Slots ──────────────────────────────────────────── */}
              {daySlots.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>Slots recurrentes</Text>
                  {daySlots.map((slot) => (
                    <List.Item
                      key={slot.id}
                      title={`${slot.start_time} - ${slot.end_time}`}
                      description={`${SHIFT_OPTIONS.find((o) => o.value === slot.shift_type)?.label ?? slot.shift_type} · ${lines.find((l) => l.id === slot.line_id)?.name ?? slot.line_id}`}
                      left={(props) => (
                        <List.Icon {...props} icon="calendar-clock" color="#1976D2" />
                      )}
                      right={(props) => (
                        <IconButton
                          {...props}
                          icon="delete-outline"
                          onPress={() => handleDeleteSlot(slot.id)}
                          iconColor={colors.error}
                        />
                      )}
                    />
                  ))}
                  <Divider style={styles.divider} />
                </>
              )}

              {/* ── Create Slot ─────────────────────────────────────────────── */}
              <Text style={styles.sectionLabel}>
                {daySlots.length > 0 ? 'Agregar otro slot' : 'Nuevo slot recurrente'}
              </Text>
              <Text style={styles.fieldHint}>
                Se repite cada {DAY_LABELS[selectedDay?.dayOfWeek ?? 0]} de la semana
              </Text>

              {/* Line selector (hidden if filter is active) */}
              {!selectedLineId && (
                <View style={styles.fieldRow}>
                  {lines.map((line) => (
                    <Chip
                      key={line.id}
                      selected={slotLineId === line.id}
                      onPress={() => setSlotLineId(line.id)}
                      style={styles.inlineChip}
                      selectedColor={colors.primary}
                      showSelectedCheck={false}
                      compact
                    >
                      {line.name}
                    </Chip>
                  ))}
                </View>
              )}

              <View style={styles.timeRow}>
                <TextInput
                  label="Inicio"
                  value={slotStartTime}
                  onChangeText={setSlotStartTime}
                  mode="outlined"
                  placeholder="HH:mm"
                  style={styles.timeInput}
                  outlineStyle={styles.inputOutline}
                />
                <Text style={styles.timeSeparator}>a</Text>
                <TextInput
                  label="Fin"
                  value={slotEndTime}
                  onChangeText={setSlotEndTime}
                  mode="outlined"
                  placeholder="HH:mm"
                  style={styles.timeInput}
                  outlineStyle={styles.inputOutline}
                />
              </View>

              <View style={styles.chipRow}>
                {SHIFT_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.value}
                    selected={slotShiftType === opt.value}
                    onPress={() => setSlotShiftType(opt.value)}
                    style={styles.inlineChip}
                    selectedColor={colors.primary}
                    showSelectedCheck={false}
                    compact
                  >
                    {opt.label}
                  </Chip>
                ))}
              </View>

              {slotError ? (
                <HelperText type="error" visible style={styles.errorText}>
                  {slotError}
                </HelperText>
              ) : null}

              <Button
                mode="contained"
                onPress={handleCreateSlot}
                loading={slotSaving}
                disabled={slotSaving}
                style={styles.smallButton}
                icon="plus"
              >
                {slotSaving ? 'Guardando...' : 'Agregar Slot'}
              </Button>

              <Divider style={styles.divider} />

              {/* ── Existing Exceptions ─────────────────────────────────────── */}
              {dayExceptions.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>Excepciones para esta fecha</Text>
                  {dayExceptions.map((exc) => {
                    const excInfo = EXCEPTION_TYPES.find((t) => t.value === exc.type);
                    const timeStr =
                      exc.start_time && exc.end_time
                        ? `${exc.start_time} - ${exc.end_time}`
                        : 'Día completo';
                    return (
                      <List.Item
                        key={exc.id}
                        title={`${excInfo?.label ?? exc.type}`}
                        description={`${timeStr}${exc.description ? ` · ${exc.description}` : ''}`}
                        left={(props) => (
                          <List.Icon
                            {...props}
                            icon={
                              exc.type === 'holiday'
                                ? 'calendar-remove'
                                : exc.type === 'override'
                                ? 'calendar-clock'
                                : 'calendar-star'
                            }
                            color={excInfo?.color ?? colors.secondary}
                          />
                        )}
                        right={(props) => (
                          <IconButton
                            {...props}
                            icon="delete-outline"
                            onPress={() => handleDeleteException(exc.id)}
                            iconColor={colors.error}
                          />
                        )}
                      />
                    );
                  })}
                  <Divider style={styles.divider} />
                </>
              )}

              {/* ── Create Exception ────────────────────────────────────────── */}
              <Text style={styles.sectionLabel}>
                {dayExceptions.length > 0 ? 'Agregar otra excepción' : 'Nueva excepción'}
              </Text>

              {/* Exception type selector */}
              <View style={styles.chipRow}>
                {EXCEPTION_TYPES.map((excTypeOpt) => (
                  <Chip
                    key={excTypeOpt.value}
                    selected={excType === excTypeOpt.value}
                    onPress={() => setExcType(excTypeOpt.value)}
                    style={styles.inlineChip}
                    selectedColor={excTypeOpt.color}
                    showSelectedCheck={false}
                    compact
                  >
                    {excTypeOpt.label}
                  </Chip>
                ))}
              </View>

              {/* Time fields for override/extraordinary */}
              {(excType === 'override' || excType === 'extraordinary') && (
                <View style={styles.timeRow}>
                  <TextInput
                    label="Inicio"
                    value={excStartTime}
                    onChangeText={setExcStartTime}
                    mode="outlined"
                    placeholder="HH:mm"
                    style={styles.timeInput}
                    outlineStyle={styles.inputOutline}
                  />
                  <Text style={styles.timeSeparator}>a</Text>
                  <TextInput
                    label="Fin"
                    value={excEndTime}
                    onChangeText={setExcEndTime}
                    mode="outlined"
                    placeholder="HH:mm"
                    style={styles.timeInput}
                    outlineStyle={styles.inputOutline}
                  />
                </View>
              )}

              {/* Description */}
              <TextInput
                label="Descripción (opcional)"
                value={excDescription}
                onChangeText={setExcDescription}
                mode="outlined"
                multiline
                numberOfLines={2}
                style={styles.descriptionInput}
                outlineStyle={styles.inputOutline}
                maxLength={DESC_MAX_LENGTH}
              />

              {excError ? (
                <HelperText type="error" visible style={styles.errorText}>
                  {excError}
                </HelperText>
              ) : null}

              <Button
                mode="contained"
                onPress={handleCreateException}
                loading={excSaving}
                disabled={excSaving}
                style={styles.smallButton}
                icon="plus"
              >
                {excSaving ? 'Guardando...' : 'Agregar Excepción'}
              </Button>
            </ScrollView>
          </Dialog.ScrollArea>

          <Dialog.Actions>
            <Button onPress={closeModal}>Cerrar</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgGray,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  unauthorizedText: {
    fontSize: typography.sizes.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  // ── Line filter ──────────────────────────────────────────────────────────────
  lineFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  lineChips: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  lineChip: {
    marginRight: spacing.xxs,
  },
  // ── Month navigation ─────────────────────────────────────────────────────────
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  monthLabel: {
    fontSize: typography.sizes.titleMedium,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  // ── Grid ─────────────────────────────────────────────────────────────────────
  gridHeader: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
  },
  gridHeaderCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xxs,
  },
  gridHeaderLabel: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: typography.weights.bold,
    color: colors.textSecondary,
  },
  gridRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
  },
  gridCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    minHeight: 48,
    borderRadius: borderRadius.sm,
  },
  gridCellToday: {
    backgroundColor: colors.bgGreen,
  },
  gridCellDay: {
    fontSize: typography.sizes.bodyMedium,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  gridCellDayToday: {
    fontWeight: typography.weights.bold,
    color: colors.darkGreen,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  gridLoading: {
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ── Legend ────────────────────────────────────────────────────────────────────
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  // ── Dialog ────────────────────────────────────────────────────────────────────
  dialog: {
    maxHeight: '90%',
  },
  dialogTitle: {
    fontSize: typography.sizes.titleSmall,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  dialogScroll: {
    maxHeight: 500,
  },
  sectionLabel: {
    fontSize: typography.sizes.bodyMedium,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  fieldHint: {
    fontSize: typography.sizes.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  fieldRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  timeInput: {
    flex: 1,
    backgroundColor: colors.white,
  },
  timeSeparator: {
    fontSize: typography.sizes.bodyMedium,
    color: colors.textSecondary,
    marginHorizontal: spacing.xxs,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
    marginBottom: spacing.sm,
  },
  inlineChip: {
    marginBottom: spacing.xxs,
  },
  descriptionInput: {
    backgroundColor: colors.white,
    marginBottom: spacing.sm,
  },
  inputOutline: {
    borderRadius: borderRadius.sm,
  },
  errorText: {
    fontSize: typography.sizes.bodySmall,
    color: colors.textError,
    marginBottom: spacing.xs,
  },
  smallButton: {
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  divider: {
    marginVertical: spacing.sm,
  },
  emptyText: {
    fontSize: typography.sizes.bodySmall,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
});
