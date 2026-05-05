import { Component, OnDestroy, OnInit, AfterViewInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonToggle, IonIcon, IonSpinner,
  ToastController, AlertController,
} from '@ionic/angular/standalone';
import { NexusService } from '../services/nexus.service';
import { addIcons } from 'ionicons';
import {
  play, pause, stop, timeOutline, add, trash, trashOutline,
  checkmarkCircleOutline, calendarOutline, locationOutline,
  playOutline, pauseOutline, stopOutline,
} from 'ionicons/icons';

import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

// ── Types locaux ────────────────────────────────────────────────────────────

type ActivityType = 'class' | 'sport' | 'extra';

interface ActivityItem {
  id:    number;
  name?: string;
  title?: string;
  label?: string;
  nom?:  string;
  // Discriminateurs C# présents selon le sous-type
  subject?:   string; // Class
  type?:      string; // Sport
  organiser?: string; // ExtraActivity
}

interface SessionDisplay {
  id:              number;
  activityType:    ActivityType;
  title:           string;
  durationSeconds: number;
  dateTimeStart:   Date;
  dateTimeEnd:     Date;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Détermine le type d'une activité à partir de ses champs discriminants.
 * - Class       → possède `subject` ou `teacher`
 * - Sport       → possède `intensity` ou (`type` && `place`)
 * - ExtraActivity → possède `organiser` ou `theme`
 */
function detectActivityType(a: ActivityItem): ActivityType {
  if (a.subject !== undefined || (a as any).teacher !== undefined) return 'class';
  if ((a as any).intensity !== undefined) return 'sport';
  if (a.organiser !== undefined || (a as any).theme !== undefined) return 'extra';
  return 'class'; // fallback
}

@Component({
  selector:    'app-timer',
  templateUrl: './timer.page.html',
  styleUrls:   ['./timer.page.scss'],
  standalone:  true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonIcon, IonSpinner,
  ],
})
export class TimerPage implements OnInit, AfterViewInit, OnDestroy {

  constructor() {
    addIcons({
      'play-outline':              playOutline,
      'pause-outline':             pauseOutline,
      'stop-outline':              stopOutline,
      'time-outline':              timeOutline,
      'checkmark-circle-outline':  checkmarkCircleOutline,
      'trash-outline':             trashOutline,
      'calendar-outline':          calendarOutline,
      'location-outline':          locationOutline,
    });
  }

  private nexusService = inject(NexusService);
  private toastCtrl    = inject(ToastController);
  private alertCtrl    = inject(AlertController);
  private cdr          = inject(ChangeDetectorRef);

  // ── Listes d'activités ──────────────────────────────────────────────────
  classes: ActivityItem[] = [];
  sports:  ActivityItem[] = [];
  extras:  ActivityItem[] = [];

  // ── Chronomètre — formulaire ────────────────────────────────────────────
  chronoTitle:        string       = '';
  chronoDescription:  string       = '';
  chronoTimeStart:    string       = new Date().toTimeString().slice(0, 5);
  chronoActivityType: ActivityType = 'class';
  chronoActivityId:   number       = 0;

  // ── Chronomètre — état ──────────────────────────────────────────────────
  isRunning      = false;
  isPaused       = false;
  elapsedSeconds = 0;
  private timerInterval:  ReturnType<typeof setInterval> | null = null;
  private startTimestamp  = 0;
  private accumulated     = 0;
  protected timerStartDate: Date | null = null;

  get formattedTime(): string {
    const h = Math.floor(this.elapsedSeconds / 3600);
    const m = Math.floor((this.elapsedSeconds % 3600) / 60);
    const s = this.elapsedSeconds % 60;
    return `${this.pad(h)}:${this.pad(m)}:${this.pad(s)}`;
  }

  // ── Saisie manuelle — formulaire ────────────────────────────────────────
  manualTitle:        string       = '';
  manualDescription:  string       = '';
  manualDate:         string       = new Date().toISOString().split('T')[0];
  manualTimeStart:    string       = '08:00';
  manualDurationH:    number       = 1;
  manualDurationMin:  number       = 0;
  manualActivityType: ActivityType = 'class';
  manualActivityId:   number       = 0;
  savingSession                    = false;

  get manualEndDate(): Date | null {
    if (!this.manualDate || !this.manualTimeStart) return null;
    const totalMin = this.manualDurationH * 60 + this.manualDurationMin;
    if (totalMin <= 0) return null;
    const start = new Date(`${this.manualDate}T${this.manualTimeStart}`);
    return new Date(start.getTime() + totalMin * 60_000);
  }

  get manualEndTime(): string {
    const end = this.manualEndDate;
    return end ? `${this.pad(end.getHours())}:${this.pad(end.getMinutes())}` : '--:--';
  }

  get manualDurationLabel(): string {
    const h   = this.manualDurationH;
    const min = this.manualDurationMin;
    if (h > 0 && min > 0) return `${h}h${this.pad(min)}`;
    if (h > 0)            return `${h}h`;
    return `${min}min`;
  }

  // ── Sessions & graphique ────────────────────────────────────────────────
  sessions:       SessionDisplay[] = [];
  loadingSessions                  = false;
  private chart: Chart | null      = null;
  today = new Date().toISOString();

  // ────────────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadSessions();
    this.loadActivityLists();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.renderChart(), 300);
  }

  ngOnDestroy(): void {
    this.clearTimerInterval();
    this.chart?.destroy();
  }

  // ── Listes d'activités ──────────────────────────────────────────────────

  private loadActivityLists(): void {
    this.nexusService.getClasses().subscribe({ next: d => this.classes = d ?? [], error: () => {} });
    this.nexusService.getSports().subscribe({  next: d => this.sports  = d ?? [], error: () => {} });
    this.nexusService.getExtra().subscribe({
      next: (d: any) => this.extras = d ?? [],
      error: () => {}
    });
  }

  getActivityList(type: ActivityType): ActivityItem[] {
    if (type === 'sport') return this.sports;
    if (type === 'extra') return this.extras;
    return this.classes;
  }

  getActivityLabel(a: ActivityItem): string {
    return a.name ?? a.title ?? a.label ?? a.nom ?? String(a.id);
  }

  // ── Chronomètre ─────────────────────────────────────────────────────────

  startTimer(): void {
    if (!this.chronoTitle.trim()) return;
    const [h, m]        = this.chronoTimeStart.split(':').map(Number);
    const start         = new Date();
    start.setHours(h, m, 0, 0);
    this.timerStartDate = start;
    this.isRunning      = true;
    this.isPaused       = false;
    this.accumulated    = 0;
    this.startTimestamp = Date.now();
    this.timerInterval  = setInterval(() => this.tick(), 1000);
  }

  pauseTimer(): void {
    this.accumulated += Math.floor((Date.now() - this.startTimestamp) / 1000);
    this.isRunning    = false;
    this.isPaused     = true;
    this.clearTimerInterval();
  }

  resumeTimer(): void {
    this.isRunning      = true;
    this.isPaused       = false;
    this.startTimestamp = Date.now();
    this.timerInterval  = setInterval(() => this.tick(), 1000);
  }

  stopTimer(): void {
    const totalSeconds = this.accumulated +
      (this.isRunning ? Math.floor((Date.now() - this.startTimestamp) / 1000) : 0);
    const start = this.timerStartDate ?? new Date();
    const end   = new Date();

    const savedType  = this.chronoActivityType;
    const savedId    = this.chronoActivityId;
    const savedTitle = this.chronoTitle;
    const savedDesc  = this.chronoDescription;

    this.stopTimerSilent();

    if (totalSeconds > 0) {
      this.persistSession(start, end, savedTitle, savedDesc, savedType, savedId, () => {
        this.chronoTitle        = '';
        this.chronoDescription  = '';
        this.chronoTimeStart    = new Date().toTimeString().slice(0, 5);
        this.chronoActivityType = 'class';
        this.chronoActivityId   = 0;
      });
    }
  }

  private stopTimerSilent(): void {
    this.isRunning      = false;
    this.isPaused       = false;
    this.elapsedSeconds = 0;
    this.accumulated    = 0;
    this.timerStartDate = null;
    this.clearTimerInterval();
  }

  private tick(): void {
    this.elapsedSeconds =
      this.accumulated + Math.floor((Date.now() - this.startTimestamp) / 1000);
  }

  private clearTimerInterval(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // ── Saisie manuelle ─────────────────────────────────────────────────────

  saveManualSession(): void {
    if (!this.manualTitle.trim()) return;
    const totalMin = this.manualDurationH * 60 + this.manualDurationMin;
    if (totalMin <= 0 || !this.manualDate || !this.manualTimeStart) return;
    const start = new Date(`${this.manualDate}T${this.manualTimeStart}`);
    const end   = this.manualEndDate!;
    this.savingSession = true;
    this.persistSession(
      start, end,
      this.manualTitle, this.manualDescription,
      this.manualActivityType, this.manualActivityId,
      () => {
        this.savingSession = false;
        this.resetManualEntry();
      },
    );
  }

  resetManualEntry(): void {
    this.manualTitle        = '';
    this.manualDescription  = '';
    this.manualDate         = new Date().toISOString().split('T')[0];
    this.manualTimeStart    = '08:00';
    this.manualDurationH    = 1;
    this.manualDurationMin  = 0;
    this.manualActivityType = 'class';
    this.manualActivityId   = 0;
  }

  // ── Sessions ────────────────────────────────────────────────────────────

  private loadSessions(): void {
    this.loadingSessions = true;
    this.nexusService.getSessions().subscribe({
      next: (data) => {
        const now = new Date();
        this.sessions = (data ?? [])
          .filter(s => new Date(s.dateTimeEnd) < now)
          .map(s => this.mapSession(s));
        this.loadingSessions = false;
        setTimeout(() => this.renderChart(), 100);
        this.cdr.detectChanges();
      },
      error: () => { this.loadingSessions = false; },
    });
  }

  /**
   * Construit le DTO minimal correspondant exactement au modèle CreateSessionDto C# :
   *   { DateTimeStart, DateTimeEnd, Status, LoginId, ActivityIds, AchievementIds }
   *
   * - activityId est inclus dans ActivityIds si non nul (0 = pas d'activité sélectionnée)
   * - AchievementIds est omis (null → ignoré par le backend)
   */
  private buildSessionDto(
    start:      Date,
    end:        Date,
    title:      string,
    activityId: number,
  ): Record<string, unknown> {
    const dto: Record<string, unknown> = {
      dateTimeStart:   start.toISOString(),
      dateTimeEnd:     end.toISOString(),
      status:          title.trim() || 'Session Nexus',
      loginId:         1,
      achievementIds:  null,
    };

    // N'inclure activityIds que si une activité est réellement sélectionnée
    dto['activityIds'] = activityId > 0 ? [activityId] : null;

    return dto;
  }

  /**
   * Cache local (survit aux rechargements via localStorage) :
   * sessionId → ActivityType
   * Permet d'afficher la bonne catégorie même après rechargement de page,
   * sans que le backend ait à stocker ce type.
   */
  private readonly CACHE_KEY = 'nexus_session_type_cache';

  private getTypeCache(): Record<number, ActivityType> {
    try {
      return JSON.parse(localStorage.getItem(this.CACHE_KEY) ?? '{}');
    } catch {
      return {};
    }
  }

  private cacheSessionType(sessionId: number, type: ActivityType): void {
    const cache = this.getTypeCache();
    cache[sessionId] = type;
    try { localStorage.setItem(this.CACHE_KEY, JSON.stringify(cache)); } catch {}
  }

  private persistSession(
    start:        Date,
    end:          Date,
    title:        string,
    description:  string,
    activityType: ActivityType,
    activityId:   number,
    cb?:          () => void,
  ): void {
    // Passe activityId au DTO pour que le backend lie l'activité
    const dto = this.buildSessionDto(start, end, title, activityId);

    this.nexusService.createSession(dto).subscribe({
      next: (s) => {
        // Mémorise le type localement — le backend ne le stocke pas
        if (s?.id) this.cacheSessionType(s.id, activityType);
        const display = this.mapSession(s, start, end, activityType, activityId);
        this.sessions.unshift(display);
        this.toast('Session enregistrée ✓');
        this.renderChart();
        if (cb) cb();
      },
      error: (err) => {
        console.error('Erreur persistSession:', err);
        this.toast('Erreur serveur');
        if (cb) cb();
      },
    });
  }

  /**
   * Convertit une session brute (API) en SessionDisplay.
   *
   * Résolution du type d'activité (par ordre de priorité) :
   *  1. `fallbackType` — passé lors d'une création dans la même session
   *  2. Cache localStorage (survit aux rechargements)
   *  3. Champs discriminants dans s.activities[] si le GET les renvoie
   *  4. 'class' par défaut
   */
  private mapSession(
    s:             any,
    realStart?:    Date,
    realEnd?:      Date,
    fallbackType?: ActivityType,
    fallbackId?:   number,
  ): SessionDisplay {
    const start = realStart ?? new Date(s.dateTimeStart);
    const end   = realEnd   ?? new Date(s.dateTimeEnd);

    // 1. Fourni directement (création en cours)
    let activityType: ActivityType = fallbackType
      // 2. Cache local
      ?? (this.getTypeCache()[s.id] as ActivityType | undefined)
      // 3. Champs discriminants dans le payload (si le back les renvoie un jour)
      ?? (Array.isArray(s.activities) && s.activities.length > 0
        ? detectActivityType(s.activities[0])
        : undefined)
      // 4. Défaut
      ?? 'class';

    return {
      id:              s.id,
      activityType,
      title:           s.status || '—',
      durationSeconds: Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000)),
      dateTimeStart:   start,
      dateTimeEnd:     end,
    };
  }

  formatSessionInterval(session: SessionDisplay): string {
    const s = session.dateTimeStart;
    const e = session.dateTimeEnd;
    if (!s || isNaN(s.getTime())) return 'Date invalide';
    const dateStr  = `${this.pad(s.getDate())}/${this.pad(s.getMonth() + 1)}`;
    const startStr = `${this.pad(s.getHours())}h${this.pad(s.getMinutes())}`;
    const endStr   = `${this.pad(e.getHours())}h${this.pad(e.getMinutes())}`;
    return `${dateStr} • ${startStr} → ${endStr}`;
  }

  async deleteSession(session: SessionDisplay): Promise<void> {
    const alert = await this.alertCtrl.create({
      header:   'Supprimer la session ?',
      message:  `${session.title || '—'} — ${this.formatSessionInterval(session)}`,
      cssClass: 'nexus-alert',
      buttons: [
        { text: 'Annuler',   role: 'cancel',      cssClass: 'alert-button-cancel' },
        { text: 'Supprimer', role: 'destructive',  cssClass: 'alert-button-confirm',
          handler: () => this.confirmDeleteSession(session) },
      ],
    });
    await alert.present();
  }

  private confirmDeleteSession(session: SessionDisplay): void {
    if (!session?.id) return;

    this.nexusService.deleteSession(Number(session.id)).subscribe({
      next: () => {
        this.sessions = this.sessions.filter(s => s.id !== session.id);
        this.toast('Session supprimée ✓');
        this.renderChart();
      },
      error: (err) => {
        console.error('Détails des erreurs API:', err.error?.errors);
        this.toast('Le serveur refuse la suppression de cette session');
      },
    });
  }

  // ── Graphique ───────────────────────────────────────────────────────────

  private readonly DOMAIN_COLORS: Record<ActivityType, string> = {
    class: '#311B5B',
    sport: '#280613',
    extra: '#610B2C',
  };

  renderChart(): void {
    const canvas = document.getElementById('activityChart') as HTMLCanvasElement | null;
    if (!canvas || this.sessions.length === 0) return;
    this.chart?.destroy();

    const reversed = [...this.sessions].reverse();
    const labels   = reversed.map(s => {
      const d = s.dateTimeStart;
      return `${this.pad(d.getDate())}/${this.pad(d.getMonth() + 1)}`;
    });

    const byType: Record<string, { data: (number | null)[]; type: ActivityType }> = {};
    reversed.forEach((s, i) => {
      const key = s.activityType;
      if (!byType[key]) byType[key] = { data: new Array(reversed.length).fill(null), type: key };
      byType[key].data[i] = ((byType[key].data[i] as number | null) ?? 0) +
        Math.round(s.durationSeconds / 60);
    });

    const typeLabels: Record<ActivityType, string> = {
      class: '📚 Cours',
      sport: '🏃 Sport',
      extra: '🎨 Extra',
    };

    this.chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: Object.entries(byType).map(([key, val]) => {
          const color = this.DOMAIN_COLORS[val.type] ?? '#9b1d6e';
          return {
            label:                typeLabels[val.type] ?? key,
            data:                 val.data,
            borderColor:          color,
            backgroundColor:      color + '33',
            pointBackgroundColor: color,
            pointBorderColor:     '#fff',
            pointBorderWidth:     2,
            pointRadius:          5,
            pointHoverRadius:     7,
            tension:              0.4,
            fill:                 true,
            spanGaps:             true,
          };
        }),
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend:  { position: 'top', labels: { color: '#ccc', usePointStyle: true, pointStyleWidth: 10 } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label} : ${ctx.parsed.y ?? 0} min` } },
        },
        scales: {
          x: { grid: { color: '#1f1f1f' }, ticks: { color: '#888' } },
          y: {
            beginAtZero: true, min: 0, max: 300,
            grid:  { color: '#1f1f1f' },
            ticks: {
              color: '#888', stepSize: 60,
              callback: (v) => {
                const n = Number(v);
                return n % 60 === 0 ? `${n / 60}h` : '';
              },
            },
          },
        },
      },
    });
  }

  // ── Utilitaires ─────────────────────────────────────────────────────────

  formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  pad(n: number): string {
    return n.toString().padStart(2, '0');
  }

  private async toast(msg: string): Promise<void> {
    const t = await this.toastCtrl.create({ message: msg, duration: 2000, position: 'top' });
    await t.present();
  }
}
