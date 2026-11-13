export const environment = {
  apiUrl: '', // web: rutas relativas, igual que hoy
  /**
   * La web solo consulta; capturar es exclusivo de la tablet.
   * TEMPORAL (v1.3.0): true mientras el tío no tenga la tablet; cambiar a false en el paso 4f.
   */
  capturaHabilitada: true,
  /** La web nunca usa base local: guarda directo en el servidor. */
  baseLocal: false,
};
