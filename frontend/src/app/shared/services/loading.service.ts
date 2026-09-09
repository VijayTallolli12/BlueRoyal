import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LoadingService {
  private loadingCount = signal(0);
  public get isLoading(): boolean {
    return this.loadingCount() > 0;
  }

  public show(): void {
    this.loadingCount.update((n) => n + 1);
  }

  public hide(): void {
    this.loadingCount.update((n) => Math.max(0, n - 1));
  }
}
