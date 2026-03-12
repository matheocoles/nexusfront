import { Component, OnDestroy, OnInit, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonCard, IonItem, IonLabel, IonNote,
  IonSelect, IonSelectOption, IonInput, IonTextarea,
  IonToggle, IonIcon, IonSpinner,
  IonDatetime, IonDatetimeButton, IonModal,
  ToastController,
} from '@ionic/angular/standalone';
import { HttpClient } from '@angular/common/http';
import { addIcons } from 'ionicons';
import { play, pause, stop, timeOutline, add } from 'ionicons/icons';

import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

const API = 'https://nexusapi.up.railway.app/API';

// ── DTOs ─────────────────────────────────────────────────────────────────────

interface SessionCreateDto {
  dateTimeStart: string;
  dateTimeEnd:   string;
  status:        string;
  achievementIds: number[];
}

interface SessionResponseDto {
  id?:            number;
  dateTimeStart?: string;
  dateTimeEnd?:   string;
  status?:        string;
  achievementIds?: number[];
}

interface RecurrenceDto {
  type:       string;
  frequency?: number;
  dateEnd?:   string;
  day?:       number;
}

interface ActivityOption {
  id:   number;
  name: string;
  type: 'academic' | 'sport' | 'extra';
}

interface DisplaySession {
  id?:             number;
  activityId?:     number;
  activityType:    'academic' | 'sport' | 'extra';
  title?:          string;
  description?:    string;
  durationSeconds: number;
  dateTimeStart:   Date; // Requis pour le formattage
  dateTimeEnd:     Date; // Ajouté pour l'intervalle
}

@Component({
  selector:    'app-timer',
  templateUrl: './timer.page.html',
  styleUrls:   ['./timer.page.scss'],
  standalone:  true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonCard, IonItem, IonLabel, IonNote,
    IonSelect, IonSelectOption, IonInput, IonTextarea,
    IonToggle, IonIcon, IonSpinner,
    IonDatetime, IonDatetimeButton, IonModal,
  ],
})
export class TimerPage implements OnInit, AfterViewInit, OnDestroy {

  private http      = inject(HttpClient);
  private toastCtrl = inject(ToastController);

  selectedType:       'academic' | 'sport' | 'extra' | null = null;
  selectedActivityId: number | null = null;
  activities:         ActivityOption[] = [];
  loadingActivities = false;

  isRunning      = false;
  isPaused       = false;
  elapsedSeconds = 0;
  private timerInterval:  ReturnType<typeof setInterval> | null = null;
  private startTimestamp  = 0;
  private accumulated     = 0;

  get formattedTime(): string {
    const h = Math.floor(this.elapsedSeconds / 3600);
    const m = Math.floor((this.elapsedSeconds % 3600) / 60);
    const s = this.elapsedSeconds % 60;
    return `${this.pad(h)}:${this.pad(m)}:${this.pad(s)}`;
  }

  manualHours        = 0;
  manualMinutes      = 0;
  sessionTitle       = '';
  sessionDescription = '';
  savingSession      = false;

  recurrenceEnabled = false;
  recurrenceType: 'daily' | 'weekly' | 'monthly' = 'weekly';
  recurrenceEndDate = '';
  selectedDays: number[] = [];
  recHour   = 0;
  recMinute = 0;
  savingRec = false;

  weekDays = [
    { label: 'L', value: 1 }, { label: 'M', value: 2 },
    { label: 'M', value: 3 }, { label: 'J', value: 4 },
    { label: 'V', value: 5 }, { label: 'S', value: 6 },
    { label: 'D', value: 0 },
  ];

  sessions:       DisplaySession[] = [];
  loadingSessions = false;
  apiOffline      = false;
  private chart:  Chart | null = null;
  today = new Date().toISOString();

  constructor() {
    addIcons({ play, pause, stop, timeOutline, add });
  }

  ngOnInit():        void { this.loadSessions(); }
  ngAfterViewInit(): void { setTimeout(() => this.renderChart(), 300); }
  ngOnDestroy():     void { this.clearTimerInterval(); this.chart?.destroy(); }

  selectType(type: 'academic' | 'sport' | 'extra'): void {
    this.selectedType       = type;
    this.selectedActivityId = null;
    this.activities         = [];
    this.loadActivities(type);
  }

  onActivityChange(): void { this.stopTimerSilent(); }

  private loadActivities(type: 'academic' | 'sport' | 'extra'): void {
    this.loadingActivities = true;
    const url = type === 'academic' ? `${API}/activity` : type === 'sport' ? `${API}/sport` : `${API}/extraactivity`;

    this.http.get<any[]>(url).subscribe({
      next: (data) => {
        this.activities = (Array.isArray(data) ? data : []).map(d => ({
          id: d.id ?? 0,
          name: d.name ?? `Activité #${d.id}`,
          type,
        }));
        this.loadingActivities = false;
      },
      error: (err) => {
        this.loadingActivities = false;
        if (err.status === 0) this.apiOffline = true;
      },
    });
  }

  activityLabel(id?: number): string {
    if (!id) return '—';
    return this.activities.find(a => a.id === id)?.name ?? `Activité #${id}`;
  }

  startTimer(): void {
    if (!this.selectedActivityId) return;
    this.isRunning = true;
    this.isPaused = false;
    this.accumulated = 0;
    this.startTimestamp = Date.now();
    this.timerInterval = setInterval(() => this.tick(), 1000);
  }

  pauseTimer(): void {
    this.accumulated += Math.floor((Date.now() - this.startTimestamp) / 1000);
    this.isRunning = false;
    this.isPaused = true;
    this.clearTimerInterval();
  }

  resumeTimer(): void {
    this.isRunning = true;
    this.isPaused = false;
    this.startTimestamp = Date.now();
    this.timerInterval = setInterval(() => this.tick(), 1000);
  }

  stopTimer(): void {
    const total = this.accumulated + (this.isRunning ? Math.floor((Date.now() - this.startTimestamp) / 1000) : 0);
    this.stopTimerSilent();
    if (total > 0 && this.selectedActivityId) this.persistSession(total);
  }

  private stopTimerSilent(): void {
    this.isRunning = false;
    this.isPaused = false;
    this.elapsedSeconds = 0;
    this.accumulated = 0;
    this.clearTimerInterval();
  }

  private tick(): void {
    this.elapsedSeconds = this.accumulated + Math.floor((Date.now() - this.startTimestamp) / 1000);
  }

  private clearTimerInterval(): void {
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
  }

  saveManualSession(): void {
    if (!this.selectedActivityId) return;
    const totalSeconds = (this.manualHours * 3600) + (this.manualMinutes * 60);
    if (totalSeconds <= 0) return;
    this.savingSession = true;
    this.persistSession(totalSeconds, () => {
      this.savingSession = false;
      this.resetManualEntry();
    });
  }

  resetManualEntry(): void {
    this.manualHours = 0; this.manualMinutes = 0;
    this.sessionTitle = ''; this.sessionDescription = '';
  }

  toggleDay(day: number): void {
    const i = this.selectedDays.indexOf(day);
    i === -1 ? this.selectedDays.push(day) : this.selectedDays.splice(i, 1);
  }

  saveRecurrence(): void {
    if (!this.selectedActivityId) return;
    this.savingRec = true;
    const dto: RecurrenceDto = {
      type: this.recurrenceType,
      frequency: this.selectedDays[0] ?? 0,
      dateEnd: this.recurrenceEndDate ? this.recurrenceEndDate.split('T')[0] : undefined,
      day: this.selectedDays[0] !== undefined ? Number(this.selectedDays[0]) : undefined,
    };
    this.http.post(`${API}/eventrecurrences`, dto).subscribe({
      next: () => { this.savingRec = false; this.toast('Récurrence enregistrée !'); },
      error: () => { this.savingRec = false; }
    });
  }

  // ── LOGIQUE DES DATES MISE À JOUR ──────────────────────────────────────────

  private loadSessions(): void {
    this.loadingSessions = true;
    this.http.get<SessionResponseDto[]>(`${API}/sessions`).subscribe({
      next: (data) => {
        this.sessions = (data ?? []).map(s => this.mapSession(s));
        this.loadingSessions = false;
        setTimeout(() => this.renderChart(), 100);
      },
      error: () => { this.loadingSessions = false; }
    });
  }

  private persistSession(durationSeconds: number, cb?: () => void): void {
    const now = new Date();
    const end = new Date(now.getTime() + durationSeconds * 1000);

    const dto: SessionCreateDto = {
      dateTimeStart: now.toISOString(),
      dateTimeEnd:   end.toISOString(),
      status:        'completed',
      achievementIds: this.selectedActivityId ? [this.selectedActivityId] : [],
    };

    this.http.post<SessionResponseDto>(`${API}/sessions`, dto).subscribe({
      next: (s) => {
        const display: DisplaySession = {
          ...this.mapSession(s),
          activityId:   this.selectedActivityId ?? undefined,
          activityType: this.selectedType       ?? 'academic',
          durationSeconds,
        };
        this.sessions.unshift(display);
        this.toast('Session enregistrée ✓');
        setTimeout(() => this.renderChart(), 100);
        cb?.();
      },
      error: () => { cb?.(); }
    });
  }

  private mapSession(s: SessionResponseDto): DisplaySession {
    const start = s.dateTimeStart ? new Date(s.dateTimeStart) : new Date();
    const end   = s.dateTimeEnd   ? new Date(s.dateTimeEnd)   : new Date();
    const dur   = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
    return {
      id:              s.id,
      activityType:    'academic',
      durationSeconds: dur,
      dateTimeStart:   start,
      dateTimeEnd:     end
    };
  }

  /**
   * Formate la date pour l'archive
   * Exemple : "12/03 : 14h00 à 15h30"
   */
  formatSessionInterval(session: DisplaySession): string {
    const start = session.dateTimeStart;
    const end   = session.dateTimeEnd;

    const dateStr = `${this.pad(start.getDate())}/${this.pad(start.getMonth() + 1)}`;
    const startH  = `${this.pad(start.getHours())}h${this.pad(start.getMinutes())}`;
    const endH    = `${this.pad(end.getHours())}h${this.pad(end.getMinutes())}`;

    return `${dateStr} : de ${startH} à ${endH}`;
  }

  // ── Graphique & Helpers ────────────────────────────────────────────────────

  renderChart(): void {
    const canvas = document.getElementById('activityChart') as HTMLCanvasElement;
    if (!canvas || this.sessions.length === 0) return;
    this.chart?.destroy();

    const reversed = [...this.sessions].reverse();
    const labels = reversed.map(s => `${s.dateTimeStart.getDate()}/${s.dateTimeStart.getMonth() + 1}`);

    const map: Record<string, number[]> = {};
    reversed.forEach((s, i) => {
      const key = this.activityLabel(s.activityId);
      if (!map[key]) map[key] = new Array(reversed.length).fill(0);
      map[key][i] = Math.round(s.durationSeconds / 60);
    });

    this.chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: Object.entries(map).map(([name, data], i) => ({
          label: name, data, borderColor: '#9b1d6e', tension: 0.4
        }))
      },
      options: { responsive: true }
    });
  }

  formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  private pad(n: number): string { return n.toString().padStart(2, '0'); }

  private async toast(msg: string): Promise<void> {
    const t = await this.toastCtrl.create({ message: msg, duration: 2000, position: 'top' });
    await t.present();
  }
}
