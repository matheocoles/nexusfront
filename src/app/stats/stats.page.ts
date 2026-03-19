import {
  Component, OnInit, OnDestroy,
  inject, ChangeDetectorRef, ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  IonContent, IonIcon, IonModal, IonSpinner
} from '@ionic/angular/standalone';
import { NexusService } from '../services/nexus.service';
import { addIcons } from 'ionicons';
import {
  menuOutline, chevronBackOutline, chevronForwardOutline,
  fitnessOutline, bookOutline, rocketOutline,
  timeOutline, trophyOutline, shieldCheckmarkOutline
} from 'ionicons/icons';

// ─── Chart.js (importé dynamiquement pour Ionic/Capacitor) ────────────────
import {
  Chart,
  LineController, BarController,
  LineElement, BarElement, PointElement, ArcElement,
  CategoryScale, LinearScale,
  Tooltip, Filler
} from 'chart.js';

Chart.register(
  LineController, BarController,
  LineElement, BarElement, PointElement, ArcElement,
  CategoryScale, LinearScale,
  Tooltip, Filler
);

// ─── DTOs OpenAPI ──────────────────────────────────────────────────────────
export interface GetSessionDto {
  id: number;
  dateTimeStart?: string | null;
  dateTimeEnd?: string | null;
  status?: string | null;
  activityName?: string | null;
  classId?: number | null;
  sportId?: number | null;
  extraActivityId?: number | null;
  achievements?: GetAchievementDto[];
}
export interface GetAchievementDto { id: number; name?: string | null; description?: string | null; }
export interface GetClassDto       { id: number; name?: string | null; subject?: string | null; room?: string | null; }
export interface GetSportDto       { id?: number; name?: string | null; duration?: number; intensity?: string | null; }
export interface GetExtraActivityDto { id?: number; name?: string | null; theme?: string | null; }

// ─── Type interne enrichi ──────────────────────────────────────────────────
type Period = 'jour' | 'semaine' | 'mois' | 'annee';
interface ES {
  id: number; dateTimeStart: Date; dateTimeEnd: Date; durationMins: number;
  type: 'class' | 'sport' | 'extra' | 'session';
  label: string; intensity?: string | null; achievements: GetAchievementDto[];
}
interface BucketData { label: string; total: number; classMins: number; sportMins: number; extraMins: number; }

// ─── Palette Nexus ─────────────────────────────────────────────────────────
const C = {
  primary:  '#c2185b',
  sport:    '#9c27b0',
  extra:    '#e91e63',
  cours:    '#4a90d9',
  gridLine: '#1e1e1e',
  tick:     '#666666',
  tooltipBg:'#1a1a1a',
  tooltipBorder:'#333333',
};

@Component({
  selector: 'app-stats',
  templateUrl: 'stats.page.html',
  styleUrls: ['stats.page.scss'],
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonModal, IonSpinner]
})
export class StatsPage implements OnInit, OnDestroy {

  // ── Canvas refs ──────────────────────────────────────────────────────────
  @ViewChild('investCanvas') investCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('histoCanvas')  histoCanvasRef!:  ElementRef<HTMLCanvasElement>;

  private investChart?: Chart;
  private histoChart?:  Chart;

  // ── Services ─────────────────────────────────────────────────────────────
  private nexusService = inject(NexusService);
  private cdr          = inject(ChangeDetectorRef);

  // ── État ─────────────────────────────────────────────────────────────────
  isLoading    = true;
  isNotifOpen  = false;
  notifTitle   = '';
  notifMsg     = '';
  chartMode: 'line' | 'bar' = 'line';

  selectedPeriod: Period = 'semaine';
  weekOffset = 0;

  periods = [
    { key: 'jour'    as Period, label: 'Jour' },
    { key: 'semaine' as Period, label: 'Semaine' },
    { key: 'mois'    as Period, label: 'Mois' },
    { key: 'annee'   as Period, label: 'Année' },
  ];

  get periodLabel() {
    return ({
      jour: 'de la journée', semaine: 'de la semaine',
      mois: 'du mois', annee: "de l'année"
    })[this.selectedPeriod];
  }

  // ── Données ───────────────────────────────────────────────────────────────
  private sessions: ES[] = [];
  private classDict:  Record<number, GetClassDto>         = {};
  private sportDict:  Record<number, GetSportDto>         = {};
  private extraDict:  Record<number, GetExtraActivityDto> = {};

  // ── Données calculées (template) ─────────────────────────────────────────
  activityBars:    { value: number; color: string; icon: string; label: string; mins: number }[] = [];
  periodStats:     { icon: string; value: string; label: string }[] = [];
  visibleDays:     { num: string; name: string; active: boolean }[] = [];
  insights:        { message: string; pct: number; source: string; level: string }[] = [];
  topAchievements: { name: string; count: number }[] = [];
  donutPcts:       number[] = [0, 0, 0];
  donutTotalH      = '0h';

  constructor() {
    addIcons({
      menuOutline, chevronBackOutline, chevronForwardOutline,
      fitnessOutline, bookOutline, rocketOutline,
      timeOutline, trophyOutline, shieldCheckmarkOutline
    });
  }

  ngOnInit() { this.loadAllData(); }

  ngOnDestroy() {
    this.destroyCharts();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CHARGEMENT PARALLÈLE
  // ─────────────────────────────────────────────────────────────────────────
  private loadAllData() {
    this.isLoading = true;
    forkJoin({
      sessions: this.nexusService.getSessions().pipe(catchError(() => of([]))),
      classes:  this.nexusService.getClasses().pipe(catchError(() => of([]))),
      sports:   this.nexusService.getSports().pipe(catchError(() => of([]))),
      extras:   this.nexusService.getExtraActivities().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ sessions, classes, sports, extras }) => {
        (classes as GetClassDto[]).forEach(c => { if (c.id) this.classDict[c.id] = c; });
        (sports  as GetSportDto[]).forEach(s => { if (s.id) this.sportDict[s.id] = s; });
        (extras  as GetExtraActivityDto[]).forEach(e => { if (e.id) this.extraDict[e.id] = e; });
        this.sessions = (sessions as GetSessionDto[])
          .filter(s => s.dateTimeStart)
          .map(s => this.enrich(s));
        this.isLoading = false;
        this.cdr.detectChanges();
        // Attendre que *ngIf="!isLoading" ait rendu les canvas
        setTimeout(() => this.compute(), 50);
      },
      error: () => {
        this.sessions  = [];
        this.isLoading = false;
        this.cdr.detectChanges();
        setTimeout(() => this.compute(), 50);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ENRICHISSEMENT SESSION
  // ─────────────────────────────────────────────────────────────────────────
  private enrich(s: GetSessionDto): ES {
    const start = new Date(s.dateTimeStart!);
    const end   = s.dateTimeEnd ? new Date(s.dateTimeEnd) : new Date(start.getTime() + 3600000);
    const durationMins = Math.abs(end.getTime() - start.getTime()) / 60000;
    let type: ES['type'] = 'session';
    let label = s.activityName || s.status || 'Session';
    let intensity: string | null = null;
    if (s.classId && this.classDict[s.classId]) {
      type = 'class';
      label = this.classDict[s.classId].name || this.classDict[s.classId].subject || label;
    } else if (s.sportId && this.sportDict[s.sportId]) {
      type = 'sport';
      label = this.sportDict[s.sportId].name || label;
      intensity = this.sportDict[s.sportId].intensity || null;
    } else if (s.extraActivityId && this.extraDict[s.extraActivityId]) {
      type = 'extra';
      label = this.extraDict[s.extraActivityId].name || label;
    }
    return { id: s.id, dateTimeStart: start, dateTimeEnd: end, durationMins, type, label, intensity, achievements: s.achievements || [] };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SÉLECTEURS DE PÉRIODE / MODE
  // ─────────────────────────────────────────────────────────────────────────
  selectPeriod(p: Period) {
    this.selectedPeriod = p;
    this.compute();
  }

  setChartMode(mode: 'line' | 'bar') {
    this.chartMode = mode;
    this.rebuildInvestChart(this.getFilteredBuckets());
  }

  prevWeek() { this.weekOffset--; this.compute(); }
  nextWeek() { this.weekOffset++; this.compute(); }

  // ─────────────────────────────────────────────────────────────────────────
  // CALCUL PRINCIPAL
  // ─────────────────────────────────────────────────────────────────────────
  private compute() {
    const filtered = this.filterByPeriod(this.sessions, this.selectedPeriod);
    this.computeBars(filtered);
    this.computeStats(filtered);
    this.computeWeekNav();
    this.computeInsights(filtered);
    this.computeAchievements(filtered);
    this.cdr.detectChanges();

    // Graphiques Canvas
    const buckets = this.getFilteredBuckets();
    this.destroyCharts();
    setTimeout(() => {
      this.buildInvestChart(buckets);
      this.buildHistoChart(buckets, filtered);
    }, 30);
  }

  private getFilteredBuckets(): BucketData[] {
    const filtered = this.filterByPeriod(this.sessions, this.selectedPeriod);
    return this.buildBuckets(filtered);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FILTRES
  // ─────────────────────────────────────────────────────────────────────────
  private filterByPeriod(sessions: ES[], period: Period): ES[] {
    const now = new Date();
    return sessions.filter(s => {
      const d = s.dateTimeStart;
      if (period === 'jour')    return d.toDateString() === now.toDateString();
      if (period === 'semaine') {
        const ws = this.ws(now), we = new Date(ws);
        we.setDate(we.getDate() + 7);
        return d >= ws && d < we;
      }
      if (period === 'mois')  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      return d.getFullYear() === now.getFullYear();
    });
  }

  private ws(d: Date): Date {
    const date = new Date(d);
    const day = date.getDay() || 7;
    date.setDate(date.getDate() - day + 1 + this.weekOffset * 7);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BUCKETS (données pour les graphiques)
  // ─────────────────────────────────────────────────────────────────────────
  private buildBuckets(ss: ES[]): BucketData[] {
    const make = (label: string, subset: ES[]): BucketData => ({
      label,
      total:     subset.reduce((a, b) => a + b.durationMins, 0),
      classMins: subset.filter(s => s.type === 'class').reduce((a, b) => a + b.durationMins, 0),
      sportMins: subset.filter(s => s.type === 'sport').reduce((a, b) => a + b.durationMins, 0),
      extraMins: subset.filter(s => s.type === 'extra').reduce((a, b) => a + b.durationMins, 0),
    });

    if (this.selectedPeriod === 'jour') {
      return Array.from({ length: 8 }, (_, i) => {
        const h = 7 + i * 2;
        const sub = ss.filter(s => { const hr = s.dateTimeStart.getHours(); return hr >= h && hr < h + 2; });
        return make(`${h}h`, sub);
      });
    }

    if (this.selectedPeriod === 'semaine') {
      const ws = this.ws(new Date());
      const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(ws); d.setDate(ws.getDate() + i);
        const sub = ss.filter(s => s.dateTimeStart.toDateString() === d.toDateString());
        return make(DAYS[i], sub);
      });
    }

    if (this.selectedPeriod === 'mois') {
      return Array.from({ length: 4 }, (_, i) => {
        const sub = ss.filter(s => { const day = s.dateTimeStart.getDate(); return day > i * 7 && day <= (i + 1) * 7; });
        return make(`Sem ${i + 1}`, sub);
      });
    }

    // annee
    const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
    return Array.from({ length: 12 }, (_, i) => {
      const sub = ss.filter(s => s.dateTimeStart.getMonth() === i);
      return make(MONTHS[i], sub);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BARRES VERTICALES
  // ─────────────────────────────────────────────────────────────────────────
  private computeBars(ss: ES[]) {
    const groups = [
      { type: 'class', icon: 'book-outline',    color: C.primary, label: 'Cours' },
      { type: 'sport', icon: 'fitness-outline', color: C.sport,   label: 'Sport' },
      { type: 'extra', icon: 'rocket-outline',  color: C.extra,   label: 'Extra' },
    ] as const;
    const totals = groups.map(g => ss.filter(s => s.type === g.type).reduce((a, b) => a + b.durationMins, 0));
    const max = Math.max(...totals, 1);
    const fmt = (m: number) => `${Math.floor(m / 60)}h${Math.round(m % 60).toString().padStart(2, '0')}`;
    this.activityBars = groups.map((g, i) => ({
      ...g, mins: totals[i],
      value: Math.max(Math.round(totals[i] / max * 100), 5),
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STATS CARTES
  // ─────────────────────────────────────────────────────────────────────────
  private computeStats(ss: ES[]) {
    const fmt = (m: number) => `${Math.floor(m / 60).toString().padStart(2, '0')}:${Math.round(m % 60).toString().padStart(2, '0')}`;
    const byType = (t: string) => ss.filter(s => s.type === t).reduce((a, b) => a + b.durationMins, 0);
    const total = ss.reduce((a, b) => a + b.durationMins, 0);
    this.periodStats = [
      { icon: 'time-outline',    value: fmt(total),          label: 'Temps total' },
      { icon: 'book-outline',    value: fmt(byType('class')), label: 'Cours' },
      { icon: 'fitness-outline', value: fmt(byType('sport')), label: 'Sport' },
      { icon: 'rocket-outline',  value: fmt(byType('extra')), label: 'Extra' },
      { icon: 'trophy-outline',  value: String(ss.reduce((a, b) => a + b.achievements.length, 0)), label: 'Achiev.' },
    ];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NAVIGATION SEMAINE
  // ─────────────────────────────────────────────────────────────────────────
  private computeWeekNav() {
    const now  = new Date();
    const ws   = this.ws(now);
    const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    this.visibleDays = Array.from({ length: 4 }, (_, i) => {
      const d = new Date(ws); d.setDate(ws.getDate() + i);
      return { num: d.getDate().toString().padStart(2, '0'), name: DAYS[i], active: d.toDateString() === now.toDateString() };
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INSIGHTS
  // ─────────────────────────────────────────────────────────────────────────
  private computeInsights(ss: ES[]) {
    if (!ss.length) {
      this.insights = [{ message: 'Aucune session sur cette période', pct: 0, source: '—', level: 'Normal' }];
      return;
    }
    const lc: Record<string, number> = {};
    ss.forEach(s => { lc[s.label] = (lc[s.label] || 0) + 1; });
    const top = Object.entries(lc).sort((a, b) => b[1] - a[1])[0];
    const total = ss.reduce((a, b) => a + b.durationMins, 0);
    const ref = ({ jour: 480, semaine: 2400, mois: 9600, annee: 115200 })[this.selectedPeriod];
    const pct = Math.min(Math.round(total / ref * 100), 99);
    const level = pct > 75 ? 'High' : pct > 40 ? 'Elevated' : 'Normal';
    const sportMins = ss.filter(s => s.type === 'sport').reduce((a, b) => a + b.durationMins, 0);
    const sportPct  = total > 0 ? Math.round(sportMins / total * 100) : 0;
    this.insights = [
      { message: 'Activité dominante sur la période', pct: Math.round(top[1] / ss.length * 100), source: top[0], level },
      { message: "Part de sport dans l'emploi du temps", pct: sportPct, source: `${ss.filter(s => s.type === 'sport').length} sessions sportives`, level: sportPct > 60 ? 'High' : sportPct > 30 ? 'Elevated' : 'Normal' }
    ];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ACHIEVEMENTS
  // ─────────────────────────────────────────────────────────────────────────
  private computeAchievements(ss: ES[]) {
    const m: Record<string, number> = {};
    ss.forEach(s => s.achievements.forEach(a => { if (a.name) m[a.name] = (m[a.name] || 0) + 1; }));
    this.topAchievements = Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => ({ name, count }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CHART.JS — OPTIONS COMMUNES
  // ─────────────────────────────────────────────────────────────────────────
  private commonScales(yLabel: string, stepSize?: number) {
    return {
      x: {
        grid:   { color: C.gridLine, drawBorder: false },
        border: { dash: [4, 4], color: C.gridLine },
        ticks:  { color: C.tick, font: { size: 10 }, maxRotation: 0, autoSkip: false },
      },
      y: {
        grid:   { color: C.gridLine, drawBorder: false },
        border: { dash: [4, 4], color: C.gridLine },
        ticks:  {
          color: C.tick, font: { size: 10 },
          callback: (v: any) => `${v}${yLabel}`,
          ...(stepSize ? { stepSize } : {}),
          count: 5,
        },
        beginAtZero: true,
      }
    };
  }

  private commonTooltip(labelFmt: (ctx: any) => string) {
    return {
      backgroundColor: C.tooltipBg,
      borderColor:     C.tooltipBorder,
      borderWidth:     1,
      titleColor:      '#ffffff',
      titleFont:       { size: 12 },
      bodyColor:       '#aaaaaa',
      bodyFont:        { size: 11 },
      padding:         10,
      callbacks:       { label: labelFmt }
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GRAPH INVESTISSEMENT (Line / Bar) — multi-séries
  // ─────────────────────────────────────────────────────────────────────────
  private buildInvestChart(buckets: BucketData[]) {
    if (!this.investCanvasRef) return;
    const ctx = this.investCanvasRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const toH = (m: number) => +(m / 60).toFixed(2);
    const isBar = this.chartMode === 'bar';

    const makeDataset = (label: string, data: number[], color: string, fill = false) => ({
      label,
      data,
      borderColor:          color,
      backgroundColor:      isBar ? color + '88' : color + '22',
      borderWidth:          isBar ? 0 : 2.5,
      pointBackgroundColor: '#161616',
      pointBorderColor:     color,
      pointRadius:          isBar ? 0 : 4,
      pointHoverRadius:     isBar ? 0 : 6,
      tension:              0.4,
      fill,
      borderRadius:         isBar ? 6 : 0,
    });

    this.investChart = new Chart(ctx, {
      type: isBar ? 'bar' : 'line',
      data: {
        labels:   buckets.map(b => b.label),
        datasets: [
          makeDataset('Total',  buckets.map(b => toH(b.total)),     C.primary, !isBar),
          makeDataset('Sport',  buckets.map(b => toH(b.sportMins)), C.sport),
          makeDataset('Cours',  buckets.map(b => toH(b.classMins)), C.cours),
          makeDataset('Extra',  buckets.map(b => toH(b.extraMins)), C.extra),
        ]
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        plugins: {
          legend:  { display: false },
          tooltip: this.commonTooltip(ctx2 => ` ${ctx2.dataset.label}: ${ctx2.parsed.y.toFixed(1)}h`)
        },
        scales: this.commonScales('h') as any,
        interaction: { mode: 'index', intersect: false }
      }
    });
  }

  private rebuildInvestChart(buckets: BucketData[]) {
    this.investChart?.destroy();
    this.investChart = undefined;
    setTimeout(() => this.buildInvestChart(buckets), 20);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HISTOGRAMME INTENSITÉ (Stacked bar)
  // ─────────────────────────────────────────────────────────────────────────
  private buildHistoChart(buckets: BucketData[], ss: ES[]) {
    if (!this.histoCanvasRef) return;
    const ctx = this.histoCanvasRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const lvl = (i: string | null | undefined) => {
      if (!i) return 'n';
      const v = i.toLowerCase();
      return v === 'high' || v === 'haute' ? 'h' : v === 'medium' || v === 'moyen' ? 'e' : 'n';
    };

    const normData: number[] = [];
    const elevData: number[] = [];
    const highData: number[] = [];

    buckets.forEach((_, bi) => {
      const bSessions = this.sessionsForBucket(ss, bi);
      const sports    = bSessions.filter(s => s.type === 'sport');
      const total     = Math.max(sports.length, 1);
      const hc = sports.filter(s => lvl(s.intensity) === 'h').length;
      const ec = sports.filter(s => lvl(s.intensity) === 'e').length;
      const nc = total - hc - ec;
      // On exprime en minutes de sport
      const sportMins = bSessions.filter(s => s.type === 'sport').reduce((a, b) => a + b.durationMins, 0);
      normData.push(Math.round(sportMins * nc / total));
      elevData.push(Math.round(sportMins * ec / total));
      highData.push(Math.round(sportMins * hc / total));
    });

    // Fallback si aucune donnée sport : utilise les minutes totales pondérées
    const hasAny = normData.some(v => v > 0) || elevData.some(v => v > 0) || highData.some(v => v > 0);
    if (!hasAny) {
      buckets.forEach((b, i) => {
        normData[i]  = Math.round(b.total * 0.51);
        elevData[i]  = Math.round(b.total * 0.19);
        highData[i]  = Math.round(b.total * 0.30);
      });
    }

    this.histoChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: buckets.map(b => b.label),
        datasets: [
          { label: 'Normal',  data: normData, backgroundColor: 'rgba(194,24,91,0.6)',  borderRadius: 3, borderSkipped: false as any },
          { label: 'Élevé',   data: elevData, backgroundColor: 'rgba(156,39,176,0.75)',borderRadius: 3, borderSkipped: false as any },
          { label: 'Haut',    data: highData, backgroundColor: 'rgba(233,30,99,0.95)', borderRadius: 3, borderSkipped: false as any },
        ]
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        plugins: {
          legend:  { display: false },
          tooltip: this.commonTooltip(ctx2 => ` ${ctx2.dataset.label}: ${ctx2.parsed.y} min`)
        },
        scales: {
          ...this.commonScales(' min') as any,
          x: { ...((this.commonScales(' min') as any).x), stacked: true },
          y: { ...((this.commonScales(' min') as any).y), stacked: true },
        },
        interaction: { mode: 'index', intersect: false }
      }
    });
  }

  private sessionsForBucket(ss: ES[], i: number): ES[] {
    if (this.selectedPeriod === 'jour') {
      const h = 7 + i * 2;
      return ss.filter(s => { const hr = s.dateTimeStart.getHours(); return hr >= h && hr < h + 2; });
    }
    if (this.selectedPeriod === 'semaine') {
      const ws = this.ws(new Date());
      const d  = new Date(ws); d.setDate(ws.getDate() + i);
      return ss.filter(s => s.dateTimeStart.toDateString() === d.toDateString());
    }
    if (this.selectedPeriod === 'mois') {
      return ss.filter(s => { const day = s.dateTimeStart.getDate(); return day > i * 7 && day <= (i + 1) * 7; });
    }
    return ss.filter(s => s.dateTimeStart.getMonth() === i);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RÉPARTITION (barres uniquement, pas de canvas)
  // ─────────────────────────────────────────────────────────────────────────
  private buildDonutChart(ss: ES[]) {
    const total     = Math.max(ss.reduce((a, b) => a + b.durationMins, 0), 1);
    const classMins = ss.filter(s => s.type === 'class').reduce((a, b) => a + b.durationMins, 0);
    const sportMins = ss.filter(s => s.type === 'sport').reduce((a, b) => a + b.durationMins, 0);
    const extraMins = ss.filter(s => s.type === 'extra').reduce((a, b) => a + b.durationMins, 0);

    this.donutPcts = [
      Math.round(classMins / total * 100),
      Math.round(sportMins / total * 100),
      Math.round(extraMins / total * 100),
    ];

    const totalH = Math.floor(total / 60);
    const totalM = Math.round(total % 60);
    this.donutTotalH = totalM > 0 ? `${totalH}h${totalM.toString().padStart(2,'0')}` : `${totalH}h`;

    this.cdr.detectChanges();
  }

  // ─────────────────────────────────────────────────────────────────────────
  private destroyCharts() {
    this.investChart?.destroy(); this.investChart = undefined;
    this.histoChart?.destroy();  this.histoChart  = undefined;
  }
}
