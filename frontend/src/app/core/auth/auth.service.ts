import { LoginInput, SesionUsuario } from '@abastos/shared';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

const API = 'api/auth';
const CLAVE_USUARIO = 'abastos.usuario';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _usuario = signal<string | null>(null);
  readonly usuario = this._usuario.asReadonly();
  readonly autenticado = computed(() => this._usuario() !== null);

  async verificarSesion(): Promise<void> {
    const guardado = this.leerGuardado();
    this._usuario.set(guardado);
    try {
      const r = await firstValueFrom(
        this.http.get<SesionUsuario>(`${API}/yo`, { headers: { 'ngsw-bypass': 'true' } }),
      );
      this.recordar(r.usuario);
    } catch (error) {
      // Solo un 401 dice que la sesión ya no vale. Sin red, con el servidor
      // despertando (503) u otro error, se queda el usuario guardado: si la
      // sesión sí venció, la siguiente petición da 401 y manda al login.
      if (error instanceof HttpErrorResponse && error.status === 401) {
        if (guardado) this.sesionExpirada();
        else this.olvidar();
      }
    }
  }

  async iniciarSesion(datos: LoginInput): Promise<void> {
    const r = await firstValueFrom(this.http.post<SesionUsuario>(`${API}/login`, datos));
    this.recordar(r.usuario);
  }

  /** Requiere conexión: si falla, lanza el error y la sesión sigue abierta */
  async cerrarSesion(): Promise<void> {
    await firstValueFrom(this.http.post<void>(`${API}/logout`, {}));
    this.olvidar();
    await this.router.navigateByUrl('/login');
  }

  /** El servidor respondió 401 en alguna petición */
  sesionExpirada(): void {
    this.olvidar();
    void this.router.navigateByUrl('/login');
  }

  private recordar(usuario: string) {
    this._usuario.set(usuario);
    try {
      localStorage.setItem(CLAVE_USUARIO, usuario);
    } catch {
      /* sin almacenamiento */
    }
  }

  private olvidar() {
    this._usuario.set(null);
    try {
      localStorage.removeItem(CLAVE_USUARIO);
    } catch {
      /* sin almacenamiento */
    }
  }

  private leerGuardado(): string | null {
    try {
      return localStorage.getItem(CLAVE_USUARIO);
    } catch {
      return null;
    }
  }
}
