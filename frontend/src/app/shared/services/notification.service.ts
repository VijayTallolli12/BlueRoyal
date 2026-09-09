import { Injectable, signal } from '@angular/core';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private notifications = signal<Notification[]>([]);
  public notifications$ = this.notifications.asReadonly();
  public get count(): number {
    return this.notifications().length;
  }

  private generateId(): string {
    return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  public success(message: string, duration = 5000): void {
    this.add({ type: 'success', message, duration });
  }

  public error(message: string, duration = 7000): void {
    this.add({ type: 'error', message, duration });
  }

  public warning(message: string, duration = 5000): void {
    this.add({ type: 'warning', message, duration });
  }

  public info(message: string, duration = 4000): void {
    this.add({ type: 'info', message, duration });
  }

  public remove(id: string): void {
    this.notifications.update((n) => n.filter((x) => x.id !== id));
  }

  public clear(): void {
    this.notifications.set([]);
  }

  private add(notification: Omit<Notification, 'id'>): void {
    const id = this.generateId();
    const notif: Notification = { ...notification, id };
    this.notifications.update((n) => [...n, notif]);

    if (notification.duration && notification.duration > 0) {
      setTimeout(() => this.remove(id), notification.duration);
    }
  }
}
