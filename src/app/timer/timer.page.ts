import { Component, OnDestroy, OnInit, AfterViewInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonCard, IonItem, IonLabel,
  IonSelect, IonSelectOption, IonInput,
  IonToggle, IonIcon, IonSpinner,
  IonButton,
  ToastController, AlertController,
} from '@ionic/angular/standalone';
import { NexusService } from '../services/nexus.service';
import { addIcons } from 'ionicons';
import { play, pause, stop, timeOutline, add, trash } from 'ionicons/icons';

import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

@Component({
  selector:    'app-timer',
  templateUrl: './timer.page.html',
  styleUrls:   ['./timer.page.scss'],
  standalone:  true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonCard, IonItem, IonLabel,
    IonSelect, IonSelectOption, IonInput,
    IonToggle, IonIcon, IonSpinner,
    IonButton,
  ],
})
export class TimerPage implements OnInit, AfterViewInit, OnDestroy {

  private nexusService = inject(NexusService);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private cdr = inject(ChangeDetectorRef);

  // ── Activité ────────────────────────────────────────────────────────────────
  selectedActivityId: number | null = null;

  // ✅ SIMPLIFIÉ : Pas de chips, juste les activités
  planningActivities: any[] = [];
  loadingActivities = false;
  private colorPalette = ['#2a0a14', '#5e102e', '#3f255e', '#5e4c85', '#7a6a9e'];

  // ── Chronomètre ─────────────────────────────────────────────────────────────
  isRunning = false;
  isPaused = false;
  elapsedSeconds = 0;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private startTimestamp = 0;
  private accumulated = 0;
  protected timerStartDate: Date | null = null;

  get formattedTime(): string {
    const h = Math.floor(this.elapsedSeconds / 3600);
    const m = Math.floor((this.elapsedSeconds % 3600) / 60);
    const s = this.elapsedSeconds % 60;
    return `${this.pad(h)}:${this.pad(m)}:${this.pad(s)}`;
  }

  // ── Saisie manuelle ──────────────────────────────────────────────────────────
  manualDate: string = new Date().toISOString().split('T')[0];
  manualTimeStart: string = '08:00';
  manualDurationH: number = 1;
  manualDurationMin: number = 0;
  savingSession = false;

  get manualEndDate(): Date | null {
    if (!this.manualDate || !this.manualTimeStart) return null;
    const totalMin = this.manualDurationH * 60 + this.manualDurationMin;
    if (totalMin <= 0) return null;
    const start = new Date(this.manualDate + 'T' + this.manualTimeStart);
    return new Date(start.getTime() + totalMin * 60000);
  }

  // ── Récurrence ──────────────────────────────────────────────────────────────
  recurrenceEnabled = false;
  recurrenceType: 'daily' | 'weekly' | 'monthly' = 'weekly';
  recDateStart: string = new Date().toISOString().split('T')[0];
  recDateEnd: string = '';
  recTitle: string = '';
  recTimeStart: string = '08:00';
  recTimeEnd: string = '09:00';
  selectedDays: number[] = [];
  savingRec = false;

  recurrences: any[] = [];
  loadingRecurrences = false;

  weekDays = [
    {label: 'L', value: 1}, {label: 'M', value: 2},
    {label: 'M', value: 3}, {label: 'J', value: 4},
    {label: 'V', value: 5}, {label: 'S', value: 6},
    {label: 'D', value: 0},
  ];

  readonly recTypeLabels: Record<number, string> = {
    0: 'Quotidien', 1: 'Hebdomadaire', 2: 'Mensuel',
  };

  readonly dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  private readonly dotnetDayMap: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
  };

  get recurrenceSummary(): string {
    if (!this.recDateStart || !this.recDateEnd) return '';
    const titlePart = this.recTitle ? `${this.recTitle} — ` : '';
    const typeMap: Record<string, number> = {daily: 0, weekly: 1, monthly: 2};
    const typeLabel = this.recTypeLabels[typeMap[this.recurrenceType]];
    const days = this.recurrenceType === 'weekly' && this.selectedDays.length > 0
      ? ' — ' + this.selectedDays.map(d => this.dayNames[d]).join(', ')
      : '';
    const period = `Du ${this.recDateStart} au ${this.recDateEnd}`;
    const hours = `de ${this.recTimeStart} à ${this.recTimeEnd}`;
    return `${titlePart}${typeLabel}${days} • ${period} • ${hours}`;
  }

  // ── Sessions & graphique ────────────────────────────────────────────────────
  sessions: any[] = [];
  loadingSessions = false;
  apiOffline = false;
  private chart: Chart | null = null;
  today = new Date().toISOString();

  constructor() {
    addIcons({play, pause, stop, timeOutline, add, trash});
  }

  ngOnInit(): void {
    this.loadSchedule();
    this.loadSessions();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.renderChart(), 300);
  }

  ngOnDestroy(): void {
    this.clearTimerInterval();
    this.chart?.destroy();
  }

  // ── Activité du Planning ──────────────────────────────────────────────────────

  loadSchedule() {
    this.loadingActivities = true;
    this.nexusService.getSchedule().subscribe({
      next: (data: any[]) => {
        this.planningActivities = data.sort((a, b) =>
          new Date(a.dateTimeStart).getTime() - new Date(b.dateTimeStart).getTime()
        ).map((item, index) => ({
          ...item,
          name: item.status || item.Status || `Activité #${item.id}`,
          room: item.room || item.Room || 'Zone Nexus',
          startTime: this.formatTime(item.dateTimeStart),
          endTime: this.formatTime(item.dateTimeEnd),
          duration: this.calculateDuration(item.dateTimeStart, item.dateTimeEnd),
          displayColor: this.colorPalette[index % this.colorPalette.length],
          type: this.determineActivityType(item.status || item.Status || '')
        }));
        this.loadingActivities = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingActivities = false;
        this.toast('Erreur de connexion planning');
      }
    });
  }

  formatTime(dateStr: string) {
    if (!dateStr) return '--:--';
    const date = new Date(dateStr);
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  calculateDuration(start: string, end: string): string {
    if (!start || !end) return '1h';
    const diffMs = new Date(end).getTime() - new Date(start).getTime();
    const mins = Math.floor(Math.abs(diffMs) / 60000);
    if (mins < 60) return `${mins}min`;
    const hrs = Math.floor(mins / 60);
    const rMins = mins % 60;
    return rMins > 0 ? `${hrs}h${rMins.toString().padStart(2, '0')}` : `${hrs}h`;
  }

  private determineActivityType(statusOrType: string): 'class' | 'sport' | 'extra' {
    const lower = statusOrType.toLowerCase();

    const sportKeywords = ['sport', 'foot', 'football', 'tennis', 'basket', 'volley',
      'natation', 'course', 'athlétisme', 'gym', 'yoga', 'boxe',
      'ski', 'danse', 'handball', 'rugby', 'badminton'];

    const extraKeywords = ['projet', 'club', 'atelier', 'musique', 'art', 'dessin',
      'théâtre', 'débat', 'conférence', 'séminaire', 'labo', 'tp'];

    if (sportKeywords.some(keyword => lower.includes(keyword))) {
      return 'sport';
    }

    if (extraKeywords.some(keyword => lower.includes(keyword))) {
      return 'extra';
    }

    return 'class';
  }

  onActivityChange(): void {
    this.stopTimerSilent();
  }

  activityLabel(id?: number | null | undefined): string {
    if (!id) return '—';
    const found = this.planningActivities.find(a => a.id === id);
    if (found) return found.name;
    return `Activité #${id}`;
  }

  // ── Chronomètre ─────────────────────────────────────────────────────────────

  startTimer(): void {
    if (!this.selectedActivityId) return;
    this.timerStartDate = new Date();
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
    const totalSeconds = this.accumulated + (this.isRunning ? Math.floor((Date.now() - this.startTimestamp) / 1000) : 0);
    const start = this.timerStartDate ?? new Date();
    const end = new Date();
    this.stopTimerSilent();
    if (totalSeconds > 0 && this.selectedActivityId) {
      this.persistSession(start, end);
    }
  }

  private stopTimerSilent(): void {
    this.isRunning = false;
    this.isPaused = false;
    this.elapsedSeconds = 0;
    this.accumulated = 0;
    this.timerStartDate = null;
    this.clearTimerInterval();
  }

  private tick(): void {
    this.elapsedSeconds = this.accumulated + Math.floor((Date.now() - this.startTimestamp) / 1000);
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
    const totalMin = this.manualDurationH * 60 + this.manualDurationMin;
    if (totalMin <= 0 || !this.manualDate || !this.manualTimeStart) return;
    const start = new Date(this.manualDate + 'T' + this.manualTimeStart);
    const end = this.manualEndDate!;
    this.savingSession = true;
    this.persistSession(start, end, () => {
      this.savingSession = false;
      this.resetManualEntry();
    });
  }

  resetManualEntry(): void {
    this.manualDate = new Date().toISOString().split('T')[0];
    this.manualTimeStart = '08:00';
    this.manualDurationH = 1;
    this.manualDurationMin = 0;
  }

  // ── Récurrence ──────────────────────────────────────────────────────────────

  toggleDay(day: number): void {
    const i = this.selectedDays.indexOf(day);
    i === -1 ? this.selectedDays.push(day) : this.selectedDays.splice(i, 1);
  }

  saveRecurrence(): void {
    if (!this.selectedActivityId) {
      this.toast('Veuillez sélectionner une activité');
      return;
    }

    // Vérifications de base pour éviter d'envoyer n'importe quoi
    if (!this.recDateStart || !this.recDateEnd) {
      this.toast('Dates de début/fin manquantes');
      return;
    }

    this.savingRec = true;
    const typeMap: Record<string, number> = { daily: 0, weekly: 1, monthly: 2 };
    const selectedActivity = this.planningActivities.find(a => a.id === this.selectedActivityId);

    const dto: any = {
      title: this.recTitle || selectedActivity?.name || 'Récurrence Nexus',
      type: typeMap[this.recurrenceType] ?? 1,
      frequency: 1, // Valeur par défaut requise par ton modèle C#
      dateStart: this.recDateStart.split('T')[0],
      dateEnd: this.recDateEnd.split('T')[0],
      startTime: this.recTimeStart + ':00',
      endTime: this.recTimeEnd + ':00',
      day: this.recurrenceType === 'weekly' && this.selectedDays.length > 0
        ? this.selectedDays[0]
        : null,
      classId: null,
      sportId: null,
      extraActivityId: null
    };

    console.log('DTO Récurrence envoyé :', dto);

    this.nexusService.createSession(dto).subscribe({
      next: () => {
        this.savingRec = false;
        this.toast('Récurrence enregistrée ✓');
        this.resetRecurrence();
      },
      error: (err) => {
        this.savingRec = false;
        console.error('Erreur récurrence:', err);
        this.toast('Erreur : l\'API refuse cette récurrence (500)');
      },
    });
  }

  resetRecurrence(): void {
    this.recTitle = '';
    this.recDateStart = new Date().toISOString().split('T')[0];
    this.recDateEnd = '';
    this.recTimeStart = '08:00';
    this.recTimeEnd = '09:00';
    this.selectedDays = [];
    this.recurrenceType = 'weekly';
  }

  // ── Sessions ────────────────────────────────────────────────────────────────

  private loadSessions(): void {
    this.loadingSessions = true;
    this.nexusService.getSchedule().subscribe({
      next: (data) => {
        const now = new Date();
        this.sessions = (data ?? [])
          .filter(s => {
            const endDate = new Date(s.dateTimeEnd);
            return endDate < now;
          })
          .map(s => this.mapSession(s));

        this.loadingSessions = false;
        setTimeout(() => this.renderChart(), 100);
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingSessions = false;
      }
    });
  }

  private persistSession(start: Date, end: Date, cb?: () => void): void {
    const selectedActivity = this.planningActivities.find(a => a.id === this.selectedActivityId);

    const dto: any = {
      dateTimeStart: start.toISOString(),
      dateTimeEnd: end.toISOString(),
      status: selectedActivity?.name || 'Session Nexus',
      loginId: 1 // On suppose que l'utilisateur 1 existe
    };

    this.nexusService.createSession(dto).subscribe({
      next: (s) => {
        // Si on arrive ici, c'est gagné !
        const type = selectedActivity?.type || 'class';
        const display = this.mapSession(s, start, end, type);
        this.sessions.unshift(display);
        this.toast('Session enregistrée ✓');
        this.renderChart();
        if (cb) cb();
      },
      error: (err) => {
        // Si ça plante encore ici, le problème vient soit du LoginId, soit de Railway
        console.error('Crash persistant. DTO envoyé:', dto);
        this.toast('Erreur serveur (ID Login ou Activité invalide)');
        if (cb) cb();
      }
    });
  }

  private mapSession(s: any, realStart?: Date, realEnd?: Date, fallbackType?: any): any {
    const type = s.sportId ? 'sport' : (s.extraActivityId ? 'extra' : (fallbackType || 'class'));
    const actId = s.sportId || s.extraActivityId || s.classId || this.selectedActivityId;

    return {
      id: s.id,
      activityId: actId,
      activityType: type,
      title: s.activityName || s.status || this.activityLabel(actId),
      durationSeconds: Math.max(0, Math.floor(((realEnd || new Date(s.dateTimeEnd)).getTime() - (realStart || new Date(s.dateTimeStart)).getTime()) / 1000)),
      dateTimeStart: realStart || new Date(s.dateTimeStart),
      dateTimeEnd: realEnd || new Date(s.dateTimeEnd)
    };
  }

  formatSessionInterval(session: any): string {
    const startRef = session.realStart ?? session.dateTimeStart;
    const endRef = session.realEnd ?? session.dateTimeEnd;
    if (!startRef || isNaN(startRef.getTime())) return 'Date invalide';

    const dateStr = `${this.pad(startRef.getDate())}/${this.pad(startRef.getMonth() + 1)}`;
    const startH = `${this.pad(startRef.getHours())}h${this.pad(startRef.getMinutes())}`;
    const endH = `${this.pad(endRef.getHours())}h${this.pad(endRef.getMinutes())}`;
    return `${dateStr} • ${startH} → ${endH}`;
  }

  async deleteSession(session: any): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: '⚠️ Supprimer la session ?',
      message: `Êtes-vous sûr de vouloir supprimer cette session ?\n\n<strong>${session.title || '—'}</strong>\n${this.formatSessionInterval(session)}`,
      buttons: [
        { text: 'Annuler', role: 'cancel', cssClass: 'alert-cancel' },
        { text: 'Supprimer', role: 'destructive', cssClass: 'alert-destructive', handler: () => this.confirmDeleteSession(session) },
      ],
    });
    await alert.present();
  }

  private confirmDeleteSession(session: any): void {
    if (!session.id) return;
    this.nexusService.deleteSession(session.id).subscribe({
      next: () => {
        this.sessions = this.sessions.filter(s => s.id !== session.id);
        this.toast('Session supprimée ✓');
        setTimeout(() => this.renderChart(), 100);
      },
      error: () => {
        this.toast('Erreur lors de la suppression');
      },
    });
  }

  async deleteRecurrence(recurrence: any): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: '⚠️ Supprimer la récurrence ?',
      message: `Êtes-vous sûr de vouloir supprimer cette récurrence ?\n\n<strong>${recurrence.title || this.recTypeLabels[recurrence.type]}</strong>\n${recurrence.dateStart} → ${recurrence.dateEnd}`,
      buttons: [
        { text: 'Annuler', role: 'cancel', cssClass: 'alert-cancel' },
        { text: 'Supprimer', role: 'destructive', cssClass: 'alert-destructive', handler: () => this.confirmDeleteRecurrence(recurrence) },
      ],
    });
    await alert.present();
  }

  private confirmDeleteRecurrence(recurrence: any): void {
    // Pas d'implémentation nécessaire
  }

  // ── Graphique ───────────────────────────────────────────────────────────────

  private readonly DOMAIN_COLORS: Record<string, string> = {
    class: '#311B5B',
    sport: '#280613',
    extra: '#610B2C',
  };

  private domainColor(type: 'class' | 'sport' | 'extra'): string {
    return this.DOMAIN_COLORS[type] ?? '#9b1d6e';
  }

  renderChart(): void {
    const canvas = document.getElementById('activityChart') as HTMLCanvasElement;
    if (!canvas || this.sessions.length === 0) return;
    this.chart?.destroy();

    const reversed = [...this.sessions].reverse();
    const labels = reversed.map(s => {
      const d = s.realStart ?? s.dateTimeStart;
      return `${this.pad(d.getDate())}/${this.pad(d.getMonth() + 1)}`;
    });

    const byType: Record<string, any> = {};
    reversed.forEach((s, i) => {
      const key = s.activityType;
      if (!byType[key]) byType[key] = {data: new Array(reversed.length).fill(null), type: s.activityType};
      const prev = byType[key].data[i] ?? 0;
      byType[key].data[i] = prev + Math.round(s.durationSeconds / 60);
    });

    const typeLabels: Record<string, string> = {
      class: '📚 Cours',
      sport: '🏃 Sport',
      extra: '🎨 Extra',
    };

    this.chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: Object.entries(byType).map(([key, val]) => {
          const color = this.domainColor(val.type);
          return {
            label: typeLabels[key] ?? key,
            data: val.data,
            borderColor: color,
            backgroundColor: color + '33',
            pointBackgroundColor: color,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
            tension: 0.4,
            fill: true,
            spanGaps: true,
          };
        }),
      },
      options: {
        responsive: true,
        interaction: {mode: 'index', intersect: false},
        plugins: {
          legend: {
            position: 'top',
            labels: {color: '#ccc', usePointStyle: true, pointStyleWidth: 10},
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label} : ${ctx.parsed.y ?? 0} min`,
            },
          },
        },
        scales: {
          x: {grid: {color: '#1f1f1f'}, ticks: {color: '#888'}},
          y: {
            beginAtZero: true, min: 0, max: 300,
            grid: {color: '#1f1f1f'},
            ticks: {
              color: '#888', stepSize: 60,
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

  formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  private pad(n: number): string {
    return n.toString().padStart(2, '0');
  }

  private async toast(msg: string): Promise<void> {
    const t = await this.toastCtrl.create({message: msg, duration: 2000, position: 'top'});
    await t.present();
  }
}
