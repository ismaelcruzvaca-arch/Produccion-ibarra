import { useMemo } from 'react';
import type { IReport } from '../../core/types';

export type TimeFilter = 'all' | 'shift' | '24h';

export interface DashboardKPIs {
  totalPiezas: number;
  calidadPercent: number;
  tiempoParoMin: number;
  piezasBuenas: number;
}

export interface UseDashboardDataResult {
  kpis: DashboardKPIs;
  barChartData: { labels: string[]; datasets: [{ data: number[] }] };
  filteredReports: IReport[];
}

export function useDashboardData(
  reports: IReport[],
  timeFilter: TimeFilter
): UseDashboardDataResult {
  return useMemo(() => {
    const now = Date.now();
    const cutoff =
      timeFilter === 'shift' ? now - 8 * 3600_000
      : timeFilter === '24h' ? now - 24 * 3600_000
      : 0;

    const filtered =
      cutoff > 0
        ? reports.filter((r) => r.updated_at >= cutoff)
        : reports;

    let totalPiezas = 0;
    let rejectedPiezas = 0;
    let tiempoParoMin = 0;
    const lineMap = new Map<string, number>();

    for (const r of filtered) {
      const tp = r.data.total_pieces;
      const rp = r.data.rejected_pieces;
      totalPiezas += tp;
      rejectedPiezas += rp;
      tiempoParoMin += r.data.downtime_minutes;
      lineMap.set(r.data.line_id, (lineMap.get(r.data.line_id) ?? 0) + tp);
    }

    const piezasBuenas = totalPiezas - rejectedPiezas;
    const calidadPercent =
      totalPiezas === 0 ? 100 : (1 - rejectedPiezas / totalPiezas) * 100;

    const barChartSorted = Array.from(lineMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([line_id, total_pieces]) => ({ line_id, total_pieces }));

    return {
      kpis: {
        totalPiezas,
        calidadPercent: Math.round(calidadPercent * 100) / 100,
        tiempoParoMin,
        piezasBuenas,
      },
      barChartData: {
        labels: barChartSorted.map((d) => d.line_id),
        datasets: [{ data: barChartSorted.map((d) => d.total_pieces) }],
      },
      filteredReports: filtered,
    };
  }, [reports, timeFilter]);
}
