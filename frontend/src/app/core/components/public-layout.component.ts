import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet],
  template: `<main class="public-canvas"><router-outlet></router-outlet></main>`,
  styles: [`
    .public-canvas {
      min-height: 100vh;
      background: var(--color-page-bg);
    }
  `],
})
export class PublicLayoutComponent {}
