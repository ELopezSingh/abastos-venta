import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../environments/environment';

export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  if (!environment.apiUrl || !/^\/?api\//.test(req.url)) {
    return next(req);
  }
  const ruta = req.url.startsWith('/') ? req.url : '/' + req.url;
  return next(req.clone({ url: environment.apiUrl + ruta }));
};
