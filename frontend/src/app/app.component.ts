import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { LightRaysComponent } from './shared/components/light-rays/light-rays.component';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet, NavbarComponent, LightRaysComponent],
    template: `
    <app-light-rays />
    <app-navbar />
    <main>
      <router-outlet />
    </main>
  `,
    styles: [`
    main {
      min-height: calc(100vh - 64px);
      position: relative;
      z-index: 1;
    }
  `]
})
export class AppComponent { }
