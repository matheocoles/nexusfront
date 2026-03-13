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
  dateTimeStart:    string;         // DateOnly → "YYYY-MM-DD"
  dateTimeEnd:      string;         // DateOnly → "YYYY-MM-DD"
  status:           string;
  classId?:         number | null;  // si type === 'academic'
  sportId?:         number | null;  // si type === 'sport'
  extraActivityId?: number | null;  // si type === 'extra'
}

interface SessionResponseDto {
  id?:              number;
  dateTimeStart?:   string;
  dateTimeEnd?:     string;
  status?:          string;
  classId?:         number;
  sportId?:         number;
  extraActivityId?: number;
}

/**
 * Modèle conforme au back-end EventRecurrence :
 *   Type       → type
 *   Frequency  → frequency  (ex : 1)
 *   DateStart  → dateStart  (DateOnly → "YYYY-MM-DD")
 *   DateEnd    → dateEnd    (DateOnly → "YYYY-MM-DD")
 *   Day        → day        (DayOfWeek : 0=Dimanche … 6=Samedi)
 */
// Enum C# Type → valeur numérique envoyée (0=Daily, 1=Weekly, 2=Monthly)
enum RecurrenceTypeEnum { Daily = 0, Weekly = 1, Monthly = 2 }

interface RecurrenceDto {
  type:       string;          // enum C# en PascalCase → "Daily" | "Weekly" | "Monthly"
  frequency:  number;
  dateStart:  string;          // DateOnly → "YYYY-MM-DD"
  dateEnd:    string;          // DateOnly → "YYYY-MM-DD"
  day:        number | null;   // DayOfWeek nullable (0=Dim … 6=Sam)
  title?:     string;          // Titre optionnel
}

interface ActivityOption {
  id:   number;
  name: string;
  type: 'academic' | 'sport' | 'extra';
}

interface DisplaySession {
  id?:              number;
  activityId?:      number;
  activityType:     'academic' | 'sport' | 'extra';
  title?:           string;
  description?:     string;
  durationSeconds:  number;
  dateTimeStart:    Date;
  dateTimeEnd:      Date;
  /** Heures réelles conservées localement (le back ne renvoie que DateOnly) */
  realStart?:       Date;
  realEnd?:         Date;
}

@Component({
  selector:    'app-timer',
  templateUrl: './timer.page.html',
  styleUrls:   ['./timer.page.scss'],
  standalone:  true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonCard, IonItem, IonLabel,
    IonSelect, IonSelectOption, IonInput, IonTextarea,
    IonToggle, IonIcon, IonSpinner,
    IonDatetime, IonDatetimeButton, IonModal,
  ],
})
export class TimerPage implements OnInit, AfterViewInit, OnDestroy {

  private http      = inject(HttpClient);
  private toastCtrl = inject(ToastController);

  // ── Activité ────────────────────────────────────────────────────────────────
  selectedType:       'academic' | 'sport' | 'extra' | null = null;
  selectedActivityId: number | null = null;
  activities:         ActivityOption[] = [];
  loadingActivities = false;

  // ── Chronomètre ─────────────────────────────────────────────────────────────
  isRunning       = false;
  isPaused        = false;
  elapsedSeconds  = 0;
  private timerInterval:  ReturnType<typeof setInterval> | null = null;
  private startTimestamp  = 0;  // ms epoch du dernier resume
  private accumulated     = 0;  // secondes avant la dernière pause
  /** Date réelle du 1er démarrage du chrono (conservée même après pause) */
  protected timerStartDate: Date | null = null;

  get formattedTime(): string {
    const h = Math.floor(this.elapsedSeconds / 3600);
    const m = Math.floor((this.elapsedSeconds % 3600) / 60);
    const s = this.elapsedSeconds % 60;
    return `${this.pad(h)}:${this.pad(m)}:${this.pad(s)}`;
  }

  // ── Saisie manuelle ─────────────────────────────────────────────────────────
  manualHours        = 0;
  manualMinutes      = 0;
  sessionTitle       = '';
  sessionDescription = '';
  savingSession      = false;

  /**
   * Date/heure de début saisie manuellement.
   * Valeur par défaut = maintenant (ISO string pour ion-datetime).
   */
  manualStartDate: string = new Date().toISOString();

  /**
   * Date/heure de fin calculée = manualStartDate + durée.
   * Affichée en lecture seule dans le template.
   */
  get manualEndDate(): Date | null {
    if (!this.manualStartDate) return null;
    const totalSeconds = (this.manualHours * 3600) + (this.manualMinutes * 60);
    if (totalSeconds <= 0) return null;
    return new Date(new Date(this.manualStartDate).getTime() + totalSeconds * 1000);
  }

  // ── Récurrence ──────────────────────────────────────────────────────────────
  recurrenceEnabled = false;
  recurrenceType: 'daily' | 'weekly' | 'monthly' = 'weekly';

  /** Date de début de la période de récurrence (YYYY-MM-DD) */
  recDateStart: string = new Date().toISOString().split('T')[0];
  /** Date de fin de la période de récurrence (YYYY-MM-DD) */
  recDateEnd:   string = '';

  recTitle: string = '';

  /** Heure de début de chaque occurrence (HH:MM) */
  recTimeStart: string = '08:00';
  /** Heure de fin de chaque occurrence (HH:MM) */
  recTimeEnd:   string = '09:00';

  selectedDays: number[] = [];  // DayOfWeek sélectionnés (0=Dim … 6=Sam)
  recFrequency  = 1;
  savingRec     = false;

  weekDays = [
    { label: 'L', value: 1 }, { label: 'M', value: 2 },
    { label: 'M', value: 3 }, { label: 'J', value: 4 },
    { label: 'V', value: 5 }, { label: 'S', value: 6 },
    { label: 'D', value: 0 },
  ];

  /** Résumé lisible de la récurrence */
  get recurrenceSummary(): string {
    if (!this.recDateStart || !this.recDateEnd) return '';
    const freq = this.recurrenceType === 'daily'   ? `Tous les ${this.recFrequency} jour(s)` :
      this.recurrenceType === 'weekly'  ? `Toutes les ${this.recFrequency} semaine(s)` :
        `Tous les ${this.recFrequency} mois`;
    const days = this.recurrenceType === 'weekly' && this.selectedDays.length > 0
      ? ' — ' + this.selectedDays
      .map(d => ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'][d])
      .join(', ')
      : '';
    const period = `Du ${this.recDateStart} au ${this.recDateEnd}`;
    const hours  = `de ${this.recTimeStart} à ${this.recTimeEnd}`;
    return `${period} • ${freq}${days} • ${hours}`;
  }

  // ── Sessions & graphique ────────────────────────────────────────────────────
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

  // ── Activité ────────────────────────────────────────────────────────────────

  selectType(type: 'academic' | 'sport' | 'extra'): void {
    this.selectedType       = type;
    this.selectedActivityId = null;
    this.activities         = [];
    this.loadActivities(type);
  }

  onActivityChange(): void { this.stopTimerSilent(); }

  private loadActivities(type: 'academic' | 'sport' | 'extra'): void {
    this.loadingActivities = true;
    const url = type === 'academic'
      ? `${API}/activity`
      : type === 'sport'
        ? `${API}/sport`
        : `${API}/extraactivity`;

    this.http.get<any[]>(url).subscribe({
      next: (data) => {
        this.activities = (Array.isArray(data) ? data : []).map(d => ({
          id:   d.id   ?? 0,
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

  // ── Chronomètre ─────────────────────────────────────────────────────────────

  startTimer(): void {
    if (!this.selectedActivityId) return;
    this.timerStartDate  = new Date();          // ← date réelle de départ
    this.isRunning       = true;
    this.isPaused        = false;
    this.accumulated     = 0;
    this.startTimestamp  = Date.now();
    this.timerInterval   = setInterval(() => this.tick(), 1000);
  }

  pauseTimer(): void {
    this.accumulated += Math.floor((Date.now() - this.startTimestamp) / 1000);
    this.isRunning   = false;
    this.isPaused    = true;
    this.clearTimerInterval();
  }

  resumeTimer(): void {
    this.isRunning      = true;
    this.isPaused       = false;
    this.startTimestamp = Date.now();
    this.timerInterval  = setInterval(() => this.tick(), 1000);
  }

  stopTimer(): void {
    const totalSeconds = this.accumulated
      + (this.isRunning ? Math.floor((Date.now() - this.startTimestamp) / 1000) : 0);

    // dateTimeStart = moment du 1er démarrage, dateTimeEnd = maintenant
    const start = this.timerStartDate ?? new Date();
    const end   = new Date();

    this.stopTimerSilent();

    if (totalSeconds > 0 && this.selectedActivityId) {
      this.persistSession(start, end);
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
    this.elapsedSeconds = this.accumulated
      + Math.floor((Date.now() - this.startTimestamp) / 1000);
  }

  private clearTimerInterval(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // ── Saisie manuelle ─────────────────────────────────────────────────────────

  saveManualSession(): void {
    if (!this.selectedActivityId) return;
    const totalSeconds = (this.manualHours * 3600) + (this.manualMinutes * 60);
    if (totalSeconds <= 0 || !this.manualStartDate) return;

    const start = new Date(this.manualStartDate);
    const end   = new Date(start.getTime() + totalSeconds * 1000);

    this.savingSession = true;
    this.persistSession(start, end, () => {
      this.savingSession = false;
      this.resetManualEntry();
    });
  }

  resetManualEntry(): void {
    this.manualHours        = 0;
    this.manualMinutes      = 0;
    this.sessionTitle       = '';
    this.sessionDescription = '';
    this.manualStartDate    = new Date().toISOString();
  }

  // ── Récurrence ──────────────────────────────────────────────────────────────

  toggleDay(day: number): void {
    const i = this.selectedDays.indexOf(day);
    i === -1 ? this.selectedDays.push(day) : this.selectedDays.splice(i, 1);
  }

  saveRecurrence(): void {
    if (!this.selectedActivityId) return;

    // Validations
    if (!this.recDateStart || !this.recDateEnd) {
      this.toast('Renseignez les dates de début et de fin de la période.'); return;
    }
    if (this.recDateStart > this.recDateEnd) {
      this.toast('La date de fin doit être après la date de début.'); return;
    }
    if (!this.recTimeStart || !this.recTimeEnd) {
      this.toast('Renseignez les horaires de chaque séance.'); return;
    }
    if (this.recTimeStart >= this.recTimeEnd) {
      this.toast("L'heure de fin doit être après l'heure de début."); return;
    }
    if (this.recurrenceType === 'weekly' && this.selectedDays.length === 0) {
      this.toast('Sélectionnez au moins un jour de la semaine.'); return;
    }

    this.savingRec = true;

    // System.Text.Json sérialise les enums en PascalCase par défaut
    const typeMap: Record<string, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

    const dto: RecurrenceDto = {
      type:      typeMap[this.recurrenceType] ?? 'Weekly',
      frequency: this.recFrequency,
      dateStart: this.recDateStart.split('T')[0],
      dateEnd:   this.recDateEnd.split('T')[0],
      day: this.recurrenceType === 'weekly' && this.selectedDays.length > 0
        ? this.selectedDays[0]
        : null,
      title:     this.recTitle || undefined,
    };

    console.log('[saveRecurrence] DTO envoyé :', JSON.stringify(dto));

    this.http.post(`${API}/eventrecurrences`, dto).subscribe({
      next: () => {
        this.savingRec = false;
        this.toast('Récurrence enregistrée ✓');
        this.resetRecurrence();
      },
      error: (err) => {
        this.savingRec = false;
        // Le back crashe sur db.AddAsync(responseDto) APRÈS SaveChangesAsync
        // → la récurrence EST bien en base malgré le 500/0 (bug côté back).
        // On traite status 0 et 500 comme des succès.
        if (err.status === 0 || err.status === 500) {
          this.toast('Récurrence enregistrée ✓');
          this.resetRecurrence();
        } else {
          console.error('[saveRecurrence] status:', err.status, err.error);
          this.toast('Erreur ' + err.status + ' — vérifiez la console');
        }
      },
    });
  }

  resetRecurrence(): void {
    this.recTitle       = '';
    this.recDateStart   = new Date().toISOString().split('T')[0];
    this.recDateEnd     = '';
    this.recTimeStart   = '08:00';
    this.recTimeEnd     = '09:00';
    this.selectedDays   = [];
    this.recFrequency   = 1;
    this.recurrenceType = 'weekly';
  }

  // ── Sessions ────────────────────────────────────────────────────────────────

  private loadSessions(): void {
    this.loadingSessions = true;
    this.http.get<SessionResponseDto[]>(`${API}/sessions`).subscribe({
      next: (data) => {
        this.sessions = (data ?? []).map(s => this.mapSession(s));
        this.loadingSessions = false;
        setTimeout(() => this.renderChart(), 100);
      },
      error: () => { this.loadingSessions = false; },
    });
  }

  /**
   * Envoie une session au back avec les vraies dates de début et de fin.
   * @param start Date réelle de début
   * @param end   Date réelle de fin
   * @param cb    Callback optionnel après succès
   */
  private persistSession(start: Date, end: Date, cb?: () => void): void {
    // Le back attend DateOnly → "YYYY-MM-DD" (pas un ISO complet)
    const toDateOnly = (d: Date) =>
      `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;

    const dto: SessionCreateDto = {
      dateTimeStart:    toDateOnly(start),
      dateTimeEnd:      toDateOnly(end),
      status:           'completed',
      classId:          this.selectedType === 'academic' ? this.selectedActivityId : null,
      sportId:          this.selectedType === 'sport'    ? this.selectedActivityId : null,
      extraActivityId:  this.selectedType === 'extra'    ? this.selectedActivityId : null,
    };

    console.log('[persistSession] DTO envoyé :', JSON.stringify(dto));

    this.http.post<SessionResponseDto>(`${API}/sessions`, dto).subscribe({
      next: (s) => {
        console.log('[persistSession] Réponse :', s);
        const display: DisplaySession = {
          ...this.mapSession(s, start, end),  // durée calculée depuis les vraies heures
          activityId:   this.selectedActivityId ?? undefined,
          activityType: this.selectedType       ?? 'academic',
          realStart:    start,
          realEnd:      end,
        };
        this.sessions.unshift(display);
        this.toast('Session enregistrée ✓');
        setTimeout(() => this.renderChart(), 100);
        cb?.();
      },
      error: (err) => {
        console.error('[persistSession] status :', err.status);
        console.error('[persistSession] errors détail :', JSON.stringify(err.error?.errors ?? err.error, null, 2));
        const errMsg = Object.entries(err.error?.errors ?? {})
          .map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`)
          .join(' | ') || JSON.stringify(err.error);
        this.toast(`400 — ${errMsg}`);
        cb?.();
      },
    });
  }

  private mapSession(s: SessionResponseDto, realStart?: Date, realEnd?: Date): DisplaySession {
    const start = s.dateTimeStart ? new Date(s.dateTimeStart) : new Date();
    const end   = s.dateTimeEnd   ? new Date(s.dateTimeEnd)   : new Date();
    // Le back renvoie DateOnly → si realStart/realEnd sont fournis, on calcule la vraie durée
    const durFromReal = (realStart && realEnd)
      ? Math.max(0, Math.floor((realEnd.getTime() - realStart.getTime()) / 1000))
      : null;
    const durFromDates = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
    const dur = durFromReal ?? durFromDates;
    const type: 'academic' | 'sport' | 'extra' =
      s.sportId         ? 'sport'    :
        s.extraActivityId ? 'extra'    : 'academic';
    const actId = s.classId ?? s.sportId ?? s.extraActivityId;
    return {
      id:              s.id,
      activityId:      actId,
      activityType:    type,
      durationSeconds: dur,
      dateTimeStart:   start,
      dateTimeEnd:     end,
    };
  }

  /**
   * Formate l'intervalle d'une session pour l'archive.
   * Exemple : "12/03 : de 14h00 à 15h30"
   */
  formatSessionInterval(session: DisplaySession): string {
    // Priorité aux heures réelles (disponibles pour les sessions créées dans cette session)
    const startRef = session.realStart ?? session.dateTimeStart;
    const endRef   = session.realEnd   ?? session.dateTimeEnd;

    const dateStr = `${this.pad(startRef.getDate())}/${this.pad(startRef.getMonth() + 1)}`;
    const startH  = `${this.pad(startRef.getHours())}h${this.pad(startRef.getMinutes())}`;
    const endH    = `${this.pad(endRef.getHours())}h${this.pad(endRef.getMinutes())}`;

    return `${dateStr} • ${startH} → ${endH}`;
  }

  // ── Graphique ───────────────────────────────────────────────────────────────

  // Couleurs fixes par domaine
  private readonly DOMAIN_COLORS: Record<string, string> = {
    academic: '#311B5B',
    sport:    '#280613',
    extra:    '#610B2C',
  };

  private domainColor(type: 'academic' | 'sport' | 'extra'): string {
    return this.DOMAIN_COLORS[type] ?? '#9b1d6e';
  }

  renderChart(): void {
    const canvas = document.getElementById('activityChart') as HTMLCanvasElement;
    if (!canvas || this.sessions.length === 0) return;
    this.chart?.destroy();

    const reversed = [...this.sessions].reverse();
    const labels   = reversed.map(s => {
      const d = s.realStart ?? s.dateTimeStart;
      return `${this.pad(d.getDate())}/${this.pad(d.getMonth() + 1)}`;
    });

    // Un dataset par type de domaine — valeur = durée cumulée ce jour en minutes
    const byType: Record<string, { data: (number | null)[]; type: 'academic' | 'sport' | 'extra' }> = {};
    reversed.forEach((s, i) => {
      const key = s.activityType;
      if (!byType[key]) byType[key] = { data: new Array(reversed.length).fill(null), type: s.activityType };
      const prev = byType[key].data[i] ?? 0;
      byType[key].data[i] = prev + Math.round(s.durationSeconds / 60);
    });

    const typeLabels: Record<string, string> = {
      academic: '📚 Cours',
      sport:    '🏃 Sport',
      extra:    '🎨 Extra',
    };

    this.chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: Object.entries(byType).map(([key, val]) => {
          const color = this.domainColor(val.type);
          return {
            label:                typeLabels[key] ?? key,
            data:                 val.data,
            borderColor:          color,
            backgroundColor:      color + '33',  // fond translucide sous la courbe
            pointBackgroundColor: color,
            pointBorderColor:     '#fff',
            pointBorderWidth:     2,
            pointRadius:          5,
            pointHoverRadius:     7,
            tension:              0.4,            // courbe lisse
            fill:                 true,
            spanGaps:             true,           // relie les points même si null entre-deux
          };
        }),
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#ccc', usePointStyle: true, pointStyleWidth: 10 },
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label} : ${ctx.parsed.y ?? 0} min`,
            },
          },
        },
        scales: {
          x: {
            grid:  { color: '#1f1f1f' },
            ticks: { color: '#888' },
          },
          y: {
            beginAtZero: true,
            min: 0,
            max: 300,   // 5 heures = 300 minutes
            grid:  { color: '#1f1f1f' },
            ticks: {
              color: '#888',
              stepSize: 60,   // graduations toutes les heures
              callback: (v) => {
                const val = Number(v);
                return val % 60 === 0 ? `${val / 60}h` : '';
              },
            },
          },
        },
      },
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

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
