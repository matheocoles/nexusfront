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
import { play, pause, stop, timeOutline, add, trash, trashOutline,
  checkmarkCircleOutline, calendarOutline, locationOutline, playOutline, pauseOutline, stopOutline } from 'ionicons/icons';

import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

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
      'play-outline': playOutline,
      'pause-outline': pauseOutline,
      'stop-outline': stopOutline,
      'time-outline': timeOutline,
      'checkmark-circle-outline': checkmarkCircleOutline,
      'trash-outline': trashOutline,
      'calendar-outline': calendarOutline,
      'location-outline': locationOutline
    });
  }

  private nexusService = inject(NexusService);
  private toastCtrl    = inject(ToastController);
  private alertCtrl    = inject(AlertController);
  private cdr          = inject(ChangeDetectorRef);

  // ── Listes d'activités ──────────────────────────────────────────────────────
  classes: any[] = [];
  sports:  any[] = [];
  extras:  any[] = [];

  // ── Chronomètre — champs propres ────────────────────────────────────────────
  chronoTitle:        string = '';
  chronoDescription:  string = '';
  chronoTimeStart:    string = new Date().toTimeString().slice(0, 5);
  chronoActivityType: 'class' | 'sport' | 'extra' = 'class';
  chronoActivityId:   number = 0;

  // ── Chronomètre — état ──────────────────────────────────────────────────────
  isRunning      = false;
  isPaused       = false;
  elapsedSeconds = 0;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private startTimestamp = 0;
  private accumulated    = 0;
  protected timerStartDate: Date | null = null;

  get formattedTime(): string {
    const h = Math.floor(this.elapsedSeconds / 3600);
    const m = Math.floor((this.elapsedSeconds % 3600) / 60);
    const s = this.elapsedSeconds % 60;
    return `${this.pad(h)}:${this.pad(m)}:${this.pad(s)}`;
  }

  // ── Saisie manuelle — champs propres ────────────────────────────────────────
  manualTitle:        string = '';
  manualDescription:  string = '';
  manualDate:         string = new Date().toISOString().split('T')[0];
  manualTimeStart:    string = '08:00';
  manualDurationH:    number = 1;
  manualDurationMin:  number = 0;
  manualActivityType: 'class' | 'sport' | 'extra' = 'class';
  manualActivityId:   number = 0;
  savingSession              = false;

  get manualEndDate(): Date | null {
    if (!this.manualDate || !this.manualTimeStart) return null;
    const totalMin = this.manualDurationH * 60 + this.manualDurationMin;
    if (totalMin <= 0) return null;
    const start = new Date(this.manualDate + 'T' + this.manualTimeStart);
    return new Date(start.getTime() + totalMin * 60000);
  }

  get manualEndTime(): string {
    const end = this.manualEndDate;
    if (!end) return '--:--';
    return `${this.pad(end.getHours())}:${this.pad(end.getMinutes())}`;
  }

  get manualDurationLabel(): string {
    const h   = this.manualDurationH;
    const min = this.manualDurationMin;
    if (h > 0 && min > 0) return `${h}h${this.pad(min)}`;
    if (h > 0)            return `${h}h`;
    return `${min}min`;
  }

  // ── Sessions & graphique ────────────────────────────────────────────────────
  sessions:       any[]  = [];
  loadingSessions        = false;
  private chart: Chart | null = null;
  today = new Date().toISOString();

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

  // ── Chargement des listes d'activités ───────────────────────────────────────

  private loadActivityLists(): void {
    this.nexusService.getClasses().subscribe({ next: d => this.classes = d ?? [], error: () => {} });
    this.nexusService.getSports().subscribe({  next: d => this.sports  = d ?? [], error: () => {} });
    this.nexusService.getExtra().subscribe({   next: d => this.extras  = d ?? [], error: () => {} });
  }

  getActivityList(type: 'class' | 'sport' | 'extra'): any[] {
    if (type === 'sport') return this.sports;
    if (type === 'extra') return this.extras;
    return this.classes;
  }

  getActivityLabel(a: any): string {
    return a.name ?? a.title ?? a.label ?? a.nom ?? String(a.id);
  }

  // ── Chronomètre ─────────────────────────────────────────────────────────────

  startTimer(): void {
    if (!this.chronoTitle.trim()) return;
    const [h, m] = this.chronoTimeStart.split(':').map(Number);
    const start  = new Date();
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

    const savedType = this.chronoActivityType;
    const savedId   = this.chronoActivityId;
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

  // ── Saisie manuelle ─────────────────────────────────────────────────────────

  saveManualSession(): void {
    if (!this.manualTitle.trim()) return;
    const totalMin = this.manualDurationH * 60 + this.manualDurationMin;
    if (totalMin <= 0 || !this.manualDate || !this.manualTimeStart) return;
    const start = new Date(this.manualDate + 'T' + this.manualTimeStart);
    const end   = this.manualEndDate!;
    this.savingSession = true;
    this.persistSession(
      start, end,
      this.manualTitle, this.manualDescription,
      this.manualActivityType, this.manualActivityId,
      () => {
        this.savingSession = false;
        this.resetManualEntry();
      }
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

  // ── Sessions ────────────────────────────────────────────────────────────────

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

  private persistSession(
    start: Date,
    end: Date,
    title: string,
    description: string,
    activityType: 'class' | 'sport' | 'extra',
    activityId: number,
    cb?: () => void
  ): void {
    const dto: any = {
      dateTimeStart:   start.toISOString(),
      dateTimeEnd:     end.toISOString(),
      status:          title || 'Session Nexus',
      loginId:         1,
    };

    // Ajouter l'ID d'activité seulement s'il est > 0
    if (activityType === 'class' && activityId > 0) {
      dto.classId = activityId;
    } else if (activityType === 'sport' && activityId > 0) {
      dto.sportId = activityId;
    } else if (activityType === 'extra' && activityId > 0) {
      dto.extraActivityId = activityId;
    }

    this.nexusService.createSession(dto).subscribe({
      next: (s) => {
        const display = this.mapSession(s, start, end, activityType);
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

  private mapSession(s: any, realStart?: Date, realEnd?: Date, fallbackType?: any): any {
    const type: 'class' | 'sport' | 'extra' = s.sportId
      ? 'sport'
      : s.extraActivityId
        ? 'extra'
        : fallbackType || 'class';

    return {
      id:              s.id,
      activityType:    type,
      title:           s.status || s.activityName || '—',
      durationSeconds: Math.max(0, Math.floor(
        ((realEnd   || new Date(s.dateTimeEnd)).getTime() -
          (realStart || new Date(s.dateTimeStart)).getTime()) / 1000
      )),
      dateTimeStart: realStart || new Date(s.dateTimeStart),
      dateTimeEnd:   realEnd   || new Date(s.dateTimeEnd),
    };
  }

  formatSessionInterval(session: any): string {
    const startRef = session.dateTimeStart;
    const endRef   = session.dateTimeEnd;
    if (!startRef || isNaN(startRef.getTime())) return 'Date invalide';
    const dateStr = `${this.pad(startRef.getDate())}/${this.pad(startRef.getMonth() + 1)}`;
    const startH  = `${this.pad(startRef.getHours())}h${this.pad(startRef.getMinutes())}`;
    const endH    = `${this.pad(endRef.getHours())}h${this.pad(endRef.getMinutes())}`;
    return `${dateStr} • ${startH} → ${endH}`;
  }

  async deleteSession(session: any): Promise<void> {
    const alert = await this.alertCtrl.create({
      header:   'Supprimer la session ?',
      message:  `${session.title || '—'} — ${this.formatSessionInterval(session)}`,
      cssClass: 'nexus-alert',
      buttons: [
        { text: 'Annuler',   role: 'cancel',     cssClass: 'alert-button-cancel' },
        { text: 'Supprimer', role: 'destructive', cssClass: 'alert-button-confirm',
          handler: () => this.confirmDeleteSession(session) },
      ],
    });
    await alert.present();
  }

  private confirmDeleteSession(session: any): void {
    if (!session || !session.id) return;

    const sessionId = Number(session.id);

    this.nexusService.deleteSession(sessionId).subscribe({
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

  // ── Graphique ───────────────────────────────────────────────────────────────

  private readonly DOMAIN_COLORS: Record<string, string> = {
    class: '#311B5B',
    sport: '#280613',
    extra: '#610B2C',
  };

  renderChart(): void {
    const canvas = document.getElementById('activityChart') as HTMLCanvasElement;
    if (!canvas || this.sessions.length === 0) return;
    this.chart?.destroy();

    const reversed = [...this.sessions].reverse();
    const labels   = reversed.map(s => {
      const d = s.dateTimeStart;
      return `${this.pad(d.getDate())}/${this.pad(d.getMonth() + 1)}`;
    });

    const byType: Record<string, any> = {};
    reversed.forEach((s, i) => {
      const key = s.activityType;
      if (!byType[key]) byType[key] = { data: new Array(reversed.length).fill(null), type: key };
      byType[key].data[i] = (byType[key].data[i] ?? 0) + Math.round(s.durationSeconds / 60);
    });

    const typeLabels: Record<string, string> = {
      class: '📚 Cours', sport: '🏃 Sport', extra: '🎨 Extra',
    };

    this.chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: Object.entries(byType).map(([key, val]) => {
          const color = this.DOMAIN_COLORS[val.type] ?? '#9b1d6e';
          return {
            label:                typeLabels[key] ?? key,
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
              callback: (v) => { const n = Number(v); return n % 60 === 0 ? `${n / 60}h` : ''; },
            },
          },
        },
      },
    });
  }

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
