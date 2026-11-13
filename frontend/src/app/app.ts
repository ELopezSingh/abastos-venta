import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BarraEstadoPwa } from './core/pwa/barra-estado-pwa';
import { AuthService } from './core/auth/auth.service';
import { CAPTURA_HABILITADA } from './core/captura';
import { EstadoTablet } from './sincronizacion/estado-tablet';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, BarraEstadoPwa, EstadoTablet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly auth = inject(AuthService);

  /** En la web se avisa cuándo sincronizó la tablet por última vez. */
  protected readonly avisoTablet = !CAPTURA_HABILITADA;

  protected readonly secciones = CAPTURA_HABILITADA
    ? [
        { ruta: '/trailers', texto: 'Trailers' },
        { ruta: '/vender', texto: 'Vender' },
        { ruta: '/vales', texto: 'Vales' },
        { ruta: '/resumen', texto: 'Resumen' },
      ]
    : [
        { ruta: '/inicio', texto: 'Inicio' },
        { ruta: '/trailers', texto: 'Trailers' },
        { ruta: '/vales', texto: 'Vales' },
        { ruta: '/resumen', texto: 'Resumen' },
      ];
}
